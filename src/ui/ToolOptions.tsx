import { Paintbrush, Pencil, PenTool, SprayCan, Circle, Square, PaintBucket } from 'lucide-react';
import { patternPixel } from '../editor/toolOptions';
import type { BrushOptions, FillOptions } from '../editor/toolOptions';

export function BrushPicker({ value, onChange }: { value: BrushOptions; onChange: (value: BrushOptions) => void }) {
  return <div className="tool-settings">
    <div className="tool-setting-row" role="group" aria-label="Brush type">
      {([{ kind: 'ink', label: 'Ink pen', icon: PenTool }, { kind: 'pencil', label: 'Pencil', icon: Pencil }, { kind: 'brush', label: 'Brush', icon: Paintbrush }, { kind: 'spray', label: 'Spray', icon: SprayCan }] as const).map(({ kind, label, icon: Icon }) => <button key={kind} aria-pressed={value.kind === kind} onClick={() => onChange({ ...value, kind })}><Icon /><span>{label}</span></button>)}
    </div>
    <div className="tool-setting-row" role="group" aria-label="Brush tip shape">
      <button aria-pressed={value.shape === 'round'} onClick={() => onChange({ ...value, shape: 'round' })}><Circle /><span>Round</span></button>
      <button aria-pressed={value.shape === 'square'} onClick={() => onChange({ ...value, shape: 'square' })}><Square /><span>Square</span></button>
    </div>
    <div className="tool-setting-row" role="group" aria-label="Brush thickness">
      {[2, 5, 10, 20, 40].map((size) => <button key={size} aria-label={`${size} pixel brush`} aria-pressed={value.size === size} onClick={() => onChange({ ...value, size })}><span className="brush-size-preview"><i style={{ width: size, height: size, borderRadius: value.shape === 'round' ? '50%' : '0' }} /></span><span>{size}</span></button>)}
    </div>
  </div>;
}

export function FillPicker({ value, color, onChange }: { value: FillOptions; color: number; onChange: (value: FillOptions) => void }) {
  return <div className="tool-settings">
    <div className="tool-setting-row" role="group" aria-label="Fill style">
      {(['solid', 'dots', 'stripes', 'checker'] as const).map((pattern) => <button key={pattern} aria-pressed={value.pattern === pattern} onClick={() => onChange({ ...value, pattern })}>
        {pattern === 'solid' ? <PaintBucket /> : <svg viewBox="0 0 32 32" aria-hidden="true" shapeRendering="crispEdges"><rect width="32" height="32" fill="white" />{Array.from({ length: 1024 }, (_, i) => patternPixel(i % 32, Math.floor(i / 32), { pattern, spacing: value.spacing }) && <rect key={i} x={i % 32} y={Math.floor(i / 32)} width="1" height="1" fill={`#${color.toString(16).padStart(6, '0')}`} />)}</svg>}
        <span>{pattern === 'solid' ? 'Solid' : pattern === 'dots' ? 'Dots' : pattern === 'stripes' ? 'Stripes' : 'Checks'}</span>
      </button>)}
    </div>
    <div className="tool-setting-row" role="group" aria-label="Pattern size">
      {([8, 16, 32] as const).map((spacing, index) => <button key={spacing} disabled={value.pattern === 'solid'} aria-pressed={value.spacing === spacing} onClick={() => onChange({ ...value, spacing })}><span>{['Small', 'Medium', 'Large'][index]}</span></button>)}
    </div>
  </div>;
}
