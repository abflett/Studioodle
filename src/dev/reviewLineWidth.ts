import type { ReviewPoint } from './artworkReviewModel';

/** Bounded raster probe estimates nearby ink thickness; the exported repair stays vector. */
export function reviewInkProbe(image: HTMLImageElement, width: number, height: number) {
  const scale = Math.min(4, Math.sqrt(1_000_000 / (width * height)));
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const black = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;
    const i = (y * canvas.width + x) * 4;
    return pixels[i + 3]! > 128 && pixels[i]! < 100 && pixels[i + 1]! < 100 && pixels[i + 2]! < 100;
  };
  return (point: ReviewPoint) => {
    const px = Math.floor(point.x * scale), py = Math.floor(point.y * scale), radius = Math.ceil(8 * scale);
    let nearest: ReviewPoint | undefined, best = Infinity;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const distance = dx * dx + dy * dy;
      if (distance < best && black(px + dx, py + dy)) { nearest = { x: px + dx, y: py + dy }; best = distance; }
    }
    let result = Math.min(width, height) / 160;
    if (nearest) {
      const lengths = [[1, 0], [0, 1], [1, 1], [1, -1]].map(([dx, dy]) => {
        let count = 1;
        for (const direction of [-1, 1]) for (let step = 1; step < radius * 2; step++) {
          if (!black(nearest!.x + direction * step * dx!, nearest!.y + direction * step * dy!)) break;
          count++;
        }
        return count * Math.hypot(dx!, dy!) / scale;
      });
      result = Math.min(...lengths);
    }
    return +Math.max(.1, Math.min(32, result)).toFixed(2);
  };
}
