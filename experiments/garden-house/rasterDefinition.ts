import type { InkCommand, VectorDefinition } from '../../src/editor/vectorDefinition';

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
export function decodeRasterDefinition(text: string): VectorDefinition {
    const source = JSON.parse(text) as Source;
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
        throw new Error('Invalid regions');
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
    const hitCoverage = Uint8Array.from(atob(source.hitCoverage), c => c.charCodeAt(0));
    const regionIndex = (x: number, y: number) => Math.min(source.height * source.regionScale - 1, Math.floor(y * source.regionScale)) * regionWidth + Math.min(regionWidth - 1, Math.floor(x * source.regionScale));
    const regionAt = (x: number, y: number) => regions[regionIndex(x, y)] ?? 0;
    const definition: VectorDefinition = { width: source.width, height: source.height, bounds: source.bounds, regionCount: source.regionCount, format: 'raster', lookup: 'raster', mapSize: { width: regionWidth, height: source.height * source.regionScale, scale: source.regionScale }, typedArrayBytes: regions.byteLength + hitCoverage.byteLength,
      regionAt, inRegion: (x, y, id) => regionAt(x, y) === id,
      contains: (x, y) => bitAt(hitCoverage, regionIndex(x, y)), silhouette, ink };
    return definition;
}

function bitAt(bits: Uint8Array, index: number) { return (bits[index >> 3]! & (1 << (index & 7))) !== 0; }
