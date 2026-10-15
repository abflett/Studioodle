import { useState } from 'react';
import { PhaserGame } from '../PhaserGame';
import { createEditorBridge } from '../editor/bridge';

const colors = [
  { name: 'Sage', value: 0x87b999 },
  { name: 'Peach', value: 0xe9a07e },
  { name: 'Lavender', value: 0xb3a0d4 },
  { name: 'Sky', value: 0x86b8d4 },
  { name: 'Sunshine', value: 0xe7c46e },
];

export function App() {
  const [bridge] = useState(createEditorBridge);
  const [color, setColor] = useState(colors[0]!.value);

  return (
    <main className="studio">
      <header className="studio-header">
        <div><p className="eyebrow">A little room for imagination</p><h1>Studioodle<span>.</span></h1></div>
        <span className="preview-badge">First sketch</span>
      </header>
      <section className="workspace" aria-label="Studio preview">
        <div className="workspace-heading"><h2>Every picture starts somewhere.</h2><p>Pick a color. Give this little tree a new look.</p></div>
        <PhaserGame bridge={bridge} />
        <div className="toolbar" aria-label="Preview colors">
          <div className="swatches">
            {colors.map((item) => (
              <button key={item.name} className="swatch" aria-label={item.name} aria-pressed={color === item.value}
                style={{ backgroundColor: `#${item.value.toString(16).padStart(6, '0')}` }}
                onClick={() => { setColor(item.value); bridge.send({ type: 'set-color', color: item.value }); }} />
            ))}
          </div>
          <button className="reset" onClick={() => { setColor(colors[0]!.value); bridge.send({ type: 'reset-preview' }); }}>Start again</button>
        </div>
      </section>
      <footer>A tiny preview of things to come. Drawing, stickers, and focused coloring are still on the way.</footer>
    </main>
  );
}
