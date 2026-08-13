import { supabase } from '../lib/supabaseClient';
import type { Investimento, InvestimentoHistorico } from '../types/database';
import { assertNoError } from './base';

export const investimentosService = {
  async listarHistorico(investimentoId: string): Promise<InvestimentoHistorico[]> {
    const { data, error } = await supabase.from('investimento_historico').select('*').eq('investimento_id', investimentoId).order('executado_em', { ascending: false });
    return assertNoError(data, error, 'listar histórico do investimento') as InvestimentoHistorico[];
  },
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
    retornoEsperado?: number | null;
    prazoEsperadoMeses?: number | null;
    roiMetaPercentual?: number | null;
    consideradoNoResultado: boolean;
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
        retorno_esperado: input.retornoEsperado ?? null,
        prazo_esperado_meses: input.prazoEsperadoMeses ?? null,
        roi_meta_percentual: input.roiMetaPercentual ?? null,
        considerado_no_resultado: input.consideradoNoResultado,
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    return assertNoError(data, error, 'criar investimento') as Investimento;
  },
  async editar(id: string, input: {
    investidorTipo: Investimento['investidor_tipo']; socioId?: string | null; projetoId?: string | null;
    valor: number; data: string; tipo: string; descricao?: string; retornoEsperado?: number | null;
    prazoEsperadoMeses?: number | null; roiMetaPercentual?: number | null; consideradoNoResultado: boolean; motivo: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('editar_investimento', {
      p_id: id, p_investidor_tipo: input.investidorTipo, p_socio_id: input.socioId ?? null,
      p_projeto_id: input.projetoId ?? null, p_valor: input.valor, p_data: input.data, p_tipo: input.tipo,
      p_descricao: input.descricao ?? '', p_retorno_esperado: input.retornoEsperado ?? null,
      p_prazo_esperado_meses: input.prazoEsperadoMeses ?? null, p_roi_meta_percentual: input.roiMetaPercentual ?? null,
      p_considerado_no_resultado: input.consideradoNoResultado, p_motivo: input.motivo,
    });
    if (error) throw new Error(`editar investimento: ${error.message}`);
  },
  async alterarStatus(id: string, acao: 'cancelar' | 'reativar', motivo: string): Promise<void> {
    const { error } = await supabase.rpc('alterar_status_investimento', { p_id: id, p_acao: acao, p_motivo: motivo });
    if (error) throw new Error(`${acao} investimento: ${error.message}`);
  },
};
