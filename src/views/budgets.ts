/**
 * MyFinance - Budget Management View
 * Monthly budget limits per category, visual threshold indicators, and variance tracking.
 */

import {
  getAllFromStore,
  putInStore,
  Budget,
  Category,
  Transaction,
} from '../services/database';
import {
  calculateBudgetUtilization,
  formatKwanza,
  parseKwanzaToCents,
} from '../services/calculations';
import { isPrivacyModeActive } from '../services/auth';
import { getIcon } from '../utils/icons';
import { showModal } from '../components/modals';

export async function renderBudgets(container: HTMLElement, onNavigate: (route: string) => void): Promise<void> {
  const [categories, budgets, transactions] = await Promise.all([
    getAllFromStore<Category>('categories'),
    getAllFromStore<Budget>('budgets'),
    getAllFromStore<Transaction>('transactions'),
  ]);

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const isMasked = isPrivacyModeActive();

  const now = new Date();
  let selectedMonth = now.toISOString().slice(0, 7); // YYYY-MM

  const renderContent = () => {
    // Expenses in selected month
    const monthlyExpenses = transactions.filter(
      tx => tx.type === 'expense' && tx.isPaid !== false && tx.date.startsWith(selectedMonth)
    );

    // Budgets for this month
    const currentMonthBudgets = budgets.filter(b => b.monthYear === selectedMonth);
    const budgetMap = new Map(currentMonthBudgets.map(b => [b.categoryId, b]));

    // Total calculations
    let totalLimitCents = 0;
    let totalSpentCents = 0;

    const items = expenseCategories.map(cat => {
      const budget = budgetMap.get(cat.id);
      const limitCents = budget ? budget.limitCents : 0;
      const spentCents = monthlyExpenses
        .filter(tx => tx.categoryId === cat.id)
        .reduce((sum, tx) => sum + tx.amountCents, 0);

      totalLimitCents += limitCents;
      totalSpentCents += spentCents;

      const util = calculateBudgetUtilization(limitCents, spentCents);
      return {
        cat,
        budget,
        limitCents,
        spentCents,
        util,
      };
    });

    const globalUtil = calculateBudgetUtilization(totalLimitCents, totalSpentCents);

    const contentDiv = container.querySelector('#budgets-content-area');
    if (!contentDiv) return;

    contentDiv.innerHTML = `
      <!-- Global Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Teto Orçamental Total</span>
          <p class="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            ${formatKwanza(totalLimitCents, { masked: isMasked })}
          </p>
        </div>

        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span class="text-xs font-semibold uppercase tracking-wider text-rose-600">Total Gasto Real</span>
          <p class="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
            ${formatKwanza(totalSpentCents, { masked: isMasked })}
          </p>
        </div>

        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span class="text-xs font-semibold uppercase tracking-wider text-emerald-600">Saldo Disponível no Orçamento</span>
          <p class="text-2xl font-extrabold ${globalUtil.remainingCents < 0 ? 'text-rose-600' : 'text-emerald-600'} mt-1">
            ${formatKwanza(globalUtil.remainingCents, { masked: isMasked })}
          </p>
        </div>
      </div>

      <!-- Categories Budget List -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div class="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 class="text-base font-bold text-slate-900 dark:text-white">Orçamentos por Categoria (${selectedMonth})</h2>
          <span class="text-xs text-slate-400">Clica em "Definir Limite" para ajustar</span>
        </div>

        <div class="divide-y divide-slate-100 dark:divide-slate-800">
          ${items.map(({ cat, limitCents, spentCents, util }) => {
            const statusBadge =
              util.status === 'exceeded'
                ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-600">Excedido</span>'
                : util.status === 'danger'
                ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-600">Alerta 90%</span>'
                : util.status === 'warning'
                ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 dark:bg-yellow-950 text-yellow-700">Atenção 75%</span>'
                : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600">No Limite</span>';

            const barColor =
              util.status === 'exceeded'
                ? 'bg-rose-500'
                : util.status === 'danger'
                ? 'bg-amber-500'
                : util.status === 'warning'
                ? 'bg-yellow-500'
                : 'bg-emerald-500';

            return `
              <div class="p-5 space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      ${getIcon(cat.icon || 'tag', 'w-4 h-4')}
                    </div>
                    <div>
                      <h4 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        ${cat.name} ${statusBadge}
                      </h4>
                      <p class="text-xs text-slate-500">
                        Gasto: <strong class="text-slate-700 dark:text-slate-300">${formatKwanza(spentCents, { masked: isMasked })}</strong> de 
                        ${limitCents > 0 ? formatKwanza(limitCents, { masked: isMasked }) : 'Sem limite definido'}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-3">
                    <div class="text-right">
                      <span class="text-xs font-bold ${util.remainingCents < 0 ? 'text-rose-600' : 'text-slate-600 dark:text-slate-400'}">
                        ${util.remainingCents < 0 ? `Excedido em ${formatKwanza(Math.abs(util.remainingCents), { masked: isMasked })}` : `Restam ${formatKwanza(util.remainingCents, { masked: isMasked })}`}
                      </span>
                      <p class="text-[11px] text-slate-400 font-semibold">${limitCents > 0 ? `${util.percentage}%` : '0%'}</p>
                    </div>

                    <button data-set-budget-cat="${cat.id}" class="px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-xl transition-colors">
                      Definir Limite
                    </button>
                  </div>
                </div>

                <!-- Progress bar -->
                <div class="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-300 ${barColor}" style="width: ${Math.min(100, util.percentage)}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Bind "Definir Limite" buttons
    contentDiv.querySelectorAll('[data-set-budget-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-set-budget-cat')!;
        const cat = categories.find(c => c.id === catId);
        if (!cat) return;

        const currentBudget = currentMonthBudgets.find(b => b.categoryId === catId);

        const bodyHtml = `
          <div class="space-y-4">
            <p class="text-xs text-slate-500">Define o montante máximo que planeias gastar em <strong>${cat.name}</strong> para o mês de <strong>${selectedMonth}</strong>.</p>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Limite Orçamental Mensal (Kz)
              </label>
              <input type="text" id="budget-limit-input" autofocus value="${currentBudget ? (currentBudget.limitCents / 100).toFixed(2).replace('.', ',') : ''}" placeholder="ex: 80.000,00" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold text-slate-900 dark:text-white focus:outline-none">
            </div>
          </div>
        `;

        const footerHtml = `
          <button id="modal-cancel" class="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">Cancelar</button>
          <button id="modal-save" class="px-5 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-medium">Guardar Limite</button>
        `;

        const modal = showModal(`Orçamento: ${cat.name}`, bodyHtml, footerHtml);

        modal.querySelector('#modal-cancel')?.addEventListener('click', () => modal.remove());
        modal.querySelector('#modal-save')?.addEventListener('click', async () => {
          const input = modal.querySelector('#budget-limit-input') as HTMLInputElement;
          const cents = parseKwanzaToCents(input.value);

          const budgetId = currentBudget ? currentBudget.id : `bgt-${catId}-${selectedMonth}`;
          const nowIso = new Date().toISOString();

          await putInStore('budgets', {
            id: budgetId,
            categoryId: catId,
            monthYear: selectedMonth,
            limitCents: cents,
            createdAt: currentBudget ? currentBudget.createdAt : nowIso,
            updatedAt: nowIso,
          });

          modal.remove();
          renderBudgets(container, onNavigate);
        });
      });
    });
  };

  container.innerHTML = `
    <div class="space-y-6 pb-12">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Orçamentos Mensais</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Define limites por categoria e evita gastos excessivos.</p>
        </div>

        <div class="flex items-center gap-3">
          <input type="month" id="budget-month-selector" value="${selectedMonth}" class="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none">
        </div>
      </div>

      <div id="budgets-content-area" class="space-y-6"></div>
    </div>
  `;

  const monthSelector = container.querySelector('#budget-month-selector') as HTMLInputElement;
  monthSelector.addEventListener('change', () => {
    selectedMonth = monthSelector.value;
    renderContent();
  });

  renderContent();
}
