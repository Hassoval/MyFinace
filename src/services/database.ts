/**
 * MyFinance - IndexedDB Storage Engine
 * Strict client-side database layer with atomic transactions, versioning,
 * and zero reliance on external backends.
 */

export const DB_NAME = 'MyFinanceDB';
export const DB_VERSION = 2;

export interface SearchHistoryItem {
  id: string;
  type: 'query' | 'transaction_view';
  text: string;
  targetId?: string;
  amountCents?: number;
  categoryName?: string;
  accountName?: string;
  timestamp: string; // ISO string
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'wallet' | 'savings';
  balanceCents: number;
  institution?: string;
  accountNumber?: string;
  color: string;
  icon: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  isSystem: boolean;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  amountCents: number;
  date: string; // YYYY-MM-DD
  categoryId?: string;
  accountId: string; // Source account (or fromAccount for transfers)
  toAccountId?: string; // Target account for transfers
  source?: string; // e.g. Employer, Client
  notes?: string;
  attachmentData?: string; // Base64 data URL for receipt
  attachmentName?: string;
  recurringRuleId?: string;
  isPlanned?: boolean;
  isPaid?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  monthYear: string; // YYYY-MM
  limitCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedExpense {
  id: string;
  description: string;
  amountCents: number;
  dueDate: string; // YYYY-MM-DD
  categoryId: string;
  accountId: string;
  isPaid: boolean;
  isRecurring: boolean;
  notes?: string;
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmountCents: number;
  currentAmountCents: number;
  targetDate: string; // YYYY-MM-DD
  description?: string;
  color: string;
  icon: string;
  isCompleted: boolean;
  accountId?: string; // Associated savings account if linked
  createdAt: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  accountId: string;
  amountCents: number;
  type: 'deposit' | 'withdrawal';
  date: string;
  notes?: string;
  createdAt: string;
}

export interface Debt {
  id: string;
  type: 'owed_by_me' | 'owed_to_me';
  personName: string;
  initialAmountCents: number;
  currentBalanceCents: number;
  dueDate?: string;
  description?: string;
  status: 'pending' | 'partially_paid' | 'paid';
  createdAt: string;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  accountId: string;
  amountCents: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface RecurringRule {
  id: string;
  description: string;
  amountCents: number;
  type: 'income' | 'expense';
  categoryId: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDueDate: string;
  active: boolean;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  date: string;
  isRead: boolean;
  link?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Open or upgrade IndexedDB
 */
export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Accounts
      if (!db.objectStoreNames.contains('accounts')) {
        const store = db.createObjectStore('accounts', { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('isArchived', 'isArchived', { unique: false });
      }

      // 2. Categories
      if (!db.objectStoreNames.contains('categories')) {
        const store = db.createObjectStore('categories', { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
      }

      // 3. Transactions
      if (!db.objectStoreNames.contains('transactions')) {
        const store = db.createObjectStore('transactions', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('accountId', 'accountId', { unique: false });
        store.createIndex('categoryId', 'categoryId', { unique: false });
      }

      // 4. Budgets
      if (!db.objectStoreNames.contains('budgets')) {
        const store = db.createObjectStore('budgets', { keyPath: 'id' });
        store.createIndex('monthYear', 'monthYear', { unique: false });
        store.createIndex('categoryId', 'categoryId', { unique: false });
      }

      // 5. Planned Expenses
      if (!db.objectStoreNames.contains('plannedExpenses')) {
        const store = db.createObjectStore('plannedExpenses', { keyPath: 'id' });
        store.createIndex('dueDate', 'dueDate', { unique: false });
        store.createIndex('isPaid', 'isPaid', { unique: false });
      }

      // 6. Savings Goals
      if (!db.objectStoreNames.contains('savingsGoals')) {
        db.createObjectStore('savingsGoals', { keyPath: 'id' });
      }

      // 7. Goal Contributions
      if (!db.objectStoreNames.contains('goalContributions')) {
        const store = db.createObjectStore('goalContributions', { keyPath: 'id' });
        store.createIndex('goalId', 'goalId', { unique: false });
      }

      // 8. Debts
      if (!db.objectStoreNames.contains('debts')) {
        const store = db.createObjectStore('debts', { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }

      // 9. Debt Payments
      if (!db.objectStoreNames.contains('debtPayments')) {
        const store = db.createObjectStore('debtPayments', { keyPath: 'id' });
        store.createIndex('debtId', 'debtId', { unique: false });
      }

      // 10. Recurring Rules
      if (!db.objectStoreNames.contains('recurringRules')) {
        const store = db.createObjectStore('recurringRules', { keyPath: 'id' });
        store.createIndex('active', 'active', { unique: false });
      }

      // 11. Notifications
      if (!db.objectStoreNames.contains('notifications')) {
        const store = db.createObjectStore('notifications', { keyPath: 'id' });
        store.createIndex('isRead', 'isRead', { unique: false });
      }

      // 12. Audit Logs
      if (!db.objectStoreNames.contains('auditLogs')) {
        const store = db.createObjectStore('auditLogs', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // 13. Search History
      if (!db.objectStoreNames.contains('searchHistory')) {
        const store = db.createObjectStore('searchHistory', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Generic Read all items from a store
 */
export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic Get item by ID
 */
export async function getByIdFromStore<T>(storeName: string, id: string): Promise<T | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve((request.result as T) || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic Put item (insert or replace)
 */
export async function putInStore<T>(storeName: string, item: T): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic Delete item by ID
 */
export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Log audit trail
 */
export async function logAudit(action: string, entity: string, entityId: string, details: string): Promise<void> {
  const log: AuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    action,
    entity,
    entityId,
    details,
    timestamp: new Date().toISOString(),
  };
  try {
    await putInStore('auditLogs', log);
  } catch (e) {
    console.warn('Could not write audit log:', e);
  }
}

// -------------------------------------------------------------
// ATOMIC FINANCIAL TRANSACTIONS ENGINE
// -------------------------------------------------------------

/**
 * Create a new financial transaction with atomic account balance adjustment
 */
export async function addTransaction(txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
  const db = await getDB();
  const id = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const transaction: Transaction = {
    ...txData,
    id,
    createdAt: now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const storeNames = ['transactions', 'accounts', 'auditLogs'];
    const tx = db.transaction(storeNames, 'readwrite');
    const txStore = tx.objectStore('transactions');
    const accountsStore = tx.objectStore('accounts');

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(transaction);

    // Save transaction
    txStore.add(transaction);

    // If transaction is not paid (e.g. pending/planned), balance is NOT updated!
    if (transaction.isPaid === false) {
      return;
    }

    if (transaction.type === 'income') {
      const accReq = accountsStore.get(transaction.accountId);
      accReq.onsuccess = () => {
        const account = accReq.result as Account;
        if (account) {
          account.balanceCents += transaction.amountCents;
          account.updatedAt = now;
          accountsStore.put(account);
        }
      };
    } else if (transaction.type === 'expense') {
      const accReq = accountsStore.get(transaction.accountId);
      accReq.onsuccess = () => {
        const account = accReq.result as Account;
        if (account) {
          account.balanceCents -= transaction.amountCents;
          account.updatedAt = now;
          accountsStore.put(account);
        }
      };
    } else if (transaction.type === 'transfer' && transaction.toAccountId) {
      // Internal transfer: atomic debit from source and credit to target
      const fromReq = accountsStore.get(transaction.accountId);
      fromReq.onsuccess = () => {
        const fromAccount = fromReq.result as Account;
        if (fromAccount) {
          fromAccount.balanceCents -= transaction.amountCents;
          fromAccount.updatedAt = now;
          accountsStore.put(fromAccount);
        }
      };

      const toReq = accountsStore.get(transaction.toAccountId);
      toReq.onsuccess = () => {
        const toAccount = toReq.result as Account;
        if (toAccount) {
          toAccount.balanceCents += transaction.amountCents;
          toAccount.updatedAt = now;
          accountsStore.put(toAccount);
        }
      };
    }
  });
}

/**
 * Delete a transaction and atomically revert account balance
 */
export async function deleteTransaction(txId: string): Promise<void> {
  const db = await getDB();
  const existing = await getByIdFromStore<Transaction>('transactions', txId);
  if (!existing) return;

  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions', 'accounts', 'auditLogs'], 'readwrite');
    const txStore = tx.objectStore('transactions');
    const accountsStore = tx.objectStore('accounts');

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    // Remove transaction
    txStore.delete(txId);

    // If unpaid, no balance revert is needed
    if (existing.isPaid === false) return;

    // Revert balance
    if (existing.type === 'income') {
      const accReq = accountsStore.get(existing.accountId);
      accReq.onsuccess = () => {
        const acc = accReq.result as Account;
        if (acc) {
          acc.balanceCents -= existing.amountCents;
          acc.updatedAt = now;
          accountsStore.put(acc);
        }
      };
    } else if (existing.type === 'expense') {
      const accReq = accountsStore.get(existing.accountId);
      accReq.onsuccess = () => {
        const acc = accReq.result as Account;
        if (acc) {
          acc.balanceCents += existing.amountCents;
          acc.updatedAt = now;
          accountsStore.put(acc);
        }
      };
    } else if (existing.type === 'transfer' && existing.toAccountId) {
      const fromReq = accountsStore.get(existing.accountId);
      fromReq.onsuccess = () => {
        const fromAcc = fromReq.result as Account;
        if (fromAcc) {
          fromAcc.balanceCents += existing.amountCents;
          fromAcc.updatedAt = now;
          accountsStore.put(fromAcc);
        }
      };

      const toReq = accountsStore.get(existing.toAccountId);
      toReq.onsuccess = () => {
        const toAcc = toReq.result as Account;
        if (toAcc) {
          toAcc.balanceCents -= existing.amountCents;
          toAcc.updatedAt = now;
          accountsStore.put(toAcc);
        }
      };
    }
  });
}

/**
 * Add contribution or withdrawal to savings goal atomically
 */
export async function addGoalMovement(params: {
  goalId: string;
  accountId: string;
  amountCents: number;
  type: 'deposit' | 'withdrawal';
  date: string;
  notes?: string;
}): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  const contributionId = `gc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['savingsGoals', 'accounts', 'goalContributions', 'transactions'], 'readwrite');
    const goalsStore = tx.objectStore('savingsGoals');
    const accStore = tx.objectStore('accounts');
    const contStore = tx.objectStore('goalContributions');
    const txStore = tx.objectStore('transactions');

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    // 1. Record contribution
    contStore.add({
      id: contributionId,
      goalId: params.goalId,
      accountId: params.accountId,
      amountCents: params.amountCents,
      type: params.type,
      date: params.date,
      notes: params.notes,
      createdAt: now,
    });

    // 2. Update Goal current amount
    const goalReq = goalsStore.get(params.goalId);
    goalReq.onsuccess = () => {
      const goal = goalReq.result as SavingsGoal;
      if (goal) {
        if (params.type === 'deposit') {
          goal.currentAmountCents += params.amountCents;
        } else {
          goal.currentAmountCents = Math.max(0, goal.currentAmountCents - params.amountCents);
        }
        goal.isCompleted = goal.currentAmountCents >= goal.targetAmountCents;
        goalsStore.put(goal);

        // Also record a mirror transaction for visibility
        txStore.add({
          id: `tx-goal-${Date.now()}`,
          type: params.type === 'deposit' ? 'expense' : 'income',
          description: `${params.type === 'deposit' ? 'Depósito para meta' : 'Resgate de meta'}: ${goal.name}`,
          amountCents: params.amountCents,
          date: params.date,
          accountId: params.accountId,
          notes: params.notes,
          isPaid: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    };

    // 3. Update account balance (deposit subtracts available funds, withdrawal increases)
    const accReq = accStore.get(params.accountId);
    accReq.onsuccess = () => {
      const acc = accReq.result as Account;
      if (acc) {
        if (params.type === 'deposit') {
          acc.balanceCents -= params.amountCents;
        } else {
          acc.balanceCents += params.amountCents;
        }
        acc.updatedAt = now;
        accStore.put(acc);
      }
    };
  });
}

/**
 * Record a debt payment atomically
 */
export async function addDebtPayment(params: {
  debtId: string;
  accountId: string;
  amountCents: number;
  date: string;
  notes?: string;
}): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  const paymentId = `dp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['debts', 'debtPayments', 'accounts', 'transactions'], 'readwrite');
    const debtsStore = tx.objectStore('debts');
    const payStore = tx.objectStore('debtPayments');
    const accStore = tx.objectStore('accounts');
    const txStore = tx.objectStore('transactions');

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    payStore.add({
      id: paymentId,
      debtId: params.debtId,
      accountId: params.accountId,
      amountCents: params.amountCents,
      date: params.date,
      notes: params.notes,
      createdAt: now,
    });

    const debtReq = debtsStore.get(params.debtId);
    debtReq.onsuccess = () => {
      const debt = debtReq.result as Debt;
      if (debt) {
        debt.currentBalanceCents = Math.max(0, debt.currentBalanceCents - params.amountCents);
        if (debt.currentBalanceCents === 0) {
          debt.status = 'paid';
        } else {
          debt.status = 'partially_paid';
        }
        debtsStore.put(debt);

        // Account balance movement:
        // If owed_by_me, paying decreases my account balance (expense)
        // If owed_to_me, receiving payment increases my account balance (income)
        const isExpense = debt.type === 'owed_by_me';

        const accReq = accStore.get(params.accountId);
        accReq.onsuccess = () => {
          const acc = accReq.result as Account;
          if (acc) {
            if (isExpense) {
              acc.balanceCents -= params.amountCents;
            } else {
              acc.balanceCents += params.amountCents;
            }
            acc.updatedAt = now;
            accStore.put(acc);
          }
        };

        // Mirror transaction in history
        txStore.add({
          id: `tx-debt-${Date.now()}`,
          type: isExpense ? 'expense' : 'income',
          description: isExpense ? `Pagamento de dívida a ${debt.personName}` : `Recebimento de dívida de ${debt.personName}`,
          amountCents: params.amountCents,
          date: params.date,
          accountId: params.accountId,
          notes: params.notes,
          isPaid: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    };
  });
}

/**
 * Mark a planned expense as paid: converts to actual transaction with account debit
 */
export async function payPlannedExpense(plannedId: string, paidDate: string): Promise<void> {
  const planned = await getByIdFromStore<PlannedExpense>('plannedExpenses', plannedId);
  if (!planned || planned.isPaid) return;

  // Add real transaction
  await addTransaction({
    type: 'expense',
    description: planned.description,
    amountCents: planned.amountCents,
    date: paidDate || new Date().toISOString().split('T')[0],
    categoryId: planned.categoryId,
    accountId: planned.accountId,
    notes: planned.notes ? `[Planeado] ${planned.notes}` : '[Planeado]',
    isPaid: true,
  });

  // Mark planned expense as paid
  planned.isPaid = true;
  await putInStore('plannedExpenses', planned);
}

// -------------------------------------------------------------
// SEED INITIAL ANGOLAN DATA IF DATABASE IS EMPTY
// -------------------------------------------------------------

export async function seedInitialDataIfEmpty(): Promise<boolean> {
  const existingAccounts = await getAllFromStore<Account>('accounts');
  if (existingAccounts.length > 0) {
    return false; // Already seeded
  }

  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);

  // 1. Initial Angolan Accounts
  const initialAccounts: Account[] = [
    {
      id: 'acc-bai',
      name: 'Conta Ordenado BAI',
      type: 'bank',
      balanceCents: 45000000, // 450.000,00 Kz
      institution: 'Banco Angolano de Investimentos (BAI)',
      accountNumber: 'AO06.0040.0000.1234.5678.9',
      color: '#0284c7', // Sky blue
      icon: 'landmark',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'acc-express',
      name: 'Multicaixa Express',
      type: 'wallet',
      balanceCents: 6500000, // 65.000,00 Kz
      institution: 'EMIS / Multicaixa',
      color: '#10b981', // Emerald
      icon: 'smartphone',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'acc-cash',
      name: 'Carteira / Dinheiro Físico',
      type: 'cash',
      balanceCents: 2000000, // 20.000,00 Kz
      institution: 'Numerário',
      color: '#f59e0b', // Amber
      icon: 'wallet',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'acc-savings',
      name: 'Conta Poupança BFA',
      type: 'savings',
      balanceCents: 25000000, // 250.000,00 Kz
      institution: 'Banco de Fomento Angola (BFA)',
      accountNumber: 'AO06.0006.0000.9876.5432.1',
      color: '#8b5cf6', // Violet
      icon: 'piggy-bank',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const acc of initialAccounts) {
    await putInStore('accounts', acc);
  }

  // 2. Standard Angolan Categories
  const initialCategories: Category[] = [
    // Income
    { id: 'cat-salario', name: 'Salário & Vencimento', type: 'income', icon: 'briefcase', color: '#10b981', isSystem: true },
    { id: 'cat-freelance', name: 'Freelance & Consultoria', type: 'income', icon: 'laptop', color: '#06b6d4', isSystem: true },
    { id: 'cat-negocio', name: 'Negócios & Comércio', type: 'income', icon: 'store', color: '#3b82f6', isSystem: true },
    { id: 'cat-rendas', name: 'Investimentos & Juros', type: 'income', icon: 'trending-up', color: '#8b5cf6', isSystem: true },
    { id: 'cat-outros-rec', name: 'Outras Receitas', type: 'income', icon: 'plus-circle', color: '#64748b', isSystem: true },

    // Expenses
    { id: 'cat-alimentacao', name: 'Alimentação & Supermercado', type: 'expense', icon: 'shopping-cart', color: '#ef4444', isSystem: true },
    { id: 'cat-habitacao', name: 'Habitação & Renda', type: 'expense', icon: 'home', color: '#f97316', isSystem: true },
    { id: 'cat-transportes', name: 'Transportes & Combustível', type: 'expense', icon: 'car', color: '#eab308', isSystem: true },
    { id: 'cat-educacao', name: 'Educação & Cursos', type: 'expense', icon: 'graduation-cap', color: '#3b82f6', isSystem: true },
    { id: 'cat-saude', name: 'Saúde & Farmácia', type: 'expense', icon: 'heart-pulse', color: '#ec4899', isSystem: true },
    { id: 'cat-tecnologia', name: 'Tecnologia & Internet', type: 'expense', icon: 'wifi', color: '#06b6d4', isSystem: true },
    { id: 'cat-lazer', name: 'Lazer & Restaurantes', type: 'expense', icon: 'coffee', color: '#a855f7', isSystem: true },
    { id: 'cat-familia', name: 'Família & Apoio', type: 'expense', icon: 'users', color: '#f43f5e', isSystem: true },
    { id: 'cat-outras-desp', name: 'Outras Despesas', type: 'expense', icon: 'tag', color: '#64748b', isSystem: true },
  ];

  for (const cat of initialCategories) {
    await putInStore('categories', cat);
  }

  // 3. Budgets for current month
  const initialBudgets: Budget[] = [
    {
      id: `bgt-alim-${currentMonth}`,
      categoryId: 'cat-alimentacao',
      monthYear: currentMonth,
      limitCents: 15000000, // 150.000,00 Kz
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `bgt-transp-${currentMonth}`,
      categoryId: 'cat-transportes',
      monthYear: currentMonth,
      limitCents: 5000000, // 50.000,00 Kz
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `bgt-tec-${currentMonth}`,
      categoryId: 'cat-tecnologia',
      monthYear: currentMonth,
      limitCents: 3000000, // 30.000,00 Kz
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `bgt-lazer-${currentMonth}`,
      categoryId: 'cat-lazer',
      monthYear: currentMonth,
      limitCents: 4000000, // 40.000,00 Kz
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const bgt of initialBudgets) {
    await putInStore('budgets', bgt);
  }

  // 4. Sample Transactions
  const initialTransactions: Omit<Transaction, 'createdAt' | 'updatedAt'>[] = [
    {
      id: 'tx-init-1',
      type: 'income',
      description: 'Salário Mensal',
      amountCents: 50000000, // 500.000,00 Kz
      date: `${currentMonth}-01`,
      categoryId: 'cat-salario',
      accountId: 'acc-bai',
      source: 'Empresa Principal',
      isPaid: true,
    },
    {
      id: 'tx-init-2',
      type: 'expense',
      description: 'Supermercado Kero / Candando',
      amountCents: 4250000, // 42.500,00 Kz
      date: `${currentMonth}-02`,
      categoryId: 'cat-alimentacao',
      accountId: 'acc-express',
      notes: 'Compras da semana',
      isPaid: true,
    },
    {
      id: 'tx-init-3',
      type: 'expense',
      description: 'Abastecimento Sonangol',
      amountCents: 1500000, // 15.000,00 Kz
      date: `${currentMonth}-03`,
      categoryId: 'cat-transportes',
      accountId: 'acc-express',
      isPaid: true,
    },
    {
      id: 'tx-init-4',
      type: 'expense',
      description: 'Pacote TVCabo / Zap Fibra',
      amountCents: 2200000, // 22.000,00 Kz
      date: `${currentMonth}-04`,
      categoryId: 'cat-tecnologia',
      accountId: 'acc-bai',
      isPaid: true,
    },
  ];

  for (const tx of initialTransactions) {
    await putInStore('transactions', {
      ...tx,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 5. Savings Goal
  const initialGoal: SavingsGoal = {
    id: 'goal-fundo-emergencia',
    name: 'Fundo de Emergência',
    targetAmountCents: 50000000, // 500.000,00 Kz
    currentAmountCents: 25000000, // 250.000,00 Kz
    targetDate: '2026-12-31',
    description: 'Reserva de 6 meses de despesas básicas',
    color: '#8b5cf6',
    icon: 'shield-check',
    isCompleted: false,
    accountId: 'acc-savings',
    createdAt: now,
  };
  await putInStore('savingsGoals', initialGoal);

  // 6. Planned commitments
  const initialPlanned: PlannedExpense = {
    id: 'plan-renda',
    description: 'Renda de Casa - Próximo Mês',
    amountCents: 12000000, // 120.000,00 Kz
    dueDate: `${currentMonth}-28`,
    categoryId: 'cat-habitacao',
    accountId: 'acc-bai',
    isPaid: false,
    isRecurring: true,
    notes: 'Transferência para senhorio',
    createdAt: now,
  };
  await putInStore('plannedExpenses', initialPlanned);

  // 7. Notification
  const initialNotification: NotificationItem = {
    id: 'notif-welcome',
    title: 'Bem-vindo ao MyFinance Angola',
    message: 'A tua base de dados local está pronta. Os teus dados nunca saem do teu navegador.',
    type: 'success',
    date: today,
    isRead: false,
  };
  await putInStore('notifications', initialNotification);

  return true;
}

// -------------------------------------------------------------
// SEARCH HISTORY MANAGEMENT
// -------------------------------------------------------------

/**
 * Add an item to the dedicated searchHistory IndexedDB store.
 * Caps stored items at 30 to keep storage tidy and avoids consecutive duplicates.
 */
export async function addSearchHistoryItem(
  item: Omit<SearchHistoryItem, 'id' | 'timestamp'>
): Promise<SearchHistoryItem> {
  const db = await getDB();
  const existing = await getAllFromStore<SearchHistoryItem>('searchHistory');

  // Avoid adding immediately identical items
  const normalizedText = item.text.trim().toLowerCase();
  const duplicate = existing.find(
    e => e.type === item.type && e.text.trim().toLowerCase() === normalizedText
  );

  const now = new Date().toISOString();
  const newItem: SearchHistoryItem = {
    ...item,
    id: duplicate ? duplicate.id : `sh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now,
  };

  await putInStore('searchHistory', newItem);

  // If there are more than 30 items, prune the oldest
  if (existing.length >= 30) {
    const sorted = [...existing].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const toRemove = sorted.slice(0, existing.length - 29);
    for (const r of toRemove) {
      if (r.id !== newItem.id) {
        await deleteFromStore('searchHistory', r.id);
      }
    }
  }

  return newItem;
}

/**
 * Get recent search history items sorted by timestamp descending
 */
export async function getRecentSearchHistory(limit: number = 10): Promise<SearchHistoryItem[]> {
  const items = await getAllFromStore<SearchHistoryItem>('searchHistory');
  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Remove a specific search history item by ID
 */
export async function deleteSearchHistoryItem(id: string): Promise<void> {
  await deleteFromStore('searchHistory', id);
}

/**
 * Clear all search history items
 */
export async function clearSearchHistory(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('searchHistory', 'readwrite');
    const store = tx.objectStore('searchHistory');
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

