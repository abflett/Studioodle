# Architecture and optimization review

Reviewed 21 October 2026, against the vector-only editor. This is an incremental
architecture review, not a claim that every path has been profiled or that native
platform behavior has been retested. Original art, sticker SVGs, bundled page data
and the saved-document format are unchanged.

## Changes implemented

| Finding | Change and reason |
| --- | --- |
| Phaser only adapted input, ran the frame loop and drew selection; Canvas2D already rendered all artwork separately. | Removed Phaser and its WebGL canvas. A browser adapter uses Pointer Events, the existing session, and one visible Canvas2D display. No physics, game scenes, audio, tweens or sprite systems needed replacing. |
| Idle editor performed frame-loop work and layout queries. | Coalesce edits/view changes into one requested frame. Continuous frames run only during an active spray gesture. Resize, scroll, React view updates and visibility changes invalidate display. |
| Every paint maintenance job cloned every region. | Track dirty region IDs; send only those regions. Whole-region base fills need no boolean maintenance. Region access uses a Map instead of repeated array searches during rendering and brush application. |
| Restored/replaced/deleted artwork could retain maintenance timers; late fills could notify detached editors. | Explicit disposal for sessions, artwork and paint. Undo, cancellation, deletion and unmount release their resources. Late fill results cannot run queued commands after disposal. |
| Worker and fallback dispatch were duplicated in paint state. | A small worker-client module owns transport; both paths share the same geometry job implementation. No service container or new framework. |
| Decoded sticker maps accumulated without a reuse limit. | LRU reuse cache capped at 24 definitions and 64 MiB of lookup arrays. Source text remains available for synchronous restoration after eviction. Active artwork retains its references. |
| Late UI subscriptions could miss already-published state. | Replay the latest tool, focus and selection values on subscription. Commands remain synchronous. |
| Metadata validation imported the asset-URL glob; Node tests opened unnecessary watchers/WebSockets. | Separate metadata from URL resolution. Disable watching and WebSockets in source-loader unit tests. |

Pointer capture handles native drawing outside the page; virtual mouse and touch
streams keep their existing UI routing. The selection outline shares the artwork
canvas. Rendering still evaluates vector paths at display resolution; this does
not introduce a raster paint engine.

## Measurements and checks

Baseline was cleanup commit `626cfa0`. Summing all production `dist/assets/*.js`
files (including the worker and lazy chunks), the final comparison was:

| Measure | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Minified JavaScript | 2,009,023 bytes | 636,861 bytes | about 68% |
| Gzipped JavaScript | 533,566 bytes | 181,829 bytes | about 66% |

These are build-output totals, not measured first-load transfer sizes; images,
fonts and CSS are excluded. Gzip was calculated consistently over each JS file.
The removed Phaser chunk alone was 1,374,128 minified bytes. The existing artwork
quality/compression settings were preserved.

Unit tests went from roughly 10?12 seconds during this session to roughly
1.5 seconds after separating metadata and disabling test server infrastructure.
This is a local observation, not a cross-machine benchmark. Browser first-fill
measurements varied between runs; no stable fill-speed improvement is claimed.

Verification covers persistence, schema validation, sessions, cancellation, undo,
cache eviction, dirty worker jobs, stale asynchronous results and geometry. Browser
regressions cover the actual worker, fills after brushes, seams, queued edits,
zoomed pointer coordinates, idle rendering, frame coalescing, stationary spray,
viewport allocation and disposal. Full-app browser input also verifies native mouse
drawing, save/reopen and two-finger rollback through React's gesture routing.
TypeScript, lint and the production web build are required. Native builds remain
on request; an installed desktop application still needs its usual platform check.

## Dependency decisions

| Technology | Decision | Rationale |
| --- | --- | --- |
| React / React DOM | Keep | Owns dialogs, settings, navigation and responsive controls. Replacing it would rebuild useful state/lifecycle/accessibility infrastructure with little demonstrated benefit. Drawing stays outside React renders. |
| Phaser | Remove | Its remaining responsibilities were small browser adapters; the game framework and extra WebGL surface outweighed their value here. Future animations alone do not require a game engine. Reassess only for a concrete game-style feature. |
| Clipper2 | Keep | Fixed-precision polygon operations are central to stable vector brush compaction and bucket topology. A handwritten replacement would add substantial numerical risk. |
| svg-pathdata | Keep | Normalizes SVG curves for polygon geometry while retaining exact SVG curves for display clipping. This is substantive parser work. |
| Tauri | Keep | Supplies the desktop shell, window state, native save dialogs and printing. Browser workflows remain usable independently. No native build or shell migration was performed. |
| Lucide | Keep | Supplies consistent React icons; named imports allow the production build to remove unused icons. Recreating the icon set would be maintenance churn. |
| Paper.js | Keep offline only | Used for authored curve/component cleanup. It remains a development dependency and is not part of the runtime painting engine. |
| Vite / TypeScript / ESLint / Node tests | Keep | Appropriate build, type, boundary and test tooling. No extra test framework or state library is needed. |

## Boundaries worth keeping

