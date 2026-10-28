import { ArtworkChange } from '../../src/editor/artworkChange';
// In-memory artwork double: session tests exercise editing orchestration, not Canvas2D.
export class Artwork {
  constructor(document) { this.document = structuredClone(document); }
  static create(width, height) { return new Artwork({ version: 6, width, height, surfaces: [{ id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0xffffff }] }); }
  static restore(document) { return new Artwork(document); }
  async compactPaint() {}
  dispose() { this.before=undefined; }
  // This orchestration double deliberately uses whole states; browser tests cover
  // the production region journal and its worker/memory behavior.
  beginChange() { if(this.before)throw Error('Nested test change');this.before=structuredClone(this.document); }
  endChange() {
    const change=new ArtworkChange(),before=this.before;this.before=undefined;
    if(before&&JSON.stringify(before)!==JSON.stringify(this.document)){
      change.surfaces.set('test-document',{data:{id:'test-document'},index:0});
      change.beforeDocument=before;
    }
    return change;
  }
  undoChange(change) { if(change.beforeDocument)this.document=structuredClone(change.beforeDocument); }

  serialize() { return structuredClone(this.document); }
  checkpoint() { const document = this.serialize(); return { document, compact: async () => document }; }
  setFocus(id) { this.focused = id; }
  bounds(id) { return this.document.surfaces.some(s => s.id === id) ? { x: 0, y: 0, width: 10, height: 10 } : undefined; }
  selectionOrder() { return { forward: false, backward: false }; }
  fill(point, color) { const s = this.document.surfaces.find(s => s.id === this.focused) ?? this.document.surfaces[0];
    s.vectorPaint??={version:1,regions:[{id:1,base:0xffffff,blobs:[]}]};
    s.vectorPaint.regions[0].blobs.push({color,geometry:[[[[point.x,point.y],[point.x+1,point.y],[point.x+1,point.y+1],[point.x,point.y+1],[point.x,point.y]]]]});return true; }
  brush(from, to, color) { return this.fill(to, color); }
  add(kind, color, point) { const id = `sticker-${this.document.surfaces.length}`; this.document.surfaces.push({ id, kind, ...point, color }); return id; }
  remove(id) { this.document.surfaces = this.document.surfaces.filter(s => s.id !== id); }
  flip(id, axis) { const s = this.document.surfaces.find(s => s.id === id); const key = axis === 'horizontal' ? 'flipX' : 'flipY'; s[key] = !s[key]; return true; }
}
