import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Monitor, Moon, Sun, X } from 'lucide-react';
import { pictureChoices } from '../app/startup';
import type { EditorSetup, PaperFormat } from '../editor/setup';
import type { ThemePreference } from './theme';

const papers = [
  { name: 'Cream', color: '#fff5df' },
  { name: 'White', color: '#ffffff' },
  { name: 'Sky', color: '#cde6ed' },
  { name: 'Lilac', color: '#e5daf0' },
  { name: 'Night', color: '#293831' },
];
// Placeholder artwork until real saved pictures and scene packs are available.
const samples: EditorSetup[] = [
  { title: 'Garden', format: 'landscape', background: '#fff5df', leafColor: 0x87b999 },
  { title: 'Daydream', format: 'square', background: '#e5daf0', leafColor: 0xb3a0d4 },
  { title: 'Sunshine', format: 'portrait', background: '#cde6ed', leafColor: 0xe7c46e },
];

function PictureThumbnail({ picture }: { picture: EditorSetup }) {
  const clipId = useId();
  return <svg viewBox="0 0 240 150" aria-hidden="true"><defs><clipPath id={clipId}><rect width="240" height="150" rx="16" /></clipPath></defs><g clipPath={`url(#${clipId})`}><rect width="240" height="150" rx="16" fill={picture.background} /><circle cx="190" cy="34" r="15" fill="#e7c46e" /><path d="M0 125Q60 92 120 120T240 115v35H0Z" fill="#87b999" opacity=".35" /><path d="M112 81h16v48h-16Z" fill="#c99569" stroke="#46584c" strokeWidth="3" /><rect x="81" y="29" width="78" height="65" rx="28" fill={`#${picture.leafColor.toString(16).padStart(6, '0')}`} stroke="#46584c" strokeWidth="3" /></g><rect x="2.5" y="2.5" width="235" height="145" rx="13.5" fill="none" stroke="#46584c" strokeWidth="5" /></svg>;
}

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return direction === 'left' ? <ArrowLeft aria-hidden="true" /> : <ArrowRight aria-hidden="true" />;
}

type WizardStep = 'shape' | 'paper' | 'scene';

