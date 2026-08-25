// Camada central de capabilities do 7Finance.
//
// Objetivo: parar de espalhar `profile.papel === 'admin'` pelas telas e
// concentrar em um único lugar o que cada perfil pode ver/fazer no
// frontend. Isso é proteção de UX apenas — a barreira definitiva continua
// sendo RLS/RPC no Supabase (ver supabase/migrations e
// docs/01-architecture/AUTHORIZATION.md na branch docs/7finance-specs).
//
// Ao adicionar uma capability nova:
// 1. inclua na união `Capability`;
// 2. decida quais papéis a recebem em `ROLE_CAPABILITIES`;
// 3. se a ação grava dado sensível, confirme que a RLS/RPC correspondente
//    também bloqueia quem não deveria escrever (a UI não substitui isso).

import type { Papel, Profile } from '../types/database';

export type Capability =
  | 'view_dashboard'
  | 'view_financials'
  | 'manage_financials'
  | 'view_projects'
  | 'manage_projects'
  | 'view_revenues'
  | 'manage_revenues'
  | 'view_expenses'
  | 'manage_expenses'
  | 'mark_expense_paid'
  | 'reverse_expense_payment'
  | 'view_partners'
  | 'manage_partners'
  | 'view_partner_account'
  | 'register_partner_withdrawal'
  | 'view_investments'
  | 'manage_investments'
  | 'view_simulator'
  | 'view_closing'
  | 'close_period'
  | 'reopen_period'
  | 'view_parameters'
  | 'manage_financial_parameters'
  | 'manage_brand'
  | 'manage_users'
  | 'use_orion'
  | 'orion_write_actions';

export const ALL_CAPABILITIES: Capability[] = [
  'view_dashboard',
  'view_financials',
  'manage_financials',
  'view_projects',
  'manage_projects',
  'view_revenues',
  'manage_revenues',
  'view_expenses',
  'manage_expenses',
  'mark_expense_paid',
  'reverse_expense_payment',
  'view_partners',
  'manage_partners',
  'view_partner_account',
  'register_partner_withdrawal',
  'view_investments',
  'manage_investments',
  'view_simulator',
  'view_closing',
  'close_period',
  'reopen_period',
  'view_parameters',
  'manage_financial_parameters',
  'manage_brand',
  'manage_users',
  'use_orion',
  'orion_write_actions',
];

// Somente leitura, disponível a qualquer perfil ativo. Mantido separado
// para deixar claro no mapa abaixo o que é "base" e o que é diferencial
// de cada papel.
const LEITURA_BASE: Capability[] = [
  'view_dashboard',
  'view_financials',
  'view_projects',
  'view_revenues',
  'view_expenses',
  'view_partners',
  'view_investments',
  'view_simulator',
  'view_closing',
  'view_parameters',
  'use_orion',
];

// Mapa papel -> capabilities. Reflete o que a RLS de
// supabase/migrations/0004_operacao_financeira_segura.sql já impõe hoje
// (private.pode_operar_financeiro() libera escrita para admin e
// financeiro; private.eh_admin() é exigida para identidade/perfis):
// mudar este mapa não muda o que o banco aceita, só o que a UI oferece.
export const ROLE_CAPABILITIES: Record<Papel, Capability[]> = {
  admin: ALL_CAPABILITIES,

  financeiro: [
    ...LEITURA_BASE,
    'manage_financials',
    'manage_projects',
    'manage_revenues',
    'manage_expenses',
    'mark_expense_paid',
    'reverse_expense_payment',
    'manage_partners',
    'view_partner_account',
    'register_partner_withdrawal',
    'manage_investments',
    'close_period',
    'manage_financial_parameters',
    // Não recebe: reopen_period, manage_brand, manage_users,
    // orion_write_actions — administração de identidade/acesso e
    // reabertura de competência exigem admin.
  ],

  socio: [
    ...LEITURA_BASE,
    'view_partner_account',
    // Acesso analítico/societário. Não herda escrita financeira.
  ],

  consulta: [
    ...LEITURA_BASE,
    // Somente leitura das áreas autorizadas; sem visão de conta corrente
    // de sócios nem qualquer ação de escrita.
  ],
};

/** Todas as capabilities atribuídas a um papel (ou lista vazia). */
export function capabilitiesDoPapel(papel: Papel | null | undefined): Capability[] {
  if (!papel) return [];
  return ROLE_CAPABILITIES[papel] ?? [];
}

/** Versão "crua": não considera se o profile está ativo. */
export function hasCapability(papel: Papel | null | undefined, capability: Capability): boolean {
  return capabilitiesDoPapel(papel).includes(capability);
}

/**
 * Checagem central de autorização no frontend.
 *
 * `can(profile, 'manage_financials')` — usar em vez de comparar
 * `profile.papel` diretamente em componentes de página.
 *
 * Um profile inativo nunca tem capability nenhuma, mesmo que o papel
 * cadastrado normalmente teria — condição de novos logins
 * (handle_new_user cria como 'consulta' + ativo=false).
 */
export function can(
  profile: Pick<Profile, 'papel' | 'ativo'> | null | undefined,
  capability: Capability
): boolean {
  if (!profile || !profile.ativo) return false;
  return hasCapability(profile.papel, capability);
}
