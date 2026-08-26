// Ferramentas financeiras da Orion (Fase 4B).
//
// Regra de ouro deste arquivo: NUNCA recalcular o que o motor
// financeiro (../../../src/lib/motorCalculo.ts) já calcula. Cada tool
// só busca as linhas do período/projeto necessário e entrega para as
// funções do motor — exatamente o mesmo padrão que relatoriosService,
// despesasService etc. usam no frontend.
//
// Cada tool recebe:
//   - `db`: cliente Supabase criado com o JWT do próprio usuário
//     autenticado (não service role) — toda query aqui passa pela
//     RLS normal do banco, então a Orion nunca vê mais do que o
//     usuário veria navegando pelo 7Finance.
//   - `capabilities`: lista de capabilities do profile autenticado
//     (mesma fonte de ../../../src/lib/capabilities.ts) — checada
//     ANTES de qualquer query, para devolver uma mensagem clara em vez
//     de uma lista vazia por causa de RLS.
//
// Nenhuma tool aceita SQL livre, nome de tabela ou coluna como
// parâmetro — só argumentos tipados e específicos do domínio.

import {
  calcularARR,
  calcularBreakEven,
  calcularMRR,
  calcularPaybackMeses,
  calcularResultadoProjeto,
  calcularROI,
  montarDREDeDados,
  resolveRegraDistribuicaoVigente,
  resolveVigente,
  simularCenario,
  type ResultadoProjeto,
} from '../../../src/lib/motorCalculo.ts';
import type {
  CustoProjeto,
  Despesa,
  Investimento,
  ParametroTributario,
  Projeto,
  Receita,
  RegraDistribuicao,
  Assinatura,
} from '../../../src/types/database.ts';
import type { Capability } from '../../../src/lib/capabilities.ts';
import { OrionError } from './types.ts';

