import { supabase } from '../lib/supabaseClient';
import type { Receita } from '../types/database';
import { montarSnapshotReceita } from '../lib/motorCalculo';
import { assertNoError } from './base';

export const receitasService = {
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
      })
      .select('*')
      .single();

    return assertNoError(data, error, 'criar receita') as Receita;
  },

  async marcarRecebida(id: string, dataRecebimento: string): Promise<void> {
    const { error } = await supabase
      .from('receitas')
      .update({ status: 'recebido', data_recebimento: dataRecebimento })
      .eq('id', id);
    if (error) throw new Error(`marcar receita como recebida: ${error.message}`);
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
