import { supabase } from '../lib/supabaseClient';
import type { FechamentoMensal } from '../types/database';
import { relatoriosService } from './relatoriosService';
import { assertNoError } from './base';

function primeiroDiaMes(competencia: string): string {
  return `${competencia.slice(0, 7)}-01`;
}

function ultimoDiaMes(competencia: string): string {
  const [ano, mes] = competencia.slice(0, 7).split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${competencia.slice(0, 7)}-${String(ultimo).padStart(2, '0')}`;
}

export const fechamentoService = {
  async listar(): Promise<FechamentoMensal[]> {
    const { data, error } = await supabase.from('fechamentos_mensais').select('*').order('competencia', { ascending: false });
    return assertNoError(data, error, 'listar fechamentos') as FechamentoMensal[];
  },

  async obterPorCompetencia(competencia: string): Promise<FechamentoMensal | null> {
    const { data, error } = await supabase
      .from('fechamentos_mensais')
      .select('*')
      .eq('competencia', primeiroDiaMes(competencia))
      .maybeSingle();
    if (error) throw new Error(`obter fechamento: ${error.message}`);
    return data as FechamentoMensal | null;
  },

  /**
   * Fecha um mês: apura a DRE do período, credita o resultado de cada
   * sócio na respectiva conta corrente e trava o registro. Um mês já
   * fechado não pode ser fechado de novo — a "regra de ouro" é que
   * mudanças de parâmetro depois disso não afetam o que já foi
   * apurado, porque cada receita carrega seu próprio snapshot.
   */
  async fecharMes(competencia: string, _userId: string, observacao?: string): Promise<FechamentoMensal> {
    const inicio = primeiroDiaMes(competencia);
    const fim = ultimoDiaMes(competencia);

    const existente = await this.obterPorCompetencia(competencia);
    if (existente?.status === 'fechado') {
      throw new Error(`Competência ${inicio} já está fechada.`);
    }

    const dre = await relatoriosService.montarDRE(inicio, fim, true);

    const snapshot = {
      receitaBruta: dre.consolidadoProjetos.receitaBruta,
      tributoProvisionado: dre.consolidadoProjetos.tributoProvisionado,
      custosDiretos: dre.consolidadoProjetos.custosDiretos,
      despesasAtribuidas: dre.consolidadoProjetos.despesasAtribuidas,
      despesasCorporativas: dre.despesasCorporativas,
      resultadoLiquido: dre.consolidadoProjetos.resultadoLiquido,
      valorEmpresa: dre.consolidadoProjetos.valorEmpresa,
      valorEmpresaLiquido: dre.valorEmpresaLiquido,
      porSocio: dre.consolidadoProjetos.porSocio,
      projetos: dre.porProjeto.map((p) => ({ projetoId: p.projeto.id, nome: p.projeto.nome, resultado: p.resultado })),
    };

    const creditos = Object.entries(dre.consolidadoProjetos.porSocio)
      .filter(([, valor]) => valor !== 0)
      .map(([socio_id, valor]) => ({ socio_id, valor }));
    const { data, error } = await supabase.rpc('fechar_mes', {
      p_competencia: inicio,
      p_snapshot: snapshot,
      p_creditos: creditos,
      p_observacao: observacao ?? null,
    });

    return assertNoError(data, error, 'fechar mês') as FechamentoMensal;
  },
};
