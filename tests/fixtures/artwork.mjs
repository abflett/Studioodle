// In-memory artwork double: session tests exercise editing orchestration, not Canvas2D.
export class Artwork {
  constructor(document) { this.document = structuredClone(document); }
  static create(width, height) { return new Artwork({ version: 3, width, height, surfaces: [{ id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff, paint: [] }] }); }
  static restore(document) { return new Artwork(document); }
  serialize() { return structuredClone(this.document); }
  setFocus(id) { this.focused = id; }
  bounds(id) { return this.document.surfaces.some(s => s.id === id) ? { x: 0, y: 0, width: 10, height: 10 } : undefined; }
  selectionOrder() { return { forward: false, backward: false }; }
  fill(point, color) { const s = this.document.surfaces.find(s => s.id === this.focused) ?? this.document.surfaces[0]; s.paint.push([point.x, 1, color]); return true; }
  brush(from, to, color) { return this.fill(to, color); }
  add(kind, color, point) { const id = `sticker-${this.document.surfaces.length}`; this.document.surfaces.push({ id, kind, ...point, color, paint: [] }); return id; }
  remove(id) { this.document.surfaces = this.document.surfaces.filter(s => s.id !== id); }
  flip(id, axis) { const s = this.document.surfaces.find(s => s.id === id); const key = axis === 'horizontal' ? 'flipX' : 'flipY'; s[key] = !s[key]; return true; }
}
