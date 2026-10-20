import { paintScale } from './document';

export const maximumStickerPaintPixels = 8_000_000;
export const paintScaleMultipliers = [1, 2, 4, 8] as const;

/** Grow in a few bounded steps; never downsample already-painted detail. */
export function stickerPaintScale(width: number, height: number, scale: number, current = 1, settings?: { minimumScale: number; maximumPixels: number }) {
    let factor = current;
    const desired = Math.max(settings?.minimumScale ?? 1, Math.min(4, Math.max(1, scale)));
    while (factor < desired) {
        const next = factor * 2, resolution = paintScale() * next;
        if (Math.ceil(width * resolution) * Math.ceil(height * resolution) > (settings?.maximumPixels ?? maximumStickerPaintPixels)) break;
        factor = next;
    }
    return factor;
}

/** Reconstruct solid fills; preserve mixed raster paint with categorical sampling. */
export function resizeStickerPaint(oldPaint: Uint32Array, oldWidth: number, oldHeight: number, oldResolution: number,
    width: number, height: number, resolution: number, regionAt: (x: number, y: number) => number) {
    const paint = new Uint32Array(width * height);
    const uniform = new Map<number, number>();
    for (let y = 0; y < oldHeight; y++) for (let x = 0; x < oldWidth; x++) {
        const id = regionAt(x / oldResolution, y / oldResolution);
        if (!id) continue;
        const value = oldPaint[y * oldWidth + x]!;
        uniform.set(id, !uniform.has(id) || uniform.get(id) === value ? value : -1);
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const lx = (x + .5) / resolution, ly = (y + .5) / resolution;
        const region = regionAt(x / resolution, y / resolution);
        if (!region) continue;
        const solid = uniform.get(region);
        if (solid !== undefined && solid >= 0) {
            paint[y * width + x] = solid;
            continue;
        }
        const sx = Math.min(oldWidth - 1, Math.floor(lx * oldResolution));
        const sy = Math.min(oldHeight - 1, Math.floor(ly * oldResolution));
        // Nearest-neighbor paint, constrained to the original SVG region.
        // A neighboring unpainted region must never inherit this color.
        if (regionAt(sx / oldResolution, sy / oldResolution) === region) {
            paint[y * width + x] = oldPaint[sy * oldWidth + sx]!;
        } else {
            let nearest = Infinity, value = 0;
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
                const ox = sx + dx, oy = sy + dy;
                if (ox < 0 || oy < 0 || ox >= oldWidth || oy >= oldHeight) continue;
                const distance = (ox + .5 - lx * oldResolution) ** 2 + (oy + .5 - ly * oldResolution) ** 2;
                if (distance < nearest && regionAt(ox / oldResolution, oy / oldResolution) === region) {
                    nearest = distance; value = oldPaint[oy * oldWidth + ox]!;
                }
            }
            paint[y * width + x] = value;
        }
    }
    return paint;
}
