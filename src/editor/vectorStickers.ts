import type { StickerKind } from './stickerKinds';
import type { VectorDefinition } from './vectorDefinition';
import { decodeSvgDefinition } from './svgDefinition';
import { vectorStickerUrl } from './vectorCatalog';

const sources = new Map<StickerKind, string>();
const definitions = new Map<StickerKind, VectorDefinition>();
const pending = new Map<StickerKind, Promise<void>>();
const maxCached = 24;

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
      while (sources.size > maxCached) sources.delete(sources.keys().next().value!);
    }).finally(() => pending.delete(kind));
    pending.set(kind, task);
    return task;
  }));
}

export function vectorDefinition(kind: StickerKind): VectorDefinition {
  const cached = definitions.get(kind);
  if (cached) {
    const source = sources.get(kind);
    if (source) { sources.delete(kind); sources.set(kind, source); }
    return cached;
  }
  const source = sources.get(kind);
  if (!source) throw new Error(`Sticker is not prepared: ${kind}`);
  const definition = decodeSvgDefinition(source);
  definitions.set(kind, definition);
  return definition;
}

export function releaseStickerDefinitions() { definitions.clear(); }
