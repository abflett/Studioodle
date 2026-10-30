import type { Point } from './profiles';
export type CurveKind = 'arc' | 'spiral';
/** Deterministic one-cell brush fixtures; only the grid phase changes. */
export function thinCurve(kind: CurveKind, offset = 0, steps = 240): Point[] {
  return Array.from({ length: steps + 1 }, (_, i): Point => {
    const fraction = i / steps;
    const angle = kind === 'arc' ? Math.PI + fraction * Math.PI : fraction * Math.PI * 5;
    const radius = kind === 'arc' ? 26 : 3 + fraction * 26;
    return [50 + offset + Math.cos(angle) * radius, (kind === 'arc' ? 64 : 50) + offset + Math.sin(angle) * radius];
  });
}
