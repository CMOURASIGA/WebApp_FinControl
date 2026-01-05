
import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Transaction } from '../types';
import { Save, X, Tag } from 'lucide-react';

interface TransactionFormProps {
  initialData?: Transaction | null;
  onSave: (transaction: Transaction) => Promise<void>;
  onCancel: () => void;
  categories: string[];
  onManageCategories: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);

export const TransactionForm: React.FC<TransactionFormProps> = ({ 
  initialData, 
  onSave, 
  onCancel, 
  categories, 
  onManageCategories 
}) => {
  const [formData, setFormData] = useState<Partial<Transaction>>({
    type: 'expense',
    status: 'paid',
    category: categories[0] || 'Outros',
    date: new Date().toISOString().split('T')[0],
    description: '',
    value: 0,
  });
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData(prev => ({
        ...prev,
        category: categories[0] || 'Outros',
        id: undefined,
        description: '',
        value: 0
      }));
    }
  }, [initialData, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const transactionToSave: Transaction = {
        ...formData,
        id: formData.id || generateId(),
        value: Number(formData.value),
      } as Transaction;
      await onSave(transactionToSave);
      if (!initialData) {
         setFormData(prev => ({ ...prev, description: '', value: 0 }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelClass = "block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider";

  return (
    <Card className="p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800">
          {initialData ? 'Editar Transação' : 'Nova Transação'}
        </h3>
        {initialData && (
           <Button variant="ghost" size="sm" onClick={onCancel}>
             <X className="w-4 h-4 mr-1" />
           </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tipo</label>
            <select className={inputClass} value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value as any})}>
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as any})}>
              <option value="paid">Pago / Recebido</option>
              <option value="reserved">Reservado</option>
              <option value="pending">Pendente</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div>
            <label className={labelClass}>Valor (R$)</label>
            <input type="number" step="0.01" required className={inputClass} value={formData.value} onChange={(e) => setFormData({...formData, value: parseFloat(e.target.value)})}/>
          </div>
           <div>
            <label className={labelClass}>Data</label>
            <input type="date" required className={inputClass} value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})}/>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className={labelClass}>Categoria</label>
            <button type="button" onClick={onManageCategories} className="text-[10px] font-bold text-blue-600 hover:underline uppercase flex items-center gap-1">
              <Tag className="w-3 h-3" /> Gerenciar
            </button>
          </div>
          <select className={inputClass} value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass}>Descrição</label>
          <input type="text" required placeholder="Ex: Compras do mês" className={inputClass} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}/>
        </div>

        <div className="pt-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : (
              <><Save className="w-4 h-4 mr-2" /> Salvar Transação</>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
};
