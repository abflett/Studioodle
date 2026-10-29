# Studioodle icon inventory and direction studies

Open [the single-page inventory](index.html), or zoom the [full-size current icon sheet](current-icons.png).
The page contains **135 uses/states in 15 groups**, including all **61 Lucide glyphs**
currently imported by the main UI, custom SVG controls, palette/detail/brush/paper
pictograms, cursor artwork, the brand mark and illustrated entry-point actions.

Each icon is shown on light and dark review surfaces. Repeated meanings remain
in their respective areas, with source links. The review tiles are not proposals
for production button shapes. Individual stickers, sticker previews, scene/background
art, decorative paper-stack layers and ordinary form controls are excluded.
The painted coloring-book entry illustration remains because it is a main app action.

## Current source reference

- [Full current inventory](index.html)
- [Full-resolution PNG](current-icons.png)
- [Six current functional references](current-reference-six.png)
- [Inventory builder](build-inventory.mjs)

Run `node docs/icons/build-inventory.mjs` from the repository root to refresh the
static HTML. It renders current app components through Vite SSR and reads the UI's
Lucide imports, failing if an imported glyph is not represented. The page can also
be opened directly from disk; illustration paths refer to existing repository assets.
Main UI code and reviewer code are unchanged. Cursor paint accents use Classic blue
for comparison. Loading glyphs are shown at a static frame. Paper orientation marks
are exact snapshots of their current simple SVG shapes.

## New art directions

[Seven ImageGen boards across two rounds, with exact prompts](directions/README.md) explore the same
six controls: add to coloring pages, brush, fill, stickers, colors and undo.
Icon redesign is **deferred**. The app again uses its original icons and button
styling, including the original custom open-book plus/check and Lucide printer.
The inventory and current screenshots describe that restored state.

Keep these references for future inspiration; none is installed in the app:

- [Seven concept boards and prompts](directions/README.md).
- [Smooth Paper Charms printer study](paper-charms/printer-study/index.html).
- [Actual PNG-to-SVG book trace](enchanted-ink-trace/index.html).
- [Preserved SVG source sets](../../art/source/interface/icon-studies/README.md).

The user found the colorful drawings distracting and the hand-redrawn line icons
insufficiently faithful. Revisit the process and visual direction before any new
rollout. Bulk raster trials and draft integration remain parked under ignored work.

Verified: all 135 cards and 15 groups render, source images resolve, the atlas has no
horizontal overflow at desktop size, and every imported Lucide glyph is represented.
The source was reviewed against main-app icons, including flipped/selected variants.
