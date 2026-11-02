/**
 * MyFinance - Transactions Management View
 * Full search, filters, categorization, receipt attachment preview, and deletion with balance revert.
 */

import {
  getAllFromStore,
  deleteTransaction,
  getRecentSearchHistory,
  addSearchHistoryItem,
  Transaction,
  Account,
  Category,
  SearchHistoryItem,
} from '../services/database';
import { formatKwanza } from '../services/calculations';
import { isPrivacyModeActive } from '../services/auth';
import { getIcon } from '../utils/icons';
import { formatDateDisplay, exportTransactionsToCSV } from '../services/backup';
import { openTransactionModal, showModal, showConfirmDialog } from '../components/modals';

export async function renderTransactions(container: HTMLElement, onNavigate: (route: string) => void): Promise<void> {
  const [allTransactions, accounts, categories, recentHistory] = await Promise.all([
    getAllFromStore<Transaction>('transactions'),
    getAllFromStore<Account>('accounts'),
    getAllFromStore<Category>('categories'),
    getRecentSearchHistory(8),
  ]);

  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const isMasked = isPrivacyModeActive();

  // Parse URL query if present (e.g. #/transactions?q=Kero or #/transactions?tx=tx-1)
  let initialQuery = '';
  let targetTxId = '';
  const hash = window.location.hash;
  if (hash.includes('?')) {
    const params = new URLSearchParams(hash.split('?')[1]);
    initialQuery = params.get('q') || '';
    targetTxId = params.get('tx') || '';
  }

  // State for filters
  let filterType = 'all';
  let filterAccountId = 'all';
  let filterCategoryId = 'all';
  let searchQuery = initialQuery;

  const renderList = () => {
    const filtered = allTransactions.filter(tx => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterAccountId !== 'all' && tx.accountId !== filterAccountId && tx.toAccountId !== filterAccountId) return false;
      if (filterCategoryId !== 'all' && tx.categoryId !== filterCategoryId) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesDesc = tx.description.toLowerCase().includes(query);
        const matchesNotes = tx.notes ? tx.notes.toLowerCase().includes(query) : false;
        if (!matchesDesc && !matchesNotes) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filtered totals
    let incSum = 0;
    let expSum = 0;
    filtered.forEach(tx => {
      if (tx.isPaid === false) return;
      if (tx.type === 'income') incSum += tx.amountCents;
      if (tx.type === 'expense') expSum += tx.amountCents;
    });

    const listContainer = container.querySelector('#transactions-list-body');
    const summaryBanner = container.querySelector('#transactions-filter-summary');

    if (summaryBanner) {
      summaryBanner.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span class="text-slate-500 font-medium">A apresentar <strong>${filtered.length}</strong> transações</span>
          <div class="flex items-center gap-4">
            <span class="text-emerald-600 font-semibold">Receitas: +${formatKwanza(incSum, { masked: isMasked })}</span>
            <span class="text-rose-600 font-semibold">Despesas: -${formatKwanza(expSum, { masked: isMasked })}</span>
            <span class="text-slate-700 dark:text-slate-300 font-bold">Líquido: ${formatKwanza(incSum - expSum, { masked: isMasked })}</span>
          </div>
        </div>
      `;
    }

    if (listContainer) {
      if (filtered.length === 0) {
        listContainer.innerHTML = `
          <div class="p-12 text-center text-slate-400 space-y-2">
            ${getIcon('file-text', 'w-10 h-10 mx-auto text-slate-300 dark:text-slate-600')}
            <p class="text-sm font-medium">Nenhuma transação encontrada para os filtros selecionados.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = `
        <div class="divide-y divide-slate-100 dark:divide-slate-800">
          ${filtered.map(tx => {
            const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : null;
            const acc = accountMap.get(tx.accountId);
            const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : null;

            const isInc = tx.type === 'income';
            const isExp = tx.type === 'expense';
            const isTrans = tx.type === 'transfer';

            const iconName = isTrans ? 'arrow-left-right' : cat ? cat.icon : isInc ? 'arrow-down-left' : 'tag';
            const iconBadgeClass = isTrans ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400' : isInc ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400';

            return `
              <div class="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="p-2.5 rounded-xl ${iconBadgeClass} shrink-0">
                    ${getIcon(iconName, 'w-5 h-5')}
                  </div>
                  <div class="truncate">
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">${tx.description}</p>
                      ${tx.attachmentData ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">${getIcon('file-text', 'w-3 h-3 mr-1')} Recibo</span>` : ''}
                    </div>
                    <p class="text-xs text-slate-500 mt-0.5 truncate">
                      ${formatDateDisplay(tx.date)} &bull; 
                      ${isTrans ? `${acc?.name || 'Origem'} &rarr; ${toAcc?.name || 'Destino'}` : `${cat?.name || 'Sem categoria'} &bull; ${acc?.name || ''}`}
                      ${tx.notes ? `&bull; <i>${tx.notes}</i>` : ''}
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-4 shrink-0">
                  <div class="text-right">
                    <p class="text-sm font-bold ${isInc ? 'text-emerald-600 dark:text-emerald-400' : isExp ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'}">
                      ${isInc ? '+' : isExp ? '-' : ''}${formatKwanza(tx.amountCents, { masked: isMasked })}
                    </p>
                    <span class="text-[11px] px-2 py-0.5 rounded-full ${isInc ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600' : isExp ? 'bg-rose-50 dark:bg-rose-950 text-rose-600' : 'bg-sky-50 dark:bg-sky-950 text-sky-600'} font-medium">
                      ${isInc ? 'Receita' : isExp ? 'Despesa' : 'Transferência'}
                    </span>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-1">
                    ${tx.attachmentData ? `
                    <button data-view-receipt="${tx.id}" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Ver Comprovativo">
                      ${getIcon('file-text', 'w-4 h-4')}
                    </button>` : ''}

                    <button data-delete-tx="${tx.id}" class="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors" title="Eliminar transação">
                      ${getIcon('trash-2', 'w-4 h-4')}
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Bind delete buttons
      listContainer.querySelectorAll('[data-delete-tx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-delete-tx')!;
          const targetTx = allTransactions.find(t => t.id === id);
          if (!targetTx) return;

          showConfirmDialog({
            title: 'Eliminar Transação',
            message: `Tens a certeza de que queres eliminar "${targetTx.description}" (${formatKwanza(targetTx.amountCents)})? O saldo das contas associadas será revertido automaticamente de forma atómica.`,
            isDanger: true,
            confirmText: 'Sim, Eliminar',
            onConfirm: async () => {
              await deleteTransaction(id);
              renderTransactions(container, onNavigate);
            },
          });
        });
      });

      // Bind receipt preview
      listContainer.querySelectorAll('[data-view-receipt]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-view-receipt')!;
          const targetTx = allTransactions.find(t => t.id === id);
          if (!targetTx || !targetTx.attachmentData) return;

          showModal(
            `Comprovativo: ${targetTx.description}`,
            `
            <div class="text-center space-y-3">
              ${targetTx.attachmentData.startsWith('data:image')
                ? `<img src="${targetTx.attachmentData}" alt="Comprovativo" class="max-h-96 mx-auto rounded-lg shadow-sm">`
                : `<iframe src="${targetTx.attachmentData}" class="w-full h-80 border rounded-lg"></iframe>`}
              <div class="pt-2">
                <a href="${targetTx.attachmentData}" download="${targetTx.attachmentName || 'comprovativo'}" class="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200">
                  ${getIcon('download', 'w-4 h-4')} Descarregar Ficheiro
                </a>
              </div>
            </div>
            `
          );
        });
      });
    }
  };

  container.innerHTML = `
    <div class="space-y-6 pb-12">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Transações</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Histórico completo de receitas, despesas e transferências.</p>
        </div>

        <div class="flex items-center gap-3">
          <button id="tx-export-csv-btn" class="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl shadow-xs transition-colors">
            ${getIcon('download', 'w-4 h-4')} Exportar CSV
          </button>
          <button id="tx-new-btn" class="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all">
            ${getIcon('plus', 'w-4 h-4')} Nova Transação
          </button>
        </div>
      </div>

      <!-- Filters Toolbar -->
      <div class="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <!-- Search -->
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              ${getIcon('search', 'w-4 h-4')}
            </span>
            <input type="text" id="tx-filter-search" value="${initialQuery}" placeholder="Pesquisar descrição ou nota..." class="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none">
          </div>

          <!-- Type Filter -->
          <div>
            <select id="tx-filter-type" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none">
              <option value="all">Todos os Tipos</option>
              <option value="income">Apenas Receitas</option>
              <option value="expense">Apenas Despesas</option>
              <option value="transfer">Apenas Transferências</option>
            </select>
          </div>

          <!-- Account Filter -->
          <div>
            <select id="tx-filter-account" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none">
              <option value="all">Todas as Contas</option>
              ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
            </select>
          </div>

          <!-- Category Filter -->
          <div>
            <select id="tx-filter-category" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none">
              <option value="all">Todas as Categorias</option>
              ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Recent Search History Chips from IndexedDB -->
        ${recentHistory.length > 0 ? `
        <div class="flex items-center gap-1.5 flex-wrap text-xs pt-1">
          <span class="text-slate-400 text-[11px] font-semibold flex items-center gap-1 mr-1">
            ${getIcon('refresh-cw', 'w-3 h-3 text-emerald-500')} Recentes:
          </span>
          ${recentHistory.map(item => `
            <button type="button" data-history-tag="${item.text}" class="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-300 transition-colors text-[11px] font-medium border border-transparent hover:border-emerald-300 dark:hover:border-emerald-800">
              ${item.text}
            </button>
          `).join('')}
        </div>` : ''}

        <!-- Filter Summary Bar -->
        <div id="transactions-filter-summary" class="pt-2 border-t border-slate-100 dark:border-slate-800/80"></div>
      </div>

      <!-- Transactions List Card -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div id="transactions-list-body"></div>
      </div>
    </div>
  `;

  // Attach event listeners
  const searchInput = container.querySelector('#tx-filter-search') as HTMLInputElement;
  const typeSelect = container.querySelector('#tx-filter-type') as HTMLSelectElement;
  const accSelect = container.querySelector('#tx-filter-account') as HTMLSelectElement;
  const catSelect = container.querySelector('#tx-filter-category') as HTMLSelectElement;

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    renderList();
  });

  searchInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (q) {
        await addSearchHistoryItem({ type: 'query', text: q });
      }
    }
  });

  searchInput.addEventListener('blur', async () => {
    const q = searchInput.value.trim();
    if (q && q.length >= 2) {
      await addSearchHistoryItem({ type: 'query', text: q });
    }
  });

  // Recent History Tags click
  container.querySelectorAll('[data-history-tag]').forEach(tagBtn => {
    tagBtn.addEventListener('click', () => {
      const tagText = tagBtn.getAttribute('data-history-tag')!;
      searchInput.value = tagText;
      searchQuery = tagText;
      renderList();
    });
  });

  typeSelect.addEventListener('change', () => {
    filterType = typeSelect.value;
    renderList();
  });

  accSelect.addEventListener('change', () => {
    filterAccountId = accSelect.value;
    renderList();
  });

  catSelect.addEventListener('change', () => {
    filterCategoryId = catSelect.value;
    renderList();
  });

  container.querySelector('#tx-new-btn')?.addEventListener('click', () => {
    openTransactionModal({
      onSaved: () => renderTransactions(container, onNavigate),
    });
  });

  container.querySelector('#tx-export-csv-btn')?.addEventListener('click', async () => {
    await exportTransactionsToCSV();
  });

  renderList();
}
