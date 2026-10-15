import { useEffect, useRef } from 'react';
import { startGame } from './game/main';
import type { EditorBridge } from './editor/bridge';
import type { EditorSetup } from './editor/setup';

export function PhaserGame({ bridge, setup }: { bridge: EditorBridge; setup: EditorSetup }) {
  const parent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parent.current) return;
    const game = startGame(parent.current, bridge, setup.leafColor);
    return () => { game.destroy(true); };
  }, [bridge, setup.leafColor]);

  return <div className="canvas-host" style={{ backgroundColor: setup.background }} ref={parent} role="img" aria-label="Preview of a tree. Use the color buttons to change its leaves." />;
}