export function SelectionScreen({ onOpen, theme, onThemeChange }: {
  onOpen: (setup: EditorSetup) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  const [step, setStep] = useState<WizardStep | null>(null);
  const [format, setFormat] = useState<PaperFormat>('landscape');
  const [background, setBackground] = useState(papers[0]!.color);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);

  const dialog = useRef<HTMLDialogElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const open = step !== null;

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (open && !modal.open) modal.showModal();
    if (!open && modal.open) modal.close();
    return () => { if (modal.open) modal.close(); };
  }, [open]);
  useEffect(() => { if (step) stepHeading.current?.focus({ preventScroll: true }); }, [step]);

  const current = samples[sampleIndex]!;
  const scene = samples[sceneIndex]!;
  const stepTitle = step === 'shape' ? 'Pick a shape' : step === 'paper' ? 'Pick a paper color' : 'Pick a picture';
  const openPicture = (setup: EditorSetup) => {
    dialog.current?.close();
    onOpen(setup);
  };

  return (
    <main className="selection-screen" aria-label="Choose a picture">
      <section className="selection">
        <div className="theme-picker" role="group" aria-label="Color theme">
          {(['system', 'light', 'dark'] as const).map((value) => (
            <button key={value} aria-label={value === 'system' ? 'Follow system theme' : `${value} theme`} title={value === 'system' ? 'Follow system' : `${value === 'light' ? 'Light' : 'Dark'} theme`} aria-pressed={theme === value} onClick={() => onThemeChange(value)}>
              {value === 'system' ? <Monitor aria-hidden="true" /> : value === 'light' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
          ))}
        </div>
        <div className="choice-grid">
          {pictureChoices.filter((item) => item.id !== 'previous').map((item) => (
            <button className={`choice-card choice-${item.id}`} key={item.id}
              onClick={() => setStep(item.id === 'blank' ? 'shape' : 'scene')} aria-haspopup="dialog">
              <span className="choice-art"><img src={item.image} alt="" width="320" height="220" /></span>
              <span className="choice-label">{item.id === 'blank' ? 'Blank page' : 'Coloring page'}</span>
            </button>
          ))}
        </div>
        <section className="previous-section" aria-label="Previous pictures">

          <div className="picture-carousel">
            <button className="icon-button" aria-label="Previous preview" onClick={() => setSampleIndex((value) => (value + samples.length - 1) % samples.length)}><Arrow direction="left" /></button>
            <button className="choice-card previous-picture" aria-label={`Open example: ${current.title}`} onClick={() => onOpen(current)}><span className="choice-art"><PictureThumbnail picture={current} /></span><span className="carousel-dots" aria-hidden="true">{samples.map((sample, index) => <span key={sample.title} className={index === sampleIndex ? 'active' : ''} />)}</span><span className="choice-label">Your pictures</span></button>
            <button className="icon-button" aria-label="Next preview" onClick={() => setSampleIndex((value) => (value + 1) % samples.length)}><Arrow direction="right" /></button>
          </div>


          <p className="sr-only" role="status">Example pictures · {sampleIndex + 1} / {samples.length}</p>
        </section>
      </section>

      <dialog className="setup-dialog" ref={dialog} aria-labelledby="setup-title" onCancel={() => setStep(null)}>
        <div className="wizard">
          <header className="wizard-header">
            <div className="wizard-heading"><h2 id="setup-title" ref={stepHeading} tabIndex={-1}>{stepTitle}</h2>
              {step !== 'scene' && <div className="wizard-steps" aria-label={`Step ${step === 'shape' ? 1 : 2} of 2`}><span className={step === 'shape' ? 'active' : ''} /><span className={step === 'paper' ? 'active' : ''} /></div>}
            </div>
            <button className="icon-button" aria-label="Close setup" onClick={() => setStep(null)}><X aria-hidden="true" /></button>
          </header>
          <div className="wizard-body">
            {step === 'shape' && <div className="format-options" role="group" aria-label="Paper shape">
              {(['landscape', 'square', 'portrait'] as const).map((value) => <button key={value} aria-label={value} aria-pressed={format === value} onClick={() => setFormat(value)} className="format-button"><span className={`paper-shape paper-${value}`} /><span className="shape-label">{value === 'landscape' ? 'Wide' : value === 'portrait' ? 'Tall' : 'Square'}</span></button>)}
            </div>}
            {step === 'paper' && <div className="paper-colors" role="group" aria-label="Paper color">
              {papers.map((paper) => <button key={paper.name} className="paper-color" style={{ backgroundColor: paper.color }} aria-label={paper.name} aria-pressed={background === paper.color} onClick={() => setBackground(paper.color)}>{background === paper.color && <Check className="color-check" aria-hidden="true" />}</button>)}
            </div>}
            {step === 'scene' && <div className="scene-picker">
              <button className="icon-button" aria-label="Previous coloring page" onClick={() => setSceneIndex((value) => (value + samples.length - 1) % samples.length)}><Arrow direction="left" /></button>
              <figure><PictureThumbnail picture={scene} /><figcaption aria-live="polite">{scene.title}</figcaption></figure>
              <button className="icon-button" aria-label="Next coloring page" onClick={() => setSceneIndex((value) => (value + 1) % samples.length)}><Arrow direction="right" /></button>
            </div>}
          </div>
          <footer className="wizard-footer">
            {step === 'paper' ? <button className="icon-button" aria-label="Back to paper shape" onClick={() => setStep('shape')}><ArrowLeft aria-hidden="true" /></button> : <span />}
            <button className="go-button" onClick={() => {
              if (step === 'shape') setStep('paper');
              else openPicture(step === 'scene' ? scene : { title: 'Blank page', format, background, leafColor: 0x87b999 });
            }}>{step === 'shape' ? 'Next' : 'Let’s draw'}<ArrowRight aria-hidden="true" /></button>
          </footer>
        </div>
      </dialog>
    </main>
  );
}



