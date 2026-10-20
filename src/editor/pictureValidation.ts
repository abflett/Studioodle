import { stickerRasterSettings } from './stickerRasterSettings';
import { isVectorSticker, vectorStickerSize } from './vectorCatalog';
import { paperSize, paintScale } from './document';
import { maximumStickerPaintPixels, paintScaleMultipliers } from './paintRaster';
import type { SavedPicture } from './savedPicture';
import type { ArtworkDocument } from './document';

export function isSavedPicture(value: unknown): value is SavedPicture {
  if (!value || typeof value !== 'object') return false;
  const picture = value as SavedPicture;
  return (picture.version === 3 || picture.version === 4) && picture.version === picture.document?.version && typeof picture.id === 'string' &&
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
    if ((doc.version !== 3 && doc.version !== 4) || !validSize(doc) || !Array.isArray(doc.surfaces) || !doc.surfaces.length)
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
        if(surface.vectorPaint!==undefined){
            if(doc.version!==4||surface.kind==='canvas'||!validVectorPaint(surface.vectorPaint)||!Array.isArray(surface.paint)||surface.paint.length)return false;
        }
        const settings = stickerRasterSettings(surface.kind);
        const density = surface.paintScale ?? 1;
        if (density > 4 && !settings) return false;
        const validDensity = settings?.pageAligned
            ? (Number.isFinite(density) && density >= .1 && density <= 4) || density === 8 // Read previous high-resolution trial saves.
            : paintScaleMultipliers.some(value => value === density);
        if (!validDensity || (surface.kind === 'canvas' && density !== 1)) return false;
        const size = surface.kind === 'canvas' ? doc : vectorStickerSize(surface.kind);
        const pixels = Math.ceil(size.width * paintScale() * density) * Math.ceil(size.height * paintScale() * density);
        if (density > 1 && pixels > (density === 8 && settings ? 32_000_000 : settings?.maximumPixels ?? maximumStickerPaintPixels)) return false;
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

function validVectorPaint(value: unknown): boolean {
    if(!value||typeof value!=='object')return false;
    const data=value as NonNullable<ArtworkDocument['surfaces'][number]['vectorPaint']>;
    if(data.version!==1||!Array.isArray(data.regions)||data.regions.length>65535)return false;
    const ids=new Set<number>();let nodes=0;
    const color=(n:number)=>Number.isInteger(n)&&n>=0&&n<=0xffffff;
    return data.regions.every(region=>{
        if(!region||!Number.isInteger(region.id)||region.id<1||region.id>65535||ids.has(region.id)||!color(region.base)||!Array.isArray(region.blobs))return false;
        ids.add(region.id);
        return region.blobs.every(blob=>blob&&color(blob.color)&&Array.isArray(blob.geometry)&&blob.geometry.every(polygon=>
            Array.isArray(polygon)&&polygon.length>0&&polygon.every(ring=>Array.isArray(ring)&&ring.length>=4&&ring.every(point=>
                ++nodes<=2_000_000&&Array.isArray(point)&&point.length===2&&point.every(n=>Number.isFinite(n)&&Math.abs(n)<=16384))&&
                ring[0]![0]===ring.at(-1)![0]&&ring[0]![1]===ring.at(-1)![1])));
    });
}
