// =====================================================================
// Motor de cálculo financeiro — Consult Services Finance 2027
//
// Único lugar do sistema onde a "regra de ouro" é aplicada:
//   receita bruta -> tributo -> custo direto -> despesa -> resultado
//   líquido -> reserva da empresa -> distribuição por sócio.
//
// Tudo aqui recebe os PARÂMETROS JÁ RESOLVIDOS (aliquota, percentual de
// empresa, split de sócios) — nunca lê constantes. Quem resolve "qual é
// o parâmetro vigente nesta data" é `resolveVigente`, usado tanto para
// gravar o snapshot de uma receita nova quanto para o simulador.
// =====================================================================

import type {
  CustoProjeto,
  Despesa,
  ParametroPessoal,
  ParametroTributario,
  Receita,
  RegraDistribuicao,
  SplitSocio,
} from '../types/database';

interface ComVigencia {
  vigencia_inicio: string;
  vigencia_fim: string | null;
}

/** Encontra, numa lista de parâmetros com vigência, o que vale numa data. */
export function resolveVigente<T extends ComVigencia>(itens: T[], dataRef: string): T | null {
  const candidatos = itens
    .filter((item) => item.vigencia_inicio <= dataRef && (item.vigencia_fim === null || item.vigencia_fim >= dataRef))
    .sort((a, b) => (a.vigencia_inicio < b.vigencia_inicio ? 1 : -1));
  return candidatos[0] ?? null;
}

export function resolveTributoVigente(
  parametros: ParametroTributario[],
  dataRef: string,
  tipoReceita = 'geral'
): ParametroTributario | null {
  return resolveVigente(
    parametros.filter((p) => p.tipo_receita === tipoReceita),
    dataRef
  );
}

export function resolveRegraDistribuicaoVigente(
  regras: RegraDistribuicao[],
  dataRef: string,
  projetoId: string | null
): RegraDistribuicao | null {
  if (projetoId) {
    const especifica = resolveVigente(
      regras.filter((r) => r.escopo === 'projeto' && r.projeto_id === projetoId),
      dataRef
    );
    if (especifica) return especifica;
  }
  return resolveVigente(
    regras.filter((r) => r.escopo === 'default'),
    dataRef
  );
}

export function resolveMetaPessoalVigente(
  parametros: ParametroPessoal[],
  socioId: string,
  dataRef: string
): ParametroPessoal | null {
  return resolveVigente(
    parametros.filter((p) => p.socio_id === socioId),
    dataRef
  );
}

// ---------------------------------------------------------------------
// Snapshot: o que grava em `receitas` no momento do cadastro/recebimento
// ---------------------------------------------------------------------
export interface SnapshotReceita {
  parametro_tributario_id: string | null;
  aliquota_aplicada: number;
  regra_distribuicao_id: string | null;
  percentual_empresa_aplicado: number;
  split_socios_aplicado: SplitSocio[];
}

export function montarSnapshotReceita(
  dataFatoGerador: string,
  projetoId: string,
  tributos: ParametroTributario[],
  regras: RegraDistribuicao[],
  tipoReceita = 'geral'
): SnapshotReceita {
  const tributo = resolveTributoVigente(tributos, dataFatoGerador, tipoReceita);
  const regra = resolveRegraDistribuicaoVigente(regras, dataFatoGerador, projetoId);

  return {
    parametro_tributario_id: tributo?.id ?? null,
    aliquota_aplicada: tributo?.aliquota_percentual ?? 0,
    regra_distribuicao_id: regra?.id ?? null,
    percentual_empresa_aplicado: regra?.percentual_empresa ?? 100,
    split_socios_aplicado: regra?.split_socios ?? [],
  };
}

// ---------------------------------------------------------------------
// Waterfall por receita individual
// ---------------------------------------------------------------------
export interface ResultadoReceita {
  receitaId: string;
  receitaBruta: number;
  tributoProvisionado: number;
  receitaLiquida: number;
}

export function calcularReceitaIndividual(receita: Receita): ResultadoReceita {
  const aliquota = receita.aliquota_aplicada ?? 0;
  const tributo = round2((receita.valor_bruto * aliquota) / 100);
  return {
    receitaId: receita.id,
    receitaBruta: receita.valor_bruto,
    tributoProvisionado: tributo,
    receitaLiquida: round2(receita.valor_bruto - tributo),
  };
}

