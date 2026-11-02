/**
 * MyFinance - Master Application Shell
 * Desktop sidebar, top bar, responsive mobile navigation, notifications drawer,
 * privacy mode toggle, and global PIN lock overlay.
 */

import { getIcon } from '../utils/icons';
import {
  isPinSet,
  isAuthenticated,
  lockSession,
  isPrivacyModeActive,
  togglePrivacyMode,
  getPreferredTheme,
  applyTheme,
} from '../services/auth';
import { getAllFromStore, putInStore, NotificationItem } from '../services/database';
import { openPinModal, openTransactionModal } from './modals';
import { openSearchHistoryModal } from './searchHistoryModal';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Visão Geral', icon: 'pie-chart', route: '#/dashboard' },
  { id: 'transactions', label: 'Transações', icon: 'file-text', route: '#/transactions' },
  { id: 'accounts', label: 'Contas', icon: 'landmark', route: '#/accounts' },
  { id: 'budgets', label: 'Orçamentos', icon: 'scale', route: '#/budgets' },
  { id: 'planning', label: 'Planeamento', icon: 'calendar', route: '#/planning' },
  { id: 'savings', label: 'Poupanças', icon: 'target', route: '#/savings' },
  { id: 'debts', label: 'Dívidas', icon: 'trending-down', route: '#/debts' },
  { id: 'reports', label: 'Relatórios', icon: 'printer', route: '#/reports' },
  { id: 'settings', label: 'Definições', icon: 'settings', route: '#/settings' },
];

