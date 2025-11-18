import { Transaction } from '../types';

// Mock Data
const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    date: '2023-10-05',
    type: 'income',
    category: 'Salário',
    description: 'Salário Mensal',
    value: 5000,
    status: 'paid',
  },
  {
    id: '2',
    date: '2023-10-10',
    type: 'expense',
    category: 'Moradia',
    description: 'Aluguel',
    value: 1500,
    status: 'paid',
  },
  {
    id: '3',
    date: '2023-10-15',
    type: 'expense',
    category: 'Alimentação',
    description: 'Supermercado Semanal',
    value: 450.50,
    status: 'paid',
  },
  {
    id: '4',
    date: '2023-10-20',
    type: 'expense',
    category: 'Lazer',
    description: 'Cinema e Jantar',
    value: 200,
    status: 'pending',
  },
  {
    id: '5',
    date: '2023-10-25',
    type: 'income',
    category: 'Investimentos',
    description: 'Dividendos',
    value: 150.25,
    status: 'pending',
  },
];

const STORAGE_KEY = 'fincontrol_transactions';

// Helper to simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const transactionService = {
  async getAll(): Promise<Transaction[]> {
    await delay(600); // Simulate network latency
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    // Initialize with mock data if empty
    localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_TRANSACTIONS));
    return MOCK_TRANSACTIONS;
  },

  async save(transaction: Transaction): Promise<Transaction> {
    await delay(400);
    const stored = localStorage.getItem(STORAGE_KEY);
    let transactions: Transaction[] = stored ? JSON.parse(stored) : [];
    
    const index = transactions.findIndex(t => t.id === transaction.id);
    if (index >= 0) {
      transactions[index] = transaction;
    } else {
      transactions.push(transaction);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return transaction;
  },

  async delete(id: string): Promise<void> {
    await delay(300);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    
    const transactions: Transaction[] = JSON.parse(stored);
    const filtered = transactions.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }
};