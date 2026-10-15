# Studioodle

**Your playful drawing and coloring studio.**

Studioodle is a free drawing and coloring app concept that combines the freedom of a simple paint program with the charm of coloring books and stickers. Build a picture, explore its little details, and color it your way.

Designed with children in mind and open to anyone who enjoys creating, Studioodle puts approachable controls and playful exploration at the heart of the experience.

> **Project status:** Early development. A web starter with a React interface and a Phaser tree/color preview is available. The drawing, stickers, focus, and saving features below describe the intended experience and are not implemented yet.

## Start with a page. Make it yours.

Start a new picture with a simple choice:

- **Start blank:** Build your own picture from the sticker collection and your own drawing.
- **Choose a coloring page:** Begin with a ready-made picture, then color, rearrange, and add to it.

Every ready-made picture is intended to be an arrangement of the same reusable stickers available when starting blank. A forest coloring page can become a dinosaur adventure, a space garden, or something nobody has named yet.

## Focus on the little things

Studioodle's central idea is three levels of creative focus:

| Focus | Creative space |
| --- | --- |
| **Picture** | Work across the whole picture and arrange stickers. |
| **Sticker** | Move closer to one object and color it while protecting its outlines and the surrounding picture. |
| **Part** | Focus further on a supported section, such as a tree's trunk, and color within that part. |

A visible focus tool brings the selected object closer while the surrounding picture recedes. Clear navigation takes you back out. Not every sticker needs separate parts; the interface should make those possibilities easy to understand.

The child chooses what to work on. The app handles the layers and boundaries underneath.

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
- Protected outlines and focused coloring to reduce frustrating precision work.

## Planned platforms

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

Open the local URL printed by Vite. The starter lets you change the preview tree's color and reset it; it is not yet a painting editor.

```sh
npm run check      # TypeScript, ESLint, and production build
npm run build      # Static website in dist/
npm run preview    # Preview the production build locally
```

The contents of `dist/` can be served by a static website host. Asset URLs are relative to support hosting under a subdirectory.

### Source layout

```text
src/
  editor/          Framework-independent editor contracts and future document logic
  game/            Phaser lifecycle, scenes, and rendering
  ui/              React controls and styles
  PhaserGame.tsx   React mount/unmount adapter for Phaser
  main.tsx         Web entry point
vite/              Shared, development, and production build configuration
```

React owns interface controls; Phaser owns the drawing surface. Commands cross a typed bridge rather than exposing scene objects to UI components. Future document state, undo history, and storage adapters should remain independent of Phaser objects. The starter does not enable physics or include a native wrapper.

The intended first technical milestone is a small prototype of the core interaction: place a sticker, focus on it, focus on one part, paint within its boundaries, and return to the whole picture.

## What's in the name?

**Studio + doodle = Studioodle.**

Say it *stoo-dee-oh-oo-dle* — or stretch it into a little yodel if the mood takes you.

## License

Studioodle is licensed under the [Apache License 2.0](LICENSE).
