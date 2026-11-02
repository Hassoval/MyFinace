/**
 * MyFinance - Backup, Export and Validation Engine
 * Handles JSON backup, restore with validation, and CSV export.
 */

import {
  getDB,
  getAllFromStore,
  putInStore,
  Account,
  Transaction,
  Category,
  Budget,
  PlannedExpense,
  SavingsGoal,
  GoalContribution,
  Debt,
  DebtPayment,
  RecurringRule,
  NotificationItem,
  AuditLog,
  SearchHistoryItem,
  logAudit,
} from './database';
import { formatKwanza } from './calculations';

export interface BackupData {
  appName: 'MyFinance';
  schemaVersion: number;
  exportedAt: string;
  metadata: {
    recordCounts: Record<string, number>;
  };
  stores: {
    accounts: Account[];
    categories: Category[];
    transactions: Transaction[];
    budgets: Budget[];
    plannedExpenses: PlannedExpense[];
    savingsGoals: SavingsGoal[];
    goalContributions: GoalContribution[];
    debts: Debt[];
    debtPayments: DebtPayment[];
    recurringRules: RecurringRule[];
    notifications: NotificationItem[];
    auditLogs: AuditLog[];
    searchHistory?: SearchHistoryItem[];
  };
}

/**
 * Creates and downloads a complete JSON backup of the user's financial database
 */
