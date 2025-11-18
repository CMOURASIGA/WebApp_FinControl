export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'paid' | 'pending';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category: string;
  description: string;
  value: number;
  status: TransactionStatus;
}

export interface FilterState {
  type: 'all' | TransactionType;
  status: 'all' | TransactionStatus;
  category: string;
  minValue: string;
  maxValue: string;
  search: string;
}

export interface SummaryStats {
  income: number;
  expensesPaid: number;
  expensesPending: number;
  balanceExpected: number;
  balanceRealized: number;
}

export const CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Lazer',
  'Saúde',
  'Educação',
  'Salário',
  'Investimentos',
  'Outros'
];