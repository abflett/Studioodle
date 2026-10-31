import { DialogHeader } from './DialogHeader';
import { PrecisionFillFeedback } from './PrecisionFillFeedback';
import { useToolCursorStyle } from './toolCursors';
import { useLatest } from './useLatest';
import { useEditorSaving } from './useEditorSaving';
import { usePrecisionFill } from './usePrecisionFill';
import { useCanvasGestures } from './useCanvasGestures';
import { useEditorShortcuts } from './useEditorShortcuts';
import type { AppSettings } from './settings';
import { StickerSelectionToolbar } from './StickerSelectionToolbar';
import { StickerBrowser, StickerFilters } from './StickerBrowser';
import type { StickerDetail } from './stickerCatalog';
import { StickerInkPicker } from './StickerInkPicker';
import { BrushPicker } from './BrushPicker';
import { defaultBrush } from '../editor/toolOptions';
import { PalettePicker } from './PalettePicker';
import { emptyCustomColors, resolveColor, slotColor, usablePaletteColor } from '../editor/colorPalettes';
import { stickerCategories } from './stickerCatalog';
import { closeOnBackdrop } from './dialog';
import { paperSize } from '../editor/document';
import { usePaperView } from './usePaperView';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Undo2, House, Shapes, Palette, Brush, PaintBucket, X, Eraser, MousePointer2, Move, ZoomIn, Save, PanelTopClose, PanelTopOpen } from 'lucide-react';
import { EditorCanvas } from './EditorCanvas';
import { createEditorBridge } from '../editor/bridge';
import type { StickerKind } from '../editor/stickerKinds';
import type { EditorTool } from '../editor/bridge';
import type { EditorSetup } from '../editor/setup';
import { initialDrawingSettings } from '../editor/setup';
import { prepareStickers } from '../editor/vectorStickers';

