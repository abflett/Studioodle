# Architecture review - completed refinements

Reviewed 21 October 2026, against the vector-only editor. This is an incremental
architecture review, not a claim that every path has been profiled or that native
platform behavior has been retested. Original art, sticker SVGs, bundled page data
and the saved-document format are unchanged. The review and follow-up refinements
are complete; remaining device/platform validation is tracked in
[refinement tasks](REFINEMENT-TASKS.md).

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

Historical measurement of the initial Phaser removal, before subsequent paint and
PDF-export work; these totals are not the current bundle size. Baseline was cleanup commit `626cfa0`. Summing all production `dist/assets/*.js`
files (including the worker and lazy chunks), the final comparison was:

| Measure | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Minified JavaScript | 2,009,023 bytes | 636,861 bytes | about 68% |
| Gzipped JavaScript | 533,566 bytes | 181,829 bytes | about 66% |

These are build-output totals, not measured first-load transfer sizes; images,
fonts and CSS are excluded. Gzip was calculated consistently over each JS file.
The removed Phaser chunk alone was 1,374,128 minified bytes. The existing artwork
quality/compression settings were preserved.

Unit tests went from roughly 10-12 seconds during this session to roughly
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

## Follow-up status

| Topic | Result |
| --- | --- |
| Undo memory | Changed-region compacted checkpoints and small sticker records replace whole-scene snapshots and action caps. Estimated 128 MiB history budget. [Details](UNDO-HISTORY.md). |
| Brush responsiveness and display | Numeric browser paths, bounds-grid candidate search, incremental paint caches and frame-wide 64 MiB cache planning. The 26-sticker workload was repeated twice at 64/128 MiB, including page CPU throttling. [Current results](DISPLAY-CACHE-PERFORMANCE.md), [vector painting](VECTOR-PAINT.md). |
| Worker contention | Measured without a growing backlog in the tested scene. Keep one shared worker; no worker pool justified. The [initial scene report](ADVANCED-SCENE-PERFORMANCE.md) is historical; the cache report supersedes its display results. |
| Live-document memory | Eight editor lifecycles plateaued. Weak sharing removed duplicate live definitions; parser documents, redundant clones and closed canvas backings were released. [Results and limits](LIVE-DOCUMENT-MEMORY.md). |
| UI component size | Saving/exit and picture-library hooks, selected-sticker toolbar and paper controls extracted by responsibility. Keep further extractions tied to features. |
| Persistence | Structured vector records in IndexedDB; success follows compaction and transaction commit. Browser checks round-trip, replace and delete a drawing larger than 7 MB. No old-save migration. |
| Print and export | Self-contained SVG printing; PNG, SVG and vector PDF export from a format overlay. PDF conversion is lazy-loaded. Browser output and print-pipeline checks cover transforms, patterns, clips and raster-free PDFs. [Output design](PICTURE-OUTPUT.md). |

No unresolved implementation item remains from this review. Device measurements,
physical printing and native adapter validation remain explicit follow-up checks,
not reasons for another engine rewrite. See [refinement tasks](REFINEMENT-TASKS.md).

## Browser API references

The replacement uses standard [Pointer Events capture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)
and [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).
Phaser's [pointer API](https://docs.phaser.io/api-documentation/class/input-pointer)
provides mouse/touch adaptation, which was its main remaining use in this repository.


### Performance history

The first short brush trace did not expose accumulated paint cost. The denser
follow-up found path-string reconstruction and cache churn rather than worker
contention. Numeric paths, surface-local pan reuse, delayed zoom refinement and
frame-wide cache planning addressed that measured work. Current results and
reproduction commands live in [display cache performance](DISPLAY-CACHE-PERFORMANCE.md);
older reports remain labelled as historical evidence.
