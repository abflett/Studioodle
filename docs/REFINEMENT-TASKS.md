# Road to Studioodle 1.0

Updated 31 October 2026. Core feature mechanics are complete enough to shift from
feature expansion to performance, visual cohesion, content and beta validation.
Parents and children have already enjoyed the current small library; the next work
should make that experience reliable and richer, rather than add more tools.

This is the sole implementation backlog. Work through the release priorities below
one coherent task at a time, retaining the existing engineering findings and checks
later in this file. Current baseline: **364 stickers and six bundled coloring pages**.
The content goal is **1,000+ accepted stickers**, not merely generated candidates.
Keep small parent/child beta sessions running throughout these phases; do not wait
for the entire content library to be finished before testing improvements.
No new engine migration is planned; old development saves may still break before
release, but public save/update policy must be settled before 1.0.

## 1. Performance and reliability — first release blockers

The user reports severe slowdowns with scatter/spray, ordinary painting, fills on
already detailed pages, panning and saved-picture browsing/loading. These are real
reported user-experience problems; their causes and costs still need measurement.
Earlier reverting the save changes did not remove the slowdown. Do not assume the
save queue, a particular worker or the latest palette work is responsible.

### Storage and selection screen — next implementation batch

Keep the app web-first, using IndexedDB as the central app persistence backend.
Native SQLite is a later option for Windows/other platforms through the same
repository boundary; it is not part of this batch. Aim for at least 10x improvements
in measured bottlenecks, recording before/after results per operation rather than
claiming a uniform whole-app speedup. Completed items below record the implemented storage/preview batch; remaining
items cover broader scale, quality and device validation.

- [ ] **Measure storage and selection-page baselines.** Seed 1,000 and 5,000
  mixed-complexity drawings and a substantial custom-page collection. Record
  estimated origin usage/quota separately from serialized payload bytes, cold/warm
  Home load, thumbnail availability, rapid browsing, save latency and peak memory.
  Include a modest Android device when available; desktop timings do not establish
  WebView capacity or tablet performance. Choose concrete budgets from these results.
- [x] **Move custom coloring pages to IndexedDB.** Store pages individually rather
  than rewriting one synchronous localStorage collection. Keep bundled layouts in
  coloringBook.json. Preserve current valid custom pages through a one-time import;
  mark the import complete only after a successful transaction, and make retries
  safe. Test failed writes, duplicate IDs, deletion, reload and import/share behavior.
- [ ] **Centralize remaining app persistence.** Inventory settings, theme, favorites
  and pointer preferences; move durable app-owned state behind shared asynchronous
  IndexedDB repositories. Tiny preferences are not the primary performance problem;
  preserve startup appearance and avoid replacing synchronous reads with UI flashes
  or input-blocking waits. Reviewer storage and annotations remain standalone and
  untouched. No ongoing dual-write localStorage compatibility layer is needed.
- [x] **Persist lazy raster thumbnails for saved drawings.** On gallery access,
  first look for a thumbnail matching the drawing's content revision and thumbnail
  renderer version. On a miss, load the latest drawing, render a bounded raster,
  encode/store a Blob and reuse it on later views and visits. Generate on demand
  after returning Home, not during live painting or for the entire library upfront.
  Match page aspect ratio, background, sticker ink and custom palette exactly.
- [x] **Make thumbnail lifetime safe and bounded.** Edits/undo invalidate the cached
  revision; saving unchanged content should not force regeneration. Pending saves
  must preview the latest queued checkpoint. Reject stale generation completions,
  deduplicate requests, cancel obsolete work and bound concurrency, decoded memory
  and object-URL lifetime. Delete cached previews with their drawing. Cache failures
  must leave source artwork intact and allow a usable preview/retry path. Valid
  cached previews should browse without loading full vector documents; opening,
  export and editing still use the source drawing.
- [ ] **Compare thumbnail quality and size.** Trial a modest oversampled render
  followed by a second downsample against direct rendering at display size. Choose
  dimensions, pixel budget and encoding using thin-ink quality, high-DPI display,
  generation latency, storage and memory measurements. Avoid full-print-resolution
  intermediates; two-stage downsampling is a candidate, not an assumed speedup.
- [ ] **Bound large-library metadata work.** Measure the current full summary read
  and sort; add indexed pagination/windowing if needed at the target library sizes.
  Retain recent ordering, stable selection and bounded full-document loading.
