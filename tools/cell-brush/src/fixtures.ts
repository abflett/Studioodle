import type { Point } from './profiles';
export type CurveKind = 'arc' | 'spiral' | 'tightening' | 'boundary';
export type CurveOptions = { jitter?: number; seed?: number; retrace?: boolean };
/** Seeded input noise is repeatable, independent of event batching or wall time. */
export function thinCurve(kind: CurveKind, offset: number | Point = 0, steps = 240, options: CurveOptions = {}): Point[] {
  let state = (options.seed ?? 1) >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const phase: Point = typeof offset === 'number' ? [offset, offset] : offset;
  let x = 18, y = 65, heading = -.8;
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const angle = kind === 'arc' ? Math.PI + fraction * Math.PI : fraction * Math.PI * 5;
    const radius = kind === 'arc' ? 26 : 3 + fraction * 26;
    let base: Point = [50 + Math.cos(angle) * radius, (kind === 'arc' ? 64 : 50) + Math.sin(angle) * radius];
    if (kind === 'tightening') {
      if (i) {
        const distance = 80 / steps;
        heading += (.003 + .14 * fraction * fraction) * distance;
        x += Math.cos(heading) * distance; y += Math.sin(heading) * distance;
      }
      base = [x, y];
    } else if (kind === 'boundary') base = [20 + 60 * fraction, 50 + Math.sin(fraction * Math.PI * 12) * .035];
    const jitter = options.jitter ?? 0;
    const next: Point = [base[0] + phase[0] + (random() * 2 - 1) * jitter, base[1] + phase[1] + (random() * 2 - 1) * jitter];
    const previous = points.at(-1);
    points.push(next);
    if (options.retrace && previous && i % 29 === 0) points.push(previous, next);
    if (options.retrace && i % 17 === 0) points.push(next);
  }
  return points;
}
