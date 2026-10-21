# Display cache improvements and repeated scene tests

Measured on 2026-10-21 after the advanced-scene investigation. The app now shares
cache space across the visible working set instead of allowing full-surface caches
to evict other surfaces needed by the same frame. The default ceiling is 64 MiB.

## Changes

- Prepare all visible complex-surface cache requests before drawing. Fit their
  combined pixel targets to the shared budget, protecting members of this frame.
- Cache only the visible local area plus an 18% pan margin for large surfaces.
  Small surfaces retain whole-surface reuse. Cache coverage supports rotation,
  flips, fractional transforms, viewport clipping and zoom refinement.
- When the working set exceeds capacity, reduce its planned resolution together,
  in quantized steps, rather than repeatedly evicting visible members.
- Repaint dirty caches in place for fills and undo when the buffer size is unchanged.
  This avoids resetting canvas dimensions and reallocating backing pixels on every fill.
- Keep vector documents, region hits, worker geometry and full-resolution output.
  No raster painting engine, migration or second rendering backend was added.

## Workload and repetitions

The same bundled safari fixture contains 26 stickers, 293 colored sticker regions,
216 shading strokes, 555 blobs and 37,931 paint vertices. Each configuration was
run twice, sequentially, with 60 samples per phase and eight fills. Both 64 and
128 MiB ceilings were tested. The user was also running a game; these are repeat
samples under shared system load, not a controlled game-on/game-off comparison.

Timing columns are p95 main-thread input processing plus Canvas submission in ms.
They do not measure physical pointer-to-screen latency. `Pan` and `Zoom` contain
rendering submission; paint phases also contain the actual session brush logic.

| Budget | Configuration | Repeat | Page paint | Pan | Zoom | Zoomed paint | Fill including display, p95 | Paint / zoomed paint rebuilds |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 64 MiB | Normal 1x | 1 | 4.1 | 2.3 | 1.5 | 4.2 | 55.5 | 0 / 0 |
| 64 MiB | Normal 2x | 1 | 3.1 | 1.8 | 5.5 | 5.4 | 53.5 | 0 / 0 |
| 64 MiB | 4x CPU, 2x | 1 | 16.2 | 9.8 | 8.6 | 23.9 | 246.4 | 0 / 0 |
| 64 MiB | Normal 1x | 2 | 3.9 | 1.8 | 1.3 | 4.9 | 49.6 | 0 / 0 |
| 64 MiB | Normal 2x | 2 | 4.2 | 1.8 | 5.7 | 5.1 | 53.0 | 0 / 0 |
| 64 MiB | 4x CPU, 2x | 2 | 22.1 | 12.4 | 10.0 | 22.6 | 237.6 | 0 / 0 |
| 128 MiB | Normal 1x | 1 | 3.8 | 1.7 | 1.4 | 3.7 | 52.9 | 0 / 0 |
| 128 MiB | Normal 2x | 1 | 4.1 | 1.8 | 6.0 | 6.3 | 55.5 | 0 / 0 |
| 128 MiB | 4x CPU, 2x | 1 | 19.9 | 7.6 | 9.1 | 29.8 | 248.1 | 0 / 0 |
| 128 MiB | Normal 1x | 2 | 4.2 | 1.5 | 1.4 | 3.4 | 51.0 | 0 / 0 |
| 128 MiB | Normal 2x | 2 | 4.1 | 1.5 | 5.8 | 5.9 | 74.4 | 0 / 0 |
| 128 MiB | 4x CPU, 2x | 2 | 30.2 | 9.5 | 8.5 | 27.9 | 284.0 | 0 / 0 |

With the earlier 32 MiB renderer, the throttled high-DPI painting update was
74.8 ms p95, zoomed painting was 61.9 ms, and the high-DPI page-scale paint phase
rebuilt caches 960 times across 60 frames. Zoomed painting rebuilt 360 times.
With the new 64 MiB planner, both repeats had zero steady-paint rebuilds; throttled
page paint was 16.2?22.1 ms and zoomed paint 22.6?23.9 ms. The change is in cache
policy as well as capacity; these results do not isolate a budget-only speedup.
The earlier baseline was taken in a different session, so small timing differences
should not be attributed to code alone.

At 64 MiB, normal fills including their display update peaked around 50?56 ms in
these samples, and the throttled samples around 238?246 ms. The previous repeated
multi-second fill stalls did not recur in the new runs. This does not guarantee
that every possible fill, GPU or document has bounded latency.

Pan and moving zoom still rebuild newly exposed or refined crop windows; they
are not expected to have zero rebuilds. Geometry clipping on complex stickers
still has a main-thread cost, particularly under CPU throttling.

## Capacity choice

The 64 MiB ceiling was sufficient for this workload: observed phase-end cache
pixels occupied approximately 9?60 MiB, allocated on demand. Both tested ceilings
eliminated steady-paint churn. The 128 MiB variant did not establish a speed
advantage, and mostly retained similar amounts of cache pixels after cropping.
Keep the smaller default for a cross-platform app; the planner can trade resolution
for residency under a more demanding visible working set. The ceiling does not
include total browser/GPU memory, vectors, history or the main display canvas.

## Workers and profiling limits

The geometry worker remained a single worker. Both live compaction and undo
maintenance ran during the test, alongside fills. No sustained backlog appeared;
all background-drain checks completed within a millisecond at the measured end.
There is no evidence here that a worker pool or a rendering worker would address
the remaining cost more effectively than this display fix.

The browser uses its default graphics backend, without forced software graphics
or per-frame readbacks. The 4x slowdown applies to the page main thread; workers
and the GPU are not a simulated weak tablet. Animation callbacks were variable
even on blank-canvas calibration, so callback gaps are retained in raw JSON but
are not converted into device FPS. A physical tablet is still needed for platform
performance claims. The two repeats show variability under concurrent load rather
than establish statistically controlled hardware comparisons.

## Reproduce and validation

```sh
node scripts/test-browser.mjs --scene-profile --scene-cache-mib=64 --scene-repeat=2
node scripts/test-browser.mjs --scene-profile --scene-cache-mib=128 --scene-repeat=2
```

The override affects only the diagnostic Vite transform. Runtime uses the exported
`paintDisplayBudget` ceiling. Generated JSON and per-repeat images remain under
ignored `work/tests/advanced-scene-cache64-*` and `advanced-scene-cache128-*`.

Browser regressions additionally cover a visible working set larger than its ideal
budget, zero steady-state redraws after zoom refinement, clipped cache coverage,
fill buffer reuse, undo, cache eviction, disposal, ordinary navigation, fractional
view transforms and unchanged numeric vector paths. Full vector export and print
continue to bypass the disposable display cache.
