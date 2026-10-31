# Current context

Updated 31 October 2026. Read `AGENTS.md` first and use the checked-out repository
root. `README.md` indexes commands/docs; `REFINEMENT-TASKS.md` is the sole backlog.

## Working boundaries

- Keep the app web-first. Routine checks use Vite; build native apps/installers
  only when explicitly requested. Commit and push completed coherent batches after
  relevant checks. Preserve unrelated work and never force-push.
- The user runs their dev/reviewer/cell servers manually. Automated checks close
  their temporary servers; do not stop a user-owned server as routine cleanup.
- Original art belongs under `art/source/`; generated diagnostics, builds and trial
  output belong in ignored `work/`, `dist/` or `release/`. Required executables stay
  in ignored `tools/bin/` or use `POTRACE_PATH`. Keep dependencies/build caches.
- Pre-v1 breaking changes are allowed, but preserve valid source layouts and the
  explicitly supported one-time custom-page import. No old general raster engine,
  second vector engine or blanket artwork regeneration.

## App and editing model

React owns screens/controls/view state. `EditorSession` owns gestures, action-based
saves and memory-bounded undo. `Artwork` coordinates scene ownership and stacking;
`Surface` owns local transforms, paint buffers, serialization and disposal.
`CanvasEditor` adapts browser input; `CanvasViewport` draws the visible workspace.
These boundaries do not import React/storage/native adapters into editor logic.

Ordinary brush/fill and line art remain numeric vectors. Worker maintenance merges
changed regions with compacted-prefix reuse; exact curves clip display/output.
Conservative interior-cell proofs skip booleans only away from every region/hole
boundary. An estimated 8MiB LRU retains Clipper's reusable immutable region inputs;
display caches have a separate 64MiB pixel budget. Distant paint islands stay out
of local boolean operations. Connected fills move their selected component directly
and merge its destination style. Precision remains 1/64 for brush input and
1/4096 for booleans. These are workload-specific gains, not constant-cost painting
or a uniform 10x app speedup. See VECTOR-PAINT.md and PERFORMANCE.md.

Soft raster spray is accepted by the user and isolated in `editor/rasterSpray.ts`.
It stores sparse 128px RGBA sections per surface: ordinary paint, spray, then line
art. Fills ignore spray; eraser clears both. Colors are baked and do not recolor
with palette edits. Resolution is fixed (up to 1536px long edge/1 megapixel before
section padding per surface); zoom/export reuse those pixels. SVG/PDF/print embed
PNG sections. Undo stores prior affected sections within its memory budget.
No particles/event log or high-DPI reconstruction. Existing old vector spray marks
are not converted. Eraser diameter is now one-third of its former 40 logical units.

Undo retains affected regions/sections and small sticker-property records, not
whole-scene copies or stroke logs. Background work must not rewrite restored
history. Brush geometry failures roll back the gesture, release input and report
a retry/save message; failed fills preserve previous paint. Fault injection covers
press, drag, release, finalization and stationary spray. Sticker loads are invalidated
when the picker closes/unmounts and placement uses the current committed view.

## Persistence and output

Saved drawings/documents are format 6, with optional `rasterSpray` version 1.
IndexedDB `studioodle-library-v9`, schema 2, owns `pictures`, `summaries`, `pages`,
`thumbnails` and `meta`. `app/pictures.ts` supplies pending-aware drawing reads;
`app/customColoringPages.ts` composes current custom-page storage.

Custom pages import valid `studioodle.workshop.v3` / `studioodle.v6.coloring.*`
records once, with an atomic completion marker and stable ordering. Legacy sources
are read-only; new page import/save/delete uses IndexedDB only. Settings, theme,
favorites and pointer preferences still use localStorage pending consolidation.
Reviewer storage is independent. IndexedDB is device-local storage, not backup.

Completed actions queue detached immutable checkpoints: one active write and one
latest pending checkpoint per drawing. Save preparation/worker work runs separately
from input; Home does not wait for disk. Pending artwork supplies previews/reopens.
Failed writes retry with bounded backoff. Drawing/summary writes are atomic. Abrupt
shutdown may lose latest pending actions; physical-device interruption testing and
editable backup/restore remain on the backlog.

Gallery browsing loads revision/version-aware PNGs capped at 768px long edge.
Missing/corrupt previews regenerate on demand. One generation plus latest waiting
selection is bounded; bitmap reads bypass generation. Five object URLs are retained,
revoked on eviction/Home exit. Opening/output/delete loads source on demand; browser
print opens synchronously. Source/revision checks reject stale cache completion.
Metadata still scales with library size; complex real collections/Android need tests.

New blank pages default to Display aspect ratio (screen, with window fallback),
with A4/A5/Photo alternatives and Tall/Wide/Square orientations. Their short edge
is 1000 logical units; resizing only changes the view. Separate `printSizeMm`
metadata preserves physical output (Display uses a 210 mm short edge). Existing
saved/bundled layouts retain their coordinates.

