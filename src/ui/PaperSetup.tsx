import { paperPresets } from '../editor/paperPresets';
import type { PaperPresetId } from '../editor/paperPresets';

export function PaperSetup({ paperPreset, orientation, onPreset, onOrientation }: {
  paperPreset: PaperPresetId;
  orientation: 'portrait' | 'landscape';
  onPreset: (preset: PaperPresetId) => void;
  onOrientation: (orientation: 'portrait' | 'landscape') => void;
}) {
  return <div className="paper-setup">
    <div className="format-options" role="group" aria-label="Paper size">
      {paperPresets.map(preset => <button key={preset.id} aria-label={`${preset.title}, ${preset.detail}`} aria-pressed={paperPreset === preset.id} onClick={() => onPreset(preset.id)} className="format-button"><span className={`paper-shape paper-${preset.id === 'square' ? 'square' : orientation} preset-${preset.id}`} /><span className="shape-label">{preset.title}<small>{preset.detail}</small></span></button>)}
    </div>
    <div className="paper-orientation" role="group" aria-label="Paper orientation">
      {(['portrait', 'landscape'] as const).map(value => <button key={value} className="format-button" disabled={paperPreset === 'square'} aria-pressed={paperPreset !== 'square' && orientation === value} onClick={() => { onOrientation(value); }}><span className={`orientation-icon paper-${value}`} />{value === 'portrait' ? 'Tall' : 'Wide'}</button>)}
    </div>
  </div>;
}
