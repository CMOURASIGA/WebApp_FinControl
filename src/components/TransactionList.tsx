
import React from 'react';
import { Transaction } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Pencil, Trash2, AlertCircle, Lock } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  isLoading: boolean;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, 
  isLoading, 
  onEdit, 
  onDelete 
}) => {
  
  if (isLoading) {
    return (
      <div className="py-12 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        Carregando transações...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-400" />
        <p>Nenhuma transação encontrada.</p>
      </div>
    );
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'reserved': return 'bg-cyan-100 text-cyan-700';
      default: return 'bg-orange-100 text-orange-700';
    }
  };

  const getStatusLabel = (t: Transaction) => {
    if (t.status === 'paid') return t.type === 'income' ? 'Recebido' : 'Pago';
    if (t.status === 'reserved') return 'Reservado';
    return 'Pendente';
  };

  return (
    <div className="space-y-4">
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(t.date)}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{t.description}</td>
                <td className="px-4 py-3 text-slate-600">
                   <span className="inline-block px-2 py-1 rounded-full bg-slate-100 text-xs">{t.category}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full flex items-center gap-1 w-fit ${getStatusStyle(t.status)}`}>
                    {t.status === 'reserved' && <Lock className="w-3 h-3" />}
                    {getStatusLabel(t)}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'expense' ? '-' : '+'} {formatCurrency(t.value)}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(t)}><Pencil className="w-4 h-4 text-slate-500" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(t.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {transactions.map((t) => (
          <Card key={t.id} className="p-4 border-l-4 border-l-transparent" style={{ borderLeftColor: t.type === 'income' ? '#22c55e' : (t.status === 'reserved' ? '#0891b2' : '#ef4444') }}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-xs text-slate-500">{formatDate(t.date)}</span>
                <h4 className="font-bold text-slate-900">{t.description}</h4>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block uppercase tracking-wider">{t.category}</span>
              </div>
              <div className="text-right">
                <div className={`font-bold ${t.type === 'income' ? 'text-green-600' : (t.status === 'reserved' ? 'text-cyan-600' : 'text-red-600')}`}>
                   {t.type === 'expense' ? '-' : '+'} {formatCurrency(t.value)}
                </div>
                 <span className={`text-[10px] font-bold uppercase ${getStatusStyle(t.status).split(' ')[1]}`}>
                    {getStatusLabel(t)}
                  </span>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => onEdit(t)} className="h-8 text-xs">Editar</Button>
              <Button variant="secondary" size="sm" onClick={() => onDelete(t.id)} className="h-8 text-xs text-red-500">Excluir</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
