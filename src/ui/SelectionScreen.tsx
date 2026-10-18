import { DeletePictureDialog } from './DeletePictureDialog';
import type { AppSettings } from './settings';
import { SelectionSettings } from './SelectionSettings';
import { fullPageScene } from '../editor/fullPageScene';
import { ColorPicker } from './ColorPicker';
import { paperPresets, presetSize } from '../editor/paperPresets';
import type { PaperPresetId } from '../editor/paperPresets';
import { contrastingDrawingColor } from '../editor/palette';
import { closeOnBackdrop } from './dialog';
import { gardenScene } from '../editor/gardenScene';
import { countingScene } from '../editor/countingScene';
import { springScene } from '../editor/springScene';
import { beachScene } from '../editor/beachScene';
import { winterScene } from '../editor/winterScene';
import { deletePicture, loadPictures, savePicture } from '../editor/storage';
import type { SavedPicture } from '../editor/storage';
import { exportPicture, printPicture } from '../editor/pictureOutput';
import { SavedPreview } from './SavedPreview';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Monitor, Moon, Sun, X, Trash2, Printer, Download, Undo2, Settings, LogOut, Fullscreen, Minimize } from 'lucide-react';
import { pictureChoices } from '../app/startup';
import type { EditorSetup } from '../editor/setup';
import type { ThemePreference } from './theme';

// Ready-made scenes use the same hybrid definitions as the sticker picker.
const samples: EditorSetup[] = [
  winterScene,
  beachScene,
  springScene,
  countingScene,
  gardenScene,
].map(fullPageScene);

function PictureThumbnail({ picture }: { picture: EditorSetup }) {
  return <SavedPreview picture={picture} />;
}

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return direction === 'left' ? <ArrowLeft aria-hidden="true" /> : <ArrowRight aria-hidden="true" />;
}

type WizardStep = 'shape' | 'paper' | 'scene';
const windowOrientation = () => window.matchMedia('(min-aspect-ratio: 1/1)').matches ? 'landscape' as const : 'portrait' as const;

