import React, { useState, useMemo } from 'react';
import { Transaction, CATEGORIES } from '../types';
import { formatCurrency } from '../utils/formatters';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from './ui/Button';

interface AnnualReportProps {
  transactions: Transaction[];
  isOpen: boolean;
  onClose: () => void;
}

export const AnnualReport: React.FC<AnnualReportProps> = ({ transactions, isOpen, onClose }) => {
  const [year, setYear] = useState(new Date().getFullYear());

  // Logic to process data into a matrix
  const reportData = useMemo(() => {
    // Initialize structure
    const months = Array.from({ length: 12 }, (_, i) => i); // 0 to 11
    
    // Helper to filter by year and valid status
    const yearlyTransactions = transactions.filter(t => {
      const tYear = new Date(t.date).getFullYear();
      // We include pending transactions in the report for projection, 
      // but you can filter t.status === 'paid' if you only want realized values.
      return tYear === year; 
    });

    // Structure: { [Category]: [jan_val, feb_val, ..., total] }
    const incomeRows: Record<string, number[]> = {};
    const expenseRows: Record<string, number[]> = {};
    
    // Totals per month
    const totalIncomePerMonth = Array(12).fill(0);
    const totalExpensePerMonth = Array(12).fill(0);

    yearlyTransactions.forEach(t => {
      const monthIndex = new Date(t.date).getMonth(); // 0 = Jan
      const targetObj = t.type === 'income' ? incomeRows : expenseRows;
      
      if (!targetObj[t.category]) {
        targetObj[t.category] = Array(12).fill(0);
      }
      
      targetObj[t.category][monthIndex] += t.value;

      if (t.type === 'income') {
        totalIncomePerMonth[monthIndex] += t.value;
      } else {
        totalExpensePerMonth[monthIndex] += t.value;
      }
    });

    // Calculate row totals
    const processRows = (rows: Record<string, number[]>) => {
      return Object.entries(rows).map(([category, values]) => {
        const total = values.reduce((acc, curr) => acc + curr, 0);
        return { category, values, total };
      }).sort((a, b) => b.total - a.total); // Sort by highest value
    };

    const incomeData = processRows(incomeRows);
    const expenseData = processRows(expenseRows);

    // Calculate Net Result per month
    const netResultPerMonth = months.map(m => totalIncomePerMonth[m] - totalExpensePerMonth[m]);
    
    // Grand totals
    const totalIncomeYear = totalIncomePerMonth.reduce((a, b) => a + b, 0);
    const totalExpenseYear = totalExpensePerMonth.reduce((a, b) => a + b, 0);
    const totalNetYear = totalIncomeYear - totalExpenseYear;

    return {
      incomeData,
      expenseData,
      totalIncomePerMonth,
      totalExpensePerMonth,
      netResultPerMonth,
      totalIncomeYear,
      totalExpenseYear,
      totalNetYear
    };
  }, [transactions, year]);

  if (!isOpen) return null;

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">Relatório Anual</h2>
          
          <div className="flex items-center gap-4 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <Button variant="ghost" size="sm" onClick={() => setYear(year - 1)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="font-bold text-lg w-16 text-center">{year}</span>
            <Button variant="ghost" size="sm" onClick={() => setYear(year + 1)}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <Button variant="secondary" onClick={onClose}>
            <X className="w-4 h-4 mr-2" /> Fechar
          </Button>
        </div>

        {/* Content (Scrollable Table) */}
        <div className="flex-1 overflow-auto p-0 md:p-6 bg-slate-50">
          <div className="bg-white rounded-lg shadow border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs md:text-sm whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3 text-left sticky left-0 bg-slate-100 border-r border-slate-200 min-w-[150px]">Categoria</th>
                  {monthNames.map(m => <th key={m} className="p-3 text-right min-w-[100px]">{m}</th>)}
                  <th className="p-3 text-right bg-slate-200 min-w-[120px]">Total Anual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                
                {/* --- INCOMES --- */}
                <tr className="bg-green-50/50">
                  <td colSpan={14} className="p-2 font-bold text-green-700 sticky left-0 bg-green-50/50">RECEITAS</td>
                </tr>
                {reportData.incomeData.length === 0 && (
                  <tr><td colSpan={14} className="p-3 text-center text-slate-400 italic">Nenhuma receita registrada</td></tr>
                )}
                {reportData.incomeData.map((row) => (
                  <tr key={row.category} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-700 sticky left-0 bg-white border-r border-slate-200">{row.category}</td>
                    {row.values.map((val, idx) => (
                      <td key={idx} className="p-3 text-right text-slate-600">{val > 0 ? formatCurrency(val) : '-'}</td>
                    ))}
                    <td className="p-3 text-right font-bold text-green-600 bg-slate-50">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
                {/* Subtotal Income */}
                <tr className="bg-green-100 font-bold text-slate-800">
                  <td className="p-3 sticky left-0 bg-green-100 border-r border-green-200">TOTAL RECEITAS</td>
                  {reportData.totalIncomePerMonth.map((val, idx) => (
                    <td key={idx} className="p-3 text-right text-green-700">{formatCurrency(val)}</td>
                  ))}
                  <td className="p-3 text-right text-green-800 bg-green-200">{formatCurrency(reportData.totalIncomeYear)}</td>
                </tr>

                {/* --- EXPENSES --- */}
                <tr className="bg-red-50/50">
                  <td colSpan={14} className="p-2 font-bold text-red-700 sticky left-0 bg-red-50/50 mt-4">DESPESAS</td>
                </tr>
                {reportData.expenseData.length === 0 && (
                  <tr><td colSpan={14} className="p-3 text-center text-slate-400 italic">Nenhuma despesa registrada</td></tr>
                )}
                {reportData.expenseData.map((row) => (
                  <tr key={row.category} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-700 sticky left-0 bg-white border-r border-slate-200">{row.category}</td>
                    {row.values.map((val, idx) => (
                      <td key={idx} className="p-3 text-right text-slate-600">{val > 0 ? formatCurrency(val) : '-'}</td>
                    ))}
                    <td className="p-3 text-right font-bold text-red-600 bg-slate-50">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
                {/* Subtotal Expenses */}
                <tr className="bg-red-100 font-bold text-slate-800">
                  <td className="p-3 sticky left-0 bg-red-100 border-r border-red-200">TOTAL DESPESAS</td>
                  {reportData.totalExpensePerMonth.map((val, idx) => (
                    <td key={idx} className="p-3 text-right text-red-700">{formatCurrency(val)}</td>
                  ))}
                  <td className="p-3 text-right text-red-800 bg-red-200">{formatCurrency(reportData.totalExpenseYear)}</td>
                </tr>

                {/* --- NET RESULT --- */}
                <tr className="bg-slate-800 text-white font-bold text-sm border-t-4 border-slate-300">
                  <td className="p-4 sticky left-0 bg-slate-800 z-20">SALDO (LUCRO/PREJUÍZO)</td>
                  {reportData.netResultPerMonth.map((val, idx) => (
                    <td key={idx} className={`p-4 text-right ${val < 0 ? 'text-red-300' : 'text-green-300'}`}>
                      {formatCurrency(val)}
                    </td>
                  ))}
                  <td className={`p-4 text-right bg-slate-900 z-20 ${reportData.totalNetYear < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {formatCurrency(reportData.totalNetYear)}
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};