- [ ] **Expose storage health and recovery.** Add usage/quota estimates where
  supported, check/request persistent storage where supported, and handle denied or
  unavailable APIs and quota failures. Define a parent-friendly backup/restore
  workflow for editable drawings; PNG/PDF output alone cannot restore editable art.
- [ ] **Measure source encoding and write amplification.** Compare current complete
  drawing writes with compact numeric encoding, compression and unchanged-content
  reuse. Count encoding/decoding CPU and temporary memory as well as bytes saved.
  Adopt only demonstrated improvements while retaining atomic drawing/summary saves.
- [ ] Verify the selection-page batch with cold/warm cache, missing/corrupt preview,
  rapid navigation, edit/undo/Home, pending/failed saves, palette edits and delete
  races. Record before/after results at both library sizes before claiming gains.

Implemented 30 October: schema 2 adds per-page records with stable ordering and an
atomic legacy-import marker; current source pages are preserved. Gallery previews
use revision/version-aware PNGs capped at 768px, with one generation plus latest
waiting request and five bitmap URLs. Cached reads bypass generation and do not
load vector documents. Full source loads only for explicit actions; browser print
still opens synchronously. Tests cover pending/stale/delete/cache-failure paths,
corrupt-image recovery, atomic page failure/retry and preserved add-page matching.
The 1,000/5,000 lightweight fixture lists measured ~20-30/~90-120ms; persisted PNG
reload ~1.5-1.6ms versus first generation ~240-275ms. Complex collections and real
Android results, quota/backup work and direct-vs-two-stage quality trials remain
unverified; do not claim a uniform 10x app speedup.

### Canvas and interaction — after the selection-page batch

Planning direction: retain the numeric document model and Canvas2D renderer.
Live paint already uses numeric geometry/Path2D, not SVG strings or per-shape DOM
elements. SVG remains useful for editable source art, import and scalable export.
Prefer native circle/curve descriptions where appropriate; measure the savings
from avoiding polygon construction, boolean operations and repeated rendering.
This is an evolution of the current engine, not a second painting engine.

Already implemented: a shared geometry worker, dirty-region maintenance and
compacted-prefix reuse, whole-region solid-fill bypasses, indexed region
candidates, contained-paper brush bypasses, and a 64 MiB display cache with
incremental updates, 18% pan overscan and delayed sharp zoom refinement. Measure
where these paths miss or repeat work before proposing them as new features.
See VECTOR-PAINT.md and PERFORMANCE.md; older timings are workload-specific.

**Cell experiment: successful proof of concept, parked.** The standalone
`tools/cell-brush/` tool retains coarse and 4/2/1 CSS-pixel grids, diagnostics and
reproducible benchmarks; see its README for design, limits and results. Its data
and rendering have bounded grid storage and avoid accumulating brush-union paths,
but the user prefers the current vector engine's crisp contours. No app integration,
new cell profiles, line-art conversion or platform engine split is current work.
A future fallback could replace paint/fill beneath existing vector line art and
reuse surface clipping/masking. A 2px Android/tablet option and worker processing
remain ideas to evaluate only if measured vector improvements are insufficient;
undo, saved format, palette edits, cross-platform drawings and output would need
validation. Preserve the demo without continuing its unfinished contour experiments.

- [ ] **Reproduce and profile scatter/spray and dense painting.** Use a
  user-provided detailed drawing (including the colored Moon Sorceress when available),
  a repeatable synthetic stress drawing and a simple control page. Cover sustained
  stationary spray, long strokes, overlapping strokes and increasing paint density.
  Capture input-to-visible latency, longest main-thread tasks, worker job/queue time,
  geometry/node/blob growth, display work, save work and peak memory. Separate cold
  loads from warm reuse, and record device/browser/build conditions. Keep diagnostics
  in standalone tools/tests and ignored `work/`, never in the main app ribbon.
- [x] **Trial isolated raster spray outside fill topology.** User approved a
  pixel-only spray overlay, accepting softness at zoom/print. Soft dabs paint into
  sparse 128px sections attached to each surface, above ordinary paint and below
  ink. Fills ignore spray; eraser clears ordinary paint and spray together. Undo
  stores prior touched sections and counts them against its memory budget. Saves
  retain pixels, not particles or a stroke log; output embeds those same pixels.
