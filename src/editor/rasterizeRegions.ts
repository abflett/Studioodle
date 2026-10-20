export type RegionPath = { id: number; path: Path2D; bounds: number[] };

/** Build shared categorical lookups once; separate alpha masks prevent blended IDs. */
export function rasterizeRegions(regions: RegionPath[], width: number, height: number, scale: number) {
  const mapWidth = Math.ceil(width * scale), mapHeight = Math.ceil(height * scale);
  if (!Number.isFinite(scale) || scale <= 0 || mapWidth * mapHeight > 64_000_000) throw new Error('Invalid region-map resolution');
  const maxId = Math.max(...regions.map(region => region.id));
  const labels = maxId <= 255 ? new Uint8Array(mapWidth * mapHeight) : new Uint16Array(mapWidth * mapHeight);
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
  // Release the temporary drawing backing; only the compact ID array survives.
  canvas.width = canvas.height = 1;
  const regionAt = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height
    ? labels[Math.floor(y * scale) * mapWidth + Math.floor(x * scale)]! : 0;
  return {
    regionAt, inRegion: (x: number, y: number, id: number) => id > 0 && regionAt(x, y) === id,
    contains: (x: number, y: number) => regionAt(x, y) > 0,
    typedArrayBytes: labels.byteLength, mapSize: { width: mapWidth, height: mapHeight, scale },
  };
}
