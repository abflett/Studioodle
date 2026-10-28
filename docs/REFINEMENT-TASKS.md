# Remaining refinement and validation

Current open work, in practical priority order. Completed architecture/source reviews
and one-time measurements live in Git history; current behavior is documented in
[architecture](ARCHITECTURE.md), [performance](PERFORMANCE.md) and the feature guides.
There is no planned engine migration or old-save compatibility work.

## Active product design: overlays and coloring-page discovery

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
- [ ] Review [color study 01](color-overlay-examples/README.md): five 32-slot palettes,
  three-dot selector, custom edit mode and solid HSV/hex picker. After layout approval,
  implement fixed palette slots 0?127 and drawing-owned custom slots 128?159 with
  slot-based merging, undo, saving and resolved-color exports as one focused change.
- [ ] Extend the reviewed overlay pattern to stickers/categories,
  picture export, delete and settings. Reduce
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

## Open implementation work

### 1. Validate action-based saves on physical devices

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

### 2. Recover from brush/render faults (high priority, fault-path gap)

Bucket rollback and save failures are now covered. However,
`EditorSession.begin/move/end/update` still call synchronous brush geometry without
a common gesture-failure rollback. An injected geometry exception can leave an
open gesture. Display scheduling now resets in `finally` and has a recovery
regression, but user-facing error recovery is still absent. This is a code-path risk, not a
normal-input crash observed during this pass. Add fault-injected regressions,
rollback the affected gesture and provide a useful
retry/save route while preserving the last valid artwork. Do not hide real errors
or repeatedly redraw the same invalid state in a loop.

### 3. Bound and cancel expensive exports (medium priority, confirmed work location)

`editor/pictureSvg.ts` builds DOM/path strings and explicit pattern geometry on the
main thread; `app/picturePdf.ts` also converts on the main thread. PNG has a
64-million-pixel guard, but vector output has no geometry/work budget or progress
cancellation. Native writes additionally reject files over 64 MiB after encoding.
Patterned blobs now limit work to their own bounds, but a deliberately large,
pattern-heavy drawing can still block the overlay. Measure that case, yield
between safe batches, add operation cancellation/progress and budget temporary
allocations/output bytes. Keep exact curves and vector printing; a PDF converter
requiring DOM cannot simply be moved unchanged to a worker.

### 4. Align background placement with permitted document sizes (medium priority)

`Artwork.add` scales interior/horizon stickers to page width without the manual
transform's scale cap; `pictureValidation.ts` rejects scales above 4. A permitted
8192-by-2048 document can generate a background scale above 4 even for a
1920-unit asset. Ordinary paper presets are smaller and did not trigger this.
Choose one consistent policy for automatic background sizing versus validation,
then round-trip a maximum-size scene with added scenery. Saves now reject invalid
snapshots explicitly instead of silently losing them on reload.

### 5. Measure remaining interaction and decode hot paths (medium priority)

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

### 6. Finish async UI/input behavior checks (medium priority, behavior choice)

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

### 7. Clarify browser offline/install expectations (lower priority, product choice)

There is no service worker or web-install manifest, and sticker sources load
lazily. A running tab can work with already loaded resources, but an offline
reload/cold sticker selection is not guaranteed by an explicit app cache. Native
assets are bundled. Decide whether browser install/offline caching is a goal;
if so, add an explicit versioned strategy with update/eviction tests rather than
relying on incidental HTTP cache behavior.

## Validation still useful

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
