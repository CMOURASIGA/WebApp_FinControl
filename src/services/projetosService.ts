import { supabase } from '../lib/supabaseClient';
import type { Cliente, Projeto } from '../types/database';
import { assertNoError } from './base';

export const clientesService = {
  async listar(): Promise<Cliente[]> {
    const { data, error } = await supabase.from('clientes').select('*').order('nome');
    return assertNoError(data, error, 'listar clientes') as Cliente[];
  },

  async criar(input: { nome: string; documento?: string; contato?: string; observacao?: string }): Promise<Cliente> {
    const { data, error } = await supabase.from('clientes').insert(input).select('*').single();
    return assertNoError(data, error, 'criar cliente') as Cliente;
  },
};

export const projetosService = {
  async listar(): Promise<Projeto[]> {
    const { data, error } = await supabase.from('projetos').select('*').order('created_at', { ascending: false });
    return assertNoError(data, error, 'listar projetos') as Projeto[];
  },

  async obter(id: string): Promise<Projeto | null> {
    const { data, error } = await supabase.from('projetos').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`obter projeto: ${error.message}`);
    return data as Projeto | null;
  },

  async criar(input: {
    clienteId?: string | null;
    nome: string;
    tipo: Projeto['tipo'];
    origemEconomica: string;
    responsavelComercial?: string;
    responsavelExecucao?: string;
    observacao?: string;
    createdBy: string;
  }): Promise<Projeto> {
    const { data, error } = await supabase
      .from('projetos')
      .insert({
        cliente_id: input.clienteId ?? null,
        nome: input.nome,
        tipo: input.tipo,
        origem_economica: input.origemEconomica,
        responsavel_comercial: input.responsavelComercial ?? null,
        responsavel_execucao: input.responsavelExecucao ?? null,
        observacao: input.observacao ?? null,
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    return assertNoError(data, error, 'criar projeto') as Projeto;
  },

  async atualizarStatus(id: string, status: Projeto['status']): Promise<void> {
    const { error } = await supabase.from('projetos').update({ status }).eq('id', id);
    if (error) throw new Error(`atualizar status do projeto: ${error.message}`);
  },
};
