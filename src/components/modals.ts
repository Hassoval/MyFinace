/**
 * MyFinance - Interactive Modals System
 * Provides forms for transactions, transfers, accounts, savings goals, debts, and PIN locks.
 */

import {
  getAllFromStore,
  addTransaction,
  deleteTransaction,
  putInStore,
  addGoalMovement,
  addDebtPayment,
  payPlannedExpense,
  Account,
  Category,
  SavingsGoal,
  Debt,
  PlannedExpense,
} from '../services/database';
import { formatKwanza, parseKwanzaToCents } from '../services/calculations';
import { getIcon } from '../utils/icons';
import { setPin, verifyPin, removePin, isPinSet } from '../services/auth';

/**
 * Global helper to show a modal dialog
 */
export function showModal(title: string, bodyHtml: string, footerHtml: string = ''): HTMLElement {
  closeModal(); // Close any currently open modal

  const modalContainer = document.createElement('div');
  modalContainer.id = 'active-modal-container';
  modalContainer.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-200';

  modalContainer.innerHTML = `
    <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">${title}</h3>
        <button id="modal-close-btn" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Fechar">
          ${getIcon('x', 'w-5 h-5')}
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 overflow-y-auto space-y-4 text-slate-700 dark:text-slate-300">
        ${bodyHtml}
      </div>

      <!-- Footer -->
      ${footerHtml ? `
      <div class="px-6 py-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-3">
        ${footerHtml}
      </div>` : ''}
    </div>
  `;

  document.body.appendChild(modalContainer);

  // Close handlers
  const closeBtn = modalContainer.querySelector('#modal-close-btn');
  closeBtn?.addEventListener('click', closeModal);

  modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
      closeModal();
    }
  });

  return modalContainer;
}

export function closeModal(): void {
  const existing = document.getElementById('active-modal-container');
  if (existing) {
    existing.remove();
  }
}

/**
 * Confirmation dialog helper
 */
export function showConfirmDialog(params: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => Promise<void> | void;
}): void {
  const {
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDanger = false,
    onConfirm,
  } = params;

  const bodyHtml = `
    <div class="flex items-start gap-4">
      <div class="p-3 rounded-full ${isDanger ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600' : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600'} shrink-0">
        ${getIcon(isDanger ? 'trash-2' : 'alert-triangle', 'w-6 h-6')}
      </div>
      <div>
        <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-300">${message}</p>
      </div>
    </div>
  `;

  const footerHtml = `
    <button id="dialog-cancel-btn" class="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
      ${cancelText}
    </button>
    <button id="dialog-confirm-btn" class="px-4 py-2 text-sm font-medium text-white ${isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} rounded-xl shadow-xs transition-colors">
      ${confirmText}
    </button>
  `;

  const modal = showModal(title, bodyHtml, footerHtml);

  modal.querySelector('#dialog-cancel-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#dialog-confirm-btn')?.addEventListener('click', async () => {
    closeModal();
    await onConfirm();
  });
}

// -------------------------------------------------------------
// NEW / EDIT TRANSACTION MODAL
// -------------------------------------------------------------

