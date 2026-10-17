import { StickerBrowser } from './StickerBrowser';
import { BrushPicker, FillPicker } from './ToolOptions';
import { defaultBrush, defaultFill } from '../editor/toolOptions';
import { ColorPicker } from './ColorPicker';
import { stickerCategories } from './stickerCatalog';
import { closeOnBackdrop } from './dialog';
import { paperSize } from '../editor/document';
import { usePaperView } from './usePaperView';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Undo2, House, Shapes, Palette, Paintbrush, PaintBucket, X, Check, Eraser, ScanSearch, MousePointer2, Move, ZoomIn, Maximize2, RotateCw, FlipHorizontal2, Copy, Trash2 } from 'lucide-react';
import { PhaserGame } from '../PhaserGame';
import { createEditorBridge } from '../editor/bridge';
import type { EditorTool } from '../editor/bridge';
import type { EditorSetup } from '../editor/setup';
import { initialDrawingSettings } from '../editor/setup';

type Picker = 'stickers' | 'colors' | 'brush' | 'fill';
export default function EditorPreview({ setup: initialSetup, onBack }: { setup: EditorSetup; onBack: () => void }) {
  const [measuredSetup, setMeasuredSetup] = useState<EditorSetup>();
  const setup = measuredSetup ?? initialSetup;
  const needsMeasurement = setup.format === 'window' && !setup.size;
  const [bridge] = useState(createEditorBridge);
  const [color, setColor] = useState(() => initialDrawingSettings(setup).color);
  const [tool, setTool] = useState<EditorTool>(() => initialDrawingSettings(setup).tool);
  const [selected, setSelected] = useState<string>();
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
    const timer = window.setInterval(() => bridge.send({ type: 'save', onComplete: (saved) => setSaveStatus(saved ? 'idle' : 'error') }), 60_000);
    return () => window.clearInterval(timer);
  }, [bridge]);
  const [brushOptions, setBrushOptions] = useState(defaultBrush);
  const [fillOptions, setFillOptions] = useState(defaultFill);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const category = stickerCategories.find((item) => item.id === categoryId);
  const pickerTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (picker) pickerTitle.current?.focus({ preventScroll: true }); }, [picker, categoryId]);
  const [requestedZoom, setZoom] = useState<number | null>(null);
  const { viewport, position, focus, zoom, fitZoom, handlers } = usePaperView(paperSize(setup.format, setup.size), requestedZoom, tool === 'pan');
  useLayoutEffect(() => {
    if (!needsMeasurement || !viewport.current) return;
    setMeasuredSetup({ ...initialSetup, size: {
      width: Math.max(1, Math.floor(viewport.current.clientWidth)),
      height: Math.max(1, Math.floor(viewport.current.clientHeight)),
    } });
  }, [initialSetup, needsMeasurement, viewport]);
  const chooseTool = (value: EditorTool) => { setTool(value); bridge.send({ type: 'set-tool', tool: value }); };
  const toggleSelect = () => {
    if (tool === 'select') chooseTool('bucket');
    else chooseTool('select');
  };
  const cycleZoom = () => {
    const levels = [...new Set([fitZoom, .5, .75, 1, 1.5, 2])].sort((a, b) => a - b);
    const next = levels.find(level => level > zoom + .001) ?? levels[0]!;
    setZoom(Math.abs(next - fitZoom) < .001 ? null : next);
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
    <header className="art-ribbon" aria-label="Art tools">
      <button onClick={() => bridge.send({ type: 'save', onComplete: (saved) => { if (saved) onBack(); else setSaveStatus('error'); } })} aria-label="Save and go home"><House /><span>Home</span></button>
      <button onClick={() => bridge.send({ type: 'undo' })}><Undo2 /><span>Undo</span></button>
      <span className="ribbon-divider" />
      <button aria-pressed={tool === 'erase'} onClick={() => chooseTool('erase')}><Eraser /><span>Erase</span></button>
      <button aria-pressed={tool === 'select'} onClick={toggleSelect}><MousePointer2 /><span>Select</span></button>
      <button aria-pressed={tool === 'pan'} onClick={() => chooseTool('pan')}><Move /><span>Pan</span></button>
      <button onClick={cycleZoom} aria-label={`Zoom ${Math.round(zoom * 100)} percent, next zoom level`}><ZoomIn /><span>{Math.round(zoom * 100)}%</span></button>

      <button onClick={() => { setUseCurrentOutline(false); setCategoryId(null); setPicker('stickers'); }} aria-haspopup="dialog"><Shapes /><span>Stickers</span></button>
      <button onClick={() => setPicker('colors')} aria-haspopup="dialog"><Palette style={{ color: `#${color.toString(16).padStart(6, '0')}` }} /><span>Colors</span></button>
      <button aria-pressed={tool === 'brush'} onClick={() => { chooseTool('brush'); setPicker('brush'); }} aria-haspopup="dialog"><Paintbrush /><span>Brush</span></button>
      <button aria-pressed={tool === 'bucket'} onClick={() => { chooseTool('bucket'); setPicker('fill'); }} aria-haspopup="dialog"><PaintBucket /><span>Fill</span></button>
    </header>
    <section className={`art-canvas ${tool === 'pan' ? 'pan-mode' : ''}`} ref={viewport} aria-label="Drawing canvas" tabIndex={0} {...handlers} onPointerDown={(event) => {
      if (tool === 'select' && event.target === event.currentTarget) bridge.send({ type: 'clear-selection' });
    }}>
      {tool === 'select' && selected && <div className="art-ribbon sticker-ribbon" role="toolbar" aria-label="Selected sticker" onPointerDown={(event) => event.stopPropagation()}>
        <div className="sticker-adjustment" role="group" aria-label="Sticker size"><Maximize2 aria-hidden="true" /><span>Size</span><div>
          <button aria-label="Shrink sticker by 10 percentage points" onClick={() => bridge.send({ type: 'transform-selection', scaleDelta: -.1, rotationDelta: 0 })}>−</button>
          <button aria-label="Grow sticker by 10 percentage points" onClick={() => bridge.send({ type: 'transform-selection', scaleDelta: .1, rotationDelta: 0 })}>+</button>
        </div></div>
        <div className="sticker-adjustment" role="group" aria-label="Sticker rotation"><RotateCw aria-hidden="true" /><span>Rotate</span><div>
          <button aria-label="Rotate sticker left 15 degrees" onClick={() => bridge.send({ type: 'transform-selection', scaleDelta: 0, rotationDelta: -15 })}>−</button>
          <button aria-label="Rotate sticker right 15 degrees" onClick={() => bridge.send({ type: 'transform-selection', scaleDelta: 0, rotationDelta: 15 })}>+</button>
        </div></div>
        <button disabled title="Flip — coming soon"><FlipHorizontal2 /><span>Flip</span></button>
        <button disabled={!selectionOrder.forward} aria-label="Move sticker one step forward" onClick={() => bridge.send({ type: 'order-selection', direction: 'forward' })}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" fill="none" stroke="currentColor" /><rect x="3" y="3" width="12" height="12" rx="2" fill="currentColor" /></svg><span>Forward</span></button>
        <button disabled={!selectionOrder.backward} aria-label="Move sticker one step backward" onClick={() => bridge.send({ type: 'order-selection', direction: 'backward' })}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="12" height="12" rx="2" fill="currentColor" /><rect x="9" y="9" width="12" height="12" rx="2" fill="var(--panel)" stroke="currentColor" /></svg><span>Backward</span></button>
        <button onClick={() => bridge.send({ type: 'focus-selection', onFocus: (bounds) => setZoom(focus(bounds, (viewport.current?.querySelector('.sticker-ribbon')?.getBoundingClientRect().height ?? 100) + 20)) })}><ScanSearch /><span>Focus</span></button>
        <button onClick={() => bridge.send({ type: 'duplicate-selection' })}><Copy /><span>Duplicate</span></button>
        <button onClick={() => bridge.send({ type: 'delete-selection' })}><Trash2 /><span>Delete</span></button>
        <button onClick={() => chooseTool('bucket')} aria-label="Finish selecting"><Check /><span>Done</span></button>
      </div>}
      <div className="canvas-envelope" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
        {!needsMeasurement && <PhaserGame bridge={bridge} setup={setup} zoom={zoom} offsetX={position.x} offsetY={position.y} />}
      </div>
    </section>
    {saveStatus !== 'idle' && <div className="save-notice" role="status"><span>{saveStatus === 'saved' ? 'Saved to Your pictures' : 'Could not save. Device storage may be full or unavailable.'}</span><button className="icon-button" aria-label="Dismiss save message" onClick={() => setSaveStatus('idle')}><X /></button></div>}
    <dialog className={`setup-dialog art-dialog ${picker === 'stickers' ? 'sticker-dialog' : ''}`} ref={dialog} onCancel={() => setPicker(null)} onClick={(event) => closeOnBackdrop(event, () => setPicker(null))} onAuxClick={(event) => { if (event.button === 2) closeOnBackdrop(event, () => setPicker(null)); }} aria-labelledby="art-picker-title">
      <div className="wizard">
        <header className="wizard-header">{picker === 'stickers' && category && <button className="icon-button" aria-label="Back to sticker categories" onClick={() => setCategoryId(null)}><ArrowLeft /></button>}<h2 id="art-picker-title" ref={pickerTitle} tabIndex={-1}>{picker === 'stickers' ? category?.title ?? 'Stickers' : picker === 'colors' ? 'Pick a color' : picker === 'brush' ? 'Brush' : 'Fill'}</h2><button className="icon-button" onClick={() => setPicker(null)} aria-label="Close picker"><X /></button></header>
        <div className="wizard-body">

          {picker === 'colors' && <ColorPicker color={color} onChoose={(value) => { setColor(value); bridge.send({ type: 'set-color', color: value }); setPicker(null); }} />}
          {picker === 'brush' && <BrushPicker value={brushOptions} onChange={(options) => { setBrushOptions(options); bridge.send({ type: 'set-brush', options }); }} />}
          {picker === 'fill' && <FillPicker value={fillOptions} color={color} onChange={(options) => { setFillOptions(options); bridge.send({ type: 'set-fill', options }); }} />}
          {picker === 'stickers' && <StickerBrowser key={categoryId ?? 'categories'} categoryId={categoryId} color={outlineColor} onCategory={setCategoryId} onAdd={(kind) => { bridge.send({ type: 'add-sticker', sticker: kind, outlineColor, point: { x: ((viewport.current?.clientWidth ?? 0) / 2 - position.x) / zoom, y: ((viewport.current?.clientHeight ?? 0) / 2 - position.y) / zoom } }); setPicker(null); }} />}
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
















