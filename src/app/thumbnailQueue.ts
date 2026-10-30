/** One running generation plus the latest waiting selection; bitmap reads bypass it. */
export function createThumbnailQueue<T>() {
  type Task = { work: () => Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void; cleanup: () => void };
  let active = false, pending: Task | undefined;
  const start = (task: Task) => {
    active = true;
    void Promise.resolve().then(task.work).then(task.resolve, task.reject).finally(() => {
      task.cleanup(); active = false;
      const next = pending; pending = undefined;
      if (next) start(next);
    });
  };
  return {
    stats: () => ({ active, pending: !!pending }),
    run(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(signal.reason); return; }
        const task: Task = { work, resolve, reject, cleanup: () => signal?.removeEventListener('abort', abort) };
        const abort = () => { if (pending === task) pending = undefined; reject(signal?.reason ?? new DOMException('Preview cancelled', 'AbortError')); task.cleanup(); };
        signal?.addEventListener('abort', abort, { once: true });
        if (!active) start(task);
        else {
          if (pending) { pending.reject(new DOMException('A newer preview was selected', 'AbortError')); pending.cleanup(); }
          pending = task;
        }
      });
    },
  };
}
