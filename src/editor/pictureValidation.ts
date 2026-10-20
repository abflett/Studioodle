import { stickerRasterSettings } from './stickerRasterSettings';
import { isVectorSticker, vectorStickerSize } from './vectorCatalog';
import { paperSize, paintScale } from './document';
import { maximumStickerPaintPixels, paintScaleMultipliers } from './paintRaster';
import type { SavedPicture } from './savedPicture';
import type { ArtworkDocument } from './document';

export function isSavedPicture(value: unknown): value is SavedPicture {
  if (!value || typeof value !== 'object') return false;
  const picture = value as SavedPicture;
  return picture.version === 3 && typeof picture.id === 'string' &&
    typeof picture.title === 'string' && typeof picture.background === 'string' && /^#[0-9a-f]{6}$/i.test(picture.background) &&
    ['square', 'landscape', 'portrait'].includes(picture.format) && validSize(picture.size) && Number.isFinite(picture.leafColor) && Number.isFinite(picture.updatedAt) &&
    isArtworkDocument(picture.document) && picture.document.width === paperSize(picture.format, picture.size).width && picture.document.height === paperSize(picture.format, picture.size).height;
}

function validSize(value: unknown): value is {
    width: number;
    height: number;
} {
    if (!value || typeof value !== 'object')
        return false;
    const size = value as {
        width: number;
        height: number;
    };
    return Number.isInteger(size.width) && Number.isInteger(size.height) && size.width > 0 && size.height > 0 && size.width <= 8192 && size.height <= 8192 && size.width * size.height <= 16777216;
}
function isArtworkDocument(value: unknown): value is ArtworkDocument {
    if (!value || typeof value !== 'object')
        return false;
    const doc = value as ArtworkDocument;
    if (doc.version !== 3 || !validSize(doc) || !Array.isArray(doc.surfaces) || !doc.surfaces.length)
        return false;
    const ids = new Set<string>();
    return doc.surfaces.every((surface, order) => {
        if (!surface || typeof surface.id !== 'string' || ids.has(surface.id))
            return false;
        ids.add(surface.id);
        if (order === 0 ? surface.kind !== 'canvas' : !isVectorSticker(surface.kind))
            return false;
        if (![surface.x, surface.y, surface.color].every(Number.isFinite) || !Number.isInteger(surface.color) || surface.color < 0 || surface.color > 0xffffff)
            return false;
        if (surface.scale !== undefined && (!Number.isFinite(surface.scale) || surface.scale <= 0 || surface.scale > 4))
            return false;
        if (surface.rotation !== undefined && (!Number.isFinite(surface.rotation) || surface.rotation < 0 || surface.rotation >= 360))
            return false;
        if ((surface.flipX !== undefined && typeof surface.flipX !== 'boolean') || (surface.flipY !== undefined && typeof surface.flipY !== 'boolean'))
            return false;
        if (surface.kind === 'canvas' && (surface.flipX || surface.flipY))
            return false;
        if (surface.kind === 'canvas' && ((surface.scale ?? 1) !== 1 || (surface.rotation ?? 0) !== 0))
            return false;
        const settings = stickerRasterSettings(surface.kind);
        const density = surface.paintScale ?? 1;
        if (density > 4 && !settings) return false;
        if (!paintScaleMultipliers.some(value => value === density) || (surface.kind === 'canvas' && density !== 1)) return false;
        const size = surface.kind === 'canvas' ? doc : vectorStickerSize(surface.kind);
        const pixels = Math.ceil(size.width * paintScale() * density) * Math.ceil(size.height * paintScale() * density);
        if (density > 1 && pixels > (settings?.maximumPixels ?? maximumStickerPaintPixels)) return false;
        if (!Array.isArray(surface.paint))
            return false;
        let end = 0;
        return surface.paint.every(run => {
            if (!Array.isArray(run) || run.length !== 3 || !run.every(Number.isInteger))
                return false;
            const [start, length, color] = run;
            if (start < end || length < 1 || start + length > pixels || color < 0 || color > 0xffffff)
                return false;
            end = start + length;
            return true;
        });
    });
}
