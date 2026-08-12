import { supabase } from '../lib/supabaseClient';
import type { ReservaEmpresaLancamento, SocioLancamento } from '../types/database';
import { assertNoError } from './base';

export const socioService = {
  async listarLancamentos(socioId: string): Promise<SocioLancamento[]> {
    const { data, error } = await supabase
      .from('socio_lancamentos')
      .select('*')
      .eq('socio_id', socioId)
      .order('data', { ascending: false });
    return assertNoError(data, error, 'listar lançamentos do sócio') as SocioLancamento[];
  },

  async listarTodos(): Promise<SocioLancamento[]> {
    const { data, error } = await supabase.from('socio_lancamentos').select('*').order('data', { ascending: false });
    return assertNoError(data, error, 'listar lançamentos dos sócios') as SocioLancamento[];
  },

  /** Saldo da conta corrente = créditos de resultado + reembolsos - retiradas - ajustes negativos. */
  calcularSaldo(lancamentos: SocioLancamento[]): number {
    return round2(
      lancamentos.reduce((acc, l) => {
        const sinal = l.tipo === 'retirada' ? -1 : 1;
        return acc + sinal * l.valor;
      }, 0)
    );
  },

  async registrarCredito(input: {
    socioId: string;
    valor: number;
    data: string;
    projetoId?: string | null;
    receitaId?: string | null;
    descricao?: string;
    createdBy: string;
  }): Promise<SocioLancamento> {
    return this.registrar({ ...input, tipo: 'credito_resultado' });
  },

  async registrarRetirada(input: {
    socioId: string;
    valor: number;
    data: string;
    descricao?: string;
    createdBy: string;
  }): Promise<SocioLancamento> {
    return this.registrar({ ...input, tipo: 'retirada' });
  },

  async registrar(input: {
    socioId: string;
    tipo: SocioLancamento['tipo'];
    valor: number;
    data: string;
    projetoId?: string | null;
    receitaId?: string | null;
    descricao?: string;
    createdBy: string;
  }): Promise<SocioLancamento> {
    const { data, error } = await supabase
      .from('socio_lancamentos')
      .insert({
        socio_id: input.socioId,
        tipo: input.tipo,
        valor: input.valor,
        projeto_id: input.projetoId ?? null,
        receita_id: input.receitaId ?? null,
        data: input.data,
        descricao: input.descricao ?? null,
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    return assertNoError(data, error, 'registrar lançamento do sócio') as SocioLancamento;
  },
};

export const reservaEmpresaService = {
  async listar(): Promise<ReservaEmpresaLancamento[]> {
    const { data, error } = await supabase
      .from('reserva_empresa_lancamentos')
      .select('*')
      .order('data', { ascending: false });
    return assertNoError(data, error, 'listar lançamentos da reserva da empresa') as ReservaEmpresaLancamento[];
  },

  calcularSaldo(lancamentos: ReservaEmpresaLancamento[]): number {
    return round2(
      lancamentos.reduce((acc, l) => acc + (l.tipo === 'aporte' ? l.valor : -l.valor), 0)
    );
  },

  async registrar(input: {
    tipo: ReservaEmpresaLancamento['tipo'];
    valor: number;
    data: string;
    descricao?: string;
    createdBy: string;
  }): Promise<ReservaEmpresaLancamento> {
    const { data, error } = await supabase
      .from('reserva_empresa_lancamentos')
      .insert({
        tipo: input.tipo,
        valor: input.valor,
        data: input.data,
        descricao: input.descricao ?? null,
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    return assertNoError(data, error, 'registrar lançamento da reserva da empresa') as ReservaEmpresaLancamento;
  },
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
