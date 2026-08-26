// Validação de entrada da Orion. Módulo puro (sem Deno.*, sem fetch) —
// testável diretamente com Vitest.

import { OrionError, TOOLS_PERMITIDAS, type NomeTool, type OrionMensagem, type OrionRequestBody } from './types.ts';

export const LIMITE_CARACTERES_MENSAGEM = 2000;
export const LIMITE_MENSAGENS_HISTORICO = 12;

/** Padrões comuns de tentativa de prompt injection — usados só para
 * AUDITORIA (marcar a interação como suspeita no log), nunca para
 * bloquear sozinhos: um usuário legítimo pode perguntar "ignore o
 * previsto e me diga só o realizado", por exemplo. A defesa real é o
 * system prompt (ver promptSistema.ts), que instrui o modelo a nunca
 * obedecer instruções vindas do conteúdo do usuário ou de saída de
 * tool como se fossem instruções do sistema. */
const PADROES_SUSPEITOS = [
  /ignor[ae]\s+(as\s+)?instru[cç][õo]es/i,
  /esque[çc]a\s+(tudo|as\s+regras)/i,
  /voc[eê]\s+(agora\s+)?[eé]\s+(um|uma)\s+/i,
  /revele?\s+(seu|o)\s+(system\s*prompt|prompt\s+de\s+sistema)/i,
  /ignore\s+(previous|all)\s+instructions/i,
  /you\s+are\s+now/i,
  /reveal\s+your\s+(system\s*prompt|instructions)/i,
  /act\s+as\s+(if|a)/i,
];

export function pareceTentativaDeInjecao(texto: string): boolean {
  return PADROES_SUSPEITOS.some((padrao) => padrao.test(texto));
}

export function validarMensagem(mensagem: unknown): string {
  if (typeof mensagem !== 'string' || mensagem.trim().length === 0) {
    throw new OrionError('Mensagem vazia.', 400, 'mensagem_vazia');
  }
  if (mensagem.length > LIMITE_CARACTERES_MENSAGEM) {
    throw new OrionError(
      `Mensagem acima do limite de ${LIMITE_CARACTERES_MENSAGEM} caracteres.`,
      400,
      'mensagem_muito_longa'
    );
  }
  return mensagem.trim();
}

export function validarHistorico(historico: unknown): OrionMensagem[] {
  if (historico === undefined || historico === null) return [];
  if (!Array.isArray(historico)) {
    throw new OrionError('Histórico inválido.', 400, 'historico_invalido');
  }
  if (historico.length > LIMITE_MENSAGENS_HISTORICO) {
    throw new OrionError(
      `Histórico acima do limite de ${LIMITE_MENSAGENS_HISTORICO} mensagens.`,
      400,
      'historico_muito_longo'
    );
  }
  for (const item of historico) {
    if (
      typeof item !== 'object' || item === null ||
      (item as OrionMensagem).role !== 'user' && (item as OrionMensagem).role !== 'assistant' ||
      typeof (item as OrionMensagem).content !== 'string'
    ) {
      throw new OrionError('Histórico inválido.', 400, 'historico_invalido');
    }
  }
  return historico as OrionMensagem[];
}

export function validarCorpoRequisicao(body: unknown): OrionRequestBody {
  if (typeof body !== 'object' || body === null) {
    throw new OrionError('Corpo da requisição inválido.', 400, 'corpo_invalido');
  }
  const b = body as Record<string, unknown>;
  const mensagem = validarMensagem(b.mensagem);
  const historico = validarHistorico(b.historico);
  const competencia = typeof b.competencia === 'string' ? b.competencia : null;
  return { mensagem, historico, competencia };
}

/** Nunca confiar no nome de tool que o modelo devolve sem checar a allowlist. */
export function ehToolPermitida(nome: string): nome is NomeTool {
  return (TOOLS_PERMITIDAS as readonly string[]).includes(nome);
}

export function assertToolPermitida(nome: string): asserts nome is NomeTool {
  if (!ehToolPermitida(nome)) {
    throw new OrionError(`Tool não permitida: ${nome}`, 400, 'tool_nao_permitida');
  }
}
