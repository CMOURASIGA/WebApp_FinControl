// Cliente da Orion no frontend. Chama exclusivamente a Edge Function
// (supabase/functions/orion) — nunca a OpenAI diretamente, e nenhuma
// chave de IA nunca existe neste bundle.
//
// O histórico da conversa é mantido só no cliente (estado do React,
// ver useOrionChat) e reenviado a cada chamada como contexto curto —
// não é persistido no banco (ver supabase/migrations/0014_orion_auditoria.sql).

import { supabase } from '../lib/supabaseClient';

export interface OrionMensagem {
  role: 'user' | 'assistant';
  content: string;
}

export interface OrionRespostaErro {
  erro: string;
  codigo?: string;
}

export const orionService = {
  async perguntar(params: { mensagem: string; historico: OrionMensagem[]; competencia?: string | null }): Promise<{ resposta: string; toolsUsadas: string[] }> {
    const { data, error } = await supabase.functions.invoke('orion', {
      body: { mensagem: params.mensagem, historico: params.historico, competencia: params.competencia ?? null },
    });
    if (error) {
      // supabase-js embrulha erro HTTP não-2xx em FunctionsHttpError; o
      // corpo JSON com { erro, codigo } vem em error.context, quando
      // disponível — senão caímos numa mensagem genérica.
      const contexto = (error as { context?: { erro?: string } }).context;
      throw new Error(contexto?.erro || error.message || 'Falha ao falar com a Orion.');
    }
    return data as { resposta: string; toolsUsadas: string[] };
  },
};
