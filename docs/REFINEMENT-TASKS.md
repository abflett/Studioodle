# Remaining refinement and validation

The implementation items from the [architecture review](ARCHITECTURE-REVIEW.md)
are complete. There is no planned engine migration or compatibility work.
Keep additions driven by observed problems and requested features.

## Source-review follow-ups

These are open findings from the [source review](SOURCE-REVIEW.md), in practical
priority order. Confirmed code paths are distinguished from device-dependent risks.
No compatibility layer or engine replacement is proposed.

### 1. Load saved drawings on demand (completed)

The library now lists small ordered summaries and loads at most five full drawings
in priority order: current, next, previous, two ahead, two behind. Navigation
cancels obsolete reads, evicts unrelated drawings and ignores late results.
Summaries and artwork save/delete atomically in the same IndexedDB database.
Existing preview loading feedback remains, with retry for unavailable drawings.
A 120-complex-drawing browser profile verified ordering, the five-record bound and
collection of evicted records; storage and UI regressions cover rollback,
selection, delete/undo, reopening and export. See [measurements and limits](PICTURE-LIBRARY.md).

### 2. Define background save/recovery behavior (high priority, policy needed)

`ui/useEditorSaving.ts` saves every 60 seconds or on explicit/native guarded exit.
A browser tab/OS process killed between saves can lose that interval; no page-hide
checkpoint or dirty-state scheduling exists. Decide the desired relaxing-app
tradeoff, then coalesce dirty checkpoints and best-effort background saves. Do not
promise an async unload save will always finish or add confirmation prompts by
default. Verify restoration after backgrounding/discard and no burst of duplicate
writes while input/fill is pending. IndexedDB remains device-local storage, not a
backup; browser storage eviction is still possible.

### 3. Recover from brush/render faults (high priority, fault-path gap)

Bucket rollback and save failures are now covered. However,
`EditorSession.begin/move/end/update` still call synchronous brush geometry without
a common gesture-failure rollback. An injected geometry exception can leave an
open gesture. Display scheduling now resets in `finally` and has a recovery
regression, but user-facing error recovery is still absent. This is a code-path risk, not a
normal-input crash observed during this pass. Add fault-injected regressions,
rollback the affected gesture and provide a useful
retry/save route while preserving the last valid artwork. Do not hide real errors
or repeatedly redraw the same invalid state in a loop.

### 4. Bound and cancel expensive exports (medium priority, confirmed work location)

`editor/pictureSvg.ts` builds DOM/path strings and explicit pattern geometry on the
main thread; `app/picturePdf.ts` also converts on the main thread. PNG has a
64-million-pixel guard, but vector output has no geometry/work budget or progress
cancellation. Native writes additionally reject files over 64 MiB after encoding.
Patterned blobs now limit work to their own bounds, but a deliberately large,
pattern-heavy drawing can still block the overlay. Measure that case, yield
between safe batches, add operation cancellation/progress and budget temporary
allocations/output bytes. Keep exact curves and vector printing; a PDF converter
requiring DOM cannot simply be moved unchanged to a worker.

### 5. Make custom-page edits atomic (medium priority, confirmed partial-write path)

`ui/SelectionScreen.tsx` deletes a custom page from `workshopRepository` and then
`coloringPageRepository`. A failure on the second write can leave only the first
change committed. Two separate geometry-template stores also duplicate load/save
paths. Consider one authoritative page repository/record so revisions and quick
"save as coloring page" share atomic operations. Inject storage failures between
steps; require either a complete delete or the previous page to remain available.
This concerns templates/revisions, not the IndexedDB painted-picture store.

### 6. Align background placement with permitted document sizes (medium priority)

`Artwork.add` scales interior/horizon stickers to page width without the manual
transform's scale cap; `pictureValidation.ts` rejects scales above 4. A permitted
8192-by-2048 document can generate a background scale above 4 even for a
1920-unit asset. Ordinary paper presets are smaller and did not trigger this.
Choose one consistent policy for automatic background sizing versus validation,
then round-trip a maximum-size scene with added scenery. Saves now reject invalid
snapshots explicitly instead of silently losing them on reload.

### 7. Measure remaining interaction and decode hot paths (medium priority)

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

### 8. Finish async UI/input behavior checks (medium priority, behavior choice)

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

### 9. Clarify browser offline/install expectations (lower priority, product choice)

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

The first review-driven repair pass and effort grades are tracked in
[ARTWORK-REPAIR-LOG.md](ARTWORK-REPAIR-LOG.md), with exact marker IDs and coordinates
in the linked progress JSON. Read those records before starting another art pass;
the original export is retained unchanged. Open line closures and the conflicting
add/remove request require discussion before further work.

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
