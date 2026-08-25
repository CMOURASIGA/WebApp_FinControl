import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

/** Estado padrão de carregamento — substitui os `<p>Carregando...</p>` soltos. */
export const LoadingState: React.FC<LoadingStateProps> = ({ label = 'Carregando...', className = '' }) => (
  <div className={`flex items-center gap-2 py-10 text-sm text-slate-500 ${className}`}>
    <Loader2 className="h-4 w-4 animate-spin" />
    {label}
  </div>
);