Output keeps ordinary vectors and exact source ink; PNG defaults to 300 DPI and offers 150/300/600 DPI
within its pixel budget. Spray retains its screen-oriented pixels. Custom page
sharing strips all paint and uses `studioodle-page:4:` with fresh imported IDs;
internal books remain version 2. See PICTURE-OUTPUT.md and COLORING-BOOKS.md.

## Current interface

The editor ribbon toggles with T or its corner arrow-and-line icon. Both controls sit at the
top right with safe-area spacing. Both are circular. Ribbon tools use borderless transparent groups, white shadowed icons, circular
white-film hover targets and a gold selected tool. The open-ribbon toggle matches; only the floating reopen control has a transparent center, 75%-opaque
white border/icon, an even shadow glow and a white hover film.
Fit mode refits to the expanded workspace; manual zoom retains its absolute scale
and center artwork point across layout changes. Toggle focus follows the visible
control; ribbon visibility is session-local and does not alter saved artwork.

The wordless selection screen uses the easel, open book and saved-art stack.
Preserve paper aspect ratios/masks, full-bleed artwork, stable carousel geometry
and subtle artwork-only hover scaling. Loading sits beneath the branded stack
logo, outside the rotated preview mask. Opening hides the front sheet/actions
while the same spinner remains; there is no translucent picture-loading overlay
or progress bar. Startup's separate splash progress remains.

Coloring Pages uses a single preview plus optional grid, subject/detail filters,
favorites, user page import/share/delete and ordinary drawing/save-as-page authoring.
The add-page plus/check uses layout content (including ink/transforms/order) and
ignores paint/title/paper color. Bundled layouts come only from
`src/assets/coloringBook.json`. No in-app developer workshop or authoring route.

Brush has round, two diagonal and soft spray tips, sizes 1?64 (default 5). Fill
selects/applies solid color immediately; no fill overlay. Old patterned vector
artwork still renders/exports. Gestures can start outside paper and continue onto
it, with clipping and one-action undo/cancellation. Empty Select clicks consume
the gesture and return to Fill on release; cancellation restores selection.

The palette has five sets of 32 slots: four fixed sets (0?127) and drawing-owned
custom slots (128?159), initially null. Negative `-slot-1` tokens preserve identity;
merging compares tokens, not resolved RGB. Edits recolor vector paint/ink without
rebuilding geometry, participate in undo and action saving, and resolve for output.
Defaults are pure black/white; existing colors/ink are preserved. Sticker picker
has ten stable category icons, authored detail filters, and an independent ink dialog.

Icon redesign remains deferred. Keep original app controls and all concept boards
under `docs/icons/` / `art/source/interface/icon-studies/` for inspiration; do not
resume redesign without a request. UI guides/studies are linked from README.

## Artwork and standalone tools

Current content: 364 stickers and six bundled pages. The release goal is 1,000+
accepted stickers plus substantially more curated solo/composed pages; roughly
80% of suitable stickers is a curation target, not a quota for weak pages.

All submitted repairs through full-library v5 are applied (13 lines, 13 transparency
markers, eight fills, one rectangle correction across 17 assets). Reviewer History 1
is v5 (17), History 2 v4 (seven); no submitted v5 instruction is deferred. Minimum
clickable region area is 10.2 square pixels at proportional A4/150 DPI. Tune small
region cleanup on targeted examples before any bulk reprocessing. Preserve original
and accepted ink sources; see STICKER-PIPELINE.md and ARTWORK-REPAIR-LOG.md.

The reviewer is standalone under `tools/artwork-review/`. Preserve
`studioodle-artwork-review-v1`, user annotations/origin and the compact revision
graph. New immutable review inputs go in `art/reviews/`; apply lines before region
regeneration, then evaluate markers by coordinates. Never import reviewer code/data
into `src/` or reset review storage to make a test pass.

The cell-brush experiment is successful and parked under `tools/cell-brush/`.
The user prefers crisp vector contours. Preserve the demo/benchmarks; no new cell
profiles, integration, line-art conversion or Android/desktop engine split is current
work. Detailed grids, contour diagnostics, limitations and benchmark commands are
in its README. It remains a fallback idea if measured vector improvements fail.

## Cleanup and verification

The cleanup removes retired localStorage writers, unused workshop composition and
obsolete control CSS, and separates Surface/spray responsibilities. The legacy
page importer remains explicit/read-only. Dev-only literal sticker URLs avoid an
eager JS URL-module request for every SVG; production retains Vite's hashed assets.
Test caches are isolated under `work/`; generated HTML/build output is excluded
from app watching so diagnostics cannot reload an open drawing.

Use `npm run check` and `npm run test:browser` for app changes. Focused storage,
paint, save, scene and memory commands are documented in README/PERFORMANCE.md.
Reviewer edits additionally require `review:typecheck`, `test:review`, and for
entry/build changes `review:build`. Cells retain `cells:typecheck`, `cells:build`,
`test:cells`; no native build is implicit in any cleanup/check.

Known remaining release work is in REFINEMENT-TASKS.md: pan/zoom and long-session
performance on modest devices, storage health/backup, cancellable vector exports,
maximum-size background validation, physical save interruption/printing/native
input checks, and Firefox/Safari/iPad coverage. Browser offline reload/install is
not promised by a service worker or manifest; native assets are bundled.
