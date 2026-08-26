import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { demoSupabase } from './demoSupabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// A raia demo usa dados locais/mockados. Mantemos compatibilidade com
// VITE_SKIP_AUTH porque essa flag já está configurada nos previews atuais.
// Produção continua segura por padrão: sem nenhuma das flags, usa Supabase real.
export const demoDataMode = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.VITE_SKIP_AUTH === 'true';

if (!demoDataMode && (!supabaseUrl || !supabaseAnonKey)) {
  // eslint-disable-next-line no-console
  console.error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configurados. Copie .env.example para .env.local e preencha com os dados do seu projeto Supabase.'
  );
}

const realSupabase = demoDataMode
  ? null
  : createClient<Database>(supabaseUrl ?? '', supabaseAnonKey ?? '', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });

export const supabase = (demoDataMode ? demoSupabase : realSupabase) as SupabaseClient<Database>;
