import { validRasterSpray } from './rasterSpray';
import { definedColor, validCustomColors } from './colorPalettes';
import type { PictureSummary } from './pictureSummary';
import { isVectorSticker } from './vectorCatalog';
import { paperSize } from './document';
import type { SavedPicture } from './savedPicture';
import type { ArtworkDocument } from './document';

export function isPictureSummary(value: unknown): value is PictureSummary {
  if (!value || typeof value !== 'object') return false;
  const picture = value as PictureSummary;
  return typeof picture.id === 'string' && picture.id.length > 0 && typeof picture.title === 'string' &&
    typeof picture.background === 'string' && /^#[0-9a-f]{6}$/i.test(picture.background) &&
    (!('printSizeMm' in picture) || picture.printSizeMm === undefined || validPrintSize(picture.printSizeMm,picture.size)) &&
    ['square', 'landscape', 'portrait'].includes(picture.format) && validSize(picture.size) &&
    Number.isInteger(picture.leafColor) && picture.leafColor >= 0 && picture.leafColor <= 0xffffff && Number.isFinite(picture.updatedAt);
}

export function isSavedPicture(value: unknown): value is SavedPicture {
  if (!isPictureSummary(value)) return false;
  const picture = value as SavedPicture;
  return picture.version === 6 && picture.version === picture.document?.version && isArtworkDocument(picture.document) &&
    picture.document.width === paperSize(picture.format, picture.size).width && picture.document.height === paperSize(picture.format, picture.size).height;
}

function validPrintSize(value: unknown, logical: unknown): boolean {
  if(!value||typeof value!=='object')return false;
  const size=value as {width:number;height:number};
  return [size.width,size.height].every(n=>Number.isFinite(n)&&n>=1&&n<=2500) && validSize(logical) && Math.abs((size.width/size.height)/(logical.width/logical.height)-1)<.002;
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
    if (doc.version !== 6 || !validSize(doc) || !Array.isArray(doc.surfaces) || !doc.surfaces.length || doc.paletteVersion !== undefined && doc.paletteVersion !== 1 || doc.customColors !== undefined && !validCustomColors(doc.customColors))
        return false;
    const ids = new Set<string>();
    return doc.surfaces.every((surface, order) => {
        if (!surface || typeof surface.id !== 'string' || ids.has(surface.id))
            return false;
        ids.add(surface.id);
        if (order === 0 ? surface.kind !== 'canvas' : !isVectorSticker(surface.kind))
            return false;
        if (![surface.x, surface.y, surface.color].every(Number.isFinite) || Math.abs(surface.x) > 16384 || Math.abs(surface.y) > 16384 || !Number.isInteger(surface.color) || !definedColor(surface.color, doc.customColors ?? Array(32).fill(null)) || surface.kind === 'canvas' && surface.color < 0)
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
        if (surface.rasterSpray !== undefined && !validRasterSpray(surface.rasterSpray)) return false;
        if('paint' in surface || 'paintScale' in surface)return false;
        return surface.vectorPaint===undefined || validVectorPaint(surface.vectorPaint, doc.customColors ?? Array(32).fill(null));
    });
}

function validVectorPaint(value: unknown, custom: readonly (number | null)[]): boolean {
    if(!value||typeof value!=='object')return false;
    const data=value as NonNullable<ArtworkDocument['surfaces'][number]['vectorPaint']>;
    if(data.version!==1||!Array.isArray(data.regions)||data.regions.length>65535)return false;
    const ids=new Set<number>();let nodes=0;
    const color=(n:number)=>definedColor(n, custom);
    return data.regions.every(region=>{
        if(!region||!Number.isInteger(region.id)||region.id<1||region.id>65535||ids.has(region.id)||!color(region.base)||!Array.isArray(region.blobs))return false;
        ids.add(region.id);
        if(region.pattern!==undefined&&!validPattern(region.pattern))return false;
        return region.blobs.every(blob=>blob&&color(blob.color)&&(blob.pattern===undefined||validPattern(blob.pattern))&&Array.isArray(blob.geometry)&&blob.geometry.every(polygon=>
            Array.isArray(polygon)&&polygon.length>0&&polygon.every(ring=>Array.isArray(ring)&&ring.length>=4&&ring.every(point=>
                ++nodes<=2_000_000&&Array.isArray(point)&&point.length===2&&point.every(n=>Number.isFinite(n)&&Math.abs(n)<=16384))&&
                ring[0]![0]===ring.at(-1)![0]&&ring[0]![1]===ring.at(-1)![1])));
    });
}

function validPattern(value: unknown): boolean {
    if(!value||typeof value!=='object')return false;
    const pattern=value as {pattern:string;spacing:number};
    return ['solid','dots','stripes','checker'].includes(pattern.pattern)&&Number.isFinite(pattern.spacing)&&pattern.spacing>=4&&pattern.spacing<=128;
}
