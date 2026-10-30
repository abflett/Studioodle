# Development tools

- `cell-brush/`: isolated 100 × 100 cell-based painting experiment. Run `npm run
  cells`; see [model and limitations](cell-brush/README.md). No main-app or reviewer
  imports, persisted artwork, workers or new engine integration.
- `artwork-review/`: standalone reviewer source, HTML entry, config and consumed
  revision data. Run `npm run review`; see [controls/workflow](../docs/ARTWORK-REVIEW.md).
- `bin/`: ignored local third-party executables. The sticker converter looks for
  `bin/potrace/potrace-1.16.win64/potrace.exe` by default, or uses `POTRACE_PATH`.
  Keep the distributed license with a local installation. ImageMagick is expected
  on PATH. These are authoring requirements, not app runtime dependencies.

Generated screenshots, conversions, previews and tool builds go under `work/`.
Keep executables and sole authoring inputs outside that disposable directory.
