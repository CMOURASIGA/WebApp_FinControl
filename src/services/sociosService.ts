import { supabase } from '../lib/supabaseClient';
import type { Socio } from '../types/database';
import { assertNoError } from './base';

export const sociosService = {
  async listarAtivos(): Promise<Socio[]> {
    const { data, error } = await supabase.from('socios').select('*').eq('ativo', true).order('nome');
    return assertNoError(data, error, 'listar sócios') as Socio[];
  },

  async listarTodos(): Promise<Socio[]> {
    const { data, error } = await supabase.from('socios').select('*').order('ativo', { ascending: false }).order('nome');
    return assertNoError(data, error, 'listar todos os sócios') as Socio[];
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
