# Artwork repairs and effort guide

Current state after the full-library v5 inspection, 24 October 2026. Full inputs,
per-marker audit reports and chronological discussion remain in Git history
(before cleanup: `bc5be0d`; completed v5 repairs: `8c306c2`). They are no longer
active tasks. Original art and accepted editable ink remain in `art/source/`.

## Accepted passes

| Pass | Result |
| --- | --- |
| Initial region pass | 180 explicit transparent regions across 94 assets; no ink changes. |
| First authored line pass | 191 lines across 31 assets; regions 2,975 ? 3,111. |
| v2 | Four additional lines on Badger/Birch Woodland; removed obsolete analysis gap closure. |
| v3 | 13 lines across three assets, then 56 cutouts and four satisfied fill requests. |
| v4 | 13 lines across five assets, then four cutouts and five satisfied fills; seven changed assets. |
| v5 | 13 lines across six assets, then 13 transparency markers, eight fills and one alignment note; 17 changed assets. |

No v5 request remains deferred. Three v5 fills were enclosed by the supplied lines;
five reversed explicitly matched old cutout seeds (Spaceship two, Cave Bat one,
Office Chair two). Two Baker points needed subpixel adjustment into verified white
interiors of the same regions. Original exported coordinates remain in Git.
The Simple Tree alignment issue was a converter bug: rounded rectangles now use
exact elliptical arcs rather than quadratic corners. A 4x alpha comparison went
from 20,905 mismatched pixels to zero; regression coverage retains the original.

History 1 shows the 17 assets changed in v5; History 2 the seven changed in v4.
The reviewer's [compact revision graph](../tools/artwork-review/data/README.md)
retains exact hashes/applied IDs needed by existing annotations. It is independent
of drawing saves. The drawing database is now `studioodle-library-v8`; the reviewer
still uses `studioodle-artwork-review-v1` with no storage reset.

## Next repair pass

1. Save a new immutable export in `art/reviews/`. Identify the reviewed SVG revision.
2. Apply supplied closure geometry first, union it into accepted ink, and rebuild
   only targeted assets. Audit sources, geometry and staged outputs before promotion.
3. Remap marker coordinates against those rebuilt regions. Check add/fill points;
   lines may already satisfy them. Apply conservative cutouts or explicit matched
   cutout restoration, without inferred blanket closures.
4. Validate ink preservation, requested point states, unmarked interiors, region
   structure and original-source hashes. Inspect the relevant rendered results.
5. Append required transitions/applied IDs to reviewer data, rotate the two recent
   histories, and preserve all unrelated new annotations. Keep a focused regression
   when a converter/tool bug is found. Commit before removing completed input/output.

Commands and acceptance checks are in [the pipeline](STICKER-PIPELINE.md).
General [visual review candidates](../art/README.md#visual-review-candidates) need
inspection of current artwork; they do not imply unfinished v5 instructions.

## Relative AI effort

These grades describe attention, not measured token counts or billing. Per-task
telemetry is unavailable; elapsed converter time and image count are not token use.

| Operation | Grade | Practical approach |
| --- | --- | --- |
| Explicit isolated cutout / marker deduplication | Low | Batch known points with the planner and geometric validators. |
| Supplied A/B or curved closure | Low per line | Union exact user geometry; reuse rebuild/audit tooling. |
| Seed on an ink edge | Low | Verify a nearby white point in the same region; record the adjustment. |
| Restore an explicitly marked old cutout | Low after setup | Match enclosed components; remove only matching manifest seeds. |
| Build/fix reusable pipeline or converter logic | Medium fixed cost | Add a focused regression, then reuse across assets. |
| Guess a closure or resolve conflicting semantic intent | Medium?high | Discuss a bounded crop/trial before doing a batch. |
| Reconstruct dense anatomy, foliage or whole artwork | High | Compare repair value with replacement; avoid speculative mass edits. |

Explicit user linework greatly reduces interpretation work. v5 reused the scripts
for all 35 instructions; component restoration and exact rounded-rectangle support
were the main fixed investments. Keep future diagnostics in disposable `work/`,
not as another source/history tree.
