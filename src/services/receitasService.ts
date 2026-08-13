import { supabase } from '../lib/supabaseClient';
import type { Receita, ReceitaHistorico } from '../types/database';
import { montarSnapshotReceita } from '../lib/motorCalculo';
import { assertNoError } from './base';

export const receitasService = {
  async listarHistorico(receitaId: string): Promise<ReceitaHistorico[]> {
    const { data, error } = await supabase.from('receita_historico').select('*').eq('receita_id', receitaId).order('executado_em', { ascending: false });
    return assertNoError(data, error, 'listar histórico da receita') as ReceitaHistorico[];
  },
  async listar(): Promise<Receita[]> {
    const { data, error } = await supabase.from('receitas').select('*').order('data_fato_gerador', { ascending: false });
    return assertNoError(data, error, 'listar receitas') as Receita[];
  },

  async listarPorProjeto(projetoId: string): Promise<Receita[]> {
    const { data, error } = await supabase
      .from('receitas')
      .select('*')
      .eq('projeto_id', projetoId)
      .order('data_fato_gerador', { ascending: false });
    return assertNoError(data, error, 'listar receitas do projeto') as Receita[];
  },

  async listarPorPeriodo(inicio: string, fim: string): Promise<Receita[]> {
    const { data, error } = await supabase
      .from('receitas')
      .select('*')
      .gte('data_fato_gerador', inicio)
      .lte('data_fato_gerador', fim);
    return assertNoError(data, error, 'listar receitas do período') as Receita[];
  },

  /**
   * Cadastra uma nova receita. Antes de gravar, resolve o parâmetro
   * tributário e a regra de distribuição VIGENTES na data do fato
   * gerador e grava esse snapshot junto da receita — é isso que torna
   * o fechamento imune a mudanças futuras de parâmetro.
   */
  async criar(input: {
    projetoId: string;
    descricao: string;
    tipo: Receita['tipo'];
    valorBruto: number;
    dataPrevista: string;
    dataFatoGerador: string;
    tipoParaTributo?: string;
    observacao?: string;
    createdBy: string;
    emiteNota: boolean;
    temRetencao: boolean;
    percentualRetencao: number;
  }): Promise<Receita> {
    const [{ data: tributos, error: errTributos }, { data: regras, error: errRegras }] = await Promise.all([
      supabase.from('parametros_tributarios').select('*'),
      supabase.from('regras_distribuicao').select('*'),
    ]);
    if (errTributos) throw new Error(`carregar parâmetros tributários: ${errTributos.message}`);
    if (errRegras) throw new Error(`carregar regras de distribuição: ${errRegras.message}`);

    const snapshot = montarSnapshotReceita(
      input.dataFatoGerador,
      input.projetoId,
      tributos ?? [],
      regras ?? [],
      input.tipoParaTributo ?? 'geral'
    );
    if (!input.emiteNota) {
      snapshot.parametro_tributario_id = null;
      snapshot.aliquota_aplicada = 0;
    }

    if (!snapshot.regra_distribuicao_id) {
      throw new Error(
        'Nenhuma regra de distribuição vigente encontrada (nem específica do projeto, nem default). Cadastre uma em Parâmetros antes de lançar receitas.'
      );
    }

    const { data, error } = await supabase
      .from('receitas')
      .insert({
        projeto_id: input.projetoId,
        descricao: input.descricao,
        tipo: input.tipo,
        valor_bruto: input.valorBruto,
        status: 'previsto',
        data_prevista: input.dataPrevista,
        data_fato_gerador: input.dataFatoGerador,
        parametro_tributario_id: snapshot.parametro_tributario_id,
        aliquota_aplicada: snapshot.aliquota_aplicada,
        regra_distribuicao_id: snapshot.regra_distribuicao_id,
        percentual_empresa_aplicado: snapshot.percentual_empresa_aplicado,
        split_socios_aplicado: snapshot.split_socios_aplicado,
        observacao: input.observacao ?? null,
        created_by: input.createdBy,
        emite_nota: input.emiteNota,
        tem_retencao: input.emiteNota && input.temRetencao,
        percentual_retencao: input.emiteNota && input.temRetencao ? input.percentualRetencao : 0,
        valor_retido: input.emiteNota && input.temRetencao ? Number(((input.valorBruto * input.percentualRetencao) / 100).toFixed(2)) : 0,
      })
      .select('*')
      .single();

    return assertNoError(data, error, 'criar receita') as Receita;
  },

  async marcarRecebida(id: string, dataRecebimento: string): Promise<void> {
    const { error } = await supabase.rpc('alterar_status_receita', { p_receita_id: id, p_acao: 'receber', p_data: dataRecebimento, p_motivo: null });
    if (error) throw new Error(`marcar receita como recebida: ${error.message}`);
  },

  async editar(receita: Receita, input: { descricao: string; tipo: Receita['tipo']; valorBruto: number; dataPrevista: string; dataFatoGerador: string; motivo: string; emiteNota: boolean; temRetencao: boolean; percentualRetencao: number }): Promise<void> {
    const [{ data: tributos, error: et }, { data: regras, error: er }] = await Promise.all([
      supabase.from('parametros_tributarios').select('*'), supabase.from('regras_distribuicao').select('*'),
    ]);
    if (et) throw et; if (er) throw er;
    const snapshot = montarSnapshotReceita(input.dataFatoGerador, receita.projeto_id, tributos ?? [], regras ?? []);
    if (!input.emiteNota) { snapshot.parametro_tributario_id = null; snapshot.aliquota_aplicada = 0; }
    const { error } = await supabase.rpc('editar_receita', {
      p_receita_id: receita.id, p_descricao: input.descricao, p_tipo: input.tipo,
      p_valor_bruto: input.valorBruto, p_data_prevista: input.dataPrevista,
      p_data_fato_gerador: input.dataFatoGerador, p_motivo: input.motivo,
      p_parametro_tributario_id: snapshot.parametro_tributario_id, p_aliquota_aplicada: snapshot.aliquota_aplicada,
      p_regra_distribuicao_id: snapshot.regra_distribuicao_id,
      p_percentual_empresa_aplicado: snapshot.percentual_empresa_aplicado,
      p_split_socios_aplicado: snapshot.split_socios_aplicado,
      p_emite_nota: input.emiteNota,
      p_tem_retencao: input.emiteNota && input.temRetencao,
      p_percentual_retencao: input.emiteNota && input.temRetencao ? input.percentualRetencao : 0,
    });
    if (error) throw new Error(`editar receita: ${error.message}`);
  },

  async cancelar(id: string, motivo: string): Promise<void> {
    const { error } = await supabase.rpc('alterar_status_receita', { p_receita_id: id, p_acao: 'cancelar', p_data: hojeIso(), p_motivo: motivo });
    if (error) throw new Error(`cancelar receita: ${error.message}`);
  },

  async estornarRecebimento(id: string, motivo: string): Promise<void> {
    const { error } = await supabase.rpc('alterar_status_receita', { p_receita_id: id, p_acao: 'estornar_recebimento', p_data: hojeIso(), p_motivo: motivo });
    if (error) throw new Error(`estornar recebimento: ${error.message}`);
  },

  async reativar(id: string, motivo: string): Promise<void> {
    const { error } = await supabase.rpc('alterar_status_receita', { p_receita_id: id, p_acao: 'reativar', p_data: hojeIso(), p_motivo: motivo });
    if (error) throw new Error(`reativar receita: ${error.message}`);
  },

  async corrigirFechada(id: string, valorCorreto: number, motivo: string): Promise<void> {
    const { error } = await supabase.rpc('corrigir_receita_fechada', { p_receita_id: id, p_valor_correto: valorCorreto, p_motivo: motivo });
    if (error) throw new Error(`corrigir receita fechada: ${error.message}`);
  },

  async atualizarStatus(id: string, status: Receita['status']): Promise<void> {
    const { error } = await supabase.from('receitas').update({ status }).eq('id', id);
    if (error) throw new Error(`atualizar status da receita: ${error.message}`);
  },

  async marcarTributoPago(id: string, dataPagamento: string): Promise<void> {
    const { error } = await supabase
      .from('receitas')
      .update({ tributo_status: 'pago', tributo_pago_em: dataPagamento })
      .eq('id', id);
    if (error) throw new Error(`marcar tributo como pago: ${error.message}`);
  },
};

function hojeIso(): string { return new Date().toISOString().slice(0, 10); }
