import type { CSSProperties } from 'react';
import { paperPresets } from '../editor/paperPresets';
import type { PaperPresetId } from '../editor/paperPresets';
import { contrastingDrawingColor } from '../editor/palette';

export function PaperArtwork({ preset, orientation, color }: { preset: PaperPresetId; orientation: 'portrait' | 'landscape'; color?: string }) {
  const paper = paperPresets.find(p => p.id === preset)!;
  const wide = preset !== 'square' && orientation === 'landscape';
  const width = wide ? paper.heightMm : paper.widthMm, height = wide ? paper.widthMm : paper.heightMm;
  const fold = Math.min(24, width * .12), units = preset === 'photo' || preset === 'square';
  const label = preset === 'full' ? 'A4' : preset === 'half' ? 'A5' : preset === 'photo' ? '4 \u00d7 6' : '6 \u00d7 6';
  const fontSize = preset === 'full' ? 64 : preset === 'half' ? 50 : preset === 'photo' ? 32 : 38;
  const ink = color ? `#${contrastingDrawingColor(color).toString(16).padStart(6, '0')}` : undefined;
  return <svg className="blank-paper-art" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    <path className="blank-paper-face" style={color ? { fill: color } : undefined} d={`M1 1H${width - fold}L${width - 1} ${fold}V${height - 1}H1Z`} />
    <path className="blank-paper-fold" d={`M${width - fold} 1V${fold}H${width - 1}Z`} />
    <text className="blank-paper-mark" style={ink ? { fill: ink } : undefined} x={width / 2} y={height / 2 + (units ? -6 : 4)} dominantBaseline="middle" textAnchor="middle" fontSize={fontSize}>{label}</text>
    {units && <text className="blank-paper-mark blank-paper-unit" style={ink ? { fill: ink } : undefined} x={width / 2} y={height / 2 + 32} textAnchor="middle">in</text>}
  </svg>;
}

export function PaperSetup({ paperPreset, orientation, onPreset, onOrientation }: {
  paperPreset: PaperPresetId;
  orientation: 'portrait' | 'landscape';
  onPreset: (preset: PaperPresetId) => void;
  onOrientation: (orientation: 'portrait' | 'landscape') => void;
}) {
  return <div className="blank-paper-options">
    <div className="blank-size-options" role="group" aria-label="Paper size">
      {paperPresets.map(preset => {
        const wide = preset.id !== 'square' && orientation === 'landscape';
        const width = (wide ? preset.heightMm : preset.widthMm) / 2, height = (wide ? preset.widthMm : preset.heightMm) / 2;
        return <button type="button" key={preset.id} aria-label={`${preset.title}, ${preset.detail}`} title={`${preset.title}, ${preset.detail}`} aria-pressed={paperPreset === preset.id} onClick={() => onPreset(preset.id)} className="blank-size-choice" style={{ '--paper-width': `${width}px`, '--paper-height': `${height}px` } as CSSProperties}><PaperArtwork preset={preset.id} orientation={orientation} /></button>;
      })}
    </div>
    <div className="blank-orientations" role="group" aria-label="Paper orientation">
      {(['portrait', 'landscape'] as const).map(value => <button type="button" key={value} className="blank-orientation-button" aria-label={value === 'portrait' ? 'Tall' : 'Wide'} title={value === 'portrait' ? 'Tall' : 'Wide'} disabled={paperPreset === 'square'} aria-pressed={paperPreset !== 'square' && orientation === value} onClick={() => onOrientation(value)}><svg viewBox="0 0 24 24" aria-hidden="true">{value === 'portrait' ? <rect x="6" y="2" width="12" height="20" rx="1" /> : <rect x="2" y="6" width="20" height="12" rx="1" />}</svg></button>)}
    </div>
  </div>;
}
