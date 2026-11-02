/**
 * MyFinance - Financial Planning & Calendar View
 * Distinguishes planned expenses from paid expenses.
 * Includes recurring commitments and financial calendar.
 */

import {
  getAllFromStore,
  putInStore,
  deleteFromStore,
  payPlannedExpense,
  PlannedExpense,
  Account,
  Category,
  RecurringRule,
} from '../services/database';
import { formatKwanza, parseKwanzaToCents } from '../services/calculations';
import { isPrivacyModeActive } from '../services/auth';
import { getIcon } from '../utils/icons';
import { formatDateDisplay } from '../services/backup';
import { showModal, showConfirmDialog } from '../components/modals';

export async function renderPlanning(container: HTMLElement, onNavigate: (route: string) => void): Promise<void> {
  const [plannedList, accounts, categories, recurring] = await Promise.all([
    getAllFromStore<PlannedExpense>('plannedExpenses'),
    getAllFromStore<Account>('accounts'),
    getAllFromStore<Category>('categories'),
    getAllFromStore<RecurringRule>('recurringRules'),
  ]);

  const isMasked = isPrivacyModeActive();
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  const pending = plannedList.filter(p => !p.isPaid).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const paid = plannedList.filter(p => p.isPaid).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  const totalPendingCents = pending.reduce((sum, p) => sum + p.amountCents, 0);

  container.innerHTML = `
    <div class="space-y-6 pb-12">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Planeamento & Compromissos</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Previsão de despesas futuras sem afetar o teu saldo real até à liquidação.</p>
        </div>

        <div class="flex items-center gap-3">
          <button id="plan-new-btn" class="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all">
            ${getIcon('plus', 'w-4 h-4')} Novo Compromisso
          </button>
        </div>
      </div>

      <!-- Info Banner -->
      <div class="p-4 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
            ${getIcon('calendar', 'w-5 h-5')}
          </div>
          <div>
            <p class="text-xs font-bold text-sky-900 dark:text-sky-300">Total em Compromissos Pendentes</p>
            <p class="text-lg font-extrabold text-sky-700 dark:text-sky-400">${formatKwanza(totalPendingCents, { masked: isMasked })}</p>
          </div>
        </div>
        <p class="text-xs text-slate-500 hidden sm:block max-w-xs text-right">
          Estes valores só são debitados das tuas contas bancárias quando clicares em "Pagar Agora".
        </p>
      </div>

      <!-- Tabs / Lists -->
      <div class="space-y-4">
        <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>Compromissos Pendentes</span>
          <span class="px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-950 text-amber-600 font-semibold">${pending.length}</span>
        </h3>

        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          ${pending.length === 0 ? `
            <div class="p-8 text-center text-slate-400 text-sm">Nenhum compromisso pendente registado.</div>` : `
            <div class="divide-y divide-slate-100 dark:divide-slate-800">
              ${pending.map(item => {
                const cat = categoryMap.get(item.categoryId);
                const acc = accountMap.get(item.accountId);

                return `
                  <div class="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 shrink-0">
                        ${getIcon('calendar', 'w-5 h-5')}
                      </div>
                      <div class="truncate">
                        <p class="text-sm font-bold text-slate-900 dark:text-white truncate">${item.description}</p>
                        <p class="text-xs text-slate-500 truncate">
                          Vencimento: <strong class="text-slate-700 dark:text-slate-300">${formatDateDisplay(item.dueDate)}</strong> &bull; 
                          ${cat?.name || 'Geral'} &bull; Conta: ${acc?.name || 'Padrão'}
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center gap-3 shrink-0">
                      <span class="text-base font-extrabold text-slate-900 dark:text-white">${formatKwanza(item.amountCents, { masked: isMasked })}</span>
                      <button data-pay-planned="${item.id}" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5">
                        ${getIcon('check', 'w-3.5 h-3.5')} Pagar Agora
                      </button>
                      <button data-delete-planned="${item.id}" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg" title="Remover">
                        ${getIcon('trash-2', 'w-4 h-4')}
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Paid History -->
        ${paid.length > 0 ? `
          <div class="pt-4 space-y-3">
            <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300">Compromissos Já Liquidados (${paid.length})</h3>
            <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              ${paid.slice(0, 5).map(item => `
                <div class="p-3.5 flex items-center justify-between text-xs opacity-75">
                  <div class="flex items-center gap-2">
                    <span class="text-emerald-500">${getIcon('check', 'w-4 h-4')}</span>
                    <span class="font-medium text-slate-800 dark:text-slate-200">${item.description}</span>
                    <span class="text-slate-400">(${formatDateDisplay(item.dueDate)})</span>
                  </div>
                  <span class="font-semibold text-slate-600 dark:text-slate-400">${formatKwanza(item.amountCents, { masked: isMasked })}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Bind Pay Now buttons
  container.querySelectorAll('[data-pay-planned]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-pay-planned')!;
      const item = plannedList.find(p => p.id === id);
      if (!item) return;

      showConfirmDialog({
        title: 'Confirmar Liquidação de Compromisso',
        message: `Desejas marcar "${item.description}" (${formatKwanza(item.amountCents)}) como pago? O valor será agora deduzido do saldo real da conta associada de forma atómica.`,
        confirmText: 'Pagar e Debitar Conta',
        onConfirm: async () => {
          const today = new Date().toISOString().split('T')[0];
          await payPlannedExpense(id, today);
          renderPlanning(container, onNavigate);
        },
      });
    });
  });

  // Bind Delete buttons
  container.querySelectorAll('[data-delete-planned]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete-planned')!;
      await deleteFromStore('plannedExpenses', id);
      renderPlanning(container, onNavigate);
    });
  });

  // New Planned Commitment Modal
  container.querySelector('#plan-new-btn')?.addEventListener('click', () => {
    const activeAccounts = accounts.filter(a => !a.isArchived);
    const expenseCategories = categories.filter(c => c.type === 'expense');

    const bodyHtml = `
      <form id="plan-form" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Descrição do Compromisso *</label>
          <input type="text" id="plan-desc" required placeholder="ex: Renda de Casa, Seguro do Carro, Colégio..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Valor (Kz) *</label>
          <input type="text" id="plan-amount" required placeholder="ex: 120.000,00" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold focus:outline-none">
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Data de Vencimento *</label>
          <input type="date" id="plan-date" required value="${new Date().toISOString().split('T')[0]}" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Categoria</label>
            <select id="plan-cat" class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none">
              ${expenseCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Conta Prevista</label>
            <select id="plan-acc" class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none">
              ${activeAccounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
            </select>
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button id="plan-cancel-btn" class="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">Cancelar</button>
      <button id="plan-submit-btn" class="px-5 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-medium">Guardar Compromisso</button>
    `;

    const modal = showModal('Novo Compromisso Financeiro', bodyHtml, footerHtml);

    modal.querySelector('#plan-cancel-btn')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#plan-submit-btn')?.addEventListener('click', async () => {
      const desc = (modal.querySelector('#plan-desc') as HTMLInputElement).value.trim();
      const amountStr = (modal.querySelector('#plan-amount') as HTMLInputElement).value;
      const cents = parseKwanzaToCents(amountStr);
      const dueDate = (modal.querySelector('#plan-date') as HTMLInputElement).value;
      const categoryId = (modal.querySelector('#plan-cat') as HTMLSelectElement).value;
      const accountId = (modal.querySelector('#plan-acc') as HTMLSelectElement).value;

      if (!desc || cents <= 0 || !dueDate) {
        alert('Por favor, preenche todos os campos obrigatórios com valores válidos.');
        return;
      }

      await putInStore('plannedExpenses', {
        id: `plan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        description: desc,
        amountCents: cents,
        dueDate,
        categoryId,
        accountId,
        isPaid: false,
        isRecurring: false,
        createdAt: new Date().toISOString(),
      });

      modal.remove();
      renderPlanning(container, onNavigate);
    });
  });
}