- [ ] **Review raster spray appearance and measured heavy use.** Compare normal
  coloring, repeated multicolor full-page spray, many overlapping stickers,
  pan/zoom, erase/undo, save/reopen and export on desktop and Android. Current
  resolution caps each surface at 1536px long edge/1 megapixel; allocations are
  sparse but total cost scales with painted surfaces and undo. RGB is baked, so
  palette edits do not recolor old spray. Decide whether softness and layering
  are useful enough to keep. Keep the trial isolated; drop it if it fails.
- [ ] **Audit ordinary brush work before changing its representation.** Measure
  input/layout reads, generated samples, region clipping, lower-surface subtraction,
  allocations, worker transport/queue/compaction and display independently. Trial
  reusable buffers, per-event/per-frame shared calculations, changed-region-only
  invalidation and proven-contained region fast paths where measurements justify
  them. Existing contained-paper shortcuts and dirty-region worker submissions are
  the baseline, not new work. Keep exact boundary clipping, causal smooth curves,
  immediate feedback and action saving. Add workers only if measured queue/compute
  costs justify them; moving work does not remove it.
Implemented 31 October brush/fill batch: conservative interior proofs skip exact
intersection only away from all outer/hole boundaries; immutable sticker clipping
inputs have an 8MiB estimated LRU and brush circle offsets are reused. Worker
compaction keeps distant islands out of boolean operations; connected fills move
the selected component directly and merge only its destination style. An extra
main-thread fill clone is removed. Current precision, clipping, vector output,
undo and asynchronous maintenance semantics remain. Broad real-device/dense-scene
profiling items above/below remain open; see PERFORMANCE.md for measured limits.

- [ ] Profile and fix fills on detailed canvases: distinguish region/topology search,
  geometry preparation, worker queueing, redraw and persistence. Check repeated fills,
  fill after spray, undo and cancellation without blocking other interactions.
- [ ] Profile and fix panning/zooming under heavy paint. Separate display-cache misses,
  geometry rendering, region decoding and memory pressure. Reuse stable geometry and
  display work without losing fine detail or showing stale custom-palette colors.
- [ ] **Separate live viewport movement from React rendering.** The current view
  hook updates React position/zoom state; the canvas renderer also clears/redraws
  its visible area when invoked. Measure React commits, layout reads and drawing
  separately. Trial a view controller holding live transforms outside React,
  applying at most one update per animation frame and publishing only necessary
  UI state. Keep input coordinates, pinch anchors, focus/precision zoom, resize
  and cancellation consistent; view changes must not edit or save artwork.
- [ ] **Audit existing pixel reuse while navigating.** Measure hit/miss/rebuild
  rates of the current 18% overscan, incremental surface caches and delayed sharp
  zoom refresh. Identify unnecessary invalidations, repeated ink/sticker rendering
  or cache churn before trying tiles or a different budget. Refresh only newly
  exposed/changed content where valid; preserve crisp settled views and exact
  exports. Avoid maximum-zoom whole-page bitmaps and test stale results/palette
  recoloring on real target devices.
- [ ] Improve cold reopen and saved-picture carousel latency. Measure preview loading,
  SVG/definition decode, paint restoration, prefetch, stale-load cancellation and
  cache eviction independently. Rapid browsing must not accumulate obsolete work.
- [ ] Set explicit response-time and memory budgets after measuring the minimum target
  device, then add focused regressions. Use representative long sessions and complex
  artwork, not only empty-page timings. Release acceptance: no crashes/freezes or
  multi-second input stalls in the agreed workloads; browsing and navigation remain
  responsive, memory/queues settle, and artwork/undo/save integrity is preserved.
- [ ] Finish physical save-interruption validation described below; automated
  gesture-failure rollback is now covered. These remain blockers even if the
  ordinary-input performance fixes are successful.

#### Raster spray trial decisions

The user chose pixel-only spray and an eraser affecting both paint layers.
The initial trial uses fixed overlay ordering (ordinary paint, spray, line art),
soft round dots and baked RGB. It follows surface transforms/clipping and ignores
bucket topology. No 600-DPI spray reconstruction or particle recoloring is planned.
Review dot density/size, softness, section seams and long-session memory before
keeping it. Palette edits still recolor vector paint/ink, not existing spray pixels.

## 2. One friendly, playful and calm visual language

The direction is professional clarity with more warmth and life: an inviting,
playful/zen coloring studio. The custom open book is the starting point, not the
finished icon standard. Avoid adding decorative noise to every control.

