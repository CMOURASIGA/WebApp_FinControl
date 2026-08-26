import { describe, expect, it, vi } from 'vitest';
import { chamarOpenAI, extrairResultado, montarPayload } from './openai.ts';

describe('montarPayload', () => {
  it('monta o payload com tool_choice auto e sem streaming', () => {
    const payload = montarPayload({ modelo: 'gpt-4o-mini', mensagens: [{ role: 'user', content: 'oi' }], tools: [] });
    expect(payload.model).toBe('gpt-4o-mini');
    expect(payload.tool_choice).toBe('auto');
    expect(payload.stream).toBeUndefined();
  });
});

describe('extrairResultado', () => {
  it('extrai mensagem, motivo de parada e uso de tokens', () => {
    const bruto = {
      choices: [{ message: { role: 'assistant', content: 'oi' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    };
    const r = extrairResultado(bruto);
    expect(r.escolha?.mensagem.content).toBe('oi');
    expect(r.escolha?.motivoParada).toBe('stop');
    expect(r.uso).toEqual({ tokensEntrada: 10, tokensSaida: 5 });
  });

  it('lida com resposta sem choices', () => {
    const r = extrairResultado({});
    expect(r.escolha).toBeNull();
    expect(r.uso).toBeNull();
  });
});

describe('chamarOpenAI', () => {
  it('lança OrionError quando a API retorna status de erro (sem vazar o corpo da resposta)', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'segredo interno' });
    await expect(
      chamarOpenAI({ apiKey: 'sk-fake', modelo: 'gpt-4o-mini', mensagens: [], tools: [], timeoutMs: 1000, fetchImpl: fetchFalso as unknown as typeof fetch })
    ).rejects.toMatchObject({ status: 502, codigo: 'erro_openai_401' });
  });

  it('lança OrionError de timeout quando a chamada aborta', async () => {
    const fetchFalso = vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      })
    );
    await expect(
      chamarOpenAI({ apiKey: 'sk-fake', modelo: 'gpt-4o-mini', mensagens: [], tools: [], timeoutMs: 5, fetchImpl: fetchFalso as unknown as typeof fetch })
    ).rejects.toMatchObject({ codigo: 'timeout_openai' });
  });

  it('retorna o resultado extraído quando a chamada é bem-sucedida', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { role: 'assistant', content: 'tudo bem' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
    });
    const resultado = await chamarOpenAI({ apiKey: 'sk-fake', modelo: 'gpt-4o-mini', mensagens: [], tools: [], timeoutMs: 1000, fetchImpl: fetchFalso as unknown as typeof fetch });
    expect(resultado.escolha?.mensagem.content).toBe('tudo bem');
  });
});
