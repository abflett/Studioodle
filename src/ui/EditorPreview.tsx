import { DialogHeader } from './DialogHeader';
import { ColoringPageWorkshop } from './ColoringPageWorkshop';
import type { SavedPicture } from '../editor/savedPicture';
import { PrecisionFillFeedback } from './PrecisionFillFeedback';
import { useToolCursorStyle } from './toolCursors';
import { useEditorSaving } from './useEditorSaving';
import { usePrecisionFill } from './usePrecisionFill';
import { useCanvasGestures } from './useCanvasGestures';
import { useEditorShortcuts } from './useEditorShortcuts';
import type { AppSettings } from './settings';
import { StickerSelectionToolbar } from './StickerSelectionToolbar';
import { StickerBrowser } from './StickerBrowser';
import { BrushPicker, FillPicker } from './ToolOptions';
import { defaultBrush, defaultFill } from '../editor/toolOptions';
import { ColorPicker } from './ColorPicker';
import { stickerCategories } from './stickerCatalog';
import { closeOnBackdrop } from './dialog';
import { paperSize } from '../editor/document';
import { usePaperView } from './usePaperView';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Undo2, House, Shapes, Palette, Brush, PaintBucket, X, Check, Eraser, MousePointer2, Move, ZoomIn, BookOpen } from 'lucide-react';
import { EditorCanvas } from './EditorCanvas';
import { createEditorBridge } from '../editor/bridge';
import type { EditorTool } from '../editor/bridge';
import type { EditorSetup } from '../editor/setup';
import { initialDrawingSettings } from '../editor/setup';
import { prepareStickers } from '../editor/vectorStickers';

