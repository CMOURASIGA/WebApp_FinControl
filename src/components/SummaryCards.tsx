import React from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Clock } from 'lucide-react';
import { Card } from './ui/Card';
import { SummaryStats } from '../types';
import { formatCurrency } from '../utils/formatters';

interface SummaryCardsProps {
  stats: SummaryStats;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ stats }) => {
  const items = [
    {
      label: 'Receitas',
      value: stats.income,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      borderColor: 'border-green-100'
    },
    {
      label: 'Despesas Pagas',
      value: stats.expensesPaid,
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
      borderColor: 'border-red-100'
    },
    {
      label: 'Despesas Pendentes',
      value: stats.expensesPending,
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      borderColor: 'border-orange-100'
    },
    {
      label: 'Saldo Realizado',
      value: stats.balanceRealized,
      icon: Wallet,
      color: stats.balanceRealized >= 0 ? 'text-blue-600' : 'text-red-600',
      bg: 'bg-blue-50',
      borderColor: 'border-blue-100'
    },
    {
      label: 'Saldo Previsto',
      value: stats.balanceExpected,
      icon: PiggyBank,
      color: 'text-slate-600',
      bg: 'bg-slate-100',
      borderColor: 'border-slate-200'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map((item, idx) => (
        <Card key={idx} className={`p-4 border ${item.borderColor}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-500">{item.label}</span>
            <div className={`p-2 rounded-full ${item.bg}`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
          </div>
          <div className={`text-xl font-bold ${item.color}`}>
            {formatCurrency(item.value)}
          </div>
        </Card>
      ))}
    </div>
  );
};