export function renderShell(
  rootElement: HTMLElement,
  currentRoute: string,
  onNavigate: (route: string) => void
): { mainContentContainer: HTMLElement; updateActiveNav: (newRoute: string) => void } {
  const isDark = document.documentElement.classList.contains('dark');
  const isMasked = isPrivacyModeActive();
  const hasPin = isPinSet();

  rootElement.innerHTML = `
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row antialiased transition-colors duration-200">
      
      <!-- DESKTOP SIDEBAR -->
      <aside class="hidden md:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 shrink-0 sticky top-0 h-screen z-20">
        <!-- Brand Header -->
        <div class="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-xs">
            MF
          </div>
          <div>
            <span class="text-lg font-black tracking-tight text-slate-900 dark:text-white">MyFinance</span>
            <p class="text-[10px] text-slate-400 font-medium">Angola &bull; Offline First</p>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          ${NAV_ITEMS.map(item => `
            <a href="${item.route}" data-nav-route="${item.route}" class="nav-link flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${currentRoute === item.route ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'}">
              ${getIcon(item.icon, 'w-4 h-4')}
              <span>${item.label}</span>
            </a>
          `).join('')}
        </nav>

        <!-- Sidebar Footer Controls -->
        <div class="p-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
          <!-- Privacy Mode Toggle Button -->
          <button id="shell-privacy-btn" class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <span class="flex items-center gap-2">
              ${getIcon(isMasked ? 'eye-off' : 'eye', 'w-4 h-4')}
              <span>Modo Privacidade</span>
            </span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md ${isMasked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}">
              ${isMasked ? 'ON' : 'OFF'}
            </span>
          </button>

          <!-- Theme Toggle Button -->
          <button id="shell-theme-btn" class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <span class="flex items-center gap-2">
              ${getIcon(isDark ? 'sun' : 'moon', 'w-4 h-4')}
              <span>Tema ${isDark ? 'Escuro' : 'Claro'}</span>
            </span>
            <span class="text-[10px] text-slate-400">Alternar</span>
          </button>

          ${hasPin ? `
          <!-- Lock Button -->
          <button id="shell-lock-btn" class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors">
            ${getIcon('lock', 'w-4 h-4')}
            <span>Bloquear Sessão</span>
          </button>` : ''}
        </div>
      </aside>

      <!-- MAIN CONTENT WRAPPER -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Top App Bar (Mobile & Desktop Header) -->
        <header class="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="md:hidden flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                MF
              </div>
              <span class="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">MyFinance</span>
            </div>
            <p class="hidden lg:block text-xs font-medium text-slate-400 italic">"Controla o teu dinheiro. Constrói o teu futuro."</p>
          </div>

          <!-- Quick Search & History Button in Navigation Bar -->
          <div class="flex-1 max-w-xs sm:max-w-md mx-2 sm:mx-4">
            <button id="shell-search-btn" class="w-full flex items-center justify-between px-3 py-1.5 sm:py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-500 dark:text-slate-400 transition-colors group cursor-pointer" aria-label="Pesquisar e Histórico">
              <span class="flex items-center gap-2 truncate">
                ${getIcon('search', 'w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500')}
                <span class="truncate">Pesquisar ou ver histórico...</span>
              </span>
              <kbd class="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-400">⌘K</kbd>
            </button>
          </div>

          <!-- Header Right Actions -->
          <div class="flex items-center gap-1.5 sm:gap-3">
            <!-- Mobile Privacy Toggle -->
            <button id="mobile-privacy-btn" class="md:hidden p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" title="Ocultar valores">
              ${getIcon(isMasked ? 'eye-off' : 'eye', 'w-5 h-5')}
            </button>

            <!-- Notifications Bell -->
            <div class="relative">
              <button id="shell-notif-btn" class="relative p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Notificações">
                ${getIcon('bell', 'w-5 h-5')}
                <span id="notif-badge" class="hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500"></span>
              </button>

              <!-- Notifications Dropdown Box -->
              <div id="notif-dropdown" class="hidden absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-4 space-y-3">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Notificações</h4>
                  <button id="notif-clear-btn" class="text-[11px] text-emerald-600 hover:underline">Marcar lidas</button>
                </div>
                <div id="notif-list" class="max-h-64 overflow-y-auto space-y-2 text-xs">
                  <!-- Injected dynamically -->
                </div>
              </div>
            </div>

            <!-- Quick Add Button (Desktop) -->
            <button id="topbar-add-tx-btn" class="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all">
              ${getIcon('plus', 'w-3.5 h-3.5')} Transação
            </button>
          </div>
        </header>

        <!-- Dynamic Main Page View Container -->
        <main id="main-content-area" class="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
          <!-- Page view is injected here -->
        </main>
      </div>

      <!-- MOBILE BOTTOM NAVIGATION BAR -->
      <nav class="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-2 flex items-center justify-around">
        <a href="#/dashboard" class="mobile-nav-link flex flex-col items-center gap-1 text-[10px] font-semibold ${currentRoute === '#/dashboard' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}">
          ${getIcon('pie-chart', 'w-5 h-5')}
          <span>Início</span>
        </a>

        <a href="#/transactions" class="mobile-nav-link flex flex-col items-center gap-1 text-[10px] font-semibold ${currentRoute === '#/transactions' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}">
          ${getIcon('file-text', 'w-5 h-5')}
          <span>Transações</span>
        </a>

        <!-- FAB: Center Quick Add Button -->
        <button id="mobile-fab-btn" class="-mt-5 w-12 h-12 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all" aria-label="Nova Transação">
          ${getIcon('plus', 'w-6 h-6')}
        </button>

        <a href="#/accounts" class="mobile-nav-link flex flex-col items-center gap-1 text-[10px] font-semibold ${currentRoute === '#/accounts' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}">
          ${getIcon('landmark', 'w-5 h-5')}
          <span>Contas</span>
        </a>

        <button id="mobile-menu-more-btn" class="mobile-nav-link flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-500">
          ${getIcon('menu', 'w-5 h-5')}
          <span>Mais</span>
        </button>
      </nav>

      <!-- MOBILE "MAIS" DRAWER -->
      <div id="mobile-more-drawer" class="hidden fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end">
        <div class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Todas as Ferramentas</h3>
            <button id="close-mobile-more-btn" class="p-1 text-slate-400 hover:text-slate-600">${getIcon('x', 'w-5 h-5')}</button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <a href="#/budgets" class="drawer-link p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center gap-3 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span class="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">${getIcon('scale', 'w-4 h-4')}</span>
              Orçamentos
            </a>
            <a href="#/planning" class="drawer-link p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center gap-3 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span class="p-2 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600">${getIcon('calendar', 'w-4 h-4')}</span>
              Planeamento
            </a>
            <a href="#/savings" class="drawer-link p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center gap-3 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span class="p-2 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600">${getIcon('target', 'w-4 h-4')}</span>
              Poupanças
            </a>
            <a href="#/debts" class="drawer-link p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center gap-3 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span class="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600">${getIcon('trending-down', 'w-4 h-4')}</span>
              Dívidas
            </a>
            <a href="#/reports" class="drawer-link p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center gap-3 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span class="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600">${getIcon('printer', 'w-4 h-4')}</span>
              Relatórios
            </a>
            <a href="#/settings" class="drawer-link p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center gap-3 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span class="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">${getIcon('settings', 'w-4 h-4')}</span>
              Definições
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach controls
  const mainContentContainer = rootElement.querySelector('#main-content-area') as HTMLElement;

  // Privacy toggle
  const handlePrivacyToggle = () => {
    const isNowMasked = togglePrivacyMode();
    const btn = rootElement.querySelector('#shell-privacy-btn');
    if (btn) {
      btn.innerHTML = `
        <span class="flex items-center gap-2">
          ${getIcon(isNowMasked ? 'eye-off' : 'eye', 'w-4 h-4')}
          <span>Modo Privacidade</span>
        </span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-md ${isNowMasked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}">
          ${isNowMasked ? 'ON' : 'OFF'}
        </span>
      `;
    }
    const mobileBtn = rootElement.querySelector('#mobile-privacy-btn');
    if (mobileBtn) {
      mobileBtn.innerHTML = getIcon(isNowMasked ? 'eye-off' : 'eye', 'w-5 h-5');
    }
    onNavigate(window.location.hash || '#/dashboard');
  };
  rootElement.querySelector('#shell-privacy-btn')?.addEventListener('click', handlePrivacyToggle);
  rootElement.querySelector('#mobile-privacy-btn')?.addEventListener('click', handlePrivacyToggle);

  // Theme toggle
  rootElement.querySelector('#shell-theme-btn')?.addEventListener('click', () => {
    const current = getPreferredTheme();
    applyTheme(current === 'dark' ? 'light' : 'dark');
    onNavigate(window.location.hash || '#/dashboard');
  });

  // Lock session
  rootElement.querySelector('#shell-lock-btn')?.addEventListener('click', () => {
    lockSession();
    window.location.reload();
  });

  // Quick transaction triggers
  const handleOpenTx = () => {
    openTransactionModal({
      onSaved: () => onNavigate(window.location.hash || '#/dashboard'),
    });
  };
  rootElement.querySelector('#topbar-add-tx-btn')?.addEventListener('click', handleOpenTx);
  rootElement.querySelector('#mobile-fab-btn')?.addEventListener('click', handleOpenTx);

  // Search History Modal trigger in navigation
  const handleOpenSearch = () => {
    openSearchHistoryModal({
      onSelectQuery: (query) => {
        window.location.hash = `#/transactions?q=${encodeURIComponent(query)}`;
        onNavigate(window.location.hash);
      },
      onSelectTransaction: (txId) => {
        window.location.hash = `#/transactions?tx=${encodeURIComponent(txId)}`;
        onNavigate(window.location.hash);
      },
    });
  };

  rootElement.querySelector('#shell-search-btn')?.addEventListener('click', handleOpenSearch);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  const handleGlobalShortcut = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      handleOpenSearch();
    }
  };
  window.addEventListener('keydown', handleGlobalShortcut);

  // Mobile More Drawer toggle
  const drawer = rootElement.querySelector('#mobile-more-drawer') as HTMLElement;
  rootElement.querySelector('#mobile-menu-more-btn')?.addEventListener('click', () => {
    drawer.classList.remove('hidden');
  });
  rootElement.querySelector('#close-mobile-more-btn')?.addEventListener('click', () => {
    drawer.classList.add('hidden');
  });
  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) drawer.classList.add('hidden');
  });
  drawer.querySelectorAll('.drawer-link').forEach(link => {
    link.addEventListener('click', () => drawer.classList.add('hidden'));
  });

  // Notifications Popover
  const notifBtn = rootElement.querySelector('#shell-notif-btn') as HTMLElement;
  const notifDropdown = rootElement.querySelector('#notif-dropdown') as HTMLElement;
  const notifList = rootElement.querySelector('#notif-list') as HTMLElement;
  const notifBadge = rootElement.querySelector('#notif-badge') as HTMLElement;

  const loadNotifications = async () => {
    const notifs = await getAllFromStore<NotificationItem>('notifications');
    const unread = notifs.filter(n => !n.isRead);

    if (unread.length > 0) {
      notifBadge.classList.remove('hidden');
    } else {
      notifBadge.classList.add('hidden');
    }

    if (notifs.length === 0) {
      notifList.innerHTML = '<p class="text-slate-400 py-3 text-center">Sem notificações no momento.</p>';
    } else {
      notifList.innerHTML = notifs.slice(0, 5).map(n => `
        <div class="p-2.5 rounded-xl ${n.isRead ? 'bg-slate-50 dark:bg-slate-800/40 opacity-70' : 'bg-emerald-50/50 dark:bg-emerald-950/30'} space-y-1">
          <p class="font-bold text-slate-900 dark:text-white">${n.title}</p>
          <p class="text-[11px] text-slate-500">${n.message}</p>
        </div>
      `).join('');
    }
  };

  loadNotifications();

  notifBtn.addEventListener('click', () => {
    notifDropdown.classList.toggle('hidden');
  });

  rootElement.querySelector('#notif-clear-btn')?.addEventListener('click', async () => {
    const notifs = await getAllFromStore<NotificationItem>('notifications');
    for (const n of notifs) {
      n.isRead = true;
      await putInStore('notifications', n);
    }
    loadNotifications();
  });

  const updateActiveNav = (newRoute: string) => {
    rootElement.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('data-nav-route');
      if (href === newRoute) {
        link.className = 'nav-link flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-all';
      } else {
        link.className = 'nav-link flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-all';
      }
    });
  };

  return { mainContentContainer, updateActiveNav };
}