export async function exportDatabaseToJSON(): Promise<void> {
  const [
    accounts,
    categories,
    transactions,
    budgets,
    plannedExpenses,
    savingsGoals,
    goalContributions,
    debts,
    debtPayments,
    recurringRules,
    notifications,
    auditLogs,
    searchHistory,
  ] = await Promise.all([
    getAllFromStore<Account>('accounts'),
    getAllFromStore<Category>('categories'),
    getAllFromStore<Transaction>('transactions'),
    getAllFromStore<Budget>('budgets'),
    getAllFromStore<PlannedExpense>('plannedExpenses'),
    getAllFromStore<SavingsGoal>('savingsGoals'),
    getAllFromStore<GoalContribution>('goalContributions'),
    getAllFromStore<Debt>('debts'),
    getAllFromStore<DebtPayment>('debtPayments'),
    getAllFromStore<RecurringRule>('recurringRules'),
    getAllFromStore<NotificationItem>('notifications'),
    getAllFromStore<AuditLog>('auditLogs'),
    getAllFromStore<SearchHistoryItem>('searchHistory').catch(() => []),
  ]);

  const backupData: BackupData = {
    appName: 'MyFinance',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    metadata: {
      recordCounts: {
        accounts: accounts.length,
        categories: categories.length,
        transactions: transactions.length,
        budgets: budgets.length,
        plannedExpenses: plannedExpenses.length,
        savingsGoals: savingsGoals.length,
        goalContributions: goalContributions.length,
        debts: debts.length,
        debtPayments: debtPayments.length,
        recurringRules: recurringRules.length,
        searchHistory: searchHistory.length,
      },
    },
    stores: {
      accounts,
      categories,
      transactions,
      budgets,
      plannedExpenses,
      savingsGoals,
      goalContributions,
      debts,
      debtPayments,
      recurringRules,
      notifications,
      auditLogs,
      searchHistory,
    },
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `myfinance-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  await logAudit('BACKUP_EXPORT', 'all', 'backup', `Exported backup with ${transactions.length} transactions`);
}

/**
 * Validates a JSON backup file content before restoring
 */
export function validateBackupData(data: any): { valid: boolean; error?: string; summary?: any } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'O ficheiro de cópia de segurança não é um objeto JSON válido.' };
  }

  if (data.appName !== 'MyFinance') {
    return { valid: false, error: 'O ficheiro não foi gerado pelo MyFinance.' };
  }

  if (!data.schemaVersion || data.schemaVersion > 2) {
    return { valid: false, error: 'Versão de esquema incompatível com esta versão da aplicação.' };
  }

  if (!data.stores || typeof data.stores !== 'object') {
    return { valid: false, error: 'Estrutura de dados corrompida: "stores" ausente.' };
  }

  const { stores } = data;
  if (!Array.isArray(stores.accounts) || !Array.isArray(stores.transactions)) {
    return { valid: false, error: 'O ficheiro de cópia de segurança não contém contas ou transações válidas.' };
  }

  return {
    valid: true,
    summary: {
      accountsCount: stores.accounts.length,
      transactionsCount: stores.transactions.length,
      categoriesCount: stores.categories?.length || 0,
      budgetsCount: stores.budgets?.length || 0,
      goalsCount: stores.savingsGoals?.length || 0,
      debtsCount: stores.debts?.length || 0,
      exportedAt: data.exportedAt,
    },
  };
}

/**
 * Restores database from validated JSON backup
 */
export async function restoreDatabaseFromJSON(backupData: BackupData): Promise<void> {
  const db = await getDB();
  const storeNames = [
    'accounts',
    'categories',
    'transactions',
    'budgets',
    'plannedExpenses',
    'savingsGoals',
    'goalContributions',
    'debts',
    'debtPayments',
    'recurringRules',
    'notifications',
    'auditLogs',
    'searchHistory',
  ];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    // 1. Clear all existing stores
    for (const name of storeNames) {
      if (db.objectStoreNames.contains(name)) {
        tx.objectStore(name).clear();
      }
    }

    // 2. Insert items from backup
    const s = backupData.stores;
    if (s.accounts) s.accounts.forEach(item => tx.objectStore('accounts').put(item));
    if (s.categories) s.categories.forEach(item => tx.objectStore('categories').put(item));
    if (s.transactions) s.transactions.forEach(item => tx.objectStore('transactions').put(item));
    if (s.budgets) s.budgets.forEach(item => tx.objectStore('budgets').put(item));
    if (s.plannedExpenses) s.plannedExpenses.forEach(item => tx.objectStore('plannedExpenses').put(item));
    if (s.savingsGoals) s.savingsGoals.forEach(item => tx.objectStore('savingsGoals').put(item));
    if (s.goalContributions) s.goalContributions.forEach(item => tx.objectStore('goalContributions').put(item));
    if (s.debts) s.debts.forEach(item => tx.objectStore('debts').put(item));
    if (s.debtPayments) s.debtPayments.forEach(item => tx.objectStore('debtPayments').put(item));
    if (s.recurringRules) s.recurringRules.forEach(item => tx.objectStore('recurringRules').put(item));
    if (s.notifications) s.notifications.forEach(item => tx.objectStore('notifications').put(item));
    if (s.auditLogs) s.auditLogs.forEach(item => tx.objectStore('auditLogs').put(item));
    if (s.searchHistory) s.searchHistory.forEach(item => tx.objectStore('searchHistory').put(item));
  });
}

/**
 * Export all transactions to CSV (RFC 4180 compliant with UTF-8 BOM for Excel)
 */
export async function exportTransactionsToCSV(): Promise<void> {
  const [transactions, accounts, categories] = await Promise.all([
    getAllFromStore<Transaction>('transactions'),
    getAllFromStore<Account>('accounts'),
    getAllFromStore<Category>('categories'),
  ]);

  const accountMap = new Map(accounts.map(a => [a.id, a.name]));
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  // CSV Headers
  const headers = ['ID', 'Data', 'Tipo', 'Descrição', 'Categoria', 'Conta Origem', 'Conta Destino', 'Valor (Kz)', 'Valor Formatado', 'Pago', 'Notas'];

  const rows = transactions.map(tx => {
    const typeLabel = tx.type === 'income' ? 'Receita' : tx.type === 'expense' ? 'Despesa' : 'Transferência';
    const catName = tx.categoryId ? categoryMap.get(tx.categoryId) || 'Geral' : '-';
    const accName = accountMap.get(tx.accountId) || tx.accountId;
    const toAccName = tx.toAccountId ? accountMap.get(tx.toAccountId) || tx.toAccountId : '-';
    const formatted = formatKwanza(tx.amountCents);
    const rawUnits = (tx.amountCents / 100).toFixed(2).replace('.', ',');

    const escapeCsv = (val: string) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    return [
      escapeCsv(tx.id),
      escapeCsv(formatDateDisplay(tx.date)),
      escapeCsv(typeLabel),
      escapeCsv(tx.description),
      escapeCsv(catName),
      escapeCsv(accName),
      escapeCsv(toAccName),
      escapeCsv(rawUnits),
      escapeCsv(formatted),
      escapeCsv(tx.isPaid === false ? 'Não' : 'Sim'),
      escapeCsv(tx.notes || ''),
    ].join(';'); // Semicolon is standard for European/Portuguese Excel
  });

  // UTF-8 BOM (\uFEFF) ensures Excel opens with proper Portuguese accents (ã, ç, é)
  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `myfinance-transacoes-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format YYYY-MM-DD into DD/MM/YYYY
 */
export function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}
