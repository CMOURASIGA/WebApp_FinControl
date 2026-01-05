
export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'paid' | 'pending' | 'reserved';

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
  expensesReserved: number;
  expensesPending: number;
  balanceExpected: number;
  balanceRealized: number;
  balanceAvailable: number;
}

export const DEFAULT_CATEGORIES = [
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
