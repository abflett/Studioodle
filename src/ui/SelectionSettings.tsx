import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Monitor, Sun, Moon, X, Keyboard, SlidersHorizontal, ChevronRight } from 'lucide-react';
import { closeOnBackdrop } from './dialog';
import { startAppMouse, stopAppMouse, useAppMouseStatus } from './appMouse';
import { isDesktop } from '../platform/desktop';
import type { AppSettings } from './settings';
import type { ThemePreference } from './theme';

export function SelectionSettings({ open, onClose, theme, onThemeChange, settings, onSettingsChange }: {
  open: boolean; onClose: () => void; theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  settings: AppSettings; onSettingsChange: (settings: AppSettings) => void;
}) {
  const [guidePage, setGuidePage] = useState(0);
  const shortcuts = [
    ['Mouse control', 'Space toggles; Escape releases'],
    ['Brush / Fill / Eraser', 'B / G / E'], ['Select / Pan', 'V / H'], ['Stickers / Colors', 'S / C'],
    ['Undo', 'Ctrl or Cmd + Z, or Backspace'], ['Save', 'Ctrl or Cmd + S'],
    ['Duplicate / Delete', 'Ctrl or Cmd + D / Delete'], ['Zoom / Fit', '+ and - / 0; Z cycles zoom'], ['Focus / Done', 'F / Enter'],
    ['Touch canvas', 'One finger draws; two fingers pan and pinch to zoom'], ['Trackpad canvas', 'Two fingers pan; pinch to zoom'],
  ];
  const dialog = useRef<HTMLDialogElement>(null);
  const advanced = useRef<HTMLDialogElement>(null);
  const guide = useRef<HTMLDialogElement>(null);
  const [section, setSection] = useState<'advanced' | 'shortcuts' | null>(null);
  const mouse = useAppMouseStatus();
  useEffect(() => {
    const entries = [[dialog.current, open && section === null], [advanced.current, open && section === 'advanced'], [guide.current, open && section === 'shortcuts']] as const;
    for (const [modal, visible] of entries) if (!visible) modal?.close();
    for (const [modal, visible] of entries) if (visible && !modal?.open) modal?.showModal();
    return () => { for (const [modal] of entries) modal?.close(); };
  }, [open, section]);
  const close = () => { setSection(null); onClose(); };
  const back = () => setSection(null);
  const applyDesktopSpeed = () => {
    if (!isDesktop) return;
    if (settings.mouseSpeed === 100) stopAppMouse();
    else if (mouse !== 'active') startAppMouse();
  };
  return <>
    <dialog className="setup-dialog settings-dialog main-settings-dialog" ref={dialog} aria-labelledby="settings-title" onCancel={close} onClick={e => closeOnBackdrop(e, close)}>
      <div className="wizard">
        <header className="wizard-header"><h2 id="settings-title">Settings</h2><button className="icon-button" aria-label="Close settings" onClick={close}><X aria-hidden="true" /></button></header>
        <div className="settings-options compact-settings">
          <section className="settings-well theme-setting" aria-labelledby="theme-setting-title">
            <h3 id="theme-setting-title">Color theme</h3>
            <div className="settings-theme-options" role="group" aria-label="Theme">
              {(['system', 'light', 'dark'] as const).map(value => <button key={value} className="format-button" aria-pressed={theme === value} onClick={() => onThemeChange(value)}>
                {value === 'system' ? <Monitor aria-hidden="true" /> : value === 'light' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}<span>{value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'}</span>
              </button>)}
            </div>
          </section>
          <section className="settings-well mouse-setting" aria-labelledby="mouse-speed-label">
            <label className="mouse-speed-label" htmlFor="mouse-speed"><span id="mouse-speed-label">Mouse speed</span><output htmlFor="mouse-speed">{settings.mouseSpeed}%</output></label>
            <input id="mouse-speed" type="range" min="10" max="100" step="5" value={settings.mouseSpeed} aria-describedby="mouse-speed-help" aria-valuetext={`${settings.mouseSpeed} percent of normal speed`} onChange={event => {
              const mouseSpeed = Number(event.target.value);
              onSettingsChange({ ...settings, mouseSpeed });
              if (isDesktop && mouseSpeed === 100) stopAppMouse();
            }} onPointerUp={applyDesktopSpeed} onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) applyDesktopSpeed(); }} />
            {!isDesktop && <button className="advanced-controls-setting mouse-speed-toggle" role="switch" aria-checked={mouse === 'active'} aria-label="Adjusted mouse speed" disabled={mouse === 'unsupported' || mouse === 'starting'} onClick={mouse === 'active' ? stopAppMouse : startAppMouse}>
              <span>{mouse === 'starting' ? 'Starting...' : 'Adjusted speed'}</span><span className="settings-switch" aria-hidden="true"><span /></span>
            </button>}
            <p id="mouse-speed-help" className="mouse-speed-caption">Space toggles adjusted speed</p>
            {['error', 'unsupported'].includes(mouse) && <p className="mouse-speed-status" role="status">{mouse === 'error' ? 'Could not start. Press Space to retry.' : 'Unavailable in this browser.'}</p>}
          </section>
          <nav className="settings-navigation" aria-label="More settings">
            <button className="shortcut-guide-button" aria-haspopup="dialog" onClick={() => setSection('advanced')}><SlidersHorizontal aria-hidden="true" /><span>Advanced Settings</span><ChevronRight aria-hidden="true" /></button>
            <button className="shortcut-guide-button" aria-haspopup="dialog" onClick={() => setSection('shortcuts')}><Keyboard aria-hidden="true" /><span>Shortcuts &amp; gestures</span><ChevronRight aria-hidden="true" /></button>
          </nav>
        </div>
      </div>
    </dialog>
    <dialog className="setup-dialog settings-dialog advanced-settings-dialog" ref={advanced} aria-labelledby="advanced-settings-title" onCancel={back} onClick={e => closeOnBackdrop(e, back)}>
      <div className="wizard">
        <header className="wizard-header"><button className="icon-button" aria-label="Back to settings" onClick={back}><ArrowLeft /></button><h2 id="advanced-settings-title">Advanced Settings</h2><button className="icon-button" aria-label="Close advanced settings" onClick={close}><X /></button></header>
        <div className="advanced-settings-options">
          <button className="advanced-controls-setting" role="switch" aria-checked={settings.advancedPainting} aria-labelledby="advanced-painting-label" onClick={() => onSettingsChange({ ...settings, advancedPainting: !settings.advancedPainting })}>
            <span className="settings-description"><span id="advanced-painting-label">Painting controls</span><small>Brush sizes, types, and fill patterns</small></span><span className="settings-switch" aria-hidden="true"><span /></span>
          </button>
          <button className="advanced-controls-setting" role="switch" aria-checked={settings.workshop} aria-labelledby="workshop-label" onClick={() => onSettingsChange({ ...settings, workshop: !settings.workshop })}>
            <span className="settings-description"><span id="workshop-label">Coloring page workshop</span><small>Page editing tools</small></span><span className="settings-switch" aria-hidden="true"><span /></span>
          </button>
        </div>
      </div>
    </dialog>
    <dialog className="setup-dialog settings-dialog shortcut-guide-dialog" ref={guide} aria-labelledby="shortcut-guide-title" onCancel={back} onClick={e => closeOnBackdrop(e, back)}>
      <div className="wizard">
        <header className="wizard-header"><button className="icon-button" aria-label="Back from shortcuts" onClick={back}><ArrowLeft /></button><h2 id="shortcut-guide-title">Shortcuts &amp; gestures</h2><button className="icon-button" aria-label="Close shortcut guide" onClick={close}><X /></button></header>
        <div className="shortcut-help"><dl>{shortcuts.slice(guidePage * 6, guidePage * 6 + 6).map(([title, detail]) => <div key={title}><dt>{title}</dt><dd>{detail}</dd></div>)}</dl></div>
        <nav className="shortcut-pages" aria-label="Shortcut pages"><button className="icon-button" aria-label="Previous shortcuts" disabled={guidePage === 0} onClick={() => setGuidePage(0)}><ArrowLeft /></button><span role="status">{guidePage + 1} / 2</span><button className="icon-button" aria-label="Next shortcuts" disabled={guidePage === 1} onClick={() => setGuidePage(1)}><ArrowRight /></button></nav>
      </div>
    </dialog>
  </>;
}
