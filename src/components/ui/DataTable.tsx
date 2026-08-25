import React from 'react';
import { Card } from './Card';
import { EmptyState } from './EmptyState';

export interface DataTableColumn<T> {
  header: string;
  /** Classe opcional para a coluna (ex.: alinhamento, largura). */
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Tabela operacional padrão. Em telas largas renderiza como tabela; em
 * mobile cai para uma lista de cards (uma linha = um card com
 * label/valor por coluna) — ver docs/02-design/DESIGN_SYSTEM.md §7.
 *
 * Não é obrigatório migrar toda lista existente para este componente
 * na Fase 2 — novas telas e a revisão da Fase 3 devem preferi-lo a uma
 * div responsiva feita à mão.
 */
export function DataTable<T>({ columns, rows, rowKey, emptyTitle, emptyDescription }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Card className="overflow-hidden">
      {/* Desktop/tablet: tabela de verdade. */}
      <table className="hidden w-full text-sm sm:table">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className={`px-4 py-3 ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-slate-50/60">
              {columns.map((col) => (
                <td key={col.header} className={`px-4 py-3 ${col.className ?? ''}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: lista de cards, um por linha. */}
      <div className="divide-y divide-slate-100 sm:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="space-y-1.5 px-4 py-3 text-sm">
            {columns.map((col) => (
              <div key={col.header} className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{col.header}</span>
                <span className="text-right">{col.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
