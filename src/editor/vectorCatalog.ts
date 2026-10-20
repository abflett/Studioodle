import catalogSource from '../assets/vector/catalog.json?raw';
import type { StickerKind } from './stickerKinds';

export const vectorCatalog = JSON.parse(catalogSource) as Record<StickerKind, {
    width: number;
    height: number;
    interior?: boolean;
    horizon?: boolean;
    horizonStart?: number;
    horizonOverscan?: number;
}>;
export function isVectorSticker(kind: string): kind is StickerKind { return Object.hasOwn(vectorCatalog, kind); }
export function vectorStickerSize(kind: StickerKind) { return vectorCatalog[kind]; }

const svgUrls = import.meta.glob<string>('../assets/vector/*.svg', { eager: true, query: '?url&no-inline', import: 'default' });
export function vectorStickerUrl(kind: StickerKind) { return svgUrls[`../assets/vector/${kind}.svg`]; }