type Picker = 'stickers' | 'colors' | 'brush' | 'fill';
export default function EditorPreview({ setup, onBack, settings }: { setup: EditorSetup; onBack: () => void; settings: AppSettings }) {
  const [workshopPicture, setWorkshopPicture] = useState<SavedPicture>();
  const [workshopTarget, setWorkshopTarget] = useState(setup.authoringPageId);
  const [workshopTitle, setWorkshopTitle] = useState(setup.title);
  const [bridge] = useState(createEditorBridge);
  const [color, setColor] = useState(() => initialDrawingSettings(setup).color);
  const [tool, setTool] = useState<EditorTool>(() => initialDrawingSettings(setup).tool);
  const cursorStyle = useToolCursorStyle(tool, color);
  const [focused, setFocused] = useState<string>();
  useEffect(() => bridge.onFocus(setFocused), [bridge]);
  const [selected, setSelected] = useState<string>();
  const selectionDrawer = useRef<HTMLDivElement>(null);
  const [useCurrentOutline, setUseCurrentOutline] = useState(false);
  const outlineColor = useCurrentOutline ? color : 0x242428;
  useEffect(() => bridge.onTool(setTool), [bridge]);
  const [selectionOrder, setSelectionOrder] = useState({ forward: false, backward: false });
  useEffect(() => bridge.onSelection((id, order) => {
    setSelected(id);
    setSelectionOrder(previous => previous.forward === order.forward && previous.backward === order.backward ? previous : order);
  }), [bridge]);
  const { saveStatus, dismissSaveStatus, save, saveAndLeave } = useEditorSaving(bridge, onBack);
  const [brushOptions, setBrushOptions] = useState(defaultBrush);
  const [fillOptions, setFillOptions] = useState(defaultFill);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [loadingSticker, setLoadingSticker] = useState(false);
  const [stickerError, setStickerError] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const category = stickerCategories.find((item) => item.id === categoryId);
  const pickerTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (picker) pickerTitle.current?.focus({ preventScroll: true }); }, [picker, categoryId]);
  const [requestedZoom, setZoom] = useState<number | null>(null);
  const { viewport, position, focus, captureView, restoreView, pointAt, zoomAt, transformView, fitPage, zoom, handlers } = usePaperView(paperSize(setup.format, setup.size), requestedZoom, tool === 'pan');
  const [focusZoom, setFocusZoom] = useState(1);
  const beforeFocus = useRef<{ zoom: number | null; view: ReturnType<typeof captureView> } | undefined>(undefined);
  const finishSelection = () => {
    if (focused) {
      bridge.send({ type: 'exit-focus' });
      const previous = beforeFocus.current;
      if (previous) { restoreView(previous.view); setZoom(previous.zoom); }
      beforeFocus.current = undefined;
    } else chooseTool('bucket');
  };
  const chooseTool = (value: EditorTool) => { setTool(value); bridge.send({ type: 'set-tool', tool: value }); };
  const toggleSelect = () => {
    if (tool === 'select') chooseTool('bucket');
    else chooseTool('select');
  };
  const precisionFill = usePrecisionFill({
    enabled: tool === 'bucket',
    fill: client => { const point = pointAt(client); if (point) bridge.send({ type: 'fill-at', point }); },
    magnify: client => {
      const previous = { view: captureView(), zoom: requestedZoom };
      const box = viewport.current!.getBoundingClientRect();
      const insetX = Math.min(120, box.width * .3), insetY = Math.min(120, box.height * .3);
      const target = {
        x: Math.max(box.left + insetX, Math.min(box.right - insetX, client.x)),
        y: Math.max(box.top + insetY, Math.min(box.bottom - insetY, client.y)),
      };
      setZoom(zoomAt(client, (focused ? focusZoom : 1) * 8, target));
      return { offset: { x: target.x - client.x, y: target.y - client.y },
        restore: () => { restoreView(previous.view); setZoom(previous.zoom); } };
    },
  });
  const cycleZoom = () => {
    const baseline = focused ? focusZoom : 1;
    const next = [1, 1.5, 2, 3, 4, 8].map(level => level * baseline).find(level => level > (requestedZoom ?? baseline) + .001) ?? baseline;
    setZoom(!focused && next === 1 ? null : next);
  };
  const touchGestures = { viewport, captureView, transformView, baseline: focused ? focusZoom : 1,
    setZoom: (value: number) => setZoom(value), cancelInput: () => bridge.send({ type: 'cancel-input' }) };
  useCanvasGestures(touchGestures);
  const selectBrush = () => { chooseTool('brush'); if (settings.advancedPainting) setPicker('brush'); else { setBrushOptions(defaultBrush); bridge.send({ type: 'set-brush', options: defaultBrush }); } };
  const selectFill = () => { chooseTool('bucket'); if (settings.advancedPainting) setPicker('fill'); else { setFillOptions(defaultFill); bridge.send({ type: 'set-fill', options: defaultFill }); } };
  const openStickers = () => { if (!focused) { setUseCurrentOutline(false); setCategoryId(null); setPicker('stickers'); } };
  const stepZoom = (factor: number) => {
    const view = captureView(), box = viewport.current?.getBoundingClientRect();
    if (!view || !box) return;
    const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    setZoom(transformView(view, center, center, factor, focused ? focusZoom : 1));
  };
  const focusSelection = () => {
    if (!selected) return;
    if (!focused) beforeFocus.current = { zoom: requestedZoom, view: captureView() };
    bridge.send({ type: 'focus-selection', onFocus: bounds => { const fitted = focus(bounds, (selectionDrawer.current?.getBoundingClientRect().height ?? 100) + 20); setFocusZoom(fitted); setZoom(fitted); } });
  };
  const resetZoom = () => { if (focused) focusSelection(); else { fitPage(); setZoom(null); } };
  useEditorShortcuts({
    b: selectBrush, g: selectFill, e: () => chooseTool('erase'), v: () => chooseTool('select'), h: () => chooseTool('pan'),
    s: openStickers, c: () => setPicker('colors'), z: cycleZoom, '+': () => stepZoom(1.25), '=': () => stepZoom(1.25), '-': () => stepZoom(.8), '0': resetZoom,
    'mod+z': () => bridge.send({ type: 'undo' }), backspace: () => bridge.send({ type: 'undo' }), 'mod+s': save,
    'mod+d': () => { if (selected && !focused) bridge.send({ type: 'duplicate-selection' }); },
    delete: () => { if (selected && !focused) bridge.send({ type: 'delete-selection' }); },
    f: focusSelection, enter: () => { if (focused || (selected && tool === 'select')) finishSelection(); },
  });
  const singleHandlers = tool === 'bucket' ? precisionFill.handlers : handlers;
  // Trusted touch is owned by the native gesture adapter; its synthetic events
  // re-enter these same handlers so painting and long-press fill stay consistent.
  const routeGesture = (handler: (event: ReactPointerEvent<HTMLElement>) => void) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch' && event.nativeEvent.isTrusted) return;
    handler(event);
  };
  const gestureHandlers = {
    onPointerDownCapture: routeGesture(singleHandlers.onPointerDownCapture),
    onPointerMoveCapture: routeGesture(singleHandlers.onPointerMoveCapture),
    onPointerUpCapture: routeGesture(singleHandlers.onPointerUpCapture),
    onPointerCancel: routeGesture(singleHandlers.onPointerCancel),
    onLostPointerCapture: routeGesture(singleHandlers.onLostPointerCapture),
  };
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (picker && !modal.open) modal.showModal();
    if (!picker && modal.open) modal.close();
    return () => { if (modal.open) modal.close(); };
  }, [picker]);
  return <main className="art-studio" aria-label={setup.title}>
    <div className="ribbon-shell">
    <header className="art-ribbon main-ribbon" aria-label="Art tools">
      <div className="ribbon-group" role="group" aria-label="Home">
        <button title="Home" aria-label="Save and go home" onClick={saveAndLeave}><House aria-hidden="true" /></button>
      </div>
      <div className="ribbon-group" role="group" aria-label="View and selection">
        <button title="Move the page (H)" aria-keyshortcuts="H" aria-label="Move the page" aria-pressed={tool === 'pan'} onClick={() => chooseTool('pan')}><Move aria-hidden="true" /></button>
        <button title="Zoom (Z; + / -; 0 to fit)" aria-label={`Zoom ${requestedZoom ?? 1} times fitted page, next zoom level`} onClick={cycleZoom}><ZoomIn aria-hidden="true" /></button>
        <button title="Select and move stickers (V)" aria-keyshortcuts="V" aria-label="Select and move stickers" aria-pressed={tool === 'select'} onClick={toggleSelect}><MousePointer2 aria-hidden="true" /></button>
      </div>
      <div className="ribbon-group" role="group" aria-label="Drawing tools">
        <button title="Erase (E)" aria-keyshortcuts="E" aria-label="Erase" aria-pressed={tool === 'erase'} onClick={() => chooseTool('erase')}><Eraser aria-hidden="true" /></button>
        <button title="Brush (B)" aria-keyshortcuts="B" aria-label="Brush" aria-pressed={tool === 'brush'} onClick={selectBrush} aria-haspopup={settings.advancedPainting ? 'dialog' : undefined}><Brush aria-hidden="true" /></button>
        <button title="Fill (G)" aria-keyshortcuts="G" aria-label="Fill" aria-pressed={tool === 'bucket'} onClick={selectFill} aria-haspopup={settings.advancedPainting ? 'dialog' : undefined}><PaintBucket aria-hidden="true" /></button>
        <button title={focused ? "Finish focus to add stickers" : "Stickers (S)"} aria-label="Stickers" disabled={!!focused} onClick={openStickers} aria-haspopup="dialog"><Shapes aria-hidden="true" /></button>
        <button title="Colors (C)" aria-keyshortcuts="C" aria-label="Colors" onClick={() => setPicker('colors')} aria-haspopup="dialog"><Palette aria-hidden="true" /><span className="ribbon-color-dot" aria-hidden="true" style={{ background: `#${color.toString(16).padStart(6, '0')}` }} /></button>
      </div>
      {settings.workshop && <div className="ribbon-group" role="group" aria-label="Coloring page workshop"><button title="Save coloring page" aria-label="Coloring page workshop" aria-haspopup="dialog" onClick={() => bridge.send({ type: 'snapshot', onComplete: picture => setWorkshopPicture({ ...picture, title: workshopTitle }) })}><BookOpen aria-hidden="true" /></button></div>}
      <div className="ribbon-group" role="group" aria-label="History">
        <button title="Undo (Ctrl/Cmd+Z or Backspace)" aria-keyshortcuts="Control+Z Meta+Z Backspace" aria-label="Undo" onClick={() => bridge.send({ type: 'undo' })}><Undo2 aria-hidden="true" /></button>
      </div>
    </header>
      {((tool === 'select' && selected) || focused) && <StickerSelectionToolbar bridge={bridge} focused={!!focused} order={selectionOrder} drawerRef={selectionDrawer} onFocus={focusSelection} onFinish={finishSelection} />}
    </div>
    <section className={`art-canvas ${tool === 'pan' ? 'pan-mode' : ''} ${focused ? 'focus-mode' : ''}`} ref={viewport} style={cursorStyle} aria-label="Drawing canvas" tabIndex={0} {...gestureHandlers} onPointerDown={(event) => {
      if (event.pointerType === 'touch' && event.nativeEvent.isTrusted) return;
      if (!focused && tool === 'select' && event.target === event.currentTarget) bridge.send({ type: 'clear-selection' });
    }}>
      <PrecisionFillFeedback aim={precisionFill.aim} magnified={precisionFill.magnified} releasedAim={precisionFill.releasedAim} />
      <div className="canvas-envelope" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
        <EditorCanvas focused={!!focused} bridge={bridge} setup={setup} zoom={zoom} offsetX={position.x} offsetY={position.y} />
      </div>
    </section>
    {saveStatus !== 'idle' && <div className="save-notice" role="status"><span>{saveStatus === 'saved' ? 'Saved to Your pictures' : 'Could not save. Device storage may be full or unavailable.'}</span><button className="icon-button" aria-label="Dismiss save message" onClick={dismissSaveStatus}><X /></button></div>}
    <dialog className={`setup-dialog art-dialog ${picker === 'stickers' ? 'sticker-dialog' : ''}`} ref={dialog} onCancel={() => setPicker(null)} onClick={(event) => closeOnBackdrop(event, () => setPicker(null))} onAuxClick={(event) => { if (event.button === 2) closeOnBackdrop(event, () => setPicker(null)); }} aria-labelledby="art-picker-title">
      <div className="wizard" aria-busy={loadingSticker}>
        {loadingSticker && <progress aria-label="Loading sticker" />}
        {stickerError && <button onClick={() => setStickerError(false)}>Could not load sticker. Tap to dismiss.</button>}
        <DialogHeader id="art-picker-title" headingRef={pickerTitle} title={picker === 'stickers' ? category?.title ?? 'Stickers' : picker === 'colors' ? 'Pick a color' : picker === 'brush' ? 'Brush' : 'Fill'} onClose={() => setPicker(null)} closeLabel="Close picker" back={picker === 'stickers' && category ? { label: 'Back to sticker categories', onClick: () => setCategoryId(null) } : undefined} />
        <div className="wizard-body">

          {picker === 'colors' && <ColorPicker color={color} onChoose={(value) => { setColor(value); bridge.send({ type: 'set-color', color: value }); setPicker(null); }} />}
          {picker === 'brush' && <BrushPicker value={brushOptions} onChange={(options) => { setBrushOptions(options); bridge.send({ type: 'set-brush', options }); }} />}
          {picker === 'fill' && <FillPicker value={fillOptions} color={color} onChange={(options) => { setFillOptions(options); bridge.send({ type: 'set-fill', options }); }} />}
          {picker === 'stickers' && <StickerBrowser key={categoryId ?? 'categories'} categoryId={categoryId} color={outlineColor} onCategory={setCategoryId} onAdd={(kind) => { if (loadingSticker) return; setLoadingSticker(true); void prepareStickers([kind]).then(() => { bridge.send({ type: 'add-sticker', sticker: kind, outlineColor, point: { x: ((viewport.current?.clientWidth ?? 0) / 2 - position.x) / zoom, y: ((viewport.current?.clientHeight ?? 0) / 2 - position.y) / zoom } }); setPicker(null); }).catch(() => setStickerError(true)).finally(() => setLoadingSticker(false)); }} />}
        </div>
        {picker === 'stickers' && <footer className="sticker-outline-options" role="group" aria-label="Sticker outline color">
          <button aria-pressed={!useCurrentOutline} onClick={() => setUseCurrentOutline(false)}><span style={{ background: '#242428' }} />Charcoal</button>
          <button aria-pressed={useCurrentOutline} onClick={() => setUseCurrentOutline(true)}><span style={{ background: `#${color.toString(16).padStart(6, '0')}` }} />Current color</button>
        </footer>}
        {(picker === 'brush' || picker === 'fill') && <footer className="tool-settings-footer"><button className="go-button" onClick={() => setPicker(null)}><Check /><span>Done</span></button></footer>}
      </div>
    </dialog>
    {settings.workshop && workshopPicture && <ColoringPageWorkshop picture={workshopPicture} targetId={workshopTarget} onClose={() => setWorkshopPicture(undefined)} onSaved={(id, title) => { setWorkshopTarget(id); setWorkshopTitle(title); }} />}
  </main>;
}
