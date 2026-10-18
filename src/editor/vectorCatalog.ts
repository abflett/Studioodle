import catalogSource from '../assets/vector/catalog.json?raw';
import type { StickerKind } from './stickerKinds';

export const vectorCatalog = JSON.parse(catalogSource) as Record<StickerKind, {
    width: number;
    height: number;
    horizon?: boolean;
    horizonStart?: number;
}>;
export function isVectorSticker(kind: string): kind is StickerKind { return Object.hasOwn(vectorCatalog, kind); }
export function vectorStickerSize(kind: StickerKind) { return vectorCatalog[kind]; }
