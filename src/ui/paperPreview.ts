import type { Artwork } from '../editor/Artwork';

type Point = readonly [number, number];
/** Clockwise corners and cubic edge controls, normalized to the paper illustration. */
export type PaperSurface = {
  corners: readonly [Point, Point, Point, Point];
  top: readonly [Point, Point]; right: readonly [Point, Point];
  bottom: readonly [Point, Point]; left: readonly [Point, Point];
};
const curve = (a: Point, b: Point, c: Point, d: Point, t: number): Point => {
  const s = 1 - t;
  return [s ** 3 * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t ** 3 * d[0],
    s ** 3 * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t ** 3 * d[1]];
};
function at(surface: PaperSurface, u: number, v: number, w: number, h: number): Point {
  const [a, b, c, d] = surface.corners;
  const top = curve(a, ...surface.top, b, u), bottom = curve(d, ...surface.bottom, c, u);
  const left = curve(a, ...surface.left, d, v), right = curve(b, ...surface.right, c, v);
  const coordinate = (i: 0 | 1) => (1 - v) * top[i] + v * bottom[i] + (1 - u) * left[i] + u * right[i]
    - ((1 - u) * (1 - v) * a[i] + u * (1 - v) * b[i] + u * v * c[i] + (1 - u) * v * d[i]);
  return [coordinate(0) * w, coordinate(1) * h];
}
export function paperFacePath(surface: PaperSurface, w: number, h: number) {
  const [a, b, c, d] = surface.corners;
  const path = new Path2D(); path.moveTo(a[0] * w, a[1] * h);
  const edge = (controls: readonly [Point, Point], end: Point) => path.bezierCurveTo(controls[0][0] * w, controls[0][1] * h, controls[1][0] * w, controls[1][1] * h, end[0] * w, end[1] * h);
  edge(surface.top, b); edge(surface.right, c);
  edge([surface.bottom[1], surface.bottom[0]], d); edge([surface.left[1], surface.left[0]], a);
  path.closePath(); return path;
}
function triangle(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, points: readonly [Point, Point, Point], x: number, y: number, dx: number, dy: number) {
  const [p, q, r] = points;
  const lp = Math.hypot(q[0] - r[0], q[1] - r[1]), lq = Math.hypot(p[0] - r[0], p[1] - r[1]), lr = Math.hypot(p[0] - q[0], p[1] - q[1]);
  const perimeter = lp + lq + lr;
  const cx = (lp * p[0] + lq * q[0] + lr * r[0]) / perimeter, cy = (lp * p[1] + lq * q[1] + lr * r[1]) / perimeter;
  const radius = Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / perimeter;
  const expansion = 1 + 1 / Math.max(radius, .001);
  ctx.save(); ctx.beginPath();
  // Subpixel overlap avoids antialiased cracks between adjacent pieces of the same image.
  points.forEach(([px, py], i) => {
    const xx = cx + (px - cx) * expansion, yy = cy + (py - cy) * expansion;
    if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
  });
  ctx.closePath(); ctx.clip();
  const a = (q[0] - p[0]) / dx, b = (q[1] - p[1]) / dx;
  const c = (r[0] - p[0]) / dy, d = (r[1] - p[1]) / dy;
  ctx.setTransform(a, b, c, d, p[0] - a * x - c * y, p[1] - b * x - d * y);
  ctx.drawImage(source, 0, 0); ctx.restore();
}
/** Map the complete picture once to the bowed face. Never copy or extend boundary pixels. */
export function drawPaperPreview(ctx: CanvasRenderingContext2D, artwork: Artwork, surface: PaperSurface, source: HTMLCanvasElement) {
  const { width: w, height: h } = ctx.canvas;
  const sourceHeight = Math.max(1, Math.round(w * artwork.size.height / artwork.size.width));
  if (source.width !== w) source.width = w;
  if (source.height !== sourceHeight) source.height = sourceHeight;
  const original = source.getContext('2d')!;
  original.setTransform(source.width / artwork.size.width, 0, 0, source.height / artwork.size.height, 0, 0);
  artwork.render(original, true);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
  ctx.save(); ctx.clip(paperFacePath(surface, w, h));
  const steps = 10, dx = source.width / steps, dy = source.height / steps;
  const grid = Array.from({ length: steps + 1 }, (_, row) => Array.from({ length: steps + 1 }, (_, col) => at(surface, col / steps, row / steps, w, h)));
  for (let row = 0; row < steps; row++) for (let col = 0; col < steps; col++) {
    const a = grid[row]![col]!, b = grid[row]![col + 1]!, c = grid[row + 1]![col + 1]!, d = grid[row + 1]![col]!;
    triangle(ctx, source, [a, b, d], col * dx, row * dy, dx, dy);
    triangle(ctx, source, [c, d, b], (col + 1) * dx, (row + 1) * dy, -dx, -dy);
  }
  ctx.restore();
}
