# Road to Studioodle 1.0

Updated 30 October 2026. Core feature mechanics are complete enough to shift from
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
claiming a uniform whole-app speedup. This list records planned work, not completed
implementation.

- [ ] **Measure storage and selection-page baselines.** Seed 1,000 and 5,000
  mixed-complexity drawings and a substantial custom-page collection. Record
  estimated origin usage/quota separately from serialized payload bytes, cold/warm
  Home load, thumbnail availability, rapid browsing, save latency and peak memory.
  Include a modest Android device when available; desktop timings do not establish
  WebView capacity or tablet performance. Choose concrete budgets from these results.
- [ ] **Move custom coloring pages to IndexedDB.** Store pages individually rather
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
- [ ] **Persist lazy raster thumbnails for saved drawings.** On gallery access,
  first look for a thumbnail matching the drawing's content revision and thumbnail
  renderer version. On a miss, load the latest drawing, render a bounded raster,
  encode/store a Blob and reuse it on later views and visits. Generate on demand
  after returning Home, not during live painting or for the entire library upfront.
  Match page aspect ratio, background, sticker ink and custom palette exactly.
- [ ] **Make thumbnail lifetime safe and bounded.** Edits/undo invalidate the cached
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

### Canvas and interaction — after the selection-page batch

Planning direction: retain the numeric document model and Canvas2D renderer.
Live paint already uses numeric geometry/Path2D, not SVG strings or per-shape DOM
elements. SVG remains useful for editable source art, import and scalable export.
Prefer native circle/curve descriptions where appropriate; measure the savings
from avoiding polygon construction, boolean operations and repeated rendering.
This is an evolution of the current engine, not a second painting engine.

- [x] Build an isolated low-resolution cell-brush demonstration: `npm run cells`,
  100 × 100 cells, eight profiles, two color slots per cell, brush diameter, grid
  and memory diagnostics. Coverage-based fitting replaces shared corner labels and
  the three-color quadrant fallback; paper is transparent. Model and
  mouse/touch browser checks pass. This is an experiment, not app-engine integration
  or proof of the proposed memory/performance advantage; see tools/cell-brush/README.md.
- [x] Expand the experiment to 32 canonical shape families and byte-encoded rotation/
  reflection variants. Precompute coverage/edge tables and browser paths, skip
  equivalent fitting candidates, and use neighbor agreement only for equal-error
  ties at release without editing untouched cells. Add original-eight mode and
  repeatable test strokes for visual comparison. Cell data stays 29.30 KiB;
  numeric lookups add 68.25 KiB shared. Model/browser checks cover transformations,
  fitting improvement on a shallow-stroke fixture, overlap, release and touch.
- [x] Correct the expanded demo's backward saw-tooth contours: limit monotone
  boundary fits to direction-compatible splits/wedges; match actual selected edges
  using 32 edge probes and bounded join passes, allowing local coverage error in
  exchange for continuity. Penalize cross-cell direction reversals and preserve
  untouched cells. Regress shallow strokes in all rotations/reflections and both
  input directions, with no gaps or backward teeth and a sub-cell contour budget
  on the fixtures. Shared numeric tables are now 72.50 KiB; no app-engine change.
- [x] Add a separate straight-cut library, preserving experimental 32/original eight.
  Sixteen active bases cover all 80 quarter-edge straight boundaries under transforms
  and color swaps; reserve the other slots. Fit stroke-derived edge coverage and
  interior coverage independently by default; retain optional neighbor joining.
  Add repeatable circle dabs, enumerate the edge vocabulary and verify dab continuity/
  radial error and stroke partitioning with matching off/on. Cell data is unchanged;
  both dictionaries plus shared numeric tables occupy 79.75 KiB, excluding paths.
- [x] Fix repeated tangent teeth in straight-cut circle dabs. Rounded edge demands
  can conflict near a nearly full/empty cell; prefer uniform coverage when 60/64
  interior samples agree and the selected cut still mismatches the edges. Preserve
  exact small corner profiles. Regress 384 radius/offset/matching combinations for
  contour backtracking, retaining the existing radial-error and browser checks.
- [x] Add an independent round-brush coverage reference and visual difference view
  to distinguish profile teeth from real sharp cusps at overlapping round arcs.
  Include a reproducible overlapping-dab example and browser regressions for the
  reference gap/cusp, comparison controls, drawing while comparing and reset.
  Reference pixels add 3.81 MiB of diagnostic backing, included in display memory;
  no extra input log, authoritative raster paint or new profile fix is introduced.
