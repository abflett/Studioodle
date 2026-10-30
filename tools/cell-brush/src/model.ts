import { libraries, edgeDifference, pop32, sampleX, sampleY, sampleCount as count, monotonicity, reverseMonotonicity } from './profiles';
import type { Point, LibraryId, ProfileLibrary } from './profiles';
import { capsuleInterval, paintRuns, edgeColor, cellCrossings, cutKey } from './strokeEdges';
import type { StrokeEdge, EdgeRun } from './strokeEdges';
export type { Point } from './profiles';
export { profiles, profileNames, inProfile } from './profiles';
export const size = 100;
type Cell = { profile: number; front: number; back: number };
type WorkingCell = { target: Uint8Array; original: Cell; edges?: Uint8Array; outline?: StrokeEdge[]; fitMode?: CellDiagnostic['mode'] };
export type CellDiagnostic = {
  actual: Point[]; snapped: Point[]; mode: 'cut' | 'uniform' | 'fallback';
  target: Uint8Array; edges: StrokeEdge[]; selected: Cell;
};
const edgeWeight = 4;
const joinPasses = 6;

export class CellField {
  // Exactly three authoritative bytes per cell; slot zero means transparent.
  readonly profile = new Uint8Array(size * size);
  readonly front = new Uint8Array(size * size);
  readonly back = new Uint8Array(size * size);
  private working = new Map<number, WorkingCell>();
  private outlineEdges = new Map<number, StrokeEdge>();
  private strokeSlot: number | undefined;
  readonly library: LibraryId;
  readonly tables: ProfileLibrary;
  // Optional experiment observer; normal painting retains no diagnostic history.
  onFit?: (index: number, diagnostic: CellDiagnostic) => void;
  constructor(library: LibraryId = 'experimental', public matchNeighbors = true) {
    this.library = library;
    this.tables = libraries[this.library];
  }

