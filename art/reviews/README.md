# Active review inputs

Save new reviewer JSON exports here when requesting a repair pass. Keep the
submitted file unchanged while its coordinates/checksums are being processed.
Apply explicit lines first, rebuild regions, then evaluate add/remove markers.

Once a pass is verified and committed, retain only needed revision transitions in
`tools/artwork-review/data/repair-history.json`, rotate the two recent history sets,
and remove the completed export from the current tree. Git holds the full input.
Do not remove the revision graph: it reconciles existing browser annotations.

This directory currently has no unprocessed exports. See
[review controls](../../docs/ARTWORK-REVIEW.md) and
[repair workflow](../../docs/STICKER-PIPELINE.md#explicit-line-repair-pass).
