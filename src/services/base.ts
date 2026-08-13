import type { PostgrestError } from '@supabase/supabase-js';

export function assertNoError<T>(data: T | null, error: PostgrestError | null, contexto: string): T {
  if (error) {
    throw new Error(`${contexto}: ${error.message}`);
  }
  if (data === null) {
    throw new Error(`${contexto}: nenhum dado retornado`);
  }
  return data;
}
