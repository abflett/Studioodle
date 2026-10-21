# Repository Working Agreement

## Development and platform builds

Use the Vite dev server for routine development and testing. Build Windows/Tauri or any other native platform only when the user explicitly requests that platform build. Do not automatically build native apps or installers after features, fixes, asset changes, or commits. Native builds will be requested occasionally as needed; routine web checks do not require them.

## Commit and push cadence

The user authorizes routine commits and pushes of completed work to the current branch's configured upstream. After a meaningful, coherent batch of changes is complete and appropriate checks pass, commit and push without asking again. Examples include a finished feature or fix, a pipeline migration, or a completed asset pack. Avoid a commit for every tiny intermediate edit; keep commits reviewable and describe the final behavior.

Before committing, review the diff and staged files, keep credentials and local/build artifacts out of Git, and preserve unrelated work. Run checks appropriate to the changes. Never force-push, rewrite published history, or discard work to satisfy this cadence. If checks fail or pushing is blocked, report that clearly rather than claiming completion.

## Pre-release architecture and compatibility

This app is evolving before version 1 and has no public release. Breaking changes are expected and authorized. Prefer the simpler current architecture over compatibility layers, migrations, redundant engines, or preservation of old development saves. Old raster drawings can be discarded; do not retain a raster painting engine to read them. Use a fresh development save namespace when the format changes. Keep valid source assets and current coloring-page layouts, but update their schemas directly as needed. Tune and inspect the small-region ink cleanup before bulk sticker reprocessing; do not blanket-regenerate assets while that step is still under review.

## Repository hygiene

Keep original sticker art and generation metadata under `art/source/stickers/<pack>/` and original interface paintings under `art/source/interface/`. Accepted editable SVG sources may sit beside their untouched originals. Do not commit generated catalogs, conversion intermediates, diagnostic images or trial output; write those under ignored `work/` folders. Promote useful regressions into `tests/` instead of retaining an experiments tree. The sole source of bundled page layouts is `src/assets/coloringBook.json`; tools must read it rather than maintain duplicate scene builders.
