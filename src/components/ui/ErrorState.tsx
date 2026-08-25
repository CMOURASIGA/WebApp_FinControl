import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  className?: string;
}

/**
 * Estado padrão de erro de negócio/carregamento — mensagem próxima do
 * ponto de falha, sempre visível (não é toast que desaparece).
 */
export const ErrorState: React.FC<ErrorStateProps> = ({ message, className = '' }) => (
  <div className={`flex items-start gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ${className}`} role="alert">
    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
    <span>{message}</span>
  </div>
);
