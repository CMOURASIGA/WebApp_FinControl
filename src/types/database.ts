// Tipos manuais equivalentes ao schema em supabase/migrations/0001_init.sql.
// Se preferir, substitua por `supabase gen types typescript` apontando para
// o projeto real — a forma dos objetos foi desenhada para bater 1:1 com as
// colunas das tabelas.

export type Papel = 'admin' | 'financeiro' | 'socio' | 'consulta';
export type TipoProjeto = 'servico' | 'implantacao' | 'recorrente' | 'consultoria' | 'conjunto';
export type StatusProjeto = 'ativo' | 'concluido' | 'cancelado';
export type TipoReceita = 'pontual' | 'recorrente' | 'ajuste';
export type StatusReceita = 'previsto' | 'faturado' | 'recebido' | 'vencido' | 'cancelado';
export type StatusTributo = 'provisionado' | 'pago';
export type TipoDespesa = 'fixa' | 'variavel' | 'projeto' | 'tributo' | 'investimento';
export type StatusDespesa = 'provisionado' | 'pago' | 'cancelado';
export type InvestidorTipo = 'socio' | 'empresa';
export type TipoLancamentoSocio = 'credito_resultado' | 'retirada' | 'reembolso' | 'ajuste' | 'debito_ajuste';
export type TipoLancamentoReserva = 'aporte' | 'uso';
export type StatusAssinatura = 'ativa' | 'suspensa' | 'cancelada';
export type StatusFechamento = 'aberto' | 'fechado';
export type EscopoRegraDistribuicao = 'default' | 'projeto';

export interface SplitSocio {
  socio_id: string;
  percentual: number;
}

export interface Profile {
  id: string;
  nome: string;
  cpf: string | null;
  chave_pix: string | null;
  papel: Papel;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Socio {
  id: string;
  profile_id: string | null;
  nome: string;
  cpf: string | null;
  chave_pix: string | null;
  email: string | null;
  telefone: string | null;
  tipo: 'socio' | 'investidor';
  data_entrada: string;
  data_saida: string | null;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id: string;
  nome: string;
  documento: string | null;
  contato: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface Projeto {
  id: string;
  cliente_id: string | null;
  nome: string;
  tipo: TipoProjeto;
  origem_economica: string;
  responsavel_comercial: string | null;
  responsavel_execucao: string | null;
  originador_socio_id: string | null;
  responsavel_comercial_socio_id: string | null;
  responsavel_execucao_socio_id: string | null;
  status: StatusProjeto;
  observacao: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParametroTributario {
  id: string;
  aliquota_percentual: number;
  regime: string;
  tipo_receita: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  observacao: string | null;
  created_by: string | null;
  created_at: string;
}

export interface RegraDistribuicao {
  id: string;
  escopo: EscopoRegraDistribuicao;
  projeto_id: string | null;
  percentual_empresa: number;
  split_socios: SplitSocio[];
  vigencia_inicio: string;
  vigencia_fim: string | null;
  observacao: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Receita {
  id: string;
  projeto_id: string;
  descricao: string;
  tipo: TipoReceita;
  valor_bruto: number;
  status: StatusReceita;
  data_prevista: string;
  data_fato_gerador: string;
  data_recebimento: string | null;

  parametro_tributario_id: string | null;
  aliquota_aplicada: number | null;

  regra_distribuicao_id: string | null;
  percentual_empresa_aplicado: number | null;
  split_socios_aplicado: SplitSocio[] | null;

  tributo_status: StatusTributo;
  tributo_pago_em: string | null;

  observacao: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  receita_origem_id: string | null;
  emite_nota: boolean;
  tem_retencao: boolean;
  percentual_retencao: number;
  valor_retido: number;
}

export interface ReceitaHistorico {
  id: string; receita_id: string;
  acao: 'edicao' | 'cancelamento' | 'recebimento' | 'estorno_recebimento' | 'ajuste_fechado';
  dados_anteriores: Partial<Receita> | null; dados_novos: Partial<Receita> | null;
  motivo: string | null; executado_por: string | null; executado_em: string;
}

export interface CustoProjeto {
  id: string;
  projeto_id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  observacao: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status: StatusDespesa;
  data_pagamento: string | null;
}

export interface FinanceiroHistorico {
  id: string; entidade: 'custo_projeto' | 'despesa'; registro_id: string;
  acao: 'edicao' | 'cancelamento' | 'pagamento' | 'estorno_pagamento' | 'reativacao';
  dados_anteriores: Record<string, unknown> | null; dados_novos: Record<string, unknown> | null;
  motivo: string | null; executado_por: string | null; executado_em: string;
}

export interface Despesa {
  id: string;
  categoria: string;
  tipo: TipoDespesa;
  descricao: string;
  valor: number;
  projeto_id: string | null;
  competencia: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: StatusDespesa;
  observacao: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Investimento {
  id: string;
  investidor_tipo: InvestidorTipo;
  socio_id: string | null;
  projeto_id: string | null;
  valor: number;
  data: string;
  tipo: string;
  descricao: string | null;
  retorno_esperado: number | null;
  prazo_esperado_meses: number | null;
  roi_meta_percentual: number | null;
  considerado_no_resultado: boolean;
  data_encerramento: string | null;
  status: 'ativo' | 'cancelado';
  updated_at: string;
  created_by: string | null;
  created_at: string;
}

export interface InvestimentoHistorico {
  id: string; investimento_id: string; acao: 'edicao' | 'cancelamento' | 'reativacao';
  dados_anteriores: Partial<Investimento> | null; dados_novos: Partial<Investimento> | null;
  motivo: string; executado_por: string | null; executado_em: string;
}

export interface SocioLancamento {
  id: string;
  socio_id: string;
  tipo: TipoLancamentoSocio;
  valor: number;
  projeto_id: string | null;
  receita_id: string | null;
  fechamento_id: string | null;
  data: string;
  descricao: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ReservaEmpresaLancamento {
  id: string;
  tipo: TipoLancamentoReserva;
  valor: number;
  data: string;
  descricao: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Assinatura {
  id: string;
  cliente_id: string;
  projeto_id: string | null;
  nome: string;
  valor_mensal: number;
  dia_cobranca: number | null;
  data_inicio: string;
  data_fim: string | null;
  status: StatusAssinatura;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FechamentoMensal {
  id: string;
  competencia: string;
  status: StatusFechamento;
  fechado_em: string | null;
  fechado_por: string | null;
  snapshot: Record<string, unknown> | null;
  observacao: string | null;
  created_at: string;
}

// Placeholder mínimo para satisfazer o generic do supabase-js sem gerar o
// arquivo completo via CLI. Cada tabela usada pelos services é tipada "as"
// no próprio service.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
