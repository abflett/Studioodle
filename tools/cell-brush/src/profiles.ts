export type Point = readonly [number, number];
type Polygon = Point[];
const square: Polygon = [[0, 0], [1, 0], [1, 1], [0, 1]];
const rectangle = (left: number, top: number, right: number, bottom: number): Polygon => [[left, top], [right, top], [right, bottom], [left, bottom]];
function split(nx: number, ny: number, threshold: number): Polygon {
  const result: Polygon = [];
  for (let i = 0; i < square.length; i++) {
    const a = square[i]!, b = square[(i + 1) % square.length]!;
    const da = nx * a[0] + ny * a[1] - threshold, db = nx * b[0] + ny * b[1] - threshold;
    if (da <= 0) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db); result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}
function band(slope: number, halfWidth: number): Polygon {
  // Clipped parallel half-planes, without a polygon-clipping dependency.
  let polygon = split(-slope, 1, .5 - slope * .5 + halfWidth);
  const result: Polygon = [], threshold = .5 - slope * .5 - halfWidth;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    const da = a[1] - slope * a[0] - threshold, db = b[1] - slope * b[0] - threshold;
    if (da >= 0) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db); result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  polygon = result;
  return polygon;
}
const arc = (cx: number, cy: number, radius: number, start: number, end: number, steps = 24): Polygon =>
  Array.from({ length: steps + 1 }, (_, i) => { const a = start + (end - start) * i / steps; return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius] as Point; });

export const profileNames = [
  'Empty', 'Full', 'Half split', 'Quarter split',
  'Slope 1:1', 'Slope 1:2', 'Slope 1:3', 'Slope 2:3',
  'Corner 1:1', 'Corner 1:2', 'Corner 1:3', 'Corner 2:3',
  'Thin band', 'Wide band', 'Diagonal band', 'Shallow band',
  'Narrow taper', 'Wide taper', 'Thin elbow', 'Wide elbow',
  'Thin V', 'Wide V', 'Beveled cap', 'Shoulder',
  'Square dot', 'Diamond dot', 'Octagon dot', 'Offset square',
  'Offset diamond', 'Half circle', 'Quarter circle', 'Round cap',
];
export const profiles: Polygon[] = [
  [], square, split(1, 0, .5), split(1, 0, .25),
  split(1, 1, 1), split(1, 2, 1.5), split(1, 3, 2), split(2, 3, 2.5),
  split(1, 1, .5), split(1, 2, 1), split(1, 3, 1), split(2, 3, 1.5),
  rectangle(0, .375, 1, .625), rectangle(0, .25, 1, .75), band(1, .18), band(.5, .14),
  [[0, .375], [1, .5], [0, .625]], [[0, .125], [1, .5], [0, .875]],
  [[0, 0], [.25, 0], [.25, .75], [1, .75], [1, 1], [0, 1]],
  [[0, 0], [.5, 0], [.5, .5], [1, .5], [1, 1], [0, 1]],
  [[0, .125], [.5, .75], [1, .125], [1, .375], [.5, 1], [0, .375]],
  [[0, 0], [.5, .5], [1, 0], [1, .5], [.5, 1], [0, .5]],
  [[0, .25], [.625, .25], [.875, .5], [.625, .75], [0, .75]],
  [[0, .25], [.5, .25], [.5, .5], [1, .5], [1, 1], [0, 1]],
  rectangle(.25, .25, .75, .75), [[.5, .125], [.875, .5], [.5, .875], [.125, .5]],
  Array.from({ length: 8 }, (_, i): Point => { const a = Math.PI / 8 + i * Math.PI / 4; return [.5 + Math.cos(a) * .375, .5 + Math.sin(a) * .375]; }),
  rectangle(.125, .125, .5, .5), [[.3125, .0625], [.5625, .3125], [.3125, .5625], [.0625, .3125]],
  arc(.5, .5, .5, 0, Math.PI), [[0, 0], ...arc(0, 0, 1, 0, Math.PI / 2)],
  [[0, .25], [.5, .25], ...arc(.5, .5, .25, -Math.PI / 2, Math.PI / 2), [0, .75]],
];

