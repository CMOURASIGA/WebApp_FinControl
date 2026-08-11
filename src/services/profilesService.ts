import { supabase } from '../lib/supabaseClient';
import type { Profile } from '../types/database';
import { assertNoError } from './base';

export const profilesService = {
  async listarSocios(): Promise<Profile[]> {
    const { data, error } = await supabase.from('profiles').select('*').eq('ativo', true).order('nome');
    return assertNoError(data, error, 'listar sócios') as Profile[];
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
};
