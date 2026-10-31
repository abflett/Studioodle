import type { CSSProperties } from 'react';
import { paperPresets, presetMillimeters, aspectRatioLabel } from '../editor/paperPresets';
import type { PaperPresetId, PaperOrientation, PageSize } from '../editor/paperPresets';
import { contrastingDrawingColor } from '../editor/palette';

export function PaperArtwork({ displaySize, preset, orientation, color }: { displaySize: PageSize; preset: PaperPresetId; orientation: PaperOrientation; color?: string }) {
  const {width,height}=presetMillimeters(preset,orientation,displaySize);
  const fold=Math.min(24,width*.12),units=preset==='photo';
  const label=preset==='display'?aspectRatioLabel(displaySize,orientation):preset==='full'?'A4':preset==='half'?'A5':orientation==='square'?'4 \u00d7 4':'4 \u00d7 6';
  const fontSize=preset==='full'?64:preset==='half'?50:preset==='photo'?32:Math.min(width,height)*.27;
  const ink = color ? `#${contrastingDrawingColor(color).toString(16).padStart(6, '0')}` : undefined;
  return <svg className="blank-paper-art" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    <path className="blank-paper-face" style={color ? { fill: color } : undefined} d={`M1 1H${width - fold}L${width - 1} ${fold}V${height - 1}H1Z`} />
    <path className="blank-paper-fold" d={`M${width - fold} 1V${fold}H${width - 1}Z`} />
    <text className="blank-paper-mark" style={ink ? { fill: ink } : undefined} x={width / 2} y={height / 2 + (units ? -6 : 4)} dominantBaseline="middle" textAnchor="middle" fontSize={fontSize}>{label}</text>
    {units && <text className="blank-paper-mark blank-paper-unit" style={ink ? { fill: ink } : undefined} x={width / 2} y={height / 2 + 32} textAnchor="middle">in</text>}
  </svg>;
}

export function PaperSetup({ displaySize, paperPreset, orientation, onPreset, onOrientation }: {
  displaySize: PageSize;
  paperPreset: PaperPresetId;
  orientation: PaperOrientation;
  onPreset: (preset: PaperPresetId) => void;
  onOrientation: (orientation: PaperOrientation) => void;
}) {
  return <div className="blank-paper-options">
    <div className="blank-size-options" role="group" aria-label="Paper size">
      {paperPresets.map(preset => {
        const dimensions=presetMillimeters(preset.id,orientation,displaySize);
        const scale=Math.min(.5,190/Math.max(dimensions.width,dimensions.height));
        const width=dimensions.width*scale,height=dimensions.height*scale;
        const detail=preset.id==='display'?aspectRatioLabel(displaySize,orientation):preset.detail;
        return <button type="button" key={preset.id} aria-label={`${preset.title}, ${detail}`} title={`${preset.title}, ${detail}`} aria-pressed={paperPreset === preset.id} onClick={() => onPreset(preset.id)} className="blank-size-choice" style={{ '--paper-width': `${width}px`, '--paper-height': `${height}px` } as CSSProperties}><PaperArtwork displaySize={displaySize} preset={preset.id} orientation={orientation} /></button>;
      })}
    </div>
    <div className="blank-orientations" role="group" aria-label="Paper orientation">
      {(['portrait', 'landscape', 'square'] as const).map(value => <button type="button" key={value} className="blank-orientation-button" aria-label={value === 'portrait' ? 'Tall' : value === 'landscape' ? 'Wide' : 'Square'} title={value === 'portrait' ? 'Tall' : value === 'landscape' ? 'Wide' : 'Square'} aria-pressed={orientation === value} onClick={() => onOrientation(value)}><svg viewBox="0 0 24 24" aria-hidden="true">{value === 'portrait' ? <rect x="6" y="2" width="12" height="20" rx="1" /> : <rect x={value === 'square' ? 4 : 2} y={value === 'square' ? 4 : 6} width={value === 'square' ? 16 : 20} height={value === 'square' ? 16 : 12} rx="1" />}</svg></button>)}
    </div>
  </div>;
}
