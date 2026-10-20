import { drawVectorInk } from './vectorDefinition';
import type { InkCommand } from './vectorDefinition';

export type RegionPath = { id: number; path: Path2D; bounds: number[]; geometry?: () => import('polygon-clipping').MultiPolygon };

/** Build shared categorical lookups once; separate alpha masks prevent blended IDs. */
export function rasterizeRegions(regions: RegionPath[], width: number, height: number, scale: number, ink: InkCommand[] = []) {
  const mapWidth = Math.ceil(width * scale), mapHeight = Math.ceil(height * scale);
  if (!Number.isFinite(scale) || scale <= 0 || mapWidth * mapHeight > 64_000_000) throw new Error('Invalid region-map resolution');
  const maxId = Math.max(...regions.map(region => region.id));
  // Reserve a marker for visible ink with no adjacent fillable region.
  const inkOnly = maxId + 1;
  const labels = inkOnly <= 255 ? new Uint8Array(mapWidth * mapHeight) : inkOnly <= 65535 ? new Uint16Array(mapWidth * mapHeight) : new Uint32Array(mapWidth * mapHeight);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Region rasterization is unavailable');
  for (const region of regions) {
    const left = Math.max(0, Math.floor(region.bounds[0]! * scale) - 1);
    const top = Math.max(0, Math.floor(region.bounds[1]! * scale) - 1);
    const right = Math.min(mapWidth, Math.ceil(region.bounds[2]! * scale) + 1);
    const bottom = Math.min(mapHeight, Math.ceil(region.bounds[3]! * scale) + 1);
    const w = right - left, h = bottom - top;
    if (w <= 0 || h <= 0) continue;
    canvas.width = w; canvas.height = h;
    ctx.setTransform(scale, 0, 0, scale, -left, -top);
    ctx.fillStyle = 'black'; ctx.fill(region.path);
    const pixels = ctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) {
      let target = (top + y) * mapWidth + left;
      for (let x = 0; x < w; x++, target++) {
        // Preserve first-path precedence at the rare overlap; never decode color mixtures.
        if (pixels[(y * w + x) * 4 + 3]! >= 128 && !labels[target]) labels[target] = region.id;
      }
    }
  }
  const inkPixels = new Uint8Array(ink.length ? Math.ceil(labels.length / 8) : 0);
  if (ink.length) {
    canvas.width = mapWidth; canvas.height = mapHeight;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawVectorInk(ctx, { ink }, 'black');
    const pixels = ctx.getImageData(0, 0, mapWidth, mapHeight).data;
    for (let i = 0; i < labels.length; i++) if (!labels[i] && pixels[i * 4 + 3]! >= 32) { labels[i] = inkOnly; inkPixels[i >> 3]! |= 1 << (i & 7); }
    // Visible linework belongs to this sticker, including the outer half of an
    // outline. Propagate the nearest region only through actual ink pixels.
    const queue = new Int32Array(labels.length);
    let head = 0, tail = 0;
    for (let i = 0; i < labels.length; i++) {
      if (!labels[i] || labels[i] === inkOnly) continue;
      const x = i % mapWidth;
      if ((x && labels[i - 1] === inkOnly) || (x + 1 < mapWidth && labels[i + 1] === inkOnly) ||
          (i >= mapWidth && labels[i - mapWidth] === inkOnly) || (i + mapWidth < labels.length && labels[i + mapWidth] === inkOnly)) queue[tail++] = i;
    }
    while (head < tail) {
      const i = queue[head++]!, x = i % mapWidth;
      const visit = (next: number) => { if (labels[next] === inkOnly) { labels[next] = labels[i]!; queue[tail++] = next; } };
      if (x) visit(i - 1);
      if (x + 1 < mapWidth) visit(i + 1);
      if (i >= mapWidth) visit(i - mapWidth);
      if (i + mapWidth < labels.length) visit(i + mapWidth);
    }
  }
  // Release the temporary drawing backing; only the compact ID array and ink-only bits survive.
  canvas.width = canvas.height = 1;
  const labelAt = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height
    ? labels[Math.floor(y * scale) * mapWidth + Math.floor(x * scale)]! : 0;
  const hitRegionAt = (x: number, y: number) => { const id = labelAt(x, y); return id === inkOnly ? 0 : id; };
  const regionAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    const index = Math.floor(y * scale) * mapWidth + Math.floor(x * scale);
    return inkPixels[index >> 3]! & (1 << (index & 7)) ? 0 : labels[index]!;
  };
  return {
    regionAt, hitRegionAt, inRegion: (x: number, y: number, id: number) => id > 0 && regionAt(x, y) === id,
    contains: (x: number, y: number) => labelAt(x, y) > 0,
    typedArrayBytes: labels.byteLength + inkPixels.byteLength, mapSize: { width: mapWidth, height: mapHeight, scale },
  };
}
