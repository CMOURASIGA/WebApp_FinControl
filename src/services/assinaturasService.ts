import { supabase } from '../lib/supabaseClient';
import type { Assinatura } from '../types/database';
import { assertNoError } from './base';

export const assinaturasService = {
  async listar(): Promise<Assinatura[]> {
    const { data, error } = await supabase.from('assinaturas').select('*').order('data_inicio', { ascending: false });
    return assertNoError(data, error, 'listar assinaturas') as Assinatura[];
  },

  async criar(input: {
    clienteId: string;
    projetoId?: string | null;
    nome: string;
    valorMensal: number;
    diaCobranca?: number;
    dataInicio: string;
    createdBy: string;
  }): Promise<Assinatura> {
    const { data, error } = await supabase
      .from('assinaturas')
      .insert({
        cliente_id: input.clienteId,
        projeto_id: input.projetoId ?? null,
        nome: input.nome,
        valor_mensal: input.valorMensal,
        dia_cobranca: input.diaCobranca ?? null,
        data_inicio: input.dataInicio,
        status: 'ativa',
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    return assertNoError(data, error, 'criar assinatura') as Assinatura;
  },

  async atualizarStatus(id: string, status: Assinatura['status'], dataFim?: string): Promise<void> {
    const { error } = await supabase
      .from('assinaturas')
      .update({ status, data_fim: dataFim ?? null })
      .eq('id', id);
    if (error) throw new Error(`atualizar status da assinatura: ${error.message}`);
  },
};
