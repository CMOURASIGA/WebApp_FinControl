
import React from 'react';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Clock, Lock } from 'lucide-react';
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
      label: 'Reservado',
      value: stats.expensesReserved,
      icon: Lock,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
      borderColor: 'border-cyan-100',
      tooltip: 'Dinheiro separado para pagamentos futuros'
    },
    {
      label: 'Saldo Disponível',
      value: stats.balanceAvailable,
      icon: Wallet,
      color: stats.balanceAvailable >= 0 ? 'text-blue-600' : 'text-red-600',
      bg: 'bg-blue-50',
      borderColor: 'border-blue-100',
      tooltip: 'O que você tem na conta menos o que está reservado'
    },
    {
      label: 'Saldo Previsto',
      value: stats.balanceExpected,
      icon: PiggyBank,
      color: 'text-slate-600',
      bg: 'bg-slate-100',
      borderColor: 'border-slate-200',
      tooltip: 'Resultado final considerando todas as pendências'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map((item, idx) => (
        <Card key={idx} className={`p-4 border ${item.borderColor} relative group transition-all hover:shadow-md`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{item.label}</span>
            <div className={`p-2 rounded-full ${item.bg}`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
          </div>
          <div className={`text-xl font-bold ${item.color} truncate`}>
            {formatCurrency(item.value)}
          </div>
          {item.tooltip && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              {item.tooltip}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};
