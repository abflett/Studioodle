import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { PhaserGame } from '../PhaserGame';
import { createEditorBridge } from '../editor/bridge';
import type { EditorSetup } from '../editor/setup';

const colors = [
  { name: 'Sage', value: 0x87b999 },
  { name: 'Peach', value: 0xe9a07e },
  { name: 'Lavender', value: 0xb3a0d4 },
  { name: 'Sky', value: 0x86b8d4 },
  { name: 'Sunshine', value: 0xe7c46e },
];

export default function EditorPreview({ setup, onBack }: { setup: EditorSetup; onBack: () => void }) {
  const [bridge] = useState(createEditorBridge);
  const [color, setColor] = useState(setup.leafColor);
  const backButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { backButton.current?.focus({ preventScroll: true }); }, []);

  return (
    <main className="studio" aria-label={setup.title}>
      <header className="studio-header">
        <button className="icon-button" ref={backButton} onClick={onBack} aria-label="Back to picture selection"><ArrowLeft aria-hidden="true" /></button>
      </header>
      <section className="workspace" aria-label="Studio preview">
        <div className={`paper-stage stage-${setup.format}`}><PhaserGame bridge={bridge} setup={setup} /></div>
        <div className="toolbar" aria-label="Preview colors">
          <div className="swatches">
            {colors.map((item) => (
              <button key={item.name} className="swatch" aria-label={item.name} aria-pressed={color === item.value}
                style={{ backgroundColor: `#${item.value.toString(16).padStart(6, '0')}` }}
                onClick={() => { setColor(item.value); bridge.send({ type: 'set-color', color: item.value }); }} />
            ))}
          </div>
          <button className="icon-button" aria-label="Reset picture colors" onClick={() => { setColor(setup.leafColor); bridge.send({ type: 'reset-preview' }); }}><RotateCcw aria-hidden="true" /></button>
        </div>
      </section>
    </main>
  );
}
