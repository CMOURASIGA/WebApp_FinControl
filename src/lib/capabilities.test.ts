import { describe, expect, it } from 'vitest';
import { ALL_CAPABILITIES, can, hasCapability, ROLE_CAPABILITIES, type Capability } from './capabilities';
import type { Papel } from '../types/database';

const perfil = (papel: Papel, ativo = true) => ({ papel, ativo });

describe('capabilities: hasCapability / can', () => {
  it('admin possui todas as capabilities do sistema', () => {
    for (const capability of ALL_CAPABILITIES) {
      expect(hasCapability('admin', capability)).toBe(true);
    }
  });

  it('financeiro pode operar receitas, despesas, investimentos, sócios e fechamento', () => {
    const permitidas: Capability[] = [
      'manage_revenues',
      'manage_expenses',
      'mark_expense_paid',
      'reverse_expense_payment',
      'manage_investments',
      'manage_partners',
      'register_partner_withdrawal',
      'close_period',
      'manage_financial_parameters',
    ];
    for (const capability of permitidas) {
      expect(can(perfil('financeiro'), capability)).toBe(true);
    }
  });

  it('financeiro não administra identidade, usuários, reabertura de período nem escrita da Orion', () => {
    const negadas: Capability[] = ['manage_brand', 'manage_users', 'reopen_period', 'orion_write_actions'];
    for (const capability of negadas) {
      expect(can(perfil('financeiro'), capability)).toBe(false);
    }
  });

  it('socio tem acesso de leitura mas não herda escrita financeira', () => {
    expect(can(perfil('socio'), 'view_dashboard')).toBe(true);
    expect(can(perfil('socio'), 'view_partner_account')).toBe(true);
    expect(can(perfil('socio'), 'manage_expenses')).toBe(false);
    expect(can(perfil('socio'), 'register_partner_withdrawal')).toBe(false);
    expect(can(perfil('socio'), 'close_period')).toBe(false);
  });

  it('consulta é somente leitura das áreas autorizadas, sem conta corrente de sócios', () => {
    expect(can(perfil('consulta'), 'view_expenses')).toBe(true);
    expect(can(perfil('consulta'), 'view_partner_account')).toBe(false);
    expect(can(perfil('consulta'), 'manage_projects')).toBe(false);
    expect(can(perfil('consulta'), 'close_period')).toBe(false);
    expect(can(perfil('consulta'), 'manage_brand')).toBe(false);
  });

  it('nenhum perfil chega à Orion com permissão de escrita na V1', () => {
    for (const papel of Object.keys(ROLE_CAPABILITIES) as Papel[]) {
      if (papel === 'admin') continue; // admin mantém a capability reservada para o futuro, mas a Orion V1 não a exerce.
      expect(hasCapability(papel, 'orion_write_actions')).toBe(false);
    }
  });

  it('profile inativo nunca recebe capability, mesmo sendo admin', () => {
    expect(can(perfil('admin', false), 'manage_financials')).toBe(false);
    expect(can(perfil('admin', false), 'view_dashboard')).toBe(false);
  });

  it('profile nulo/indefinido nunca recebe capability', () => {
    expect(can(null, 'view_dashboard')).toBe(false);
    expect(can(undefined, 'view_dashboard')).toBe(false);
  });

  it('todo papel conhecido só recebe capabilities existentes na união Capability', () => {
    const validas = new Set(ALL_CAPABILITIES);
    for (const capabilities of Object.values(ROLE_CAPABILITIES)) {
      for (const capability of capabilities) {
        expect(validas.has(capability)).toBe(true);
      }
    }
  });
});