- [x] Gather the [current icon inventory and seven ImageGen directions](icons/README.md):
  135 uses/states across 15 groups, with six representative controls per style board.
  Icon redesign is deferred at the user's request; original app icons and button
  styling are restored. Keep all concept boards, SVGs and the PNG-to-SVG book proof
  for future inspiration. Do not expand or restart the icon set without a new request.
- [ ] Make a focused visual comparison of the main ribbon and newer overlays in light
  and dark themes. Set shared rules for wells, button silhouettes, corner radii,
  padding, gaps, icon scale/stroke and focus/hover/pressed/disabled states. Decide
  where circles versus rounded squares have a clear role; avoid arbitrary differences
  between a ribbon action and the same action in an overlay. Review before broad edits.
- [ ] Refine the book-plus/book-check pair as the first custom-icon pilot: gently curved
  pages, a little asymmetry and a restrained spark, while keeping the add/added meaning
  unmistakable at actual button size. Preserve the existing success/disabled behavior.
- [ ] Build a cohesive custom icon family in reviewed batches: primary drawing tools,
  navigation/library actions, category/detail/palette controls, then utility actions.
  Replace utilitarian placeholders without changing established interactions. Use
  clear silhouettes, accessible names/tooltips and consistent visual weight; retain
  editable vector sources where appropriate. Do not count an icon as finished only
  because it looks attractive enlarged.
- [ ] Apply the approved control system across the ribbon, brush, sticker, palette,
  coloring-page, export, delete and settings overlays. Check light/dark contrast,
  pure black/white artwork, keyboard focus, touch use, selected/disabled clarity,
  portrait/landscape/short windows and narrow screens. Keep meaningful spacing.
- [ ] Observe parents/children using ambiguous icons without coaching. Refine confusing
  actions before removing any remaining helpful guidance. Prioritize recognition and
  predictable feedback over making every control decorative or wordless.

## 3. Grow to 1,000+ useful, reviewed stickers

At least **636 additional accepted stickers** are needed from the current 364.
Plan subject coverage and creative usefulness rather than fill a numeric quota.

- [ ] Audit coverage and plan themed packs with coherent art direction: characters,
  animals, plants, places/buildings, vehicles, everyday objects, food and useful scene
  elements. Include simple through detailed subjects, useful poses/facing directions,
  and complementary scenery. Track accepted counts and meaningful variety by pack.
- [ ] Produce and review a small pilot pack before scaling production. Check that its
  subjects work both alone and as scene-building elements alongside existing art.
  Keep source art, generation metadata and accepted editable sources in the existing
  `art/source/stickers/<pack>/` structure, with clear provenance and usage rights.
- [ ] Expand in manageable reviewed batches until the accepted library exceeds 1,000.
  Maintain stable IDs, metadata/detail classifications, dimensions, visible bounds
  and catalog ordering. Preserve crisp black line art, white enclosed regions and
  intentional transparency. Avoid padding the count with trivial duplicates.
- [ ] Run each batch through conversion and standalone artwork review: holes/leaks,
  missed or tiny regions, stray/closed ink, clipping and representative fills. Tune
  small-region cleanup on targeted examples before any broad regeneration. Preserve
  reviewer annotations/history and promote useful failures into focused fixtures.
- [ ] Validate the real expanded library's startup, browsing, asset loading, cache
  pressure and package footprint. Do not eagerly decode every sticker or trade away
  art quality to hide an unmeasured loading bottleneck.

## 4. Build a substantially larger coloring-page library

Combine full-page single-subject pages with composed scenes. Aim to use roughly
**80% of suitable stickers** as worthwhile individual pages: about 290 at the current
library size, and around 800 at 1,000 stickers, subject to visual curation. These are
planning estimates, not an obligation to publish weak pages.

- [ ] Classify existing stickers as strong solo-page subjects, scene-only elements or
  unsuitable for standalone pages. Background strips, textures, overly plain shapes
  and awkward crops should not become full-page pages just to hit a percentage.
- [ ] Prototype a small, varied set of single-sticker pages before bulk authoring.
  Fit using visible artwork bounds, preserve proportions, center the visible subject,
  leave intentional print-safe margins and choose portrait/landscape/square sensibly.
  Review detailed/tall/wide/asymmetric subjects for clipping and usable coloring areas.
- [ ] Author accepted full-page subjects in reviewed batches, then repeat for new packs.
  Keep stable page IDs and useful subject/detail metadata. Do not manufacture sticker
  duplicates merely to create a page. Use `src/assets/coloringBook.json` as the sole
  bundled layout source, with standalone tooling reading that source.
