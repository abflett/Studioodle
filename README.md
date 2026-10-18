# Studioodle

**Your playful drawing and coloring studio.**

Studioodle is a free drawing and coloring app concept that combines the freedom of a simple paint program with the charm of coloring books and stickers. Build a picture, explore its little details, and color it your way.

Designed with children in mind and open to anyone who enjoys creating, Studioodle puts approachable controls and playful exploration at the heart of the experience.

> **Project status:** Early development. The editor supports hard-brush drawing, connected-area fill, erase-to-default, movable stickers and shapes, pan/zoom, undo, and local editable saves. Paint belongs to the canvas or object it lands on. All 71 stickers use smooth vector line art, raster paint, precomputed coloring regions and offline boundary masks. The child-friendly UX is still being refined.

## Start with a page. Make it yours.

Start a new picture with a simple choice:

- **Start blank:** Build your own picture from the sticker collection and your own drawing.
- **Choose a coloring page:** Begin with a ready-made picture, then color, rearrange, and add to it.

Every ready-made picture is intended to be an arrangement of the same reusable stickers available when starting blank. A forest coloring page can become a dinosaur adventure, a space garden, or something nobody has named yet.

## Smooth outlines, playful coloring

Stickers combine vector line art with editable raster paint. Draw across the page and
stickers, fill enclosed regions, erase back to the base, and move painted objects as
one piece. Vector outlines remain smooth while zooming, rotating and exporting.

Blank pages offer A4, A5, photo and square sizes with 150 DPI paint. Zoom starts fitted
to the window and cycles through simple relative steps. Definitions load per scene or
selected sticker; the full library is not required at startup.
## A small, inviting creative toolbox

The planned tools include:

- **Stickers:** Objects to place, arrange, and color individually.
- **Brushes:** Freehand drawing with different tip shapes.
- **Fill:** Paint-bucket coloring for enclosed areas.
- **Patterns:** Textured painting, such as plaid, wicker, dots, and stripes.
- **Undo:** An easy way to experiment and try again.

Sounds, animation, and visual effects are ideas for later exploration, adding personality without getting in the way of creating.

## Built around approachable controls

- Large color swatches and generously sized tool buttons.
- Clear feedback about the active tool, color, and focus.
- Mouse and touch treated as equally important inputs.
- Visible controls for essential actions, without relying on hidden gestures or hover.
- Protected outlines and enclosed-region coloring to reduce frustrating precision work.

## Platforms

Windows, macOS, Linux, Android, and iOS.

The goal is a consistent creative experience across desktop and mobile. Platform support is planned; builds are not available yet.

## Development

Studioodle is web-first, built with **React, Phaser 4, TypeScript, and Vite**. Native packaging will be evaluated later. The detailed UX and artwork approach are still being explored.

Use Node.js 22.12 or newer on the Node 22 release line, or a newer supported LTS release. Exact dependency versions are pinned in `package.json` and `package-lock.json`.

React, Phaser, and Vite were initialized from their latest stable npm releases. TypeScript is pinned to the latest 6.0 release supported by the current TypeScript ESLint tooling; TypeScript 7 is not yet supported by that tooling.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. After loading, choose a blank picture, coloring page, or previous picture. New pictures open the artwork editor; saved pictures reopen from Your pictures. Save stores editable documents in this browser. Shapes and stickers carry their paint when moved; erase restores their original appearance. The interface follows your system's light/dark theme.

The branded splash stays visible for at least two seconds and continues automatically once loading is complete. Picture selection uses large images and short labels: Blank page and Coloring page open overlay wizards, with a previous-picture carousel underneath. Blank setup steps through print size, orientation and background color. Coloring choices use six reusable sticker scenes; Your pictures browses actual local saves. Editor controls use icons, with accessible labels for screen readers. The viewport-sized interface uses sunny beach-inspired gradients in light mode and moonlit forest colors in dark mode.

```sh
npm run check      # TypeScript, ESLint, and production build
npm run build      # Static website in dist/
npm run preview    # Preview the production build locally
```

The contents of `dist/` can be served by a static website host. Asset URLs are relative to support hosting under a subdirectory.

### Source layout

```text
src/
  app/             Startup preparation and selection choices
  assets/          Selection illustrations and generated hybrid sticker definitions
  editor/          Framework-independent editor contracts and future document logic
  game/            Phaser lifecycle, scenes, and rendering
  ui/              React controls and styles
  PhaserGame.tsx   React mount/unmount adapter for Phaser
  main.tsx         Web entry point
vite/              Shared, development, and production build configuration
```

React owns interface controls; Canvas2D composites vector artwork and raster paint, while Phaser supplies pointer input and selection graphics. Commands cross a typed bridge rather than exposing scene objects to UI components. Future document state, undo history, and storage adapters should remain independent of Phaser objects. The editor does not enable physics. A Tauri 2 wrapper supplies the Windows desktop build, native window controls, PNG save dialogs and printing.

The current document format is version 3. Earlier development saves are intentionally unsupported; all runtime stickers now use the same hybrid engine.

See the [hybrid engine](docs/HYBRID-ENGINE.md) and [startup and navigation notes](docs/STARTUP.md) for loading stages, state ownership, and the approach to future asset packs.

See the [asset catalog](art/CATALOG.md) for searchable artwork, scene kits and AI-assisted page-authoring guidance. The Safari Watering Hole page combines eight existing animals with reusable scenery.

See the [sticker conversion checklist](docs/STICKER-CONVERSIONS.md) for per-asset progress
on the vector/raster hybrid migration and instructions for resuming unfinished conversions.

## What's in the name?

**Studio + doodle = Studioodle.**

Say it *stoo-dee-oh-oo-dle* — or stretch it into a little yodel if the mood takes you.

## License

Studioodle is licensed under the [Apache License 2.0](LICENSE).


## Windows Desktop

Run `npm run desktop:dev` for the Tauri app or `npm run desktop:build` for a Windows x64 installer. See [desktop build and tester notes](docs/DESKTOP.md) for prerequisites, output paths, local data and distribution details.
