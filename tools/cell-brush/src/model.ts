export type Point = readonly [number, number];
export const size = 100;
export const profileNames = ['Empty', 'Full', 'Vertical', 'Horizontal', 'Top left', 'Top right', 'Bottom right', 'Bottom left'];
export const profiles: Point[][] = [[], [[0, 0], [1, 0], [1, 1], [0, 1]],
  [[0, 0], [.5, 0], [.5, 1], [0, 1]],
  [[0, 0], [1, 0], [1, .5], [0, .5]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[1, 0], [1, 1], [0, 1]],
  [[0, 0], [1, 1], [0, 1]],
];

export function inProfile(profile: number, x: number, y: number): boolean {
  switch (profile) {
    case 0: return false;
    case 1: return true;
    case 2: return x < .5;
    case 3: return y < .5;
    case 4: return x + y < 1;
    case 5: return y < x;
    case 6: return x + y >= 1;
    case 7: return y >= x;
    default: throw Error('Unknown cell profile');
  }
}

// Eight-by-eight coverage probes are temporary fitting data, not saved subpixels.
// Stagger alternate rows to distribute diagonal boundary ties symmetrically.
const samples = 8, count = samples * samples;
const sampleX = Float64Array.from({ length: count }, (_, i) => (i % samples + (Math.floor(i / samples) % 2 ? .375 : .625)) / samples);
const sampleY = Float64Array.from({ length: count }, (_, i) => (Math.floor(i / samples) + .5) / samples);
const masks = profiles.map((_, profile) => Uint8Array.from({ length: count }, (_, i) => Number(inProfile(profile, sampleX[i]!, sampleY[i]!))));
type Cell = { profile: number; front: number; back: number };
type WorkingCell = { target: Uint8Array; original: Cell };

export class CellField {
  // Exactly three authoritative bytes per cell; slot zero means transparent.
  readonly profile = new Uint8Array(size * size);
  readonly front = new Uint8Array(size * size);
  readonly back = new Uint8Array(size * size);
  private working = new Map<number, WorkingCell>();
  private strokeSlot: number | undefined;

  get byteLength() { return this.profile.byteLength + this.front.byteLength + this.back.byteLength; }
  get scratchBytes() { return this.working.size * count; } // Sample buffers only; excludes Map/object overhead.
  cell(index: number): Cell { return { profile: this.profile[index]!, front: this.front[index]!, back: this.back[index]! }; }
  colorAt(x: number, y: number): number {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= size || cy >= size) return 0;
    const cell = this.cell(cy * size + cx);
    return inProfile(cell.profile, x - cx, y - cy) ? cell.front : cell.back;
  }
  beginStroke(slot: number) { this.endStroke(); this.strokeSlot = slot; }
  endStroke() { this.working.clear(); this.strokeSlot = undefined; }
  clear() { this.endStroke(); this.profile.fill(0); this.front.fill(0); this.back.fill(0); }

  private fit(index: number, working: WorkingCell, slot: number) {
    const { target, original } = working;
    const histogram = new Uint8Array(256);
    for (const color of target) histogram[color] = histogram[color]! + 1;
    // Largest surviving old color wins, preferring opaque over transparent on an
    // area tie. Color distance and palette numbering do not decide ownership.
    let retained = original.front !== slot && histogram[original.front] ? original.front :
      original.back !== slot && histogram[original.back] ? original.back : slot;
    for (let color = 0; color < histogram.length; color++) {
      if (color === slot || !histogram[color]) continue;
      if (retained === slot || histogram[color]! > histogram[retained]! ||
        (histogram[color] === histogram[retained] && retained === 0)) retained = color;
    }
    if (retained === slot) { this.profile[index] = slot ? 1 : 0; this.front[index] = slot; this.back[index] = 0; return; }
    const error = (profile: number, front: number, back: number) => {
      let result = 0;
      const mask = masks[profile]!;
      for (let i = 0; i < count; i++) if ((mask[i] ? front : back) !== target[i]) result++;
      return result;
    };
    // Existing profile wins exact ties. Do not retain a disappeared third color
    // (notably paper) as an artifact when the brush has covered it completely.
    const originalAllowed = (!original.profile || !!histogram[original.front]) &&
      (original.profile === 1 || !!histogram[original.back]);
    let best = originalAllowed ? original : { profile: 1, front: slot, back: 0 };
    let bestError = originalAllowed ? error(best.profile, best.front, best.back) : count - histogram[slot]!;
    for (let profile = 0; profile < profiles.length; profile++) {
      for (const reversed of [false, true]) {
        const front = reversed ? retained : slot, back = reversed ? slot : retained;
        const candidateError = error(profile, front, back);
        if (candidateError < bestError) { best = { profile, front, back }; bestError = candidateError; }
      }
    }
    if (best.profile === 0 || best.profile === 1 || best.front === best.back) {
      const color = best.profile === 0 ? best.back : best.front;
      best = { profile: color ? 1 : 0, front: color, back: 0 };
    }
    this.profile[index] = best.profile; this.front[index] = best.front; this.back[index] = best.back;
  }

  paint(a: Point, b: Point, radius: number, slot: number): Set<number> {
    if (this.strokeSlot !== slot) this.beginStroke(slot);
    const dirty = new Set<number>();
    const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
    const left = Math.max(0, Math.floor(Math.min(a[0], b[0]) - radius));
    const right = Math.min(size - 1, Math.floor(Math.max(a[0], b[0]) + radius));
    const top = Math.max(0, Math.floor(Math.min(a[1], b[1]) - radius));
    const bottom = Math.min(size - 1, Math.floor(Math.max(a[1], b[1]) + radius));
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const index = y * size + x, old = this.cell(index);
      let working = this.working.get(index), changed = false;
      for (let i = 0; i < count; i++) {
        const px = x + sampleX[i]!, py = y + sampleY[i]!;
        const t = length2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / length2)) : 0;
        if ((px - a[0] - t * dx) ** 2 + (py - a[1] - t * dy) ** 2 > radius * radius) continue;
        const current = working ? working.target[i]! : masks[old.profile]![i] ? old.front : old.back;
        if (current === slot) continue;
        if (!working) {
          working = { original: old, target: Uint8Array.from(masks[old.profile]!, on => on ? old.front : old.back) };
          this.working.set(index, working);
        }
        working.target[i] = slot; changed = true;
      }
      if (!changed || !working) continue;
      this.fit(index, working, slot);
      if (old.profile !== this.profile[index] || old.front !== this.front[index] || old.back !== this.back[index]) dirty.add(index);
    }
    return dirty;
  }
}
