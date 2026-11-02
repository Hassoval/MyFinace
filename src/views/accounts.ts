/**
 * MyFinance - Accounts Management View
 * Manage Physical Cash, Bank accounts, Digital wallets, and Savings accounts.
 * Provides internal transfers and detailed account statements.
 */

import {
  getAllFromStore,
  putInStore,
  Account,
  Transaction,
} from '../services/database';
import {
  calculateAccountBalances,
  formatKwanza,
} from '../services/calculations';
import { isPrivacyModeActive } from '../services/auth';
import { getIcon } from '../utils/icons';
import { formatDateDisplay } from '../services/backup';
import { openAccountModal, openTransactionModal, showModal } from '../components/modals';

export async function renderAccounts(container: HTMLElement, onNavigate: (route: string) => void): Promise<void> {
  const [accounts, transactions] = await Promise.all([
    getAllFromStore<Account>('accounts'),
    getAllFromStore<Transaction>('transactions'),
  ]);

  const isMasked = isPrivacyModeActive();
  const balances = calculateAccountBalances(accounts);

  const typeNames: Record<string, string> = {
    bank: 'Conta Bancária',
    wallet: 'Carteira Digital',
    cash: 'Dinheiro Físico',
    savings: 'Conta Poupança / Reserva',
  };

  container.innerHTML = `
    <div class="space-y-6 pb-12">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Contas Financeiras</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Controlo de saldos em bancos, carteiras digitais e numerário.</p>
        </div>

        <div class="flex items-center gap-3">
          <button id="acc-transfer-btn" class="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl shadow-xs transition-colors">
            ${getIcon('arrow-left-right', 'w-4 h-4')} Transferir entre Contas
          </button>
          <button id="acc-new-btn" class="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all">
            ${getIcon('plus', 'w-4 h-4')} Nova Conta
          </button>
        </div>
      </div>

      <!-- Overview Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Saldo Total Consolidado</span>
          <p class="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            ${formatKwanza(balances.totalBalanceCents, { masked: isMasked })}
          </p>
        </div>
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span class="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Saldo Disponível (Dia a Dia)</span>
          <p class="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            ${formatKwanza(balances.availableCents, { masked: isMasked })}
          </p>
        </div>
        <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span class="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Saldo Reservado (Poupanças)</span>
          <p class="text-2xl font-extrabold text-violet-600 dark:text-violet-400 mt-1">
            ${formatKwanza(balances.reservedCents, { masked: isMasked })}
          </p>
        </div>
      </div>

      <!-- Accounts Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        ${accounts.map(acc => {
          const accTxs = transactions.filter(t => t.accountId === acc.id || t.toAccountId === acc.id);
          const isArchived = acc.isArchived;

          return `
            <div class="p-5 bg-white dark:bg-slate-900 border ${isArchived ? 'border-dashed border-slate-300 dark:border-slate-700 opacity-60' : 'border-slate-200/80 dark:border-slate-800'} rounded-2xl shadow-xs transition-all flex flex-col justify-between space-y-4">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0" style="background-color: ${acc.color}">
                    ${getIcon(acc.icon || 'wallet', 'w-6 h-6')}
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      ${acc.name}
                      ${isArchived ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600">Arquivada</span>' : ''}
                    </h3>
                    <p class="text-xs text-slate-500">${typeNames[acc.type] || acc.type} &bull; ${acc.institution || 'Geral'}</p>
                    ${acc.accountNumber ? `<p class="text-[11px] font-mono text-slate-400 mt-0.5">${acc.accountNumber}</p>` : ''}
                  </div>
                </div>

                <div class="text-right">
                  <p class="text-xl font-black text-slate-900 dark:text-white">
                    ${formatKwanza(acc.balanceCents, { masked: isMasked })}
                  </p>
                  <p class="text-[11px] text-slate-400">${accTxs.length} transações</p>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <button data-statement-acc="${acc.id}" class="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                  ${getIcon('file-text', 'w-3.5 h-3.5')} Ver Extrato
                </button>

                <div class="flex items-center gap-2">
                  <button data-archive-acc="${acc.id}" class="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    ${isArchived ? 'Desarquivar' : 'Arquivar'}
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Bind Statement Modal
  container.querySelectorAll('[data-statement-acc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const accId = btn.getAttribute('data-statement-acc')!;
      const acc = accounts.find(a => a.id === accId);
      if (!acc) return;

      const accTxs = transactions
        .filter(t => t.accountId === accId || t.toAccountId === accId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const bodyHtml = `
        <div class="space-y-4">
          <div class="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <p class="text-xs text-slate-500">Saldo Atual</p>
              <p class="text-xl font-bold text-slate-900 dark:text-white">${formatKwanza(acc.balanceCents, { masked: isMasked })}</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              ${typeNames[acc.type] || acc.type}
            </span>
          </div>

          <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Histórico de Movimentações</h4>

          <div class="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            ${accTxs.length === 0 ? '<p class="text-xs text-slate-400 py-4 text-center">Nenhuma movimentação nesta conta.</p>' : ''}
            ${accTxs.map(t => {
              const isDebit = t.type === 'expense' || (t.type === 'transfer' && t.accountId === accId);
              const sign = isDebit ? '-' : '+';
              const color = isDebit ? 'text-rose-600' : 'text-emerald-600';

              return `
                <div class="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p class="font-medium text-slate-900 dark:text-white">${t.description}</p>
                    <p class="text-slate-400">${formatDateDisplay(t.date)}</p>
                  </div>
                  <span class="font-bold ${color}">${sign}${formatKwanza(t.amountCents, { masked: isMasked })}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      showModal(`Extrato: ${acc.name}`, bodyHtml);
    });
  });

  // Archive / unarchive toggle
  container.querySelectorAll('[data-archive-acc]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const accId = btn.getAttribute('data-archive-acc')!;
      const acc = accounts.find(a => a.id === accId);
      if (!acc) return;

      acc.isArchived = !acc.isArchived;
      acc.updatedAt = new Date().toISOString();
      await putInStore('accounts', acc);
      renderAccounts(container, onNavigate);
    });
  });

  // Transfer modal trigger
  container.querySelector('#acc-transfer-btn')?.addEventListener('click', () => {
    openTransactionModal({
      initialType: 'transfer',
      onSaved: () => renderAccounts(container, onNavigate),
    });
  });

  // New account modal trigger
  container.querySelector('#acc-new-btn')?.addEventListener('click', () => {
    openAccountModal({
      onSaved: () => renderAccounts(container, onNavigate),
    });
  });
}
