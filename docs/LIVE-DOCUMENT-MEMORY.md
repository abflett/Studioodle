# Live-document memory investigation

Measured on 2026-10-21 with an isolated Edge browser profile. Eight repeated
open/paint/save/close cycles already reached a steady retained-memory baseline.
This did not reveal an accumulating document leak. The audit did expose avoidable
live duplication and native resource retention, which were fixed.

## Implemented changes

- Keep weak references to decoded definitions still owned by open artwork or a
  preview. Evicting the strong reuse cache no longer forces another copy of the
  same sticker's lookup arrays while its first instance remains alive. Weak
  references do not keep inactive definitions alive or raise the 64 MiB strong
  lookup-cache budget.
- Clear retained SVG source text when the editor closes. Sources still support
  synchronous restoration while editing; future cold preparation reloads assets
  normally. There is no old-save decoder or migration path.
- Give lazy region geometry its own closure scope. It retains the path text and
  transform it needs, but no longer keeps the SVG parser document alive through
  other decoder callbacks. Hit maps remain prepared before interactive editing;
  this does not defer expensive work to the first brush/fill action.
- Avoid cloning saved paint twice during artwork restoration. Surface properties
  are copied separately; VectorPaint owns the single deep clone of paint geometry.
- Shrink the main display canvas to 1 x 1 on destruction, releasing its backing
  pixels immediately even when browser observer/delivery bookkeeping briefly
  retains the canvas wrapper.

## Lifecycle workload

The fixture is the same 26-sticker safari drawing used in the performance test:
293 colored sticker regions, 216 shading strokes and 37,931 paint vertices. Its
builder now lives in a shared test module, derived from the bundled coloring book.

Each cycle loads the drawing from an isolated IndexedDB repository, creates the
real CanvasEditor/EditorSession, applies five further strokes (120 move samples),
renders through CanvasViewport, saves, and destroys the adapter. The stored drawing
is reused on the next cycle. Measurements follow worker completion and forced
browser garbage collection; test tracking uses weak references so it cannot itself
keep sessions or artwork alive. Viewport rendering is called explicitly because
headless animation/visibility scheduling is not reliable for memory coverage.

A separate pressure probe uses five large sticker types whose needed lookup arrays
exceed the reuse budget, with a repeated space crater. This intentionally exercises
eviction while an earlier instance remains alive. It is a memory ownership probe,
not a proposed coloring-page layout.

## Results

| Measurement | Before | After |
| --- | ---: | ---: |
| Pressure probe: sticker types | 5 | 5 |
| Pressure probe: definition objects | 6 | 5 |
| Pressure probe: lookup arrays | 91.71 MiB | 69.30 MiB |
| Active safari: DOM documents reported by browser | 24 | 7 |
| Pressure probe: DOM nodes reported by browser | 3,601 | 468 |
| Closed cycles: retained EditorSession / Artwork | 0 / 0 | 0 / 0 |

The lookup ownership fix saves 22.41 MiB in the probe. A needed live working set
can legitimately exceed the 64 MiB strong reuse-cache budget: its artwork owns
those definitions. The change removes duplicate ownership, not required content.

Closed-cycle JavaScript heap remained around 16.5 MiB in this harness both before
and after. The final closed sample's backing storage was about 11.4 MiB before
and 11.2 MiB after. These totals include the app, diagnostic modules and browser
instrumentation; they are not the size of a saved picture. The principal gain is
lower active/transient memory, not a claim that a runaway leak was eliminated.

Before the fix, a closed canvas wrapper occasionally still held its approximately
2.2 MiB display backing at the collection checkpoint. After the fix, any surviving
wrapper had only its 1 x 1 placeholder. Closed artwork/session counts stayed zero
through all eight cycles. Canvas wrappers, documents and node counts can include
browser-managed bookkeeping; the desired invariant is that closed documents and
large canvas backings are released.

## Scope and limits

`Runtime.getHeapUsage` reports JavaScript heap, embedder heap and backing storage
as separate fields. These are not a complete browser-process/GPU memory measurement
and should not be added blindly to cache limits. Native Path2D storage, graphics
driver allocation, the main canvas, in-flight worker copies and undo are separate
from the definition reuse budget. The whole app is not capped at 64 MiB.

The lifecycle samples use garbage collection to distinguish retained objects from
ordinary allocation churn. They do not predict uncollected peak RSS on a physical
tablet. Repeated visits to the same scene reaching a plateau do not prove every
future workflow leak-free. No sticker count limit, paint limit, worker pool or
compatibility layer was added.

## Reproduce

```sh
node scripts/test-browser.mjs --memory-profile
```

The diagnostic creates its own temporary browser profile and database. It leaves
JSON measurements under ignored `work/tests/document-memory-results.json`. It
asserts no duplicate live definitions in the pressure probe, collectible closed
sessions/artwork, no retained large closed canvas buffers, and a plateau across
the final four closed cycles (2 MiB tolerance for heap and backing-store variation).
Those checks concern this diagnostic workload, not arbitrary document-size limits.

The normal unit test now checks live identity reuse across definition eviction,
fetch deduplication, strong-cache accounting and idle source-cache clearing. The
ordinary browser suite continues to cover painting, hit regions, undo, save/reopen,
previews, canvas cleanup and vector output.
