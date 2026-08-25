import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { can as canFn, capabilitiesDoPapel, type Capability } from '../lib/capabilities';
import type { Papel } from '../types/database';

export interface UseCapabilitiesResult {
  /** `can('manage_expenses')` — checagem central de capability do usuário logado. */
  can: (capability: Capability) => boolean;
  /** Papel bruto do profile atual, ou null se deslogado/sem profile carregado. */
  papel: Papel | null;
  /** Lista de capabilities do usuário logado (vazia se inativo/sem profile). */
  capabilities: Capability[];
}

/**
 * Hook de conveniência sobre `useAuth()` + `lib/capabilities`.
 *
 * Uso típico dentro de uma página:
 *
 *   const { can } = useCapabilities();
 *   if (!can('view_expenses')) return <PermissionState />;
 *   ...
 *   {can('manage_expenses') && <Button onClick={criar}>Nova despesa</Button>}
 */
export function useCapabilities(): UseCapabilitiesResult {
  const { profile } = useAuth();

  const capabilities = useMemo(
    () => (profile?.ativo ? capabilitiesDoPapel(profile.papel) : []),
    [profile]
  );

  const can = useMemo(() => (capability: Capability) => canFn(profile, capability), [profile]);

  return { can, papel: profile?.papel ?? null, capabilities };
}