  get byteLength() { return this.profile.byteLength + this.front.byteLength + this.back.byteLength; }
  get scratchBytes() { let bytes = 0; for (const working of this.working.values()) bytes += working.target.byteLength + (working.edges?.byteLength ?? 0); return bytes; }
  cell(index: number): Cell { return { profile: this.profile[index]!, front: this.front[index]!, back: this.back[index]! }; }
  colorAt(x: number, y: number): number {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= size || cy >= size) return 0;
    const cell = this.cell(cy * size + cx);
    return this.tables.inProfile(cell.profile, x - cx, y - cy) ? cell.front : cell.back;
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
    if (this.onFit && this.strokeSlot !== undefined) for (const [index, working] of this.working) this.observeFit(index, working, this.strokeSlot);
    this.working.clear(); this.outlineEdges.clear(); this.strokeSlot = undefined; return dirty;
  }
  clear() { this.endStroke(); this.profile.fill(0); this.front.fill(0); this.back.fill(0); }

  private fit(index: number, working: WorkingCell, slot: number, useNeighbors = false) {
    working.fitMode = this.fitCell(index, working, slot, useNeighbors);
    this.observeFit(index, working, slot);
  }

  private observeFit(index: number, working: WorkingCell, slot: number) {
    if (this.onFit && working.outline) {
      const snapped = cellCrossings(working.outline, slot);
      this.onFit(index, { actual: cellCrossings(working.outline, slot, false), snapped, mode: working.fitMode!,
        target: working.target.slice(), selected: this.cell(index),
        edges: working.outline.map(edge => ({ start: edge.start, horizontal: edge.horizontal, runs: edge.runs.map(run => ({ ...run })) })) });
    }
  }

  private fitCell(index: number, working: WorkingCell, slot: number, useNeighbors = false): CellDiagnostic['mode'] {
    const { maskLow, maskHigh, sampleColor, fineEdgeMasks, directionFlags, candidates } = this.tables;
    const { target, original } = working;
    const histogram = new Uint8Array(256);
    for (const color of target) histogram[color] = histogram[color]! + 1;
    const survivors = working.edges ? Uint16Array.from(histogram) : histogram;
    if (working.edges) for (const color of working.edges) survivors[color] = survivors[color]! + 1;
    // Largest surviving old color wins, preferring opaque over transparent on an
    // area tie. Color distance and palette numbering do not decide ownership.
    let retained = original.front !== slot && survivors[original.front] ? original.front :
      original.back !== slot && survivors[original.back] ? original.back : slot;
    for (let color = 0; color < survivors.length; color++) {
      if (color === slot || !survivors[color]) continue;
      if (retained === slot || survivors[color]! > survivors[retained]! ||
        (survivors[color] === survivors[retained] && retained === 0)) retained = color;
    }
    if (retained === slot) { this.profile[index] = slot ? 1 : 0; this.front[index] = slot; this.back[index] = 0; return 'uniform'; }
    if (working.outline) {
      const crossings = cellCrossings(working.outline, slot);
      let direct: number[] | undefined;
      if (crossings.length === 2) {
        const [a, b] = crossings as [Point, Point];
        const sameBorder = (a[0] === b[0] && (a[0] === 0 || a[0] === 1)) || (a[1] === b[1] && (a[1] === 0 || a[1] === 1));
        direct = sameBorder ? [0, 1] : this.tables.cuts.get(cutKey(a, b));
      } else if (!crossings.length) direct = [0, 1];
      if (direct) {
        // The endpoints determine geometry. Coverage only selects which side is
        // painted; it cannot replace an exit with a better-scoring different one.
        let best = { profile: 0, front: slot, back: retained }, bestError = Infinity;
        for (const profile of direct) for (const reverse of [false, true]) {
          const front = reverse ? retained : slot, back = reverse ? slot : retained;
          let error = 0;
          for (let i = 0; i < count; i++) if (sampleColor(profile, front, back, i) !== target[i]) error++;
          if (error < bestError) { best = { profile, front, back }; bestError = error; }
        }
        if (best.profile <= 1) {
          const color = best.profile ? best.front : best.back;
          best = { profile: color ? 1 : 0, front: color, back: 0 };
        }
        this.profile[index] = best.profile; this.front[index] = best.front; this.back[index] = best.back;
        return direct.length === 2 && direct[0] === 0 && direct[1] === 1 ? 'uniform' : 'cut';
      }
    }
    const targetDirection = monotonicity(i => target[i] === slot);
    const simpleBoundary = !!(targetDirection & 3) && !!(targetDirection & 12);
    const followsDirection = (profile: number, front: number, back: number) => {
      if (this.library === 'straight') return true;
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
    const referenceEdges = working.edges ? Uint32Array.from({ length: 4 }, (_, side) => {
      let mask = 0;
      for (let quarter = 0; quarter < 4; quarter++) {
        let coverage = 0;
        for (let i = 0; i < 8; i++) if (working.edges![side * 32 + quarter * 8 + i] === slot) coverage++;
        if (coverage >= 4) mask |= 255 << (quarter * 8);
      }
      return mask >>> 0;
    }) : undefined;
    const referenceError = (profile: number, front: number, back: number) => {
      if (!referenceEdges) return 0;
      let error = 0;
      for (let side = 0; side < 4; side++) {
        const desired = referenceEdges[side]!, mask = fineEdgeMasks[profile * 4 + side]!;
        const wantedFront = front === slot ? desired : front === retained ? ~desired : 0;
        const wantedBack = back === slot ? desired : back === retained ? ~desired : 0;
        error += 32 - pop32(mask & wantedFront) - pop32(~mask & wantedBack);
      }
      return error;
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
    const originalAllowed = (!hasFront || !!survivors[seed.front]) && (!hasBack || !!survivors[seed.back]) && followsDirection(seed.profile, seed.front, seed.back);
    let best = originalAllowed ? seed : { profile: 1, front: slot, back: 0 };
    const bestError = originalAllowed ? error(best.profile, best.front, best.back) : count - histogram[slot]!;
    const bestEdge = edgeCost(best.profile, best.front, best.back);
    let bestScore = bestError + edgeWeight * bestEdge + referenceError(best.profile, best.front, best.back) * 65;
    for (const profile of candidates) {
      for (const reversed of [false, true]) {
        const front = reversed ? retained : slot, back = reversed ? slot : retained;
        if (!followsDirection(profile, front, back)) continue;
        const low = maskLow[profile]!, high = maskHigh[profile]!;
        const frontLow = reversed ? retainedLow : slotLow, frontHigh = reversed ? retainedHigh : slotHigh;
        const backLow = reversed ? slotLow : retainedLow, backHigh = reversed ? slotHigh : retainedHigh;
        const candidateError = count - pop32(low & frontLow) - pop32(high & frontHigh) - pop32(~low & backLow) - pop32(~high & backHigh);
        if (candidateError > bestScore) continue;
        const candidateEdge = edgeCost(profile, front, back);
        const score = candidateError + edgeWeight * candidateEdge + referenceError(profile, front, back) * 65;
        if (score < bestScore) {
          best = { profile, front, back }; bestScore = score;
        }
      }
    }
    // Nearly uniform coverage is a tie-break, not permission to overwrite a
    // better-fitting corner. A thin stroke may leave real gaps at opposite
    // corners even when 60/64 samples are painted.
    if (referenceEdges && referenceError(best.profile, best.front, best.back) > 0) {
      const dominant = histogram[slot]! > histogram[retained]! ? slot : retained;
      const uniformError = count - histogram[dominant]!;
      if (uniformError <= 4 && error(best.profile, best.front, best.back) >= uniformError) best = { profile: dominant ? 1 : 0, front: dominant, back: 0 };
    }
    if ((!maskLow[best.profile] && !maskHigh[best.profile]) ||
      (maskLow[best.profile] === 0xffffffff && maskHigh[best.profile] === 0xffffffff) || best.front === best.back) {
      const color = !maskLow[best.profile] && !maskHigh[best.profile] ? best.back : best.front;
      best = { profile: color ? 1 : 0, front: color, back: 0 };
    }
    this.profile[index] = best.profile; this.front[index] = best.front; this.back[index] = best.back;
    return 'fallback';
  }

  private neighborColors(index: number): (Uint8Array | undefined)[] {
    const { fineEdgeMasks } = this.tables;
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

  private strokeEdge(x: number, y: number, side: number): StrokeEdge {
    const horizontal = side === 0 || side === 2;
    const ex = x + Number(side === 1), ey = y + Number(side === 2);
    const key = horizontal ? ey * size + ex : size * (size + 1) + ey * (size + 1) + ex;
    let edge = this.outlineEdges.get(key);
    if (edge) return edge;
    const owner = horizontal ? (ey ? (ey - 1) * size + ex : ex) : ey * size + (ex ? ex - 1 : 0);
    const ownerSide = horizontal ? (ey ? 2 : 0) : ex ? 1 : 3;
    const original = this.working.get(owner)?.original ?? this.cell(owner);
    const mask = this.tables.fineEdgeMasks[original.profile * 4 + ownerSide]!;
    const runs: EdgeRun[] = [];
    for (let i = 0; i < 32; i++) {
      const color = mask & (1 << i) ? original.front : original.back;
      const last = runs.at(-1);
      if (last?.color === color) last.to = (i + 1) / 32;
      else runs.push({ from: i / 32, to: (i + 1) / 32, color });
    }
    edge = { start: [ex, ey], horizontal, runs }; this.outlineEdges.set(key, edge); return edge;
  }

  paint(a: Point, b: Point, radius: number, slot: number): Set<number> {
    const { sampleColor } = this.tables;
    const dirty = this.strokeSlot !== slot ? this.beginStroke(slot) : new Set<number>();
    const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
    const left = Math.max(0, Math.floor(Math.min(a[0], b[0]) - radius));
    const right = Math.min(size - 1, Math.floor(Math.max(a[0], b[0]) + radius));
    const top = Math.max(0, Math.floor(Math.min(a[1], b[1]) - radius));
    const bottom = Math.min(size - 1, Math.floor(Math.max(a[1], b[1]) + radius));
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const centerT = length2 ? Math.max(0, Math.min(1, ((x + .5 - a[0]) * dx + (y + .5 - a[1]) * dy) / length2)) : 0;
      if ((x + .5 - a[0] - centerT * dx) ** 2 + (y + .5 - a[1] - centerT * dy) ** 2 > (radius + Math.SQRT1_2) ** 2) continue;
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
      if (this.library === 'straight') {
        const outline = [0, 1, 2, 3].map(side => this.strokeEdge(x, y, side));
        for (const edge of outline) {
          const interval = capsuleInterval(edge.start, edge.horizontal, a, b, radius);
          if (!interval) continue;
          const runs = paintRuns(edge.runs, interval, slot);
          if (runs !== edge.runs) { edge.runs = runs; edge.crossings = undefined; }
          changed = true;
        }
        if (changed && !working) {
          working = { original: old, target: Uint8Array.from({ length: count }, (_, sample) => sampleColor(old.profile, old.front, old.back, sample)) };
          this.working.set(index, working);
        }
        if (working) {
          working.outline = outline;
          working.edges = Uint8Array.from({ length: 128 }, (_, i) => edgeColor(outline[Math.floor(i / 32)]!, (i % 32 + .5) / 32));
        }
      }
      if (!changed || !working) continue;
      this.fit(index, working, slot);
      if (old.profile !== this.profile[index] || old.front !== this.front[index] || old.back !== this.back[index]) dirty.add(index);
    }
    return dirty;
  }
}
