export type AppSettings = { workshop: boolean; advancedPainting: boolean; mouseSpeed: number };
const storageKey = 'studioodle.settings';
const defaults: AppSettings = { workshop: false, advancedPainting: false, mouseSpeed: 50 };
export function readSettings(): AppSettings {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (!saved || typeof saved !== 'object') return { ...defaults };
    return {
      workshop: 'workshop' in saved && saved.workshop === true,
      advancedPainting: 'advancedPainting' in saved && saved.advancedPainting === true,
      mouseSpeed: 'mouseSpeed' in saved && typeof saved.mouseSpeed === 'number' && Number.isFinite(saved.mouseSpeed)
        ? Math.max(10, Math.min(100, saved.mouseSpeed)) : defaults.mouseSpeed,
    };
  } catch { return { ...defaults }; }
}
export function saveSettings(settings: AppSettings) {
  try { localStorage.setItem(storageKey, JSON.stringify(settings)); }
  catch { /* The preference still applies for the current session. */ }
}
