import type { ReviewClosure, ReviewPoint } from './artworkReviewModel';

export interface ReviewView { zoom: number; pan: ReviewPoint }
export function zoomReviewAt(view: ReviewView, cursorFromCenter: ReviewPoint, nextZoom: number): ReviewView {
  const zoom = Math.max(1, Math.min(16, nextZoom)), ratio = zoom / view.zoom;
  return { zoom, pan: { x: cursorFromCenter.x - (cursorFromCenter.x - view.pan.x) * ratio, y: cursorFromCenter.y - (cursorFromCenter.y - view.pan.y) * ratio } };
}
export function closurePath(line: Pick<ReviewClosure, 'a' | 'b' | 'control'>) {
  const { a, b, control } = line;
  return `M${a.x} ${a.y} ${control ? `Q${control.x} ${control.y} ` : 'L'}${b.x} ${b.y}`;
}
export function closureMidpoint(line: ReviewClosure): ReviewPoint {
  return line.control ? { x: (line.a.x + 2 * line.control.x + line.b.x) / 4, y: (line.a.y + 2 * line.control.y + line.b.y) / 4 } : { x: (line.a.x + line.b.x) / 2, y: (line.a.y + line.b.y) / 2 };
}
export type ClosureHandle = 'a' | 'b' | 'midpoint' | 'fillSeed';
export function moveClosureHandle(line: ReviewClosure, handle: ClosureHandle, point: ReviewPoint, width: number, height: number): ReviewClosure {
  const clamp = (p: ReviewPoint) => ({ x: Math.max(0, Math.min(width, p.x)), y: Math.max(0, Math.min(height, p.y)) });
  return handle === 'midpoint' ? { ...line, control: clamp({ x: 2 * point.x - (line.a.x + line.b.x) / 2, y: 2 * point.y - (line.a.y + line.b.y) / 2 }) } : { ...line, [handle]: clamp(point) };
}