// ---------------------------------------------------------------------
// Waterfall por projeto (agrega N receitas + custos diretos + despesas
// atribuídas). Custos e despesas do projeto são rateados entre as
// receitas na proporção da receita bruta de cada uma, para que cada
// receita "carregue" sua própria regra de distribuição (que pode ter
// mudado ao longo do projeto) sobre o resultado líquido que lhe cabe.
// ---------------------------------------------------------------------
export interface ResultadoProjeto {
  receitaBruta: number;
  tributoProvisionado: number;
  custosDiretos: number;
  despesasAtribuidas: number;
  resultadoLiquido: number;
  valorEmpresa: number;
  porSocio: Record<string, number>;
}

export function calcularResultadoProjeto(
  receitas: Receita[],
  custos: CustoProjeto[],
  despesas: Despesa[]
): ResultadoProjeto {
  const receitasValidas = receitas.filter((r) => r.status !== 'cancelado');
  const receitaBruta = round2(sum(receitasValidas.map((r) => r.valor_bruto)));
  const tributoProvisionado = round2(
    sum(receitasValidas.map((r) => (r.valor_bruto * (r.aliquota_aplicada ?? 0)) / 100))
  );
  const custosDiretos = round2(sum(custos.map((c) => c.valor)));
  const despesasAtribuidas = round2(sum(despesas.map((d) => d.valor)));
  const resultadoLiquido = round2(receitaBruta - tributoProvisionado - custosDiretos - despesasAtribuidas);

  const custosEDespesas = custosDiretos + despesasAtribuidas;

  let valorEmpresa = 0;
  const porSocio: Record<string, number> = {};

  for (const receita of receitasValidas) {
    const pesoReceita = receitaBruta > 0 ? receita.valor_bruto / receitaBruta : 0;
    const custosRateados = custosEDespesas * pesoReceita;
    const tributoReceita = (receita.valor_bruto * (receita.aliquota_aplicada ?? 0)) / 100;
    const resultadoLiquidoReceita = receita.valor_bruto - tributoReceita - custosRateados;

    const percentualEmpresa = receita.percentual_empresa_aplicado ?? 100;
    const split = receita.split_socios_aplicado ?? [];

    valorEmpresa += resultadoLiquidoReceita * (percentualEmpresa / 100);
    for (const parte of split) {
      porSocio[parte.socio_id] = (porSocio[parte.socio_id] ?? 0) + resultadoLiquidoReceita * (parte.percentual / 100);
    }
  }

  valorEmpresa = round2(valorEmpresa);
  for (const socioId of Object.keys(porSocio)) porSocio[socioId] = round2(porSocio[socioId]);

  return { receitaBruta, tributoProvisionado, custosDiretos, despesasAtribuidas, resultadoLiquido, valorEmpresa, porSocio };
}

/** Agrega o resultado de vários projetos (visão consolidada da empresa). */
export function consolidarResultados(resultados: ResultadoProjeto[]): ResultadoProjeto {
  const porSocio: Record<string, number> = {};
  for (const r of resultados) {
    for (const [socioId, valor] of Object.entries(r.porSocio)) {
      porSocio[socioId] = round2((porSocio[socioId] ?? 0) + valor);
    }
  }
  return {
    receitaBruta: round2(sum(resultados.map((r) => r.receitaBruta))),
    tributoProvisionado: round2(sum(resultados.map((r) => r.tributoProvisionado))),
    custosDiretos: round2(sum(resultados.map((r) => r.custosDiretos))),
    despesasAtribuidas: round2(sum(resultados.map((r) => r.despesasAtribuidas))),
    resultadoLiquido: round2(sum(resultados.map((r) => r.resultadoLiquido))),
    valorEmpresa: round2(sum(resultados.map((r) => r.valorEmpresa))),
    porSocio,
  };
}

// ---------------------------------------------------------------------
// Meta pessoal — acompanhamento, nunca obrigação de pagamento
// ---------------------------------------------------------------------
export interface StatusMetaPessoal {
  meta: number;
  disponivel: number;
  gap: number;
  atingida: boolean;
}