export async function openTransactionModal(params: {
  initialType?: 'income' | 'expense' | 'transfer';
  onSaved: () => void;
}): Promise<void> {
  const [accounts, categories] = await Promise.all([
    getAllFromStore<Account>('accounts'),
    getAllFromStore<Category>('categories'),
  ]);

  const activeAccounts = accounts.filter(a => !a.isArchived);
  const currentType = params.initialType || 'expense';

  const bodyHtml = `
    <form id="tx-modal-form" class="space-y-4">
      <!-- Type Switcher -->
      <div class="grid grid-cols-3 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-sm font-medium">
        <button type="button" data-type="expense" class="tx-type-tab py-2 rounded-lg text-center transition-all ${currentType === 'expense' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'}">
          Despesa
        </button>
        <button type="button" data-type="income" class="tx-type-tab py-2 rounded-lg text-center transition-all ${currentType === 'income' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'}">
          Receita
        </button>
        <button type="button" data-type="transfer" class="tx-type-tab py-2 rounded-lg text-center transition-all ${currentType === 'transfer' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'}">
          Transferência
        </button>
      </div>

      <input type="hidden" id="tx-type-input" value="${currentType}">

      <!-- Amount -->
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Valor (Kwanza - AOA) *
        </label>
        <div class="relative">
          <input type="text" id="tx-amount-input" required placeholder="ex: 15.000,00" class="w-full pl-4 pr-16 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
          <span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">Kz</span>
        </div>
        <p id="tx-amount-preview" class="text-xs text-slate-500 mt-1">Previsualização: 0,00 Kz</p>
      </div>

      <!-- Description -->
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Descrição *
        </label>
        <input type="text" id="tx-desc-input" required placeholder="ex: Supermercado Kero, Salário, Sonangol..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
      </div>

      <!-- Date -->
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Data *
        </label>
        <input type="date" id="tx-date-input" required value="${new Date().toISOString().split('T')[0]}" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
      </div>

      <!-- Category (for Income and Expense) -->
      <div id="tx-category-field">
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Categoria *
        </label>
        <select id="tx-category-select" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none">
          ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>

      <!-- Account (Source) -->
      <div id="tx-source-account-field">
        <label id="tx-account-label" class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Conta de Pagamento *
        </label>
        <select id="tx-account-select" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none">
          ${activeAccounts.map(a => `<option value="${a.id}">${a.name} (${formatKwanza(a.balanceCents)})</option>`).join('')}
        </select>
      </div>

      <!-- Destination Account (for Transfer only) -->
      <div id="tx-dest-account-field" class="hidden">
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Conta de Destino *
        </label>
        <select id="tx-to-account-select" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none">
          ${activeAccounts.map(a => `<option value="${a.id}">${a.name} (${formatKwanza(a.balanceCents)})</option>`).join('')}
        </select>
      </div>

      <!-- Receipt Attachment (optional) -->
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Comprovativo / Recibo (opcional)
        </label>
        <input type="file" id="tx-attachment-input" accept="image/*,.pdf" class="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200 cursor-pointer">
        <div id="tx-attachment-preview" class="text-xs text-emerald-600 dark:text-emerald-400 mt-1 hidden">Ficheiro carregado com sucesso.</div>
      </div>

      <!-- Notes -->
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Observações
        </label>
        <textarea id="tx-notes-input" rows="2" placeholder="Notas adicionais..." class="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none"></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button id="tx-cancel-btn" type="button" class="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50">
      Cancelar
    </button>
    <button id="tx-submit-btn" type="button" class="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-2">
      ${getIcon('check', 'w-4 h-4')} Guardar Transação
    </button>
  `;

  const modal = showModal('Nova Transação', bodyHtml, footerHtml);

  // Dynamic type switcher handling
  const typeTabs = modal.querySelectorAll('.tx-type-tab');
  const typeInput = modal.querySelector('#tx-type-input') as HTMLInputElement;
  const categoryField = modal.querySelector('#tx-category-field') as HTMLElement;
  const destAccountField = modal.querySelector('#tx-dest-account-field') as HTMLElement;
  const accountLabel = modal.querySelector('#tx-account-label') as HTMLElement;
  const categorySelect = modal.querySelector('#tx-category-select') as HTMLSelectElement;

  const updateCategoryOptions = (type: 'income' | 'expense') => {
    const filteredCats = categories.filter(c => c.type === type);
    categorySelect.innerHTML = filteredCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  };

  updateCategoryOptions(currentType === 'income' ? 'income' : 'expense');

  typeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const selectedType = tab.getAttribute('data-type') as 'income' | 'expense' | 'transfer';
      typeInput.value = selectedType;

      typeTabs.forEach(t => {
        t.className = 'tx-type-tab py-2 rounded-lg text-center transition-all text-slate-600 dark:text-slate-400';
      });

      if (selectedType === 'expense') {
        tab.className = 'tx-type-tab py-2 rounded-lg text-center transition-all bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs font-semibold';
        categoryField.classList.remove('hidden');
        destAccountField.classList.add('hidden');
        accountLabel.textContent = 'Conta de Pagamento *';
        updateCategoryOptions('expense');
      } else if (selectedType === 'income') {
        tab.className = 'tx-type-tab py-2 rounded-lg text-center transition-all bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold';
        categoryField.classList.remove('hidden');
        destAccountField.classList.add('hidden');
        accountLabel.textContent = 'Conta de Depósito *';
        updateCategoryOptions('income');
      } else if (selectedType === 'transfer') {
        tab.className = 'tx-type-tab py-2 rounded-lg text-center transition-all bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs font-semibold';
        categoryField.classList.add('hidden');
        destAccountField.classList.remove('hidden');
        accountLabel.textContent = 'Conta de Origem *';
      }
    });
  });

  // Amount preview update
  const amountInput = modal.querySelector('#tx-amount-input') as HTMLInputElement;
  const amountPreview = modal.querySelector('#tx-amount-preview') as HTMLElement;
  amountInput.addEventListener('input', () => {
    const cents = parseKwanzaToCents(amountInput.value);
    amountPreview.textContent = `Previsualização: ${formatKwanza(cents)}`;
  });

  // File reader for attachment
  let attachmentBase64 = '';
  let attachmentName = '';
  const fileInput = modal.querySelector('#tx-attachment-input') as HTMLInputElement;
  const attachmentPreview = modal.querySelector('#tx-attachment-preview') as HTMLElement;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('O ficheiro é demasiado grande (limite: 2MB).');
        fileInput.value = '';
        return;
      }
      attachmentName = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        attachmentBase64 = reader.result as string;
        attachmentPreview.textContent = `Anexo carregado: ${file.name}`;
        attachmentPreview.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  });

  // Cancel
  modal.querySelector('#tx-cancel-btn')?.addEventListener('click', closeModal);

  // Submit
  modal.querySelector('#tx-submit-btn')?.addEventListener('click', async () => {
    const amountVal = amountInput.value.trim();
    const cents = parseKwanzaToCents(amountVal);
    if (!cents || cents <= 0) {
      alert('Por favor, introduz um valor válido maior que zero.');
      amountInput.focus();
      return;
    }

    const descInput = modal.querySelector('#tx-desc-input') as HTMLInputElement;
    const desc = descInput.value.trim();
    if (!desc) {
      alert('Por favor, indica a descrição da transação.');
      descInput.focus();
      return;
    }

    const date = (modal.querySelector('#tx-date-input') as HTMLInputElement).value;
    const type = typeInput.value as 'income' | 'expense' | 'transfer';
    const accountId = (modal.querySelector('#tx-account-select') as HTMLSelectElement).value;
    const toAccountId = (modal.querySelector('#tx-to-account-select') as HTMLSelectElement)?.value;
    const categoryId = (modal.querySelector('#tx-category-select') as HTMLSelectElement)?.value;
    const notes = (modal.querySelector('#tx-notes-input') as HTMLTextAreaElement).value.trim();

    if (type === 'transfer' && accountId === toAccountId) {
      alert('A conta de origem e a de destino não podem ser a mesma.');
      return;
    }

    await addTransaction({
      type,
      description: desc,
      amountCents: cents,
      date,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type !== 'transfer' ? categoryId : undefined,
      notes,
      attachmentData: attachmentBase64 || undefined,
      attachmentName: attachmentName || undefined,
      isPaid: true,
    });

    closeModal();
    params.onSaved();
  });
}

