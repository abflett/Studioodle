import type { ArtworkChange } from './artworkChange';
import type { MultiPolygon } from './polygonGeometry';

type Resources = ReturnType<ArtworkChange['resources']>;
type Entry = { sequence: number; change: ArtworkChange; resources: Resources; retained: boolean };
export const undoMemoryBudget = 128 * 1024 * 1024;

/** Memory-bounded action history, with at most one historical compaction in flight. */
export class UndoHistory {
    private entries: Entry[] = [];
    private geometry = new Map<MultiPolygon, { references: number; bytes: number }>();
    private bytes = 0;
    private sequence = 0;
    private pending = new Set<Entry>();
    private timer?: ReturnType<typeof setTimeout>;
    private busy = false;
    constructor(private readonly budget = undoMemoryBudget) {}
    get retainedBytes() { return this.bytes; }
    get length() { return this.entries.length; }
    mark() { return this.sequence; }
    push(change: ArtworkChange) {
        if (change.empty) return;
        const entry = { sequence: ++this.sequence, change, resources: change.resources(), retained: true };
        this.entries.push(entry); this.retain(entry.resources);
        if(change.needsCompaction)this.pending.add(entry);
        this.trim(); this.schedule();
    }
    pop(after = 0) {
        const entry = this.entries.at(-1);
        if (!entry || entry.sequence <= after) return;
        this.entries.pop(); entry.retained=false; this.pending.delete(entry); this.release(entry.resources);
        return entry.change;
    }
    clear() {
        for(const entry of this.entries)entry.retained=false;
        this.entries = []; this.pending.clear(); this.geometry.clear(); this.bytes = 0;
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
    }
    private retain(resources: Resources) {
        this.bytes += resources.overhead;
        for (const [geometry, bytes] of resources.geometry) {
            const existing = this.geometry.get(geometry);
            if (existing) existing.references++;
            else { this.geometry.set(geometry, { references: 1, bytes }); this.bytes += bytes; }
        }
    }
    private release(resources: Resources) {
        this.bytes -= resources.overhead;
        for (const geometry of resources.geometry.keys()) {
            const existing = this.geometry.get(geometry)!;
            if (--existing.references === 0) { this.bytes -= existing.bytes; this.geometry.delete(geometry); }
        }
    }
    private trim() {
        while (this.bytes > this.budget && this.entries.length) {
            const entry=this.entries.shift()!; entry.retained=false; this.pending.delete(entry); this.release(entry.resources);
        }
    }
    private schedule() {
        if (this.busy || this.timer || !this.pending.size) return;
        this.timer = setTimeout(() => { this.timer = undefined; void this.compactNext(); }, 0);
    }
    private async compactNext() {
        const entry = this.pending.values().next().value;
        if (!entry) return;
        this.pending.delete(entry);
        this.busy = true;
        try {
            await entry.change.compact();
            if (entry.retained) {
                this.release(entry.resources); entry.resources = entry.change.resources();
                this.retain(entry.resources); this.trim();
            }
        } catch (error) {
            // A geometry failure must not destroy the valid previous painting.
            console.error('Undo compaction failed; the previous region state was preserved.', error);
        } finally { this.busy = false; this.schedule(); }
    }
    async settled() {
        while (this.busy || this.timer || this.pending.size) {
            this.schedule(); await new Promise(resolve => setTimeout(resolve, 5));
        }
    }
}
