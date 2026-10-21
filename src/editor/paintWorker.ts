import { runPaintJob } from './vectorPaintGeometry';
import type { PaintJob, VectorPaintRegion } from './vectorPaintTypes';

type PaintResult = (VectorPaintRegion | undefined)[];
type Reply = { id: number } & ({ regions: PaintResult; error?: never } | { error: string; regions?: never });
type PendingJob = { resolve: (regions: PaintResult) => void; reject: (error: Error) => void };
let worker: Worker | undefined;
let nextJob = 0;
const jobs = new Map<number, PendingJob>();

/** One transport for the app; paint instances own their data and stale-result checks. */
export function preparePaintWorker() {
    if (typeof Worker === 'undefined' || worker) return;
    worker = new Worker(new URL('./vectorPaint.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<Reply>) => {
        const job = jobs.get(data.id);
        if (!job) return;
        jobs.delete(data.id);
        if (data.error !== undefined) job.reject(Error(data.error));
        else job.resolve(data.regions);
    };
    worker.onerror = () => {
        for (const job of jobs.values()) job.reject(Error('Vector paint worker failed'));
        jobs.clear();
        worker?.terminate();
        worker = undefined;
    };
}

export function computePaint(job: PaintJob): Promise<PaintResult> {
    if (typeof Worker === 'undefined') return Promise.resolve().then(() => runPaintJob(job));
    return new Promise((resolve, reject) => {
        preparePaintWorker();
        const id = ++nextJob;
        jobs.set(id, { resolve, reject });
        try { worker!.postMessage({ id, ...job }); }
        catch (error) { jobs.delete(id); reject(error); }
    });
}
