export type ThemePreference = 'system' | 'light' | 'dark';

const storageKey = 'studioodle.theme';

export function readTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Theme controls still work when storage is unavailable. */ }
  return 'system';
}

export function saveTheme(preference: ThemePreference) {
  try { localStorage.setItem(storageKey, preference); }
  catch { /* Keep the preference for this session through React state. */ }
}

export function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = dark ? '#101e2b' : '#f7dfae';
  });
}
