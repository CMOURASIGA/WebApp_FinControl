
import { Transaction, DEFAULT_CATEGORIES } from '../types';

const STORAGE_KEY = 'fincontrol_transactions';
const CATEGORIES_KEY = 'fincontrol_categories';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const transactionService = {
  // TRANSACTIONS
  async getAll(): Promise<Transaction[]> {
    await delay(300);
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  async save(transaction: Transaction): Promise<Transaction> {
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
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const transactions: Transaction[] = JSON.parse(stored);
    const filtered = transactions.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  // CATEGORIES
  async getCategories(): Promise<string[]> {
    const stored = localStorage.getItem(CATEGORIES_KEY);
    if (stored) return JSON.parse(stored);
    
    // Initial setup
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES;
  },

  async saveCategories(categories: string[]): Promise<void> {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }
};
