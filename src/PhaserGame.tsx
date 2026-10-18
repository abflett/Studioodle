import { pictureRepository } from './app/pictures';
import { paperSize } from './editor/document';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { startGame } from './game/main';
import type { EditorBridge } from './editor/bridge';
import type { EditorSetup } from './editor/setup';

export function PhaserGame({ bridge, setup, zoom = 1, offsetX = 0, offsetY = 0, focused = false }: { bridge: EditorBridge; setup: EditorSetup; zoom?: number; offsetX?: number; offsetY?: number; focused?: boolean }) {
  const parent = useRef<HTMLDivElement>(null);
  const activeGame = useRef<ReturnType<typeof startGame> | null>(null);
  const latestZoom = useRef(zoom);
  useLayoutEffect(() => {
    latestZoom.current = zoom;
    const scale = activeGame.current?.scale;
    if (!scale) return;
    if (scale.zoom !== zoom) scale.setZoom(zoom);
    scale.updateBounds();
  }, [zoom, offsetX, offsetY]);

  useEffect(() => {
    if (!parent.current) return;
    const host = parent.current;
    let game: ReturnType<typeof startGame> | undefined;
    let disposed = false;
    const subscriptions = new Set<() => void>();
    // React's development effect replay must not leave a second game listening.
    const frame = requestAnimationFrame(() => {
      game = startGame(host, {
        ...bridge,
        subscribe(listener) {
          if (disposed) return () => {};
          const unsubscribe = bridge.subscribe((command) => { if (!disposed) listener(command); });
          subscriptions.add(unsubscribe);
          return () => { unsubscribe(); subscriptions.delete(unsubscribe); };
        },
      }, setup, latestZoom.current, picture => pictureRepository.save(picture));
      activeGame.current = game;
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      for (const unsubscribe of subscriptions) unsubscribe();
      subscriptions.clear();
      game?.destroy(true);
      activeGame.current = null;
    };
  }, [bridge, setup]);

  const size = paperSize(setup.format, setup.size);
  return <div className="canvas-host" style={{ backgroundColor: focused ? 'transparent' : setup.background, width: size.width * zoom, height: size.height * zoom }} ref={parent} role="img" aria-label="Drawing canvas. Use Brush to draw or Fill to color a sticker." />;
}



