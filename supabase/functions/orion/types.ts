// Tipos compartilhados da Orion (backend). Sem dependência de Deno —
// importável tanto pela Edge Function quanto pelos testes (Vitest/Node).

export type PapelOrion = 'admin' | 'financeiro' | 'socio' | 'consulta';

export interface OrionMensagem {
  role: 'user' | 'assistant';
  content: string;
}

export interface OrionRequestBody {
  /** Mensagem atual do usuário. */
  mensagem: string;
  /** Histórico curto da conversa (sem a mensagem atual). Mantido só no cliente. */
  historico?: OrionMensagem[];
  /** Competência selecionada na tela de origem (YYYY-MM-01), se houver. */
  competencia?: string | null;
}

export interface OrionResponseBody {
  resposta: string;
  /** Nomes das tools efetivamente executadas para montar a resposta. */
  toolsUsadas: string[];
}

export const TOOLS_PERMITIDAS = [
  'get_dashboard_summary',
  'get_dre',
  'get_project_financials',
  'get_expense_summary',
  'get_overdue_items',
  'get_investment_roi',
  'get_recurring_revenue',
  'get_break_even',
  'simulate_financial_scenario',
  'get_close_readiness',
] as const;

export type NomeTool = (typeof TOOLS_PERMITIDAS)[number];

/**
 * Cada tool é 100% leitura/simulação — nunca grava nada. Checado por
 * teste estático (nenhum nome em TOOLS_PERMITIDAS pode conter um
 * destes verbos). 'close'/'fechar' de propósito não incluem a palavra
 * inglesa isolada 'close' porque `get_close_readiness` — tool de
 * LEITURA que só diz se a competência está pronta para fechar —
 * legitimamente contém essa palavra; a garantia real de "não escreve"
 * não é o nome, é a allowlist fixa + o mapeamento explícito em
 * financeTools.ts, nunca SQL/nome dinâmico vindo do modelo.
 */
export const VERBOS_ESCRITA_PROIBIDOS = [
  'create', 'update', 'delete', 'insert', 'pay', 'pagar', 'cancel', 'cancelar',
  'fechar_mes', 'withdraw', 'retirar', 'reverse', 'estornar', 'reativar',
];

export class OrionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly codigo: string
  ) {
    super(message);
    this.name = 'OrionError';
  }
}
