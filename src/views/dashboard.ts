/**
 * MyFinance - Main Dashboard View
 * Provides financial summary, real-time balances, income vs expenses chart,
 * category distribution, recent transactions, upcoming commitments, and insights.
 */

import {
  getAllFromStore,
  Account,
  Transaction,
  Category,
  PlannedExpense,
  SavingsGoal,
  Budget,
} from '../services/database';
import {
  calculateAccountBalances,
  calculatePeriodSummary,
  calculateBudgetUtilization,
  formatKwanza,
} from '../services/calculations';
import { isPrivacyModeActive } from '../services/auth';
import { renderIncomeExpenseBarChart, renderCategoryDoughnutChart } from '../utils/charts';
import { getIcon } from '../utils/icons';
import { formatDateDisplay } from '../services/backup';
import { openTransactionModal } from '../components/modals';

export async function renderDashboard(container: HTMLElement, onNavigate: (route: string) => void): Promise<void> {
  const [
    accounts,
    transactions,
    categories,
    plannedExpenses,
    savingsGoals,
    budgets,
  ] = await Promise.all([
    getAllFromStore<Account>('accounts'),
    getAllFromStore<Transaction>('transactions'),
    getAllFromStore<Category>('categories'),
    getAllFromStore<PlannedExpense>('plannedExpenses'),
    getAllFromStore<SavingsGoal>('savingsGoals'),
    getAllFromStore<Budget>('budgets'),
  ]);

  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const isMasked = isPrivacyModeActive();
  const isDark = document.documentElement.classList.contains('dark');

  // Time & Period logic
  const now = new Date();
  const currentMonthKey = now.toISOString().slice(0, 7); // YYYY-MM

  // Balances
  const balances = calculateAccountBalances(accounts);

  // Period transactions (Default: current month)
  const currentMonthTransactions = transactions.filter(
    tx => tx.date.startsWith(currentMonthKey) && tx.isPaid !== false
  );
  const periodSummary = calculatePeriodSummary(currentMonthTransactions);

  // Budgets utilization for current month
  const monthlyExpenses = currentMonthTransactions.filter(tx => tx.type === 'expense');
  const totalBudgetLimitCents = budgets
    .filter(b => b.monthYear === currentMonthKey)
    .reduce((sum, b) => sum + b.limitCents, 0);

  const budgetUtil = calculateBudgetUtilization(totalBudgetLimitCents, periodSummary.expenseCents);

  // Recent 5 transactions
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Upcoming 3 planned commitments
  const upcomingPlanned = plannedExpenses
    .filter(p => !p.isPaid)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 3);

  // Active savings goals
  const topGoals = savingsGoals.slice(0, 2);

  // Financial Insights calculations
  const insights: { text: string; type: 'success' | 'warning' | 'info' }[] = [];
  if (periodSummary.savingsRatePercentage >= 30) {
    insights.push({
      text: `Excelente taxa de poupança (${periodSummary.savingsRatePercentage}%). Estás a construir um futuro financeiro sólido!`,
      type: 'success',
    });
  } else if (periodSummary.savingsRatePercentage < 10 && periodSummary.incomeCents > 0) {
    insights.push({
      text: `Atenção: A tua taxa de poupança está em ${periodSummary.savingsRatePercentage}%. Tenta cortar despesas não essenciais.`,
      type: 'warning',
    });
  }

  if (budgetUtil.isExceeded) {
    insights.push({
      text: `Ultrapassaste o limite orçamental deste mês em ${formatKwanza(Math.abs(budgetUtil.remainingCents))}.`,
      type: 'warning',
    });
  }

  insights.push({
    text: `Tens ${formatKwanza(balances.reservedCents, { masked: isMasked })} protegidos em contas de poupança e reservas.`,
    type: 'info',
  });

  container.innerHTML = `
    <div class="space-y-6 pb-12">
      <!-- Welcome & Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Visão Geral</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Resumo financeiro e controlo de património em Angola.</p>
        </div>

        <div class="flex items-center gap-3">
          <button id="dash-quick-tx-btn" class="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all">
            ${getIcon('plus', 'w-4 h-4')} Nova Transação
          </button>
        </div>
      </div>

      <!-- Top Summary Cards (4 Columns) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Saldo Total -->
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs transition-all">
          <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider">Património Total</span>
            <div class="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              ${getIcon('landmark', 'w-4 h-4')}
            </div>
          </div>
          <div class="text-2xl font-extrabold text-slate-900 dark:text-white">
            ${formatKwanza(balances.totalBalanceCents, { masked: isMasked })}
          </div>
          <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Disponível: <strong class="text-slate-700 dark:text-slate-300">${formatKwanza(balances.availableCents, { masked: isMasked })}</strong></span>
            <span>Reservado: <strong class="text-violet-600 dark:text-violet-400">${formatKwanza(balances.reservedCents, { masked: isMasked })}</strong></span>
          </div>
        </div>

        <!-- Receitas do Mês -->
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs transition-all">
          <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider">Receitas (Este Mês)</span>
            <div class="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              ${getIcon('arrow-down-left', 'w-4 h-4')}
            </div>
          </div>
          <div class="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            +${formatKwanza(periodSummary.incomeCents, { masked: isMasked })}
          </div>
          <div class="mt-2 text-xs text-slate-500">
            <span>Total recebido no mês em curso</span>
          </div>
        </div>

        <!-- Despesas do Mês -->
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs transition-all">
          <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider">Despesas (Este Mês)</span>
            <div class="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              ${getIcon('arrow-up-right', 'w-4 h-4')}
            </div>
          </div>
          <div class="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            -${formatKwanza(periodSummary.expenseCents, { masked: isMasked })}
          </div>
          <div class="mt-2 text-xs text-slate-500">
            <span>Despesas pagas e liquidadas</span>
          </div>
        </div>

        <!-- Saldo Líquido / Poupança -->
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs transition-all">
          <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span class="text-xs font-semibold uppercase tracking-wider">Balanço Líquido</span>
            <div class="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
              ${getIcon('trending-up', 'w-4 h-4')}
            </div>
          </div>
          <div class="text-2xl font-extrabold ${periodSummary.netBalanceCents >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}">
            ${formatKwanza(periodSummary.netBalanceCents, { masked: isMasked })}
          </div>
          <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Taxa de poupança: <strong class="text-emerald-600 dark:text-emerald-400">${periodSummary.savingsRatePercentage}%</strong></span>
          </div>
        </div>
      </div>

      <!-- Budget Progress Bar Banner -->
      <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-900 dark:text-white">Consumo Global do Orçamento</span>
            <span class="text-xs px-2 py-0.5 rounded-full ${budgetUtil.status === 'exceeded' ? 'bg-rose-100 dark:bg-rose-950 text-rose-600' : budgetUtil.status === 'danger' ? 'bg-amber-100 dark:bg-amber-950 text-amber-600' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'} font-semibold">
              ${budgetUtil.percentage}% consumido
            </span>
          </div>
          <span class="text-xs text-slate-500">
            ${formatKwanza(periodSummary.expenseCents, { masked: isMasked })} de ${formatKwanza(totalBudgetLimitCents, { masked: isMasked })}
          </span>
        </div>
        <div class="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500 ${budgetUtil.status === 'exceeded' ? 'bg-rose-500' : budgetUtil.status === 'danger' ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${Math.min(100, budgetUtil.percentage)}%"></div>
        </div>
      </div>

      <!-- Charts Section (2 Columns) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Receitas vs Despesas (Bar Chart, 2 cols) -->
        <div class="lg:col-span-2 p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-base font-semibold text-slate-900 dark:text-white">Receitas vs Despesas</h2>
              <p class="text-xs text-slate-500">Evolução financeira recente</p>
            </div>
            <button id="dash-view-reports-btn" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
              Ver Relatório Completo &rarr;
            </button>
          </div>
          <div class="relative h-64 w-full">
            <canvas id="chart-income-expense"></canvas>
          </div>
        </div>

        <!-- Despesas por Categoria (Doughnut Chart, 1 col) -->
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col">
          <div class="mb-4">
            <h2 class="text-base font-semibold text-slate-900 dark:text-white">Distribuição de Despesas</h2>
            <p class="text-xs text-slate-500">Principais categorias deste mês</p>
          </div>
          <div class="relative h-64 w-full flex items-center justify-center">
            <canvas id="chart-categories-doughnut"></canvas>
          </div>
        </div>
      </div>

      <!-- Bottom Columns: Recent Transactions & Commitments/Savings -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Recent Transactions (2 cols) -->
        <div class="lg:col-span-2 p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-base font-semibold text-slate-900 dark:text-white">Últimas Transações</h2>
              <p class="text-xs text-slate-500">Movimentações mais recentes</p>
            </div>
            <button id="dash-all-tx-btn" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
              Ver Todas &rarr;
            </button>
          </div>

          <div class="space-y-3 divide-y divide-slate-100 dark:divide-slate-800/80">
            ${recentTransactions.length === 0 ? `
              <div class="py-8 text-center text-sm text-slate-400">
                Ainda não existem transações registadas.
              </div>` : ''}

            ${recentTransactions.map(tx => {
              const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : null;
              const acc = accountMap.get(tx.accountId);
              const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : null;

              const isInc = tx.type === 'income';
              const isExp = tx.type === 'expense';
              const isTrans = tx.type === 'transfer';

              const iconName = isTrans ? 'arrow-left-right' : cat ? cat.icon : isInc ? 'arrow-down-left' : 'shopping-cart';
              const iconColor = isTrans ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400' : isInc ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400';

              return `
                <div class="pt-3 first:pt-0 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="p-2.5 rounded-xl ${iconColor} shrink-0">
                      ${getIcon(iconName, 'w-4 h-4')}
                    </div>
                    <div class="truncate">
                      <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">${tx.description}</p>
                      <p class="text-xs text-slate-500 truncate">
                        ${isTrans ? `${acc?.name || 'Origem'} &rarr; ${toAcc?.name || 'Destino'}` : `${cat?.name || 'Sem categoria'} &bull; ${acc?.name || ''}`}
                      </p>
                    </div>
                  </div>

                  <div class="text-right shrink-0">
                    <p class="text-sm font-bold ${isInc ? 'text-emerald-600 dark:text-emerald-400' : isExp ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'}">
                      ${isInc ? '+' : isExp ? '-' : ''}${formatKwanza(tx.amountCents, { masked: isMasked })}
                    </p>
                    <p class="text-xs text-slate-400">${formatDateDisplay(tx.date)}</p>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Right Side: Upcoming Commitments & Savings Goals (1 col) -->
        <div class="space-y-6">
          <!-- Upcoming Payments -->
          <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Próximos Compromissos</h2>
              <button id="dash-view-planning-btn" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                Agenda &rarr;
              </button>
            </div>

            <div class="space-y-2.5">
              ${upcomingPlanned.length === 0 ? `
                <p class="text-xs text-slate-400 py-3 text-center">Nenhum compromisso pendente.</p>` : ''}

              ${upcomingPlanned.map(plan => `
                <div class="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-xs font-semibold text-slate-900 dark:text-white truncate">${plan.description}</p>
                    <p class="text-[11px] text-slate-500">Vencimento: ${formatDateDisplay(plan.dueDate)}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <span class="text-xs font-bold text-rose-600 dark:text-rose-400">${formatKwanza(plan.amountCents, { masked: isMasked })}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Savings Goal Progress -->
          <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Metas de Poupança</h2>
              <button id="dash-view-savings-btn" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                Ver Todas &rarr;
              </button>
            </div>

            <div class="space-y-3">
              ${topGoals.length === 0 ? `
                <p class="text-xs text-slate-400 py-3 text-center">Nenhuma meta configurada.</p>` : ''}

              ${topGoals.map(goal => {
                const pct = Math.min(100, Math.round((goal.currentAmountCents / goal.targetAmountCents) * 100));
                return `
                  <div class="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl space-y-2">
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-semibold text-slate-900 dark:text-white truncate">${goal.name}</span>
                      <span class="font-bold text-violet-600 dark:text-violet-400">${pct}%</span>
                    </div>
                    <div class="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div class="h-full bg-violet-600 rounded-full" style="width: ${pct}%"></div>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-slate-500">
                      <span>${formatKwanza(goal.currentAmountCents, { masked: isMasked })}</span>
                      <span>Meta: ${formatKwanza(goal.targetAmountCents, { masked: isMasked })}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Financial Insights Card -->
          <div class="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
            <div class="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
              ${getIcon('shield-check', 'w-4 h-4')} Dica Financeira MyFinance
            </div>
            <p class="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              ${insights[0]?.text || 'Mantém os teus registos diários atualizados para teres controlo absoluto sobre o teu orçamento.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Chart 1: Income vs Expense (Mocking recent 4 months from transactions or default series)
  const monthLabels = ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov'];
  const incomeSeries = [450000, 480000, 520000, 500000, 490000, periodSummary.incomeCents / 100];
  const expenseSeries = [320000, 390000, 410000, 340000, 370000, periodSummary.expenseCents / 100];

  renderIncomeExpenseBarChart(
    'chart-income-expense',
    monthLabels,
    incomeSeries,
    expenseSeries,
    isDark
  );

  // Chart 2: Category Distribution
  const catSums: { [id: string]: number } = {};
  monthlyExpenses.forEach(tx => {
    if (tx.categoryId) {
      catSums[tx.categoryId] = (catSums[tx.categoryId] || 0) + tx.amountCents;
    }
  });

  const catLabels: string[] = [];
  const catData: number[] = [];
  const catColors: string[] = [];

  Object.entries(catSums).forEach(([catId, cents]) => {
    const cat = categoryMap.get(catId);
    catLabels.push(cat ? cat.name : 'Geral');
    catData.push(cents / 100);
    catColors.push(cat ? cat.color : '#3b82f6');
  });

  if (catData.length === 0) {
    catLabels.push('Sem despesas');
    catData.push(1);
    catColors.push('#94a3b8');
  }

  renderCategoryDoughnutChart(
    'chart-categories-doughnut',
    catLabels,
    catData,
    catColors,
    isDark
  );

  // Event Listeners
  container.querySelector('#dash-quick-tx-btn')?.addEventListener('click', () => {
    openTransactionModal({
      onSaved: () => renderDashboard(container, onNavigate),
    });
  });

  container.querySelector('#dash-all-tx-btn')?.addEventListener('click', () => onNavigate('#/transactions'));
  container.querySelector('#dash-view-reports-btn')?.addEventListener('click', () => onNavigate('#/reports'));
  container.querySelector('#dash-view-planning-btn')?.addEventListener('click', () => onNavigate('#/planning'));
  container.querySelector('#dash-view-savings-btn')?.addEventListener('click', () => onNavigate('#/savings'));
}
