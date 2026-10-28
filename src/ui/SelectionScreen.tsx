import { ColoringPagePicker } from './ColoringPagePicker';
import { Brand } from './Brand';
import { paperRotation } from '../app/paperLayers';
import { ExportPictureDialog } from './ExportPictureDialog';
import { BlankPageSetup } from './BlankPageSetup';
import { saveWorkshopPage, workshopPages, workshopRepository } from '../app/coloringBookWorkshop';
import { coloringPages } from '../app/coloringPages';
import { DeletePictureDialog } from './DeletePictureDialog';
import { isDesktop, toggleDesktopFullscreen, watchDesktopFullscreen } from '../platform/desktop';
import type { AppSettings } from './settings';
import { SelectionSettings } from './SelectionSettings';
import { paperSize } from '../editor/document';
import type { PaperPresetId } from '../editor/paperPresets';
import { createColoringPage } from '../editor/coloringPage';
import { coloringPageLayoutKey } from '../editor/coloringPageLayout';
import { ColoringPageActionIcon } from './ColoringPageActionIcon';
import { usePictureLibrary } from './usePictureLibrary';
import type { SavedPicture } from '../editor/savedPicture';
import { printPicture } from '../app/pictureOutput';
import { SavedPreview } from './SavedPreview';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, X, Undo2, Settings, LogOut, Fullscreen, Minimize, LoaderCircle, RotateCw } from 'lucide-react';
import printerArtwork from '../../art/source/interface/printer.svg';
import deleteArtwork from '../../art/source/interface/saved-delete.svg';
import exportArtwork from '../../art/source/interface/saved-export.svg';
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
  const [background, setBackground] = useState('#ffffff');
  const { library, saved, sampleIndex, setSampleIndex, current, currentError, retry, removePicture, restorePicture } = usePictureLibrary();
  const [customPages, setCustomPages] = useState(() => {
    try { return workshopRepository.load().pages; } catch { return []; }
  });
  const [bookState, setBookState] = useState(() => { try { return { pages: workshopPages(), error: false }; } catch { return { pages: [], error: true }; } });
  const scenes: EditorSetup[] = bookState.error ? [...coloringPages, ...customPages] : bookState.pages;
  const refreshBooks = () => { try { const pages = workshopPages(); setBookState({ pages, error: false }); setCustomPages(workshopRepository.load().pages); } catch { setBookState(previous => ({ ...previous, error: true })); } };
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
        setCustomPages(pages => pages.filter(item => item.id !== picture.id));
        refreshBooks();
        setInitialSceneId(undefined);
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
  const [initialSceneId, setInitialSceneId] = useState<string>();

  const currentSummary = saved[sampleIndex];
  const previewSize = paperSize(currentSummary?.format ?? 'landscape', currentSummary?.size);
  const previewRatio = previewSize.width / previewSize.height;
  const frontPaper = portfolioPaper(previewRatio);
  // Paper, mask and overlay keep their shared template ratio; the drawing covers that frame.
  const sheetRatio = frontPaper.ratio;
  const browseSaved = (direction: 'next' | 'previous') => {
    setPageTurn(direction);
    setSampleIndex(index => (index + (direction === 'next' ? 1 : saved.length - 1)) % saved.length);
  };
  const addedLayouts = useMemo(() => new Set(customPages.map(coloringPageLayoutKey)), [customPages]);
  const pageAdded = !!current && addedLayouts.has(coloringPageLayoutKey(current));
  const addColoringPage = () => {
    if (!current || current.document.surfaces.length < 2 || pageAdded) return;
    try {
      const number = customPages.reduce((max, page) => Math.max(max, Number(/^Coloring page (\d+)$/i.exec(page.title)?.[1] ?? 0)), 0) + 1;
      const page = createColoringPage(current, `Coloring Page ${number}`);
      saveWorkshopPage(page, page.id, page.title);
      setCustomPages(pages => [page, ...pages]);
      refreshBooks();
      setInitialSceneId(page.id); setStep('scene');
      setRemoved(undefined); setActionError(undefined); setNotice('Added to coloring pages');
    } catch { setActionError('Could not save coloring page. Device storage may be full or unavailable.'); }
  };
  const openPicture = (setup: EditorSetup) => {
    setStep(null);
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
              onClick={() => { if (item.id === 'blank') { setManualOrientation(false); setOrientation(windowOrientation()); } else setInitialSceneId(undefined); setStep(item.id === 'blank' ? 'shape' : 'scene'); }} aria-haspopup="dialog">
              <span className="choice-art">
                <img className="choice-illustration" src={item.artwork} alt="" aria-hidden="true" draggable={false} decoding="async" />
              </span>
            </button>
          ))}
        </div>
        <section className="previous-section" aria-label="Previous pictures">

          <div className="picture-carousel" data-paper-shape={frontPaper.shape}>
            <button className="icon-button" aria-label="Previous saved picture" disabled={saved.length < 2} onClick={() => browseSaved('previous')}><Arrow direction="left" /></button>
            <div className="saved-picture-card" role="group" aria-labelledby="your-pictures-label">
              <button className="choice-card previous-picture" aria-label={currentSummary ? `Continue saved picture: ${currentSummary.title}` : 'Continue a saved picture (no saved pictures yet)'} title={currentSummary ? `Continue ${currentSummary.title}` : 'Your pictures'} disabled={!current} onClick={() => { if (current) onOpen(current); }}>
                <span className="choice-art portfolio-stage">
                  <span className="portfolio-stack" aria-hidden="true">
                    <img className="portfolio-stack-art" src={savedStackArtwork} alt="" draggable={false} decoding="async" />
                    <span className="portfolio-stack-brand"><Brand decorative /></span>
                  </span>
                  {currentSummary ? <span className="portfolio-pile" data-paper-shape={frontPaper.shape} style={{ rotate: paperRotation(currentSummary?.id ?? 'empty'), width: `min(90%, calc(var(--object-height) * var(--sheet-fill, .88) * ${sheetRatio}))`, aspectRatio: `${sheetRatio}` }}>
                    <span className={`portfolio-page${pageTurn ? ` turn-${pageTurn}` : ''}`} key={currentSummary ? `${currentSummary.id}:${currentSummary.updatedAt}` : 'empty'}>
                      <span className="portfolio-paper-backing" aria-hidden="true" style={{ maskImage: `url("${frontPaper.backingMask}")`, backgroundColor: '#302b23' }} />
                      <span className="portfolio-artwork" style={frontPaper.artworkStyle}>
                        <SavedPreview picture={current ?? currentSummary} fillContainer pending={!current && !currentError} unavailable={currentError} />
                      </span>
                      <img className="portfolio-paper-overlay" src={frontPaper.artwork} alt="" aria-hidden="true" draggable={false} />
                    </span>
                  </span> : <span className="portfolio-stack-status">{library.loading ? <LoaderCircle className="preview-spinner" aria-label="Loading saved pictures" /> : <span className={library.error ? 'portfolio-stack-error' : 'sr-only'}>{library.error ? 'Storage unavailable' : 'Your art goes here'}</span>}</span>}
                </span>
              </button>
              <nav className="library-actions" aria-label="Selected saved picture actions" data-empty={saved.length === 0 || undefined}>
                {(library.error || currentError) && <button className="icon-button" aria-label="Retry loading saved pictures" title="Retry loading" onClick={retry}><RotateCw aria-hidden="true" /></button>}
                {saved.length > 0 && <>
                  <button className="icon-button library-art-action" disabled={!current} aria-label="Delete selected saved picture" title="Delete picture" onClick={() => { if (current) { setDeletingPage(false); setPendingDelete(current); } }}><img className="library-action-artwork" src={deleteArtwork} alt="" aria-hidden="true" draggable={false} /></button>
                  <button className="icon-button library-art-action coloring-page-add" data-added={pageAdded || undefined} disabled={!current || current.document.surfaces.length < 2 || pageAdded} aria-label={pageAdded ? "Added to coloring pages" : "Add selected picture to coloring pages"} title={pageAdded ? "Added to coloring pages" : current && current.document.surfaces.length > 1 ? "Add to coloring pages" : "Arrange stickers in a picture to make a coloring page"} onClick={addColoringPage}><ColoringPageActionIcon added={pageAdded} /></button>
                  <button className="icon-button library-art-action print-action-button" disabled={!current} aria-label="Print selected saved picture" title="Print picture" onClick={() => { if (current) printPicture(current, () => setActionError('Could not open printing. Allow the print window and try again.')); }}><img className="library-action-artwork print-action-artwork" src={printerArtwork} alt="" aria-hidden="true" draggable={false} /></button>
                  <button className="icon-button library-art-action" disabled={!current} aria-label="Export selected saved picture" title="Export picture" aria-haspopup="dialog" onClick={() => setExportingPicture(current)}><img className="library-action-artwork" src={exportArtwork} alt="" aria-hidden="true" draggable={false} /></button>
                </>}
              </nav>
              <h2 className="sr-only" id="your-pictures-label">Your pictures</h2>
            </div>
            <button className="icon-button" aria-label="Next saved picture" disabled={saved.length < 2} onClick={() => browseSaved('next')}><Arrow direction="right" /></button>
          </div>


          <p className="sr-only" role="status">{saved.length ? `Saved picture ${sampleIndex + 1} of ${saved.length}` : 'No saved pictures yet'}</p>
        </section>
      </section>

      {(step === 'shape' || step === 'paper') && <BlankPageSetup step={step} onStep={setStep} paperPreset={paperPreset} orientation={orientation} background={background} onPreset={setPaperPreset} onOrientation={value => { setManualOrientation(true); setOrientation(value); }} onBackground={setBackground} onClose={() => setStep(null)} onOpen={openPicture} />}
      {step === 'scene' && <ColoringPagePicker pages={scenes} initialPageId={initialSceneId} bundledIds={new Set(coloringPages.map(page => page.id))} onClose={() => setStep(null)} onOpen={openPicture} onAdded={() => refreshBooks()} onDelete={page => { setDeletingPage(true); setPendingDelete(page); }} />}
      {exportingPicture && <ExportPictureDialog picture={exportingPicture} onClose={() => setExportingPicture(undefined)} />}
      <DeletePictureDialog picture={pendingDelete} onCancel={() => { setPendingDelete(undefined); setDeletingPage(false); }} onConfirm={removeCurrent} />
      <SelectionSettings settings={settings} onSettingsChange={onSettingsChange} open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} onThemeChange={onThemeChange} />

      {bookState.error && <p className="workshop-storage-error" role="alert">Coloring pages could not be loaded. Saved pages have not been changed.</p>}
      {(removed || actionError || notice) && <div className="save-notice library-notice" role="status" onPointerEnter={() => setToastPaused(true)} onPointerLeave={() => setToastPaused(false)} onFocusCapture={() => setToastPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setToastPaused(false); }}>
        <span>{actionError ?? notice ?? 'Picture removed'}</span>
        {removed && <button className="icon-button" aria-label="Undo delete" onClick={undoRemove}><Undo2 /></button>}
        <button className="icon-button" aria-label="Dismiss message" onClick={() => { setRemoved(undefined); setActionError(undefined); setNotice(undefined); }}><X /></button>
      </div>}
    </main>
  );
}
