/**
 * MyFinance - Security, Privacy and Preferences Management
 * Local PIN hash via Web Crypto API, Privacy Mode, and Theme State
 */

const PIN_HASH_KEY = 'myfinance_pin_hash';
const PIN_SALT_KEY = 'myfinance_pin_salt';
const PRIVACY_MODE_KEY = 'myfinance_privacy_mode';
const THEME_KEY = 'myfinance_theme';
const LAST_ACTIVE_KEY = 'myfinance_last_active';
const AUTO_LOCK_MINUTES_KEY = 'myfinance_autolock_minutes';

/**
 * Hash a 4-to-6 digit PIN using SHA-256 with salt
 */
async function hashPin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${pin}:myfinance_angola`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isPinSet(): boolean {
  return !!localStorage.getItem(PIN_HASH_KEY);
}

export async function setPin(pin: string): Promise<void> {
  const salt = Math.random().toString(36).substring(2, 12);
  const hash = await hashPin(pin, salt);
  localStorage.setItem(PIN_SALT_KEY, salt);
  localStorage.setItem(PIN_HASH_KEY, hash);
  sessionStorage.setItem('myfinance_authenticated', 'true');
}

export async function removePin(): Promise<void> {
  localStorage.removeItem(PIN_SALT_KEY);
  localStorage.removeItem(PIN_HASH_KEY);
  sessionStorage.removeItem('myfinance_authenticated');
}

export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = localStorage.getItem(PIN_HASH_KEY);
  const salt = localStorage.getItem(PIN_SALT_KEY);
  if (!storedHash || !salt) return true; // No PIN set

  const testHash = await hashPin(pin, salt);
  const isValid = testHash === storedHash;
  if (isValid) {
    sessionStorage.setItem('myfinance_authenticated', 'true');
    touchActivity();
  }
  return isValid;
}

export function isAuthenticated(): boolean {
  if (!isPinSet()) return true;
  return sessionStorage.getItem('myfinance_authenticated') === 'true';
}

export function lockSession(): void {
  sessionStorage.removeItem('myfinance_authenticated');
}

export function touchActivity(): void {
  localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
}

export function shouldAutoLock(): boolean {
  if (!isPinSet()) return false;
  const timeoutMinutes = parseInt(localStorage.getItem(AUTO_LOCK_MINUTES_KEY) || '15', 10);
  if (timeoutMinutes <= 0) return false;

  const lastActive = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || '0', 10);
  if (!lastActive) return false;

  const diffMs = Date.now() - lastActive;
  return diffMs > timeoutMinutes * 60 * 1000;
}

// -------------------------------------------------------------
// PRIVACY MODE (Masking balances)
// -------------------------------------------------------------

export function isPrivacyModeActive(): boolean {
  return localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
}

export function setPrivacyMode(enabled: boolean): void {
  localStorage.setItem(PRIVACY_MODE_KEY, enabled ? 'true' : 'false');
}

export function togglePrivacyMode(): boolean {
  const current = isPrivacyModeActive();
  setPrivacyMode(!current);
  return !current;
}

// -------------------------------------------------------------
// THEME (Dark / Light)
// -------------------------------------------------------------

export type Theme = 'dark' | 'light';

export function getPreferredTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY) as Theme | null;
  if (saved === 'dark' || saved === 'light') return saved;
  // Default to dark for premium fintech aesthetic, or system
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}