export function calcularStatusMeta(meta: number, disponivel: number): StatusMetaPessoal {
  return {
    meta,
    disponivel: round2(disponivel),
    gap: round2(disponivel - meta),
    atingida: disponivel >= meta,
  };
}

// ---------------------------------------------------------------------
// MRR / ARR
// ---------------------------------------------------------------------
export function calcularMRR(
  assinaturas: { valor_mensal: number; status: string; data_inicio: string; data_fim: string | null }[],
  dataRef: string
): number {
  return round2(
    sum(
      assinaturas
        .filter(
          (a) => a.status === 'ativa' && a.data_inicio <= dataRef && (a.data_fim === null || a.data_fim >= dataRef)
        )
        .map((a) => a.valor_mensal)
    )
  );
}

export function calcularARR(mrr: number): number {
  return round2(mrr * 12);
}

// ---------------------------------------------------------------------
// Break-even
//   1) faturamento mínimo para existir: cobre despesas fixas + custos
//      recorrentes, considerando o tributo médio efetivo.
//   2) faturamento mínimo para existir + permitir a meta pessoal
//      configurada de cada sócio.
// ---------------------------------------------------------------------
export function calcularBreakEven(params: {
  despesasFixasMensais: number;
  aliquotaMediaPercentual: number;
  percentualEmpresa: number;
  metasPessoais?: { socioId: string; meta: number; percentualSocio: number }[];
}): { faturamentoMinimo: number; faturamentoComMetas: number } {
  const fatorTributo = 1 - params.aliquotaMediaPercentual / 100;
  if (fatorTributo <= 0) return { faturamentoMinimo: Infinity, faturamentoComMetas: Infinity };

  // Faturamento cujo resultado líquido (após tributo) cobre as despesas fixas.
  const faturamentoMinimo = round2(params.despesasFixasMensais / fatorTributo);

  const metas = params.metasPessoais ?? [];
  // Faturamento adicional necessário para que, após reservar o percentual
  // da empresa, cada sócio receba sua meta via seu percentual de split.
  let faturamentoAdicional = 0;
  for (const m of metas) {
    if (m.percentualSocio <= 0) continue;
    faturamentoAdicional += m.meta / (fatorTributo * (m.percentualSocio / 100));
  }

  const faturamentoComMetas = round2(faturamentoMinimo + faturamentoAdicional);
  return { faturamentoMinimo, faturamentoComMetas };
}

// ---------------------------------------------------------------------
// Simulador tributário — recalcula tudo para uma alíquota hipotética,
// sem tocar em nenhum dado real.
// ---------------------------------------------------------------------
export interface SimulacaoInput {
  receitaBruta: number;
  aliquotaPercentual: number;
  custos: number;
  despesas: number;
  percentualEmpresa: number;
  splitSocios: SplitSocio[];
}

export function simularCenario(input: SimulacaoInput): ResultadoProjeto & { margemLiquida: number } {
  const tributoProvisionado = round2((input.receitaBruta * input.aliquotaPercentual) / 100);
  const resultadoLiquido = round2(input.receitaBruta - tributoProvisionado - input.custos - input.despesas);
  const valorEmpresa = round2(resultadoLiquido * (input.percentualEmpresa / 100));

  const porSocio: Record<string, number> = {};
  for (const parte of input.splitSocios) {
    porSocio[parte.socio_id] = round2(resultadoLiquido * (parte.percentual / 100));
  }

  const margemLiquida = input.receitaBruta > 0 ? round2((resultadoLiquido / input.receitaBruta) * 100) : 0;

  return {
    receitaBruta: input.receitaBruta,
    tributoProvisionado,
    custosDiretos: input.custos,
    despesasAtribuidas: input.despesas,
    resultadoLiquido,
    valorEmpresa,
    porSocio,
    margemLiquida,
  };
}

// ---------------------------------------------------------------------
// ROI
// ---------------------------------------------------------------------
export function calcularROI(capitalInvestido: number, retornoLiquidoAtribuivel: number): number {
  if (capitalInvestido <= 0) return 0;
  return round2(((retornoLiquidoAtribuivel - capitalInvestido) / capitalInvestido) * 100);
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
