import { useEffect, useRef } from 'react';
import { ArrowRight, Copy, Palette } from 'lucide-react';
import { DialogHeader } from './DialogHeader';
import { PaperArtwork, PaperSetup, PaperOrientationControls } from './PaperSetup';
import { PaperColorPicker } from './PaperColorPicker';
import { closeOnBackdrop } from './dialog';
import { paperPresets, blankPageSize, presetMillimeters, aspectRatioLabel } from '../editor/paperPresets';
import type { PaperPresetId, PaperOrientation, PageSize } from '../editor/paperPresets';
import { contrastingDrawingColor, drawingColors } from '../editor/palette';
import type { EditorSetup } from '../editor/setup';
import drawingAction from '../assets/interface/start-coloring.png';

export function BlankPageSetup({ displaySize, step, onStep, paperPreset, orientation, background, onPreset, onOrientation, onBackground, onClose, onOpen }: {
  displaySize: PageSize;
  step: 'shape' | 'paper'; onStep: (step: 'shape' | 'paper') => void;
  paperPreset: PaperPresetId; orientation: PaperOrientation; background: string;
  onPreset: (preset: PaperPresetId) => void; onOrientation: (value: PaperOrientation) => void;
  onBackground: (color: string) => void; onClose: () => void; onOpen: (setup: EditorSetup) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { const modal = dialog.current; modal?.showModal(); return () => modal?.close(); }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);
  const paper = paperPresets.find(p => p.id === paperPreset)!;
  const paperLabel=paperPreset==='display'?aspectRatioLabel(displaySize,orientation):paper.detail;
  const colorName = drawingColors.find(color => color.value === parseInt(background.slice(1), 16))?.name ?? 'Custom color';
  return <dialog ref={dialog} className="setup-dialog blank-page-dialog" aria-labelledby="blank-setup-title" onCancel={onClose} onClick={event => closeOnBackdrop(event, onClose)} onAuxClick={event => { if (event.button === 2) closeOnBackdrop(event, onClose); }}>
    <div className="blank-setup-body">
      <DialogHeader id="blank-setup-title" title={step === 'shape' ? 'Paper size and orientation' : 'Paper color'} headingRef={heading} onClose={onClose} closeLabel="Close setup" back={step === 'paper' ? { label: 'Back to paper shape', onClick: () => onStep('shape') } : undefined}>
        <div className="blank-step-well" data-step={step} role="group" aria-label="Blank page setup steps">
          <button type="button" aria-label="Paper size and orientation" title="Paper size and orientation" aria-current={step === 'shape' ? 'step' : undefined} className="blank-step-button" onClick={() => onStep('shape')}><Copy aria-hidden="true" /></button>
          <button type="button" aria-label="Paper color" title="Paper color" aria-current={step === 'paper' ? 'step' : undefined} className="blank-step-button" onClick={() => onStep('paper')}><Palette aria-hidden="true" /></button>
        </div>
      </DialogHeader>
      <div className="blank-setup-content">
        {step === 'shape' ? <PaperSetup displaySize={displaySize} paperPreset={paperPreset} orientation={orientation} onPreset={onPreset} /> : <PaperColorPicker color={parseInt(background.slice(1), 16)} onChoose={color => onBackground(`#${color.toString(16).padStart(6, '0')}`)} />}
      </div>
      <footer className="wizard-footer blank-setup-footer">
        {step === 'shape' && <PaperOrientationControls orientation={orientation} onOrientation={onOrientation} />}
        {step === 'paper' && <span className="blank-paper-summary" role="img" aria-label={`${paperLabel}, ${orientation}, ${colorName} paper`}><PaperArtwork displaySize={displaySize} preset={paperPreset} orientation={orientation} color={background} /></span>}
        {step === 'shape' ? <button type="button" className="go-button blank-next-action" aria-label="Next: paper color" title="Next: paper color" onClick={() => onStep('paper')}><ArrowRight aria-hidden="true" /></button> : <button type="button" className="go-button page-draw-action blank-draw-action" aria-label="Start drawing" title="Start drawing" onClick={() => onOpen({ title: 'Blank Page', format: orientation, size: blankPageSize(paperPreset, orientation, displaySize), printSizeMm: presetMillimeters(paperPreset, orientation, displaySize), background, leafColor: contrastingDrawingColor(background) })}><img src={drawingAction} alt="" aria-hidden="true" /></button>}
      </footer>
    </div>
  </dialog>;
}
