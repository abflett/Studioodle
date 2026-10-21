# Studioodle

A free, offline drawing and coloring studio. Start with blank paper or a coloring
page, arrange stickers, then paint with vector brushes and fills. Pictures and
preferences stay on the device; no account or server is required. Export PNG, SVG
or PDF, or print directly from vectors.

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

| Command | Purpose |
| --- | --- |
| `npm run check` | Unit tests, TypeScript, ESLint and production web build |
| `npm run test:browser` | Real browser/worker painting and hit-coverage regressions |
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
| `src/editor/` | Documents, editing sessions, vector painting and SVG loading |
| `src/canvas/` | Browser pointer adapter and viewport renderer |
| `src/ui/` | React screens, controls, gestures and styles |
| `src/platform/` | Browser storage/output and Tauri integration |
| `src/assets/` | Shipped sticker SVGs, interface assets and the canonical coloring book |
| `art/source/stickers/` | Original sticker artwork and generation metadata, grouped by pack |
| `art/source/interface/` | Original interface paintings and prompts |
| `art/stickers.json` | Authoring manifest: source paths, crops, dimensions and picker metadata |
| `scripts/` | Current authoring and verification tools |
| `tests/` | Unit tests, fixtures and browser regressions |
| `docs/` | Current architecture and workflows |
| `src-tauri/` | Native desktop host and platform configuration |
| `work/` | Ignored conversion intermediates, catalogs, previews and test output |

Original images are retained even when an editable SVG supersedes them. Generated
catalogs, diagnostics and trials do not belong in source folders. Git history holds
retired experiments; the current tree contains the supported implementation.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) and [vector painting](docs/VECTOR-PAINT.md)
- [Artwork sources](art/README.md), [sticker pipeline](docs/STICKER-PIPELINE.md),
  [scene authoring](docs/SCENE-AUTHORING.md) and [review notes](art/REVIEW.md)
- [Picture output](docs/PICTURE-OUTPUT.md) and [remaining validation](docs/REFINEMENT-TASKS.md)
- [Coloring books and workshop](docs/COLORING-BOOKS.md)
- [Startup](docs/STARTUP.md), [paper setup](docs/PAPER-SETUP.md) and [sticker categories](docs/STICKER-CATEGORIES.md)
- [Input](docs/INPUT.md), [cursors](docs/CURSORS.md), [ribbons](docs/RIBBONS.md) and [desktop](docs/DESKTOP.md)

## License

[Apache License 2.0](LICENSE).

See [the architecture review](docs/ARCHITECTURE-REVIEW.md) for completed dependency and optimization decisions; remaining device/platform checks are tracked separately.
