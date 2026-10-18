import catalogSource from '../assets/vector/catalog.json?raw';
import type { StickerKind } from './stickerKinds';
type Command = {
    d: string;
    fill: 'base' | 'ink' | 'none';
    stroke: boolean;
    width: number;
};
type Source = {
    bounds: { left: number; top: number; right: number; bottom: number };
    width: number;
    height: number;
    regionScale: number;
    regionCount: number;
    regionRuns: string;
    hitCoverage: string;
    commands: Command[];
    matrix: number[];
    silhouettePaths: string[];
    silhouetteMatrix: number[];
};
type InkCommand = {
    path: Path2D;
    fill: boolean;
    stroke: boolean;
    width: number;
    clips: Path2D[];
};
export type VectorDefinition = {
    bounds: { left: number; top: number; right: number; bottom: number };
    width: number;
    height: number;
    regionScale: number;
    regionWidth: number;
    regions: Uint16Array;
    hitCoverage: Uint8Array;
    silhouette: Path2D;
    ink: InkCommand[];
};
const catalog = JSON.parse(catalogSource) as Record<StickerKind, {
    width: number;
    height: number;
    horizon?: boolean;
    horizonStart?: number;
}>;
const files = import.meta.glob<string>('../assets/vector/*.json', { query: '?raw', import: 'default' });
const sources = new Map<StickerKind, Source>();
const definitions = new Map<StickerKind, VectorDefinition>();
const pending = new Map<StickerKind, Promise<void>>();
const maxCached = 24;
export function isVectorSticker(kind: string): kind is StickerKind { return Object.hasOwn(catalog, kind); }
export function vectorStickerSize(kind: StickerKind) { return catalog[kind]; }
export async function prepareStickers(kinds: Iterable<StickerKind | 'canvas'>) {
    await Promise.all([...new Set(kinds)].filter((kind): kind is StickerKind => kind !== 'canvas').map(async (kind) => {
        if (definitions.has(kind))
            return;
        if (sources.has(kind)) {
            vectorDefinition(kind);
            return;
        }
        const existing = pending.get(kind);
        if (existing)
            return existing;
        const loader = files[`../assets/vector/${kind}.json`];
        if (!loader)
            throw new Error(`Unknown sticker: ${kind}`);
        const task = loader().then(text => {
            sources.set(kind, JSON.parse(text) as Source);
            vectorDefinition(kind);
            while (sources.size > maxCached) {
                const oldest = sources.keys().next().value!;
                sources.delete(oldest);
            }
        }).finally(() => pending.delete(kind));
        pending.set(kind, task);
        return task;
    }));
}
export function vectorDefinition(kind: StickerKind): VectorDefinition {
    const cached = definitions.get(kind);
    if (cached) {
        const source = sources.get(kind);
        if (source) {
            sources.delete(kind);
            sources.set(kind, source);
        }
        return cached;
    }
    const source = sources.get(kind);
    if (!source)
        throw new Error(`Sticker is not prepared: ${kind}`);
    const bytes = Uint8Array.from(atob(source.regionRuns), c => c.charCodeAt(0)), view = new DataView(bytes.buffer);
    const regionWidth = source.width * source.regionScale;
    const regions = new Uint16Array(regionWidth * source.height * source.regionScale);
    let cursor = 0;
    for (let i = 0; i < bytes.length; i += 8) {
        const n = view.getUint32(i, true), id = view.getUint32(i + 4, true);
        regions.fill(id, cursor, cursor + n);
        cursor += n;
    }
    if (cursor !== regions.length)
        throw new Error(`Invalid regions: ${kind}`);
    const path = (d: string, matrix: number[]) => { const p = new Path2D(); p.addPath(new Path2D(d), new DOMMatrix(matrix)); return p; };
    const silhouette = new Path2D();
    for (const d of source.silhouettePaths)
        silhouette.addPath(path(d, source.silhouetteMatrix));
    const paths = source.commands.map(c => path(c.d, source.matrix));
    const ink = source.commands.map((c, i): InkCommand => ({
        path: paths[i]!, fill: c.fill === 'ink', stroke: c.stroke,
        width: c.width * (Math.abs(source.matrix[0]!) + Math.abs(source.matrix[3]!)) / 2,
        clips: source.commands.flatMap((later, j) => {
            if (j <= i || later.fill !== 'base')
                return [];
            const inverse = new Path2D();
            inverse.rect(-100, -100, source.width + 200, source.height + 200);
            inverse.addPath(paths[j]!);
            return [inverse];
        }),
    }));
    const definition = { width: source.width, height: source.height, bounds: source.bounds, regionScale: source.regionScale, regionWidth, regions, hitCoverage: Uint8Array.from(atob(source.hitCoverage), c => c.charCodeAt(0)), silhouette, ink };
    definitions.set(kind, definition);
    return definition;
}
export function drawVectorInk(ctx: CanvasRenderingContext2D, definition: VectorDefinition, color: string, thumbnail = false) {
    ctx.fillStyle = ctx.strokeStyle = color;
    ctx.lineCap = ctx.lineJoin = 'round';
    const transform = ctx.getTransform();
    const unit = Math.max(.0001, Math.hypot(transform.a, transform.b));
    const minimum = thumbnail ? window.devicePixelRatio / unit : 0;
    for (const command of definition.ink) {
        ctx.save();
        for (const clip of command.clips)
            ctx.clip(clip, 'evenodd');
        if (command.fill) {
            ctx.fill(command.path);
            if (thumbnail) { ctx.lineWidth = minimum * .35; ctx.stroke(command.path); }
        }
        if (command.stroke) {
            ctx.lineWidth = Math.max(command.width, minimum);
            ctx.stroke(command.path);
        }
        ctx.restore();
    }
}
export function bitAt(bits: Uint8Array, index: number) { return (bits[index >> 3]! & (1 << (index & 7))) !== 0; }
export function releaseStickerDefinitions() { definitions.clear(); }
