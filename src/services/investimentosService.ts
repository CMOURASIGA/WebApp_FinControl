import { supabase } from '../lib/supabaseClient';
import type { Investimento } from '../types/database';
import { assertNoError } from './base';

export const investimentosService = {
  async listar(): Promise<Investimento[]> {
    const { data, error } = await supabase.from('investimentos').select('*').order('data', { ascending: false });
    return assertNoError(data, error, 'listar investimentos') as Investimento[];
  },

  async listarPorProjeto(projetoId: string): Promise<Investimento[]> {
    const { data, error } = await supabase
      .from('investimentos')
      .select('*')
      .eq('projeto_id', projetoId)
      .order('data', { ascending: false });
    return assertNoError(data, error, 'listar investimentos do projeto') as Investimento[];
  },

  async criar(input: {
    investidorTipo: Investimento['investidor_tipo'];
    socioId?: string | null;
    projetoId?: string | null;
    valor: number;
    data: string;
    tipo: string;
    descricao?: string;
    createdBy: string;
  }): Promise<Investimento> {
    const { data, error } = await supabase
      .from('investimentos')
      .insert({
        investidor_tipo: input.investidorTipo,
        socio_id: input.investidorTipo === 'socio' ? input.socioId ?? null : null,
        projeto_id: input.projetoId ?? null,
        valor: input.valor,
        data: input.data,
        tipo: input.tipo,
        descricao: input.descricao ?? null,
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    return assertNoError(data, error, 'criar investimento') as Investimento;
  },
};