- [x] Replace approximate edge-mask fitting for simple straight-library contours
  with analytic round-brush/grid-edge intersections and shared colored edge
  intervals. Snap/cache shared crossings and construct the profile from its two
  endpoints; coverage chooses colors only. Handle collapsed-corner and same-edge
  cuts explicitly, retaining the old scorer only for unsupported complex crossings.
  Regress analytic intervals, shared exits, full-to-3/4 alignment, curved strokes,
  direction/orientation, stable rounding ties and existing circle tests. The user's
  outside-edge teeth are distinct from true overlap cusps. No main-app engine change.
- [x] Add diameter-one arc/spiral fixtures with adjustable grid phase and opt-in
  cell inspection: actual/snapped crossings, chosen byte/colors, fitting route and
  neighboring cells. Verify capture does not alter output, snapshots do not mutate,
  and the open arc remains monotone at eight offsets. No selection-rule change.
- [x] Extend thin-contour reproduction with seeded mouse jitter, independent
  fractional X/Y starts, loose-to-tight bends, boundary flutter, stationary duplicates
  and backwards retraversal. Sweep seeds/amplitudes with matching off/on; verify
  idempotent coverage and analytic edges against the full noisy stroke union.
  Exercise the fixture controls and noisy native pointer input in browser tests.
- [x] Isolate the user's cell (60,42) fallback override: the nearly-uniform rule
  replaced a better inverted Corner 1/4-2/4 with Full. Retain the corner when it
  improves source coverage; regress the reconstructed crossings/sample mask for
  paint, another palette slot and erasure. Preserve tangent/arc/jitter regressions.
- [ ] Review remaining hand-drawn contour spikes after the coverage-aware fallback
  fix. Use the inspector's crossings and sample mismatches to identify additional
  causes before adding profiles or changing snapping rules.
- [x] Add a view-sized rectangular grid at approximately four CSS pixels per cell,
  keeping the 100 x 100 comparison mode and visible desktop tools. Report actual
  dimensions/storage; preserve drawing/aspect on resize and clear only on explicit
  refit/mode changes. Verify rectangular addressing/erasing and the 1920 x 1080
  layout, paint mapping, resize preservation and refit behavior. Update counters
  incrementally rather than scanning the full larger grid per frame.
- [x] Add 2 x 2 and 1 x 1 CSS-pixel grid modes alongside 4 x 4. Keep diagnostic
  reference backing at display scale; avoid full-grid Set allocation and empty-cell
  canvas clears on redraw. Verify 1080p dimensions, storage, painting and clearing.
- [x] Profile and optimize one-pixel cell painting: narrow row scans, proven-solid
  bypass, shared-edge de-duplication, reusable probe/histogram buffers, populated
  palette slots and coalesced-event layout batching. Add one-pixel cached display
  rendering. Preserve six pre-optimization model hashes and canonical software
  rendering across all profile/color cases; report isolated benchmark limits.
- [ ] Review the straight-cut demo's appearance and connectivity with the user before
  choosing authoritative cell storage or broad conversion. Compare to indexed raster
  at comparable quality; include two-color normalization at junctions, thin details and sparse/
  dense repeated paint. Measure model bytes, caches, conversion/render time and
  future undo costs independently. No engine replacement is decided.
- [ ] **Reproduce and profile scatter/spray and dense painting.** Use a
  user-provided detailed drawing (including the colored Moon Sorceress when available),
  a repeatable synthetic stress drawing and a simple control page. Cover sustained
  stationary spray, long strokes, overlapping strokes and increasing paint density.
  Capture input-to-visible latency, longest main-thread tasks, worker job/queue time,
  geometry/node/blob growth, display work, save work and peak memory. Separate cold
  loads from warm reuse, and record device/browser/build conditions. Keep diagnostics
  in standalone tools/tests and ignored `work/`, never in the main app ribbon.
- [ ] **Prototype spray outside fill topology.** Give each relevant page/sticker
  surface its own spray overlay beneath its line art, attached to that surface's
  transforms and stacking order. Bucket fills should ignore spray dots and operate
  on the underlying ordinary paint, including when the pointer lands on a dot.
  Avoid per-dot polygon union/subtraction and participation in bucket connectivity.
  Confirm the open behavior questions below before committing the new semantics.
