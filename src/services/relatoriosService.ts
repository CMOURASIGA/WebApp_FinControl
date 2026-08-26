// Consolida receitas + custos + despesas de um período em uma DRE
// gerencial: por projeto e da empresa como um todo. É a mesma rotina
// usada pelo Dashboard (período = mês corrente) e pelo Fechamento
// Mensal (período = mês fechado).
//
// O cálculo em si (montarDREDeDados) mora em lib/motorCalculo.ts —
// função pura, sem dependência de Supabase — para poder ser reaproveitada
// também pela Edge Function da Orion (supabase/functions/orion) sem
// duplicar a regra. Este arquivo só busca os dados.

import { supabase } from '../lib/supabaseClient';
import { montarDREDeDados, type DREPeriodo } from '../lib/motorCalculo';
import type { CustoProjeto, Despesa, Projeto, Receita } from '../types/database';

export type { DREPeriodo };

export const relatoriosService = {
  async montarDRE(periodoInicio: string, periodoFim: string, somenteRealizado = false): Promise<DREPeriodo> {
    let receitasQuery = supabase.from('receitas').select('*').gte('data_fato_gerador', periodoInicio).lte('data_fato_gerador', periodoFim);
    let custosQuery = supabase.from('custos_projeto').select('*').gte('data', periodoInicio).lte('data', periodoFim);
    let despesasQuery = supabase.from('despesas').select('*').gte('competencia', periodoInicio).lte('competencia', periodoFim);
    if (somenteRealizado) {
      receitasQuery = receitasQuery.eq('status', 'recebido');
      custosQuery = custosQuery.eq('status', 'pago');
      despesasQuery = despesasQuery.eq('status', 'pago');
    }
    const [{ data: projetos, error: e1 }, { data: receitas, error: e2 }, { data: custos, error: e3 }, { data: despesas, error: e4 }] =
      await Promise.all([
        supabase.from('projetos').select('*'),
        receitasQuery,
        custosQuery,
        despesasQuery,
      ]);
    if (e1) throw new Error(`carregar projetos: ${e1.message}`);
    if (e2) throw new Error(`carregar receitas: ${e2.message}`);
    if (e3) throw new Error(`carregar custos: ${e3.message}`);
    if (e4) throw new Error(`carregar despesas: ${e4.message}`);

    return montarDREDeDados(
      periodoInicio,
      periodoFim,
      (projetos ?? []) as Projeto[],
      (receitas ?? []) as Receita[],
      (custos ?? []) as CustoProjeto[],
      (despesas ?? []) as Despesa[]
    );
  },
};
