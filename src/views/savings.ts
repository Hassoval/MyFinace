/**
 * MyFinance - Savings Goals View
 * Track progress towards targets, make deposits and withdrawals linked to real accounts.
 */

import {
  getAllFromStore,
  putInStore,
  deleteFromStore,
  addGoalMovement,
  SavingsGoal,
  Account,
  GoalContribution,
} from '../services/database';
import {
  formatKwanza,
  parseKwanzaToCents,
  calculateGoalProgress,
} from '../services/calculations';
import { isPrivacyModeActive } from '../services/auth';
import { getIcon } from '../utils/icons';
import { formatDateDisplay } from '../services/backup';
import { showModal, showConfirmDialog } from '../components/modals';

export async function renderSavings(container: HTMLElement, onNavigate: (route: string) => void): Promise<void> {
  const [goals, accounts, contributions] = await Promise.all([
    getAllFromStore<SavingsGoal>('savingsGoals'),
    getAllFromStore<Account>('accounts'),
    getAllFromStore<GoalContribution>('goalContributions'),
  ]);

  const isMasked = isPrivacyModeActive();
  const totalSavedCents = goals.reduce((sum, g) => sum + g.currentAmountCents, 0);
  const totalTargetCents = goals.reduce((sum, g) => sum + g.targetAmountCents, 0);

  container.innerHTML = `
    <div class="space-y-6 pb-12">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Metas & Poupança</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Objetivos financeiros, reservas de emergência e investimentos futuros.</p>
        </div>

        <div class="flex items-center gap-3">
          <button id="goal-new-btn" class="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all">
            ${getIcon('plus', 'w-4 h-4')} Nova Meta
          </button>
        </div>
      </div>

      <!-- Summary KPI -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span class="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Total Poupança Acumulada</span>
          <p class="text-2xl font-extrabold text-violet-600 dark:text-violet-400 mt-1">
            ${formatKwanza(totalSavedCents, { masked: isMasked })}
          </p>
        </div>

        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Objetivo Global Planeado</span>
          <p class="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            ${formatKwanza(totalTargetCents, { masked: isMasked })}
          </p>
        </div>
      </div>

      <!-- Goals List -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${goals.length === 0 ? `
          <div class="col-span-full p-12 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            Ainda não definiste metas de poupança. Clica em "Nova Meta" para começar.
          </div>` : ''}

        ${goals.map(goal => {
          const prog = calculateGoalProgress(goal.currentAmountCents, goal.targetAmountCents);

          return `
            <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400">
                      ${getIcon(goal.icon || 'target', 'w-6 h-6')}
                    </div>
                    <div>
                      <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        ${goal.name}
                        ${prog.isComplete ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">Concluída!</span>' : ''}
                      </h3>
                      <p class="text-xs text-slate-500">Prazo: ${formatDateDisplay(goal.targetDate)}</p>
                    </div>
                  </div>

                  <span class="text-lg font-black text-violet-600 dark:text-violet-400">${prog.percentage}%</span>
                </div>

                ${goal.description ? `<p class="text-xs text-slate-600 dark:text-slate-400 mt-2">${goal.description}</p>` : ''}

                <!-- Progress Bar -->
                <div class="mt-4 space-y-1.5">
                  <div class="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full bg-violet-600 rounded-full transition-all duration-500" style="width: ${prog.percentage}%"></div>
                  </div>
                  <div class="flex items-center justify-between text-xs text-slate-500">
                    <span>Acumulado: <strong class="text-slate-900 dark:text-white">${formatKwanza(goal.currentAmountCents, { masked: isMasked })}</strong></span>
                    <span>Meta: ${formatKwanza(goal.targetAmountCents, { masked: isMasked })}</span>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <button data-contribute-goal="${goal.id}" class="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5">
                  ${getIcon('plus', 'w-3.5 h-3.5')} Contribuir / Resgatar
                </button>

                <button data-delete-goal="${goal.id}" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg" title="Eliminar Meta">
                  ${getIcon('trash-2', 'w-4 h-4')}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Bind contribute modal
  container.querySelectorAll('[data-contribute-goal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const goalId = btn.getAttribute('data-contribute-goal')!;
      const goal = goals.find(g => g.id === goalId);
      if (!goal) return;

      const activeAccounts = accounts.filter(a => !a.isArchived);

      const bodyHtml = `
        <div class="space-y-4">
          <p class="text-xs text-slate-500">Meta selecionada: <strong>${goal.name}</strong></p>

          <div class="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-center">
            <button type="button" id="mov-deposit-tab" class="py-2 rounded-lg bg-white dark:bg-slate-700 text-emerald-600 shadow-xs">
              Depositar (Poupar)
            </button>
            <button type="button" id="mov-withdraw-tab" class="py-2 rounded-lg text-slate-600 dark:text-slate-400">
              Resgatar (Retirar)
            </button>
          </div>
          <input type="hidden" id="mov-type-input" value="deposit">

          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Valor (Kz) *</label>
            <input type="text" id="mov-amount-input" autofocus placeholder="ex: 25.000,00" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold text-slate-900 dark:text-white focus:outline-none">
          </div>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Conta Financeira Envolvida *</label>
            <select id="mov-acc-select" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
              ${activeAccounts.map(a => `<option value="${a.id}">${a.name} (${formatKwanza(a.balanceCents)})</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Data</label>
            <input type="date" id="mov-date-input" value="${new Date().toISOString().split('T')[0]}" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
          </div>
        </div>
      `;

      const footerHtml = `
        <button id="mov-cancel" class="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">Cancelar</button>
        <button id="mov-submit" class="px-5 py-2 text-sm text-white bg-violet-600 hover:bg-violet-700 rounded-xl font-medium">Confirmar Movimento</button>
      `;

      const modal = showModal(`Movimento: ${goal.name}`, bodyHtml, footerHtml);

      const depTab = modal.querySelector('#mov-deposit-tab') as HTMLButtonElement;
      const withTab = modal.querySelector('#mov-withdraw-tab') as HTMLButtonElement;
      const typeInput = modal.querySelector('#mov-type-input') as HTMLInputElement;

      depTab.addEventListener('click', () => {
        typeInput.value = 'deposit';
        depTab.className = 'py-2 rounded-lg bg-white dark:bg-slate-700 text-emerald-600 shadow-xs';
        withTab.className = 'py-2 rounded-lg text-slate-600 dark:text-slate-400';
      });

      withTab.addEventListener('click', () => {
        typeInput.value = 'withdrawal';
        withTab.className = 'py-2 rounded-lg bg-white dark:bg-slate-700 text-rose-600 shadow-xs';
        depTab.className = 'py-2 rounded-lg text-slate-600 dark:text-slate-400';
      });

      modal.querySelector('#mov-cancel')?.addEventListener('click', () => modal.remove());
      modal.querySelector('#mov-submit')?.addEventListener('click', async () => {
        const amountStr = (modal.querySelector('#mov-amount-input') as HTMLInputElement).value;
        const cents = parseKwanzaToCents(amountStr);
        const accountId = (modal.querySelector('#mov-acc-select') as HTMLSelectElement).value;
        const date = (modal.querySelector('#mov-date-input') as HTMLInputElement).value;
        const type = typeInput.value as 'deposit' | 'withdrawal';

        if (cents <= 0) {
          alert('Por favor, indica um valor superior a zero.');
          return;
        }

        await addGoalMovement({
          goalId: goal.id,
          accountId,
          amountCents: cents,
          type,
          date,
        });

        modal.remove();
        renderSavings(container, onNavigate);
      });
    });
  });

  // Bind Delete Goal
  container.querySelectorAll('[data-delete-goal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const goalId = btn.getAttribute('data-delete-goal')!;
      const goal = goals.find(g => g.id === goalId);
      if (!goal) return;

      showConfirmDialog({
        title: 'Eliminar Meta de Poupança',
        message: `Tens a certeza de que desejas eliminar a meta "${goal.name}"? Os saldos das tuas contas bancárias não serão alterados.`,
        isDanger: true,
        confirmText: 'Sim, Eliminar',
        onConfirm: async () => {
          await deleteFromStore('savingsGoals', goalId);
          renderSavings(container, onNavigate);
        },
      });
    });
  });

  // New Goal Modal
  container.querySelector('#goal-new-btn')?.addEventListener('click', () => {
    const bodyHtml = `
      <form id="goal-form" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Nome da Meta *</label>
          <input type="text" id="goal-name-input" required placeholder="ex: Fundo de Emergência, Entrada para Casa..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Montante Alvo (Kz) *</label>
          <input type="text" id="goal-target-input" required placeholder="ex: 1.000.000,00" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold focus:outline-none">
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Saldo Já Poupado Inicialmente (Kz)</label>
          <input type="text" id="goal-init-input" placeholder="0,00" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Data Limite Alvo *</label>
          <input type="date" id="goal-date-input" required value="2027-12-31" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Descrição ou Notas</label>
          <textarea id="goal-notes-input" rows="2" placeholder="Notas sobre a meta..." class="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none"></textarea>
        </div>
      </form>
    `;

    const footerHtml = `
      <button id="goal-cancel" class="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">Cancelar</button>
      <button id="goal-save" class="px-5 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-medium">Criar Meta</button>
    `;

    const modal = showModal('Nova Meta de Poupança', bodyHtml, footerHtml);

    modal.querySelector('#goal-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#goal-save')?.addEventListener('click', async () => {
      const name = (modal.querySelector('#goal-name-input') as HTMLInputElement).value.trim();
      const targetStr = (modal.querySelector('#goal-target-input') as HTMLInputElement).value;
      const targetCents = parseKwanzaToCents(targetStr);
      const initStr = (modal.querySelector('#goal-init-input') as HTMLInputElement).value;
      const initCents = parseKwanzaToCents(initStr);
      const targetDate = (modal.querySelector('#goal-date-input') as HTMLInputElement).value;
      const notes = (modal.querySelector('#goal-notes-input') as HTMLTextAreaElement).value.trim();

      if (!name || targetCents <= 0 || !targetDate) {
        alert('Por favor, preenche todos os campos obrigatórios.');
        return;
      }

      await putInStore('savingsGoals', {
        id: `goal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name,
        targetAmountCents: targetCents,
        currentAmountCents: initCents,
        targetDate,
        description: notes || undefined,
        color: '#8b5cf6',
        icon: 'target',
        isCompleted: initCents >= targetCents,
        createdAt: new Date().toISOString(),
      });

      modal.remove();
      renderSavings(container, onNavigate);
    });
  });
}
