import React from 'react';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: 'up' | 'down' | 'flat';
  tone?: 'default' | 'positive' | 'negative';
}

const trendIcon = { up: '↑', down: '↓', flat: '→' };

/**
 * KpiCard (nome usado em docs/02-design/DESIGN_SYSTEM.md) — mantido aqui
 * como `StatCard` para não forçar reescrita das páginas que já importam
 * esse nome; `KpiCard` é o mesmo componente, exportado com o nome oficial
 * do design system para telas novas.
 */
export const StatCard: React.FC<StatCardProps> = ({ label, value, hint, trend, tone = 'default' }) => {
  const valueColor = tone === 'positive' ? 'text-green-600' : tone === 'negative' ? 'text-red-600' : 'text-slate-900';
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
        {trend && <span className="text-sm text-slate-400">{trendIcon[trend]}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
};

export const KpiCard = StatCard;
export type KpiCardProps = StatCardProps;
