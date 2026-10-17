import { bitAt, cottageMask, isCottageSticker } from './stickerMasks';
import { defaultBrush, defaultFill, patternPixel } from './toolOptions';
import type { BrushOptions, FillOptions } from './toolOptions';
import type { ArtworkDocument, Mark, Point, StickerKind, SurfaceData, PaintRun } from './document';
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const outlineWidth = 5;
const makeContext = (width: number, height: number) => {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Unable to create artwork surface');
  return ctx;
};
class Surface {
  readonly width: number;
  readonly height: number;
  readonly context: CanvasRenderingContext2D;
  readonly base: ImageData;
  readonly outline: Uint8Array;
  readonly paint: Uint32Array;
  readonly opaqueBounds: { left: number; top: number; right: number; bottom: number };
  dirty = true;
  constructor(readonly data: SurfaceData, width: number, height: number) {
    const imported = isCottageSticker(data.kind) ? cottageMask(data.kind, data.nativePixels === true) : undefined;
    this.width = data.kind === 'canvas' ? width : imported?.width ?? 220;
    this.height = data.kind === 'canvas' ? height : imported?.height ?? 280;
    this.context = makeContext(this.width, this.height);
    const mask = makeContext(this.width, this.height), ctx = this.context;
    if (data.kind === 'canvas') {
      ctx.fillStyle = hex(data.color); ctx.fillRect(0, 0, width, height);
    } else if (!isCottageSticker(data.kind)) {
      ctx.translate(110, 140); mask.translate(110, 140);
      ctx.lineWidth = mask.lineWidth = outlineWidth;
      ctx.strokeStyle = hex(data.color);
      mask.strokeStyle = '#ffffff';
      const path = (draw: (p: Path2D) => void, color: number) => {
        const p = new Path2D(); draw(p);
        ctx.fillStyle = hex(color); ctx.fill(p); ctx.stroke(p);
        mask.globalCompositeOperation = 'destination-out'; mask.fill(p);
        mask.globalCompositeOperation = 'source-over'; mask.stroke(p);
      };
      const circle = (x: number, y: number, r: number, color: number) => path((p) => p.arc(x, y, r, 0, Math.PI * 2), color);
      const white = 0xffffff;
      switch (data.kind) {
        case 'circle': circle(0, 0, 80, white); break;
        case 'square': path((p) => p.rect(-80, -80, 160, 160), white); break;
        case 'triangle': path((p) => { p.moveTo(0, -85); p.lineTo(-85, 75); p.lineTo(85, 75); p.closePath(); }, white); break;
        case 'tree': path((p) => p.roundRect(-22, 0, 44, 120, 8), white); path((p) => p.roundRect(-95, -110, 190, 160, 65), white); break;
        case 'flower':
          path((p) => p.roundRect(-6, 0, 12, 120, 4), white);
          for (let i = 0; i < 5; i++) { const angle = i * Math.PI * 2 / 5 - Math.PI / 2; circle(Math.cos(angle) * 42, Math.sin(angle) * 42, 32, white); }
          circle(0, 0, 26, white);
      }
      ctx.resetTransform(); mask.resetTransform();
    }
    this.base = ctx.getImageData(0, 0, this.width, this.height);
    this.outline = new Uint8Array(Math.ceil(this.width * this.height / 8));
    if (data.kind !== 'canvas') {
      const edges = imported ? undefined : mask.getImageData(0, 0, this.width, this.height).data;
      for (let i = 0; i < this.width * this.height; i++) {
        const p = i * 4;
        const covered = imported ? bitAt(imported.coverage, i) : this.base.data[p + 3]! >= 128;
        const border = covered && (imported ? bitAt(imported.outline, i) : edges![p + 3]! >= 128);
        if (border) this.outline[i >> 3]! |= 1 << (i & 7);
        const color = border ? data.color : 0xffffff;
        this.base.data[p] = covered ? color >> 16 & 255 : 0;
        this.base.data[p + 1] = covered ? color >> 8 & 255 : 0;
        this.base.data[p + 2] = covered ? color & 255 : 0;
        this.base.data[p + 3] = covered ? 255 : 0;
      }
    }
    let left = this.width, top = this.height, right = 0, bottom = 0;
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      if (!this.base.data[(y * this.width + x) * 4 + 3]) continue;
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
    this.opaqueBounds = { left, top, right, bottom };
    this.paint = new Uint32Array(this.width * this.height);
    for (const [start, length, color] of data.paint) this.paint.fill(color + 1, start, start + length);
  }
  get left() { return this.data.kind === 'canvas' ? 0 : Math.round(this.data.x) - Math.floor(this.width / 2); }
  get top() { return this.data.kind === 'canvas' ? 0 : Math.round(this.data.y) - Math.floor(this.height / 2); }
  worldPoint(x: number, y: number) {
    if (this.data.kind === 'canvas') return { x, y };
    const angle = (this.data.rotation ?? 0) * Math.PI / 180, scale = this.data.scale ?? 1;
    const dx = (x - Math.floor(this.width / 2)) * scale, dy = (y - Math.floor(this.height / 2)) * scale;
    return { x: this.data.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: this.data.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
  }
  bounds() {
    const b = this.opaqueBounds;
    const points = [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]].map(([x, y]) => this.worldPoint(x!, y!));
    const x = Math.floor(Math.min(...points.map(p => p.x))), y = Math.floor(Math.min(...points.map(p => p.y)));
    return { x, y, width: Math.ceil(Math.max(...points.map(p => p.x))) - x, height: Math.ceil(Math.max(...points.map(p => p.y))) - y };
  }
  localIndex(x: number, y: number) {
    const angle = (this.data.rotation ?? 0) * Math.PI / 180, scale = this.data.scale ?? 1;
    const dx = x + .5 - this.data.x, dy = y + .5 - this.data.y;
    const lx = this.data.kind === 'canvas' ? x : Math.floor((dx * Math.cos(angle) + dy * Math.sin(angle)) / scale + Math.floor(this.width / 2));
    const ly = this.data.kind === 'canvas' ? y : Math.floor((-dx * Math.sin(angle) + dy * Math.cos(angle)) / scale + Math.floor(this.height / 2));
    return lx < 0 || ly < 0 || lx >= this.width || ly >= this.height ? -1 : ly * this.width + lx;
  }
  color(index: number) {
    const added = this.paint[index]!;
    const p = index * 4, base = this.base.data;
    return added ? added - 1 : (base[p]! << 16) | (base[p + 1]! << 8) | base[p + 2]!;
  }
  editable(index: number) { return index >= 0 && this.base.data[index * 4 + 3]! > 0 && !bitAt(this.outline, index); }
  write(index: number, color: number, erase: boolean) {
    if (!this.editable(index)) return false;
    const value = erase ? 0 : color + 1;
    if (this.paint[index] === value) return false;
    this.paint[index] = value; this.dirty = true; return true;
  }
  render() {
    if (!this.dirty) return;
    const image = new ImageData(new Uint8ClampedArray(this.base.data), this.width, this.height);
    for (let i = 0; i < this.paint.length; i++) {
      if (!this.paint[i] || !this.editable(i)) continue;
      const color = this.paint[i]! - 1, p = i * 4;
      image.data[p] = color >> 16 & 255; image.data[p + 1] = color >> 8 & 255; image.data[p + 2] = color & 255;
    }
    this.context.putImageData(image, 0, 0); this.dirty = false;
  }
  serialize(): SurfaceData {
    const runs: PaintRun[] = [];
    for (let i = 0; i < this.paint.length;) {
      const value = this.paint[i]!;
      if (!value) { i++; continue; }
      const start = i++;
      while (i < this.paint.length && this.paint[i] === value) i++;
      runs.push([start, i - start, value - 1]);
    }
    return { ...this.data, paint: runs };
  }
}

