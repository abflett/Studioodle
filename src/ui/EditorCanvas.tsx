import { useEffect, useLayoutEffect, useRef } from 'react';
import { pictureRepository } from '../app/pictures';
import { CanvasEditor } from '../canvas/CanvasEditor';
import { paperSize } from '../editor/document';
import type { EditorBridge } from '../editor/bridge';
import type { EditorSetup } from '../editor/setup';

type Props = { bridge: EditorBridge; setup: EditorSetup; zoom: number; offsetX: number; offsetY: number; focused: boolean };

export function EditorCanvas({ bridge, setup, zoom, offsetX, offsetY, focused }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<CanvasEditor | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const active = new CanvasEditor(host.current, bridge, setup, picture => pictureRepository.save(picture));
    editor.current = active;
    return () => { active.destroy(); editor.current = null; };
  }, [bridge, setup]);
  useLayoutEffect(() => { editor.current?.invalidate(); }, [zoom, offsetX, offsetY, focused]);
  const size = paperSize(setup.format, setup.size);
  return <div ref={host} className="canvas-host" style={{ backgroundColor: focused ? 'transparent' : setup.background, width: size.width * zoom, height: size.height * zoom }} role="img" aria-label="Drawing canvas. Use Brush to draw or Fill to color a sticker." />;
}
