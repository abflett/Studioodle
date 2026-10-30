# Saved-picture library

The Home gallery lists lightweight metadata ordered newest first. Browsing loads
persisted PNG thumbnails, not full vector documents or hit geometry. Full drawings
load on demand for Continue, Print, Export, Delete (including undo restoration), or
Add to coloring pages. Browser print opens its window synchronously before lazy
source loading. Selection changes discard stale action completions.

## Shared IndexedDB storage

`studioodle-library-v9`, schema 2, contains `pictures`, `summaries`, `thumbnails`,
`pages` and `meta`. Drawing format remains 6. Picture/summary writes remain atomic;
delete includes the thumbnail in the same transaction. Summary records contain
compact sticker count/layout identity, so coloring-page action state needs no full
paint document. Older summary rows receive equivalent preview metadata when their
thumbnail loads. Read transactions scope only the stores they need.

Custom coloring pages are separate `pages` records with stable browsing order.
The one-time import reads valid `studioodle.workshop.v3` and
`studioodle.v6.coloring.*` data, respecting the old collection's authoritative flag.
Its marker and imported pages commit atomically. Failed imports retry without
altering legacy sources; completed imports never read those sources again. New
page operations are asynchronous, transactional and never write localStorage.
Settings/favorites still use their existing small records; their consolidation is
separate backlog work. Standalone reviewer data is untouched.

## Lazy bitmap previews

The selected drawing checks a thumbnail keyed by ID, content `updatedAt` revision
and renderer version. On a miss it loads that source once, restores read-only
Artwork, renders a PNG capped at 768 pixels on the long edge, then releases Artwork
and temporary canvas backing. This starts on gallery access, never while painting
or for all saved pictures upfront. The PNG includes the original paper, ink and
resolved palette. CSS cover/cropping uses the existing paper mask and proportions.
Direct bounded rendering is the initial quality choice; two-stage downsampling
remains a trial, not an assumed improvement. Bump `thumbnailVersion` when renderer
or bundled-art changes invalidate existing output.

Persisted cache hits do not read `pictures`, prepare stickers or build Artwork.
An LRU retains at most five bitmap URLs and revokes evictions; exiting Home clears
it. Maximum encoded PNG size is 3 MiB, and dimensions are validated before reuse.
Corrupt images receive one automatic source regeneration, then offer retry through
the gallery. Cache-write failures leave source drawings intact and can display the
in-memory result. Full source actions remain usable independently of preview errors.

Only one generation runs, with at most the latest waiting selection. Obsolete
queued work is rejected; cached PNG reads bypass generation entirely. Source
loading, generation and publication check cancellation. Shared sticker preparation
and synchronous Canvas work finish cooperatively rather than being preempted.
Before publication, the latest pending/persisted metadata is checked again.
Conditional cache writes reject superseded or deleted source revisions. Pending
save checkpoints can produce a preview before disk commits; an unpersisted preview
can retry cache storage on reuse. Unchanged save completion does not restart loads.

## Selection appearance

The watercolor paper stack and fixed tilt remain unchanged. Artwork uses the
same square/A4 paper geometry, exact mask and full-color cover placement. Navigation
keeps its page-turn animation and stable controls, with reduced-motion handling.
A bitmap's dimensions are independent of page tilt and window size. Editing,
SVG/PDF/print and high-resolution PNG exports still use original vector geometry.

## Action-based saving

Completed strokes, fills and sticker edits (including undo) queue detached
checkpoints. The app-level queue survives canvas disposal, with one active write
and one latest pending checkpoint per drawing. Home can browse and reopen the
latest pending checkpoint immediately. Live input does not wait for disk or
checkpoint compaction. Failures retain the pending drawing, retry with increasing
1–30 second delays and show an app-wide retry notice. Deletion discards queued
checkpoints and waits for the active write before deleting, preventing resurrection.

Checkpoints copy small surface/region/blob containers and share immutable vector
geometry. Only uncompacted regions go through the existing paint worker before
the atomic IndexedDB write. No input-stroke log, persisted undo history or separate
persistence worker is required. Normal IndexedDB durability is retained; the latest
actions can be lost on abrupt shutdown, while a transaction abort preserves the
previous complete drawing and its summary. Browser backgrounding finishes current
pointer input; it does not rely on an asynchronous unload save.

Save completion and retries no longer trigger summary reloads or restart cached
bitmap previews. Only new checkpoint contents notify browsing; unchanged
summary lists keep their existing identity and previews. Explicit retry still
invalidates the failed current record. Pending metadata is captured before and
after storage reads, so a write finishing mid-read needs no extra library refresh.

`npm run test:save` checks eight sticker flips over an existing painted page. The
28 October focused worker test went from eight paint-compaction jobs (884 ms total)
to one reused job (227 ms), with eight writes and maximum synchronous dispatch
around 1 ms in both runs. The writer is a test double: these totals measure
preparation/queue behavior, not disk throughput or physical pointer latency.
The same regression checks that live maintenance reuses a brush save's preparation.
The 28 October desktop browser regression captured a synthetic 7.0 MB drawing
(180,001 vertices) in 0.3 ms using shared geometry. Its direct validation/storage
write took 113 ms. These are single-run measurements, exclude worker compaction
and are not tablet or power-loss guarantees. The same suite verifies aborted-write
rollback, pending Home previews, retry, continued input and save completion after
canvas disposal. Run `npm run test:browser`; generated measurements stay in `work/`.

## Verification and measurements

`npm run test:library` runs transactional custom-page import/rollback, PNG revision
and Blob storage, cached reads without vector access, pending saves, stale
completion rejection, corrupt-image recovery, bounded URL eviction and 1,000/5,000
summary fixtures. `node scripts/test-browser.mjs --storage-ui` covers the library,
page picker, add-page matching, delete/undo and failure feedback. The full browser
suite also covers picture output, proportional portfolio masks and save/reopen.

A local Chromium run observed roughly 20-30 ms to list 1,000 summaries and
90-120 ms for 5,000 (about 0.29/1.44 MB serialized metadata). These are lightweight
synthetic documents, not a claim about 5,000 complex real paintings. The first
bounded PNG took 240-275 ms including cold setup/encoding; reloading its persisted
PNG took 1.5-1.6 ms with zero full-document reads. These compare preview cache paths,
not a measured whole-app speedup. Metadata still scales with collection size;
steady browsing and decoded previews do not preload the whole library.

Generated JSON/screenshots stay under `work/tests/`. Android/tablet hardware,
representative complex collections, storage quotas/eviction and broader thumbnail
quality/encoding trials remain on the refinement backlog. Device-local storage is
not a backup. The older five-full-document-window benchmark is retained only as a
comparison fixture (`--library-profile`); its historical measurements are in Git.
