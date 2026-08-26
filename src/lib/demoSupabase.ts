import type { Session, User } from '@supabase/supabase-js';
import { DEFAULT_BRAND } from './brand';

type Row = Record<string, any>;
type Store = Record<string, Row[]>;

const STORE_KEY = '7finance.demo.database.v2';
const USER_ID = 'demo-user-admin';
const now = () => new Date().toISOString();
const month = () => new Date().toISOString().slice(0, 7);
const date = (day: number, monthOffset = 0) => {
  const base = new Date();
  base.setMonth(base.getMonth() + monthOffset, day);
  return base.toISOString().slice(0, 10);
};
const id = (prefix = 'demo') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function seed(): Store {
  const socio1 = 'demo-socio-1';
  const socio2 = 'demo-socio-2';
  const cliente1 = 'demo-cliente-1';
  const cliente2 = 'demo-cliente-2';
  const cliente3 = 'demo-cliente-3';
  const projeto1 = 'demo-projeto-1';
  const projeto2 = 'demo-projeto-2';
  const projeto3 = 'demo-projeto-3';
  const regra = 'demo-regra-1';
  const tributo = 'demo-tributo-1';
  const base = { created_by: USER_ID, created_at: now(), updated_at: now() };

  return {
    profiles: [{ id: USER_ID, nome: 'Visitante da demonstração', cpf: null, chave_pix: null, papel: 'admin', ativo: true, created_at: now(), updated_at: now() }],
    socios: [
      { ...base, id: socio1, profile_id: null, nome: 'Christian Moura', cpf: null, chave_pix: null, email: 'christian@demo.7finance', telefone: null, tipo: 'socio', data_entrada: date(1, -8), data_saida: null, ativo: true },
      { ...base, id: socio2, profile_id: null, nome: 'Sócio Consult Services', cpf: null, chave_pix: null, email: 'socio@demo.7finance', telefone: null, tipo: 'socio', data_entrada: date(1, -8), data_saida: null, ativo: true },
    ],
    clientes: [
      { id: cliente1, nome: 'Colégio Horizonte', documento: null, contato: 'financeiro@horizonte.demo', observacao: 'Cliente fictício', created_at: now(), updated_at: now() },
      { id: cliente2, nome: 'Grupo Atlas', documento: null, contato: 'contato@atlas.demo', observacao: 'Cliente fictício', created_at: now(), updated_at: now() },
      { id: cliente3, nome: 'Clínica Aurora', documento: null, contato: 'diretoria@aurora.demo', observacao: 'Cliente fictício', created_at: now(), updated_at: now() },
    ],
    projetos: [
      { ...base, id: projeto1, cliente_id: cliente1, nome: 'Implantação CRM Flow', tipo: 'implantacao', origem_economica: 'Venda direta', responsavel_comercial: null, responsavel_execucao: null, originador_socio_id: socio1, responsavel_comercial_socio_id: socio1, responsavel_execucao_socio_id: socio2, status: 'ativo', observacao: 'Projeto demonstrativo' },
      { ...base, id: projeto2, cliente_id: cliente2, nome: 'Gestão 7Commander', tipo: 'recorrente', origem_economica: 'Contrato recorrente', responsavel_comercial: null, responsavel_execucao: null, originador_socio_id: socio1, responsavel_comercial_socio_id: socio1, responsavel_execucao_socio_id: socio1, status: 'ativo', observacao: 'Projeto demonstrativo' },
      { ...base, id: projeto3, cliente_id: cliente3, nome: 'Consultoria de Integrações', tipo: 'consultoria', origem_economica: 'Compartilhado', responsavel_comercial: null, responsavel_execucao: null, originador_socio_id: socio2, responsavel_comercial_socio_id: socio2, responsavel_execucao_socio_id: socio2, status: 'ativo', observacao: 'Projeto demonstrativo' },
    ],
    parametros_tributarios: [{ id: tributo, aliquota_percentual: 6, regime: 'Simples Nacional', tipo_receita: 'geral', vigencia_inicio: `${new Date().getFullYear()}-01-01`, vigencia_fim: null, observacao: 'Parâmetro demonstrativo', created_by: USER_ID, created_at: now() }],
    regras_distribuicao: [{ id: regra, escopo: 'default', projeto_id: null, percentual_empresa: 30, split_socios: [{ socio_id: socio1, percentual: 42 }, { socio_id: socio2, percentual: 28 }], vigencia_inicio: `${new Date().getFullYear()}-01-01`, vigencia_fim: null, observacao: 'Regra demonstrativa', created_by: USER_ID, created_at: now() }],
    receitas: [
      { ...base, id: 'demo-receita-1', projeto_id: projeto1, descricao: 'Parcela implantação', tipo: 'pontual', valor_bruto: 18000, status: 'recebido', data_prevista: date(5), data_fato_gerador: date(5), data_recebimento: date(7), parametro_tributario_id: tributo, aliquota_aplicada: 6, regra_distribuicao_id: regra, percentual_empresa_aplicado: 30, split_socios_aplicado: [{ socio_id: socio1, percentual: 42 }, { socio_id: socio2, percentual: 28 }], tributo_status: 'provisionado', tributo_pago_em: null, observacao: null, receita_origem_id: null, emite_nota: true, tem_retencao: false, percentual_retencao: 0, valor_retido: 0 },
      { ...base, id: 'demo-receita-2', projeto_id: projeto2, descricao: 'Mensalidade 7Commander', tipo: 'recorrente', valor_bruto: 7900, status: 'recebido', data_prevista: date(10), data_fato_gerador: date(10), data_recebimento: date(10), parametro_tributario_id: tributo, aliquota_aplicada: 6, regra_distribuicao_id: regra, percentual_empresa_aplicado: 30, split_socios_aplicado: [{ socio_id: socio1, percentual: 42 }, { socio_id: socio2, percentual: 28 }], tributo_status: 'provisionado', tributo_pago_em: null, observacao: null, receita_origem_id: null, emite_nota: true, tem_retencao: false, percentual_retencao: 0, valor_retido: 0 },
      { ...base, id: 'demo-receita-3', projeto_id: projeto3, descricao: 'Consultoria mensal', tipo: 'pontual', valor_bruto: 6200, status: 'previsto', data_prevista: date(28), data_fato_gerador: date(15), data_recebimento: null, parametro_tributario_id: tributo, aliquota_aplicada: 6, regra_distribuicao_id: regra, percentual_empresa_aplicado: 30, split_socios_aplicado: [{ socio_id: socio1, percentual: 42 }, { socio_id: socio2, percentual: 28 }], tributo_status: 'provisionado', tributo_pago_em: null, observacao: null, receita_origem_id: null, emite_nota: true, tem_retencao: false, percentual_retencao: 0, valor_retido: 0 },
    ],
    custos_projeto: [
      { ...base, id: 'demo-custo-1', projeto_id: projeto1, descricao: 'Desenvolvimento terceirizado', categoria: 'Prestador', valor: 3200, data: date(8), observacao: null, status: 'pago', data_pagamento: date(8) },
      { ...base, id: 'demo-custo-2', projeto_id: projeto3, descricao: 'Especialista integração', categoria: 'Prestador', valor: 1100, data: date(18), observacao: null, status: 'provisionado', data_pagamento: null },
    ],
    despesas: [
      { ...base, id: 'demo-despesa-1', categoria: 'Software', tipo: 'fixa', descricao: 'Ferramentas SaaS', valor: 980, projeto_id: null, competencia: `${month()}-01`, data_vencimento: date(12), data_pagamento: date(12), status: 'pago', observacao: 'Despesa fictícia' },
      { ...base, id: 'demo-despesa-2', categoria: 'Contabilidade', tipo: 'fixa', descricao: 'Contabilidade mensal', valor: 650, projeto_id: null, competencia: `${month()}-01`, data_vencimento: date(20), data_pagamento: null, status: 'provisionado', observacao: 'Despesa fictícia' },
    ],
    investimentos: [
      { ...base, id: 'demo-investimento-1', investidor_tipo: 'empresa', socio_id: null, projeto_id: projeto1, valor: 4500, data: date(1, -2), tipo: 'desenvolvimento', descricao: 'Evolução do produto', retorno_esperado: 12000, prazo_esperado_meses: 4, roi_meta_percentual: 80, considerado_no_resultado: false, data_encerramento: null, status: 'ativo' },
      { ...base, id: 'demo-investimento-2', investidor_tipo: 'socio', socio_id: socio1, projeto_id: projeto3, valor: 2500, data: date(1, -1), tipo: 'comercial', descricao: 'Prospecção e implantação', retorno_esperado: 6000, prazo_esperado_meses: 3, roi_meta_percentual: 60, considerado_no_resultado: false, data_encerramento: null, status: 'ativo' },
    ],
    assinaturas: [
      { ...base, id: 'demo-ass-1', cliente_id: cliente2, projeto_id: projeto2, nome: 'Plano Gestão', valor_mensal: 7900, dia_cobranca: 10, data_inicio: date(1, -5), data_fim: null, status: 'ativa' },
      { ...base, id: 'demo-ass-2', cliente_id: cliente1, projeto_id: projeto1, nome: 'Suporte CRM', valor_mensal: 2400, dia_cobranca: 5, data_inicio: date(1, -2), data_fim: null, status: 'ativa' },
    ],
    socio_lancamentos: [
      { id: 'demo-lanc-1', socio_id: socio1, tipo: 'credito_resultado', valor: 5200, projeto_id: projeto2, receita_id: 'demo-receita-2', fechamento_id: null, data: date(10), descricao: 'Resultado demonstrativo', created_by: USER_ID, created_at: now() },
      { id: 'demo-lanc-2', socio_id: socio2, tipo: 'credito_resultado', valor: 3400, projeto_id: projeto1, receita_id: 'demo-receita-1', fechamento_id: null, data: date(7), descricao: 'Resultado demonstrativo', created_by: USER_ID, created_at: now() },
    ],
    reserva_empresa_lancamentos: [{ id: 'demo-reserva-1', tipo: 'credito', valor: 9200, data: date(10), descricao: 'Reserva demonstrativa', created_by: USER_ID, created_at: now() }],
    fechamentos_mensais: [],
    receita_historico: [],
    financeiro_historico: [],
    investimento_historico: [],
    white_label_settings: [{ ...DEFAULT_BRAND, id: true, updated_at: now() }],
    orion_auditoria: [],
  };
}

