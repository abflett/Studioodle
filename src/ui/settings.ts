export type AppSettings = { advancedPainting: boolean; mouseSpeed: number };
const storageKey = 'studioodle.settings';
const defaults: AppSettings = { advancedPainting: true, mouseSpeed: 100 };
export function readSettings(): AppSettings {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (!saved || typeof saved !== 'object') return { ...defaults };
    return {
      advancedPainting: 'advancedPainting' in saved && typeof saved.advancedPainting === 'boolean' ? saved.advancedPainting : defaults.advancedPainting,
      mouseSpeed: 'mouseSpeed' in saved && typeof saved.mouseSpeed === 'number' && Number.isFinite(saved.mouseSpeed)
        ? Math.max(10, Math.min(100, saved.mouseSpeed)) : defaults.mouseSpeed,
    };
  } catch { return { ...defaults }; }
}
export function saveSettings(settings: AppSettings) {
  try { localStorage.setItem(storageKey, JSON.stringify(settings)); }
  catch { /* The preference still applies for the current session. */ }
}
