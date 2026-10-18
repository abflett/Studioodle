import { PrecisionFillFeedback } from './PrecisionFillFeedback';
import { useToolCursorStyle } from './toolCursors';
import { guardDesktopClose, isDesktop } from '../platform/desktop';
import { usePrecisionFill } from './usePrecisionFill';
import { useCanvasGestures } from './useCanvasGestures';
import { useEditorShortcuts } from './useEditorShortcuts';
import type { AppSettings } from './settings';
import { LayerOrderIcon } from './LayerOrderIcon';
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
import { ArrowLeft, Undo2, House, Shapes, Palette, Brush, PaintBucket, X, Check, Eraser, ScanSearch, MousePointer2, Move, ZoomIn, Maximize2, RotateCw, RotateCcw, Minimize2, FlipHorizontal2, FlipVertical2, Copy, Trash2 } from 'lucide-react';
import { PhaserGame } from '../PhaserGame';
import { createEditorBridge } from '../editor/bridge';
import type { EditorTool } from '../editor/bridge';
import type { EditorSetup } from '../editor/setup';
import { initialDrawingSettings } from '../editor/setup';
import { prepareStickers } from '../editor/vectorStickers';

type Picker = 'stickers' | 'colors' | 'brush' | 'fill';
export default function EditorPreview({ setup, onBack, settings }: { setup: EditorSetup; onBack: () => void; settings: AppSettings }) {
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  useEffect(() => {
    if (!isDesktop) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void guardDesktopClose(close => bridge.send({ type: 'save', onComplete: saved => { if (saved) close(); else setSaveStatus('error'); } })).then(unlisten => { if (disposed) unlisten(); else stop = unlisten; }).catch(() => setSaveStatus('error'));
    return () => { disposed = true; stop?.(); };
  }, [bridge]);
  useEffect(() => {
    const timer = window.setInterval(() => bridge.send({ type: 'save', onComplete: (saved) => setSaveStatus(saved ? 'idle' : 'error') }), 60_000);
    return () => window.clearInterval(timer);
  }, [bridge]);
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
      setZoom(zoomAt(client, (focused ? focusZoom : 1) * 8));
      return () => { restoreView(previous.view); setZoom(previous.zoom); };
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
  const save = () => bridge.send({ type: 'save', onComplete: saved => setSaveStatus(saved ? 'saved' : 'error') });
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
        <button title="Home" aria-label="Save and go home" onClick={() => bridge.send({ type: 'save', onComplete: (saved) => { if (saved) onBack(); else setSaveStatus('error'); } })}><House aria-hidden="true" /></button>
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
      <div className="ribbon-group" role="group" aria-label="History">
        <button title="Undo (Ctrl/Cmd+Z or Backspace)" aria-keyshortcuts="Control+Z Meta+Z Backspace" aria-label="Undo" onClick={() => bridge.send({ type: 'undo' })}><Undo2 aria-hidden="true" /></button>
      </div>
    </header>
      {((tool === 'select' && selected) || focused) && <div ref={selectionDrawer} className="art-ribbon sticker-ribbon" role="toolbar" aria-label="Selected sticker" onPointerDown={(event) => event.stopPropagation()}>
        <div className="sticker-adjustment" role="group" aria-label="Sticker size"><div>
          <button title="Shrink sticker by 10 percentage points" aria-label="Shrink sticker by 10 percentage points" onClick={() => bridge.send({ type: 'transform-selection', scaleDelta: -.1, rotationDelta: 0 })}><Minimize2 aria-hidden="true" /></button>
          <button title="Grow sticker by 10 percentage points" aria-label="Grow sticker by 10 percentage points" onClick={() => bridge.send({ type: 'transform-selection', scaleDelta: .1, rotationDelta: 0 })}><Maximize2 aria-hidden="true" /></button>
        </div></div>
        <div className="sticker-adjustment" role="group" aria-label="Sticker rotation"><div>
          <button title="Rotate sticker left 15 degrees" aria-label="Rotate sticker left 15 degrees" onClick={() => bridge.send({ type: 'transform-selection', scaleDelta: 0, rotationDelta: -15 })}><RotateCcw aria-hidden="true" /></button>
          <button title="Rotate sticker right 15 degrees" aria-label="Rotate sticker right 15 degrees" onClick={() => bridge.send({ type: 'transform-selection', scaleDelta: 0, rotationDelta: 15 })}><RotateCw aria-hidden="true" /></button>
        </div></div>
        <div className="sticker-adjustment" role="group" aria-label="Flip sticker"><div>
          <button title="Flip horizontally" aria-label="Flip sticker horizontally" onClick={() => bridge.send({ type: 'flip-selection', axis: 'horizontal' })}><FlipVertical2 aria-hidden="true" /></button>
          <button title="Flip vertically" aria-label="Flip sticker vertically" onClick={() => bridge.send({ type: 'flip-selection', axis: 'vertical' })}><FlipHorizontal2 aria-hidden="true" /></button>
        </div></div>
        <div className="sticker-adjustment" role="group" aria-label="Sticker layer order"><div>
          <button title="Move behind the next overlapping sticker" disabled={!!focused || !selectionOrder.backward} aria-label="Move behind the next overlapping sticker" onClick={() => bridge.send({ type: 'order-selection', direction: 'backward' })}><LayerOrderIcon direction="backward" /></button>
          <button title="Move in front of the next overlapping sticker" disabled={!!focused || !selectionOrder.forward} aria-label="Move in front of the next overlapping sticker" onClick={() => bridge.send({ type: 'order-selection', direction: 'forward' })}><LayerOrderIcon direction="forward" /></button>
        </div></div>
        <button title={focused ? 'Refit focused sticker' : 'Focus on this sticker (F)'} aria-label={focused ? 'Refit focused sticker' : 'Focus on this sticker (F)'} aria-pressed={!!focused} onClick={focusSelection}><ScanSearch aria-hidden="true" /></button>
        <button title="Duplicate (Ctrl/Cmd+D)" aria-keyshortcuts="Control+D Meta+D" aria-label="Duplicate" disabled={!!focused} onClick={() => bridge.send({ type: 'duplicate-selection' })}><Copy aria-hidden="true" /></button>
        <button title="Delete (Del)" aria-keyshortcuts="Delete" aria-label="Delete" disabled={!!focused} onClick={() => bridge.send({ type: 'delete-selection' })}><Trash2 aria-hidden="true" /></button>
        <button title={focused ? "Exit focus" : "Done"} onClick={finishSelection} aria-label="Finish selecting"><Check aria-hidden="true" /></button>
      </div>}
    </div>
    <section className={`art-canvas ${tool === 'pan' ? 'pan-mode' : ''} ${focused ? 'focus-mode' : ''}`} ref={viewport} style={cursorStyle} aria-label="Drawing canvas" tabIndex={0} {...gestureHandlers} onPointerDown={(event) => {
      if (event.pointerType === 'touch' && event.nativeEvent.isTrusted) return;
      if (!focused && tool === 'select' && event.target === event.currentTarget) bridge.send({ type: 'clear-selection' });
    }}>
      <PrecisionFillFeedback aim={precisionFill.aim} magnified={precisionFill.magnified} releasedAim={precisionFill.releasedAim} />
      <div className="canvas-envelope" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
        <PhaserGame focused={!!focused} bridge={bridge} setup={setup} zoom={zoom} offsetX={position.x} offsetY={position.y} />
      </div>
    </section>
    {saveStatus !== 'idle' && <div className="save-notice" role="status"><span>{saveStatus === 'saved' ? 'Saved to Your pictures' : 'Could not save. Device storage may be full or unavailable.'}</span><button className="icon-button" aria-label="Dismiss save message" onClick={() => setSaveStatus('idle')}><X /></button></div>}
    <dialog className={`setup-dialog art-dialog ${picker === 'stickers' ? 'sticker-dialog' : ''}`} ref={dialog} onCancel={() => setPicker(null)} onClick={(event) => closeOnBackdrop(event, () => setPicker(null))} onAuxClick={(event) => { if (event.button === 2) closeOnBackdrop(event, () => setPicker(null)); }} aria-labelledby="art-picker-title">
      <div className="wizard" aria-busy={loadingSticker}>
        {loadingSticker && <progress aria-label="Loading sticker" />}
        {stickerError && <button onClick={() => setStickerError(false)}>Could not load sticker. Tap to dismiss.</button>}
        <header className="wizard-header">{picker === 'stickers' && category && <button className="icon-button" aria-label="Back to sticker categories" onClick={() => setCategoryId(null)}><ArrowLeft /></button>}<h2 id="art-picker-title" ref={pickerTitle} tabIndex={-1}>{picker === 'stickers' ? category?.title ?? 'Stickers' : picker === 'colors' ? 'Pick a color' : picker === 'brush' ? 'Brush' : 'Fill'}</h2><button className="icon-button" onClick={() => setPicker(null)} aria-label="Close picker"><X /></button></header>
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
  </main>;
}
