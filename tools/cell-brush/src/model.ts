import { candidates, legacyCandidates, maskLow, maskHigh, edgeMasks, edgeDifference, pop8, pop32, sampleX, sampleY, sampleCount as count, sampleColor, inProfile } from './profiles';
import type { Point } from './profiles';
export type { Point } from './profiles';
export { profiles, profileNames, inProfile } from './profiles';
export const size = 100;
type Cell = { profile: number; front: number; back: number };
type WorkingCell = { target: Uint8Array; original: Cell };

export class CellField {
  // Exactly three authoritative bytes per cell; slot zero means transparent.
  readonly profile = new Uint8Array(size * size);
  readonly front = new Uint8Array(size * size);
  readonly back = new Uint8Array(size * size);
  private working = new Map<number, WorkingCell>();
  private strokeSlot: number | undefined;
  constructor(readonly expanded = true, public matchNeighbors = true) {}

  get byteLength() { return this.profile.byteLength + this.front.byteLength + this.back.byteLength; }
  get scratchBytes() { return this.working.size * count; } // Sample buffers only; excludes Map/object overhead.
  cell(index: number): Cell { return { profile: this.profile[index]!, front: this.front[index]!, back: this.back[index]! }; }
  colorAt(x: number, y: number): number {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= size || cy >= size) return 0;
    const cell = this.cell(cy * size + cx);
    return inProfile(cell.profile, x - cx, y - cy) ? cell.front : cell.back;
  }
  beginStroke(slot: number) { const dirty = this.endStroke(); this.strokeSlot = slot; return dirty; }
  endStroke() {
    // Final ties use the complete gesture's targets, not whichever neighbors
    // happened to be visited first. No untouched cells are written.
    const dirty = new Set<number>();
    if (this.matchNeighbors && this.strokeSlot !== undefined) for (const [index, working] of this.working) {
      const old = this.cell(index); this.fit(index, working, this.strokeSlot, true);
      if (old.profile !== this.profile[index] || old.front !== this.front[index] || old.back !== this.back[index]) dirty.add(index);
    }
    this.working.clear(); this.strokeSlot = undefined; return dirty;
  }
  clear() { this.endStroke(); this.profile.fill(0); this.front.fill(0); this.back.fill(0); }

  private fit(index: number, working: WorkingCell, slot: number, useNeighbors = false) {
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
    let slotLow = 0, slotHigh = 0, retainedLow = 0, retainedHigh = 0;
    for (let i = 0; i < count; i++) {
      if (target[i] === slot) { if (i < 32) slotLow |= 1 << i; else slotHigh |= 1 << (i - 32); }
      if (target[i] === retained) { if (i < 32) retainedLow |= 1 << i; else retainedHigh |= 1 << (i - 32); }
    }
    const error = (profile: number, front: number, back: number) => {
      let result = 0;
      for (let i = 0; i < count; i++) if (sampleColor(profile, front, back, i) !== target[i]) result++;
      return result;
    };
    const neighborColors = useNeighbors ? this.neighborColors(index) : undefined;
    const edgeCost = (profile: number, front: number, back: number) => {
      if (!neighborColors) return 0;
      let total = 0;
      for (let side = 0; side < 4; side++) {
        const colors = neighborColors[side]; if (!colors) continue;
        let wantedFront = 0, wantedBack = 0;
        for (let i = 0; i < 8; i++) {
          if (colors[i] === front) wantedFront |= 1 << i;
          if (colors[i] === back) wantedBack |= 1 << i;
        }
        const mask = edgeMasks[profile * 4 + side]!;
        total += (wantedFront | wantedBack) === 255 && front !== back ? edgeDifference[mask * 256 + wantedFront]! :
          8 - pop8[mask & wantedFront]! - pop8[(mask ^ 255) & wantedBack]!;
      }
      return total;
    };
    // Existing profile wins exact ties. Do not retain a disappeared third color
    // (notably paper) as an artifact when the brush has covered it completely.
    const hasFront = !!(maskLow[original.profile] || maskHigh[original.profile]);
    const hasBack = maskLow[original.profile] !== 0xffffffff || maskHigh[original.profile] !== 0xffffffff;
    const originalAllowed = (!hasFront || !!histogram[original.front]) && (!hasBack || !!histogram[original.back]);
    let best = originalAllowed ? original : { profile: 1, front: slot, back: 0 };
    let bestError = originalAllowed ? error(best.profile, best.front, best.back) : count - histogram[slot]!;
    let bestEdge = edgeCost(best.profile, best.front, best.back);
    for (const profile of this.expanded ? candidates : legacyCandidates) {
      for (const reversed of [false, true]) {
        const front = reversed ? retained : slot, back = reversed ? slot : retained;
        const low = maskLow[profile]!, high = maskHigh[profile]!;
        const frontLow = reversed ? retainedLow : slotLow, frontHigh = reversed ? retainedHigh : slotHigh;
        const backLow = reversed ? slotLow : retainedLow, backHigh = reversed ? slotHigh : retainedHigh;
        const candidateError = count - pop32(low & frontLow) - pop32(high & frontHigh) - pop32(~low & backLow) - pop32(~high & backHigh);
        if (candidateError > bestError) continue;
        const candidateEdge = edgeCost(profile, front, back);
        if (candidateError < bestError || candidateEdge < bestEdge) {
          best = { profile, front, back }; bestError = candidateError; bestEdge = candidateEdge;
        }
      }
    }
    if ((!maskLow[best.profile] && !maskHigh[best.profile]) ||
      (maskLow[best.profile] === 0xffffffff && maskHigh[best.profile] === 0xffffffff) || best.front === best.back) {
      const color = !maskLow[best.profile] && !maskHigh[best.profile] ? best.back : best.front;
      best = { profile: color ? 1 : 0, front: color, back: 0 };
    }
    this.profile[index] = best.profile; this.front[index] = best.front; this.back[index] = best.back;
  }

  private neighborColors(index: number): (Uint8Array | undefined)[] {
    const x = index % size, y = Math.floor(index / size);
    const neighbors = [y ? index - size : -1, x < size - 1 ? index + 1 : -1, y < size - 1 ? index + size : -1, x ? index - 1 : -1];
    return neighbors.map((neighbor, side) => {
      if (neighbor < 0) return undefined;
      const working = this.working.get(neighbor), cell = this.cell(neighbor), opposite = (side + 2) % 4;
      return Uint8Array.from({ length: 8 }, (_, i) => {
        if (working) {
          const probe = opposite === 0 ? i : opposite === 1 ? i * 8 + 7 : opposite === 2 ? 56 + i : i * 8;
          return working.target[probe]!;
        }
        return edgeMasks[cell.profile * 4 + opposite]! & (1 << i) ? cell.front : cell.back;
      });
    });
  }

  paint(a: Point, b: Point, radius: number, slot: number): Set<number> {
    const dirty = this.strokeSlot !== slot ? this.beginStroke(slot) : new Set<number>();
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
        const current = working ? working.target[i]! : sampleColor(old.profile, old.front, old.back, i);
        if (current === slot) continue;
        if (!working) {
          working = { original: old, target: Uint8Array.from({ length: count }, (_, sample) => sampleColor(old.profile, old.front, old.back, sample)) };
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
