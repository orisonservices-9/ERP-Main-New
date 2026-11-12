// Dark mode for the admin web. Pages use fixed light colours, so dark mode inverts
// brightness while keeping hues (CSS invert + hue-rotate); photos are flipped back.
const KEY = 'orison_theme'; // 'system' | 'light' | 'dark'
export const getTheme = () => { try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; } };
const media = () => (window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);
export const isDark = (choice = getTheme()) => choice === 'dark' || (choice === 'system' && !!media()?.matches);
export const applyTheme = () => {
  const dark = isDark();
  document.documentElement.classList.toggle('orison-dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
};
export const setTheme = (choice) => {
  try { localStorage.setItem(KEY, choice); } catch { /* ignore */ }
  applyTheme();
  window.dispatchEvent(new Event('orison-theme'));
};
export const initTheme = () => {
  applyTheme();
  media()?.addEventListener?.('change', applyTheme);
};