export class Artwork {
  private surfaces: Surface[];
  private owners?: Int32Array;
  constructor(private readonly width: number, private readonly height: number, data: SurfaceData[]) {
    this.surfaces = data.map((surface) => new Surface(structuredClone(surface), width, height));
  }
  static create(width: number, height: number, background: string) {
    return new Artwork(width, height, [{ id: 'canvas', kind: 'canvas', x: 0, y: 0, color: parseInt(background.slice(1), 16), paint: [] }]);
  }
  static restore(doc: ArtworkDocument) { return new Artwork(doc.width, doc.height, doc.surfaces); }
  serialize(): ArtworkDocument { return { version: 2, width: this.width, height: this.height, surfaces: this.surfaces.map((surface) => surface.serialize()) }; }
  add(kind: StickerKind, color: number, point: Point, legacyFill?: number) {
    this.surfaces.push(new Surface({ id: crypto.randomUUID(), kind, color, nativePixels: true, x: Math.round(point.x), y: Math.round(point.y), paint: [], ...(legacyFill === undefined ? {} : { legacyFill }) }, this.width, this.height));
    this.owners = undefined;
  }
  get stickerCount() { return this.surfaces.length - 1; }
  get lastStickerId() { return this.surfaces.length > 1 ? this.surfaces[this.surfaces.length - 1]!.data.id : undefined; }
  bounds(id: string) {
    const surface = this.surfaces.find((s) => s.data.id === id);
    return surface?.bounds();
  }
  transform(id: string, scaleDelta: number, rotationDelta: number) {
    const surface = this.surfaces.find(s => s.data.id === id && s.data.kind !== 'canvas');
    if (!surface) return false;
    const scale = Math.max(.1, Math.min(4, Math.round(((surface.data.scale ?? 1) + scaleDelta) * 10) / 10));
    const rotation = ((surface.data.rotation ?? 0) + rotationDelta + 360) % 360;
    if (scale === (surface.data.scale ?? 1) && rotation === (surface.data.rotation ?? 0)) return false;
    surface.data.scale = scale; surface.data.rotation = rotation;
    this.move(id, surface.data);
    return true;
  }
  duplicate(id: string) {
    const original = this.surfaces.find((s) => s.data.id === id && s.data.kind !== 'canvas');
    if (!original) return undefined;
    const data = original.serialize();
    data.id = crypto.randomUUID();
    const copy = new Surface(data, this.width, this.height);
    this.surfaces.push(copy);
    this.move(data.id, { x: data.x + 24, y: data.y + 24 });
    return data.id;
  }
  selectionOrder(id?: string) {
    const index = this.surfaces.findIndex(s => s.data.id === id);
    return { forward: index > 0 && index < this.surfaces.length - 1, backward: index > 1 };
  }
  reorder(id: string, direction: 'forward' | 'backward') {
    const index = this.surfaces.findIndex(s => s.data.id === id);
    const target = index + (direction === 'forward' ? 1 : -1);
    // Index zero is always the paper and cannot be reordered.
    if (index < 1 || target < 1 || target >= this.surfaces.length) return false;
    [this.surfaces[index], this.surfaces[target]] = [this.surfaces[target]!, this.surfaces[index]!];
    this.owners = undefined;
    return true;
  }
  remove(id: string) {
    this.surfaces = this.surfaces.filter((s) => s.data.kind === 'canvas' || s.data.id !== id);
    this.owners = undefined;
  }
  private ownership() {
    if (this.owners) return this.owners;
    const owners = new Int32Array(this.width * this.height);
    this.surfaces.forEach((surface, order) => {
      if (!order) return;
      const bounds = surface.bounds();
      for (let y = Math.max(0, bounds.y); y < Math.min(this.height, bounds.y + bounds.height); y++) {
        for (let x = Math.max(0, bounds.x); x < Math.min(this.width, bounds.x + bounds.width); x++) {
          const local = surface.localIndex(x, y);
          if (local >= 0 && surface.base.data[local * 4 + 3]) owners[y * this.width + x] = order;
        }
      }
    });
    this.owners = owners; return owners;
  }
  private index(point: Point) {
    const x = Math.floor(point.x), y = Math.floor(point.y);
    return x < 0 || y < 0 || x >= this.width || y >= this.height ? -1 : y * this.width + x;
  }
  pick(point: Point) {
    const index = this.index(point);
    if (index < 0) return undefined;
    const owner = this.ownership()[index]!;
    return owner ? this.surfaces[owner]!.data.id : undefined;
  }
  position(id: string) { const s = this.surfaces.find((surface) => surface.data.id === id); return s ? { x: s.data.x, y: s.data.y } : undefined; }
  move(id: string, point: Point) {
    const surface = this.surfaces.find((s) => s.data.id === id);
    if (!surface || surface.data.kind === 'canvas') return;
    const box = surface.bounds(), bounds = surface.opaqueBounds;
    const visibleX = Math.min(this.width, Math.max(8, Math.ceil(box.width * .1)));
    const visibleY = Math.min(this.height, Math.max(8, Math.ceil(box.height * .1)));
    const offsetX = box.x - surface.data.x, offsetY = box.y - surface.data.y;
    surface.data.x = Math.round(Math.max(-offsetX - box.width + visibleX, Math.min(this.width - offsetX - visibleX, point.x)));
    surface.data.y = Math.round(Math.max(-offsetY - box.height + visibleY, Math.min(this.height - offsetY - visibleY, point.y)));
    // A rounded or irregular silhouette can have a transparent corner. Keep an
    // actual opaque pixel inside the paper, rather than just its bounding box.
    let nearest: Point | undefined, distance = Infinity;
    for (let y = bounds.top; y < bounds.bottom && distance > 0; y++) {
      for (let x = bounds.left; x < bounds.right; x++) {
        if (!surface.base.data[(y * surface.width + x) * 4 + 3]) continue;
        const { x: px, y: py } = surface.worldPoint(x + .5, y + .5);
        const dx = Math.max(0, Math.min(this.width - 1, px)) - px;
        const dy = Math.max(0, Math.min(this.height - 1, py)) - py;
        const d = dx * dx + dy * dy;
        if (d < distance) { distance = d; nearest = { x: dx, y: dy }; }
        if (!d) break;
      }
    }
    if (distance > 0 && nearest) {
      surface.data.x = Math.round(surface.data.x + nearest.x + Math.sign(nearest.x) * Math.min(7, this.width - 1));
      surface.data.y = Math.round(surface.data.y + nearest.y + Math.sign(nearest.y) * Math.min(7, this.height - 1));
    }
    this.owners = undefined;
  }
  brush(from: Point, to: Point, color: number, erase = false, options: BrushOptions = defaultBrush) {
    const radius = erase ? 20 : options.size / 2, owners = this.ownership();
    const dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy;
    let changed = false;
    for (let y = Math.max(0, Math.floor(Math.min(from.y, to.y) - radius)); y <= Math.min(this.height - 1, Math.ceil(Math.max(from.y, to.y) + radius)); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(from.x, to.x) - radius)); x <= Math.min(this.width - 1, Math.ceil(Math.max(from.x, to.x) + radius)); x++) {
        const t = length2 ? Math.max(0, Math.min(1, ((x + .5 - from.x) * dx + (y + .5 - from.y) * dy) / length2)) : 0;
        const px = x + .5 - from.x - t * dx, py = y + .5 - from.y - t * dy;
        const distance = !erase && options.shape === 'square' ? Math.max(Math.abs(px), Math.abs(py)) / radius : Math.hypot(px, py) / radius;
        if (distance > 1) continue;
        if (!erase) {
          if (options.kind === 'spray' && Math.random() > .22 * (1 - distance * .7)) continue;
          if (options.kind === 'pencil' && ((x * 17 + y * 31) % 13) === 0) continue;
          if (options.kind === 'brush' && distance > .6 && x % 4 === 0) continue;
        }
        const surface = this.surfaces[owners[y * this.width + x]!]!;
        changed = surface.write(surface.localIndex(x, y), color, erase) || changed;
      }
    }
    return changed;
  }
  fill(point: Point, color: number, options: FillOptions = defaultFill) {
    const start = this.index(point);
    if (start < 0) return false;
    const owners = this.ownership(), owner = owners[start]!, surface = this.surfaces[owner]!;
    const local = surface.localIndex(start % this.width, Math.floor(start / this.width));
    if (!surface.editable(local)) return false;
    const target = surface.color(local);
    if (target === color && options.pattern === 'solid') return false;
    const seen = new Uint8Array(this.width * this.height), queue = new Int32Array(seen.length);
    const pixels = new Set<number>();
    let head = 0, tail = 1, changed = false; queue[0] = start; seen[start] = 1;
    const enqueue = (i: number) => { if (!seen[i]) { seen[i] = 1; queue[tail++] = i; } };
    while (head < tail) {
      const index = queue[head++]!;
      if (owners[index] !== owner) continue;
      const x = index % this.width, y = Math.floor(index / this.width), pixel = surface.localIndex(x, y);
      if (!surface.editable(pixel) || surface.color(pixel) !== target) continue;
      pixels.add(pixel);
      if (x > 0) enqueue(index - 1); if (x < this.width - 1) enqueue(index + 1);
      if (y > 0) enqueue(index - this.width); if (y < this.height - 1) enqueue(index + this.width);
    }
    for (const pixel of pixels) {
      const ink = patternPixel(pixel % surface.width, Math.floor(pixel / surface.width), options);
      changed = surface.write(pixel, ink ? color : 0xffffff, false) || changed;
    }
    return changed;
  }
  render(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, this.width, this.height);
    // Render from the same nearest-neighbor mapping used by picking and painting.
    // Canvas rotation would otherwise introduce antialiased edge pixels.
    const image = ctx.createImageData(this.width, this.height), owners = this.ownership();
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const i = y * this.width + x, surface = this.surfaces[owners[i]!]!;
      const color = surface.color(surface.localIndex(x, y)), p = i * 4;
      image.data[p] = color >> 16 & 255; image.data[p + 1] = color >> 8 & 255; image.data[p + 2] = color & 255; image.data[p + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }
  // Import old global operations once. Later moves cannot change resolved fills.
  importMarks(marks: Mark[]) {
    for (const mark of marks) {
      if (mark.kind !== 'stroke') {
        const shape = ['circle', 'square', 'triangle'].includes(mark.kind);
        this.add(mark.kind, shape ? 0x39483e : mark.color, mark, shape ? mark.color : undefined);
      } else if (mark.flood) {
        if (mark.points[0]) this.fill(mark.points[0], mark.color);
      } else {
        let previous = mark.points[0];
        for (const point of mark.points) { if (previous) this.brush(previous, point, mark.color, mark.erase); previous = point; }
      }
    }
  }
}


