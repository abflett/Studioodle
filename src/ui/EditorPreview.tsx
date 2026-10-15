import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Undo2, Save, Shapes, Palette, Paintbrush, PaintBucket, TreePine, Flower2, X, Check, ScanSearch, Hand, Move, ZoomIn, Circle, Square, Triangle } from 'lucide-react';
import { PhaserGame } from '../PhaserGame';
import { createEditorBridge } from '../editor/bridge';
import type { EditorTool } from '../editor/bridge';
import type { EditorSetup } from '../editor/setup';

const colors = [
  { name: 'Sage', value: 0x87b999 }, { name: 'Peach', value: 0xe9a07e },
  { name: 'Lavender', value: 0xb3a0d4 }, { name: 'Sky', value: 0x86b8d4 },
  { name: 'Sunshine', value: 0xe7c46e }, { name: 'Rose', value: 0xd97994 },
  { name: 'Ink', value: 0x39483e }, { name: 'Cream', value: 0xfff5df },
];
type Picker = 'stickers' | 'colors' | 'tools' | 'shapes';
export default function EditorPreview({ setup, onBack }: { setup: EditorSetup; onBack: () => void }) {
  const [bridge] = useState(createEditorBridge);
  const [color, setColor] = useState(setup.leafColor);
  const [tool, setTool] = useState<EditorTool>('bucket');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [picker, setPicker] = useState<Picker | null>(null);
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLElement>(null);
  const pan = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
  const chooseTool = (value: EditorTool) => { setTool(value); bridge.send({ type: 'set-tool', tool: value }); };
  const cycleZoom = () => {
    const levels = [.5, .75, 1, 1.5, 2];
    const next = levels[(levels.indexOf(zoom) + 1) % levels.length]!;
    const view = viewport.current;
    const x = view ? (view.scrollLeft + view.clientWidth / 2 - 24) / zoom : 0;
    const y = view ? (view.scrollTop + view.clientHeight / 2 - 24) / zoom : 0;
    setZoom(next);
    requestAnimationFrame(() => { if (view) { view.scrollLeft = x * next + 24 - view.clientWidth / 2; view.scrollTop = y * next + 24 - view.clientHeight / 2; } });
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
      <button onClick={onBack} aria-label="Back to picture selection"><ArrowLeft /><span>Back</span></button>
      <button onClick={() => bridge.send({ type: 'undo' })}><Undo2 /><span>Undo</span></button>
      <button onClick={() => bridge.send({ type: 'save', onComplete: (saved) => setSaveStatus(saved ? 'saved' : 'error') })} aria-label="Save editable picture"><Save /><span>Save</span></button>
      <span className="ribbon-divider" />
      <button aria-pressed={tool === 'inspect'} onClick={() => chooseTool('inspect')}><ScanSearch /><span>Inspect</span></button>
      <button aria-pressed={tool === 'move'} onClick={() => chooseTool('move')}><Hand /><span>Move</span></button>
      <button aria-pressed={tool === 'pan'} onClick={() => chooseTool('pan')}><Move /><span>Pan</span></button>
      <button onClick={cycleZoom} aria-label={`Zoom ${Math.round(zoom * 100)} percent, next zoom level`}><ZoomIn /><span>{Math.round(zoom * 100)}%</span></button>
      <button onClick={() => setPicker('shapes')} aria-haspopup="dialog"><Shapes /><span>Shapes</span></button>
      <button onClick={() => setPicker('stickers')} aria-haspopup="dialog"><TreePine /><span>Stickers</span></button>
      <button onClick={() => setPicker('colors')} aria-haspopup="dialog"><Palette style={{ color: `#${color.toString(16).padStart(6, '0')}` }} /><span>Colors</span></button>
      <button onClick={() => setPicker('tools')} aria-haspopup="dialog">{tool === 'brush' ? <Paintbrush /> : <PaintBucket />}<span>Tools</span></button>
    </header>
        <section className={`art-canvas ${tool === 'pan' ? 'pan-mode' : ''}`} ref={viewport} aria-label="Drawing canvas" tabIndex={0}
      onPointerDownCapture={(event) => {
        if (tool !== 'pan' || event.button !== 0) return;
        event.preventDefault(); event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
      }}
      onPointerMoveCapture={(event) => {
        const start = pan.current;
        if (!start || start.id !== event.pointerId) return;
        event.preventDefault(); event.stopPropagation();
        event.currentTarget.scrollLeft = start.left - (event.clientX - start.x);
        event.currentTarget.scrollTop = start.top - (event.clientY - start.y);
      }}
      onPointerUpCapture={(event) => { if (pan.current?.id === event.pointerId) { pan.current = null; event.currentTarget.releasePointerCapture(event.pointerId); } }}
      onPointerCancel={() => { pan.current = null; }} onLostPointerCapture={() => { pan.current = null; }}><div className="canvas-envelope"><PhaserGame bridge={bridge} setup={setup} zoom={zoom} /></div></section>
    {saveStatus !== 'idle' && <div className="save-notice" role="status"><span>{saveStatus === 'saved' ? 'Saved to Your pictures' : 'Could not save. Device storage may be full or unavailable.'}</span><button className="icon-button" aria-label="Dismiss save message" onClick={() => setSaveStatus('idle')}><X /></button></div>}
    <dialog className="setup-dialog art-dialog" ref={dialog} onCancel={() => setPicker(null)} aria-labelledby="art-picker-title">
      <div className="wizard">
        <header className="wizard-header"><h2 id="art-picker-title">{picker === 'shapes' ? 'Shapes' : picker === 'stickers' ? 'Nature stickers' : picker === 'colors' ? 'Pick a color' : 'Pick a tool'}</h2><button className="icon-button" onClick={() => setPicker(null)} aria-label="Close picker"><X /></button></header>
        <div className="wizard-body">
          {picker === 'shapes' && <div className="art-options shape-options">{(['circle', 'square', 'triangle'] as const).map((sticker) => <button className="format-button" key={sticker} onClick={() => { bridge.send({ type: 'add-sticker', sticker }); setPicker(null); }}>{sticker === 'circle' ? <Circle /> : sticker === 'square' ? <Square /> : <Triangle />}<span>{sticker[0]!.toUpperCase() + sticker.slice(1)}</span></button>)}</div>}
          {picker === 'colors' && <div className="art-colors">{colors.map((item) => <button className="paper-color" key={item.name} aria-label={item.name} aria-pressed={color === item.value} style={{ backgroundColor: `#${item.value.toString(16).padStart(6, '0')}` }} onClick={() => { setColor(item.value); bridge.send({ type: 'set-color', color: item.value }); setPicker(null); }}>{color === item.value && <Check className="color-check" />}</button>)}</div>}
          {picker === 'tools' && <div className="art-options">{(['brush', 'bucket'] as const).map((value) => <button className="format-button" key={value} aria-pressed={tool === value} onClick={() => { chooseTool(value); setPicker(null); }}>{value === 'brush' ? <Paintbrush /> : <PaintBucket />}<span>{value === 'brush' ? 'Brush' : 'Fill'}</span></button>)}</div>}
          {picker === 'stickers' && <div className="art-options">{(['tree', 'flower'] as const).map((sticker) => <button className="format-button" key={sticker} onClick={() => { bridge.send({ type: 'add-sticker', sticker }); setPicker(null); }}>{sticker === 'tree' ? <TreePine /> : <Flower2 />}<span>{sticker === 'tree' ? 'Tree' : 'Flower'}</span></button>)}</div>}
        </div>
      </div>
    </dialog>
  </main>;
}



