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
export function cursorImage(graphic: CursorGraphic, color: number) {
  const paint = `#${color.toString(16).padStart(6, '0')}`;
  const artwork = graphic.svg.replaceAll('#233b48', '#26333b')
    .replaceAll('#27465a', '#d6c49e')
    .replaceAll('#fff8e9', '#d7d8cf')
    .replaceAll('#e3e9e4', '#aebdc0')
    .replaceAll('#c5d5d0', '#9dadae')
    .replaceAll('#e4e9e4', '#b4b9b7')
    .replaceAll('#e9a07e', '#c89b78')
    .replaceAll('#4caaa2', paint);
  // A fine neutral edge separates the dark contour from dark artwork. Keep it
  // outside the silhouette so internal details and selected paint stay crisp.
  const svg = artwork.replace('shape-rendering="geometricPrecision">', `shape-rendering="geometricPrecision"><defs><filter id="cursor-edge" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="0.65" result="edge"/><feFlood flood-color="#dddcd2"/><feComposite in2="edge" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#cursor-edge)">`).replace('</svg>', '</g></svg>');
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function nativeCursor(graphic: CursorGraphic, color: number) {
  return `url("${cursorImage(graphic, color)}") ${graphic.hotspot.x} ${graphic.hotspot.y}, ${graphic.fallback}`;
}
// Render above native resolution, then reduce once for clean edge coverage.
// Supply display densities explicitly so the OS never has to enlarge a 1x cursor.
export const cursorDensities = [1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;

/** Rasterize filters at a fixed high resolution before reducing to device pixels. */
export function rasterizeCursor(source: HTMLImageElement, asset: CursorGraphic, density: number) {
  const supersampled = document.createElement('canvas');
  supersampled.width = asset.width * 12;
  supersampled.height = asset.height * 12;
  const high = supersampled.getContext('2d');
  if (!high) throw new Error('Canvas unavailable');
  high.drawImage(source, 0, 0, supersampled.width, supersampled.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(asset.width * density);
  canvas.height = Math.round(asset.height * density);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(supersampled, 0, 0, canvas.width, canvas.height);
  return canvas;
}
const rendered = new WeakMap<CursorGraphic, Map<string, Promise<string>>>();
function smoothCursor(asset: CursorGraphic, color: number): Promise<string> {
  let colors = rendered.get(asset);
  if (!colors) { colors = new Map(); rendered.set(asset, colors); }
  const key = `${asset.svg.includes('#4caaa2') ? color : 0}`;
  const existing = colors.get(key);
  if (existing) return existing;
  const result = new Promise<string>((resolve) => {
    const source = new Image();
    source.onerror = () => resolve(nativeCursor(asset, color));
    source.onload = () => {
      try {
        const urls = cursorDensities.map(density => rasterizeCursor(source, asset, density).toDataURL('image/png'));
        const hotspot = `${asset.hotspot.x} ${asset.hotspot.y}, ${asset.fallback}`;
        const densityCursor = `image-set(${urls.map((url, i) => `url("${url}") ${cursorDensities[i]}x`).join(', ')}) ${hotspot}`;
        resolve(CSS.supports('cursor', densityCursor) ? densityCursor : `url("${urls[0]}") ${hotspot}`);
      } catch { resolve(nativeCursor(asset, color)); }
    };
    const svg = asset.svg.replace(/width="40" height="40"/, 'width="480" height="480"');
    source.src = cursorImage({ ...asset, svg }, color);
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
export function toolCursorStyle(tool: EditorTool, color: number): ToolCursorStyle {
  const [idle, active] = cursorPair(tool);
  return { '--tool-cursor': nativeCursor(idle, color), '--tool-active-cursor': nativeCursor(active, color) };
}
export function useToolCursorStyle(tool: EditorTool, color: number): ToolCursorStyle {
  const [ready, setReady] = useState<{ tool: EditorTool; color: number; style: ToolCursorStyle }>();
  useEffect(() => {
    let current = true;
    const [idle, active] = cursorPair(tool);
    void Promise.all([smoothCursor(idle, color), smoothCursor(active, color)]).then(([idleCursor, activeCursor]) => {
      if (current) setReady({ tool, color, style: { '--tool-cursor': idleCursor, '--tool-active-cursor': activeCursor } });
    });
    return () => { current = false; };
  }, [tool, color]);
  return ready?.tool === tool && ready.color === color ? ready.style : toolCursorStyle(tool, color);
}

export const appCursorGraphics = {
  default: graphic(select, 5, 3, 'default'),
  pointer: graphic(point, 17, 3, 'pointer'),
  text: graphic(text, 20, 20, 'text'),
};
export function applyAppCursors() {
  for (const [name, asset] of Object.entries(appCursorGraphics)) {
    const property = `--app-cursor-${name}`;
    document.documentElement.style.setProperty(property, nativeCursor(asset, 0x4caaa2));
    void smoothCursor(asset, 0x4caaa2).then((cursor) => {
      document.documentElement.style.setProperty(property, cursor);
    });
  }
}
