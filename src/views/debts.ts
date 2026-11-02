/**
 * MyFinance - Debt & Loans Management View
 * Manages money owed by the user and money owed to the user with partial payments.
 */

import {
  getAllFromStore,
  putInStore,
  deleteFromStore,
  addDebtPayment,
  Debt,
  DebtPayment,
  Account,
} from '../services/database';
import { formatKwanza, parseKwanzaToCents } from '../services/calculations';
import { isPrivacyModeActive } from '../services/auth';
import { getIcon } from '../utils/icons';
import { formatDateDisplay } from '../services/backup';
import { showModal, showConfirmDialog } from '../components/modals';

export async function renderDebts(container: HTMLElement, onNavigate: (route: string) => void): Promise<void> {
  const [debts, payments, accounts] = await Promise.all([
    getAllFromStore<Debt>('debts'),
    getAllFromStore<DebtPayment>('debtPayments'),
    getAllFromStore<Account>('accounts'),
  ]);

  const isMasked = isPrivacyModeActive();

  const owedByMe = debts.filter(d => d.type === 'owed_by_me');
  const owedToMe = debts.filter(d => d.type === 'owed_to_me');

  const totalOwedByMeCents = owedByMe
    .filter(d => d.status !== 'paid')
    .reduce((sum, d) => sum + d.currentBalanceCents, 0);

  const totalOwedToMeCents = owedToMe
    .filter(d => d.status !== 'paid')
    .reduce((sum, d) => sum + d.currentBalanceCents, 0);

  container.innerHTML = `
    <div class="space-y-6 pb-12">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dívidas & Empréstimos</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Controlo de montantes a pagar a terceiros e valores a receber.</p>
        </div>

        <div class="flex items-center gap-3">
          <button id="debt-new-btn" class="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all">
            ${getIcon('plus', 'w-4 h-4')} Registar Dívida / Empréstimo
          </button>
        </div>
      </div>

      <!-- Overview Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- A Pagar -->
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <div class="flex items-center justify-between text-slate-500 mb-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Total a Pagar (Passivo)</span>
            <div class="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600">
              ${getIcon('arrow-up-right', 'w-4 h-4')}
            </div>
          </div>
          <p class="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            ${formatKwanza(totalOwedByMeCents, { masked: isMasked })}
          </p>
          <p class="text-xs text-slate-500 mt-1">Dívidas tuas a fornecedores, amigos ou bancos</p>
        </div>

        <!-- A Receber -->
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <div class="flex items-center justify-between text-slate-500 mb-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total a Receber (Ativo)</span>
            <div class="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              ${getIcon('arrow-down-left', 'w-4 h-4')}
            </div>
          </div>
          <p class="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            ${formatKwanza(totalOwedToMeCents, { masked: isMasked })}
          </p>
          <p class="text-xs text-slate-500 mt-1">Empréstimos concedidos a cobrar</p>
        </div>
      </div>

      <!-- Debts List -->
      <div class="space-y-6">
        <!-- Section 1: Owed By Me -->
        <div class="space-y-3">
          <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Dívidas a Pagar</span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 font-semibold">${owedByMe.length}</span>
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${owedByMe.length === 0 ? `<div class="col-span-full p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">Não tens dívidas ativas registadas a pagar.</div>` : ''}

            ${owedByMe.map(debt => renderDebtCard(debt, payments, isMasked)).join('')}
          </div>
        </div>

        <!-- Section 2: Owed To Me -->
        <div class="space-y-3">
          <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Valores a Receber (Empréstimos)</span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 font-semibold">${owedToMe.length}</span>
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${owedToMe.length === 0 ? `<div class="col-span-full p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">Não tens montantes a receber registados.</div>` : ''}

            ${owedToMe.map(debt => renderDebtCard(debt, payments, isMasked)).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  function renderDebtCard(debt: Debt, allPayments: DebtPayment[], masked: boolean): string {
    const isPaid = debt.status === 'paid';
    const isPartial = debt.status === 'partially_paid';
    const debtPayments = allPayments.filter(p => p.debtId === debt.id);

    return `
      <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-4 flex flex-col justify-between">
        <div>
          <div class="flex items-start justify-between gap-2">
            <div>
              <h4 class="text-base font-bold text-slate-900 dark:text-white">${debt.personName}</h4>
              <p class="text-xs text-slate-500">${debt.description || (debt.type === 'owed_by_me' ? 'Dívida a pagar' : 'Empréstimo concedido')}</p>
            </div>

            <span class="text-xs px-2 py-0.5 rounded-full font-bold ${isPaid ? 'bg-emerald-100 text-emerald-700' : isPartial ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}">
              ${isPaid ? 'Liquidado' : isPartial ? 'Parcial' : 'Pendente'}
            </span>
          </div>

          <div class="mt-4 flex items-center justify-between text-xs">
            <span class="text-slate-500">Saldo Pendente:</span>
            <span class="text-lg font-black ${debt.type === 'owed_by_me' ? 'text-rose-600' : 'text-emerald-600'}">
              ${formatKwanza(debt.currentBalanceCents, { masked })}
            </span>
          </div>

          <div class="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>Valor Inicial: ${formatKwanza(debt.initialAmountCents, { masked })}</span>
            ${debt.dueDate ? `<span>Vence: ${formatDateDisplay(debt.dueDate)}</span>` : ''}
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          ${!isPaid ? `
          <button data-pay-debt="${debt.id}" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5">
            ${getIcon('check', 'w-3.5 h-3.5')} ${debt.type === 'owed_by_me' ? 'Amortizar / Pagar' : 'Registar Recebimento'}
          </button>` : `<span class="text-xs text-emerald-600 font-semibold flex items-center gap-1">${getIcon('check', 'w-4 h-4')} Totalmente Liquidado</span>`}

          <button data-delete-debt="${debt.id}" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg" title="Eliminar registo">
            ${getIcon('trash-2', 'w-4 h-4')}
          </button>
        </div>
      </div>
    `;
  }

  // Bind Payment Modal
  container.querySelectorAll('[data-pay-debt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const debtId = btn.getAttribute('data-pay-debt')!;
      const debt = debts.find(d => d.id === debtId);
      if (!debt) return;

      const activeAccounts = accounts.filter(a => !a.isArchived);
      const isExpense = debt.type === 'owed_by_me';

      const bodyHtml = `
        <div class="space-y-4">
          <p class="text-xs text-slate-500">
            ${isExpense ? `Pagamento de dívida a: <strong>${debt.personName}</strong>` : `Recebimento de empréstimo de: <strong>${debt.personName}</strong>`}
          </p>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Valor da Amortização (Kz) * (Saldo: ${formatKwanza(debt.currentBalanceCents)})
            </label>
            <input type="text" id="debt-pay-amount" autofocus placeholder="ex: 50.000,00" value="${(debt.currentBalanceCents / 100).toFixed(2).replace('.', ',')}" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold text-slate-900 dark:text-white focus:outline-none">
          </div>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              ${isExpense ? 'Conta Bancária de Pagamento *' : 'Conta Bancária de Depósito *'}
            </label>
            <select id="debt-pay-acc" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
              ${activeAccounts.map(a => `<option value="${a.id}">${a.name} (${formatKwanza(a.balanceCents)})</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Data</label>
            <input type="date" id="debt-pay-date" value="${new Date().toISOString().split('T')[0]}" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
          </div>
        </div>
      `;

      const footerHtml = `
        <button id="debt-pay-cancel" class="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">Cancelar</button>
        <button id="debt-pay-submit" class="px-5 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-medium">Confirmar Amortização</button>
      `;

      const modal = showModal(`Amortizar: ${debt.personName}`, bodyHtml, footerHtml);

      modal.querySelector('#debt-pay-cancel')?.addEventListener('click', () => modal.remove());
      modal.querySelector('#debt-pay-submit')?.addEventListener('click', async () => {
        const amountStr = (modal.querySelector('#debt-pay-amount') as HTMLInputElement).value;
        const cents = parseKwanzaToCents(amountStr);
        const accountId = (modal.querySelector('#debt-pay-acc') as HTMLSelectElement).value;
        const date = (modal.querySelector('#debt-pay-date') as HTMLInputElement).value;

        if (cents <= 0) {
          alert('Por favor, indica um montante válido superior a zero.');
          return;
        }

        await addDebtPayment({
          debtId: debt.id,
          accountId,
          amountCents: cents,
          date,
        });

        modal.remove();
        renderDebts(container, onNavigate);
      });
    });
  });

  // Bind Delete Debt
  container.querySelectorAll('[data-delete-debt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const debtId = btn.getAttribute('data-delete-debt')!;
      const debt = debts.find(d => d.id === debtId);
      if (!debt) return;

      showConfirmDialog({
        title: 'Eliminar Registo de Dívida',
        message: `Tens a certeza de que desejas eliminar o registo de "${debt.personName}"?`,
        isDanger: true,
        confirmText: 'Sim, Eliminar',
        onConfirm: async () => {
          await deleteFromStore('debts', debtId);
          renderDebts(container, onNavigate);
        },
      });
    });
  });

  // New Debt Modal
  container.querySelector('#debt-new-btn')?.addEventListener('click', () => {
    const bodyHtml = `
      <form id="debt-form" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Tipo de Registo *</label>
          <select id="debt-type-select" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
            <option value="owed_by_me">Dívida Minha (Tenho de Pagar a Alguém)</option>
            <option value="owed_to_me">Empréstimo Concedido (Alguém tem de me Pagar)</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Nome do Credor ou Devedor *</label>
          <input type="text" id="debt-person-input" required placeholder="ex: Banco BAI, João Manuel, Fornecedor X..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Valor Inicial (Kz) *</label>
          <input type="text" id="debt-amount-input" required placeholder="ex: 150.000,00" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold focus:outline-none">
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Data de Vencimento Prevista</label>
          <input type="date" id="debt-due-input" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none">
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Notas ou Descrição</label>
          <textarea id="debt-desc-input" rows="2" placeholder="Detalhes do acordo..." class="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none"></textarea>
        </div>
      </form>
    `;

    const footerHtml = `
      <button id="debt-cancel" class="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">Cancelar</button>
      <button id="debt-save" class="px-5 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-medium">Registar Dívida</button>
    `;

    const modal = showModal('Registar Dívida ou Empréstimo', bodyHtml, footerHtml);

    modal.querySelector('#debt-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#debt-save')?.addEventListener('click', async () => {
      const type = (modal.querySelector('#debt-type-select') as HTMLSelectElement).value as Debt['type'];
      const person = (modal.querySelector('#debt-person-input') as HTMLInputElement).value.trim();
      const amountStr = (modal.querySelector('#debt-amount-input') as HTMLInputElement).value;
      const cents = parseKwanzaToCents(amountStr);
      const dueDate = (modal.querySelector('#debt-due-input') as HTMLInputElement).value;
      const desc = (modal.querySelector('#debt-desc-input') as HTMLTextAreaElement).value.trim();

      if (!person || cents <= 0) {
        alert('Por favor, indica a pessoa/entidade e um montante válido superior a zero.');
        return;
      }

      await putInStore('debts', {
        id: `debt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type,
        personName: person,
        initialAmountCents: cents,
        currentBalanceCents: cents,
        dueDate: dueDate || undefined,
        description: desc || undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      modal.remove();
      renderDebts(container, onNavigate);
    });
  });
}
