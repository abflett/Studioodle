import type { Point } from './profiles';

export type Interval = readonly [number, number];
export type EdgeRun = { from: number; to: number; color: number };
export type StrokeEdge = { start: Point; horizontal: boolean; runs: EdgeRun[]; crossings?: { color: number; positions: number[] } };
const epsilon = 1e-10;
export const snapQuarter = (position: number) => Math.max(0, Math.min(1, Math.floor(position * 4 + .5 + 1e-9) / 4));

/** Analytic intersection of a unit grid edge with a round-capped segment.
 * Intersect the swept rectangle and its two circular caps, not center samples. */
export function capsuleInterval(start: Point, horizontal: boolean, a: Point, b: Point, radius: number): Interval | undefined {
  const intervals: Interval[] = [];
  const add = (lo: number, hi: number) => {
    lo = Math.max(0, lo); hi = Math.min(1, hi);
    if (hi - lo > epsilon) intervals.push([lo, hi]);
  };
  for (const center of [a, b]) {
    const along = horizontal ? center[0] - start[0] : center[1] - start[1];
    const across = horizontal ? center[1] - start[1] : center[0] - start[0];
    const squared = radius * radius - across * across;
    if (squared > epsilon) { const extent = Math.sqrt(squared); add(along - extent, along + extent); }
  }
  const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
  if (length2 > epsilon) {
    let lo = 0, hi = 1;
    const clip = (value: number, rate: number, min: number, max: number) => {
      if (Math.abs(rate) < epsilon) { if (value < min - epsilon || value > max + epsilon) hi = -1; return; }
      const first = (min - value) / rate, second = (max - value) / rate;
      lo = Math.max(lo, Math.min(first, second)); hi = Math.min(hi, Math.max(first, second));
    };
    const x = start[0] - a[0], y = start[1] - a[1], extent = radius * Math.sqrt(length2);
    clip(x * dx + y * dy, horizontal ? dx : dy, 0, length2);
    clip(x * dy - y * dx, horizontal ? dy : -dx, -extent, extent);
    add(lo, hi);
  }
  if (!intervals.length) return;
  // A capsule is convex, so its intersection with this edge is one interval.
  return [Math.min(...intervals.map(interval => interval[0])), Math.max(...intervals.map(interval => interval[1]))];
}

/** Replace covered edge intervals and merge adjacent colors; no stroke log. */
export function paintRuns(runs: EdgeRun[], interval: Interval, color: number): EdgeRun[] {
  const [lo, hi] = interval, result: EdgeRun[] = [];
  const append = (from: number, to: number, value: number) => {
    if (to - from < epsilon) return;
    const last = result.at(-1);
    if (last?.color === value && Math.abs(last.to - from) < epsilon) last.to = to;
    else result.push({ from, to, color: value });
  };
  for (const run of runs) {
    if (run.to <= lo || run.from >= hi) append(run.from, run.to, run.color);
    else {
      append(run.from, Math.min(run.to, lo), run.color);
      append(Math.max(run.from, lo), Math.min(run.to, hi), color);
      append(Math.max(run.from, hi), run.to, run.color);
    }
  }
  return result.length === runs.length && result.every((run, i) => run.color === runs[i]!.color && Math.abs(run.from - runs[i]!.from) < epsilon && Math.abs(run.to - runs[i]!.to) < epsilon) ? runs : result;
}

export function edgeColor(edge: StrokeEdge, t: number): number {
  return edge.runs.find(run => t >= run.from && t < run.to)?.color ?? edge.runs.at(-1)!.color;
}

/** Clockwise outline crossings, snapped once per shared edge. Corner transitions
 * are positions too, not contradictory 'painted edge' constraints. */
export function cellCrossings(edges: StrokeEdge[], slot: number): Point[] {
  const crossings: Point[] = [];
  const point = (side: number, t: number): Point => side === 0 ? [t, 0] : side === 1 ? [1, t] : side === 2 ? [t, 1] : [0, t];
  for (let side = 0; side < 4; side++) {
    const edge = edges[side]!, runs = edge.runs;
    if (edge.crossings?.color !== slot) edge.crossings = {
      color: slot,
      positions: runs.slice(1).filter((run, i) => (run.color === slot) !== (runs[i]!.color === slot)).map(run => snapQuarter(run.from)),
    };
    const positions = side < 2 ? edge.crossings.positions : [...edge.crossings.positions].reverse();
    for (const position of positions) crossings.push(point(side, position));
    const next = edges[(side + 1) % 4]!;
    const end = side < 2 ? runs.at(-1)!.color : runs[0]!.color;
    const after = side + 1 < 2 || side === 3 ? next.runs[0]!.color : next.runs.at(-1)!.color;
    if ((end === slot) !== (after === slot)) crossings.push(point(side, side < 2 ? 1 : 0));
  }
  // A tiny arc can enter/leave through the same rounded corner. Its two crossings
  // cancel, rather than manufacturing an inverted triangle.
  const counts = new Map<number, number>();
  for (const [x, y] of crossings) { const key = y * 20 + x * 4; counts.set(key, (counts.get(key) ?? 0) + 1); }
  return crossings.filter(([x, y]) => {
    const key = y * 20 + x * 4, n = counts.get(key) ?? 0;
    counts.delete(key); return n % 2 === 1;
  });
}

export function cutKey(a: Point, b: Point): number {
  const first = Math.round(a[1] * 4) * 5 + Math.round(a[0] * 4);
  const second = Math.round(b[1] * 4) * 5 + Math.round(b[0] * 4);
  return Math.min(first, second) * 25 + Math.max(first, second);
}
