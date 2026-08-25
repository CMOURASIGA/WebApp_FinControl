import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Ação primária da página (ex.: "Novo sócio", "Nova despesa"). */
  action?: React.ReactNode;
  /** Conteúdo extra à direita, antes da ação primária (filtros, badges de status). */
  aside?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão de página: título + descrição à esquerda, filtros/ação
 * primária à direita. Substitui o bloco `<div><h1>...</h1><p>...</p></div>`
 * que cada página repetia com o próprio wording.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action, aside, className = '' }) => (
  <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
    {(aside || action) && (
      <div className="flex items-center gap-3">
        {aside}
        {action}
      </div>
    )}
  </div>
);
