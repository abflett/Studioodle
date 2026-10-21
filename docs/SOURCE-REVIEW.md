# Source review - 21 October 2026

This is a correctness and maintenance pass after the architecture refinements,
not a second engine migration or a claim of exhaustive platform certification.
Original artwork, shipped SVGs/layouts and the vector save format are unchanged.

## Coverage

The static source inventory contains 85 TypeScript/TSX modules and about 5,000
lines during this pass (CSS, assets, scripts and tests excluded from that count).
The entry-point graph reaches 83 modules including the worker and dynamic imports;
the remaining two are type-only `savedPicture.ts` and `stickerKinds.ts`, not dead
implementations. No runtime import cycle was found. TypeScript already checks
unused locals/parameters, strict types and unchecked array access; ESLint enforces
editor/canvas boundaries.

Read-through concentrated on session transactions, gestures/adapter lifecycle,
paint and history maintenance, hit maps/geometry, cache ownership, persistence
validation, UI async state, startup, print/export, native ports, and authoring/build
scripts. Generated asset data was not hand-reviewed or regenerated. Dependency
advisory checks are supplementary; a clean result is not a security audit.

## Fixes completed

| Finding | Correction and verification |
| --- | --- |
| Window blur/visibility calls `end()` directly while an asynchronous bucket fill owns the journal. It could consume the transaction before the fill completed, losing Undo. | Defer end until the pending operation finishes. A regression failed before the fix and now restores the exact previous state. |
| A synchronous bucket exception left its transaction open and could preserve a partial edit. | Roll back, close the journal and allow the next edit. Fault-injected regression covers a mutation followed by a throw. |
| Direct pointer/animation methods could still mutate a disposed session. | Ignore those calls after disposal; regression verifies unchanged document data. |
| Native close re-enabled attempts after a fixed one-second timer, even if saving was still pending. Late completion could outlive its guard. | Await explicit success/failure, deduplicate pending attempts, retry failures and ignore unregistered guards. Tests use a window port, not a native build. |
| Concurrent picture deletes filtered a captured old library and could restore each other's entries; carousel state was updated separately. | Update records and selected index together from the latest state. Browser hook regression completes deletes out of order, then checks restore selection. |
| IndexedDB accepted invalid replacement records, then the load validator silently omitted them. Saved colors also allowed negative/fractional values. | Validate before a write, reject invalid colors/empty IDs/extreme positions, and preserve the last valid record on rejection. Unit and IndexedDB browser regressions cover it. |
| Worker transport had no message-decode error handler; a late failure from an old worker could terminate a replacement. | Reject waiters on either error event and scope failure handling to the originating worker. Test covers rejection, restart and a late old-worker event. |
| Failed download activation retained its temporary anchor/blob URL. | Shared browser download helper cleans up in `finally`; successful downloads retain the existing delayed URL release. Browser fault injection verifies failure cleanup. |
| Popup creation and delayed browser `print()` failures could escape the UI error path. | Catch both paths and keep the retryable vector preview. Browser tests cover blocked/throwing popup and asynchronous print errors. |
| A display exception left the pending-frame marker set, preventing later redraws. | Clear scheduling in `finally` without creating an automatic error loop; fault-injected browser regression verifies the next invalidation works. |
| Failed PNG rendering could leave its temporary backing at full size until collection. | Release it on failure and always dispose restored artwork. Output regressions cover the failure path. |
| Small patterned brush blobs generated marks across their entire parent region during export. | Restrict mark generation to the blob/region bounds intersection, preserving global pattern phase and clipping. Existing image-comparison and vector-PDF checks still pass. |
| Startup separately fetched/decoded two illustration images even though SelectionScreen renders bundled inline SVGs. | Remove those unused preloads and task bookkeeping. The explicit two-second splash presentation remains unchanged. |
| Icon generation leaked its `mkdtemp` directory. | Guard its resolved temporary location and clean it in `finally`. Static/lint checks only; no art/icons were regenerated. |
| PowerShell npm argument forwarding swallowed the memory-profile flag and silently ran ordinary tests. | Dedicated `test:memory` / `test:scene` scripts carry fixed flags inside the command; custom profiles use direct Node invocation. |
| Spray-idle regression assumed two frames plus 80 ms were enough, but a legitimate queued zoom refinement could arrive later. | Require a bounded 200 ms interval without editor renders, so continuous animation still fails while completed refinements are allowed. |

## Findings kept for discussion

The prioritized open items, exact source locations, evidence and acceptance checks
are in [refinement tasks](REFINEMENT-TASKS.md). Highest value is a paged picture
library, mobile save/recovery policy, and rollback/recovery for brush/render faults.
Other items concern large-scene background sizing, atomic template/workshop actions,
export work budgets/cancellation, and measured overlap/decode costs. These are
concrete behavior or scaling questions, not reasons to split every class or change
frameworks.

## Validation and limits

Run `npm run check`, `npm run test:browser`, and the eight-cycle
`npm run test:memory`. Diagnostics remain in ignored
`work/review/` and `work/tests/`. Browser checks exercise real workers, paint/undo,
cache navigation, storage, vector SVG/PDF/print output, export layout/resolution,
async error recovery and library delete/restore. Native close tests mock only the
window boundary; actual Tauri dialogs/printing and physical devices still need the
manual checks listed in refinement tasks. No native build was requested or run.

Final checks passed: 60 unit tests, TypeScript, ESLint, the production web build,
full browser regressions and the explicit memory profile. In this repeat, all
8 closed cycles retained zero sessions/artwork; JS heap ranged 16.53-16.62 MiB,
backing storage stayed about 11.25 MiB, and only zero or four bytes of diagnostic
canvas backing remained. The eviction probe still shared five definitions across
six sticker instances without duplicates. These are instrumented browser-process
components, not total OS/GPU memory or tablet guarantees. Production npm advisory
scan reported zero known advisories at review time; native UI/printer checks and
full authoring regeneration were intentionally not run.
