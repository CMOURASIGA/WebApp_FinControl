// Definições das tools no formato de "function calling" da OpenAI.
// Só descreve nome/parâmetros — a execução real vive em financeTools.ts.
// Nenhuma tool aqui aceita SQL, nome de tabela/coluna livre, nem
// qualquer verbo de escrita (ver types.ts:VERBOS_ESCRITA_PROIBIDOS).

export const DEFINICOES_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_dashboard_summary',
      description: 'Retorna os principais indicadores financeiros realizados de uma competência: faturamento, receita líquida, resultado líquido, margem, custos e despesas, MRR e ARR.',
      parameters: {
        type: 'object',
        properties: { competencia: { type: 'string', description: 'Competência no formato YYYY-MM ou YYYY-MM-DD.' } },
        required: ['competencia'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_dre',
      description: 'Retorna a DRE gerencial (receita, tributos, custos diretos, despesas, resultado, valor por sócio) de uma competência, em modo previsto, realizado ou ambos.',
      parameters: {
        type: 'object',
        properties: {
          competencia: { type: 'string', description: 'Competência no formato YYYY-MM ou YYYY-MM-DD.' },
          modo: { type: 'string', enum: ['previsto', 'realizado', 'ambos'], description: "Default 'ambos' se omitido." },
        },
        required: ['competencia'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_financials',
      description: 'Retorna o resultado financeiro completo de um projeto específico (receita bruta, tributos, custos diretos, despesas atribuídas, resultado líquido, valor por sócio, regra de distribuição vigente).',
      parameters: {
        type: 'object',
        properties: { projetoId: { type: 'string', description: 'UUID do projeto.' } },
        required: ['projetoId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_expense_summary',
      description: 'Retorna o resumo de custos e despesas de uma competência: total provisionado, total pago, total cancelado e as respectivas quantidades.',
      parameters: {
        type: 'object',
        properties: { competencia: { type: 'string', description: 'Competência no formato YYYY-MM ou YYYY-MM-DD.' } },
        required: ['competencia'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_overdue_items',
      description: 'Retorna despesas vencidas (provisionadas com vencimento anterior à data informada) e receitas pendentes (não recebidas com data prevista anterior à data informada).',
      parameters: {
        type: 'object',
        properties: { data: { type: 'string', description: 'Data de referência YYYY-MM-DD — itens anteriores a ela são considerados vencidos/pendentes.' } },
        required: ['data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_investment_roi',
      description: 'Retorna capital investido, retorno realizado, ROI, payback em meses e meta de ROI, por projeto (ou de um projeto específico).',
      parameters: {
        type: 'object',
        properties: { projetoId: { type: 'string', description: 'UUID do projeto. Omitir para trazer todos os projetos com investimento ativo.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recurring_revenue',
      description: 'Retorna MRR, ARR, quantidade de clientes ativos e ticket médio numa data de referência.',
      parameters: {
        type: 'object',
        properties: { data: { type: 'string', description: 'Data de referência YYYY-MM-DD.' } },
        required: ['data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_break_even',
      description: 'Retorna o faturamento mínimo para o ponto de equilíbrio, a margem de contribuição, o faturamento realizado e a margem de segurança de uma competência.',
      parameters: {
        type: 'object',
        properties: { competencia: { type: 'string', description: 'Competência no formato YYYY-MM ou YYYY-MM-DD.' } },
        required: ['competencia'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'simulate_financial_scenario',
      description: 'Simula um cenário financeiro (sem gravar nada) usando o motor de cálculo do sistema: informe a receita bruta e, opcionalmente, custos, despesas, alíquota e percentual da empresa — os parâmetros vigentes são usados como padrão quando omitidos.',
      parameters: {
        type: 'object',
        properties: {
          receitaBruta: { type: 'number' },
          custos: { type: 'number' },
          despesas: { type: 'number' },
          aliquotaPercentual: { type: 'number' },
          percentualEmpresa: { type: 'number' },
        },
        required: ['receitaBruta'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_close_readiness',
      description: 'Indica se uma competência está pronta para ser fechada e lista as pendências encontradas (competência já fechada, sócio inativo com crédito pendente, receitas não recebidas, custos/despesas não pagos).',
      parameters: {
        type: 'object',
        properties: { competencia: { type: 'string', description: 'Competência no formato YYYY-MM ou YYYY-MM-DD.' } },
        required: ['competencia'],
      },
    },
  },
] as const;
