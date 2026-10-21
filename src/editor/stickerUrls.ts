import type { StickerKind } from './stickerKinds';

// Asset addressing is separate from metadata-only document validation.
const svgUrls = import.meta.glob<string>('../assets/vector/*.svg', { eager: true, query: '?url&no-inline', import: 'default' });
export function vectorStickerUrl(kind: StickerKind) { return svgUrls[`../assets/vector/${kind}.svg`]; }
