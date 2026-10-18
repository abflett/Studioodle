import type { Point } from './document';
import { paintScale } from './document';

/** Small rounded joins, flattened immediately into ordinary raster brush segments. */
export class StrokeSmoothing {
  private raw: Point;
  private painted: Point;
  private tip: Point;

  constructor(start: Point) { this.raw = start; this.painted = start; this.tip = start; }

  append(point: Point, maxTrail: number): Point[] {
    this.tip = point;
    const rawX = point.x - this.raw.x, rawY = point.y - this.raw.y;
    const rawDistance = Math.hypot(rawX, rawY);
    if (rawDistance < .0001) return [];
    // Blend several input samples to damp hand jitter, catching up faster on
    // broad movements. Reserve part of the trail budget for the rounded join.
    const response = .35 + .45 * Math.min(1, rawDistance / maxTrail);
    const lag = Math.min(maxTrail * .65, rawDistance * (1 - response));
    const filtered = { x: point.x - rawX / rawDistance * lag, y: point.y - rawY / rawDistance * lag };
    const dx = filtered.x - this.raw.x, dy = filtered.y - this.raw.y;
    const distance = Math.hypot(dx, dy);
    const trail = Math.min(maxTrail * .35, distance / 2);
    const end = { x: filtered.x - dx / distance * trail, y: filtered.y - dy / distance * trail };
    const start = this.painted, control = this.raw;
    const chordX = end.x - start.x, chordY = end.y - start.y;
    const length2 = chordX * chordX + chordY * chordY;
    const projection = length2 > .00000001
      ? Math.max(0, Math.min(1, ((control.x - start.x) * chordX + (control.y - start.y) * chordY) / length2)) : 0;
    const bend = Math.hypot(control.x - start.x - projection * chordX, control.y - start.y - projection * chordY);
    // Subpixel curve approximation at native paint resolution, without
    // subdividing long straight lines or changing the raster paint format.
    const steps = Math.min(24, Math.max(1, Math.ceil(Math.sqrt(bend * paintScale() / .2))));
    const points: Point[] = [];
    for (let step = 1; step <= steps; step++) {
      const t = step / steps, u = 1 - t;
      points.push({ x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
        y: u * u * start.y + 2 * u * t * control.y + t * t * end.y });
    }
    this.raw = filtered; this.painted = end;
    return points;
  }

  finish(): Point { return this.tip; }
}
