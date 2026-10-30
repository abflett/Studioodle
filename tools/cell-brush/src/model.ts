export type Point = readonly [number, number];
export const size = 100;
const stride = size + 1;
export const profileNames = ['Empty', 'Full', 'Vertical', 'Horizontal', 'Top left', 'Top right', 'Bottom right', 'Bottom left'];
export const corners: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
const edges: Point[] = [[.5, 0], [1, .5], [.5, 1], [0, .5]];

// The eight base profiles. Straight splits can reverse their colors; three-corner
// cases are the complement of one corner. Saddles combine two corner profiles.
export const profiles: Point[][] = [[], [...corners],
  [[0, 0], [.5, 0], [.5, 1], [0, 1]],
  [[0, 0], [1, 0], [1, .5], [0, .5]],
  ...corners.map((corner, i) => [corner, edges[i]!, edges[(i + 3) % 4]!]),
];

/** Clockwise corner bits, starting at top left. Edge crossings are always shared
 * midpoints. Two disconnected saddle corners leave the other color connected. */
export function polygons(mask: number): Point[][] {
  switch (mask) {
    case 0: return [];
    case 15: return [profiles[1]!];
    case 1: return [profiles[4]!];
    case 2: return [profiles[5]!];
    case 4: return [profiles[6]!];
    case 8: return [profiles[7]!];
    case 3: return [profiles[3]!];
    case 9: return [profiles[2]!];
    case 6: return [[[.5, 0], [1, 0], [1, 1], [.5, 1]]];
    case 12: return [[[0, .5], [1, .5], [1, 1], [0, 1]]];
    case 5: return [profiles[4]!, profiles[6]!];
    case 10: return [profiles[5]!, profiles[7]!];
    default: {
      const missing = [0, 1, 2, 3].find(i => !(mask & (1 << i)))!;
      return [[edges[missing]!, ...[1, 2, 3].map(n => corners[(missing + n) % 4]!), edges[(missing + 3) % 4]!]];
    }
  }
}

export class CellField {
  // Shared lattice labels, not per-cell JS objects or a growing stroke log.
  readonly labels = new Uint8Array(stride * stride);
  cell(x: number, y: number): number[] {
    const i = y * stride + x;
    return [this.labels[i]!, this.labels[i + 1]!, this.labels[i + stride + 1]!, this.labels[i + stride]!];
  }
  paint(a: Point, b: Point, radius: number, slot: number): Set<number> {
    const dirty = new Set<number>();
    const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
    for (let y = Math.max(0, Math.ceil(Math.min(a[1], b[1]) - radius)); y <= Math.min(size, Math.floor(Math.max(a[1], b[1]) + radius)); y++) {
      for (let x = Math.max(0, Math.ceil(Math.min(a[0], b[0]) - radius)); x <= Math.min(size, Math.floor(Math.max(a[0], b[0]) + radius)); x++) {
        const t = length2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length2)) : 0;
        if ((x - a[0] - t * dx) ** 2 + (y - a[1] - t * dy) ** 2 > radius * radius) continue;
        const i = y * stride + x;
        if (this.labels[i] === slot) continue;
        this.labels[i] = slot;
        for (const cy of [y - 1, y]) for (const cx of [x - 1, x]) {
          if (cx >= 0 && cy >= 0 && cx < size && cy < size) dirty.add(cy * size + cx);
        }
      }
    }
    return dirty;
  }
}

export type Patch = { slot: number; polygon: Point[] };
export function patches(labels: number[]): Patch[] {
  const colors = [...new Set(labels)].sort((a, b) => a - b);
  if (colors.length <= 2) {
    const slot = colors[1] ?? colors[0]!;
    const mask = labels.reduce((m, color, i) => m | (color === slot ? 1 << i : 0), 0);
    return polygons(mask).map(polygon => ({ slot, polygon }));
  }
  // Explicit exceptional junction: four corner quadrants. Each outer edge still
  // uses the same midpoint as binary neighbors. No unbounded per-cell geometry.
  return labels.map((slot, i) => ({ slot, polygon: [corners[i]!, edges[i]!, [.5, .5], edges[(i + 3) % 4]!] }));
}