export function SelectionScreen({ onOpen, onExit, theme, onThemeChange, settings, onSettingsChange }: {
  onOpen: (setup: EditorSetup) => void;
  onExit: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [step, setStep] = useState<WizardStep | null>(null);
  const [paperPreset, setPaperPreset] = useState<PaperPresetId>('full');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(windowOrientation);
  const [manualOrientation, setManualOrientation] = useState(false);
  useEffect(() => {
    if (manualOrientation) return;
    const query = window.matchMedia('(min-aspect-ratio: 1/1)');
    const update = () => setOrientation(query.matches ? 'landscape' : 'portrait');
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [manualOrientation]);
  const [background, setBackground] = useState('#f6f2e8');
  const [sampleIndex, setSampleIndex] = useState(0);
  const [library, setLibrary] = useState(() => {
    try { return { pictures: loadPictures(), error: false }; }
    catch { return { pictures: [], error: true }; }
  });
  const saved = library.pictures;
  const [pendingDelete, setPendingDelete] = useState<SavedPicture>();
  const [toastPaused, setToastPaused] = useState(false);
  const [removed, setRemoved] = useState<SavedPicture>();
  const [actionError, setActionError] = useState<string>();
  useEffect(() => {
    if (!removed || toastPaused || actionError || pendingDelete) return;
    const timeout = window.setTimeout(() => setRemoved(undefined), 8000);
    return () => window.clearTimeout(timeout);
  }, [removed, toastPaused, actionError, pendingDelete]);
  const removeCurrent = (picture: SavedPicture) => {
    setPendingDelete(undefined);
    try {
      deletePicture(picture.id);
      setRemoved(picture); setToastPaused(false); setActionError(undefined);
      setLibrary({ pictures: saved.filter((item) => item.id !== picture.id), error: false });
      setSampleIndex(Math.max(0, Math.min(sampleIndex, saved.length - 2)));
    } catch { setActionError('Could not delete this picture.'); }
  };
  const undoRemove = () => {
    if (!removed) return;
    try {
      savePicture(removed);
      const pictures = loadPictures();
      setLibrary({ pictures, error: false });
      setSampleIndex(Math.max(0, pictures.findIndex((item) => item.id === removed.id)));
      setRemoved(undefined); setActionError(undefined);
    } catch { setActionError('Could not restore this picture.'); }
  };
  const [sceneIndex, setSceneIndex] = useState(0);

  const dialog = useRef<HTMLDialogElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const open = step !== null;

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (open && !modal.open) modal.showModal();
    if (!open && modal.open) modal.close();
    return () => { if (modal.open) modal.close(); };
  }, [open]);
  useEffect(() => { if (step) stepHeading.current?.focus({ preventScroll: true }); }, [step]);

  const current = saved[sampleIndex];
  const scene = samples[sceneIndex]!;
  const stepTitle = step === 'shape' ? 'Pick your paper' : step === 'paper' ? 'Pick a paper color' : 'Pick a picture';
  const openPicture = (setup: EditorSetup) => {
    dialog.current?.close();
    onOpen(setup);
  };

  return (
    <main className="selection-screen" aria-label="Choose a picture">
      <section className="selection">
        <div className="selection-preferences">
        <div className="theme-picker" role="group" aria-label="Color theme">
          {(['system', 'light', 'dark'] as const).map((value) => (
            <button key={value} aria-label={value === 'system' ? 'Follow system theme' : `${value} theme`} title={value === 'system' ? 'Follow system' : `${value === 'light' ? 'Light' : 'Dark'} theme`} aria-pressed={theme === value} onClick={() => onThemeChange(value)}>
              {value === 'system' ? <Monitor aria-hidden="true" /> : value === 'light' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
          ))}
        </div>
        {document.fullscreenEnabled && <button className="fullscreen-toggle icon-button" title={fullscreen ? 'Leave fullscreen' : 'Fullscreen'} aria-label={fullscreen ? 'Leave fullscreen' : 'Fullscreen'} onClick={() => {
          const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
          void action.catch(() => setActionError('Fullscreen is unavailable in this window.'));
        }}>{fullscreen ? <Minimize aria-hidden="true" /> : <Fullscreen aria-hidden="true" />}</button>}
        </div>
        <div className="choice-grid">
          {pictureChoices.filter((item) => item.id !== 'previous').map((item) => (
            <button className={`choice-card choice-${item.id}`} key={item.id}
              onClick={() => { if (item.id === 'blank') { setManualOrientation(false); setOrientation(windowOrientation()); } setStep(item.id === 'blank' ? 'shape' : 'scene'); }} aria-haspopup="dialog">
              <span className="choice-art"><img src={item.image} alt="" width="320" height="220" /></span>
              <span className="choice-label">{item.id === 'blank' ? 'Blank page' : 'Coloring page'}</span>
            </button>
          ))}
        </div>
        <section className="previous-section" aria-label="Previous pictures">

          <div className="picture-carousel">
            <button className="icon-button" aria-label="Previous saved picture" disabled={saved.length < 2} onClick={() => setSampleIndex((value) => (value + saved.length - 1) % saved.length)}><Arrow direction="left" /></button>
            <button className="choice-card previous-picture" aria-label={current ? `Open saved picture: ${current.title}` : 'No saved pictures yet'} disabled={!current} onClick={() => { if (current) onOpen(current); }}><span className="choice-art"><>{current ? <SavedPreview picture={current} /> : <span className="empty-pictures">{library.error ? 'Storage unavailable' : 'Your art goes here'}</span>}</></span><span className="choice-label">Your pictures</span></button>
            <button className="icon-button" aria-label="Next saved picture" disabled={saved.length < 2} onClick={() => setSampleIndex((value) => (value + 1) % saved.length)}><Arrow direction="right" /></button>
          </div>


          <p className="sr-only" role="status">{saved.length ? `Saved picture ${sampleIndex + 1} of ${saved.length}` : 'No saved pictures yet'}</p>
        </section>
      </section>

      <dialog className="setup-dialog" ref={dialog} aria-labelledby="setup-title" onCancel={() => setStep(null)} onClick={(event) => closeOnBackdrop(event, () => setStep(null))} onAuxClick={(event) => { if (event.button === 2) closeOnBackdrop(event, () => setStep(null)); }}>
        <div className="wizard">
          <header className="wizard-header">
            <div className="wizard-heading"><h2 id="setup-title" ref={stepHeading} tabIndex={-1}>{stepTitle}</h2>
              {step !== 'scene' && <div className="wizard-steps" aria-label={`Step ${step === 'shape' ? 1 : 2} of 2`}><span className={step === 'shape' ? 'active' : ''} /><span className={step === 'paper' ? 'active' : ''} /></div>}
            </div>
            <button className="icon-button" aria-label="Close setup" onClick={() => setStep(null)}><X aria-hidden="true" /></button>
          </header>
          <div className="wizard-body">
            {step === 'shape' && <div className="paper-setup">
              <div className="format-options" role="group" aria-label="Paper size">
                {paperPresets.map(preset => <button key={preset.id} aria-label={`${preset.title}, ${preset.detail}`} aria-pressed={paperPreset === preset.id} onClick={() => setPaperPreset(preset.id)} className="format-button"><span className={`paper-shape paper-${preset.id === 'square' ? 'square' : orientation} preset-${preset.id}`} /><span className="shape-label">{preset.title}<small>{preset.detail}</small></span></button>)}
              </div>
              <div className="paper-orientation" role="group" aria-label="Paper orientation">
                {(['portrait', 'landscape'] as const).map(value => <button key={value} className="format-button" disabled={paperPreset === 'square'} aria-pressed={paperPreset !== 'square' && orientation === value} onClick={() => { setManualOrientation(true); setOrientation(value); }}><span className={`orientation-icon paper-${value}`} />{value === 'portrait' ? 'Tall' : 'Wide'}</button>)}
              </div>
            </div>}
            {step === 'paper' && <ColorPicker label="Canvas background colors" color={parseInt(background.slice(1), 16)} onChoose={(value) => setBackground(`#${value.toString(16).padStart(6, '0')}`)} />}
            {step === 'scene' && <div className="scene-picker">
              <button className="icon-button" aria-label="Previous coloring page" onClick={() => setSceneIndex((value) => (value + samples.length - 1) % samples.length)}><Arrow direction="left" /></button>
              <figure><PictureThumbnail picture={scene} /><figcaption aria-live="polite">{scene.title}</figcaption></figure>
              <button className="icon-button" aria-label="Next coloring page" onClick={() => setSceneIndex((value) => (value + 1) % samples.length)}><Arrow direction="right" /></button>
            </div>}
          </div>
          <footer className="wizard-footer">
            {step === 'paper' ? <button className="icon-button" aria-label="Back to paper shape" onClick={() => setStep('shape')}><ArrowLeft aria-hidden="true" /></button> : <span />}
            <button className="go-button" onClick={() => {
              if (step === 'shape') setStep('paper');
              else openPicture(step === 'scene' ? scene : { title: 'Blank page', format: paperPreset === 'square' ? 'square' : orientation, size: presetSize(paperPreset, orientation), background, leafColor: contrastingDrawingColor(background) });
            }}>{step === 'shape' ? 'Next' : 'Let’s draw'}<ArrowRight aria-hidden="true" /></button>
          </footer>
        </div>
      </dialog>
      <DeletePictureDialog picture={pendingDelete} onCancel={() => setPendingDelete(undefined)} onConfirm={removeCurrent} />
      <SelectionSettings settings={settings} onSettingsChange={onSettingsChange} open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} onThemeChange={onThemeChange} />
      <footer className="selection-footer">
      <nav className="library-actions" aria-label="Selected saved picture actions">
        <button className="icon-button" disabled={!current} aria-label="Delete selected saved picture" title="Delete picture" onClick={() => { if (current) setPendingDelete(current); }}><Trash2 /></button>
        <button className="icon-button" disabled={!current} aria-label="Print selected saved picture" title="Print picture" onClick={() => { if (current) printPicture(current, () => setActionError('Could not open printing. Allow the print window and try again.')); }}><Printer /></button>
        <button className="icon-button" disabled={!current} aria-label="Export selected saved picture as PNG" title="Export PNG" onClick={() => { if (current) void exportPicture(current).catch(() => setActionError('Could not export this picture.')); }}><Download /></button>
      </nav>
      <nav className="studio-actions" aria-label="Studio controls">

        <button className="icon-button" title="Settings" aria-label="Settings" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}><Settings aria-hidden="true" /></button>
      <button className="icon-button exit-control" title="Exit Studioodle" aria-label="Exit Studioodle" onClick={onExit}><LogOut aria-hidden="true" /></button>
      </nav>
      </footer>
      {(removed || actionError) && <div className="save-notice library-notice" role="status" onPointerEnter={() => setToastPaused(true)} onPointerLeave={() => setToastPaused(false)} onFocusCapture={() => setToastPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setToastPaused(false); }}>
        <span>{actionError ?? 'Picture removed'}</span>
        {removed && <button className="icon-button" aria-label="Undo delete" onClick={undoRemove}><Undo2 /></button>}
        <button className="icon-button" aria-label="Dismiss message" onClick={() => { setRemoved(undefined); setActionError(undefined); }}><X /></button>
      </div>}
    </main>
  );
}








