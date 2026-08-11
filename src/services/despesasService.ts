import { supabase } from '../lib/supabaseClient';
import type { CustoProjeto, Despesa } from '../types/database';
import { assertNoError } from './base';

export const custosProjetoService = {
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
};

export const despesasService = {
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
    const { error } = await supabase
      .from('despesas')
      .update({ status: 'pago', data_pagamento: dataPagamento })
      .eq('id', id);
    if (error) throw new Error(`marcar despesa como paga: ${error.message}`);
  },
};
