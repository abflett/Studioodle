import { useEffect, useRef } from 'react';
import { startGame } from './game/main';
import type { EditorBridge } from './editor/bridge';

export function PhaserGame({ bridge }: { bridge: EditorBridge }) {
  const parent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parent.current) return;
    const game = startGame(parent.current, bridge);
    return () => { game.destroy(true); };
  }, [bridge]);

  return <div className="canvas-host" ref={parent} role="img" aria-label="Preview of a tree. Use the color buttons to change its leaves." />;
}
