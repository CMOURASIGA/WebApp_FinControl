// Consolida receitas + custos + despesas de um período em uma DRE
// gerencial: por projeto e da empresa como um todo. É a mesma rotina
// usada pelo Dashboard (período = mês corrente) e pelo Fechamento
// Mensal (período = mês fechado).

import { supabase } from '../lib/supabaseClient';
import { calcularResultadoProjeto, consolidarResultados, type ResultadoProjeto } from '../lib/motorCalculo';
import type { CustoProjeto, Despesa, Projeto, Receita } from '../types/database';

export interface DREPeriodo {
  periodoInicio: string;
  periodoFim: string;
  porProjeto: { projeto: Projeto; resultado: ResultadoProjeto }[];
  consolidadoProjetos: ResultadoProjeto;
  despesasCorporativas: number;
  valorEmpresaLiquido: number; // valorEmpresa dos projetos - despesas corporativas
}

export const relatoriosService = {
  async montarDRE(periodoInicio: string, periodoFim: string, somenteRealizado = false): Promise<DREPeriodo> {
    let receitasQuery = supabase.from('receitas').select('*').gte('data_fato_gerador', periodoInicio).lte('data_fato_gerador', periodoFim);
    if (somenteRealizado) receitasQuery = receitasQuery.eq('status', 'recebido');
    const [{ data: projetos, error: e1 }, { data: receitas, error: e2 }, { data: custos, error: e3 }, { data: despesas, error: e4 }] =
      await Promise.all([
        supabase.from('projetos').select('*'),
        receitasQuery,
        supabase.from('custos_projeto').select('*').gte('data', periodoInicio).lte('data', periodoFim),
        supabase.from('despesas').select('*').gte('competencia', periodoInicio).lte('competencia', periodoFim),
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

export function montarDREDeDados(
  periodoInicio: string,
  periodoFim: string,
  projetos: Projeto[],
  receitas: Receita[],
  custos: CustoProjeto[],
  despesas: Despesa[]
): DREPeriodo {
  const despesasValidas = despesas.filter((d) => d.status !== 'cancelado');
  const custosValidos = custos.filter((c) => c.status !== 'cancelado');
  const despesasCorporativas = despesasValidas.filter((d) => d.projeto_id === null);
  const despesasPorProjeto = despesasValidas.filter((d) => d.projeto_id !== null);

  const porProjeto: { projeto: Projeto; resultado: ResultadoProjeto }[] = [];

  for (const projeto of projetos) {
    const receitasDoProjeto = receitas.filter((r) => r.projeto_id === projeto.id);
    const custosDoProjeto = custosValidos.filter((c) => c.projeto_id === projeto.id);
    const despesasDoProjeto = despesasPorProjeto.filter((d) => d.projeto_id === projeto.id);

    if (receitasDoProjeto.length === 0 && custosDoProjeto.length === 0 && despesasDoProjeto.length === 0) continue;

    const resultado = calcularResultadoProjeto(receitasDoProjeto, custosDoProjeto, despesasDoProjeto);
    porProjeto.push({ projeto, resultado });
  }

  const consolidadoProjetos = consolidarResultados(porProjeto.map((p) => p.resultado));
  const totalDespesasCorporativas = round2(despesasCorporativas.reduce((acc, d) => acc + d.valor, 0));
  const valorEmpresaLiquido = round2(consolidadoProjetos.valorEmpresa - totalDespesasCorporativas);

  return {
    periodoInicio,
    periodoFim,
    porProjeto,
    consolidadoProjetos,
    despesasCorporativas: totalDespesasCorporativas,
    valorEmpresaLiquido,
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
