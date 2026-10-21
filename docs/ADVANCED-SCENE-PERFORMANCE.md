# Advanced-scene performance investigation

This records the earlier renderer. See [the implemented fix and repeated tests](DISPLAY-CACHE-PERFORMANCE.md) for current results.

Measured on 2026-10-21 using headless Microsoft Edge 155 on this Windows machine.
These are local diagnostic results, not device requirements or tablet FPS claims.

## Outcome

The shared geometry worker was not the limiting resource in this workload.
Display cache residency is the next issue to fix. At high DPI or high zoom,
whole-surface caches evict other visible surfaces and rebuild on subsequent frames.
A larger cache helps at page scale but does not solve zoomed-in cache churn.
No runtime worker scheduling, rendering policy or cache budget changed in this
investigation. Only the diagnostic harness and documentation were added.

## Workload

The fixture derives from the bundled safari page in `src/assets/coloringBook.json`;
it does not maintain a second scene layout. It scales the page to 1754 x 1240
logical units, colors all 293 sticker regions across 26 stickers, and applies
216 alternating shadow/highlight-style vector strokes (5,400 brush samples),
including the paper. This produces 555 compacted blobs, 37,931 paint vertices,
and a 1,274,094-byte saved document. The colors and wave strokes deliberately
exercise geometry; they are not intended as realistic finished shading.

Each measured run restores the same colored fixture into the real EditorSession,
with its smoothing, undo history, background maintenance and save path. It makes
60 brush samples at page scale, 60 pan updates, 60 zoom updates, 60 zoomed brush
samples, eight fills, a background-drain check and an IndexedDB save. Brush
samples arrive on animation callbacks, rather than an artificial tight loop.
Output uses a visible 1260 x 891 CSS-pixel canvas at 1x or 2x backing resolution.

## Current 32 MiB cache

All millisecond columns below are 95th percentiles unless noted. Painting action
means synchronous input processing plus Canvas command submission, not physical
pointer-to-screen latency or completed GPU presentation.

| Configuration | Brush processing | Paint rendering submission | Combined painting update | Cache rebuilds / 60 paint frames |
| --- | ---: | ---: | ---: | ---: |
| Normal, 1x pixels | 3.1 ms | 1.7 ms | 4.0 ms | 0 |
| Normal, 2x pixels | 2.8 ms | 8.4 ms | 10.2 ms | 960 |
| 4x page CPU slowdown, 2x pixels | 25.2 ms | 61.5 ms | 74.8 ms | 960 |

| Configuration | Worker queue + delivery | Worker execution | Worker round trip | Peak outstanding jobs |
| --- | ---: | ---: | ---: | ---: |
| Normal, 1x pixels | 4.9 ms | 5.5 ms | 38.6 ms | 3 |
| Normal, 2x pixels | 5.7 ms | 6.8 ms | 16.4 ms | 3 |
| 4x page CPU slowdown, 2x pixels | 8.7 ms | 6.0 ms | 240.4 ms | 3 |

The worker backlog drained immediately at the end of the measured phases (rounded
to milliseconds). Longer round trips with low worker execution times also include
main-thread reply delivery and cloning; they do not demonstrate long worker jobs.

The ordinary 1x run had zero cache rebuilds in its page-scale paint phase, but 360
rebuilds across 60 zoomed paint frames. At 2x resolution the page-scale paint phase
already rebuilt caches 960 times. Pan and zoom also triggered repeated rebuilds.

Fills were not uniformly fast: the current high-DPI run's slowest fill plus display
submission took about 2.3 seconds. Saves took about 112 ms normally and 499 ms with
page CPU throttling in the current-budget run. The traces therefore do not justify
calling the whole complex-scene interaction smooth, despite cheap brush geometry.

## Diagnostic 64 MiB comparison

This changes the served cache constant only inside the diagnostic Vite transform;
it does not change the application's 32 MiB default or add a runtime setting.

| Configuration | Painting update at 32 MiB | Painting update at 64 MiB | Page-scale paint rebuilds: 32 -> 64 MiB |
| --- | ---: | ---: | ---: |
| Normal, 1x pixels | 4.0 ms | 3.4 ms | 0 -> 0 |
| Normal, 2x pixels | 10.2 ms | 4.8 ms | 960 -> 0 |
| 4x page CPU slowdown, 2x pixels | 74.8 ms | 22.1 ms | 960 -> 0 |

Increasing the budget removed page-scale painting churn at 2x resolution. It did
not remove zoomed painting churn: both budgets rebuilt 360 caches in that phase.
Large full-surface backgrounds expand with zoom, despite much of their content
being outside the viewport. The LRU then evicts other caches needed by the same
frame. Raising one constant is not a complete fix. Some comparison fills and one
save also stalled for seconds, so the 64 MiB variant should not be adopted as a
finished optimization on these results alone.

## Recommendation

Keep one geometry worker. Prioritize display cache allocation: account for the
visible working set, prevent repeated eviction of surfaces used in the same frame,
and avoid allocating full-resolution pixels for large offscreen surface areas.
Consider viewport tiles or an explicitly budgeted resolution policy for large
backgrounds. Preserve vector documents, hits, export and print. Retest this exact
fixture before adding worker priorities, a pool, or OffscreenCanvas rendering.

## Measurement limits

- The performance mode uses the browser's default graphics backend; the ordinary
  regression suite still forces software graphics for reproducibility. Discarded
  exploratory software-renderer/readback runs are not included in these tables.
- There is no per-frame pixel readback. Frequent readbacks can alter Canvas behavior.
  The final PNG export occurs after timed phases.
- The 4x slowdown is requested for the page's main thread. Workers and the GPU are
  not equivalent to a four-times-slower tablet. Worker execution times stayed near
  unthrottled values. A physical older tablet remains necessary for device claims.
- This is an engine/session benchmark, without trusted pointer dispatch or the full
  React event route. It measures processing and submission, not end-to-end input
  latency. The normal browser interaction suite tests that route separately.
- Animation callback cadence was variable even on the blank-canvas calibration.
  Callback gaps are retained in JSON but are not converted to hardware frame rates.
- Results are single sequential diagnostic runs, sensitive to warmup and graphics
  scheduling. Allocation/rebuild counts and small worker backlogs are stronger
  evidence than small differences between individual timing values.

## Reproduce

```sh
node scripts/test-browser.mjs --scene-profile
node scripts/test-browser.mjs --scene-profile --scene-cache-mib=64
```

Use `BENCHMARK_BROWSER` to select another Chromium executable. The flag runs this
diagnostic instead of the ordinary regression suite. Run `npm run test:browser`
separately for correctness coverage. Optional budget values are 32, 64 and 128 MiB.

Generated artifacts stay under ignored `work/tests/`: `advanced-scene-results.json`,
`advanced-scene-cache64-results.json`, per-run PNG previews and
`advanced-scene-picture.json`. Worker traces include queue/delivery, executor time,
postMessage cost, round-trip time, job counts and outstanding requests. Test-only
worker instrumentation calls the same production geometry executor.
