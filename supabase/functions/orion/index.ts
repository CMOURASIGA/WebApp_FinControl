// Edge Function da Orion — único ponto de entrada entre o frontend do
// 7Finance e a OpenAI. Ver docs/03-ai/ORION_SPEC.md e
// docs/AUTHORIZATION_VALIDATION.md.
//
// Arquitetura (obrigatória, sem exceção):
//   Frontend -> esta função (autenticação + capability use_orion) ->
//   Financial Tools (RLS do próprio usuário) -> OpenAI.
// Nunca o browser fala com a OpenAI diretamente; a API key só existe
// aqui, como secret do projeto Supabase (`OPENAI_API_KEY`), nunca em
// variável VITE_*.
//
// Deploy: supabase functions deploy orion
// Secrets necessários (supabase secrets set ...):
//   OPENAI_API_KEY   — obrigatório, nunca comitado.
//   OPENAI_MODEL     — opcional, default 'gpt-4o-mini'.
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY já são
// injetadas automaticamente pelo runtime do Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { capabilitiesDoPapel, type Capability } from '../../../src/lib/capabilities.ts';
import type { Papel } from '../../../src/types/database.ts';
import { EXECUTORES_TOOLS, type ClienteConsulta } from './financeTools.ts';
import { montarPromptSistema } from './promptSistema.ts';
import { DEFINICOES_TOOLS } from './toolSchemas.ts';
import { OrionError, type OrionResponseBody } from './types.ts';
import { assertToolPermitida, pareceTentativaDeInjecao, validarCorpoRequisicao } from './validation.ts';
import { chamarOpenAI, type OpenAIMensagem } from './openai.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LIMITE_CHAMADAS_POR_MINUTO = 6;
const TIMEOUT_OPENAI_MS = 20_000;
const MAX_ITERACOES_TOOL_CALL = 3;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ erro: 'Método não permitido.' }, 405);

  const inicio = performance.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const modelo = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

  // Cliente com o JWT do usuário: toda query de tool passa pela RLS
  // normal — a Orion nunca vê mais do que o próprio usuário veria.
  const authHeader = req.headers.get('Authorization') ?? '';
  const dbUsuario = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  // Cliente com service role: só para gravar auditoria (nunca para
  // consultar dado financeiro/societário).
  const dbAuditoria = createClient(supabaseUrl, serviceRoleKey);

  let userId: string | null = null;
  let papel: Papel | null = null;
  let toolUsadaParaAuditoria: string | null = null;
  let competenciaAuditoria: string | null = null;

  const registrarAuditoria = async (status: 'sucesso' | 'erro' | 'bloqueado', erro?: string, tokens?: { entrada: number; saida: number } | null) => {
    try {
      await dbAuditoria.from('orion_auditoria').insert({
        user_id: userId,
        papel,
        competencia: competenciaAuditoria,
        tool: toolUsadaParaAuditoria,
        status,
        erro: erro?.slice(0, 500) ?? null,
        duracao_ms: Math.round(performance.now() - inicio),
        tokens_entrada: tokens?.entrada ?? null,
        tokens_saida: tokens?.saida ?? null,
        modelo,
      });
    } catch {
      // Falha ao auditar nunca deve derrubar a resposta ao usuário.
    }
  };

  try {
    // ---- autenticação ----
    const { data: userData, error: userError } = await dbUsuario.auth.getUser();
    if (userError || !userData?.user) {
      await registrarAuditoria('bloqueado', 'nao_autenticado');
      throw new OrionError('Não autenticado.', 401, 'nao_autenticado');
    }
    userId = userData.user.id;

    const { data: profile, error: profileError } = await dbUsuario.from('profiles').select('papel, ativo').eq('id', userId).maybeSingle();
    if (profileError || !profile || !profile.ativo) {
      await registrarAuditoria('bloqueado', 'profile_inativo_ou_ausente');
      throw new OrionError('Usuário sem acesso ativo ao sistema.', 403, 'profile_inativo');
    }
    papel = profile.papel as Papel;
    const capabilities: Capability[] = capabilitiesDoPapel(papel);

    if (!capabilities.includes('use_orion')) {
      await registrarAuditoria('bloqueado', 'sem_use_orion');
      throw new OrionError('Seu perfil não tem acesso à Orion.', 403, 'sem_use_orion');
    }

    // ---- rate limit (por usuário, janela de 1 minuto) ----
    const umMinutoAtras = new Date(Date.now() - 60_000).toISOString();
    const { count } = await dbAuditoria
      .from('orion_auditoria')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('criado_em', umMinutoAtras);
    if ((count ?? 0) >= LIMITE_CHAMADAS_POR_MINUTO) {
      await registrarAuditoria('bloqueado', 'rate_limit');
      throw new OrionError('Muitas perguntas em pouco tempo. Aguarde um momento e tente de novo.', 429, 'rate_limit');
    }

    // ---- validação do payload ----
    const corpo = validarCorpoRequisicao(await req.json().catch(() => null));
    competenciaAuditoria = corpo.competencia;
    const tentativaInjecao = pareceTentativaDeInjecao(corpo.mensagem);

    if (!openaiKey) {
      await registrarAuditoria('erro', 'openai_api_key_ausente');
      throw new OrionError('Orion está temporariamente indisponível (configuração do provedor de IA pendente).', 503, 'sem_api_key');
    }

    // ---- monta a conversa e roda o loop de tool-calling ----
    const mensagens: OpenAIMensagem[] = [
      { role: 'system', content: montarPromptSistema({ papel, competencia: corpo.competencia }) },
      ...corpo.historico.map((m) => ({ role: m.role, content: m.content }) as OpenAIMensagem),
      { role: 'user', content: corpo.mensagem },
    ];

    const toolsUsadas: string[] = [];
    let tokensTotais = { entrada: 0, saida: 0 };
    let respostaFinal: string | null = null;

    for (let iteracao = 0; iteracao < MAX_ITERACOES_TOOL_CALL; iteracao++) {
      const resultado = await chamarOpenAI({ apiKey: openaiKey, modelo, mensagens, tools: DEFINICOES_TOOLS, timeoutMs: TIMEOUT_OPENAI_MS });
      if (resultado.uso) {
        tokensTotais = { entrada: tokensTotais.entrada + resultado.uso.tokensEntrada, saida: tokensTotais.saida + resultado.uso.tokensSaida };
      }
      const escolha = resultado.escolha;
      if (!escolha) throw new OrionError('O provedor de IA não retornou resposta.', 502, 'resposta_vazia_openai');

      const chamadasTool = escolha.mensagem.tool_calls ?? [];
      if (chamadasTool.length === 0) {
        respostaFinal = escolha.mensagem.content;
        break;
      }

      mensagens.push({ role: 'assistant', content: escolha.mensagem.content ?? '', tool_calls: chamadasTool });

      for (const chamada of chamadasTool) {
        let conteudoResultado: string;
        const nomeTool = chamada.function.name;
        try {
          assertToolPermitida(nomeTool);
          const args = JSON.parse(chamada.function.arguments || '{}');
          const executor = EXECUTORES_TOOLS[nomeTool];
          const resultadoTool = await executor(dbUsuario as unknown as ClienteConsulta, capabilities, args);
          toolsUsadas.push(nomeTool);
          toolUsadaParaAuditoria = toolUsadaParaAuditoria ? `${toolUsadaParaAuditoria},${nomeTool}` : nomeTool;
          conteudoResultado = JSON.stringify(resultadoTool);
        } catch (e) {
          const msg = e instanceof OrionError ? e.message : 'Falha ao executar a ferramenta solicitada.';
          conteudoResultado = JSON.stringify({ erro: msg, dadosSuficientes: false });
        }
        mensagens.push({ role: 'tool', tool_call_id: chamada.id, content: conteudoResultado });
      }
    }

    if (respostaFinal === null) {
      respostaFinal = 'Não consegui concluir essa análise agora — tente reformular a pergunta ou pergunte sobre um único indicador por vez.';
    }

    await registrarAuditoria('sucesso', tentativaInjecao ? 'possivel_prompt_injection_detectada_na_mensagem_do_usuario' : undefined, tokensTotais);

    const body: OrionResponseBody = { resposta: respostaFinal, toolsUsadas };
    return jsonResponse(body, 200);
  } catch (e) {
    const erro = e instanceof OrionError ? e : new OrionError('Erro inesperado na Orion.', 500, 'erro_inesperado');
    if (erro.codigo !== 'nao_autenticado' && erro.codigo !== 'sem_use_orion' && erro.codigo !== 'profile_inativo' && erro.codigo !== 'rate_limit') {
      await registrarAuditoria('erro', erro.codigo);
    }
    return jsonResponse({ erro: erro.message, codigo: erro.codigo }, erro.status);
  }
});