The useful direction is UI/composition -> editor session/contracts -> artwork and
geometry, with platform adapters outside the editing rules. ESLint enforces the
editor/canvas import boundaries. A static runtime-import review found no cycles.
Canvas2D/Path2D are intentional editor dependencies; making the whole artwork model
platform-neutral would be a separate portability feature, not an automatic SOLID win.

Small save/change ports and discriminated commands already provide useful dependency
inversion. Keep concrete classes where there is one implementation. Avoid one-method
repository wrappers, generic managers, deep inheritance and an interface per class.
The session and artwork own different responsibilities; the browser adapter does
not mutate paint or reach into persistence directly.

## Next improvements, in order of evidence needed

1. **Undo memory ? implemented in the next refinement.** Whole-scene snapshots
   and the 50-action cap were replaced by changed-region checkpoints, small sticker
   property records, shared immutable geometry and an estimated 128 MiB history
   budget. Pending paint checkpoints compact one job at a time in the worker.
   See [undo history](UNDO-HISTORY.md). Profile real mobile sessions before tuning
   the budget; it is an estimate, not a measurement of total process memory.
2. **Brush responsiveness ? refined next.** Added a shared bounds-grid candidate
   search, safe paper/focus clipping shortcuts, periodic compaction during long
   strokes, and a shorter smoothing tail that settles before release. Exact brush
   intersections still run on the main thread. The local warmed trace improved ink
   processing by about 15% and spray by about 10%; see [vector painting](VECTOR-PAINT.md)
   for scope and measurements. Deeper curve clipping or input batching should follow
   a reproducible remaining delay rather than another architectural migration.
3. **Worker contention ? measured; scheduling changes deferred.** A 26-sticker,
   216-stroke diagnostic kept the current worker backlog at three jobs or fewer.
   Worker execution was cheap compared with complex-scene display/cache work.
   Prioritize cache residency at high DPI/zoom; raising the budget alone did not
   remove churn. See [the measured workload and limits](ADVANCED-SCENE-PERFORMANCE.md).
   Do not add a worker pool without evidence that the worker is the bottleneck.
4. **Live-document memory ? tested and refined.** Eight open/paint/save/close
   cycles returned to a stable retained-memory baseline. Weak sharing now avoids
   duplicate live definitions after reuse-cache eviction; the pressure probe saved
   22.41 MiB of lookup arrays. Lazy geometry no longer retains parser documents,
   idle source text is cleared, redundant paint cloning is removed, and closed
   display backings shrink immediately. These are not a total app-memory limit.
   See [the lifecycle test and results](LIVE-DOCUMENT-MEMORY.md).
5. **UI component size.** EditorPreview and SelectionScreen coordinate several
   workflows but are still only about 20 KB each. Extract cohesive workflows when
   touched by features, rather than splitting JSX into arbitrary tiny components.
   Native dialogs and the shared DialogHeader are useful existing foundations.
6. **Persistence and output ? drawings moved to IndexedDB.** A complex drawing
   exposed the localStorage quota. Drawing saves now compact paint, then commit
   structured records asynchronously. A browser regression round-trips a 7 MB
   drawing, replaces it and deletes it. Settings and templates remain separate. PNG export and current print output remain rasterized from
   vectors; true SVG/PDF output would be a distinct feature.

The two-second splash minimum is an explicit presentation choice, not a rendering
bottleneck. Existing painting quality and sticker conversion were not retuned in
this pass. Manual stylus, multi-monitor DPI, pointer-lock and installed-platform
checks remain valuable beyond the automated mouse/touch coverage.

## Browser API references

The replacement uses standard [Pointer Events capture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)
and [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).
Phaser's [pointer API](https://docs.phaser.io/api-documentation/class/input-pointer)
provides mouse/touch adaptation, which was its main remaining use in this repository.


### Dense multicolor follow-up

The short brush trace did not cover the cost of displaying accumulated complex
paint. A denser trace identified repeated rasterization and numeric-to-SVG-text
path rebuilding. Paint now builds native paths numerically, uses a bounded,
incrementally updated viewport display cache, and reuses compacted worker color
partitions. Browser regressions cover cache reuse across worker replies, fill,
undo, view changes, memory eviction and disposal. The optional `--dense-profile`
diagnostic forces a pixel readback; timings include deferred raster work and
should not be interpreted as interactive hardware frame rates.


Navigation follow-up: the original display key included the viewport translation
and zoom, forcing expensive rebuilds per gesture frame. Surface-local caches now
reuse paint during pan/rotation and refine once zoom settles. Browser checks
verify zero paint path fills during navigation and one requested refinement.


The measured cache residency issue is now addressed by a frame-wide planner,
viewport crop windows, a shared 64 MiB ceiling and in-place fill repainting.
The 26-sticker workload was repeated twice at both 64 and 128 MiB, including 4x
page CPU throttling. Steady paint phases stopped rebuilding caches at both budgets.
See [the follow-up report](DISPLAY-CACHE-PERFORMANCE.md). Single-worker scheduling
remains unchanged because queue growth was not the limiting factor.
