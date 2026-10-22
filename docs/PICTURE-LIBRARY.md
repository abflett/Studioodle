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
The base artwork and browsing stage stay fixed across picture ratios while the
live front sheet follows the saved picture aspect ratio. Browsing arrows remain
outside the open target, and utility buttons take click priority.
Forward/backward navigation adds a 240 ms page-turn transform without delaying
loading or interactions. Reduced-motion preferences disable the turn animation.
The square/landscape/portrait curled front-sheet assets and matching masks are a
separate visual follow-up; the current live preview keeps its straight edges.

The drawing, coloring and saved-picture choices use transparent, hand-inked
watercolor illustrations. Original generated PNGs and exact prompts live in
`art/source/interface/selection-objects.json` and its sibling files;
full-resolution, lossless WebP copies live under `src/assets/selection/`.
All three images decode during the splash alongside the editor module, so the
wordless home screen opens with its art ready. These are decorative interface
assets; painting and output stay vector.

The fresh pre-release IndexedDB database is `studioodle-library-v1` (schema 1).
`pictures` stores full format-5 drawings; `summaries` stores explicit metadata
projections with a compound update-time/ID index. Both records save and delete in
one transaction, and completion means the transaction committed. A failed write
leaves both previous records intact. There is no migration from previous
development libraries, and the vector document format has not changed.

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
