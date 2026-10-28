import { PaintBucket } from 'lucide-react';
import { patternPixel } from '../editor/toolOptions';
import type { FillOptions } from '../editor/toolOptions';

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
