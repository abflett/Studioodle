import { ColoringBookLibrary } from './ColoringBookLibrary';
import { useEffect, useRef, useState } from 'react';
import { Monitor, Sun, Moon, X, Keyboard } from 'lucide-react';
import { closeOnBackdrop } from './dialog';
import { startAppMouse, stopAppMouse, useAppMouseStatus } from './appMouse';
import type { AppSettings } from './settings';
import type { ThemePreference } from './theme';

export function SelectionSettings({ open, onClose, theme, onThemeChange, settings, onSettingsChange, onBooksChange }: {
  open: boolean; onClose: () => void; theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onBooksChange: () => void;
  settings: AppSettings; onSettingsChange: (settings: AppSettings) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [booksOpen, setBooksOpen] = useState(false);
  const mouse = useAppMouseStatus();
  const [guideOpen, setGuideOpen] = useState(false);
  const guide = useRef<HTMLDialogElement>(null);
  const closeGuide = () => setGuideOpen(false);
  useEffect(() => {
    const modal = guide.current;
    if (open && guideOpen && !modal?.open) modal?.showModal();
    if (!open || !guideOpen) modal?.close();
    return () => modal?.close();
  }, [open, guideOpen]);
  useEffect(() => {
    const modal = dialog.current;
    if (open && !modal?.open) modal?.showModal();
    if (!open) modal?.close();
    return () => modal?.close();
  }, [open]);
  return <><dialog className="setup-dialog settings-dialog" ref={dialog} aria-labelledby="settings-title" onCancel={onClose} onClick={event => closeOnBackdrop(event, onClose)} onAuxClick={event => { if (event.button === 2) closeOnBackdrop(event, onClose); }}>
    <div className="wizard">
      <header className="wizard-header"><h2 id="settings-title">Settings</h2><button className="icon-button" aria-label="Close settings" onClick={onClose}><X aria-hidden="true" /></button></header>
      <div className="settings-options">
        <div className="settings-theme-options" role="group" aria-label="Theme">
          {(['system', 'light', 'dark'] as const).map(value => <button key={value} className="format-button" aria-pressed={theme === value} onClick={() => onThemeChange(value)}>
            {value === 'system' ? <Monitor aria-hidden="true" /> : value === 'light' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}<span>{value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'}</span>
          </button>)}
        </div>
        <section className="mouse-setting" aria-labelledby="mouse-speed-label">
          <label className="mouse-speed-label" htmlFor="mouse-speed"><span id="mouse-speed-label">Mouse speed</span><output htmlFor="mouse-speed">{settings.mouseSpeed}%</output></label>
          <input id="mouse-speed" type="range" min="10" max="100" step="5" value={settings.mouseSpeed} aria-describedby="mouse-speed-help" aria-valuetext={`${settings.mouseSpeed} percent of normal speed`} onChange={event => onSettingsChange({ ...settings, mouseSpeed: Number(event.target.value) })} />
          <div className="mouse-speed-scale" aria-hidden="true"><span>Slower</span><span>Normal</span></div>
          <p id="mouse-speed-help">Use a slower mouse throughout the app. Space toggles mouse control. Escape returns to your normal mouse.</p>
          <button className="mouse-speed-action" disabled={mouse === 'unsupported' || mouse === 'starting'} onClick={mouse === 'active' ? stopAppMouse : startAppMouse}>{mouse === 'active' ? 'Use normal mouse' : mouse === 'starting' ? 'Starting...' : 'Use adjusted speed'}</button>
          <span className="mouse-speed-status" role="status">{mouse === 'active' ? 'Adjusted mouse is on.' : mouse === 'ready' ? 'Your saved mouse speed resumes on the first mouse click.' : mouse === 'error' ? 'Could not start mouse control. Click the button to try again.' : mouse === 'unsupported' ? 'Mouse speed control is not available in this browser.' : 'Your regular mouse stays unchanged until you start.'}</span>
        </section>
        <button className="advanced-controls-setting" role="switch" aria-checked={settings.advancedPainting} aria-labelledby="advanced-painting-label" aria-describedby="advanced-painting-description" onClick={() => onSettingsChange({ ...settings, advancedPainting: !settings.advancedPainting })}>
          <span className="settings-description"><span id="advanced-painting-label">Advanced painting controls</span><small id="advanced-painting-description">Brush sizes, brush types, and fill patterns</small></span>
          <span className="settings-switch" aria-hidden="true"><span /></span>
        </button>
        <button className="advanced-controls-setting" role="switch" aria-checked={settings.workshop} aria-labelledby="workshop-label" onClick={() => onSettingsChange({ ...settings, workshop: !settings.workshop })}>
          <span className="settings-description"><span id="workshop-label">Coloring page workshop</span><small>Temporary editing tools for creating and revising book pages</small></span><span className="settings-switch" aria-hidden="true"><span /></span>
        </button>
        {settings.workshop && <button className="shortcut-guide-button" aria-haspopup="dialog" onClick={() => setBooksOpen(true)}>Coloring Books</button>}
        <button className="shortcut-guide-button" aria-haspopup="dialog" onClick={() => setGuideOpen(true)}><Keyboard aria-hidden="true" /><span>Shortcuts &amp; gestures</span></button>
      </div>
    </div>
  </dialog>
  <dialog className="setup-dialog settings-dialog shortcut-guide-dialog" ref={guide} aria-labelledby="shortcut-guide-title" onCancel={closeGuide} onClick={event => closeOnBackdrop(event, closeGuide)} onAuxClick={event => { if (event.button === 2) closeOnBackdrop(event, closeGuide); }}>
    <div className="wizard">
      <header className="wizard-header"><h2 id="shortcut-guide-title">Shortcuts &amp; gestures</h2><button className="icon-button" aria-label="Close shortcut guide" onClick={closeGuide}><X aria-hidden="true" /></button></header>
      <div className="shortcut-help">
          <dl>
            <div><dt>Mouse control</dt><dd>Space toggles; Escape releases</dd></div>
            <div><dt>Brush / Fill / Eraser</dt><dd>B / G / E</dd></div>
            <div><dt>Select / Pan</dt><dd>V / H</dd></div>
            <div><dt>Stickers / Colors</dt><dd>S / C</dd></div>
            <div><dt>Undo</dt><dd>Ctrl or Cmd + Z, or Backspace</dd></div>
            <div><dt>Save</dt><dd>Ctrl or Cmd + S</dd></div>
            <div><dt>Duplicate / Delete</dt><dd>Ctrl or Cmd + D / Delete</dd></div>
            <div><dt>Zoom / Fit</dt><dd>+ and - / 0; Z cycles zoom</dd></div>
            <div><dt>Focus / Done</dt><dd>F / Enter</dd></div>
            <div><dt>Touch canvas</dt><dd>One finger draws; two fingers pan and pinch to zoom</dd></div>
            <div><dt>Trackpad canvas</dt><dd>Two fingers pan; pinch to zoom</dd></div>
          </dl>
      </div>
    </div>
  </dialog><ColoringBookLibrary open={open && booksOpen && settings.workshop} onClose={() => setBooksOpen(false)} onChange={onBooksChange} /></>;
}
