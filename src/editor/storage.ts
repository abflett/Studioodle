import { isVectorSticker, vectorStickerSize } from './vectorStickers';
import { paperSize, paintScale } from './document';
import type { EditorSetup } from './setup';
import type { ArtworkDocument } from './document';
export type SavedPicture = EditorSetup & {
    id: string;
    version: 3;
    updatedAt: number;
    document: ArtworkDocument;
};
const prefix = 'studioodle.v3.picture.';
export function deletePicture(id: string) { localStorage.removeItem(prefix + id); }
export function savePicture(picture: SavedPicture) { localStorage.setItem(prefix + picture.id, JSON.stringify(picture)); }
export function loadPictures(): SavedPicture[] {
    const pictures: SavedPicture[] = [];
    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (!key?.startsWith(prefix))
            continue;
        try {
            const picture = JSON.parse(localStorage.getItem(key) ?? 'null') as SavedPicture | null;
            if (picture && picture.version === 3 && typeof picture.id === 'string' && key === prefix + picture.id &&
                typeof picture.title === 'string' && typeof picture.background === 'string' && /^#[0-9a-f]{6}$/i.test(picture.background) &&
                ['square', 'landscape', 'portrait'].includes(picture.format) && validSize(picture.size) && Number.isFinite(picture.leafColor) && Number.isFinite(picture.updatedAt) &&
                isArtworkDocument(picture.document) && picture.document.width === paperSize(picture.format, picture.size).width && picture.document.height === paperSize(picture.format, picture.size).height)
                pictures.push(picture);
        }
        catch { /* An unreadable picture must not hide the rest of the library. */ }
    }
    return pictures.sort((a, b) => b.updatedAt - a.updatedAt);
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
        const size = surface.kind === 'canvas' ? doc : vectorStickerSize(surface.kind);
        const pixels = Math.ceil(size.width * paintScale()) * Math.ceil(size.height * paintScale());
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
