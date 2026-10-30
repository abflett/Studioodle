import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, Ref } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { DialogHeader } from './DialogHeader';
import { maxBrushSize, minBrushSize } from '../editor/toolOptions';
import type { BrushOptions, BrushTip } from '../editor/toolOptions';
import { diagonalTipStroke } from '../editor/vectorPaintStyles';
import type { Pair } from '../editor/polygonGeometry';

const tips: { id: BrushTip; label: string }[] = [
  { id: 'round', label: 'Round tip' }, { id: 'diagonal-up', label: 'Diagonal tip, rising' },
  { id: 'diagonal-down', label: 'Diagonal tip, falling' }, { id: 'scatter', label: 'Soft spray tip' },
];
function TipIcon({ tip }: { tip: BrushTip }) {
  return <svg viewBox="0 0 48 48" aria-hidden="true">
    {tip === 'round' ? <circle cx="24" cy="24" r="12" fill="currentColor" stroke="none" />
      : tip === 'diagonal-up' ? <path d="m14 34 20-20" strokeWidth="6" />
        : tip === 'diagonal-down' ? <path d="m14 14 20 20" strokeWidth="6" />
          : <g fill="currentColor" stroke="none">{[[23,24,2.9],[27,20,2.6],[19,20,2],[22,16,1.8],[17,26,2.5],[28,27,2.8],[23,30,2.4],[30,23,1.8],[31,32,1.7],[15,18,1.3],[16,33,1.4],[25,35,1.5],[33,16,1.2],[12,25,1.1],[24,10,1.1],[36,26,1.1],[12,35,1],[35,36,1],[18,11,1],[29,13,1.3]].map(([x,y,r], index) => <circle key={index} cx={x} cy={y} r={r} />)}</g>}
  </svg>;
}

/** Small deterministic illustration. No paint worker, editor document or animation. */
function previewPath(value: BrushOptions, width: number) {
  const diameter = value.size * .58, radius = diameter / 2;
  const point = (t: number): Pair => [width * (.11 + .78 * t), 32 - 10 * Math.sin(t * Math.PI * 2)];
  const n = (v: number) => Math.round(v * 100) / 100;
  const commands: string[] = [];
  let seed = 17;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i <= 96; i++) {
    const t = i / 96, [x, y] = point(t);
    if (value.tip === 'scatter') {
      const particles = (1 + Math.floor(6 * Math.sin(t * Math.PI) ** 4)) * 5;
      const r = Math.max(.45, diameter * .07);
      for (let j = 0; j < particles; j++) {
        const angle = random() * Math.PI * 2, distance = Math.sqrt(random()) * radius;
        const cx = n(x + Math.cos(angle) * distance), cy = n(y + Math.sin(angle) * distance);
        commands.push(`M${n(cx + r)} ${cy}a${n(r)} ${n(r)} 0 1 0 ${n(-2*r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(2*r)} 0Z`);
      }
    } else if (value.tip === 'round') commands.push(`${i ? 'L' : 'M'}${n(x)} ${n(y)}`);
    else if (i) {
      for (const polygon of diagonalTipStroke(point((i - 1) / 96), [x, y], radius, value.tip === 'diagonal-up')) {
        for (const ring of polygon) commands.push(ring.map(([px, py], index) => `${index ? 'L' : 'M'}${n(px)} ${n(py)}`).join('') + 'Z');
      }
    }
  }
  return commands.join('');
}

function BrushPreview({ value }: { value: BrushOptions }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(1, Math.round(element.clientWidth)));
    measure(); const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const path = useMemo(() => previewPath(value, width), [value, width]);
  return <div className="brush-preview-well" ref={host}>
    <svg className="brush-preview" viewBox={`0 0 ${width} 64`} role="img" aria-label={`${tips.find(tip => tip.id === value.tip)!.label}, size ${value.size}: premade stroke preview`}>
      {value.tip === 'scatter' && <defs><filter id="brush-spray-softness" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation=".35" /></filter></defs>}
      <path filter={value.tip === 'scatter' ? 'url(#brush-spray-softness)' : undefined} d={path} fill={value.tip === 'round' ? 'none' : 'currentColor'} stroke={value.tip === 'round' ? 'currentColor' : 'none'} strokeWidth={value.size * .58} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>;
}

export function BrushPicker({ value, onChange, onClose, headingRef }: {
  value: BrushOptions; onChange: (value: BrushOptions) => void; onClose: () => void; headingRef: Ref<HTMLHeadingElement>;
}) {
  const [draft, setDraft] = useState({ source: value.size, text: String(value.size) });
  const setSize = (size: number) => {
    const checked = Math.max(minBrushSize, Math.min(maxBrushSize, Math.round(size)));
    setDraft({ source: checked, text: String(checked) }); onChange({ ...value, size: checked });
  };
  return <div className="brush-picker">
    <DialogHeader id="art-picker-title" title="Brush" headingRef={headingRef} onClose={onClose} closeLabel="Close picker">
      <div className="brush-tips" role="group" aria-label="Brush tip effect">{tips.map(tip => <button key={tip.id} type="button" className="brush-tip" aria-label={tip.label} title={tip.label} aria-pressed={value.tip === tip.id} onClick={() => onChange({ ...value, tip: tip.id })}><TipIcon tip={tip.id} /></button>)}</div>
    </DialogHeader>
    <div className="brush-size-control" role="group" aria-label="Brush size">
      <button type="button" className="icon-button" aria-label="Make brush one unit smaller" title="Smaller by 1" disabled={value.size <= minBrushSize} onClick={() => setSize(value.size - 1)}><Minus aria-hidden="true" /></button>
      <input className="brush-size-slider" type="range" min={minBrushSize} max={maxBrushSize} step="1" value={value.size} aria-label="Brush size in page units" style={{ '--brush-progress': `${(value.size - minBrushSize) / (maxBrushSize - minBrushSize) * 100}%` } as CSSProperties} onChange={event => setSize(Number(event.target.value))} />
      <input className="brush-size-number" type="number" min={minBrushSize} max={maxBrushSize} step="1" value={draft.source === value.size ? draft.text : String(value.size)} aria-label="Exact brush size in page units" title="Exact brush size: 1-64" onChange={event => {
        if (event.target.value === '') { setDraft({ source: value.size, text: '' }); return; }
        const size = event.target.valueAsNumber; if (Number.isFinite(size)) setSize(size);
      }} onBlur={() => setDraft({ source: value.size, text: String(value.size) })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
      <button type="button" className="icon-button" aria-label="Make brush one unit larger" title="Larger by 1" disabled={value.size >= maxBrushSize} onClick={() => setSize(value.size + 1)}><Plus aria-hidden="true" /></button>
    </div>
    <footer className="brush-footer"><BrushPreview value={value} /><button type="button" className="go-button brush-apply" aria-label="Use this brush" title="Use this brush" onClick={onClose}><Check aria-hidden="true" /></button></footer>
  </div>;
}
