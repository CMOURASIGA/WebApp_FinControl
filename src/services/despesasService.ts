import { supabase } from '../lib/supabaseClient';
import type { CustoProjeto, Despesa, FinanceiroHistorico } from '../types/database';
import { assertNoError } from './base';

export const custosProjetoService = {
  async listarHistorico(id: string): Promise<FinanceiroHistorico[]> { const { data, error } = await supabase.from('financeiro_historico').select('*').eq('entidade','custo_projeto').eq('registro_id',id).order('executado_em',{ascending:false}); return assertNoError(data,error,'listar histórico do custo') as FinanceiroHistorico[]; },
  async listarPorProjeto(projetoId: string): Promise<CustoProjeto[]> {
    const { data, error } = await supabase
      .from('custos_projeto')
      .select('*')
      .eq('projeto_id', projetoId)
      .order('data', { ascending: false });
    return assertNoError(data, error, 'listar custos do projeto') as CustoProjeto[];
  },

  async listarPorPeriodo(inicio: string, fim: string): Promise<CustoProjeto[]> {
    const { data, error } = await supabase.from('custos_projeto').select('*').gte('data', inicio).lte('data', fim);
    return assertNoError(data, error, 'listar custos do período') as CustoProjeto[];
  },

  async criar(input: {
    projetoId: string;
    descricao: string;
    categoria: string;
    valor: number;
    data: string;
    observacao?: string;
    createdBy: string;
  }): Promise<CustoProjeto> {
    const { data, error } = await supabase
      .from('custos_projeto')
      .insert({
        projeto_id: input.projetoId,
        descricao: input.descricao,
        categoria: input.categoria,
        valor: input.valor,
        data: input.data,
        observacao: input.observacao ?? null,
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    return assertNoError(data, error, 'criar custo de projeto') as CustoProjeto;
  },
  async editar(custo: CustoProjeto, input: { descricao: string; categoria: string; valor: number; data: string; motivo: string }): Promise<void> { const { error } = await supabase.rpc('editar_custo_projeto',{p_id:custo.id,p_descricao:input.descricao,p_categoria:input.categoria,p_valor:input.valor,p_data:input.data,p_motivo:input.motivo}); if(error) throw new Error(`editar custo: ${error.message}`); },
  async alterarStatus(id: string, acao: 'pagar'|'estornar'|'cancelar'|'reativar', motivo: string): Promise<void> { const { error } = await supabase.rpc('alterar_status_custo',{p_id:id,p_acao:acao,p_data:new Date().toISOString().slice(0,10),p_motivo:motivo}); if(error) throw new Error(`alterar custo: ${error.message}`); },
};

export const despesasService = {
  async listarHistorico(id: string): Promise<FinanceiroHistorico[]> { const { data, error } = await supabase.from('financeiro_historico').select('*').eq('entidade','despesa').eq('registro_id',id).order('executado_em',{ascending:false}); return assertNoError(data,error,'listar histórico da despesa') as FinanceiroHistorico[]; },
  async listar(): Promise<Despesa[]> {
    const { data, error } = await supabase.from('despesas').select('*').order('data_vencimento', { ascending: false });
    return assertNoError(data, error, 'listar despesas') as Despesa[];
  },

  async listarPorPeriodo(inicio: string, fim: string): Promise<Despesa[]> {
    const { data, error } = await supabase
      .from('despesas')
      .select('*')
      .gte('competencia', inicio)
      .lte('competencia', fim);
    return assertNoError(data, error, 'listar despesas do período') as Despesa[];
  },

  async criar(input: {
    categoria: string;
    tipo: Despesa['tipo'];
    descricao: string;
    valor: number;
    projetoId?: string | null;
    competencia: string;
    dataVencimento: string;
    observacao?: string;
    createdBy: string;
  }): Promise<Despesa> {
    const { data, error } = await supabase
      .from('despesas')
      .insert({
        categoria: input.categoria,
        tipo: input.tipo,
        descricao: input.descricao,
        valor: input.valor,
        projeto_id: input.projetoId ?? null,
        competencia: input.competencia,
        data_vencimento: input.dataVencimento,
        status: 'provisionado',
        observacao: input.observacao ?? null,
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    return assertNoError(data, error, 'criar despesa') as Despesa;
  },

  async marcarPaga(id: string, dataPagamento: string): Promise<void> {
    const { error } = await supabase.rpc('alterar_status_despesa',{p_id:id,p_acao:'pagar',p_data:dataPagamento,p_motivo:null});
    if (error) throw new Error(`marcar despesa como paga: ${error.message}`);
  },
  async editar(despesa: Despesa, input: { categoria:string; tipo:Despesa['tipo']; descricao:string; valor:number; projetoId:string|null; competencia:string; dataVencimento:string; motivo:string }): Promise<void> { const { error } = await supabase.rpc('editar_despesa',{p_id:despesa.id,p_categoria:input.categoria,p_tipo:input.tipo,p_descricao:input.descricao,p_valor:input.valor,p_projeto_id:input.projetoId,p_competencia:input.competencia,p_data_vencimento:input.dataVencimento,p_motivo:input.motivo}); if(error) throw new Error(`editar despesa: ${error.message}`); },
  async alterarStatus(id:string,acao:'pagar'|'estornar'|'cancelar'|'reativar',motivo:string):Promise<void>{ const {error}=await supabase.rpc('alterar_status_despesa',{p_id:id,p_acao:acao,p_data:new Date().toISOString().slice(0,10),p_motivo:motivo}); if(error) throw new Error(`alterar despesa: ${error.message}`); },
};
