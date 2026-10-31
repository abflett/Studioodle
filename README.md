# Studioodle

A free drawing and coloring studio. Start with blank paper or a coloring
page, arrange stickers, then paint with vector brushes and fills. Pictures and
preferences stay on the device; no account or server is required. Export PNG, SVG
or PDF, or print with vector line art and paint (soft spray stays raster).

Native builds bundle their assets for offline use. Browser offline reload/install
is not yet guaranteed.

The app is pre-release. Breaking changes are expected, and old development saves
are intentionally unsupported.

## Development

Use a Node version supported by `package.json`, then:

```sh
npm ci
npm run dev
```

Routine development uses Vite. Build Windows/Tauri only when explicitly requested;
see [desktop setup](docs/DESKTOP.md).

Android ARM64 tester builds and USB installation are documented in
[Android setup](docs/ANDROID.md). Run `npm run android:build` to create a signed
sideload APK using the local development key.

| Command | Purpose |
| --- | --- |
| `npm run review` | Run the standalone artwork reviewer (same origin preserves annotations) |
| `npm run cells` | Open the isolated view-sized cell-brush experiment on port 1434 |
| `npm run cells:bench` | Measure repeatable cell-model CPU workloads; excludes browser rendering/input latency |
| `npm run cells:typecheck` / `npm run cells:build` / `npm run test:cells` | Check/build/test the standalone cell-brush demo |
| `npm run review:typecheck` / `npm run test:review` | Check the isolated reviewer |
| `npm run review:build` | Build only the reviewer into `work/artwork-review-dist/` |
| `npm run check` | Unit tests, TypeScript, ESLint and production web build |
| `npm run test:browser` | Real browser/worker painting, storage and vector-output regressions |
| `npm run test:library` | Test IndexedDB custom pages, thumbnail caching and 1,000/5,000-picture metadata |
| `npm run test:save` | Repeated sticker edits verify background saves reuse unchanged paint |
| `npm run test:memory` | Eight editor lifecycles and a definition-cache pressure probe |
| `npm run test:scene` | Repeat the advanced scene profile at the default 64 MiB cache budget |
| `npm run build` / `npm run preview` | Build/serve the static web app |
| `npm run assets:catalog` | Refresh runtime metadata and generate `work/catalog/index.html` |
| `node scripts/build-stickers.mjs <asset-id>` | Convert one sticker from its source |
| `node scripts/build-stickers.mjs --pending` | Convert stickers without an existing runtime SVG |
| `npm run assets:preview -- <page-id>` | Render a bundled coloring page into `work/scenes/` |
| `npm run books:install -- <book.json>` | Validate and replace the bundled coloring book |
| `npm run brand:icons` | Regenerate favicon, touch and desktop icons |

`dist/` supports static hosting, including a subdirectory. Native desktop commands
remain available as `desktop:dev` and `desktop:build`; they are not part of checks.

## Project layout

| Directory | Contents |
| --- | --- |
| `src/app/` | Startup, page libraries, persistence composition and output workflows |
| `src/editor/` | Documents, sessions, scene/surface geometry, vector paint and isolated raster spray |
| `src/canvas/` | Browser pointer adapter and viewport renderer |
| `src/ui/` | React screens, controls, gestures and styles |
| `src/platform/` | Browser storage/output and Tauri integration |
| `src/assets/` | Shipped sticker SVGs, interface assets and the canonical coloring book |
| `art/source/stickers/` | Original sticker artwork and generation metadata, grouped by pack |
| `art/source/interface/` | Original interface paintings and prompts |
| `art/stickers.json` | Authoring manifest: source paths, crops, dimensions and picker metadata |
| `scripts/` | Current authoring and verification tools |
| `tests/` | Unit tests, fixtures and browser regressions |
| `docs/` | Current architecture, workflows, context and one refinement backlog |
| `tools/artwork-review/` | Standalone reviewer source and compact revision data |
| `tools/bin/` | Ignored local conversion executables |
| `art/reviews/` | Active user exports; completed inputs retire to Git history |
| `src-tauri/` | Native desktop host and platform configuration |
| `work/` | Ignored conversion intermediates, catalogs, previews and test output |

Original images are retained even when an editable SVG supersedes them. Generated
catalogs, diagnostics and trials do not belong in source folders. Git history holds
retired experiments; the current tree contains the supported implementation.

## Documentation

Start a new coding thread with [the working agreement](AGENTS.md) and
[current context](docs/CONTEXT.md). [Refinement tasks](docs/REFINEMENT-TASKS.md)
is the single implementation backlog; completed reviews are in Git history.

| Topic | Guide |
| --- | --- |
| System boundaries, storage, lifecycle | [Architecture](docs/ARCHITECTURE.md) |
| Painting, geometry, workers | [Vector paint](docs/VECTOR-PAINT.md), [undo](docs/UNDO-HISTORY.md) |
| Measurements and profile commands | [Performance](docs/PERFORMANCE.md), [picture library](docs/PICTURE-LIBRARY.md) |
| Overlay redesign direction (proposed) | [Overlay design brief](docs/OVERLAY-DESIGN.md) |
| Navigation, paper, gestures, ribbons, categories | [Interface](docs/INTERFACE.md), [cursors](docs/CURSORS.md) |
| Export/print and desktop host | [Picture output](docs/PICTURE-OUTPUT.md), [desktop](docs/DESKTOP.md) |
| Coloring books and composition | [Coloring books](docs/COLORING-BOOKS.md), [scene authoring](docs/SCENE-AUTHORING.md) |
| Original sources and conversion | [Artwork](art/README.md), [sticker pipeline](docs/STICKER-PIPELINE.md) |
| Inspector, accepted repairs, effort | [Artwork reviewer](docs/ARTWORK-REVIEW.md), [repair summary](docs/ARTWORK-REPAIR-LOG.md) |

`work/`, `dist/` and local `release/` packages are generated, ignored and disposable.
Keep required portable executables in `tools/bin/` or configure `POTRACE_PATH`.
Keep only current documentation and actionable inputs; recover completed diagnostics
and verbose reports from Git instead of adding an archive directory.

## License

[Apache License 2.0](LICENSE).
