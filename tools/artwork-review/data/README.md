# Reviewer revision data

`repair-history.json` contains the consumed fields from the initial region pass
and chronological line/marker passes through v5. It is live reviewer data, not a
diagnostic archive: hashes link revisions, applied IDs retire completed proposals,
and region counts support repair summaries. `artworkLineTasks.ts` derives latest
metadata and the two recent history sets from it.

For another pass, append its exact before/after SVG hashes, region counts, line
count and applied closure/marker IDs. Include it in chronological reconciliation
and rotate History 1/2. Keep earlier transitions needed by saved annotations.
Never use region IDs alone across rebuilt revisions. Unrelated later annotations,
notes and review progress must survive refresh.

The complete original exports and verbose ledgers can be recovered from Git at
`bc5be0d` (before repository cleanup). `8c306c2` is the completed v5 repair commit.
Tests retain focused exported examples under `tests/fixtures/artwork-review/`.