// Duck-typing mínimo do cliente supabase-js — evita importar o pacote
// inteiro só para tipar, e mantém este arquivo testável com um stub
// simples no Vitest (ver financeTools.test.ts).
export interface ClienteConsulta {
  from(tabela: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function assertCapability(capabilities: Capability[], necessaria: Capability, tool: string): void {
  if (!capabilities.includes(necessaria)) {
    throw new OrionError(
      `Sem permissão para usar ${tool} (requer a capability '${necessaria}').`,
      403,
      'sem_permissao'
    );
  }
}

function primeiroDiaMes(competencia: string): string {
  return `${competencia.slice(0, 7)}-01`;
}
function ultimoDiaMes(competencia: string): string {
  const [ano, mes] = competencia.slice(0, 7).split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${competencia.slice(0, 7)}-${String(ultimo).padStart(2, '0')}`;
}

async function buscarDRE(db: ClienteConsulta, inicio: string, fim: string, somenteRealizado: boolean) {
  let receitasQuery = db.from('receitas').select('*').gte('data_fato_gerador', inicio).lte('data_fato_gerador', fim);
  let custosQuery = db.from('custos_projeto').select('*').gte('data', inicio).lte('data', fim);
  let despesasQuery = db.from('despesas').select('*').gte('competencia', inicio).lte('competencia', fim);
  if (somenteRealizado) {
    receitasQuery = receitasQuery.eq('status', 'recebido');
    custosQuery = custosQuery.eq('status', 'pago');
    despesasQuery = despesasQuery.eq('status', 'pago');
  }
  const [{ data: projetos, error: e1 }, { data: receitas, error: e2 }, { data: custos, error: e3 }, { data: despesas, error: e4 }] =
    await Promise.all([db.from('projetos').select('*'), receitasQuery, custosQuery, despesasQuery]);
  if (e1 || e2 || e3 || e4) {
    throw new OrionError('Falha ao consultar dados financeiros.', 500, 'erro_consulta');
  }
  return montarDREDeDados(inicio, fim, (projetos ?? []) as Projeto[], (receitas ?? []) as Receita[], (custos ?? []) as CustoProjeto[], (despesas ?? []) as Despesa[]);
}

// ---------------------------------------------------------------------
// get_dashboard_summary
// ---------------------------------------------------------------------
export async function getDashboardSummary(db: ClienteConsulta, capabilities: Capability[], args: { competencia: string }) {
  assertCapability(capabilities, 'view_dashboard', 'get_dashboard_summary');
  const inicio = primeiroDiaMes(args.competencia);
  const fim = ultimoDiaMes(args.competencia);
  const dreRealizado = await buscarDRE(db, inicio, fim, true);

  const { data: assinaturas } = await db.from('assinaturas').select('*');
  const mrr = calcularMRR((assinaturas ?? []) as Assinatura[], fim);
  const arr = calcularARR(mrr);

  const resultadoLiquido = round2(dreRealizado.consolidadoProjetos.resultadoLiquido - dreRealizado.despesasCorporativas);
  const margem = dreRealizado.consolidadoProjetos.receitaBruta > 0
    ? round2((resultadoLiquido / dreRealizado.consolidadoProjetos.receitaBruta) * 100)
    : 0;

  return {
    competencia: args.competencia,
    faturamentoRealizado: dreRealizado.consolidadoProjetos.receitaBruta,
    receitaLiquidaRealizada: round2(dreRealizado.consolidadoProjetos.receitaBruta - dreRealizado.consolidadoProjetos.tributoProvisionado),
    resultadoLiquidoRealizado: resultadoLiquido,
    margemRealizadaPercentual: margem,
    custosEDespesasRealizados: round2(dreRealizado.consolidadoProjetos.custosDiretos + dreRealizado.consolidadoProjetos.despesasAtribuidas + dreRealizado.despesasCorporativas),
    mrr,
    arr,
    dadosSuficientes: true,
  };
}

// ---------------------------------------------------------------------
// get_dre
// ---------------------------------------------------------------------
export async function getDre(db: ClienteConsulta, capabilities: Capability[], args: { competencia: string; modo: 'previsto' | 'realizado' | 'ambos' }) {
  if (!capabilities.includes('view_dashboard') && !capabilities.includes('view_closing')) {
    throw new OrionError("Sem permissão para usar get_dre (requer 'view_dashboard' ou 'view_closing').", 403, 'sem_permissao');
  }
  const inicio = primeiroDiaMes(args.competencia);
  const fim = ultimoDiaMes(args.competencia);
  const modo = args.modo ?? 'ambos';
  const resultado: Record<string, unknown> = { competencia: args.competencia };
  if (modo === 'previsto' || modo === 'ambos') resultado.previsto = await buscarDRE(db, inicio, fim, false);
  if (modo === 'realizado' || modo === 'ambos') resultado.realizado = await buscarDRE(db, inicio, fim, true);
  return resultado;
}

// ---------------------------------------------------------------------
// get_project_financials
// ---------------------------------------------------------------------
export async function getProjectFinancials(db: ClienteConsulta, capabilities: Capability[], args: { projetoId: string }) {
  assertCapability(capabilities, 'view_projects', 'get_project_financials');
  const { data: projeto, error: eProj } = await db.from('projetos').select('*').eq('id', args.projetoId).maybeSingle();
  if (eProj) throw new OrionError('Falha ao consultar o projeto.', 500, 'erro_consulta');
  if (!projeto) return { dadosSuficientes: false, motivo: 'Projeto não encontrado ou sem permissão de acesso.' };

  const [{ data: receitas }, { data: custos }, { data: despesasTodas }, { data: regras }] = await Promise.all([
    db.from('receitas').select('*').eq('projeto_id', args.projetoId),
    db.from('custos_projeto').select('*').eq('projeto_id', args.projetoId),
    db.from('despesas').select('*').eq('projeto_id', args.projetoId),
    db.from('regras_distribuicao').select('*'),
  ]);
  const resultado = calcularResultadoProjeto(
    (receitas ?? []) as Receita[],
    (custos ?? []) as CustoProjeto[],
    (despesasTodas ?? []) as Despesa[]
  );
  const regraVigente = resolveRegraDistribuicaoVigente((regras ?? []) as RegraDistribuicao[], new Date().toISOString().slice(0, 10), args.projetoId);

  return {
    projeto: { id: projeto.id, nome: projeto.nome, tipo: projeto.tipo, status: projeto.status },
    resultado,
    regraDistribuicaoVigente: regraVigente,
    dadosSuficientes: true,
  };
}

// ---------------------------------------------------------------------
// get_expense_summary
// ---------------------------------------------------------------------
export async function getExpenseSummary(db: ClienteConsulta, capabilities: Capability[], args: { competencia: string }) {
  assertCapability(capabilities, 'view_expenses', 'get_expense_summary');
  const inicio = primeiroDiaMes(args.competencia);
  const fim = ultimoDiaMes(args.competencia);
  const { data: despesas, error } = await db.from('despesas').select('*').gte('competencia', inicio).lte('competencia', fim);
  if (error) throw new OrionError('Falha ao consultar despesas.', 500, 'erro_consulta');
  const lista = (despesas ?? []) as Despesa[];
  const porStatus = (status: Despesa['status']) => lista.filter((d) => d.status === status);
  const somar = (itens: Despesa[]) => round2(itens.reduce((acc, d) => acc + d.valor, 0));

  return {
    competencia: args.competencia,
    totalProvisionado: somar(porStatus('provisionado')),
    quantidadeProvisionado: porStatus('provisionado').length,
    totalPago: somar(porStatus('pago')),
    quantidadePago: porStatus('pago').length,
    totalCancelado: somar(porStatus('cancelado')),
    dadosSuficientes: true,
  };
}

// ---------------------------------------------------------------------
// get_overdue_items
// ---------------------------------------------------------------------
export async function getOverdueItems(db: ClienteConsulta, capabilities: Capability[], args: { data: string }) {
  const resultado: Record<string, unknown> = { dataReferencia: args.data };
  if (capabilities.includes('view_expenses')) {
    const { data: despesas } = await db.from('despesas').select('*').eq('status', 'provisionado').lt('data_vencimento', args.data);
    resultado.despesasVencidas = (despesas ?? []).map((d: Despesa) => ({ id: d.id, descricao: d.descricao, valor: d.valor, vencimento: d.data_vencimento }));
  }
  if (capabilities.includes('view_revenues')) {
    const { data: receitas } = await db.from('receitas').select('*').in('status', ['previsto', 'faturado', 'vencido']).lt('data_prevista', args.data);
    resultado.receitasPendentes = (receitas ?? []).map((r: Receita) => ({ id: r.id, descricao: r.descricao, valor: r.valor_bruto, dataPrevista: r.data_prevista, status: r.status }));
  }
  if (!('despesasVencidas' in resultado) && !('receitasPendentes' in resultado)) {
    throw new OrionError("Sem permissão para usar get_overdue_items (requer 'view_expenses' ou 'view_revenues').", 403, 'sem_permissao');
  }
  resultado.dadosSuficientes = true;
  return resultado;
}

// ---------------------------------------------------------------------
// get_investment_roi
// ---------------------------------------------------------------------
export async function getInvestmentRoi(db: ClienteConsulta, capabilities: Capability[], args: { projetoId?: string | null }) {
  assertCapability(capabilities, 'view_investments', 'get_investment_roi');
  let query = db.from('investimentos').select('*').neq('status', 'cancelado');
  if (args.projetoId) query = query.eq('projeto_id', args.projetoId);
  const { data: investimentos, error } = await query;
  if (error) throw new OrionError('Falha ao consultar investimentos.', 500, 'erro_consulta');
  const lista = (investimentos ?? []) as Investimento[];
  if (lista.length === 0) return { dadosSuficientes: false, motivo: 'Nenhum investimento ativo encontrado para os filtros informados.' };

  const projetoIds = [...new Set(lista.map((i) => i.projeto_id).filter((id): id is string => Boolean(id)))];
  const resultadosPorProjeto: Record<string, unknown> = {};
  for (const projetoId of projetoIds) {
    const investimentosProjeto = lista.filter((i) => i.projeto_id === projetoId);
    const inicio = investimentosProjeto.map((i) => i.data).sort()[0];
    const hoje = new Date().toISOString().slice(0, 10);
    const [{ data: receitas }, { data: custos }, { data: despesas }] = await Promise.all([
      db.from('receitas').select('*').eq('projeto_id', projetoId),
      db.from('custos_projeto').select('*').eq('projeto_id', projetoId),
      db.from('despesas').select('*').eq('projeto_id', projetoId),
    ]);
    const receitasRealizadas = ((receitas ?? []) as Receita[]).filter((r) => r.status === 'recebido' && r.data_recebimento && r.data_recebimento >= inicio);
    const custosRealizados = ((custos ?? []) as CustoProjeto[]).filter((c) => c.status === 'pago' && c.data_pagamento && c.data_pagamento >= inicio);
    const despesasRealizadas = ((despesas ?? []) as Despesa[]).filter((d) => d.status === 'pago' && d.data_pagamento && d.data_pagamento >= inicio);
    const resultado = calcularResultadoProjeto(receitasRealizadas, custosRealizados, despesasRealizadas);
    const investido = investimentosProjeto.reduce((acc, i) => acc + i.valor, 0);
    const capitalNaoConsiderado = investimentosProjeto.filter((i) => !i.considerado_no_resultado).reduce((acc, i) => acc + i.valor, 0);
    const meses = mesesEntre(inicio, hoje);
    const retornosMensais = meses.map((mes) => calcularResultadoProjeto(
      receitasRealizadas.filter((r) => r.data_recebimento?.slice(0, 7) === mes),
      custosRealizados.filter((c) => c.data_pagamento?.slice(0, 7) === mes),
      despesasRealizadas.filter((d) => d.data_pagamento?.slice(0, 7) === mes)
    ).resultadoLiquido);
    const metas = investimentosProjeto.map((i) => i.roi_meta_percentual).filter((v): v is number => typeof v === 'number');
    resultadosPorProjeto[projetoId] = {
      investido: round2(investido),
      retornoRealizado: resultado.resultadoLiquido,
      roiPercentual: calcularROI(investido, resultado.resultadoLiquido, capitalNaoConsiderado),
      paybackMeses: calcularPaybackMeses(investido, retornosMensais),
      metaRoiPercentual: metas.length ? Math.max(...metas) : null,
    };
  }

  return { porProjeto: resultadosPorProjeto, dadosSuficientes: true };
}

// ---------------------------------------------------------------------
// get_recurring_revenue
// ---------------------------------------------------------------------
export async function getRecurringRevenue(db: ClienteConsulta, capabilities: Capability[], args: { data: string }) {
  assertCapability(capabilities, 'view_dashboard', 'get_recurring_revenue');
  const { data: assinaturas, error } = await db.from('assinaturas').select('*');
  if (error) throw new OrionError('Falha ao consultar assinaturas.', 500, 'erro_consulta');
  const lista = (assinaturas ?? []) as Assinatura[];
  const mrr = calcularMRR(lista, args.data);
  const arr = calcularARR(mrr);
  const clientesAtivos = new Set(lista.filter((a) => a.status === 'ativa').map((a) => a.cliente_id)).size;
  return {
    dataReferencia: args.data,
    mrr,
    arr,
    clientesAtivos,
    ticketMedio: clientesAtivos > 0 ? round2(mrr / clientesAtivos) : 0,
    dadosSuficientes: true,
  };
}

// ---------------------------------------------------------------------
// get_break_even
// ---------------------------------------------------------------------
export async function getBreakEven(db: ClienteConsulta, capabilities: Capability[], args: { competencia: string }) {
  assertCapability(capabilities, 'view_dashboard', 'get_break_even');
  const inicio = primeiroDiaMes(args.competencia);
  const fim = ultimoDiaMes(args.competencia);
  const [dreTodos, dreRealizado] = await Promise.all([buscarDRE(db, inicio, fim, false), buscarDRE(db, inicio, fim, true)]);
  const breakEven = calcularBreakEven({
    despesasFixasMensais: dreTodos.despesasCorporativasFixas,
    receitaBruta: dreRealizado.consolidadoProjetos.receitaBruta,
    tributos: dreRealizado.consolidadoProjetos.tributoProvisionado,
    custosVariaveis: dreRealizado.despesasVariaveisTotais,
  });
  const margemSeguranca = Number.isFinite(breakEven.faturamentoMinimo)
    ? round2(dreRealizado.consolidadoProjetos.receitaBruta - breakEven.faturamentoMinimo)
    : null;
  return {
    competencia: args.competencia,
    faturamentoMinimo: Number.isFinite(breakEven.faturamentoMinimo) ? breakEven.faturamentoMinimo : null,
    margemContribuicaoPercentual: breakEven.margemContribuicaoPercentual,
    faturamentoRealizado: dreRealizado.consolidadoProjetos.receitaBruta,
    margemSeguranca,
    acimaDoPontoDeEquilibrio: margemSeguranca !== null ? margemSeguranca >= 0 : null,
    dadosSuficientes: true,
  };
}

// ---------------------------------------------------------------------
// simulate_financial_scenario
// ---------------------------------------------------------------------
export async function simulateFinancialScenario(
  db: ClienteConsulta,
  capabilities: Capability[],
  args: { receitaBruta: number; custos?: number; despesas?: number; aliquotaPercentual?: number; percentualEmpresa?: number }
) {
  assertCapability(capabilities, 'view_simulator', 'simulate_financial_scenario');
  if (typeof args.receitaBruta !== 'number' || args.receitaBruta < 0) {
    throw new OrionError('receitaBruta inválida para simulação.', 400, 'argumento_invalido');
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const [{ data: tributos }, { data: regras }] = await Promise.all([
    db.from('parametros_tributarios').select('*'),
    db.from('regras_distribuicao').select('*'),
  ]);
  const tributoVigente = resolveVigente(((tributos ?? []) as ParametroTributario[]).filter((t) => t.tipo_receita === 'geral'), hoje);
  const regraVigente = resolveVigente(((regras ?? []) as RegraDistribuicao[]).filter((r) => r.escopo === 'default'), hoje);

  const resultado = simularCenario({
    receitaBruta: args.receitaBruta,
    aliquotaPercentual: args.aliquotaPercentual ?? tributoVigente?.aliquota_percentual ?? 0,
    custos: args.custos ?? 0,
    despesas: args.despesas ?? 0,
    percentualEmpresa: args.percentualEmpresa ?? regraVigente?.percentual_empresa ?? 100,
    splitSocios: regraVigente?.split_socios ?? [],
  });

  return { entrada: args, parametrosUsados: { aliquotaVigente: tributoVigente?.aliquota_percentual ?? null, regraDistribuicaoVigente: regraVigente ?? null }, resultado, dadosSuficientes: true };
}

// ---------------------------------------------------------------------
// get_close_readiness
// ---------------------------------------------------------------------
export async function getCloseReadiness(db: ClienteConsulta, capabilities: Capability[], args: { competencia: string }) {
  assertCapability(capabilities, 'view_closing', 'get_close_readiness');
  const inicio = primeiroDiaMes(args.competencia);
  const fim = ultimoDiaMes(args.competencia);

  const [dreRealizado, { data: fechamentoExistente }, { data: sociosDiretorio }, { data: receitasPeriodo }, { data: custosPeriodo }, { data: despesasPeriodo }] = await Promise.all([
    buscarDRE(db, inicio, fim, true),
    db.from('fechamentos_mensais').select('*').eq('competencia', inicio).maybeSingle(),
    db.from('socios_diretorio').select('*'),
    db.from('receitas').select('*').gte('data_fato_gerador', inicio).lte('data_fato_gerador', fim),
    db.from('custos_projeto').select('*').gte('data', inicio).lte('data', fim),
    db.from('despesas').select('*').gte('competencia', inicio).lte('competencia', fim),
  ]);

  const pendencias: string[] = [];
  if (fechamentoExistente?.status === 'fechado') {
    pendencias.push(`Competência já fechada em ${fechamentoExistente.fechado_em ?? 'data desconhecida'}.`);
  }
  const ativosPorId = new Map(((sociosDiretorio ?? []) as { id: string; ativo: boolean }[]).filter((s) => s.ativo).map((s) => [s.id, true]));
  for (const socioId of Object.keys(dreRealizado.consolidadoProjetos.porSocio)) {
    if (!ativosPorId.has(socioId)) pendencias.push(`Sócio ${socioId} não está mais ativo e não pode receber crédito de resultado.`);
  }
  const receitasPendentes = ((receitasPeriodo ?? []) as Receita[]).filter((r) => r.status !== 'recebido' && r.status !== 'cancelado');
  if (receitasPendentes.length > 0) pendencias.push(`${receitasPendentes.length} receita(s) ainda não recebida(s) nesta competência.`);
  const custosPendentes = ((custosPeriodo ?? []) as CustoProjeto[]).filter((c) => c.status === 'provisionado');
  const despesasPendentes = ((despesasPeriodo ?? []) as Despesa[]).filter((d) => d.status === 'provisionado');
  if (custosPendentes.length + despesasPendentes.length > 0) pendencias.push(`${custosPendentes.length + despesasPendentes.length} custo(s)/despesa(s) ainda provisionados nesta competência.`);

  return {
    competencia: args.competencia,
    jaFechada: fechamentoExistente?.status === 'fechado',
    prontoParaFechar: pendencias.length === 0,
    pendencias,
    resumoRealizado: {
      receitaBruta: dreRealizado.consolidadoProjetos.receitaBruta,
      resultadoLiquido: round2(dreRealizado.consolidadoProjetos.resultadoLiquido - dreRealizado.despesasCorporativas),
    },
    dadosSuficientes: true,
  };
}

function mesesEntre(inicio: string, fim: string): string[] {
  const atual = new Date(`${inicio.slice(0, 7)}-01T00:00:00Z`);
  const limite = new Date(`${fim.slice(0, 7)}-01T00:00:00Z`);
  const meses: string[] = [];
  while (atual <= limite && meses.length < 120) {
    meses.push(`${atual.getUTCFullYear()}-${String(atual.getUTCMonth() + 1).padStart(2, '0')}`);
    atual.setUTCMonth(atual.getUTCMonth() + 1);
  }
  return meses;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const EXECUTORES_TOOLS = {
  get_dashboard_summary: getDashboardSummary,
  get_dre: getDre,
  get_project_financials: getProjectFinancials,
  get_expense_summary: getExpenseSummary,
  get_overdue_items: getOverdueItems,
  get_investment_roi: getInvestmentRoi,
  get_recurring_revenue: getRecurringRevenue,
  get_break_even: getBreakEven,
  simulate_financial_scenario: simulateFinancialScenario,
  get_close_readiness: getCloseReadiness,
} as const;

// A referência de ResultadoProjeto é usada só para o tipo ficar
// explícito nas assinaturas acima quando necessário em consumidores.
export type { ResultadoProjeto };
