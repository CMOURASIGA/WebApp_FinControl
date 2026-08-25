import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card } from './Card';

interface PermissionStateProps {
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Estado padrão para quando o profile logado não tem a capability
 * necessária para ver uma tela ou seção. Lembrete: isto é só UX — a
 * proteção definitiva é RLS/RPC no Supabase, então esconder aqui nunca
 * substitui a checagem no banco.
 */
export const PermissionState: React.FC<PermissionStateProps> = ({
  title = 'Acesso restrito',
  description = 'Seu perfil não tem permissão para ver ou executar esta ação. Fale com um administrador se você acredita que deveria ter acesso.',
  className = '',
}) => (
  <Card className={`flex flex-col items-center gap-3 border-dashed p-10 text-center ${className}`}>
    <ShieldAlert className="h-8 w-8 text-slate-400" />
    <div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  </Card>
);
