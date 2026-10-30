/** Browser-rasterized profile/color lookup for exactly one physical pixel/cell.
 * Geometry stays in the cell model; this is a disposable display cache. */
export function pixelLookup(paths: Path2D[], palette: string[]): Uint32Array {
  const atlas = document.createElement('canvas');
  atlas.width = 256; atlas.height = palette.length * palette.length;
  const ctx = atlas.getContext('2d', { willReadFrequently: true })!;
  for (let front = 0; front < palette.length; front++) for (let back = 0; back < palette.length; back++) {
    const row = front * palette.length + back;
    for (let profile = 0; profile < 256; profile++) {
      if (back) { ctx.fillStyle = palette[back]!; ctx.fillRect(profile, row, 1, 1); }
      ctx.setTransform(1, 0, 0, 1, profile, row);
      ctx.globalCompositeOperation = front ? 'source-over' : 'destination-out';
      ctx.fillStyle = front ? palette[front]! : '#000'; ctx.fill(paths[profile]!);
      ctx.resetTransform(); ctx.globalCompositeOperation = 'source-over';
    }
  }
  const image = ctx.getImageData(0, 0, atlas.width, atlas.height);
  return new Uint32Array(image.data.buffer);
}

export class PixelSurface {
  readonly image: ImageData;
  private pixels: Uint32Array;
  private left = Infinity;
  private top = Infinity;
  private right = -1;
  private bottom = -1;
  constructor(readonly width: number, readonly height: number, private lookup: Uint32Array, private colors: number) {
    this.image = new ImageData(width, height); this.pixels = new Uint32Array(this.image.data.buffer);
  }
  get byteLength() { return this.image.data.byteLength; }
  clear() {
    this.pixels.fill(0); this.left = this.top = 0; this.right = this.width - 1; this.bottom = this.height - 1;
  }
  set(index: number, profile: number, front: number, back: number) {
    this.pixels[index] = this.lookup[(front * this.colors + back) * 256 + profile]!;
    const x = index % this.width, y = Math.floor(index / this.width);
    this.left = Math.min(this.left, x); this.right = Math.max(this.right, x);
    this.top = Math.min(this.top, y); this.bottom = Math.max(this.bottom, y);
  }
  flush(ctx: CanvasRenderingContext2D) {
    if (this.right < this.left) return;
    ctx.putImageData(this.image, 0, 0, this.left, this.top, this.right - this.left + 1, this.bottom - this.top + 1);
    this.left = this.top = Infinity; this.right = this.bottom = -1;
  }
}