// -------------------------------------------------------------
// NEW ACCOUNT MODAL
// -------------------------------------------------------------

export function openAccountModal(params: { onSaved: () => void }): void {
  const bodyHtml = `
    <form id="acc-modal-form" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Nome da Conta *
        </label>
        <input type="text" id="acc-name-input" required placeholder="ex: Banco BAI Principal, Carteira Kwanza..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none">
      </div>

      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Tipo de Conta *
        </label>
        <select id="acc-type-select" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none">
          <option value="bank">Conta Bancária (BAI, BFA, BIC, Standard Bank, etc.)</option>
          <option value="wallet">Carteira Digital (Multicaixa Express, Unitel Money, etc.)</option>
          <option value="cash">Dinheiro Físico / Carteira</option>
          <option value="savings">Conta Poupança / Reserva de Emergência</option>
        </select>
      </div>

      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Saldo Inicial (Kz)
        </label>
        <input type="text" id="acc-balance-input" placeholder="0,00" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none">
      </div>

      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Instituição Financeira / Entidade
        </label>
        <input type="text" id="acc-inst-input" placeholder="ex: BAI, BFA, EMIS, Dinheiro vivo" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none">
      </div>

      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Número da Conta / IBAN (opcional)
        </label>
        <input type="text" id="acc-number-input" placeholder="ex: AO06.0040..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none">
      </div>
    </form>
  `;

  const footerHtml = `
    <button id="acc-cancel-btn" class="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl">Cancelar</button>
    <button id="acc-submit-btn" class="px-5 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl">Criar Conta</button>
  `;

  const modal = showModal('Criar Nova Conta Financeira', bodyHtml, footerHtml);

  modal.querySelector('#acc-cancel-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#acc-submit-btn')?.addEventListener('click', async () => {
    const name = (modal.querySelector('#acc-name-input') as HTMLInputElement).value.trim();
    if (!name) {
      alert('Indica o nome da conta.');
      return;
    }
    const type = (modal.querySelector('#acc-type-select') as HTMLSelectElement).value as Account['type'];
    const balanceInput = (modal.querySelector('#acc-balance-input') as HTMLInputElement).value;
    const balanceCents = parseKwanzaToCents(balanceInput);
    const institution = (modal.querySelector('#acc-inst-input') as HTMLInputElement).value.trim();
    const accountNumber = (modal.querySelector('#acc-number-input') as HTMLInputElement).value.trim();

    const colors: Record<string, string> = {
      bank: '#0284c7',
      wallet: '#10b981',
      cash: '#f59e0b',
      savings: '#8b5cf6',
    };
    const icons: Record<string, string> = {
      bank: 'landmark',
      wallet: 'smartphone',
      cash: 'wallet',
      savings: 'piggy-bank',
    };

    const newAccount: Account = {
      id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      type,
      balanceCents,
      institution: institution || undefined,
      accountNumber: accountNumber || undefined,
      color: colors[type] || '#0284c7',
      icon: icons[type] || 'wallet',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await putInStore('accounts', newAccount);
    closeModal();
    params.onSaved();
  });
}

// -------------------------------------------------------------
// PIN SECURITY MODAL
// -------------------------------------------------------------

export function openPinModal(params: { onSuccess: () => void; isUnlock?: boolean }): void {
  const isSet = isPinSet();
  const title = params.isUnlock ? 'Autenticação MyFinance' : isSet ? 'Alterar ou Remover Código PIN' : 'Definir Código PIN de Segurança';

  const bodyHtml = `
    <div class="space-y-4 text-center">
      <div class="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
        ${getIcon('lock', 'w-6 h-6')}
      </div>
      <div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          ${params.isUnlock
            ? 'Introduz o teu código PIN local para aceder aos teus dados financeiros.'
            : 'O PIN protege o acesso à aplicação neste navegador. Os dados permanecem guardados no teu dispositivo.'}
        </p>
      </div>

      <div class="flex justify-center gap-2">
        <input type="password" id="pin-input" maxlength="6" autofocus placeholder="••••" class="w-40 tracking-widest text-center text-2xl px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500">
      </div>
      <p id="pin-error" class="text-xs text-rose-500 font-medium hidden">PIN incorreto. Tenta novamente.</p>

      ${!params.isUnlock && isSet ? `
      <div class="pt-2">
        <button id="pin-remove-btn" type="button" class="text-xs text-rose-500 hover:text-rose-700 underline">Desativar proteção por PIN</button>
      </div>` : ''}
    </div>
  `;

  const footerHtml = `
    ${params.isUnlock ? '' : `<button id="pin-cancel-btn" class="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl">Cancelar</button>`}
    <button id="pin-submit-btn" class="px-6 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-medium">
      ${params.isUnlock ? 'Desbloquear' : 'Guardar PIN'}
    </button>
  `;

  const modal = showModal(title, bodyHtml, footerHtml);
  const pinInput = modal.querySelector('#pin-input') as HTMLInputElement;
  const pinError = modal.querySelector('#pin-error') as HTMLElement;

  modal.querySelector('#pin-cancel-btn')?.addEventListener('click', closeModal);

  modal.querySelector('#pin-remove-btn')?.addEventListener('click', async () => {
    if (confirm('Tens a certeza de que desejas remover o PIN de segurança?')) {
      await removePin();
      closeModal();
      params.onSuccess();
    }
  });

  const handleSubmit = async () => {
    const pin = pinInput.value.trim();
    if (!pin || pin.length < 4) {
      pinError.textContent = 'O PIN deve ter entre 4 e 6 dígitos.';
      pinError.classList.remove('hidden');
      return;
    }

    if (params.isUnlock) {
      const valid = await verifyPin(pin);
      if (valid) {
        closeModal();
        params.onSuccess();
      } else {
        pinError.textContent = 'Código PIN incorreto.';
        pinError.classList.remove('hidden');
        pinInput.value = '';
        pinInput.focus();
      }
    } else {
      await setPin(pin);
      closeModal();
      params.onSuccess();
    }
  };

  modal.querySelector('#pin-submit-btn')?.addEventListener('click', handleSubmit);
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  });
}