- [ ] Create many more composed scenes alongside solo pages: coherent settings,
  interesting interactions, varied easy/medium/detailed layouts, balanced negative
  space and sensible overlaps. Expand themes beyond the six current scenes, using
  the sticker packs to support creative storytelling.
- [ ] Review thumbnail recognition, full-page appearance, fill behavior, subject/detail
  filters and print output before accepting pages. Keep scene/page authoring and
  diagnostics outside the main app; do not restore developer workshop controls.
- [ ] Stress the page browser with the target-scale library. Keep filtering, previews,
  favorites, cold browsing and opening a page responsive without loading every full
  scene up front. Reuse the performance acceptance workloads from priority 1.

## 5. Structured beta and 1.0 release gate

- [ ] Define the supported beta/release platforms and minimum representative devices.
  Turn existing parent/child feedback into repeatable observation sessions covering
  creating, coloring, stickers, custom-color edits, undo, leaving/reopening, browsing,
  sharing, exporting and printing. Keep one prioritized issue list here.
- [ ] Run long sessions on modest hardware with heavy spray/paint and large libraries.
  Check touch/stylus/mouse/keyboard, rotation/resize, lifecycle interruptions, storage
  failure and recovery. Cover Firefox/Safari/iPad where support is intended; do not
  infer their behavior from Chromium automation alone.
- [ ] Close the existing export-budget, background-sizing and async-input findings
  below, or explicitly scope out unsupported cases before release. Validate actual
  printing and native output on the platforms being shipped; native builds remain
  explicitly requested work, not an automatic step after every task.
- [ ] Settle browser offline/install expectations and test the chosen behavior. Native
  bundled assets and browser cold/offline loading are different promises; make the
  product description match the supported behavior.
- [ ] Before public 1.0, settle durable save/update expectations, freeze fixed-palette
  slot meanings/versioning and document the beta data-reset policy. Verify upgrades
  against the declared policy, storage errors and manual export/recovery routes.
- [ ] Confirm distribution basics: accepted art/font/dependency rights and notices,
  accurate local-storage/privacy claims, release version/changelog and supported
  installation/update instructions. This does not require accounts, telemetry or
  adding an online service.
- [ ] Ship a release candidate only after the performance workloads meet agreed
  budgets, supported-device checks pass, critical/data-loss issues are closed, the
  visual family is consistent and the accepted content goals are reviewed. Avoid new
  feature scope during the final stabilization pass. Package native targets only
  when requested.

## Implemented feature baseline and remaining design checks

- [x] Center saved-gallery loading beneath the branded stack logo. Keep the same
  spinner position while opening a drawing, hiding the front sheet/actions instead
  of covering the page with a translucent progress-bar overlay.


The Coloring Pages Focus layout is implemented using the six existing scenes,
and the reviewed blank paper size/color steps are now implemented;
[design brief](OVERLAY-DESIGN.md) and [examples](overlay-examples/README.md) retain
the visual discussion. This remains the sole implementation backlog.

- [x] Remove in-app developer workshop controls, its revision dialog, settings
  switch and authoring-mode setup. Keep reviewer/diagnostics standalone and preserve
  ordinary page import/export, save-as-page and existing custom-page storage.
- [x] Implement single preview and optional overview grid, direct single-to-canvas
  opening, grid-to-single selection, filter-relative counts and retained navigation.
- [x] Apply broad subject categories, terrain detail controls, persistent favorites,
  curated metadata for shipped scenes and lightweight custom-page defaults.
- [ ] Inspect representative sticker/scene region statistics and propose detail
  bands with visual review and manual overrides; avoid bulk asset regeneration.
- [x] Prototype portrait, landscape and short-window layouts; settle shared close,
  back, filter, utility and primary-action positions with accessible icon labels.
- [x] Consolidate current template sources on successful atomic collection writes;
  save/import/delete now preserve previous records on failure.
- [x] Implement the agreed Coloring Pages gallery and filters with lightweight
  browsing metadata, loading/error/empty states and responsive navigation.
- [x] Remove the dedicated user-facing Edit Page path; verify open, arrange, save
  drawing and save-as-new-coloring-page as the ordinary authoring journey. Decide
  the future of debug/revision controls without losing useful authoring capabilities.
