/**
 * MyFinance - Search & History Feature in Navigation
 * Dedicated IndexedDB store 'searchHistory' integration for quick transaction
 * revisit and query history.
 */

import {
  getAllFromStore,
  getRecentSearchHistory,
  addSearchHistoryItem,
  deleteSearchHistoryItem,
  clearSearchHistory,
  Transaction,
  Category,
  Account,
  SearchHistoryItem,
} from '../services/database';
import { formatKwanza } from '../services/calculations';
import { isPrivacyModeActive } from '../services/auth';
import { getIcon } from '../utils/icons';
import { formatDateDisplay } from '../services/backup';
import { showModal } from './modals';

export async function openSearchHistoryModal(params: {
  onSelectQuery: (query: string) => void;
  onSelectTransaction: (txId: string) => void;
}): Promise<void> {
  const [transactions, categories, accounts, rawHistory] = await Promise.all([
    getAllFromStore<Transaction>('transactions'),
    getAllFromStore<Category>('categories'),
    getAllFromStore<Account>('accounts'),
    getRecentSearchHistory(15),
  ]);

  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const isMasked = isPrivacyModeActive();

  let historyItems = [...rawHistory];

  // Remove any previously open modal
  const existing = document.getElementById('search-history-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'search-history-modal-overlay';
  overlay.className = 'fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150';

  overlay.innerHTML = `
    <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150">
      <!-- Search Input Header -->
      <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50">
        <span class="text-slate-400 pl-1">${getIcon('search', 'w-5 h-5 text-emerald-600')}</span>
        <input type="text" id="global-search-input" autofocus placeholder="Pesquisar transações por descrição, notas, categoria..." class="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none">
        <button id="close-search-modal-btn" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar">
          ${getIcon('x', 'w-5 h-5')}
        </button>
      </div>

      <!-- Results & History Body -->
      <div id="search-modal-body" class="overflow-y-auto p-4 space-y-4 flex-1">
        <!-- Rendered dynamically -->
      </div>

      <!-- Footer Info -->
      <div class="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Histórico guardado localmente em <strong>IndexedDB (searchHistory)</strong></span>
        <div class="flex items-center gap-2">
          <span><kbd class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">ESC</kbd> fechar</span>
          <span><kbd class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">↵</kbd> pesquisar</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = overlay.querySelector('#global-search-input') as HTMLInputElement;
  const body = overlay.querySelector('#search-modal-body') as HTMLElement;
  const closeBtn = overlay.querySelector('#close-search-modal-btn') as HTMLElement;

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', handleGlobalKey);
  };

  const handleGlobalKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', handleGlobalKey);

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Render view
  const render = () => {
    const query = input.value.trim().toLowerCase();

    if (!query) {
      // Show Search History from IndexedDB
      if (historyItems.length === 0) {
        body.innerHTML = `
          <div class="py-12 text-center text-slate-400 space-y-2">
            ${getIcon('refresh-cw', 'w-8 h-8 mx-auto text-slate-300 dark:text-slate-600')}
            <p class="text-xs font-medium">Ainda não tens pesquisas ou transações recentes no teu histórico.</p>
            <p class="text-[11px] text-slate-400">Escreve acima para encontrar transações ou salvar termos de pesquisa.</p>
          </div>
        `;
        return;
      }

      body.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              ${getIcon('refresh-cw', 'w-3.5 h-3.5')} Histórico Recente (IndexedDB)
            </span>
            <button id="clear-all-history-btn" class="text-[11px] text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 font-medium hover:underline">
              Limpar Histórico
            </button>
          </div>

          <div class="divide-y divide-slate-100 dark:divide-slate-800/80">
            ${historyItems.map(item => {
              const isQuery = item.type === 'query';
              const formattedDate = formatDateDisplay(item.timestamp.split('T')[0]);

              return `
                <div class="py-2.5 flex items-center justify-between gap-3 group hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors cursor-pointer" data-history-click="${item.id}">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="p-2 rounded-lg ${isQuery ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600'} shrink-0">
                      ${getIcon(isQuery ? 'search' : 'file-text', 'w-4 h-4')}
                    </div>
                    <div class="truncate">
                      <p class="text-xs font-semibold text-slate-900 dark:text-white truncate">${item.text}</p>
                      <p class="text-[11px] text-slate-400 truncate">
                        ${isQuery ? 'Pesquisa realizada' : `Transação revisitada ${item.categoryName ? `• ${item.categoryName}` : ''} ${item.accountName ? `• ${item.accountName}` : ''}`}
                        &bull; ${formattedDate}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-3 shrink-0">
                    ${item.amountCents !== undefined ? `
                      <span class="text-xs font-bold text-slate-700 dark:text-slate-300">
                        ${formatKwanza(item.amountCents, { masked: isMasked })}
                      </span>` : ''}

                    <button data-remove-history="${item.id}" class="p-1 text-slate-300 hover:text-rose-500 opacity-60 hover:opacity-100 transition-opacity" title="Remover do histórico" aria-label="Remover do histórico">
                      ${getIcon('x', 'w-3.5 h-3.5')}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      // Clear all history
      body.querySelector('#clear-all-history-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await clearSearchHistory();
        historyItems = [];
        render();
      });

      // Remove single history item
      body.querySelectorAll('[data-remove-history]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-remove-history')!;
          await deleteSearchHistoryItem(id);
          historyItems = historyItems.filter(h => h.id !== id);
          render();
        });
      });

      // Click history item
      body.querySelectorAll('[data-history-click]').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-history-click')!;
          const item = historyItems.find(h => h.id === id);
          if (!item) return;

          close();
          if (item.type === 'query') {
            params.onSelectQuery(item.text);
          } else if (item.targetId) {
            params.onSelectTransaction(item.targetId);
          } else {
            params.onSelectQuery(item.text);
          }
        });
      });

      return;
    }

    // Live search results
    const matches = transactions.filter(tx => {
      const descMatch = tx.description.toLowerCase().includes(query);
      const notesMatch = tx.notes ? tx.notes.toLowerCase().includes(query) : false;
      const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : null;
      const catMatch = cat ? cat.name.toLowerCase().includes(query) : false;
      const acc = accountMap.get(tx.accountId);
      const accMatch = acc ? acc.name.toLowerCase().includes(query) : false;
      return descMatch || notesMatch || catMatch || accMatch;
    }).slice(0, 8);

    body.innerHTML = `
      <div class="space-y-4">
        <!-- Quick search action -->
        <div class="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-500/20 rounded-xl flex items-center justify-between cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors" id="apply-query-action">
          <div class="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            ${getIcon('search', 'w-4 h-4')}
            <span>Filtrar todas as transações por: "<strong>${query}</strong>"</span>
          </div>
          <span class="text-[11px] text-slate-400 font-mono">Pressiona Enter</span>
        </div>

        <!-- Matches -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Resultados Encontrados (${matches.length})</span>
          </div>

          ${matches.length === 0 ? `
            <p class="text-xs text-slate-400 py-6 text-center">Nenhuma transação encontrada correspondente a "${query}".</p>` : `
            <div class="divide-y divide-slate-100 dark:divide-slate-800/80">
              ${matches.map(tx => {
                const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : null;
                const acc = accountMap.get(tx.accountId);
                const isInc = tx.type === 'income';
                const isExp = tx.type === 'expense';

                return `
                  <div class="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors cursor-pointer" data-select-match="${tx.id}">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="p-2 rounded-lg ${isInc ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60' : isExp ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60' : 'bg-sky-50 text-sky-600'} shrink-0">
                        ${getIcon(cat?.icon || (isInc ? 'arrow-down-left' : 'shopping-cart'), 'w-4 h-4')}
                      </div>
                      <div class="truncate">
                        <p class="text-xs font-bold text-slate-900 dark:text-white truncate">${tx.description}</p>
                        <p class="text-[11px] text-slate-400 truncate">
                          ${formatDateDisplay(tx.date)} &bull; ${cat?.name || 'Geral'} &bull; ${acc?.name || ''}
                        </p>
                      </div>
                    </div>

                    <div class="text-right shrink-0">
                      <p class="text-xs font-bold ${isInc ? 'text-emerald-600 dark:text-emerald-400' : isExp ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600'}">
                        ${isInc ? '+' : isExp ? '-' : ''}${formatKwanza(tx.amountCents, { masked: isMasked })}
                      </p>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    // Apply query action
    const applyQuery = async () => {
      if (!query) return;
      await addSearchHistoryItem({
        type: 'query',
        text: query,
      });
      close();
      params.onSelectQuery(query);
    };

    body.querySelector('#apply-query-action')?.addEventListener('click', applyQuery);

    // Click on match
    body.querySelectorAll('[data-select-match]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.getAttribute('data-select-match')!;
        const tx = transactions.find(t => t.id === id);
        if (tx) {
          const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : null;
          const acc = accountMap.get(tx.accountId);

          // Save transaction view to searchHistory IndexedDB store
          await addSearchHistoryItem({
            type: 'transaction_view',
            text: tx.description,
            targetId: tx.id,
            amountCents: tx.amountCents,
            categoryName: cat?.name,
            accountName: acc?.name,
          });
        }
        close();
        params.onSelectTransaction(id);
      });
    });
  };

  input.addEventListener('input', render);
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const query = input.value.trim();
      if (query) {
        await addSearchHistoryItem({
          type: 'query',
          text: query,
        });
        close();
        params.onSelectQuery(query);
      }
    }
  });

  render();
}
