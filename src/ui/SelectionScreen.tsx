import { ExportPictureDialog } from './ExportPictureDialog';
import { PaperSetup } from './PaperSetup';
import { DialogHeader } from './DialogHeader';
import { workshopPages, workshopRepository } from '../app/coloringBookWorkshop';
import { coloringPages } from '../app/coloringPages';
import { DeletePictureDialog } from './DeletePictureDialog';
import { isDesktop, toggleDesktopFullscreen, watchDesktopFullscreen } from '../platform/desktop';
import type { AppSettings } from './settings';
import { SelectionSettings } from './SelectionSettings';
import { ColorPicker } from './ColorPicker';
import { paperSize } from '../editor/document';
import { presetSize } from '../editor/paperPresets';
import type { PaperPresetId } from '../editor/paperPresets';
import { contrastingDrawingColor } from '../editor/palette';
import { closeOnBackdrop } from './dialog';
import { createColoringPage } from '../editor/coloringPage';
import { coloringPageRepository } from '../app/pictures';
import { usePictureLibrary } from './usePictureLibrary';
import type { SavedPicture } from '../editor/savedPicture';
import { printPicture } from '../app/pictureOutput';
import { SavedPreview } from './SavedPreview';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X, Trash2, Printer, Download, Undo2, Settings, LogOut, Fullscreen, Minimize, Save, Pencil, LoaderCircle, RotateCw } from 'lucide-react';
import { pictureChoices, savedStackArtwork, portfolioPaper } from '../app/startup';
import type { EditorSetup } from '../editor/setup';
import type { ThemePreference } from './theme';

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
    if (isDesktop) {
      let disposed = false;
      let stop: (() => void) | undefined;
      void watchDesktopFullscreen(value => { if (!disposed) setFullscreen(value); }).then(unlisten => { if (disposed) unlisten(); else stop = unlisten; }).catch(() => {});
      return () => { disposed = true; stop?.(); };
    }
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const [exportingPicture, setExportingPicture] = useState<SavedPicture>();
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
  const [pageTurn, setPageTurn] = useState<'next' | 'previous'>();
  const [background, setBackground] = useState('#f6f2e8');
  const { library, saved, sampleIndex, setSampleIndex, current, currentError, retry, removePicture, restorePicture } = usePictureLibrary();
  const [customPages, setCustomPages] = useState(() => {
    try { return coloringPageRepository.load(); } catch { return []; }
  });
  const [bookState, setBookState] = useState(() => { try { return { pages: workshopPages(), error: false }; } catch { return { pages: [], error: true }; } });
  const scenes: EditorSetup[] = bookState.error ? [...coloringPages, ...customPages] : bookState.pages;
  const refreshBooks = () => { try { setBookState({ pages: workshopPages(), error: false }); } catch { setBookState(previous => ({ ...previous, error: true })); } };
  const [notice, setNotice] = useState<string>();
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(undefined), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const [deletingPage, setDeletingPage] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedPicture>();
  const [toastPaused, setToastPaused] = useState(false);
  const [removed, setRemoved] = useState<SavedPicture>();
  const [actionError, setActionError] = useState<string>();
  useEffect(() => {
    if (!removed || toastPaused || actionError || pendingDelete) return;
    const timeout = window.setTimeout(() => setRemoved(undefined), 8000);
    return () => window.clearTimeout(timeout);
  }, [removed, toastPaused, actionError, pendingDelete]);
  const removeCurrent = async (picture: SavedPicture) => {
    setPendingDelete(undefined);
    try {
      if (deletingPage) {
        workshopRepository.delete(picture.id);
        coloringPageRepository.delete(picture.id);
        setCustomPages(pages => pages.filter(item => item.id !== picture.id));
        refreshBooks();
        setSceneIndex(index => Math.max(0, Math.min(index, scenes.length - 2)));
        setDeletingPage(false); setRemoved(undefined); setActionError(undefined); setNotice('Coloring page removed');
        return;
      }
      await removePicture(picture);
      setRemoved(picture); setToastPaused(false); setActionError(undefined);
    } catch { setActionError('Could not delete this picture.'); }
  };
  const undoRemove = async () => {
    if (!removed) return;
    try {
      await restorePicture(removed);
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

  const currentSummary = saved[sampleIndex];
  const previewSize = paperSize(currentSummary?.format ?? 'landscape', currentSummary?.size);
  const frontPaper = portfolioPaper(previewSize.width / previewSize.height);
  const browseSaved = (direction: 'next' | 'previous') => {
    setPageTurn(direction);
    setSampleIndex(index => (index + (direction === 'next' ? 1 : saved.length - 1)) % saved.length);
  };
  const scene = scenes[Math.min(sceneIndex, scenes.length - 1)]!;
  const customScene = !coloringPages.some(page => page.id === scene.id) ? scene as SavedPicture : undefined;
  const addColoringPage = () => {
    if (!current || current.document.surfaces.length < 2) return;
    try {
      const number = customPages.reduce((max, page) => Math.max(max, Number(/^Coloring page (\d+)$/i.exec(page.title)?.[1] ?? 0)), 0) + 1;
      const page = createColoringPage(current, `Coloring Page ${number}`);
      coloringPageRepository.save(page);
      setCustomPages(pages => [page, ...pages]);
      refreshBooks();
      setSceneIndex(Math.max(0, workshopPages().findIndex(p => p.id === page.id))); setStep('scene');
      setRemoved(undefined); setActionError(undefined); setNotice('Added to coloring pages');
    } catch { setActionError('Could not save coloring page. Device storage may be full or unavailable.'); }
  };
  const stepTitle = step === 'shape' ? 'Pick your paper' : step === 'paper' ? 'Pick a paper color' : 'Coloring Pages';
  const openPicture = (setup: EditorSetup) => {
    dialog.current?.close();
    // Templates are immutable starting points, each use gets a fresh saved-picture id.
    onOpen(step === 'scene' ? { ...setup, id: undefined } : setup);
  };

  return (
    <main className="selection-screen" aria-label="Choose a picture">
      <section className="selection">
        <nav className="selection-preferences studio-actions" aria-label="Studio controls">
          <button className="icon-button" title="Settings" aria-label="Settings" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}><Settings aria-hidden="true" /></button>
        {(isDesktop || document.fullscreenEnabled) && <button className="fullscreen-toggle icon-button" title={fullscreen ? 'Leave fullscreen' : 'Fullscreen'} aria-label={fullscreen ? 'Leave fullscreen' : 'Fullscreen'} onClick={() => {
          const action = isDesktop ? toggleDesktopFullscreen().then(setFullscreen) : document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
          void action.catch(() => setActionError('Fullscreen is unavailable in this window.'));
        }}>{fullscreen ? <Minimize aria-hidden="true" /> : <Fullscreen aria-hidden="true" />}</button>}
          <button className="icon-button" title="Exit Studioodle" aria-label="Exit Studioodle" onClick={onExit}><LogOut aria-hidden="true" /></button>
        </nav>
        <div className="choice-grid">
          {pictureChoices.map((item) => (
            <button className={`choice-card choice-${item.id}`} key={item.id}
              aria-label={item.id === 'blank' ? 'Draw a new picture' : 'Color a picture'}
              title={item.id === 'blank' ? 'Draw a new picture' : 'Color a picture'}
              onClick={() => { if (item.id === 'blank') { setManualOrientation(false); setOrientation(windowOrientation()); } setStep(item.id === 'blank' ? 'shape' : 'scene'); }} aria-haspopup="dialog">
              <span className="choice-art">
                <img className="choice-illustration" src={item.artwork} alt="" aria-hidden="true" draggable={false} decoding="async" />
              </span>
            </button>
          ))}
        </div>
        <section className="previous-section" aria-label="Previous pictures">

          <div className="picture-carousel">
            <button className="icon-button" aria-label="Previous saved picture" disabled={saved.length < 2} onClick={() => browseSaved('previous')}><Arrow direction="left" /></button>
            <div className="saved-picture-card" role="group" aria-labelledby="your-pictures-label">
              <button className="choice-card previous-picture" aria-label={currentSummary ? `Continue saved picture: ${currentSummary.title}` : 'Continue a saved picture (no saved pictures yet)'} title={currentSummary ? `Continue ${currentSummary.title}` : 'Your pictures'} disabled={!current} onClick={() => { if (current) onOpen(current); }}>
                <span className="choice-art portfolio-stage">
                  <img className="portfolio-stack-art" src={savedStackArtwork} alt="" aria-hidden="true" draggable={false} decoding="async" />
                  <span className="portfolio-pile" data-paper-shape={frontPaper.shape} style={{ width: `min(90%, calc(var(--object-height) * .88 * ${frontPaper.ratio}))`, aspectRatio: `${frontPaper.ratio}` }}>
                    <span className={`portfolio-page${pageTurn ? ` turn-${pageTurn}` : ''}`} key={currentSummary ? `${currentSummary.id}:${currentSummary.updatedAt}` : 'empty'} style={{ backgroundImage: `url("${frontPaper.artwork}")`, maskImage: `url("${frontPaper.artwork}")` }}>
                      <span className="portfolio-artwork">
                        {currentSummary ? <SavedPreview picture={current ?? currentSummary} pending={!current && !currentError} unavailable={currentError} /> : library.loading ? <LoaderCircle className="preview-spinner" aria-label="Loading saved pictures" /> : <span className="empty-pictures">{library.error ? 'Storage unavailable' : 'Your art goes here'}</span>}
                      </span>
                    </span>
                  </span>
                </span>
              </button>
              <nav className="library-actions" aria-label="Selected saved picture actions">
                {(library.error || currentError) && <button className="icon-button" aria-label="Retry loading saved pictures" title="Retry loading" onClick={retry}><RotateCw aria-hidden="true" /></button>}
                <button className="icon-button" disabled={!current} aria-label="Delete selected saved picture" title="Delete picture" onClick={() => { if (current) { setDeletingPage(false); setPendingDelete(current); } }}><Trash2 /></button>
                <button className="icon-button" disabled={!current || current.document.surfaces.length < 2} aria-label="Save selected picture as a coloring page" title={current && current.document.surfaces.length > 1 ? "Save as coloring page" : "Arrange stickers in a picture to make a coloring page"} onClick={addColoringPage}><Save aria-hidden="true" /></button>
                <button className="icon-button" disabled={!current} aria-label="Print selected saved picture" title="Print picture" onClick={() => { if (current) printPicture(current, () => setActionError('Could not open printing. Allow the print window and try again.')); }}><Printer /></button>
                <button className="icon-button" disabled={!current} aria-label="Export selected saved picture" title="Export picture" aria-haspopup="dialog" onClick={() => setExportingPicture(current)}><Download /></button>
              </nav>
              <h2 className="sr-only" id="your-pictures-label">Your pictures</h2>
            </div>
            <button className="icon-button" aria-label="Next saved picture" disabled={saved.length < 2} onClick={() => browseSaved('next')}><Arrow direction="right" /></button>
          </div>


          <p className="sr-only" role="status">{saved.length ? `Saved picture ${sampleIndex + 1} of ${saved.length}` : 'No saved pictures yet'}</p>
        </section>
      </section>

      <dialog className="setup-dialog" ref={dialog} aria-labelledby="setup-title" onCancel={() => setStep(null)} onClick={(event) => closeOnBackdrop(event, () => setStep(null))} onAuxClick={(event) => { if (event.button === 2) closeOnBackdrop(event, () => setStep(null)); }}>
        <div className="wizard">
          <DialogHeader id="setup-title" title={stepTitle} headingRef={stepHeading} onClose={() => setStep(null)} closeLabel="Close setup">
            {step !== 'scene' && <div className="wizard-steps" aria-label={`Step ${step === 'shape' ? 1 : 2} of 2`}><span className={step === 'shape' ? 'active' : ''} /><span className={step === 'paper' ? 'active' : ''} /></div>}
          </DialogHeader>
          <div className="wizard-body">
            {step === 'shape' && <PaperSetup paperPreset={paperPreset} orientation={orientation} onPreset={setPaperPreset} onOrientation={value => { setManualOrientation(true); setOrientation(value); }} />}
            {step === 'paper' && <ColorPicker label="Canvas background colors" color={parseInt(background.slice(1), 16)} onChoose={(value) => setBackground(`#${value.toString(16).padStart(6, '0')}`)} />}
            {step === 'scene' && <div className="scene-picker">
              <button className="icon-button" aria-label="Previous coloring page" onClick={() => setSceneIndex((value) => (value + scenes.length - 1) % scenes.length)}><Arrow direction="left" /></button>
              <figure><button type="button" className="scene-preview-button" aria-label={`Draw ${scene.title}`} onClick={() => openPicture(scene)}><SavedPreview picture={scene} /></button><figcaption aria-live="polite">{scene.title}</figcaption></figure>
              <button className="icon-button" aria-label="Next coloring page" onClick={() => setSceneIndex((value) => (value + 1) % scenes.length)}><Arrow direction="right" /></button>
            </div>}
          </div>
          <footer className="wizard-footer">
            {step === 'scene' && settings.workshop ? <button className="go-button secondary-action" onClick={() => { dialog.current?.close(); onOpen({ ...scene, id: undefined, authoringPageId: scene.id }); }}><Pencil /><span>Edit Page</span></button> : step === 'scene' && customScene ? <button className="icon-button" aria-label="Delete this custom coloring page" title="Delete coloring page" onClick={() => { setDeletingPage(true); setPendingDelete(customScene); }}><Trash2 /></button> : step === 'paper' ? <button className="icon-button" aria-label="Back to paper shape" onClick={() => setStep('shape')}><ArrowLeft aria-hidden="true" /></button> : <span />}
            <button className="go-button" onClick={() => {
              if (step === 'shape') setStep('paper');
              else openPicture(step === 'scene' ? scene : { title: 'Blank Page', format: paperPreset === 'square' ? 'square' : orientation, size: presetSize(paperPreset, orientation), background, leafColor: contrastingDrawingColor(background) });
            }}>{step === 'shape' ? 'Next' : 'Let’s draw'}<ArrowRight aria-hidden="true" /></button>
          </footer>
        </div>
      </dialog>
      {exportingPicture && <ExportPictureDialog picture={exportingPicture} onClose={() => setExportingPicture(undefined)} />}
      <DeletePictureDialog picture={pendingDelete} onCancel={() => { setPendingDelete(undefined); setDeletingPage(false); }} onConfirm={removeCurrent} />
      <SelectionSettings settings={settings} onSettingsChange={onSettingsChange} open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} onThemeChange={onThemeChange} />

      {bookState.error && <p className="workshop-storage-error" role="alert">Workshop pages could not be loaded. Saved revisions have not been changed.</p>}
      {(removed || actionError || notice) && <div className="save-notice library-notice" role="status" onPointerEnter={() => setToastPaused(true)} onPointerLeave={() => setToastPaused(false)} onFocusCapture={() => setToastPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setToastPaused(false); }}>
        <span>{actionError ?? notice ?? 'Picture removed'}</span>
        {removed && <button className="icon-button" aria-label="Undo delete" onClick={undoRemove}><Undo2 /></button>}
        <button className="icon-button" aria-label="Dismiss message" onClick={() => { setRemoved(undefined); setActionError(undefined); setNotice(undefined); }}><X /></button>
      </div>}
    </main>
  );
}
