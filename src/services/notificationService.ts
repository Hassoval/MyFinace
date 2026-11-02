/**
 * MyFinance - Financial Notification & Alert Engine
 * Runs local checks for upcoming bills, budget limits, and debt due dates.
 */

import {
  getAllFromStore,
  putInStore,
  NotificationItem,
  Budget,
  Transaction,
  PlannedExpense,
  Debt,
} from './database';
import { calculateBudgetUtilization, formatKwanza } from './calculations';

export async function runFinancialHealthChecks(): Promise<NotificationItem[]> {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);

  const [notifications, budgets, transactions, plannedExpenses, debts] = await Promise.all([
    getAllFromStore<NotificationItem>('notifications'),
    getAllFromStore<Budget>('budgets'),
    getAllFromStore<Transaction>('transactions'),
    getAllFromStore<PlannedExpense>('plannedExpenses'),
    getAllFromStore<Debt>('debts'),
  ]);

  const existingTitles = new Set(notifications.map(n => n.title));
  const newNotifs: NotificationItem[] = [];

  // 1. Check budget limits for current month
  const monthlyExpenses = transactions.filter(
    tx => tx.type === 'expense' && tx.isPaid !== false && tx.date.startsWith(currentMonth)
  );

  const currentBudgets = budgets.filter(b => b.monthYear === currentMonth);
  for (const bgt of currentBudgets) {
    const categorySpent = monthlyExpenses
      .filter(tx => tx.categoryId === bgt.categoryId)
      .reduce((sum, tx) => sum + tx.amountCents, 0);

    const util = calculateBudgetUtilization(bgt.limitCents, categorySpent);
    if (util.percentage >= 100) {
      const title = `Orçamento Excedido (${bgt.categoryId.replace('cat-', '')})`;
      if (!existingTitles.has(title)) {
        newNotifs.push({
          id: `notif-bgt-exc-${bgt.categoryId}-${currentMonth}`,
          title,
          message: `Atingiste ${util.percentage}% do limite orçamental nesta categoria. Gastos: ${formatKwanza(categorySpent)} de ${formatKwanza(bgt.limitCents)}.`,
          type: 'danger',
          date: today,
          isRead: false,
          link: '#/budgets',
        });
      }
    } else if (util.percentage >= 90) {
      const title = `Atenção ao Orçamento (${bgt.categoryId.replace('cat-', '')})`;
      if (!existingTitles.has(title)) {
        newNotifs.push({
          id: `notif-bgt-warn-${bgt.categoryId}-${currentMonth}`,
          title,
          message: `Já utilizaste ${util.percentage}% do limite orçamental planeado. Restam ${formatKwanza(util.remainingCents)}.`,
          type: 'warning',
          date: today,
          isRead: false,
          link: '#/budgets',
        });
      }
    }
  }

  // 2. Check upcoming or overdue planned commitments
  const nowMs = new Date(today).getTime();
  for (const plan of plannedExpenses) {
    if (plan.isPaid) continue;
    const dueMs = new Date(plan.dueDate).getTime();
    const diffDays = Math.round((dueMs - nowMs) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const title = `Compromisso em Atraso: ${plan.description}`;
      if (!existingTitles.has(title)) {
        newNotifs.push({
          id: `notif-plan-overdue-${plan.id}`,
          title,
          message: `O pagamento de ${formatKwanza(plan.amountCents)} venceu a ${plan.dueDate}. Regulariza logo que possível.`,
          type: 'danger',
          date: today,
          isRead: false,
          link: '#/planning',
        });
      }
    } else if (diffDays <= 3) {
      const title = `Pagamento Próximo: ${plan.description}`;
      if (!existingTitles.has(title)) {
        newNotifs.push({
          id: `notif-plan-soon-${plan.id}`,
          title,
          message: `Vencimento em ${diffDays === 0 ? 'hoje' : `${diffDays} dia(s)`}: ${formatKwanza(plan.amountCents)}.`,
          type: 'warning',
          date: today,
          isRead: false,
          link: '#/planning',
        });
      }
    }
  }

  // 3. Check debts
  for (const debt of debts) {
    if (debt.status === 'paid' || !debt.dueDate) continue;
    const dueMs = new Date(debt.dueDate).getTime();
    const diffDays = Math.round((dueMs - nowMs) / (1000 * 60 * 60 * 24));

    if (diffDays <= 3 && diffDays >= 0) {
      const isOwed = debt.type === 'owed_by_me';
      const title = isOwed ? `Vencimento de Dívida: ${debt.personName}` : `Cobrança Agendada: ${debt.personName}`;
      if (!existingTitles.has(title)) {
        newNotifs.push({
          id: `notif-debt-due-${debt.id}`,
          title,
          message: `Saldo pendente: ${formatKwanza(debt.currentBalanceCents)}. Data limite: ${debt.dueDate}.`,
          type: isOwed ? 'warning' : 'info',
          date: today,
          isRead: false,
          link: '#/debts',
        });
      }
    }
  }

  for (const n of newNotifs) {
    await putInStore('notifications', n);
  }

  return [...notifications, ...newNotifs];
}
