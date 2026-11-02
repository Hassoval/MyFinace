/**
 * MyFinance - Application Entry Point & Client-side Hash Router
 * Pure Vanilla TypeScript / ES6+ architecture with IndexedDB persistence
 */

import './index.css';
import { getPreferredTheme, applyTheme, isPinSet, isAuthenticated } from './services/auth';
import { seedInitialDataIfEmpty } from './services/database';
import { runFinancialHealthChecks } from './services/notificationService';
import { renderShell } from './components/shell';
import { renderDashboard } from './views/dashboard';
import { renderTransactions } from './views/transactions';
import { renderAccounts } from './views/accounts';
import { renderBudgets } from './views/budgets';
import { renderPlanning } from './views/planning';
import { renderSavings } from './views/savings';
import { renderDebts } from './views/debts';
import { renderReports } from './views/reports';
import { renderSettings } from './views/settings';
import { openPinModal } from './components/modals';

async function initApp() {
  // 1. Apply user preferred theme
  applyTheme(getPreferredTheme());

  // 2. Initialize database and seed Angolan demo accounts if first run
  try {
    await seedInitialDataIfEmpty();
    await runFinancialHealthChecks();
  } catch (err) {
    console.warn('Database initialization warning:', err);
  }

  const root = document.getElementById('root');
  if (!root) return;

  // 3. Check PIN Lock protection
  if (isPinSet() && !isAuthenticated()) {
    root.innerHTML = `
      <div class="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div class="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl shadow-xl mb-4">
          MF
        </div>
        <h1 class="text-xl font-bold text-white mb-2">MyFinance Bloqueado</h1>
        <p class="text-xs text-slate-400 mb-6">Por favor, introduz o teu código PIN para aceder aos teus dados.</p>
        <button id="auth-unlock-btn" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-lg transition-all">
          Introduzir Código PIN
        </button>
      </div>
    `;

    const unlockBtn = document.getElementById('auth-unlock-btn');
    const triggerUnlock = () => {
      openPinModal({
        isUnlock: true,
        onSuccess: () => initApp(),
      });
    };
    unlockBtn?.addEventListener('click', triggerUnlock);
    triggerUnlock(); // Open automatically
    return;
  }

  // 4. Mount Application Shell and Router
  const defaultRoute = '#/dashboard';
  let currentRoute = window.location.hash || defaultRoute;
  if (!window.location.hash) {
    window.location.hash = defaultRoute;
  }

  const navigateTo = async (route: string) => {
    currentRoute = route || defaultRoute;
    shellInstance.updateActiveNav(currentRoute);

    const container = shellInstance.mainContentContainer;
    container.innerHTML = `
      <div class="py-12 flex items-center justify-center text-slate-400 text-xs">
        <div class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        A carregar dados locais...
      </div>
    `;

    try {
      switch (currentRoute) {
        case '#/dashboard':
          await renderDashboard(container, (r) => { window.location.hash = r; navigateTo(r); });
          break;
        case '#/transactions':
          await renderTransactions(container, (r) => { window.location.hash = r; navigateTo(r); });
          break;
        case '#/accounts':
          await renderAccounts(container, (r) => { window.location.hash = r; navigateTo(r); });
          break;
        case '#/budgets':
          await renderBudgets(container, (r) => { window.location.hash = r; navigateTo(r); });
          break;
        case '#/planning':
          await renderPlanning(container, (r) => { window.location.hash = r; navigateTo(r); });
          break;
        case '#/savings':
          await renderSavings(container, (r) => { window.location.hash = r; navigateTo(r); });
          break;
        case '#/debts':
          await renderDebts(container, (r) => { window.location.hash = r; navigateTo(r); });
          break;
        case '#/reports':
          await renderReports(container, (r) => { window.location.hash = r; navigateTo(r); });
          break;
        case '#/settings':
          await renderSettings(container, (r) => { window.location.hash = r; navigateTo(r); });
          break;
        default:
          await renderDashboard(container, (r) => { window.location.hash = r; navigateTo(r); });
          break;
      }
    } catch (err) {
      console.error('Error rendering route:', err);
      container.innerHTML = `
        <div class="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-rose-600 text-xs">
          Erro ao carregar a secção (${currentRoute}). Recarrega a página.
        </div>
      `;
    }
  };

  let shellInstance = renderShell(root, currentRoute, (newRoute) => {
    window.location.hash = newRoute;
    navigateTo(newRoute);
  });

  window.addEventListener('hashchange', () => {
    navigateTo(window.location.hash);
  });

  // Initial route load
  navigateTo(currentRoute);
}

// Register Service Worker for PWA Offline Capability
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.log('ServiceWorker registration note:', err);
    });
  });
}

// Bootstrap
initApp();
