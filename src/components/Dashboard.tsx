import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, FilterState, SummaryStats, CATEGORIES } from '../types';
import { transactionService } from '../services/transactionService';
import { SummaryCards } from './SummaryCards';
import { TransactionForm } from './TransactionForm';
import { TransactionList } from './TransactionList';
import { AnnualReport } from './AnnualReport';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { RefreshCw, Search, Filter, X, TableProperties } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const Dashboard: React.FC = () => {
  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<FilterState>({
    type: 'all',
    status: 'all',
    category: '',
    minValue: '',
    maxValue: '',
    search: '',
  });

  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await transactionService.getAll();
      setTransactions(data);
    } catch (error) {
      console.error("Failed to load transactions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Derived Data (Filtered)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Month Filter
      if (!t.date.startsWith(currentMonth)) return false;

      // Type Filter
      if (filters.type !== 'all' && t.type !== filters.type) return false;
      
      // Status Filter
      if (filters.status !== 'all' && t.status !== filters.status) return false;

      // Category Filter
      if (filters.category && t.category !== filters.category) return false;

      // Value Range
      if (filters.minValue && t.value < parseFloat(filters.minValue)) return false;
      if (filters.maxValue && t.value > parseFloat(filters.maxValue)) return false;

      // Search Text
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          t.description.toLowerCase().includes(searchLower) ||
          t.category.toLowerCase().includes(searchLower)
        );
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Newest first
  }, [transactions, currentMonth, filters]);

  // Summary Stats Calculation
  const stats: SummaryStats = useMemo(() => {
    const initial = {
      income: 0,
      expensesPaid: 0,
      expensesPending: 0,
      balanceExpected: 0,
      balanceRealized: 0,
    };

    return filteredTransactions.reduce((acc, t) => {
      if (t.type === 'income') {
        acc.balanceExpected += t.value;
        if (t.status === 'paid') {
          acc.income += t.value;
          acc.balanceRealized += t.value;
        }
      } else {
        acc.balanceExpected -= t.value;
        if (t.status === 'paid') {
          acc.expensesPaid += t.value;
          acc.balanceRealized -= t.value;
        } else {
          acc.expensesPending += t.value;
        }
      }
      return acc;
    }, initial);
  }, [filteredTransactions]);

  // Chart Data
  const chartData = useMemo(() => {
    const income = stats.income;
    const expense = stats.expensesPaid;
    if (income === 0 && expense === 0) return [];
    return [
      { name: 'Receitas', value: income, color: '#22c55e' },
      { name: 'Despesas', value: expense, color: '#ef4444' },
    ];
  }, [stats]);

  // Handlers
  const handleSave = async (t: Transaction) => {
    await transactionService.save(t);
    await loadData();
    setEditingTransaction(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
      await transactionService.delete(id);
      await loadData();
    }
  };

  const clearFilters = () => {
    setFilters({
      type: 'all',
      status: 'all',
      category: '',
      minValue: '',
      maxValue: '',
      search: '',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <AnnualReport 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
        transactions={transactions} 
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">Painel Financeiro</h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
             {/* Report Button */}
             <Button 
              onClick={() => setIsReportOpen(true)} 
              variant="secondary" 
              className="flex items-center gap-2"
              title="Ver Relatório Anual"
            >
              <TableProperties className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Relatório Anual</span>
            </Button>

            <div className="h-6 w-px bg-slate-300 mx-1 hidden md:block"></div>

            <input 
              type="month" 
              className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white w-full sm:w-auto"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
            />
            <Button onClick={loadData} variant="secondary" size="md" title="Atualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <SummaryCards stats={stats} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: List & Filters (2/3 width on large) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Filters Section */}
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4 md:hidden">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Filtros
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowFiltersMobile(!showFiltersMobile)}>
                  {showFiltersMobile ? 'Ocultar' : 'Mostrar'}
                </Button>
              </div>

              <div className={`space-y-4 ${showFiltersMobile ? 'block' : 'hidden md:block'}`}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select 
                    className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full"
                    value={filters.type}
                    onChange={(e) => setFilters({...filters, type: e.target.value as any})}
                  >
                    <option value="all">Todos os Tipos</option>
                    <option value="income">Receitas</option>
                    <option value="expense">Despesas</option>
                  </select>
                  
                  <select 
                    className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full"
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value as any})}
                  >
                    <option value="all">Todos os Status</option>
                    <option value="paid">Pagos / Realizados</option>
                    <option value="pending">Pendentes</option>
                  </select>

                  <select 
                    className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full"
                    value={filters.category}
                    onChange={(e) => setFilters({...filters, category: e.target.value})}
                  >
                    <option value="">Todas Categorias</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar descrição..." 
                      className="pl-9 border border-slate-300 rounded-md px-3 py-2 text-sm w-full"
                      value={filters.search}
                      onChange={(e) => setFilters({...filters, search: e.target.value})}
                    />
                  </div>
                  <Button variant="ghost" onClick={clearFilters} className="shrink-0">
                    <X className="w-4 h-4 mr-1" /> Limpar
                  </Button>
                </div>
              </div>
            </Card>

            {/* Transactions List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold text-slate-800">Transações</h2>
                 <span className="text-sm text-slate-500">{filteredTransactions.length} registros</span>
              </div>
              <TransactionList 
                transactions={filteredTransactions} 
                isLoading={loading} 
                onEdit={setEditingTransaction}
                onDelete={handleDelete}
              />
            </div>
          </div>

          {/* Right Column: Form & Chart (1/3 width on large) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Form (Sticky on Desktop) */}
            <div className="lg:sticky lg:top-24">
              <TransactionForm 
                initialData={editingTransaction} 
                onSave={handleSave} 
                onCancel={() => setEditingTransaction(null)} 
              />

              {/* Chart (Only visible if data exists) */}
              {chartData.length > 0 && (
                <Card className="p-4 mt-6 h-64 hidden lg:block">
                  <h3 className="text-sm font-bold text-slate-600 mb-2 text-center">Resumo (Pagos)</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};