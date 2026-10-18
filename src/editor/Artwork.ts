import { bitAt, cottageMask, isCottageSticker } from './stickerMasks';
import { isVectorSticker, vectorDefinition, vectorHitMask } from './vectorStickers';
import type { VectorDefinition } from './vectorStickers';
import { defaultBrush, defaultFill, patternPixel } from './toolOptions';
import type { BrushOptions, FillOptions } from './toolOptions';
import type { ArtworkDocument, Mark, Point, StickerKind, SurfaceData, PaintRun } from './document';
import { defaultPaintDpi, paintScale } from './document';
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const outlineWidth = 5;
const makeContext = (width: number, height: number) => {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Unable to create artwork surface');
  return ctx;
};
class Surface {
  readonly resolution: number;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly vector?: VectorDefinition;
  readonly hitMask?: ReturnType<typeof vectorHitMask>;
  readonly width: number;
  readonly height: number;
  readonly context: CanvasRenderingContext2D;
  readonly base: ImageData;
  readonly outline: Uint8Array;
  readonly paint: Uint32Array;
  readonly opaqueBounds: { left: number; top: number; right: number; bottom: number };
  dirty = true;
  constructor(readonly data: SurfaceData, width: number, height: number) {
    this.vector = isVectorSticker(data.kind) ? vectorDefinition(data.kind) : undefined;
    this.hitMask = isVectorSticker(data.kind) ? vectorHitMask(data.kind) : undefined;
    const imported = isCottageSticker(data.kind) ? cottageMask(data.kind, data.nativePixels === true) : undefined;
    this.resolution = data.kind === 'canvas' || this.vector ? paintScale(data) : 1;
    this.logicalWidth = data.kind === 'canvas' ? width : this.vector?.width ?? imported?.width ?? 220;
    this.logicalHeight = data.kind === 'canvas' ? height : this.vector?.height ?? imported?.height ?? 280;
    this.width = Math.ceil(this.logicalWidth * this.resolution);
    this.height = Math.ceil(this.logicalHeight * this.resolution);
    this.context = makeContext(this.width, this.height);
    const mask = makeContext(this.width, this.height), ctx = this.context;
    if (data.kind === 'canvas') {
      ctx.fillStyle = hex(data.color); ctx.fillRect(0, 0, this.width, this.height);
    } else if (!this.vector && !isCottageSticker(data.kind)) {
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
        const covered = this.vector ? bitAt(this.vector.coverage, this.definitionIndex(i)) : imported ? bitAt(imported.coverage, i) : this.base.data[p + 3]! >= 128;
        const border = !this.vector && covered && (imported ? bitAt(imported.outline, i) : edges![p + 3]! >= 128);
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
    x /= this.resolution; y /= this.resolution;
    if (this.data.kind === 'canvas') return { x, y };
    const angle = (this.data.rotation ?? 0) * Math.PI / 180, scale = this.data.scale ?? 1;
    const dx = (x - Math.floor(this.logicalWidth / 2)) * scale, dy = (y - Math.floor(this.logicalHeight / 2)) * scale;
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
    const lx = Math.floor((this.data.kind === 'canvas' ? x + .5 : (dx * Math.cos(angle) + dy * Math.sin(angle)) / scale + Math.floor(this.logicalWidth / 2)) * this.resolution);
    const ly = Math.floor((this.data.kind === 'canvas' ? y + .5 : (-dx * Math.sin(angle) + dy * Math.cos(angle)) / scale + Math.floor(this.logicalHeight / 2)) * this.resolution);
    return lx < 0 || ly < 0 || lx >= this.width || ly >= this.height ? -1 : ly * this.width + lx;
  }
  localPoint(point: Point) {
    if (this.data.kind === 'canvas') return { x: point.x * this.resolution, y: point.y * this.resolution };
    const angle = (this.data.rotation ?? 0) * Math.PI / 180, scale = this.data.scale ?? 1;
    const dx = point.x - this.data.x, dy = point.y - this.data.y;
    return { x: ((dx * Math.cos(angle) + dy * Math.sin(angle)) / scale + Math.floor(this.logicalWidth / 2)) * this.resolution, y: ((-dx * Math.sin(angle) + dy * Math.cos(angle)) / scale + Math.floor(this.logicalHeight / 2)) * this.resolution };
  }
  definitionIndex(index: number) { return Math.min(this.logicalHeight - 1, Math.floor(Math.floor(index / this.width) / this.resolution)) * this.logicalWidth + Math.min(this.logicalWidth - 1, Math.floor(index % this.width / this.resolution)); }
  region(index: number) { return this.vector ? this.vector.regions[this.definitionIndex(index)]! : 1; }
  containsPoint(point: Point) {
    const local = this.localPoint(point);
    if (local.x < 0 || local.y < 0 || local.x >= this.width || local.y >= this.height) return false;
    if (this.hitMask) {
      const x = Math.floor(local.x / this.resolution * this.hitMask.scale), y = Math.floor(local.y / this.resolution * this.hitMask.scale);
      return x >= 0 && y >= 0 && x < this.hitMask.width && y < this.hitMask.height && bitAt(this.hitMask.bits, y * this.hitMask.width + x);
    }
    const i = Math.floor(local.y) * this.width + Math.floor(local.x);
    return this.base.data[i * 4 + 3]! > 0;
  }
  color(index: number) {
    const added = this.paint[index]!;
    const p = index * 4, base = this.base.data;
    return added ? added - 1 : (base[p]! << 16) | (base[p + 1]! << 8) | base[p + 2]!;
  }
  editable(index: number) { return index >= 0 && this.base.data[index * 4 + 3]! > 0 && (this.vector ? this.region(index) > 0 : !bitAt(this.outline, index)); }
  write(index: number, color: number, erase: boolean) {
    if (!this.editable(index)) return false;
    const value = erase ? 0 : color + 1;
    if (this.paint[index] === value) return false;
    this.paint[index] = value; this.dirty = true; return true;
  }
  render() {
    if (!this.dirty) return;
    const image = new ImageData(new Uint8ClampedArray(this.base.data), this.width, this.height);
    // The vector silhouette clips this full white paint backing at render time.
    // This avoids exposing a binary silhouette fringe beneath antialiased ink.
    if (this.vector) image.data.fill(255);
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
  get usesCompositeRenderer() { return this.surfaces.some(surface => !!surface.vector || surface.resolution > 1); }
  private surfaces: Surface[];
  private owners?: Int32Array;
  private fillScratch?: { seen: Uint8Array; queue: Int32Array };
  constructor(private readonly width: number, private readonly height: number, data: SurfaceData[]) {
    this.surfaces = data.map((surface) => new Surface(structuredClone(surface), width, height));
  }
  static create(width: number, height: number, background: string) {
    return new Artwork(width, height, [{ id: 'canvas', kind: 'canvas', paintDpi: defaultPaintDpi, x: 0, y: 0, color: parseInt(background.slice(1), 16), paint: [] }]);
  }
  static restore(doc: ArtworkDocument) { return new Artwork(doc.width, doc.height, doc.surfaces); }
  serialize(): ArtworkDocument { return { version: 2, width: this.width, height: this.height, surfaces: this.surfaces.map((surface) => surface.serialize()) }; }
  add(kind: StickerKind, color: number, point: Point, legacyFill?: number, fitToPage = true) {
    const surface = new Surface({ id: crypto.randomUUID(), kind, color, paintDpi: isVectorSticker(kind) ? defaultPaintDpi : undefined, nativePixels: true, x: Math.round(point.x), y: Math.round(point.y), paint: [], ...(legacyFill === undefined ? {} : { legacyFill }) }, this.width, this.height);
    if (fitToPage) {
      const bounds = surface.bounds();
      surface.data.scale = Math.min(1, this.width * .6 / Math.max(1, bounds.width), this.height * .6 / Math.max(1, bounds.height));
      // Keep the entire initial silhouette on the page, even when the current
      // viewport center is close to an edge after panning or zooming.
      const fitted = surface.bounds();
      surface.data.x += Math.max(0, -fitted.x) - Math.max(0, fitted.x + fitted.width - this.width);
      surface.data.y += Math.max(0, -fitted.y) - Math.max(0, fitted.y + fitted.height - this.height);
    }
    this.surfaces.push(surface);
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
  private ownerAt(point: Point, owners: Int32Array) {
    const index = this.index(point);
    if (index < 0) return -1;
    const owner = owners[index]!, x = index % this.width, y = Math.floor(index / this.width);
    // Only refine the boundary band against shared high-resolution hit masks.
    // Paint edits do not invalidate these immutable definition samples.
    if ((!x || owners[index - 1] === owner) && (x + 1 === this.width || owners[index + 1] === owner) &&
      (!y || owners[index - this.width] === owner) && (y + 1 === this.height || owners[index + this.width] === owner)) return owner;
    for (let order = this.surfaces.length - 1; order > 0; order--) if (this.surfaces[order]!.containsPoint(point)) return order;
    return 0;
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
        if (surface.vector || surface.resolution > 1) continue;
        changed = surface.write(surface.localIndex(x, y), color, erase) || changed;
      }
    }
    // Visit every native paint pixel for vector stickers. Sampling only scene
    // pixels leaves holes when a detailed sticker is displayed smaller than 1:1.
    this.surfaces.forEach((surface, order) => {
      if (!surface.vector && surface.resolution === 1) return;
      const a = surface.localPoint(from), b = surface.localPoint(to);
      const reach = radius * Math.SQRT2 * surface.resolution / (surface.data.scale ?? 1);
      for (let y = Math.max(0, Math.floor(Math.min(a.y, b.y) - reach)); y < Math.min(surface.height, Math.ceil(Math.max(a.y, b.y) + reach)); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(a.x, b.x) - reach)); x < Math.min(surface.width, Math.ceil(Math.max(a.x, b.x) + reach)); x++) {
          const world = surface.worldPoint(x + .5, y + .5);
          if (this.ownerAt(world, owners) !== order) continue;
          const t = length2 ? Math.max(0, Math.min(1, ((world.x - from.x) * dx + (world.y - from.y) * dy) / length2)) : 0;
          const px = world.x - from.x - t * dx, py = world.y - from.y - t * dy;
          const distance = !erase && options.shape === 'square' ? Math.max(Math.abs(px), Math.abs(py)) / radius : Math.hypot(px, py) / radius;
          if (distance > 1) continue;
          if (!erase) {
            if (options.kind === 'spray' && Math.random() > .22 * (1 - distance * .7)) continue;
            if (options.kind === 'pencil' && ((x * 17 + y * 31) % 13) === 0) continue;
            if (options.kind === 'brush' && distance > .6 && x % 4 === 0) continue;
          }
          changed = surface.write(y * surface.width + x, color, erase) || changed;
        }
      }
    });
    return changed;
  }
  private fillNative(surface: Surface, local: number, owner: number, color: number, options: FillOptions) {
    const region = surface.region(local), target = surface.color(local);
    if (!region || (target === color && options.pattern === 'solid' && !this.surfaces.some(s => !!s.vector))) return false;
    if (!this.fillScratch || this.fillScratch.seen.length !== surface.paint.length) {
      this.fillScratch = { seen: new Uint8Array(surface.paint.length), queue: new Int32Array(surface.paint.length) };
    } else this.fillScratch.seen.fill(0);
    const { seen, queue } = this.fillScratch, owners = this.ownership();
    const bleed = new Map<number, number>();
    const bleedRadius = Math.ceil(4 * surface.resolution / (surface.data.scale ?? 1));
    let head = 0, tail = 1, changed = false;
    queue[0] = local; seen[local] = 1;
    const enqueue = (i: number) => { if (!seen[i]) { seen[i] = 1; queue[tail++] = i; } };
    while (head < tail) {
      const i = queue[head++]!, x = i % surface.width, y = Math.floor(i / surface.width);
      if (!surface.editable(i) || surface.region(i) !== region || surface.color(i) !== target) continue;
      const visible = this.ownerAt(surface.worldPoint(x + .5, y + .5), owners);
      if (visible < 0) continue;
      if (visible !== owner) {
        if (visible > owner && this.surfaces[visible]!.vector) bleed.set(i, 1);
        continue;
      }
      changed = surface.write(i, patternPixel(x / surface.resolution, y / surface.resolution, options) ? color : 0xffffff, false) || changed;
      if (x) enqueue(i - 1); if (x + 1 < surface.width) enqueue(i + 1);
      if (y) enqueue(i - surface.width); if (y + 1 < surface.height) enqueue(i + surface.width);
    }
    // Pad only the filled edge underneath vector stickers. The vector boundary
    // then covers the raster fill boundary rather than revealing an unpainted
    // pixel fringe. Never propagate back out into another visible region.
    for (const [i, depth] of bleed) {
      const x = i % surface.width, y = Math.floor(i / surface.width);
      if (!surface.editable(i) || surface.region(i) !== region) continue;
      const visible = this.ownerAt(surface.worldPoint(x + .5, y + .5), owners);
      if (visible <= owner || !this.surfaces[visible]!.vector) continue;
      changed = surface.write(i, patternPixel(x / surface.resolution, y / surface.resolution, options) ? color : 0xffffff, false) || changed;
      if (depth >= bleedRadius) continue;
      const enqueue = (n: number) => { if (!bleed.has(n)) bleed.set(n, depth + 1); };
      if (x) enqueue(i - 1); if (x + 1 < surface.width) enqueue(i + 1);
      if (y) enqueue(i - surface.width); if (y + 1 < surface.height) enqueue(i + surface.width);
    }
    return changed;
  }
  fill(point: Point, color: number, options: FillOptions = defaultFill) {
    const start = this.index(point);
    if (start < 0) return false;
    const owners = this.ownership(), owner = owners[start]!, surface = this.surfaces[owner]!;
    const local = surface.localIndex(start % this.width, Math.floor(start / this.width));
    if (!surface.editable(local)) return false;
    if (surface.vector || surface.resolution > 1 || surface.data.kind === 'canvas') return this.fillNative(surface, local, owner, color, options);
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
    if (this.usesCompositeRenderer) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, this.width, this.height); ctx.clip();
      for (const surface of this.surfaces) {
        surface.render();
        ctx.save();
        if (surface.data.kind !== 'canvas') {
          ctx.translate(surface.data.x, surface.data.y);
          ctx.rotate((surface.data.rotation ?? 0) * Math.PI / 180);
          ctx.scale(surface.data.scale ?? 1, surface.data.scale ?? 1);
          ctx.translate(-Math.floor(surface.logicalWidth / 2), -Math.floor(surface.logicalHeight / 2));
        }
        ctx.imageSmoothingEnabled = surface.data.kind === 'canvas' || !!surface.vector || surface.resolution > 1;
        ctx.imageSmoothingQuality = 'high';
        if (surface.vector) {
          ctx.save(); ctx.clip(surface.vector.silhouette);
          ctx.drawImage(surface.context.canvas, 0, 0, surface.logicalWidth, surface.logicalHeight); ctx.restore();
          ctx.fillStyle = hex(surface.data.color); ctx.fill(surface.vector.ink);
        } else ctx.drawImage(surface.context.canvas, 0, 0, surface.logicalWidth, surface.logicalHeight);
        ctx.restore();
      }
      ctx.restore();
      return;
    }
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
        this.add(mark.kind, shape ? 0x39483e : mark.color, mark, shape ? mark.color : undefined, false);
      } else if (mark.flood) {
        if (mark.points[0]) this.fill(mark.points[0], mark.color);
      } else {
        let previous = mark.points[0];
        for (const point of mark.points) { if (previous) this.brush(previous, point, mark.color, mark.erase); previous = point; }
      }
    }
  }
}


