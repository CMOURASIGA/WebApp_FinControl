// Cliente mínimo para a Chat Completions API da OpenAI, via fetch puro
// (sem SDK) — evita depender de compatibilidade do SDK oficial com
// Deno e mantém a superfície pequena o bastante para auditar.
//
// `montarPayload` e `extrairResultado` são funções puras, testáveis
// sem rede. `chamarOpenAI` é a única parte que efetivamente faz uma
// requisição HTTP — recebe `fetchImpl` por injeção de dependência para
// poder ser substituída em teste.

import { OrionError } from './types.ts';

export interface OpenAIMensagem {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface OpenAIChatResponse {
  escolha: { mensagem: OpenAIMensagem; motivoParada: string } | null;
  uso: { tokensEntrada: number; tokensSaida: number } | null;
}

export function montarPayload(params: {
  modelo: string;
  mensagens: OpenAIMensagem[];
  tools: readonly unknown[];
}): Record<string, unknown> {
  return {
    model: params.modelo,
    messages: params.mensagens,
    tools: params.tools,
    tool_choice: 'auto',
    temperature: 0.2,
    max_tokens: 900,
  };
}

export function extrairResultado(respostaBruta: unknown): OpenAIChatResponse {
  const r = respostaBruta as {
    choices?: { message: OpenAIMensagem; finish_reason: string }[];
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  const primeira = r.choices?.[0];
  return {
    escolha: primeira ? { mensagem: primeira.message, motivoParada: primeira.finish_reason } : null,
    uso: r.usage ? { tokensEntrada: r.usage.prompt_tokens, tokensSaida: r.usage.completion_tokens } : null,
  };
}

export async function chamarOpenAI(params: {
  apiKey: string;
  modelo: string;
  mensagens: OpenAIMensagem[];
  tools: readonly unknown[];
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<OpenAIChatResponse> {
  const fetchFn = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const resposta = await fetchFn('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify(montarPayload({ modelo: params.modelo, mensagens: params.mensagens, tools: params.tools })),
      signal: controller.signal,
    });
    if (!resposta.ok) {
      // Não logamos o corpo da resposta de erro: pode ecoar parte do
      // prompt/payload enviado. O código de status já é suficiente para
      // diagnosticar (401 = chave inválida, 429 = rate limit da OpenAI, etc.).
      throw new OrionError(`Falha ao consultar o provedor de IA (status ${resposta.status}).`, 502, `erro_openai_${resposta.status}`);
    }
    const json = await resposta.json();
    return extrairResultado(json);
  } catch (e) {
    if (e instanceof OrionError) throw e;
    if ((e as Error).name === 'AbortError') {
      throw new OrionError('O provedor de IA demorou demais para responder.', 504, 'timeout_openai');
    }
    throw new OrionError('Falha ao consultar o provedor de IA.', 502, 'erro_openai');
  } finally {
    clearTimeout(timer);
  }
}
