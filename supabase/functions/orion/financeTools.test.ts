import { describe, expect, it } from 'vitest';
import {
  EXECUTORES_TOOLS,
  getCloseReadiness,
  getDashboardSummary,
  getExpenseSummary,
  getInvestmentRoi,
  simulateFinancialScenario,
  type ClienteConsulta,
} from './financeTools.ts';
import { OrionError, TOOLS_PERMITIDAS } from './types.ts';
import type { Capability } from '../../../src/lib/capabilities.ts';

// Cliente Supabase falso: ignora filtros e devolve as linhas da tabela
// pedida (o objetivo destes testes é a orquestração da tool — checagem
// de capability, uso do motor de cálculo, formato da resposta — não a
// filtragem SQL, que é responsabilidade do Postgres/RLS e é validada
// pelos scripts em supabase/tests/*.sql).
function criarClienteFake(tabelas: Record<string, unknown[]>): ClienteConsulta {
  return {
    from(tabela: string) {
      const linhas = tabelas[tabela] ?? [];
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        neq: () => builder,
        gte: () => builder,
        lte: () => builder,
        lt: () => builder,
        in: () => builder,
        order: () => builder,
        maybeSingle: async () => ({ data: linhas[0] ?? null, error: null }),
        then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => resolve({ data: linhas, error: null }),
      };
      return builder;
    },
  };
}

const SEM_CAPABILITIES: Capability[] = [];

describe('financeTools: allowlist e cobertura', () => {
  it('EXECUTORES_TOOLS tem exatamente as tools de TOOLS_PERMITIDAS, nem mais nem menos', () => {
    expect(Object.keys(EXECUTORES_TOOLS).sort()).toEqual([...TOOLS_PERMITIDAS].sort());
  });
});

describe('getDashboardSummary', () => {
  it('rejeita usuário sem view_dashboard', async () => {
    const db = criarClienteFake({});
    await expect(getDashboardSummary(db, SEM_CAPABILITIES, { competencia: '2026-08' })).rejects.toThrow(OrionError);
  });

  it('calcula faturamento/resultado/margem realizados a partir das linhas do período', async () => {
    const db = criarClienteFake({
      projetos: [{ id: 'p1', nome: 'Projeto 1' }],
      receitas: [
        { id: 'r1', projeto_id: 'p1', valor_bruto: 10000, status: 'recebido', data_recebimento: '2026-08-10', emite_nota: true, aliquota_aplicada: 6, tem_retencao: false, percentual_retencao: 0, valor_retido: 0, regra_distribuicao_id: null, percentual_empresa_aplicado: 100, split_socios_aplicado: [] },
      ],
      custos_projeto: [],
      despesas: [],
      assinaturas: [],
    });
    const resultado = await getDashboardSummary(db, ['view_dashboard'], { competencia: '2026-08' });
    expect(resultado.dadosSuficientes).toBe(true);
    expect(resultado.faturamentoRealizado).toBe(10000);
    expect(resultado.resultadoLiquidoRealizado).toBeGreaterThan(0);
    expect(resultado.mrr).toBe(0);
  });
});

describe('getExpenseSummary', () => {
  it('rejeita usuário sem view_expenses', async () => {
    const db = criarClienteFake({});
    await expect(getExpenseSummary(db, SEM_CAPABILITIES, { competencia: '2026-08' })).rejects.toThrow(OrionError);
  });

  it('soma provisionado/pago/cancelado separadamente', async () => {
    const db = criarClienteFake({
      despesas: [
        { id: 'd1', valor: 100, status: 'provisionado' },
        { id: 'd2', valor: 200, status: 'provisionado' },
        { id: 'd3', valor: 50, status: 'pago' },
        { id: 'd4', valor: 30, status: 'cancelado' },
      ],
    });
    const resultado = await getExpenseSummary(db, ['view_expenses'], { competencia: '2026-08' });
    expect(resultado.totalProvisionado).toBe(300);
    expect(resultado.quantidadeProvisionado).toBe(2);
    expect(resultado.totalPago).toBe(50);
    expect(resultado.totalCancelado).toBe(30);
  });
});

describe('getInvestmentRoi', () => {
  it('rejeita usuário sem view_investments', async () => {
    const db = criarClienteFake({});
    await expect(getInvestmentRoi(db, SEM_CAPABILITIES, {})).rejects.toThrow(OrionError);
  });

  it('retorna dadosSuficientes=false quando não há investimento ativo', async () => {
    const db = criarClienteFake({ investimentos: [] });
    const resultado = await getInvestmentRoi(db, ['view_investments'], {});
    expect(resultado.dadosSuficientes).toBe(false);
  });
});

describe('simulateFinancialScenario', () => {
  it('rejeita usuário sem view_simulator', async () => {
    const db = criarClienteFake({});
    await expect(simulateFinancialScenario(db, SEM_CAPABILITIES, { receitaBruta: 1000 })).rejects.toThrow(OrionError);
  });

  it('rejeita receitaBruta inválida', async () => {
    const db = criarClienteFake({ parametros_tributarios: [], regras_distribuicao: [] });
    await expect(simulateFinancialScenario(db, ['view_simulator'], { receitaBruta: -5 })).rejects.toThrow(OrionError);
  });

  it('usa o motor de cálculo (simularCenario) e não inventa números: com percentualEmpresa=100 e custos=0, resultado líquido = receita líquida de tributo', async () => {
    const db = criarClienteFake({ parametros_tributarios: [], regras_distribuicao: [] });
    const resultado = await simulateFinancialScenario(db, ['view_simulator'], { receitaBruta: 10000, aliquotaPercentual: 10, percentualEmpresa: 100 });
    expect(resultado.dadosSuficientes).toBe(true);
    expect(resultado.resultado.tributoProvisionado).toBe(1000);
    expect(resultado.resultado.resultadoLiquido).toBe(9000);
    expect(resultado.resultado.valorEmpresa).toBe(9000);
  });
});

describe('getCloseReadiness', () => {
  it('rejeita usuário sem view_closing', async () => {
    const db = criarClienteFake({});
    await expect(getCloseReadiness(db, SEM_CAPABILITIES, { competencia: '2026-08' })).rejects.toThrow(OrionError);
  });

  it('aponta pendência quando a competência já está fechada', async () => {
    const db = criarClienteFake({
      projetos: [], receitas: [], custos_projeto: [], despesas: [],
      fechamentos_mensais: [{ competencia: '2026-08-01', status: 'fechado', fechado_em: '2026-09-01' }],
      socios_diretorio: [],
    });
    const resultado = await getCloseReadiness(db, ['view_closing'], { competencia: '2026-08' });
    expect(resultado.jaFechada).toBe(true);
    expect(resultado.prontoParaFechar).toBe(false);
    expect(resultado.pendencias.length).toBeGreaterThan(0);
  });

  it('pronto para fechar quando não há pendências', async () => {
    const db = criarClienteFake({
      projetos: [], receitas: [], custos_projeto: [], despesas: [],
      fechamentos_mensais: [],
      socios_diretorio: [],
    });
    const resultado = await getCloseReadiness(db, ['view_closing'], { competencia: '2026-08' });
    expect(resultado.jaFechada).toBe(false);
    expect(resultado.prontoParaFechar).toBe(true);
    expect(resultado.pendencias).toEqual([]);
  });
});
