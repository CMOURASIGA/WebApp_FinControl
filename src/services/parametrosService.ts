// Serviço de Parâmetros Configuráveis: tributação, regra de
// distribuição (default e por projeto) e meta pessoal. Todos seguem o
// mesmo padrão: nunca dá UPDATE no valor vigente — encerra a vigência
// atual (vigencia_fim) e insere uma linha nova. Isso preserva o
// histórico e garante que fechamentos passados não sejam recalculados
// silenciosamente quando o parâmetro muda.

import { supabase } from '../lib/supabaseClient';
import type { ParametroPessoal, ParametroTributario, RegraDistribuicao, SplitSocio } from '../types/database';
import { assertNoError } from './base';

function diaAnterior(dataISO: string): string {
  const d = new Date(`${dataISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const parametrosService = {
  // ---------------- Tributação ----------------
  async listarTributarios(tipoReceita = 'geral'): Promise<ParametroTributario[]> {
    const { data, error } = await supabase
      .from('parametros_tributarios')
      .select('*')
      .eq('tipo_receita', tipoReceita)
      .order('vigencia_inicio', { ascending: false });
    return assertNoError(data, error, 'listar parâmetros tributários') as ParametroTributario[];
  },

  async listarTodosTributarios(): Promise<ParametroTributario[]> {
    const { data, error } = await supabase
      .from('parametros_tributarios')
      .select('*')
      .order('vigencia_inicio', { ascending: false });
    return assertNoError(data, error, 'listar parâmetros tributários') as ParametroTributario[];
  },

  async definirNovaAliquota(input: {
    aliquotaPercentual: number;
    regime: string;
    tipoReceita?: string;
    vigenciaInicio: string;
    observacao?: string;
    createdBy: string;
  }): Promise<ParametroTributario> {
    const tipoReceita = input.tipoReceita ?? 'geral';

    const { data: atual } = await supabase
      .from('parametros_tributarios')
      .select('id, vigencia_inicio')
      .eq('tipo_receita', tipoReceita)
      .is('vigencia_fim', null)
      .maybeSingle();

    if (atual) {
      await supabase
        .from('parametros_tributarios')
        .update({ vigencia_fim: diaAnterior(input.vigenciaInicio) })
        .eq('id', atual.id);
    }

    const { data, error } = await supabase
      .from('parametros_tributarios')
      .insert({
        aliquota_percentual: input.aliquotaPercentual,
        regime: input.regime,
        tipo_receita: tipoReceita,
        vigencia_inicio: input.vigenciaInicio,
        vigencia_fim: null,
        observacao: input.observacao ?? null,
        created_by: input.createdBy,
      })
      .select('*')
      .single();

    return assertNoError(data, error, 'definir nova alíquota') as ParametroTributario;
  },

  // ---------------- Regra de distribuição ----------------
  async listarRegrasDistribuicao(): Promise<RegraDistribuicao[]> {
    const { data, error } = await supabase
      .from('regras_distribuicao')
      .select('*')
      .order('vigencia_inicio', { ascending: false });
    return assertNoError(data, error, 'listar regras de distribuição') as RegraDistribuicao[];
  },

  async definirNovaRegraDistribuicao(input: {
    escopo: 'default' | 'projeto';
    projetoId?: string | null;
    percentualEmpresa: number;
    splitSocios: SplitSocio[];
    vigenciaInicio: string;
    observacao?: string;
    createdBy: string;
  }): Promise<RegraDistribuicao> {
    const somaSplit = input.splitSocios.reduce((acc, s) => acc + s.percentual, 0);
    if (Math.abs(input.percentualEmpresa + somaSplit - 100) > 0.01) {
      throw new Error('percentual_empresa + soma(split_socios) deve ser 100');
    }

    let query = supabase.from('regras_distribuicao').select('id').is('vigencia_fim', null).eq('escopo', input.escopo);
    query = input.escopo === 'projeto' ? query.eq('projeto_id', input.projetoId ?? '') : query.is('projeto_id', null);
    const { data: atual } = await query.maybeSingle();

    if (atual) {
      await supabase
        .from('regras_distribuicao')
        .update({ vigencia_fim: diaAnterior(input.vigenciaInicio) })
        .eq('id', atual.id);
    }

    const { data, error } = await supabase
      .from('regras_distribuicao')
      .insert({
        escopo: input.escopo,
        projeto_id: input.escopo === 'projeto' ? input.projetoId : null,
        percentual_empresa: input.percentualEmpresa,
        split_socios: input.splitSocios,
        vigencia_inicio: input.vigenciaInicio,
        vigencia_fim: null,
        observacao: input.observacao ?? null,
        created_by: input.createdBy,
      })
      .select('*')
      .single();

    return assertNoError(data, error, 'definir nova regra de distribuição') as RegraDistribuicao;
  },

  // ---------------- Meta pessoal ----------------
  async listarMetasPessoais(): Promise<ParametroPessoal[]> {
    const { data, error } = await supabase
      .from('parametros_pessoais')
      .select('*')
      .order('vigencia_inicio', { ascending: false });
    return assertNoError(data, error, 'listar metas pessoais') as ParametroPessoal[];
  },

  async definirNovaMetaPessoal(input: {
    socioId: string;
    metaLiquidaMensal: number;
    vigenciaInicio: string;
    observacao?: string;
    createdBy: string;
  }): Promise<ParametroPessoal> {
    const { data: atual } = await supabase
      .from('parametros_pessoais')
      .select('id')
      .eq('socio_id', input.socioId)
      .is('vigencia_fim', null)
      .maybeSingle();

    if (atual) {
      await supabase
        .from('parametros_pessoais')
        .update({ vigencia_fim: diaAnterior(input.vigenciaInicio) })
        .eq('id', atual.id);
    }

    const { data, error } = await supabase
      .from('parametros_pessoais')
      .insert({
        socio_id: input.socioId,
        meta_liquida_mensal: input.metaLiquidaMensal,
        vigencia_inicio: input.vigenciaInicio,
        vigencia_fim: null,
        observacao: input.observacao ?? null,
        created_by: input.createdBy,
      })
      .select('*')
      .single();

    return assertNoError(data, error, 'definir nova meta pessoal') as ParametroPessoal;
  },
};
