import type { StickerKind } from './stickerKinds';
import type { VectorDefinition } from './vectorDefinition';
import { decodeSvgDefinition } from './svgDefinition';
import { vectorStickerUrl } from './stickerUrls';

const sources = new Map<StickerKind, string>();
const definitions = new Map<StickerKind, VectorDefinition>();
// Weak references share definitions still owned by open artwork, without pinning evicted maps.
const live = new Map<StickerKind, WeakRef<VectorDefinition>>();
const pending = new Map<StickerKind, Promise<void>>();
// Source text supports synchronous undo/restoration while editing. Drop it when
// the editor closes; active previews can still share their live definitions.
const maxCached = 24;
const maxLookupBytes = 64 * 1024 * 1024;
let lookupBytes = 0;

function cacheDefinition(kind: StickerKind, definition: VectorDefinition) {
  lookupBytes -= definitions.get(kind)?.typedArrayBytes ?? 0;
  definitions.delete(kind);definitions.set(kind, definition);
  live.set(kind,new WeakRef(definition));
  lookupBytes += definition.typedArrayBytes;
  while (definitions.size > maxCached || lookupBytes > maxLookupBytes) {
    const oldest = definitions.keys().next().value!;
    lookupBytes -= definitions.get(oldest)!.typedArrayBytes;
    definitions.delete(oldest);
  }
}

export async function prepareStickers(kinds: Iterable<StickerKind | 'canvas'>) {
  await Promise.all([...new Set(kinds)].filter((kind): kind is StickerKind => kind !== 'canvas').map(async kind => {
    const existingDefinition = definitions.get(kind) ?? live.get(kind)?.deref();
    if (existingDefinition) { cacheDefinition(kind, existingDefinition); return; }
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
  const cached = definitions.get(kind) ?? live.get(kind)?.deref();
  if (cached) {
    cacheDefinition(kind,cached);
    return cached;
  }
  const source = sources.get(kind);
  if (!source) throw new Error(`Sticker is not prepared: ${kind}`);
  const definition = decodeSvgDefinition(source);
  cacheDefinition(kind, definition);
  return definition;
}

export function releaseStickerDefinitions() {
  definitions.clear(); sources.clear(); lookupBytes = 0;
  for(const [kind,reference] of live)if(!reference.deref())live.delete(kind);
}
