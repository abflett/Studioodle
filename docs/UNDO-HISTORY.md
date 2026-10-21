# Region-based undo

History stores previous painting states, not pointer movements, brush commands or
a permanent stroke log. It is session-local and does not change the saved drawing
format. Rendering and the SVG conversion pipeline are unchanged.

## What an action retains

- Fill/brush/eraser: the previous paint state of each affected region, once per
  gesture. A sweep crossing multiple stickers still creates one undo action.
- Move, transform, flip and reorder: previous sticker properties and layer index;
  no paint is copied.
- Add or duplicate: the added ID, so undo removes it.
- Delete: sticker properties, layer position and region checkpoints to restore it.

`Artwork.beginChange/endChange` journal actual mutations. No-op moves and empty
changes are discarded. Canceling a gesture restores its journal without creating
or removing history entries. Focus uses monotonic action sequence markers, so
memory eviction cannot shift or invalidate its undo boundary.

## Compaction and responsiveness

A checkpoint copies the small region object/blob list, while sharing immutable
geometry. It never clones the scene or enumerates all the coordinates during input.
Known compacted states need no history job. Pending or restored/unverified paint
is compacted asynchronously into color blobs through the same geometry engine.

`UndoHistory` submits at most one historical compaction at a time. There can be a
short-lived list of unmerged coverage while the worker catches up, but it is not
the intended retained history representation. The job replaces that checkpoint
with compacted blobs and drops references to its old samples. Painting continues
without waiting for it. Live paint maintenance and bucket jobs use the existing
shared worker; no worker pool or new rendering engine is introduced.

Undo can restore a pending checkpoint immediately; worker completion cannot mutate
that restored paint or later edits. The restored live state can compact separately.
This preserves the gesture boundary without waiting for background work. If a
history compaction fails, its valid prior state is retained within the same memory
budget rather than silently losing the painting.

## Memory policy

There is no 50-action cap. The initial budget is **128 MiB of estimated history
memory**, configured by `undoMemoryBudget` in `UndoHistory.ts`. Oldest complete
actions are evicted as needed, including an individual action too large to fit.
An empty or unchanged action consumes no entry.

Accounting includes region/blob/property overhead and a conservative allowance
for JavaScript geometry arrays/points. The same geometry object referenced by
multiple entries is charged once, with reference counts. Nested partial sharing
can be counted conservatively more than once. Compaction refreshes accounting;
popped, evicted and cleared entries release their charges and queued work.

This is not an exact browser heap cap. Active artwork, its gesture checkpoint,
renderer caches, runtime overhead and an in-flight worker's structured-cloned
message are additional memory. No dependency on total device RAM or paging is
assumed. The budget can be tuned from actual device testing without changing undo
semantics or adding a user-facing setting.

## Verification

Unit regressions exercise region isolation, 180 fill undos, 200 shared-geometry
entries, worker compaction of 80 pending brush samples to one blob, memory eviction,
focus sequence markers, property-only transforms, add/duplicate/delete restoration,
no-op moves and late worker completion after undo. Session tests retain cancellation,
focus and asynchronous fill ordering coverage. Browser regressions exercise the real
worker and the full React mouse/touch/save/reopen path.

A small fill retains only its previous region backing/style when there are no brush
blobs. Returning paint to the base style subtracts coverage from other colors and
removes the redundant base-colored blob during normal compaction.