- [x] Provide per-page copy/download and multi-page import preview; imported pages
  receive fresh IDs, with validation/size limits and manual clipboard fallback.
- [x] Implement template import/share separately from PNG/SVG/PDF picture output;
  verify round trips, missing assets, malformed input, collisions and storage failure.
- [x] Default blank pages to Display aspect ratio; keep A4/A5/Photo and add
  independent Square orientation. Normalize new pages to a 1000-unit short edge,
  preserve physical output separately, and use 300 DPI by default. Browser checks
  cover save/sharing, PNG dimensions, vector PDF and print sizing.
- [x] Apply the approved blank paper/orientation and color layout, with internal
  size markings, step navigation, full palette, paper summary and shared drawing action.
- [x] Implement [color study 01](color-overlay-examples/README.md): five 32-slot palettes,
  three-dot selector, custom edit mode and solid HSV/hex picker. Fixed palette slots
  0?127 and drawing-owned custom slots 128?159 merge by identity; recoloring,
  asynchronous saves, undo, display caches and resolved-color exports are covered.
- [ ] Finish the remaining export, delete and settings refinements, then apply
  the shared ribbon/overlay control system from release priority 2. Reduce
  redundant visible headings while retaining meaningful guidance and dialog names.
  Stickers now implement [study 02](sticker-overlay-examples/README.md): centered
  ink/detail controls, icon-only categories and stickers, responsive grids, authored
  difficulty filters and an independent ink-color dialog. Pure black/white defaults
  are applied; existing drawings retain their colors.
  Brush is implemented from approved [study 04](brush-overlay-examples/README.md):
  one brush, round/diagonal/opaque-scatter tips, full-width sizing and a small
  theme-colored footer sample in a matching well, with no divider. Fill now selects immediately with solid color and has no overlay. The other listed overlays remain to be refined.
- [ ] Validate keyboard/focus, pointer/touch, responsive density, no clipped controls
  and browsing performance as the page/sticker libraries grow. Run appropriate web
  checks; native builds only when requested.

Simple mode, toddler mode, parent locking and an online sharing hub are later work.
Keep all existing features enabled by default during this design phase.

## Existing engineering findings supporting the release plan

### Physical validation of action-based saves

Completed actions now queue detached checkpoints with one write and one latest
pending state per drawing. Home is independent of disk; pending reads/reopens and
bounded retries are implemented. Automated checks cover input during saves,
coalescing, canvas disposal, failed-write retry, pending previews and atomic rollback
when a transaction is aborted mid-write. The accepted policy allows losing the
latest actions on abrupt shutdown while retaining the previous committed drawing.
No strict per-stroke disk flush, backup journal or guaranteed unload save is needed.
On actual tablets/native builds, verify restoration after backgrounding, process
termination and interrupted saves. Simulated transaction aborts do not establish
hardware power-loss behavior. IndexedDB is device-local storage, not a backup;
browser eviction remains possible. Native builds only when requested.

### Brush/render fault recovery

Brush/eraser geometry failures now roll back affected region/section snapshots,
clear active input/animation state and report a retry/save message. Fault injection
covers press, drag, release, finalization and stationary spray; subsequent gestures
and undo remain usable. Fill failures preserve prior paint and use the same error
reporting route. Display scheduling already resets in `finally`. Continue real-device
fault/lifecycle testing; this closes the inspected open-gesture gap.

### Bounded/cancellable exports (confirmed work location)

`editor/pictureSvg.ts` builds DOM/path strings and explicit pattern geometry on the
main thread; `app/picturePdf.ts` also converts on the main thread. PNG has a
64-million-pixel guard, but vector output has no geometry/work budget or progress
cancellation. Native writes additionally reject files over 64 MiB after encoding.
Patterned blobs now limit work to their own bounds, but a deliberately large,
pattern-heavy drawing can still block the overlay. Measure that case, yield
between safe batches, add operation cancellation/progress and budget temporary
allocations/output bytes. Keep exact curves and vector printing; a PDF converter
requiring DOM cannot simply be moved unchanged to a worker.

### Background placement versus permitted document sizes

`Artwork.add` scales interior/horizon stickers to page width without the manual
transform's scale cap; `pictureValidation.ts` rejects scales above 4. A permitted
8192-by-2048 document can generate a background scale above 4 even for a
1920-unit asset. Ordinary paper presets are smaller and did not trigger this.
Choose one consistent policy for automatic background sizing versus validation,
then round-trip a maximum-size scene with added scenery. Saves now reject invalid
snapshots explicitly instead of silently losing them on reload.

