/**
 * MyFinance - Settings, Security & Backup Management View
 * PIN security, Privacy mode, JSON backup/restore with validation, and data safety.
 */

import {
  isPinSet,
  isPrivacyModeActive,
  setPrivacyMode,
  getPreferredTheme,
  applyTheme,
  Theme,
} from '../services/auth';
import {
  exportDatabaseToJSON,
  validateBackupData,
  restoreDatabaseFromJSON,
  exportTransactionsToCSV,
} from '../services/backup';
import { seedInitialDataIfEmpty, getDB } from '../services/database';
import { getIcon } from '../utils/icons';
import { openPinModal, showConfirmDialog, showModal } from '../components/modals';

export async function renderSettings(container: HTMLElement, onNavigate: (route: string) => void): Promise<void> {
  const hasPin = isPinSet();
  const privacyActive = isPrivacyModeActive();
  const currentTheme = getPreferredTheme();

  container.innerHTML = `
    <div class="space-y-6 pb-12 max-w-4xl">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Definições & Segurança</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Preferências locais, segurança por PIN, temas e gestão de cópias de segurança.</p>
      </div>

      <!-- Card 1: Visual & Privacy -->
      <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-5">
        <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          ${getIcon('eye', 'w-5 h-5 text-emerald-600')} Preferências de Interface & Privacidade
        </h2>

        <div class="divide-y divide-slate-100 dark:divide-slate-800">
          <!-- Theme Toggle -->
          <div class="py-3.5 flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-slate-900 dark:text-white">Tema da Aplicação</p>
              <p class="text-xs text-slate-500">Alterna entre o modo escuro (Dark) e claro (Light).</p>
            </div>
            <div class="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button id="theme-light-btn" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${currentTheme === 'light' ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-xs' : 'text-slate-500'}">
                ${getIcon('sun', 'w-3.5 h-3.5')} Claro
              </button>
              <button id="theme-dark-btn" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${currentTheme === 'dark' ? 'bg-white dark:bg-slate-700 text-sky-400 shadow-xs' : 'text-slate-500'}">
                ${getIcon('moon', 'w-3.5 h-3.5')} Escuro
              </button>
            </div>
          </div>

          <!-- Privacy Mode Toggle -->
          <div class="py-3.5 flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-slate-900 dark:text-white">Modo Privacidade (Ocultar Saldos)</p>
              <p class="text-xs text-slate-500">Substitui os valores monetários por asteriscos para evitar olhares curiosos em público.</p>
            </div>
            <button id="privacy-toggle-btn" class="px-4 py-2 rounded-xl text-xs font-semibold transition-all ${privacyActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">
              ${privacyActive ? 'Ativo (Oculto)' : 'Desativado'}
            </button>
          </div>
        </div>
      </div>

      <!-- Card 2: Security & PIN -->
      <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-5">
        <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          ${getIcon('lock', 'w-5 h-5 text-emerald-600')} Segurança & Código PIN Local
        </h2>

        <div class="space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-slate-900 dark:text-white">Proteção por Código PIN</p>
              <p class="text-xs text-slate-500">Exige um código de 4 a 6 dígitos para aceder à aplicação neste navegador.</p>
            </div>
            <button id="pin-setup-btn" class="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors">
              ${hasPin ? 'Alterar / Remover PIN' : 'Configurar PIN'}
            </button>
          </div>

          <div class="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-500 leading-relaxed space-y-1">
            <p class="font-semibold text-slate-700 dark:text-slate-300">Nota sobre Privacidade e Armazenamento:</p>
            <p>O MyFinance funciona 100% no teu dispositivo. Os teus dados financeiros ficam guardados na base de dados IndexedDB deste navegador e <strong>nunca são transmitidos para servidores externos</strong>. O código PIN atua como uma barreira de ecrã local; o armazenamento no navegador não equivale a um cofre bancário cifrado por hardware.</p>
          </div>
        </div>
      </div>

      <!-- Card 3: Backup & Restore -->
      <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-5">
        <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          ${getIcon('download', 'w-5 h-5 text-emerald-600')} Cópias de Segurança & Portabilidade
        </h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Export JSON -->
          <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3 flex flex-col justify-between">
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">Exportar Cópia Completa (JSON)</h3>
              <p class="text-xs text-slate-500 mt-1">Guarda todas as contas, transações, orçamentos, metas e dívidas num único ficheiro seguro.</p>
            </div>
            <button id="backup-export-btn" class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all">
              ${getIcon('download', 'w-4 h-4')} Descarregar Backup JSON
            </button>
          </div>

          <!-- Restore JSON -->
          <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3 flex flex-col justify-between">
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">Restaurar Cópia (JSON)</h3>
              <p class="text-xs text-slate-500 mt-1">Recupera dados a partir de um ficheiro de cópia de segurança MyFinance previamente exportado.</p>
            </div>
            <div>
              <input type="file" id="backup-restore-input" accept=".json,application/json" class="hidden">
              <button id="backup-restore-btn" class="w-full py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all">
                ${getIcon('upload', 'w-4 h-4')} Carregar Ficheiro JSON
              </button>
            </div>
          </div>
        </div>

        <div class="pt-2">
          <button id="backup-csv-btn" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5">
            ${getIcon('file-text', 'w-4 h-4')} Exportar apenas Transações para folha de cálculo (CSV compatível com Excel)
          </button>
        </div>
      </div>

      <!-- Card 4: Danger Zone -->
      <div class="p-6 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-950/80 rounded-2xl shadow-xs space-y-4">
        <h2 class="text-base font-bold text-rose-600 flex items-center gap-2">
          ${getIcon('alert-triangle', 'w-5 h-5')} Zona de Perigo
        </h2>

        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-slate-900 dark:text-white">Repor ou Apagar Dados Financeiros</p>
            <p class="text-xs text-slate-500">Elimina de forma irreversível todas as contas, transações e orçamentos do navegador.</p>
          </div>
          <button id="danger-reset-btn" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors shrink-0">
            Apagar Todos os Dados
          </button>
        </div>
      </div>
    </div>
  `;

  // Visual & Privacy handlers
  container.querySelector('#theme-light-btn')?.addEventListener('click', () => {
    applyTheme('light');
    renderSettings(container, onNavigate);
  });

  container.querySelector('#theme-dark-btn')?.addEventListener('click', () => {
    applyTheme('dark');
    renderSettings(container, onNavigate);
  });

  container.querySelector('#privacy-toggle-btn')?.addEventListener('click', () => {
    setPrivacyMode(!privacyActive);
    renderSettings(container, onNavigate);
  });

  // PIN Setup
  container.querySelector('#pin-setup-btn')?.addEventListener('click', () => {
    openPinModal({
      onSuccess: () => renderSettings(container, onNavigate),
    });
  });

  // Export JSON
  container.querySelector('#backup-export-btn')?.addEventListener('click', async () => {
    await exportDatabaseToJSON();
  });

  // Export CSV
  container.querySelector('#backup-csv-btn')?.addEventListener('click', async () => {
    await exportTransactionsToCSV();
  });

  // Restore JSON
  const fileInput = container.querySelector('#backup-restore-input') as HTMLInputElement;
  const restoreBtn = container.querySelector('#backup-restore-btn') as HTMLButtonElement;

  restoreBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const json = JSON.parse(reader.result as string);
        const validation = validateBackupData(json);

        if (!validation.valid) {
          alert(`Erro na validação do ficheiro: ${validation.error}`);
          return;
        }

        const s = validation.summary;
        const confirmMsg = `
          Resumo do ficheiro a restaurar:
          - ${s.accountsCount} contas financeiras
          - ${s.transactionsCount} transações
          - ${s.budgetsCount} orçamentos
          - ${s.goalsCount} metas de poupança
          - ${s.debtsCount} dívidas

          ATENÇÃO: A restauração irá substituir completamente a tua base de dados atual. Tens a certeza de que desejas continuar?
        `;

        showConfirmDialog({
          title: 'Confirmar Restauração de Dados',
          message: confirmMsg,
          isDanger: true,
          confirmText: 'Substituir e Restaurar',
          onConfirm: async () => {
            await restoreDatabaseFromJSON(json);
            alert('Cópia de segurança restaurada com sucesso!');
            onNavigate('#/dashboard');
          },
        });
      } catch (e) {
        alert('Falha ao processar o ficheiro JSON. Certifica-te de que o ficheiro está intacto.');
      }
    };
    reader.readAsText(file);
  });

  // Danger Reset
  container.querySelector('#danger-reset-btn')?.addEventListener('click', () => {
    const phrase = prompt('Para confirmar a eliminação de todos os dados financeiros locais, escreve exatamente "APAGAR TUDO":');
    if (phrase === 'APAGAR TUDO') {
      indexedDB.deleteDatabase('MyFinanceDB');
      localStorage.clear();
      sessionStorage.clear();
      alert('Todos os dados locais foram eliminados. A aplicação será reiniciada.');
      window.location.reload();
    } else if (phrase !== null) {
      alert('Frase de confirmação incorreta. Nenhuma alteração foi realizada.');
    }
  });
}
