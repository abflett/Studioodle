import { candidates, legacyCandidates, maskLow, maskHigh, fineEdgeMasks, edgeDifference, pop32, sampleX, sampleY, sampleCount as count, sampleColor, inProfile, monotonicity, directionFlags, reverseMonotonicity } from './profiles';
import type { Point } from './profiles';
export type { Point } from './profiles';
export { profiles, profileNames, inProfile } from './profiles';
export const size = 100;
type Cell = { profile: number; front: number; back: number };
type WorkingCell = { target: Uint8Array; original: Cell };
const edgeWeight = 4;
const joinPasses = 6;

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
    const dirty = new Set<number>();
    if (this.matchNeighbors && this.strokeSlot !== undefined) {
      const indices = [...this.working.keys()].sort((a, b) => a - b);
      const refit = (index: number, neighbors: boolean) => {
        const old = this.cell(index); this.fit(index, this.working.get(index)!, this.strokeSlot!, neighbors);
        const changed = old.profile !== this.profile[index] || old.front !== this.front[index] || old.back !== this.back[index];
        if (changed) dirty.add(index); return changed;
      };
      // Start from the complete gesture's independent fits in stable order. Then
      // minimize coverage + actual shared-edge disagreement, not target-edge ties.
      // Only active-stroke cells can change; untouched neighbors are constraints.
      for (const index of indices) refit(index, false);
      for (let pass = 0; pass < joinPasses; pass++) {
        let changed = false;
        for (let n = 0; n < indices.length; n++) {
          const index = indices[pass % 2 ? indices.length - 1 - n : n]!;
          changed = refit(index, true) || changed;
        }
        if (!changed) break;
      }
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
    const targetDirection = monotonicity(i => target[i] === slot);
    const simpleBoundary = !!(targetDirection & 3) && !!(targetDirection & 12);
    const followsDirection = (profile: number, front: number, back: number) => {
      // A locally monotone boundary uses a split/wedge, not a dot, elbow or
      // rounded cap that happens to win a few probes and adds repeated scallops.
      if (simpleBoundary && (profile & 31) > 11) return false;
      const flags = front === slot ? directionFlags[profile]! : back === slot ? reverseMonotonicity(directionFlags[profile]!) : 15;
      return (flags & targetDirection) === targetDirection;
    };
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
    const neighborBits = neighborColors?.map(colors => {
      if (!colors) return undefined;
      const bits = new Map<number, number>();
      for (let i = 0; i < 32; i++) bits.set(colors[i]!, ((bits.get(colors[i]!) ?? 0) | (1 << i)) >>> 0);
      return bits;
    });
    const edgeCost = (profile: number, front: number, back: number) => {
      if (!neighborBits) return 0;
      let total = 0;
      for (let side = 0; side < 4; side++) {
        const bits = neighborBits[side]; if (!bits) continue;
        const wantedFront = bits.get(front) ?? 0, wantedBack = bits.get(back) ?? 0;
        const mask = fineEdgeMasks[profile * 4 + side]!;
        let difference = 0;
        if (((wantedFront | wantedBack) >>> 0) === 0xffffffff && front !== back) {
          for (let shift = 0; shift < 32; shift += 8) difference += edgeDifference[((mask >>> shift) & 255) * 256 + ((wantedFront >>> shift) & 255)]!;
        } else difference = 32 - pop32(mask & wantedFront) - pop32(~mask & wantedBack);
        total += difference / 4;
        const direction = side % 2 ? targetDirection & 3 : (targetDirection >> 2) & 3;
        if (direction === 1 || direction === 2) {
          const active = front === slot ? mask : back === slot ? ~mask : 0;
          const adjacent = bits.get(slot) ?? 0;
          const isBefore = side === 0 || side === 3;
          const forbidden = (direction === 1) === isBefore ? adjacent & ~active : active & ~adjacent;
          total += pop32(forbidden) * 2;
        }
      }
      return total;
    };
    // Existing profile wins exact objective ties. Do not retain a disappeared third color
    // (notably paper) as an artifact when the brush has covered it completely.
    const seed = useNeighbors ? this.cell(index) : original;
    const hasFront = !!(maskLow[seed.profile] || maskHigh[seed.profile]);
    const hasBack = maskLow[seed.profile] !== 0xffffffff || maskHigh[seed.profile] !== 0xffffffff;
    const originalAllowed = (!hasFront || !!histogram[seed.front]) && (!hasBack || !!histogram[seed.back]) && followsDirection(seed.profile, seed.front, seed.back);
    let best = originalAllowed ? seed : { profile: 1, front: slot, back: 0 };
    const bestError = originalAllowed ? error(best.profile, best.front, best.back) : count - histogram[slot]!;
    const bestEdge = edgeCost(best.profile, best.front, best.back);
    let bestScore = bestError + edgeWeight * bestEdge;
    for (const profile of this.expanded ? candidates : legacyCandidates) {
      for (const reversed of [false, true]) {
        const front = reversed ? retained : slot, back = reversed ? slot : retained;
        if (!followsDirection(profile, front, back)) continue;
        const low = maskLow[profile]!, high = maskHigh[profile]!;
        const frontLow = reversed ? retainedLow : slotLow, frontHigh = reversed ? retainedHigh : slotHigh;
        const backLow = reversed ? slotLow : retainedLow, backHigh = reversed ? slotHigh : retainedHigh;
        const candidateError = count - pop32(low & frontLow) - pop32(high & frontHigh) - pop32(~low & backLow) - pop32(~high & backHigh);
        if (candidateError > bestScore) continue;
        const candidateEdge = edgeCost(profile, front, back);
        const score = candidateError + edgeWeight * candidateEdge;
        if (score < bestScore) {
          best = { profile, front, back }; bestScore = score;
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
      const cell = this.cell(neighbor), opposite = (side + 2) % 4;
      return Uint8Array.from({ length: 32 }, (_, i) => {
        return fineEdgeMasks[cell.profile * 4 + opposite]! & (1 << i) ? cell.front : cell.back;
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
