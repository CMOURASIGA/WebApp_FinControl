import { supabase } from '../lib/supabaseClient';
import type { Socio, SocioDiretorio } from '../types/database';
import { assertNoError } from './base';

export const sociosService = {
  /**
   * Cadastro completo (inclui CPF/PIX/e-mail/telefone) — RLS (migration
   * 0013) só devolve linha inteira para admin, financeiro ou o próprio
   * sócio. Use somente na tela de gestão de sócios (SociosPage); todo
   * o resto do app deve usar listarDiretorioAtivos/listarDiretorioTodos.
   */
  async listarAtivos(): Promise<Socio[]> {
    const { data, error } = await supabase.from('socios').select('*').eq('ativo', true).order('nome');
    return assertNoError(data, error, 'listar sócios') as Socio[];
  },

  async listarTodos(): Promise<Socio[]> {
    const { data, error } = await supabase.from('socios').select('*').order('ativo', { ascending: false }).order('nome');
    return assertNoError(data, error, 'listar todos os sócios') as Socio[];
  },

  /**
   * Nome/tipo/status de todos os sócios, sem colunas sensíveis — lê da
   * view `socios_diretorio` (migration 0013), liberada a qualquer
   * perfil ativo. Use para resolver "de quem é este id" (splits,
   * seletor de sócio em projeto, "por sócio" na DRE, dashboards).
   */
  async listarDiretorioAtivos(): Promise<SocioDiretorio[]> {
    const { data, error } = await supabase.from('socios_diretorio').select('*').eq('ativo', true).order('nome');
    return assertNoError(data, error, 'listar diretório de sócios') as SocioDiretorio[];
  },

  async listarDiretorioTodos(): Promise<SocioDiretorio[]> {
    const { data, error } = await supabase.from('socios_diretorio').select('*').order('ativo', { ascending: false }).order('nome');
    return assertNoError(data, error, 'listar diretório de sócios (todos)') as SocioDiretorio[];
  },

  async criar(input: {
    nome: string; cpf?: string; chavePix?: string; email?: string;
    telefone?: string; tipo: Socio['tipo']; dataEntrada: string; createdBy: string;
  }): Promise<Socio> {
    const { data, error } = await supabase.from('socios').insert({
      nome: input.nome.trim(), cpf: input.cpf || null, chave_pix: input.chavePix || null,
      email: input.email || null, telefone: input.telefone || null, tipo: input.tipo,
      data_entrada: input.dataEntrada, created_by: input.createdBy,
    }).select('*').single();
    return assertNoError(data, error, 'cadastrar sócio') as Socio;
  },

  async atualizar(id: string, input: {
    nome: string; cpf?: string; chavePix?: string; email?: string;
    telefone?: string; tipo: Socio['tipo']; dataEntrada: string;
  }): Promise<void> {
    const { error } = await supabase.from('socios').update({
      nome: input.nome.trim(), cpf: input.cpf || null, chave_pix: input.chavePix || null,
      email: input.email || null, telefone: input.telefone || null, tipo: input.tipo,
      data_entrada: input.dataEntrada,
    }).eq('id', id);
    if (error) throw new Error(`atualizar sócio: ${error.message}`);
  },

  async definirAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await supabase.from('socios').update({
      ativo, data_saida: ativo ? null : new Date().toISOString().slice(0, 10),
    }).eq('id', id);
    if (error) throw new Error(`${ativo ? 'reativar' : 'desativar'} sócio: ${error.message}`);
  },
};
