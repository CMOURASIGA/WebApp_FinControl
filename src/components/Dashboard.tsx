
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, FilterState, SummaryStats } from '../types';
import { transactionService } from '../services/transactionService';
import { formatCurrency } from '../utils/formatters';
import { SummaryCards } from './SummaryCards';
import { TransactionForm } from './TransactionForm';
import { TransactionList } from './TransactionList';
import { AnnualReport } from './AnnualReport';
import { UserGuide } from './UserGuide';
import { CategoryManager } from './CategoryManager';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { RefreshCw, Search, X, TableProperties, HelpCircle, Settings, ChevronDown } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const Dashboard: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    type: 'all',
    status: 'all',
    category: '',
    minValue: '',
    maxValue: '',
    search: '',
  });

  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [transData, catData] = await Promise.all([
        transactionService.getAll(),
        transactionService.getCategories()
      ]);
      setTransactions(transData);
      setCategories(catData);
    } catch (error) {
      console.error("Dashboard Load Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date.startsWith(currentMonth)) return false;
      if (filters.type !== 'all' && t.type !== filters.type) return false;
      if (filters.status !== 'all' && t.status !== filters.status) return false;
      if (filters.category && t.category !== filters.category) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        return t.description.toLowerCase().includes(s) || t.category.toLowerCase().includes(s);
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentMonth, filters]);

  const stats: SummaryStats = useMemo(() => {
    const s = {
      income: 0, expensesPaid: 0, expensesReserved: 0, expensesPending: 0,
      balanceExpected: 0, balanceRealized: 0, balanceAvailable: 0
    };

    filteredTransactions.forEach(t => {
      if (t.type === 'income') {
        if (t.status === 'paid') {
          s.income += t.value;
          s.balanceRealized += t.value;
          s.balanceAvailable += t.value;
        }
        s.balanceExpected += t.value;
      } else {
        if (t.status === 'paid') {
          s.expensesPaid += t.value;
          s.balanceRealized -= t.value;
          s.balanceAvailable -= t.value;
        } else if (t.status === 'reserved') {
          s.expensesReserved += t.value;
          s.balanceAvailable -= t.value; // Dinheiro reservado reduz o saldo livre
        } else {
          s.expensesPending += t.value;
        }
        s.balanceExpected -= t.value;
      }
    });
    return s;
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    return [
      { name: 'Entradas', value: stats.income, color: '#22c55e' },
      { name: 'Saídas Pagas', value: stats.expensesPaid, color: '#ef4444' },
      { name: 'Reservado', value: stats.expensesReserved, color: '#0891b2' },
    ].filter(d => d.value > 0);
  }, [stats]);

  const handleSave = async (t: Transaction) => {
    await transactionService.save(t);
    await loadData();
    setEditingTransaction(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir esta transação?')) {
      await transactionService.delete(id);
      await loadData();
    }
  };

  const handleSaveCategories = async (newCats: string[]) => {
    await transactionService.saveCategories(newCats);
    setCategories(newCats);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <AnnualReport isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} transactions={transactions} />
      <UserGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <CategoryManager 
        isOpen={isCategoryManagerOpen} 
        onClose={() => setIsCategoryManagerOpen(false)} 
        categories={categories} 
        onSave={handleSaveCategories} 
      />

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">FinControl</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <Button onClick={() => setIsGuideOpen(true)} variant="ghost" size="sm" title="Ajuda"><HelpCircle className="w-5 h-5 text-slate-500" /></Button>
            <Button onClick={() => setIsCategoryManagerOpen(true)} variant="secondary" size="sm" title="Categorias" className="gap-2"><Settings className="w-4 h-4" /> <span className="hidden sm:inline">Categorias</span></Button>
            <Button onClick={() => setIsReportOpen(true)} variant="secondary" className="gap-2"><TableProperties className="w-4 h-4 text-blue-600" /> Relatório Anual</Button>
            <div className="h-6 w-px bg-slate-200 hidden md:block mx-1"></div>
            <div className="relative group">
              <input type="month" className="appearance-none border border-slate-300 rounded-md px-3 py-2 text-sm bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-none pr-8" value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)}/>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <Button onClick={loadData} variant="ghost" size="sm" className="bg-white border border-slate-200"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <SummaryCards stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-5 border-none shadow-md">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h2 className="text-lg font-bold text-slate-800">Filtrar Lançamentos</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowFiltersMobile(!showFiltersMobile)}
                  className="md:hidden text-blue-600 font-bold"
                >
                  {showFiltersMobile ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                </Button>
              </div>

              <div className={`space-y-4 ${showFiltersMobile ? 'block' : 'hidden md:block'}`}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Tipo</label>
                    <select className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full font-medium" value={filters.type} onChange={(e) => setFilters({...filters, type: e.target.value as any})}>
                      <option value="all">Todos os Tipos</option><option value="income">Apenas Receitas</option><option value="expense">Apenas Despesas</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Status</label>
                    <select className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full font-medium" value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value as any})}>
                      <option value="all">Todos Status</option><option value="paid">Pagos / Recebidos</option><option value="reserved">Reservados</option><option value="pending">Pendentes</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Categoria</label>
                    <select className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full font-medium" value={filters.category} onChange={(e) => setFilters({...filters, category: e.target.value})}>
                      <option value="">Todas as Categorias</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Buscar por descrição..." className="pl-9 border border-slate-300 rounded-md px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none" value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})}/>
                  </div>
                  <Button variant="ghost" className="text-slate-400" onClick={() => setFilters({type:'all', status:'all', category:'', minValue:'', maxValue:'', search:''})}><X className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-xl font-bold text-slate-800">Transações</h2>
                <div className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded-full">{filteredTransactions.length} registros</div>
              </div>
              <TransactionList transactions={filteredTransactions} isLoading={loading} onEdit={setEditingTransaction} onDelete={handleDelete} />
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="lg:sticky lg:top-24 space-y-6">
              <TransactionForm 
                initialData={editingTransaction} 
                onSave={handleSave} 
                onCancel={() => setEditingTransaction(null)} 
                categories={categories}
                onManageCategories={() => setIsCategoryManagerOpen(true)}
              />
              
              {chartData.length > 0 && (
                <Card className="p-6 border-none shadow-md hidden lg:block bg-white">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-6">Composição Financeira</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={chartData} 
                          cx="50%" 
                          cy="50%" 
                          innerRadius={50} 
                          outerRadius={75} 
                          paddingAngle={8} 
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                        </Pie>
                        <Tooltip 
                          formatter={(v: number) => formatCurrency(v)} 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Mobile Indicator Footer */}
      <footer className="fixed bottom-0 left-0 right-0 h-1 bg-blue-600 md:hidden z-50"></footer>
    </div>
  );
};