type Picker = 'stickers' | 'colors' | 'brush';
export default function EditorPreview({ setup, onBack, settings }: { setup: EditorSetup; onBack: () => void; settings: AppSettings }) {
  const [bridge] = useState(createEditorBridge);
  const [inputError,setInputError]=useState<string>();
  useEffect(()=>bridge.onError(setInputError),[bridge]);
  const [color, setColor] = useState(() => initialDrawingSettings(setup).color);
  const [customColors, setCustomColors] = useState(() => setup.document?.customColors ?? emptyCustomColors());
  useEffect(() => bridge.onPalette((colors, active) => { setCustomColors([...colors]); setColor(active); }), [bridge]);
  const [tool, setTool] = useState<EditorTool>(() => initialDrawingSettings(setup).tool);
  const cursorStyle = useToolCursorStyle(tool, resolveColor(usablePaletteColor(color, customColors), customColors));
  const [focused, setFocused] = useState<string>();
  useEffect(() => bridge.onFocus(setFocused), [bridge]);
  const [selected, setSelected] = useState<string>();
  const selectionDrawer = useRef<HTMLDivElement>(null);
  const [chosenOutline, setOutlineColor] = useState(slotColor(0));
  const outlineColor = usablePaletteColor(chosenOutline, customColors);
  const [inkPicker, setInkPicker] = useState(false);
  const inkButton = useRef<HTMLButtonElement>(null);
  const [stickerDetail, setStickerDetail] = useState<StickerDetail>();
  useEffect(() => bridge.onTool(setTool), [bridge]);
  const [selectionOrder, setSelectionOrder] = useState({ forward: false, backward: false });
  useEffect(() => bridge.onSelection((id, order) => {
    setSelected(id);
    setSelectionOrder(previous => previous.forward === order.forward && previous.backward === order.backward ? previous : order);
  }), [bridge]);
  const { saveStatus, dismissSaveStatus, save, goHome } = useEditorSaving(bridge, onBack);
  const [brushOptions, setBrushOptions] = useState(defaultBrush);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [loadingSticker, setLoadingSticker] = useState(false);
  const [stickerError, setStickerError] = useState(false);
  const stickerRequest = useRef(0);
  const stickerPending = useRef(false);
  useEffect(() => () => { stickerRequest.current++; }, []);
  const closePicker = () => { stickerRequest.current++; stickerPending.current=false; setLoadingSticker(false); setPicker(null); };
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const category = stickerCategories.find((item) => item.id === categoryId);
  const pickerTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (picker) pickerTitle.current?.focus({ preventScroll: true }); }, [picker, categoryId]);
  const [ribbonHidden, setRibbonHidden] = useState(false);
  const collapseButton = useRef<HTMLButtonElement>(null), reopenButton = useRef<HTMLButtonElement>(null);
  const ribbonFocusPending = useRef(false);
  useEffect(() => {
    if (!ribbonFocusPending.current) return;
    ribbonFocusPending.current = false;
    (ribbonHidden ? reopenButton : collapseButton).current?.focus({ preventScroll: true });
  }, [ribbonHidden]);
  const toggleRibbon = () => { bridge.send({ type: 'cancel-input' }); ribbonFocusPending.current = true; setRibbonHidden(hidden => !hidden); };
  const [requestedZoom, setZoom] = useState<number | null>(null);
  const { viewport, position, focus, captureView, restoreView, pointAt, zoomAt, transformView, fitPage, zoom, handlers } = usePaperView(paperSize(setup.format, setup.size), requestedZoom, tool === 'pan', setZoom);
  const placementPoint = useLatest(() => {
    const box=viewport.current?.getBoundingClientRect();
    return box ? pointAt({x:box.left+box.width/2,y:box.top+box.height/2}) : undefined;
  });
  const addSticker = async (kind: StickerKind) => {
    if(stickerPending.current)return;
    const request=++stickerRequest.current;stickerPending.current=true;
    setLoadingSticker(true);setStickerError(false);
    try {
      await prepareStickers([kind]);
      if(request!==stickerRequest.current)return;
      const point=placementPoint.current();
      if(point)bridge.send({type:'add-sticker',sticker:kind,outlineColor,point});
      closePicker();
    } catch { if(request===stickerRequest.current)setStickerError(true); }
    finally { if(request===stickerRequest.current){stickerPending.current=false;setLoadingSticker(false);} }
  };
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
  const selectFill = () => chooseTool('bucket');
  const openStickers = () => { if (!focused) { setCategoryId(null); setPicker('stickers'); } };
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
    t: toggleRibbon, s: openStickers, c: () => setPicker('colors'), z: cycleZoom, '+': () => stepZoom(1.25), '=': () => stepZoom(1.25), '-': () => stepZoom(.8), '0': resetZoom,
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
    <div className="ribbon-shell" hidden={ribbonHidden} id="editor-ribbon">
    <header className="art-ribbon main-ribbon" aria-label="Art tools">
      <div className="ribbon-group" role="group" aria-label="Home">
        <button title="Home" aria-label="Go home" onClick={goHome}><House aria-hidden="true" /></button>
      </div>
      <div className="ribbon-group" role="group" aria-label="View and selection">
        <button title="Move the page (H)" aria-keyshortcuts="H" aria-label="Move the page" aria-pressed={tool === 'pan'} onClick={() => chooseTool('pan')}><Move aria-hidden="true" /></button>
        <button title="Zoom (Z; + / -; 0 to fit)" aria-label={`Zoom ${requestedZoom ?? 1} times fitted page, next zoom level`} onClick={cycleZoom}><ZoomIn aria-hidden="true" /></button>
        <button title="Select and move stickers (V)" aria-keyshortcuts="V" aria-label="Select and move stickers" aria-pressed={tool === 'select'} onClick={toggleSelect}><MousePointer2 aria-hidden="true" /></button>
      </div>
      <div className="ribbon-group" role="group" aria-label="Drawing tools">
        <button title="Erase (E)" aria-keyshortcuts="E" aria-label="Erase" aria-pressed={tool === 'erase'} onClick={() => chooseTool('erase')}><Eraser aria-hidden="true" /></button>
        <button title="Brush (B)" aria-keyshortcuts="B" aria-label="Brush" aria-pressed={tool === 'brush'} onClick={selectBrush} aria-haspopup={settings.advancedPainting ? 'dialog' : undefined}><Brush aria-hidden="true" /></button>
        <button title="Fill (G)" aria-keyshortcuts="G" aria-label="Fill" aria-pressed={tool === 'bucket'} onClick={selectFill}><PaintBucket aria-hidden="true" /></button>
        <button title={focused ? "Finish focus to add stickers" : "Stickers (S)"} aria-label="Stickers" disabled={!!focused} onClick={openStickers} aria-haspopup="dialog"><Shapes aria-hidden="true" /></button>
        <button title="Colors (C)" aria-keyshortcuts="C" aria-label="Colors" onClick={() => setPicker('colors')} aria-haspopup="dialog"><Palette aria-hidden="true" /><span className="ribbon-color-dot" aria-hidden="true" style={{ background: `#${resolveColor(usablePaletteColor(color, customColors), customColors).toString(16).padStart(6, '0')}` }} /></button>
      </div>
      <div className="ribbon-group" role="group" aria-label="History">
        <button title="Undo (Ctrl/Cmd+Z or Backspace)" aria-keyshortcuts="Control+Z Meta+Z Backspace" aria-label="Undo" onClick={() => bridge.send({ type: 'undo' })}><Undo2 aria-hidden="true" /></button>
      </div>
    </header>
      <button ref={collapseButton} className="ribbon-toggle ribbon-collapse" title="Hide tools (T)" aria-keyshortcuts="T" aria-label="Hide tools" aria-expanded="true" aria-controls="editor-ribbon" onClick={toggleRibbon}><PanelTopClose aria-hidden="true" /></button>
      {((tool === 'select' && selected) || focused) && <StickerSelectionToolbar bridge={bridge} focused={!!focused} order={selectionOrder} drawerRef={selectionDrawer} onFocus={focusSelection} onFinish={finishSelection} />}
    </div>
    {ribbonHidden && <button ref={reopenButton} className="ribbon-toggle ribbon-reopen" title="Show tools (T)" aria-keyshortcuts="T" aria-label="Show tools" aria-expanded="false" aria-controls="editor-ribbon" onClick={toggleRibbon}><PanelTopOpen aria-hidden="true" /></button>}
    <section className={`art-canvas ${tool === 'pan' ? 'pan-mode' : ''} ${focused ? 'focus-mode' : ''}`} ref={viewport} style={cursorStyle} aria-label="Drawing canvas" tabIndex={0} {...gestureHandlers}>
      <PrecisionFillFeedback aim={precisionFill.aim} magnified={precisionFill.magnified} releasedAim={precisionFill.releasedAim} />
      <div className="canvas-envelope" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
        <EditorCanvas focused={!!focused} bridge={bridge} setup={setup} zoom={zoom} offsetX={position.x} offsetY={position.y} />
      </div>
    </section>
    {inputError && <div className="save-notice" role="alert"><span>{inputError}</span><button className="icon-button" aria-label="Save picture after paint error" onClick={() => { setInputError(undefined); save(); }}><Save aria-hidden="true" /></button><button className="icon-button" aria-label="Dismiss paint error" onClick={()=>setInputError(undefined)}><X /></button></div>}
    {saveStatus !== 'idle' && <div className="save-notice" role="status"><span>{saveStatus === 'saved' ? 'Saved to Your pictures' : 'Could not save. Device storage may be full or unavailable.'}</span><button className="icon-button" aria-label="Dismiss save message" onClick={dismissSaveStatus}><X /></button></div>}
    <dialog className={`setup-dialog art-dialog ${picker === 'stickers' ? 'sticker-dialog' : ''} ${picker === 'brush' ? 'brush-dialog' : ''} ${picker === 'colors' ? 'palette-dialog' : ''}`} ref={dialog} onCancel={closePicker} onClick={(event) => closeOnBackdrop(event, closePicker)} onAuxClick={(event) => { if (event.button === 2) closeOnBackdrop(event, closePicker); }} aria-labelledby="art-picker-title">
      {picker === 'colors' ? <PalettePicker color={color} custom={customColors} onChoose={value => { setColor(value); bridge.send({ type: 'set-color', color: value }); closePicker(); }} onEdit={(index, value) => bridge.send({ type: 'set-custom-color', index, color: value })} onClose={closePicker} headingRef={pickerTitle} /> : picker === 'brush' ? <BrushPicker value={brushOptions} onChange={options => { setBrushOptions(options); bridge.send({ type: 'set-brush', options }); }} onClose={closePicker} headingRef={pickerTitle} /> : <div className="wizard" aria-busy={loadingSticker}>
        {loadingSticker && <progress aria-label="Loading sticker" />}
        {stickerError && <button onClick={() => setStickerError(false)}>Could not load sticker. Tap to dismiss.</button>}
        <DialogHeader id="art-picker-title" headingRef={pickerTitle} title={picker === 'stickers' ? category?.title ?? 'Stickers' : 'Pick a color'} onClose={closePicker} closeLabel="Close picker" back={picker === 'stickers' && category ? { label: 'Back to sticker categories', onClick: () => setCategoryId(null) } : undefined}>
          {picker === 'stickers' && <div className="sticker-header-controls"><button ref={inkButton} className="icon-button sticker-ink-button" aria-label="Choose sticker ink color" title="Sticker ink color" aria-haspopup="dialog" onClick={() => setInkPicker(true)}><Palette aria-hidden="true" /><span className="ribbon-color-dot" aria-hidden="true" style={{ background: `#${resolveColor(outlineColor, customColors).toString(16).padStart(6, '0')}` }} /></button><StickerFilters value={stickerDetail} onChange={setStickerDetail} /></div>}
        </DialogHeader>
        <div className="wizard-body">

          {picker === 'stickers' && <StickerBrowser key={`${categoryId ?? 'categories'}:${stickerDetail ?? 'all'}`} categoryId={categoryId} detail={stickerDetail} onCategory={setCategoryId} onAdd={kind => { void addSticker(kind); }} />}
        </div>

      </div>}
    </dialog>
    {inkPicker && <StickerInkPicker returnFocus={inkButton} color={outlineColor} custom={customColors} onEdit={(index, value) => bridge.send({ type: 'set-custom-color', index, color: value })} onChoose={value => { setOutlineColor(value); setInkPicker(false); }} onClose={() => setInkPicker(false)} />}
  </main>;
}
