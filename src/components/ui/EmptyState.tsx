import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Estado padrão para listas sem nenhum registro ainda. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Nada por aqui ainda',
  description,
  action,
  className = '',
}) => (
  <div className={`flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center ${className}`}>
    <Inbox className="h-8 w-8 text-slate-400" />
    <div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </div>
    {action}
  </div>
);
