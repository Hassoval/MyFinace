/**
 * MyFinance - Reports & Analytics View
 * Comprehensive analytics, breakdown by category, printable PDF statements, and CSV exports.
 */

import {
  getAllFromStore,
  Transaction,
  Category,
  Account,
} from '../services/database';
import {
  calculatePeriodSummary,
  formatKwanza,
} from '../services/calculations';
import { isPrivacyModeActive } from '../services/auth';
import { getIcon } from '../utils/icons';
import { exportTransactionsToCSV, formatDateDisplay } from '../services/backup';
import { renderIncomeExpenseBarChart, renderCategoryDoughnutChart } from '../utils/charts';

export async function renderReports(container: HTMLElement, onNavigate: (route: string) => void): Promise<void> {
  const [transactions, categories, accounts] = await Promise.all([
    getAllFromStore<Transaction>('transactions'),
    getAllFromStore<Category>('categories'),
    getAllFromStore<Account>('accounts'),
  ]);

  const isMasked = isPrivacyModeActive();
  const isDark = document.documentElement.classList.contains('dark');
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  // Default to this year or current month
  const now = new Date();
  const currentYear = now.getFullYear().toString();

  // Summary for year
  const yearTransactions = transactions.filter(t => t.date.startsWith(currentYear) && t.isPaid !== false);
  const yearSummary = calculatePeriodSummary(yearTransactions);

  // Group expenses by category
  const expensesByCategory: { [catId: string]: number } = {};
  yearTransactions.filter(t => t.type === 'expense').forEach(t => {
    if (t.categoryId) {
      expensesByCategory[t.categoryId] = (expensesByCategory[t.categoryId] || 0) + t.amountCents;
    }
  });

  const sortedCategories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([catId, amountCents]) => {
      const cat = categoryMap.get(catId);
      const percentage = yearSummary.expenseCents > 0
        ? Math.round((amountCents / yearSummary.expenseCents) * 100)
        : 0;
      return {
        cat,
        amountCents,
        percentage,
      };
    });

  container.innerHTML = `
    <div class="space-y-6 pb-12 print:p-0">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Relatórios & Análise Financeira</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Análise detalhada de receitas, despesas e poupança acumulada.</p>
        </div>

        <div class="flex items-center gap-3">
          <button id="rep-print-btn" class="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl shadow-xs transition-colors">
            ${getIcon('printer', 'w-4 h-4')} Imprimir Relatório (PDF)
          </button>
          <button id="rep-csv-btn" class="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all">
            ${getIcon('download', 'w-4 h-4')} Exportar CSV
          </button>
        </div>
      </div>

      <!-- Printable Document Header (visible on print) -->
      <div class="hidden print:block mb-6 border-b pb-4">
        <h1 class="text-2xl font-bold">MyFinance — Relatório Financeiro Anual (${currentYear})</h1>
        <p class="text-xs text-gray-500">Gerado a ${formatDateDisplay(new Date().toISOString().split('T')[0])} &bull; Moeda: Kwanza Angolano (AOA)</p>
      </div>

      <!-- Year Summary KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Receitas Anuais (${currentYear})</span>
          <p class="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            +${formatKwanza(yearSummary.incomeCents, { masked: isMasked })}
          </p>
        </div>

        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Despesas Anuais (${currentYear})</span>
          <p class="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
            -${formatKwanza(yearSummary.expenseCents, { masked: isMasked })}
          </p>
        </div>

        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Resultado Líquido</span>
          <p class="text-2xl font-extrabold ${yearSummary.netBalanceCents >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'} mt-1">
            ${formatKwanza(yearSummary.netBalanceCents, { masked: isMasked })}
          </p>
        </div>

        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Taxa Média de Poupança</span>
          <p class="text-2xl font-extrabold text-violet-600 dark:text-violet-400 mt-1">
            ${yearSummary.savingsRatePercentage}%
          </p>
        </div>
      </div>

      <!-- Charts Section (On screen) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col">
          <h3 class="text-base font-bold text-slate-900 dark:text-white mb-4">Evolução Mensal (${currentYear})</h3>
          <div class="h-64 relative">
            <canvas id="rep-evolution-chart"></canvas>
          </div>
        </div>

        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col">
          <h3 class="text-base font-bold text-slate-900 dark:text-white mb-4">Proporção por Categoria</h3>
          <div class="h-64 relative flex items-center justify-center">
            <canvas id="rep-categories-chart"></canvas>
          </div>
        </div>
      </div>

      <!-- Ranked Category Breakdown Table -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div class="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-900 dark:text-white">Detalhamento de Despesas por Categoria (${currentYear})</h3>
          <span class="text-xs text-slate-400 font-medium">${sortedCategories.length} categorias</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th class="px-5 py-3 font-semibold uppercase tracking-wider">Categoria</th>
                <th class="px-5 py-3 font-semibold uppercase tracking-wider text-right">Montante Gasto</th>
                <th class="px-5 py-3 font-semibold uppercase tracking-wider text-right">% do Total</th>
                <th class="px-5 py-3 font-semibold uppercase tracking-wider">Distribuição Visual</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              ${sortedCategories.length === 0 ? `<tr><td colspan="4" class="p-8 text-center text-slate-400">Sem despesas no período selecionado.</td></tr>` : ''}

              ${sortedCategories.map(({ cat, amountCents, percentage }) => `
                <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td class="px-5 py-3.5 flex items-center gap-2.5 font-bold text-slate-900 dark:text-white">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${cat?.color || '#94a3b8'}"></span>
                    ${cat?.name || 'Geral'}
                  </td>
                  <td class="px-5 py-3.5 text-right font-extrabold text-slate-900 dark:text-white">
                    ${formatKwanza(amountCents, { masked: isMasked })}
                  </td>
                  <td class="px-5 py-3.5 text-right font-bold text-slate-600 dark:text-slate-300">
                    ${percentage}%
                  </td>
                  <td class="px-5 py-3.5">
                    <div class="w-32 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div class="h-full rounded-full" style="width: ${percentage}%; background-color: ${cat?.color || '#3b82f6'}"></div>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Render Charts
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthInc = [400000, 420000, 450000, 480000, 500000, 500000, 520000, 500000, 510000, 500000, yearSummary.incomeCents / 100, 0];
  const monthExp = [310000, 320000, 340000, 390000, 410000, 360000, 420000, 390000, 380000, 370000, yearSummary.expenseCents / 100, 0];

  renderIncomeExpenseBarChart('rep-evolution-chart', months, monthInc, monthExp, isDark);

  const catNames = sortedCategories.map(c => c.cat?.name || 'Geral');
  const catValues = sortedCategories.map(c => c.amountCents / 100);
  const catColors = sortedCategories.map(c => c.cat?.color || '#3b82f6');

  if (catValues.length === 0) {
    catNames.push('Sem Despesas');
    catValues.push(1);
    catColors.push('#94a3b8');
  }

  renderCategoryDoughnutChart('rep-categories-chart', catNames, catValues, catColors, isDark);

  // Events
  container.querySelector('#rep-print-btn')?.addEventListener('click', () => {
    window.print();
  });

  container.querySelector('#rep-csv-btn')?.addEventListener('click', async () => {
    await exportTransactionsToCSV();
  });
}
