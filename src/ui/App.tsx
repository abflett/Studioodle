import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { prepareStudio } from '../app/startup';
import type { EditorModule } from '../app/startup';
import type { EditorSetup } from '../editor/setup';
import { Brand } from './Brand';
import { SelectionScreen } from './SelectionScreen';
import { applyTheme, readTheme, saveTheme } from './theme';
import type { ThemePreference } from './theme';

type StartupState =
  | { phase: 'loading'; completed: number; total: number }
  | { phase: 'ready'; module: EditorModule }
  | { phase: 'error' };

export function App() {
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

  if (choice) {
    const Editor = startup.module.default;
    return <Editor setup={choice} onBack={() => setChoice(null)} />;
  }

  return <SelectionScreen onOpen={(setup) => setChoice({ ...setup, id: setup.id ?? crypto.randomUUID() })} theme={theme} onThemeChange={changeTheme} />;
}