// Code layout: base[0..4], quarter-turn[5..6], mirror[7]. All runtime geometry
// and fitting masks are prepared once; the renderer never transforms per-vertex.
export function transformPoint([x, y]: Point, code: number): Point {
  if (code & 128) x = 1 - x;
  for (let rotation = (code >> 5) & 3; rotation > 0; rotation--) [x, y] = [1 - y, x];
  return [x, y];
}
export const variants = Array.from({ length: 256 }, (_, code) => profiles[code & 31]!.map(point => transformPoint(point, code)));
function contains(polygon: Polygon, x: number, y: number) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export const inProfile = (code: number, x: number, y: number) => contains(variants[code]!, x, y);
export const sampleCount = 64;
// Bits: increasing/decreasing in X, increasing/decreasing in Y. These describe
// coverage, so swapping colors reverses the directional tests.
export function monotonicity(sample: (i: number) => boolean): number {
  let flags = 15;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const here = sample(y * 8 + x);
    if (x < 7) {
      const next = sample(y * 8 + x + 1);
      if (here && !next) flags &= ~1;
      if (!here && next) flags &= ~2;
    }
    if (y < 7) {
      const next = sample((y + 1) * 8 + x);
      if (here && !next) flags &= ~4;
      if (!here && next) flags &= ~8;
    }
  }
  return flags;
}
export const reverseMonotonicity = (flags: number) => ((flags & 1) << 1) | ((flags & 2) >> 1) | ((flags & 4) << 1) | ((flags & 8) >> 1);
export const sampleX = Float64Array.from({ length: sampleCount }, (_, i) => (i % 8 + (Math.floor(i / 8) % 2 ? .375 : .625)) / 8);
export const sampleY = Float64Array.from({ length: sampleCount }, (_, i) => (Math.floor(i / 8) + .5) / 8);
export const maskLow = new Uint32Array(256), maskHigh = new Uint32Array(256);
export const edgeMasks = new Uint8Array(256 * 4);
export const fineEdgeMasks = new Uint32Array(256 * 4);
export const directionFlags = new Uint8Array(256);
export const pop8 = Uint8Array.from({ length: 256 }, (_, n) => { let count = 0; for (; n; n &= n - 1) count++; return count; });
export const edgeDifference = new Uint8Array(256 * 256);
export const pop32 = (n: number) => pop8[n & 255]! + pop8[(n >>> 8) & 255]! + pop8[(n >>> 16) & 255]! + pop8[n >>> 24]!;
for (let code = 0; code < 256; code++) {
  for (let i = 0; i < sampleCount; i++) if (inProfile(code, sampleX[i]!, sampleY[i]!)) {
    if (i < 32) maskLow[code] = (maskLow[code]! | (1 << i)) >>> 0;
    else maskHigh[code] = (maskHigh[code]! | (1 << (i - 32))) >>> 0;
  }
  for (let i = 0; i < 8; i++) {
    const t = (i + .5) / 8, epsilon = .000001;
    const points: Point[] = [[t, epsilon], [1 - epsilon, t], [t, 1 - epsilon], [epsilon, t]];
    points.forEach(([x, y], side) => { if (inProfile(code, x, y)) edgeMasks[code * 4 + side] = edgeMasks[code * 4 + side]! | (1 << i); });
  }
  directionFlags[code] = monotonicity(i => !!sampleColor(code, 1, 0, i));
  for (let i = 0; i < 32; i++) {
    const t = (i + .5) / 32, epsilon = .000001;
    const points: Point[] = [[t, epsilon], [1 - epsilon, t], [t, 1 - epsilon], [epsilon, t]];
    points.forEach(([x, y], side) => { if (inProfile(code, x, y)) fineEdgeMasks[code * 4 + side] = (fineEdgeMasks[code * 4 + side]! | (1 << i)) >>> 0; });
  }
}
for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) edgeDifference[a * 256 + b] = pop8[a ^ b]!;

// Keep the authored dictionary at 32, but don't score identical sample masks
// repeatedly. Retain edge-distinct variants even when interior probes coincide.
const seen = new Set<string>();
export const candidates = variants.map((_, code) => code).filter(code => {
  const key = `${maskLow[code]},${maskHigh[code]}:${fineEdgeMasks.slice(code * 4, code * 4 + 4).join(',')}`;
  if (seen.has(key)) return false;
  seen.add(key); return true;
});
export const legacyCandidates = [0, 1, 2, 34, 4, 36, 68, 100];
export const numericLookupBytes = sampleX.byteLength + sampleY.byteLength + maskLow.byteLength + maskHigh.byteLength + edgeMasks.byteLength + fineEdgeMasks.byteLength + directionFlags.byteLength + pop8.byteLength + edgeDifference.byteLength;
export function sampleColor(code: number, front: number, back: number, i: number): number {
  const on = i < 32 ? maskLow[code]! & (1 << i) : maskHigh[code]! & (1 << (i - 32));
  return on ? front : back;
}
