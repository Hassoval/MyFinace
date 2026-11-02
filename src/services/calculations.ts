/**
 * MyFinance - Pure calculation engine for personal finance
 * All monetary calculations operate strictly in integer cents (1 Kz = 100 cêntimos)
 * to avoid floating-point rounding errors.
 */

export interface FormattedMoneyOptions {
  showCurrency?: boolean;
  masked?: boolean;
  showSign?: boolean;
}

/**
 * Format integer cents into Angolan Kwanza string (e.g., 12500050 -> "125.000,50 Kz")
 */
export function formatKwanza(cents: number, options: FormattedMoneyOptions = {}): string {
  const { showCurrency = true, masked = false, showSign = false } = options;

  if (masked) {
    return '•••••••• Kz';
  }

  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const units = Math.floor(absCents / 100);
  const remainder = absCents % 100;

  // Format integer part with dots for thousands (Portuguese convention: 1.000.000)
  const unitsFormatted = units.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centsFormatted = remainder.toString().padStart(2, '0');

  const sign = isNegative ? '-' : showSign && cents > 0 ? '+' : '';
  const formattedNumber = `${sign}${unitsFormatted},${centsFormatted}`;

  return showCurrency ? `${formattedNumber} Kz` : formattedNumber;
}

/**
 * Parses user input string (e.g. "1.250,50", "45.000", "50000 Kz", "1250.50") to integer cents
 */
export function parseKwanzaToCents(input: string | number): number {
  if (typeof input === 'number') {
    return Math.round(input * 100);
  }
  if (!input || typeof input !== 'string') return 0;

  let cleaned = input.trim().replace(/Kz|AOA/gi, '').trim();

  // If both . and , are present (e.g. "1.250,50" or "1,250.50")
  if (cleaned.includes('.') && cleaned.includes(',')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // European/Angolan: 1.250,50 -> remove dots, comma to dot
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US style: 1,250.50 -> remove commas
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Only comma: 1250,50 -> 1250.50
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes('.')) {
    // Check if dot looks like a thousand separator: e.g. "45.000" or "1.500.000"
    // Standard thousands separator has 3 digits following: \.\d{3}(\.|\b)
    const dotGroups = cleaned.split('.');
    const isThousandsDot = dotGroups.length > 1 && dotGroups.slice(1).every(group => group.length === 3);
    if (isThousandsDot) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const parsedFloat = parseFloat(cleaned);
  if (isNaN(parsedFloat)) return 0;
  return Math.round(parsedFloat * 100);
}

export function centsToUnits(cents: number): number {
  return cents / 100;
}

export interface AccountLike {
  id: string;
  type: string;
  balanceCents: number;
  isArchived?: boolean;
}

export interface TransactionLike {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amountCents: number;
  date: string;
  accountId?: string;
  toAccountId?: string;
  categoryId?: string;
  isPaid?: boolean;
}

export interface BudgetLike {
  id: string;
  categoryId: string;
  limitCents: number;
}

/**
 * Calculate net totals for a given list of accounts
 */
export function calculateAccountBalances(accounts: AccountLike[]) {
  const activeAccounts = accounts.filter(a => !a.isArchived);
  const totalBalanceCents = activeAccounts.reduce((sum, a) => sum + a.balanceCents, 0);

  // Reserved = savings accounts
  const reservedCents = activeAccounts
    .filter(a => a.type === 'savings')
    .reduce((sum, a) => sum + a.balanceCents, 0);

  // Available = total minus reserved savings
  const availableCents = totalBalanceCents - reservedCents;

  return {
    totalBalanceCents,
    availableCents,
    reservedCents,
  };
}

/**
 * Calculate income, expense and savings rate for a transaction period
 */
export function calculatePeriodSummary(transactions: TransactionLike[]) {
  let incomeCents = 0;
  let expenseCents = 0;

  for (const tx of transactions) {
    if (tx.isPaid === false) continue; // Planned but unpaid does not count toward actual balance
    if (tx.type === 'income') {
      incomeCents += tx.amountCents;
    } else if (tx.type === 'expense') {
      expenseCents += tx.amountCents;
    }
    // Note: internal transfers between user accounts are NEVER counted as income or expense!
  }

  const netBalanceCents = incomeCents - expenseCents;
  const savingsRatePercentage = incomeCents > 0 
    ? Math.max(0, Math.round(((incomeCents - expenseCents) / incomeCents) * 100)) 
    : 0;

  return {
    incomeCents,
    expenseCents,
    netBalanceCents,
    savingsRatePercentage,
  };
}

/**
 * Budget utilization computation
 */
export function calculateBudgetUtilization(
  budgetLimitCents: number,
  spentCents: number
): {
  percentage: number;
  remainingCents: number;
  isExceeded: boolean;
  status: 'normal' | 'warning' | 'danger' | 'exceeded';
} {
  if (budgetLimitCents <= 0) {
    return {
      percentage: spentCents > 0 ? 100 : 0,
      remainingCents: 0,
      isExceeded: spentCents > 0,
      status: spentCents > 0 ? 'exceeded' : 'normal',
    };
  }

  const percentage = Math.round((spentCents / budgetLimitCents) * 100);
  const remainingCents = budgetLimitCents - spentCents;
  const isExceeded = spentCents > budgetLimitCents;

  let status: 'normal' | 'warning' | 'danger' | 'exceeded' = 'normal';
  if (percentage >= 100) {
    status = 'exceeded';
  } else if (percentage >= 90) {
    status = 'danger';
  } else if (percentage >= 75) {
    status = 'warning';
  }

  return {
    percentage,
    remainingCents,
    isExceeded,
    status,
  };
}

/**
 * Verifies atomic balance adjustment for transfers:
 * From Account decreases by amount, To Account increases by amount.
 * Total net balance of both accounts MUST remain invariant!
 */
export function executeTransferBalanceCheck(
  fromBalanceCents: number,
  toBalanceCents: number,
  transferAmountCents: number
): {
  newFromBalanceCents: number;
  newToBalanceCents: number;
  isTotalPreserved: boolean;
} {
  const newFromBalanceCents = fromBalanceCents - transferAmountCents;
  const newToBalanceCents = toBalanceCents + transferAmountCents;
  const originalTotal = fromBalanceCents + toBalanceCents;
  const newTotal = newFromBalanceCents + newToBalanceCents;

  return {
    newFromBalanceCents,
    newToBalanceCents,
    isTotalPreserved: originalTotal === newTotal,
  };
}

/**
 * Savings goal progress
 */
export function calculateGoalProgress(currentAmountCents: number, targetAmountCents: number) {
  if (targetAmountCents <= 0) return { percentage: 100, remainingCents: 0, isComplete: true };
  const percentage = Math.min(100, Math.max(0, Math.round((currentAmountCents / targetAmountCents) * 100)));
  const remainingCents = Math.max(0, targetAmountCents - currentAmountCents);
  return {
    percentage,
    remainingCents,
    isComplete: currentAmountCents >= targetAmountCents,
  };
}
