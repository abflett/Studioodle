import type { StickerKind } from './stickerKinds';
import type { VectorDefinition } from './vectorDefinition';
import { decodeSvgDefinition } from './svgDefinition';
import { vectorStickerUrl } from './stickerUrls';

const sources = new Map<StickerKind, string>();
const definitions = new Map<StickerKind, VectorDefinition>();
const pending = new Map<StickerKind, Promise<void>>();
// Keep lightweight source text for synchronous re-decoding. The catalog bounds
// this cache; expensive lookup arrays have a separate LRU budget. Live artwork
// retains its own references when a definition leaves this reuse cache.
const maxCached = 24;
const maxLookupBytes = 64 * 1024 * 1024;
let lookupBytes = 0;

function cacheDefinition(kind: StickerKind, definition: VectorDefinition) {
  definitions.set(kind, definition);
  lookupBytes += definition.typedArrayBytes;
  while (definitions.size > maxCached || lookupBytes > maxLookupBytes) {
    const oldest = definitions.keys().next().value!;
    lookupBytes -= definitions.get(oldest)!.typedArrayBytes;
    definitions.delete(oldest);
  }
}

export async function prepareStickers(kinds: Iterable<StickerKind | 'canvas'>) {
  await Promise.all([...new Set(kinds)].filter((kind): kind is StickerKind => kind !== 'canvas').map(async kind => {
    if (definitions.has(kind)) return;
    if (sources.has(kind)) { vectorDefinition(kind); return; }
    const existing = pending.get(kind);
    if (existing) return existing;
    const svgUrl = vectorStickerUrl(kind);
    const loader = svgUrl && (async () => {
      const response = await fetch(svgUrl);
      if (!response.ok) throw new Error(`Unable to load sticker: ${kind}`);
      return response.text();
    });
    if (!loader) throw new Error(`Unknown sticker: ${kind}`);
    const task = loader().then(text => {
      sources.set(kind, text);
      vectorDefinition(kind);
    }).finally(() => pending.delete(kind));
    pending.set(kind, task);
    return task;
  }));
}

export function vectorDefinition(kind: StickerKind): VectorDefinition {
  const cached = definitions.get(kind);
  if (cached) {
    definitions.delete(kind); definitions.set(kind, cached);
    return cached;
  }
  const source = sources.get(kind);
  if (!source) throw new Error(`Sticker is not prepared: ${kind}`);
  const definition = decodeSvgDefinition(source);
  cacheDefinition(kind, definition);
  return definition;
}

export function releaseStickerDefinitions() { definitions.clear(); lookupBytes = 0; }
