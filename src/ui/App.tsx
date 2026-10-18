import { useEffect, useState } from 'react';
import { prepareStickers } from '../editor/vectorStickers';
import { RotateCcw, Play } from 'lucide-react';
import { prepareStudio } from '../app/startup';
import type { EditorModule } from '../app/startup';
import type { EditorSetup } from '../editor/setup';
import { Brand } from './Brand';
import { SelectionScreen } from './SelectionScreen';
import { readSettings, saveSettings } from './settings';
import { suspendAppMouse, useAppMouse } from './appMouse';
import { closeDesktop, isDesktop } from '../platform/desktop';
import type { AppSettings } from './settings';
import { applyTheme, readTheme, saveTheme } from './theme';
import type { ThemePreference } from './theme';

type StartupState =
  | { phase: 'loading'; completed: number; total: number }
  | { phase: 'ready'; module: EditorModule }
  | { phase: 'error' };

export function App() {
  const [settings, setSettings] = useState(readSettings);
  useAppMouse(settings.mouseSpeed);
  const changeSettings = (next: AppSettings) => { saveSettings(next); setSettings(next); };
  const [exited, setExited] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(false);
  const [startup, setStartup] = useState<StartupState>({ phase: 'loading', completed: 0, total: 4 });
  const [attempt, setAttempt] = useState(0);
  const [choice, setChoice] = useState<EditorSetup | null>(null);
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const system = matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(theme);
    update();
    system.addEventListener('change', update);
    return () => system.removeEventListener('change', update);
  }, [theme]);

  const changeTheme = (preference: ThemePreference) => {
    applyTheme(preference);
    saveTheme(preference);
    setTheme(preference);
  };

  useEffect(() => {
    let active = true;
    const startedAt = performance.now();
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      void prepareStudio((completed, total) => {
        if (active) setStartup({ phase: 'loading', completed, total });
      }).then((module) => {
        if (!active) return;
        readyTimer = setTimeout(() => {
          if (active) setStartup({ phase: 'ready', module });
        }, Math.max(0, 2000 - (performance.now() - startedAt)));
      }).catch(() => {
        if (active) {
          setStartup({ phase: 'error' });
          active = false; // Other tasks must not overwrite the failure with progress.
        }
      });
    });
    return () => { active = false; cancelAnimationFrame(frame); clearTimeout(readyTimer); };
  }, [attempt]);

  if (startup.phase !== 'ready') {
    const failed = startup.phase === 'error';
    return (
      <main className="splash" aria-label="Studioodle">
        <Brand />
        <span className="sr-only" role="status">{failed ? 'Unable to load. Check your connection and try again.' : 'Getting your studio ready.'}</span>
        {!failed && <progress aria-label="Preparing Studioodle" max={startup.total} value={startup.completed} />}
        {failed && <button className="icon-button" aria-label="Try loading again" onClick={() => {
          setStartup({ phase: 'loading', completed: 0, total: 4 });
          setAttempt((value) => value + 1);
        }}><RotateCcw aria-hidden="true" /></button>}
      </main>
    );
  }

  const exitStudio = () => {
    suspendAppMouse();
    if (isDesktop) { void closeDesktop().catch(() => setExited(true)); return; }
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setExited(true);
    if (window.opener) window.close();
  };
  if (exited) return <main className="splash exit-screen" aria-label="Studioodle closed">
    <Brand />
    <p>You can close this tab now.</p>
    <button className="go-button" onClick={() => setExited(false)}><Play aria-hidden="true" /><span>Back to Studioodle</span></button>
  </main>;

  if (choice) {
    const Editor = startup.module.default;
    return <Editor settings={settings} setup={choice} onBack={() => setChoice(null)} />;
  }

  return <><SelectionScreen settings={settings} onSettingsChange={changeSettings} onExit={exitStudio} onOpen={(setup) => {
    if (opening) return;
    setOpening(true); setOpenError(false);
    void prepareStickers(setup.document?.surfaces.map(surface => surface.kind) ?? []).then(() => {
      setChoice({ ...setup, id: setup.id ?? crypto.randomUUID() });
    }).catch(() => setOpenError(true)).finally(() => setOpening(false));
  }} theme={theme} onThemeChange={changeTheme} />
  {opening && <div className="asset-loading"><progress aria-label="Loading picture" /></div>}
  {openError && <button className="save-notice" onClick={() => setOpenError(false)}>Could not load this picture. Tap to dismiss.</button>}</>;
}
