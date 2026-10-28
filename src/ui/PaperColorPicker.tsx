import { Check } from 'lucide-react';
import { drawingColors } from '../editor/palette';

/** Paper backgrounds are literal RGB, independent of a drawing's linked palette. */
export function PaperColorPicker({ color, onChoose }: { color: number; onChoose: (color: number) => void }) {
  return <div className="color-picker"><div className="art-colors" role="group" aria-label="Canvas background colors">
    {drawingColors.map(item => <button type="button" className="paper-color" key={item.name} aria-label={item.name} title={item.name} aria-pressed={color === item.value} style={{ backgroundColor: `#${item.value.toString(16).padStart(6, '0')}` }} onClick={() => onChoose(item.value)}>
      {color === item.value && <Check className="color-check" aria-hidden="true" />}
    </button>)}
  </div></div>;
}
