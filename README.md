# Studioodle

A drawing and coloring studio for children and anyone who enjoys making pictures.
Start with a blank page or a coloring scene, arrange stickers, and paint the result.
Pictures and preferences stay on the device; no account is required.

## Features

- A4, A5, photo and square paper, with portrait and landscape orientations.
- Smooth vector sticker outlines with editable raster paint at 150 DPI.
- Brush, bucket, eraser, pan/zoom, undo, and sticker transforms and layer ordering.
- Hold the bucket for half a second to zoom for precision; release to fill and return.
- Sticker focus for painting details without surrounding artwork in the way.
- Saved pictures, custom coloring templates, PNG export, and printing.
- Optional offline coloring-page workshop with JSON book import/export and local revisions.
- Mouse, touch, keyboard shortcuts, light/dark themes, and optional painting controls.
- Windows desktop preview with native dialogs and remembered window/mouse preferences.

The web app runs in modern browsers. Windows x64 packaging uses Tauri 2; other native
platforms are not configured. Desktop builds are currently unsigned tester previews.
Browser and desktop libraries are separate local profiles.

See [Coloring Books and the Page Workshop](docs/COLORING-BOOKS.md) for editing, sharing, and installing a reviewed collection.

## Development

Use a Node version supported by `package.json` (Node 20.19+ or 22.12+), then:

```sh
npm ci
npm run dev
```

Vite prints the local URL. The splash prepares the editor and home illustrations;
artwork definitions load on demand. `Home` saves before leaving the editor, and the
editor autosaves every minute. Export important pictures for an external backup.

```sh
npm test            # Repository, bridge and document behavior regressions
npm run typecheck   # TypeScript
npm run lint        # Hand-maintained app and authoring code
npm run build       # Static web application in dist/
npm run preview     # Serve dist/ locally
npm run check       # Tests, TypeScript, lint and production web build
npm run brand:icons  # Rebuild favicon, touch and desktop icons (ImageMagick)
npm run assets:build # Rebuild sticker SVGs (ImageMagick + Potrace)
npm run benchmark:stickers # Compare the library to the pinned pre-migration baseline
npm run desktop:dev
npm run desktop:build  # Windows NSIS installer
```

`dist/` can be served by a static host, including under a subdirectory. Windows
builds require Rust, C++ build tools and WebView2; see [desktop setup](docs/DESKTOP.md).
Generated release packages live in ignored `release/` and `src-tauri/target/` paths.
A source change does not update an already installed desktop build.

Brand geometry lives in `src/ui/Brand.tsx`, with light/dark brand colors in
`src/ui/styles.css`. Run `npm run brand:icons` after changing either to keep the
SVG favicon and raster app icons aligned. This regenerates assets without building Tauri.

## Code and artwork

| Directory | Responsibility |
| --- | --- |
| `src/app/` | Startup, built-in pages, repository composition and output workflows |
| `src/editor/` | Documents, editing sessions, undo, paint and vector rendering |
| `src/game/` | Phaser input adaptation, viewport rendering and selection graphics |
| `src/ui/` | React screens, controls, gestures, cursors and styles |
| `src/platform/` | Local storage, browser output and Tauri integration |
| `src/assets/` | Interface artwork and generated sticker definitions |
| `art/` | Source artwork, manifest, catalog and scene-authoring guidance |
| `scripts/` | Offline conversion, catalog generation and scene previews |
| `src-tauri/` | Rust desktop host, capabilities and Windows packaging |

Editing rules do not import React, Phaser, local storage or Tauri. The rendering
engine intentionally uses Canvas2D rather than abstracting every graphics API.
See [architecture](docs/ARCHITECTURE.md) for boundaries and extension points.
Version-3 documents and existing storage namespaces are preserved. Earlier
experimental save formats are unsupported.

## Documentation

- [Architecture and maintenance](docs/ARCHITECTURE.md)
- [Artwork catalog](art/CATALOG.md) and [scene authoring](art/SCENE-AUTHORING.md)
- [SVG library migration results](docs/experiments/SVG-MIGRATION.md)
- [Garden house SVG region experiment](docs/experiments/GARDEN-HOUSE.md)
- [How stickers work: source to screen](docs/STICKER-PIPELINE.md)
- [Hybrid artwork engine and conversion](docs/HYBRID-ENGINE.md)
- [Startup and navigation](docs/STARTUP.md)
- [Paper and custom coloring pages](docs/PAPER-SETUP.md)
- [Input and shortcuts](docs/INPUT.md), [cursors](docs/CURSORS.md), [ribbons](docs/RIBBONS.md)
- [Sticker categories](docs/STICKER-CATEGORIES.md)
- [Windows desktop build and distribution](docs/DESKTOP.md)

## License

Studioodle is licensed under the [Apache License 2.0](LICENSE).
