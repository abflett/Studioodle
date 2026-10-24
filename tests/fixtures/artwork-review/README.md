# Artwork review regressions

`reviews.json` retains annotated entries and the assets required by history and
storage regressions from the initial through v5 exports. Unrelated reviewed-only
entries were removed. These are test inputs, not a pending user repair queue.

The unit/browser tests cover revision chains, applied instruction retirement,
future marker/line preservation, import/export, cleanup/undo and history filters.
Production reviewer reconciliation reads its own compact `data/repair-history.json`;
fixtures preserve the earlier submitted coordinates/hashes needed to challenge it.
Full unchanged inputs remain in Git before cleanup (`bc5be0d`).