- [ ] **Trial larger, fewer spray dots and compact particle data.** Describe dots
  by position, radius and palette slot; render circles directly through Canvas2D
  with surface clipping. Control emission by elapsed time/distance rather than
  pointer-event frequency, with bounded catch-up after stalls. Preserve continuous
  stationary spray and the opaque effect initially. Compare visual quality and
  measured costs against the current polygon implementation; primitives alone do
  not guarantee an end-to-end speedup.
- [ ] **Cache spray display without making pixels the sole source.** Evaluate
  bounded raster tiles backed by immutable particle chunks. Bound generation,
  decoded memory and sustained-spray data growth; avoid replaying every particle
  each frame. Retain palette recoloring, surface movement, clipping and high-quality
  PNG/SVG/PDF/print output. Save particles as document data, not an input-event log.
  Undo retains affected prior chunks/tiles within the memory budget, not full-scene
  copies or a fixed action count. Background cache work must not alter restored
  history. Reject stale cache completions after edits, undo or palette changes.
- [ ] Fix remaining measured ordinary-paint bottlenecks separately. Bound queued
  work and transient allocations; investigate batching, coverage reuse, compaction
  and scheduling based on evidence. A dedicated worker is an option to evaluate,
  not a predetermined solution. Preserve immediate feedback and action saving.
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
- [ ] **Reuse pixels while navigating.** Evaluate bounded overscan/tiles for panning
  and immediate cached-pixel scaling during zoom followed by a sharp refresh.
  Render newly exposed areas and invalidated content rather than replaying all
  geometry. Avoid maximum-zoom whole-page bitmaps; measure sharpness, refresh delay,
  cache memory and stale-result cancellation on real target devices.
- [ ] Improve cold reopen and saved-picture carousel latency. Measure preview loading,
  SVG/definition decode, paint restoration, prefetch, stale-load cancellation and
  cache eviction independently. Rapid browsing must not accumulate obsolete work.
- [ ] Set explicit response-time and memory budgets after measuring the minimum target
  device, then add focused regressions. Use representative long sessions and complex
  artwork, not only empty-page timings. Release acceptance: no crashes/freezes or
  multi-second input stalls in the agreed workloads; browsing and navigation remain
  responsive, memory/queues settle, and artwork/undo/save integrity is preserved.
- [ ] Finish the gesture-failure rollback and physical save-interruption validation
  described in the engineering findings below. These remain blockers even if the
  ordinary-input performance fixes are successful.

#### Open canvas decisions — discuss before implementing the affected behavior

- **Paint ordering:** should normal brush strokes made after spraying remain below
  the spray, or cover it? A fixed overlay is simpler; arbitrary interleaving needs
  an explicit ordering model. Fill should ignore spray either way.
- **Eraser scope:** erase spray, ordinary paint or both? Decide whether the existing
  eraser is sufficient and what happens across surface/region boundaries.
- **Spray confinement:** preserve current clipping behavior or confine a gesture
  to its starting region? Decide how overlapping stickers and exposed paper receive
  particles; line art stays above spray.
- **Appearance:** settle dot size, density and size-control meaning with visual
  trials. Keep opaque dots initially; translucency/blending requires a separate
  decision about accumulation, palette changes and output equivalence.
- **Long-session limits:** choose particle chunking, coverage reuse and tile budgets
  from measured sustained-spray growth. Do not silently discard visible artwork or
  flatten away required editability to meet a budget.
- **Output and zoom quality:** decide whether SVG/PDF keep individual circles or
  use another reviewed representation; measure large-output costs. Set acceptable
  temporary zoom softness and time-to-sharpness. Cache resolution is independent
  of authoritative particle precision.

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

### Brush/render fault recovery (high priority, fault-path gap)

Bucket rollback and save failures are now covered. However,
`EditorSession.begin/move/end/update` still call synchronous brush geometry without
a common gesture-failure rollback. An injected geometry exception can leave an
open gesture. Display scheduling now resets in `finally` and has a recovery
regression, but user-facing error recovery is still absent. This is a code-path risk, not a
normal-input crash observed during this pass. Add fault-injected regressions,
rollback the affected gesture and provide a useful
retry/save route while preserving the last valid artwork. Do not hide real errors
or repeatedly redraw the same invalid state in a loop.

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

- `EditorPreview` can still complete a pending sticker load after its picker is
  closed; its placement uses the initiating view's captured coordinates. Decide
  whether closing cancels or completes placement, then add request identity and
  stale-completion tests. `App` picture preparation likewise has no explicit
  cancellation token if the screen exits mid-load.
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
