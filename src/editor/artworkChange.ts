import { computePaint } from './paintWorker';
import type { SurfaceData } from './document';
import type { PaintSnapshot } from './vectorPaintTypes';
import type { MultiPolygon } from './polygonGeometry';

export type SurfaceBefore = { data: Omit<SurfaceData, 'vectorPaint'>; index: number; paint?: PaintSnapshot[] };
export type RegionBefore = { surfaceId: string; id: number; paint: PaintSnapshot };

/** Previous values for one action. Geometry is shared and never mutated in place. */
export class ArtworkChange {
    readonly surfaces = new Map<string, SurfaceBefore | undefined>();
    readonly regions = new Map<string, RegionBefore>();
    get empty() { return !this.surfaces.size && !this.regions.size; }
    private snapshots() {
        return [...this.regions.values()].map(region => region.paint)
            .concat([...this.surfaces.values()].flatMap(surface => surface?.paint ?? []));
    }
    get needsCompaction() { return this.snapshots().some(snapshot => snapshot.needsCompaction); }
    async compact() {
        const snapshots = this.snapshots().filter(snapshot => snapshot.needsCompaction && snapshot.region);
        if (!snapshots.length) return;
        const results = await computePaint({ regions: snapshots.map(snapshot => snapshot.region!) });
        for (let index = 0; index < snapshots.length; index++) {
            const snapshot = snapshots[index]!;
            if (results[index]) snapshot.region = results[index];
            snapshot.needsCompaction = false;
        }
    }
    /** Conservative JS-memory estimates, not serialized JSON sizes or heap telemetry. */
    resources() {
        const resources = new Map<MultiPolygon, number>();
        let overhead = 256 + this.surfaces.size * 256 + this.regions.size * 128;
        for (const surface of this.surfaces.values()) if (surface) overhead += surface.data.id.length * 2;
        for (const snapshot of this.snapshots()) {
            const region = snapshot.region;
            if (!region) continue;
            overhead += 128 + region.blobs.length * 96;
            for (const blob of region.blobs) if (!resources.has(blob.geometry)) {
                let bytes = 48 + blob.geometry.length * 8;
                for (const polygon of blob.geometry) {
                    bytes += 48 + polygon.length * 8;
                    for (const ring of polygon) bytes += 48 + ring.length * 72;
                }
                resources.set(blob.geometry, bytes);
            }
        }
        return { overhead, geometry: resources };
    }
}
