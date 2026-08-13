import { supabase } from '../lib/supabaseClient';
import type { Profile } from '../types/database';
import { assertNoError } from './base';

export const profilesService = {
  async listarSocios(): Promise<Profile[]> {
    const { data, error } = await supabase.from('profiles').select('*').eq('ativo', true).order('nome');
    return assertNoError(data, error, 'listar sócios') as Profile[];
  },

  /** Inclui sócios desativados — usado na tela de gestão de sócios. */
  async listarTodos(): Promise<Profile[]> {
    const { data, error } = await supabase.from('profiles').select('*').order('ativo', { ascending: false }).order('nome');
    return assertNoError(data, error, 'listar todos os sócios') as Profile[];
  },

  async obter(id: string): Promise<Profile | null> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`obter perfil: ${error.message}`);
    return data as Profile | null;
  },

  async atualizarNome(id: string, nome: string): Promise<void> {
    const { error } = await supabase.from('profiles').update({ nome }).eq('id', id);
    if (error) throw new Error(`atualizar perfil: ${error.message}`);
  },

  /** Qualquer sócio ativo pode editar o cadastro de qualquer outro (RLS: profiles_update). */
  async atualizarDadosCadastrais(
    id: string,
    dados: { nome: string; cpf: string | null; chavePix: string | null }
  ): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ nome: dados.nome, cpf: dados.cpf, chave_pix: dados.chavePix })
      .eq('id', id);
    if (error) throw new Error(`atualizar dados cadastrais do sócio: ${error.message}`);
  },

  /**
   * "Excluir" um sócio é sempre desativação (ativo = false), nunca
   * DELETE físico — profiles é referenciado por receitas, custos,
   * despesas, investimentos, conta corrente e regras de distribuição.
   * Desativar tira o sócio das listas de seleção para lançamentos
   * novos, sem apagar nada do histórico já registrado.
   */
  async desativar(id: string): Promise<void> {
    const { error } = await supabase.from('profiles').update({ ativo: false }).eq('id', id);
    if (error) throw new Error(`desativar sócio: ${error.message}`);
  },

  async reativar(id: string): Promise<void> {
    const { error } = await supabase.from('profiles').update({ ativo: true }).eq('id', id);
    if (error) throw new Error(`reativar sócio: ${error.message}`);
  },
};
