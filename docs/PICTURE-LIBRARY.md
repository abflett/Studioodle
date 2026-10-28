# Saved-picture loading

The home screen reads small metadata records, ordered newest first by update time
and then ID. Full vector documents are fetched individually. The browsing cache
holds at most five drawings, wrapping at the ends of the carousel:

1. Current picture.
2. Next picture.
3. Previous picture.
4. Two pictures ahead.
5. Two pictures behind.

Reads are sequential in that order. Navigation aborts the previous run, prunes
unrelated or outdated entries and starts the new current picture first. A late
completion cannot repopulate the cache or replace the selected picture. Small
libraries deduplicate overlapping positions. Failed neighbors do not block the
others; current-picture failures expose retry. Opening, exporting and deleting
require the selected full drawing to be loaded. The existing preview spinner also
covers data loading; sticker preparation and preview rendering remain lazy for
the selected picture rather than allocating five rendered canvases. Cached data is
available during the selection render, and preview work starts before paint with
no forced animation-frame delay. The visual spinner appears only after 120 ms of
pending work; failures appear immediately. Warm-navigation browser tests verify
that cached pictures are ready by the next painted frame without a spinner.

The selection screen presents saved work over a permanent illustrated paper stack
beneath the drawing easel and coloring book, with no visible choice captions.
The static stack is temporarily hidden during the paper-mask review; its asset
and layer are retained for restoration.
The base artwork and browsing stage stay fixed across picture ratios. The front
sheet selects the closest square, A4 landscape or A4 portrait illustration.
The carousel has three layers: the unchanged stack, the complete rectangular
picture clipped to a paper silhouette, and the original paper border/folds with
an actually transparent center. The picture is rendered normally at display
density, without mesh warping, cover scaling, edge copying or multiply blending.
The image rectangle follows the saved picture's exact proportions. One shared
coordinate system derives both its cutout and the overlay's transparent opening;
the original paper alpha provides a second clip so artwork cannot poke outside.
The overlay overlaps the cutout slightly to hide antialiasing seams.
The sheet keeps a slight fixed counterclockwise tilt. Preview backing dimensions
use local sizes so rotation does not introduce extra cropping. Browsing arrows remain
outside the open target, and utility buttons take click priority.
Forward/backward navigation adds a 240 ms page-turn transform without delaying
loading or interactions. Reduced-motion preferences disable the turn animation.
The overlay keeps its original paper colors, ink border and folded corners.
Its center is transparent, and the saved picture shows through with its original
colors. There is no faded inset frame.
This decorative preview treatment does not change saved artwork or exported colors.

The drawing, coloring and saved-picture choices use transparent, hand-inked
watercolor illustrations. Original generated PNGs and exact prompts live in
`art/source/interface/selection-objects.json` and its sibling files;
full-resolution, lossless WebP copies live under `src/assets/selection/`.
All six illustrations and their six derived masks decode during the splash alongside the editor module, so the
wordless home screen opens with its art ready. These are decorative interface
assets; painting and output stay vector.

The fresh pre-release IndexedDB database is `studioodle-library-v8` (schema 1).
`pictures` stores full format-5 drawings; `summaries` stores explicit metadata
projections with a compound update-time/ID index. Both records save and delete in
one transaction, and completion means the transaction committed. A failed write
leaves both previous records intact. There is no migration from previous
development libraries, and the vector document format has not changed.

## Save policy and regression coverage

Saving runs every minute and on Home/Ctrl+S/guarded desktop close, only when artwork
changed. It waits for live paint compaction and one atomic drawing/summary write.
The action-save queue, checkpoint caches and pending library overlay have been
removed; normal reads and the five-picture window use the pre-change paths.
The drawing database remains studioodle-library-v8, with existing documents intact.

A same-workload comparison against commit 6425608 used a synthetic colored moon
sorceress (199 regions) and 16 multi-sample brush gestures. Action saving performed
12 writes and sent 2,198 paint blobs across 42 worker jobs; minute/manual saving
performed one explicit write and sent 832 blobs across 33 jobs. Live paint and
undo still use the worker. This confirms added scheduling/storage load; it does
not reproduce the user's exact saved picture or establish its loading latency.
After outstanding work drained, standalone load/render was about 8-14 ms in both
versions on this machine. Responsiveness takes priority over per-action recovery.

`tests/browser/moon-save-recovery.ts` retains the colored-sticker workload and
asserts zero writes while painting, one explicit save, no unchanged rewrite and
preserved colored regions through repeated load/render. Run the full browser suite
or `node scripts/test-browser.mjs --moon-profile`. A restored-path run loaded and
rendered in roughly 8-9 ms. Timings are diagnostics, not device-level guarantees.
Storage regressions still abort a transaction mid-write to verify both previous
committed records survive. No browser data reset, migration or native build is needed.

## Browser measurement, 2026-10-22

Run `npm run test:library` to reproduce the isolated headless Chromium profile.
It stores 120 separate copies of the advanced Safari fixture, each with 26
stickers, 293 colored regions, 216 simulated shading/highlight strokes, 555 paint
blobs and 37,931 vertices. Each drawing is approximately 1.27 MB of JSON. Repeated
geometry is a controlled load fixture, not a claim of 120 distinct illustrations.

| Measurement | Observed result |
| --- | --- |
| Summary list | 1.9 ms; 18,863 bytes of JSON for 120 summaries |
| Uncached current drawing available | 19.8–26.7 ms |
| Prefetched current drawing available | 0.2 ms |
| Entire five-picture window loaded | 91.9–122.5 ms for unrelated selections |
| Cached drawing JSON | About 6.37 MB for five drawings |
| Post-GC JS heap, summaries only | 18.78 MiB |
| Post-GC JS heap while browsing | 30.21–30.23 MiB across six selections |
| Post-GC JS heap after disposal | 18.79 MiB |

Weak references confirmed exactly five live loaded records at each settled
selection, including after distant jumps; disposal released all 26 records loaded
over the run. Moving one position within the warmed window read only the newly
exposed neighbor. The test also rejects any full-document `getAll()` scan.
Raw measurements remain under ignored `work/tests/picture-library-results.json`.

These timings cover metadata/data availability, not complete preview latency or
cold-device startup. They are desktop, unthrottled measurements with a freshly
seeded database; no old implementation was benchmarked for comparison. Heap totals
include the fixture's prepared sticker definitions and application overhead.
JSON byte counts describe payload size, not actual heap consumption or IndexedDB
disk usage. Metadata still scales with library count, but full geometry no longer
does. Five drawings are a count bound, not a byte cap; exceptionally complex
drawings can still be large. Delete undo, export dialogs and the active editor may
intentionally retain additional drawings outside the browsing cache.

Unit tests cover priority, cancellation, revision invalidation, retries and small
libraries. Browser regressions cover large-vector round trips, atomic save/delete
rollback, aborted reads, concurrent deletes, restored selection, save/reopen and
the export workflow.
