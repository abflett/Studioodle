import { useEffect, useState, type CSSProperties } from 'react';
import type { EditorTool } from '../editor/bridge';
import brush from '../assets/cursors/brush.svg?raw';
import bucket from '../assets/cursors/bucket.svg?raw';
import erase from '../assets/cursors/erase.svg?raw';
import select from '../assets/cursors/select.svg?raw';
import pan from '../assets/cursors/pan.svg?raw';
import grabbing from '../assets/cursors/grabbing.svg?raw';
import move from '../assets/cursors/move.svg?raw';
import point from '../assets/cursors/point.svg?raw';
import text from '../assets/cursors/text.svg?raw';

export type CursorGraphic = { svg: string; width: number; height: number; hotspot: { x: number; y: number }; fallback: string };
const graphic = (svg: string, x: number, y: number, fallback: string): CursorGraphic => ({ svg, width: 40, height: 40, hotspot: { x, y }, fallback });
// Shared artwork + hotspot metadata can also drive a future software cursor.
export const toolCursorGraphics: Record<EditorTool, CursorGraphic> = {
  brush: graphic(brush, 4, 35, 'crosshair'),
  bucket: graphic(bucket, 5, 35, 'crosshair'),
  erase: graphic(erase, 7, 32, 'crosshair'),
  select: graphic(select, 5, 3, 'default'),
  pan: graphic(pan, 20, 24, 'grab'),
};
export const draggingCursorGraphics = {
  pan: graphic(grabbing, 20, 24, 'grabbing'),
  select: graphic(move, 20, 20, 'move'),
};
function darkTheme() { return document.documentElement.dataset.theme === 'dark'; }
export function cursorImage(graphic: CursorGraphic, color: number, dark = darkTheme()) {
  const paint = `#${color.toString(16).padStart(6, '0')}`;
  return `data:image/svg+xml,${encodeURIComponent(graphic.svg.replaceAll('#233b48', dark ? '#f6f0e2' : '#304b63')
    .replaceAll('#27465a', dark ? '#b7d5ce' : '#38688d')
    .replaceAll('#fff8e9', dark ? '#293b56' : '#faf4e6')
    .replaceAll('#e3e9e4', dark ? '#344761' : '#e0e7ec')
    .replaceAll('#c5d5d0', dark ? '#8390a8' : '#acbfce')
    .replaceAll('#e4e9e4', dark ? '#8390a8' : '#acbfce')
    .replaceAll('#e9a07e', dark ? '#ddc799' : '#d6aa83')
    .replaceAll('#4caaa2', paint))}`;
}
function nativeCursor(graphic: CursorGraphic, color: number, dark = darkTheme()) {
  return `url("${cursorImage(graphic, color, dark)}") ${graphic.hotspot.x} ${graphic.hotspot.y}, ${graphic.fallback}`;
}
// Render above native resolution, then reduce once for clean edge coverage.
// Supply display densities explicitly so the OS never has to enlarge a 1x cursor.
const rendered = new WeakMap<CursorGraphic, Map<string, Promise<string>>>();
function smoothCursor(asset: CursorGraphic, color: number, dark = darkTheme()): Promise<string> {
  let colors = rendered.get(asset);
  if (!colors) { colors = new Map(); rendered.set(asset, colors); }
  const key = `${dark}:${asset.svg.includes('#4caaa2') ? color : 0}`;
  const existing = colors.get(key);
  if (existing) return existing;
  const result = new Promise<string>((resolve) => {
    const source = new Image();
    source.onerror = () => resolve(nativeCursor(asset, color, dark));
    source.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const urls = [1, 2, 3].map((density) => {
          canvas.width = asset.width * density;
          canvas.height = asset.height * density;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas unavailable');
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(source, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/png');
        });
        const hotspot = `${asset.hotspot.x} ${asset.hotspot.y}, ${asset.fallback}`;
        const densityCursor = `image-set(${urls.map((url, i) => `url("${url}") ${i + 1}x`).join(', ')}) ${hotspot}`;
        resolve(CSS.supports('cursor', densityCursor) ? densityCursor : `url("${urls[0]}") ${hotspot}`);
      } catch { resolve(nativeCursor(asset, color, dark)); }
    };
    const svg = asset.svg.replace(/width="40" height="40"/, 'width="480" height="480"');
    source.src = cursorImage({ ...asset, svg }, color, dark);
  });
  colors.set(key, result);
  if (colors.size > 32) colors.delete(colors.keys().next().value!);
  return result;
}

type ToolCursorStyle = CSSProperties & Record<'--tool-cursor' | '--tool-active-cursor', string>;
function cursorPair(tool: EditorTool) {
  const idle = toolCursorGraphics[tool];
  return [idle, tool === 'pan' || tool === 'select' ? draggingCursorGraphics[tool] : idle] as const;
}
export function toolCursorStyle(tool: EditorTool, color: number, dark = darkTheme()): ToolCursorStyle {
  const [idle, active] = cursorPair(tool);
  return { '--tool-cursor': nativeCursor(idle, color, dark), '--tool-active-cursor': nativeCursor(active, color, dark) };
}
export function useToolCursorStyle(tool: EditorTool, color: number): ToolCursorStyle {
  const [dark, setDark] = useState(darkTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(darkTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  const [ready, setReady] = useState<{ tool: EditorTool; color: number; dark: boolean; style: ToolCursorStyle }>();
  useEffect(() => {
    let current = true;
    const [idle, active] = cursorPair(tool);
    void Promise.all([smoothCursor(idle, color, dark), smoothCursor(active, color, dark)]).then(([idleCursor, activeCursor]) => {
      if (current) setReady({ tool, color, dark, style: { '--tool-cursor': idleCursor, '--tool-active-cursor': activeCursor } });
    });
    return () => { current = false; };
  }, [tool, color, dark]);
  return ready?.tool === tool && ready.color === color && ready.dark === dark ? ready.style : toolCursorStyle(tool, color, dark);
}

export const appCursorGraphics = {
  default: graphic(select, 5, 3, 'default'),
  pointer: graphic(point, 17, 3, 'pointer'),
  text: graphic(text, 20, 20, 'text'),
};
let appThemeObserver: MutationObserver | undefined;
export function applyAppCursors() {
  appThemeObserver?.disconnect();
  let generation = 0;
  const update = () => {
    const current = ++generation;
    const dark = darkTheme();
    for (const [name, asset] of Object.entries(appCursorGraphics)) {
      const property = `--app-cursor-${name}`;
      document.documentElement.style.setProperty(property, nativeCursor(asset, 0x4caaa2, dark));
      void smoothCursor(asset, 0x4caaa2, dark).then((cursor) => {
        if (current === generation) document.documentElement.style.setProperty(property, cursor);
      });
    }
  };
  update();
  appThemeObserver = new MutationObserver(update);
  appThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