### Other interaction and decode hot paths

`Artwork.move` may scan an entire local silhouette to find a visible point;
`Artwork.overlaps` scans overlapping page bounds, and moving a sticker clears
its cached answers. Test large mostly-transparent or disjoint-overlapping shapes
while dragging before replacing these checks with coarse occupancy/boundary
candidates. Separately measure cold scene preparation beyond the 24-entry/64 MiB
reuse cache: `rasterizeRegions.ts` allows 64 million cells, but labels, RGBA masks,
canvas backing and the BFS queue together can require far more bytes. Profile
peak allocations and definition rebuilds, then bound total transient bytes without
weakening hit accuracy. These costs were identified by inspection, not newly
benchmarked in this pass.

### Async UI/input behavior checks

- Sticker placement now invalidates pending results on picker close/unmount,
  rejects duplicate requests and uses the current committed view at completion.
  App picture preparation rejects stale results after exit/unmount. Continue
  testing interruption/retry on physical devices.
- `ui/appMouse.ts` synthesizes mouse events under adjusted speed. Native `select`
  popups (including PNG DPI) have no explicit picker adapter. Verify in actual
  pointer-lock/WebView2 mode; synthetic mouse events may not open the native menu.
  Preserve keyboard access and suspend capture if native picker activation needs
  it. This is a platform behavior to verify, not a failed ordinary-mouse test.
- Test non-Chromium engines. Current browser automation chooses Edge/Chrome only;
  SVG/print, pointer capture, touch routing, canvas budgets and CSS still need
  Firefox and Safari/iPad coverage before multiplatform claims.

### Browser offline/install expectations

There is no service worker or web-install manifest, and sticker sources load
lazily. A running tab can work with already loaded resources, but an offline
reload/cold sticker selection is not guaranteed by an explicit app cache. Native
assets are bundled. Decide whether browser install/offline caching is a goal;
if so, add an explicit versioned strategy with update/eviction tests rather than
relying on incidental HTTP cache behavior.

## Device/output validation supporting the beta gate

- **Real tablet workload:** repeat the saved complex-scene workload on a modest
  Android tablet. Check sustained brush input, pan/zoom, long-session memory and
  OS tab eviction. Desktop page CPU throttling does not model worker/GPU speed,
  touch hardware or a tablet's memory limits. Change budgets/scheduling only if
  those measurements justify it.
- **Physical printing:** check the SVG preview and PDF on a printer in portrait,
  landscape and square sizes. Confirm orientation, physical size, printable-area
  margins and optional driver scaling. The app supplies the document's page size;
  browser/driver settings still decide the final paper and margins.
- **Native output:** on the next explicitly requested Tauri build, test PNG/SVG/PDF
  native Save dialogs, cancellation, file contents and WebView2 vector printing.
  The generic `save_picture` adapter replaces `save_png`; frontend and native shell
  must be rebuilt together. No native build was run for this web refinement.
- **Manual input/display:** stylus pressure/device quirks, multi-monitor DPI,
  adjusted mouse/pointer lock and installed-platform lifecycle checks still need
  hands-on coverage beyond automated mouse/touch tests.

## Artwork repair follow-up

All submitted instructions through the full-library v5 pass have been applied.
No instruction from that pass remains deferred. Continue inspecting the repaired
assets with History 1 (v5, 17 assets) and History 2 (v4, seven assets). General
[visual review candidates](../art/README.md#visual-review-candidates) are not confirmed
new defects. Use the [reviewer](ARTWORK-REVIEW.md) for new observations and the
[repair workflow and effort guide](ARTWORK-REPAIR-LOG.md) for the next pass.

## Optional future feature

The export overlay works for browser and desktop. A native format-filter chooser
could replace the overlay on desktop if requested; it is not needed to save all
three current formats. PNG already offers 150, 300 and 600 DPI with a pixel-budget guard.

## Regression commands

- `npm run check`
- `npm run test:browser` (includes SVG/PNG/PDF output, browser vector print-to-PDF,
  export choices and saved-picture delete/restore)
- `npm run test:memory`
- `npm run test:scene`

Diagnostics go to ignored `work/tests/`; original art and shipped layouts are not
regenerated by these checks.

The explicit memory/scene npm scripts keep flags intact under PowerShell. For
custom profile options, invoke `node scripts/test-browser.mjs` directly.
