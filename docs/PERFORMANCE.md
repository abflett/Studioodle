# Performance and memory

Current design and retained conclusions from the 21 October 2026 investigations.
Earlier renderer reports and full measurement tables are available in Git history.
Measurements are workload-specific, not tablet performance or total-memory promises.

## Display caches

Complex vector surfaces share a 64 MiB disposable pixel-cache budget. The planner
considers the entire visible frame before allocating, protects its working set,
and reduces planned resolution together when needed. Large surfaces cache only
the visible local area plus an 18% pan margin. Fills and undo repaint fitting
buffers in place. Pan reuses local coverage; zoom schedules later refinement.
Vector documents, hit geometry, export and printing remain independent of these caches.

The 26-sticker Safari workload had 293 colored regions, 216 shading strokes,
555 blobs and 37,931 paint vertices. Two repeats at each of 64/128 MiB showed no
steady-paint cache rebuilds. At 64 MiB, normal page-paint p95 was 3.1–4.2 ms;
4x page CPU throttling at high DPI gave 16.2–22.1 ms. Fill including display was
49.6–55.5 ms normally and 237.6–246.4 ms throttled. The larger cache did not
establish an advantage, so the smaller default remains.

These timings measure main-thread input and Canvas submission, not physical
pointer latency. The machine was under shared load. CPU throttling does not slow
workers/GPU like a real tablet. Animation callback gaps are not device FPS.
One geometry worker handled live compaction and undo without sustained backlog;
these results do not justify a worker pool or another rendering engine.

## Definition and document memory

Decoded definitions are weakly shared among active owners, independently of the
64 MiB strong reuse cache. Eviction cannot duplicate a definition still in use.
Lazy region geometry retains only its needed path/transform, not parser documents.
Source text clears on editor exit; restoration clones paint once. Closed canvases
release large backing buffers. Display pixels, lookup arrays, vectors, undo,
in-flight worker copies and browser/GPU allocations have separate lifetimes.

Eight open/paint/save/close cycles reached a plateau. A later repeat retained zero
closed sessions/artwork, approximately 16.53–16.62 MiB JS heap and 11.25 MiB backing
storage; closed diagnostic canvas backing was zero or four bytes. The pressure
probe shared five definitions across six instances without duplicates. Forced GC
distinguishes retention from allocation churn; these are not peak RSS, total OS/GPU
memory or proof that every future workload is leak-free.

Saved-picture browsing uses persisted PNGs and a five-entry bitmap URL cache; see
[picture-library measurements](PICTURE-LIBRARY.md). Undo uses a memory budget and
small affected-field records; see [undo](UNDO-HISTORY.md).

## Reproduce

```sh
npm run test:memory
npm run test:scene
node scripts/test-browser.mjs --scene-profile --scene-cache-mib=64 --scene-repeat=2
node scripts/test-browser.mjs --scene-profile --scene-cache-mib=128 --scene-repeat=2
```

Diagnostic budget overrides apply only to the test server. Each run creates an
isolated browser profile and writes disposable JSON/screenshots under `work/tests/`.
The memory profile checks final closed-cycle stability with a 2 MiB tolerance,
definition sharing and canvas release. The ordinary browser suite covers paint,
fill, cache invalidation, transformed coverage, save/undo and vector output.
Repeat on a modest physical tablet before changing budgets for platform claims.