function read(): Store {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try { return JSON.parse(raw) as Store; } catch { /* reseed */ }
  }
  const state = seed();
  write(state);
  return state;
}
function write(state: Store) { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
export function resetDemoData() { write(seed()); window.location.reload(); }

function rowsForTable(state: Store, table: string): Row[] {
  if (table === 'socios_diretorio') {
    return (state.socios ?? []).map(({ id, nome, tipo, ativo, data_entrada, data_saida }) => ({ id, nome, tipo, ativo, data_entrada, data_saida }));
  }
  return state[table] ?? [];
}

class Query {
  private filters: Array<(row: Row) => boolean> = [];
  private sorting: Array<{ field: string; asc: boolean }> = [];
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any;
  private one = false;
  private max?: number;
  constructor(private table: string) {}
  select(_columns = '*') { return this; }
  insert(value: any) { this.op = 'insert'; this.payload = value; return this; }
  update(value: any) { this.op = 'update'; this.payload = value; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(field: string, value: any) { this.filters.push(row => row[field] === value); return this; }
  neq(field: string, value: any) { this.filters.push(row => row[field] !== value); return this; }
  is(field: string, value: any) { return this.eq(field, value); }
  gte(field: string, value: any) { this.filters.push(row => row[field] >= value); return this; }
  lte(field: string, value: any) { this.filters.push(row => row[field] <= value); return this; }
  gt(field: string, value: any) { this.filters.push(row => row[field] > value); return this; }
  lt(field: string, value: any) { this.filters.push(row => row[field] < value); return this; }
  in(field: string, values: any[]) { this.filters.push(row => values.includes(row[field])); return this; }
  order(field: string, options?: { ascending?: boolean }) { this.sorting.push({ field, asc: options?.ascending !== false }); return this; }
  limit(value: number) { this.max = value; return this; }
  single() { this.one = true; return this.run(); }
  maybeSingle() { this.one = true; return this.run(); }
  then(ok: (value: any) => void, bad?: (error: any) => void) { return this.run().then(ok, bad); }
  private async run() {
    const state = read();
    const source = rowsForTable(state, this.table);
    const match = (row: Row) => this.filters.every(filter => filter(row));
    let out: Row[];
    if (this.op === 'insert') {
      out = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((row: Row) => ({ id: row.id ?? id(this.table), created_at: row.created_at ?? now(), updated_at: row.updated_at ?? now(), ...row }));
      state[this.table] = [...(state[this.table] ?? []), ...out];
      write(state);
    } else if (this.op === 'update') {
      state[this.table] = (state[this.table] ?? []).map(row => match(row) ? { ...row, ...this.payload, updated_at: now() } : row);
      out = rowsForTable(state, this.table).filter(match);
      write(state);
    } else if (this.op === 'delete') {
      out = source.filter(match);
      state[this.table] = (state[this.table] ?? []).filter(row => !match(row));
      write(state);
    } else {
      out = source.filter(match).map(row => ({ ...row }));
    }
    for (const sort of this.sorting.slice().reverse()) {
      out.sort((a, b) => String(a[sort.field] ?? '').localeCompare(String(b[sort.field] ?? '')) * (sort.asc ? 1 : -1));
    }
    if (this.max !== undefined) out = out.slice(0, this.max);
    return { data: this.one ? (out[0] ?? null) : out, error: null };
  }
}

function addHistory(state: Store, entity: string, row: Row, before: Row, action: string, reason?: string) {
  const common = { id: id('hist'), acao: action, dados_anteriores: before, dados_novos: { ...row }, motivo: reason ?? null, executado_por: USER_ID, executado_em: now() };
  if (entity === 'receita') state.receita_historico.push({ ...common, receita_id: row.id });
  else state.financeiro_historico.push({ ...common, entidade: entity, registro_id: row.id });
}

async function rpc(name: string, params: Row) {
  const state = read();
  const find = (table: string, rowId: string) => (state[table] ?? []).find(row => row.id === rowId);
  let returned: any = null;
  if (name === 'alterar_status_receita') {
    const row = find('receitas', params.p_receita_id); if (row) { const before = { ...row }; const map: Row = { receber: 'recebido', cancelar: 'cancelado', estornar_recebimento: 'previsto', reativar: 'previsto' }; row.status = map[params.p_acao]; row.data_recebimento = params.p_acao === 'receber' ? params.p_data : null; addHistory(state, 'receita', row, before, params.p_acao, params.p_motivo); }
  } else if (name === 'alterar_status_custo' || name === 'alterar_status_despesa') {
    const cost = name.includes('custo'); const table = cost ? 'custos_projeto' : 'despesas'; const row = find(table, params.p_id); if (row) { const before = { ...row }; const map: Row = { pagar: 'pago', estornar: 'provisionado', cancelar: 'cancelado', reativar: 'provisionado' }; row.status = map[params.p_acao]; row.data_pagamento = params.p_acao === 'pagar' ? params.p_data : null; addHistory(state, cost ? 'custo_projeto' : 'despesa', row, before, params.p_acao, params.p_motivo); }
  } else if (name === 'registrar_retirada_socio') {
    returned = { id: id('retirada'), socio_id: params.p_socio_id, tipo: 'retirada', valor: params.p_valor, projeto_id: null, receita_id: null, fechamento_id: null, data: params.p_data, descricao: params.p_descricao, created_by: USER_ID, created_at: now() }; state.socio_lancamentos.push(returned);
  } else if (name === 'fechar_mes') {
    returned = { id: id('fechamento'), competencia: params.p_competencia, status: 'fechado', fechado_em: now(), fechado_por: USER_ID, snapshot: params.p_snapshot, observacao: params.p_observacao, created_at: now() }; state.fechamentos_mensais.push(returned);
    (params.p_creditos ?? []).forEach((credit: Row) => state.socio_lancamentos.push({ id: id('credito'), socio_id: credit.socio_id, tipo: credit.valor >= 0 ? 'credito_resultado' : 'debito_ajuste', valor: Math.abs(credit.valor), projeto_id: null, receita_id: null, fechamento_id: returned.id, data: params.p_competencia, descricao: 'Resultado demonstrativo', created_by: USER_ID, created_at: now() }));
  } else if (name === 'alterar_status_investimento') {
    const row = find('investimentos', params.p_id); if (row) { const before = { ...row }; row.status = params.p_acao === 'cancelar' ? 'cancelado' : 'ativo'; row.updated_at = now(); state.investimento_historico.push({ id: id('hist-investimento'), investimento_id: row.id, acao: params.p_acao === 'cancelar' ? 'cancelamento' : 'reativacao', dados_anteriores: before, dados_novos: { ...row }, motivo: params.p_motivo, executado_por: USER_ID, executado_em: now() }); returned = { ...row }; }
  }
  write(state);
  return { data: returned, error: null };
}

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function demoOrion(message: string) {
  const state = read();
  const revenues = state.receitas.filter(r => r.status === 'recebido');
  const gross = revenues.reduce((total, r) => total + Number(r.valor_bruto || 0), 0);
  const taxes = revenues.reduce((total, r) => total + Number(r.valor_bruto || 0) * Number(r.aliquota_aplicada || 0) / 100, 0);
  const costs = state.custos_projeto.filter(r => r.status === 'pago').reduce((total, r) => total + Number(r.valor || 0), 0);
  const expenses = state.despesas.filter(r => r.status === 'pago').reduce((total, r) => total + Number(r.valor || 0), 0);
  const result = gross - taxes - costs - expenses;
  const pending = state.receitas.filter(r => r.status !== 'recebido' && r.status !== 'cancelado').reduce((total, r) => total + Number(r.valor_bruto || 0), 0);
  const mrr = state.assinaturas.filter(a => a.status === 'ativa').reduce((total, a) => total + Number(a.valor_mensal || 0), 0);
  const lower = message.toLowerCase();
  let response: string;
  let tools = ['get_dashboard_summary'];
  if (lower.includes('mrr') || lower.includes('recorr')) {
    tools = ['get_recurring_revenue'];
    response = `Fato: o MRR demonstrativo está em ${brl(mrr)}, equivalente a ARR de ${brl(mrr * 12)}.\n\nAnálise: a base recorrente reduz a dependência de projetos pontuais, mas ainda representa apenas parte da receita do mês.\n\nRecomendação: acompanhe a participação do MRR sobre o faturamento total e o ticket médio dos contratos ativos.`;
  } else if (lower.includes('margem') || lower.includes('resultado') || lower.includes('sobrou')) {
    const margin = gross > 0 ? result / gross * 100 : 0;
    tools = ['get_dre', 'get_dashboard_summary'];
    response = `Fato: no cenário demonstrativo, foram recebidos ${brl(gross)} e o resultado líquido realizado está em ${brl(result)}, com margem aproximada de ${margin.toFixed(1)}%.\n\nAnálise: impostos, custos diretos e despesas pagas são os principais redutores do resultado. Ainda existem ${brl(pending)} em receitas previstas não recebidas.\n\nRecomendação: acompanhe a conversão das receitas pendentes e os custos vinculados aos projetos antes do fechamento.`;
  } else if (lower.includes('fechar') || lower.includes('fechamento') || lower.includes('pronto')) {
    tools = ['get_close_readiness'];
    response = `Fato: a competência ainda possui ${brl(pending)} em receitas previstas e há lançamentos provisionados.\n\nAnálise: isso não impede necessariamente o fechamento, mas merece revisão para confirmar se os pendentes pertencem de fato à competência.\n\nRecomendação: valide receitas pendentes e despesas provisionadas antes de confirmar o fechamento.`;
  } else if (lower.includes('risco') || lower.includes('atenção')) {
    tools = ['get_dashboard_summary', 'get_overdue_items'];
    response = `Fato: o principal ponto de atenção do cenário é ${brl(pending)} em receita ainda não recebida.\n\nAnálise: a operação segue positiva, mas o atraso na conversão do previsto em realizado pode pressionar caixa e margem.\n\nRecomendação: priorize cobrança e revise os compromissos provisionados da competência.`;
  } else {
    response = `Fato: o 7Finance Demo registra ${brl(gross)} de receita realizada, ${brl(result)} de resultado líquido estimado e ${brl(mrr)} de MRR.\n\nAnálise: o cenário está positivo, com receitas recorrentes e projetos pontuais compondo o resultado.\n\nRecomendação: use as perguntas sugeridas para explorar margem, MRR, riscos e preparação do fechamento.\n\nEsta resposta usa exclusivamente dados fictícios do ambiente de demonstração.`;
  }
  return { resposta: response, toolsUsadas: tools };
}

const listeners = new Set<(event: string, session: Session | null) => void>();
function session(): Session {
  const user = { id: USER_ID, email: 'demo@7finance.app', app_metadata: {}, user_metadata: { nome: 'Visitante da demonstração' }, aud: 'authenticated', created_at: now() } as User;
  return { access_token: 'demo-local', refresh_token: 'demo-local', expires_in: 31536000, token_type: 'bearer', user } as Session;
}

export const demoSupabase: any = {
  from: (table: string) => new Query(table),
  rpc,
  functions: {
    invoke: async (name: string, options?: { body?: any }) => {
      if (name !== 'orion') return { data: null, error: { message: `Função ${name} não disponível no modo demonstração.` } };
      return { data: demoOrion(String(options?.body?.mensagem ?? '')), error: null };
    },
  },
  auth: {
    getSession: async () => ({ data: { session: session() } }),
    signInWithPassword: async () => ({ data: { session: session() }, error: null }),
    signUp: async () => ({ data: { user: session().user }, error: null }),
    signOut: async () => { listeners.forEach(listener => listener('SIGNED_OUT', null)); return { error: null }; },
    onAuthStateChange: (callback: any) => { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }; },
  },
  storage: {
    from: () => ({
      upload: async (_path: string, file: File) => {
        const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
        localStorage.setItem('7finance.demo.logo.v2', url);
        return { data: { path: 'demo-logo' }, error: null };
      },
      getPublicUrl: () => ({ data: { publicUrl: localStorage.getItem('7finance.demo.logo.v2') ?? DEFAULT_BRAND.logo_url } }),
    }),
  },
};
