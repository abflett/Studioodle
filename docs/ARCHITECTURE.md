# Architecture and maintenance

Studioodle separates editing behavior from framework integration while keeping
concrete Canvas2D rendering. There is no service container, generic event bus,
base repository, or interface for every class.

## Boundaries

- **`EditorSession`** owns active tools, selection/focus, gesture transactions,
  undo history and command execution. It receives primitive points/pointer IDs,
  a save function and a change callback. It never imports Phaser, React, storage
  adapters or Tauri. Undo remains capped at 50 snapshots; a gesture records one
  snapshot, and cancellation restores both artwork and history.
- **`Artwork`** owns surface transforms, paint ownership, hit testing, fills,
  ordering and serialization. It uses browser Canvas2D and prepared vector
  definitions. It is rendering-aware, not a server-safe pure domain model.
- **`StudioScene`** translates Phaser pointers to session calls, draws the
  selection rectangle, publishes session state, and owns rendering cleanup.
  **`PhaserGame`** binds the application repository at the React/engine boundary.
- **`bridge.ts`** is the typed UI command/event boundary. Notifications are
  deduplicated by value so paint redraws do not repeatedly update React with
  unchanged tool, focus or selection state. Command delivery stays synchronous.
- **`svgDefinition.ts` / `rasterizeRegions.ts`** decode the shared SVG sticker format
  and generate immutable region-ID lookup arrays once per loaded definition. The
  legacy JSON decoder lives only in `experiments/` for reproducible comparisons.
- **`savedPicture.ts`** defines the saved model and the three-method repository
  contract. **`pictureValidation.ts`** validates untrusted records using lightweight
  catalog metadata; it does not load sticker definitions.
- **`localPictureRepository.ts`** implements that contract. **`app/pictures.ts`**
  composes the ordinary-picture and custom-template libraries with their existing
  namespaces. Storage access is resolved at call time; UI callers handle errors.
- **`app/pictureOutput.ts`** coordinates rendering, names and PNG resolution.
  **`platform/pictureOutput.ts`** handles browser/native download and print behavior.
  The browser print window must open synchronously from the click handler.

The practical dependency direction is UI/composition -> session/contracts ->
artwork/document logic. Platform implementations depend on contracts. The Phaser
adapter receives its save dependency rather than constructing storage itself.

## State ownership

React owns navigation, settings, dialogs, page pan/zoom and temporary bucket zoom.
The session owns editable picture state. The bridge carries commands, not Phaser
objects. `useLatest` exposes committed callbacks to long-lived DOM listeners;
do not mutate callback refs during render. Modal and pointer listener cleanup must
remain symmetric, including React development effect replay.

Version-3 picture keys are `studioodle.v3.picture.<id>`; custom templates use
`studioodle.v3.coloring.<id>`. Keep these and the desktop app identity stable.
Changing paint density, asset logical dimensions, document fields or mask semantics
requires explicitly considering existing saved paint. Never silently regenerate or
rewrite users' documents during catalog cleanup.

Sticker paint defaults to the original 150 DPI local raster. Enlarged stickers lazily
increase its density in 2x/4x steps, capped at 8 million pixels for an upgraded surface.
Unpainted placement stays cheap; existing paint upgrades on rendering, and brush/fill
ensure density before editing. Density never shrinks. The optional surface `paintScale`
field records that multiplier; old saves omit it and retain their original pixel indexing.
`paintRaster.ts` reconstructs uniform region colors and transfers mixed brushwork with
region-aware nearest-neighbor sampling. The immutable SVG lookup remains shared; it
is not rebuilt for each transform. Rendering pads colored edges under the ink and exact
SVG clip, without adding those padding pixels to saved paint or hit regions. This avoids
white interpolation fringes without expanding the sticker silhouette.

## Adding features

- Add editing actions to `EditorCommand`, implement their behavior in the session
  or `Artwork`, then expose UI controls. Use the session transaction helper for
  one-shot edits and the existing gesture transaction for multi-sample strokes.
- Add persistence backends by implementing `PictureRepository` and changing the
  application composition. Keep transport/authentication out of `Artwork`.
- Add native features in `src/platform/` and `src-tauri/`, with only the capabilities
  needed. Keep desktop APIs out of the editor session.
- Add artwork through `art/stickers.json` and the offline builder. Use the catalog
  and scene-authoring guide rather than editing generated definition files.
- Split components when a coherent responsibility emerges; avoid generic hooks or
  services that merely rename one line of application code.

## Verification

`npm test` uses Node's test runner and Vite's source loader; it needs no new test
framework. It checks persistence isolation/corruption handling, document validation,
coloring-page copies, output naming, bridge notification/lifecycle behavior, and
session save, undo, focus and gesture-cancellation rules. Session tests use a small
in-memory artwork double; they do not test raster painting or Canvas2D rendering.
`npm run check` also runs TypeScript, ESLint and the production web build.
Lint excludes generated output and local experiments, and prevents editor/Phaser
modules from importing application composition or platform adapters.

For UI/engine changes, also manually review drawing, fills, focus, transforms,
undo, gesture cancellation, save/reopen, print/export, and desktop close/reopen as
applicable. Automated checks do not establish visual correctness or native-dialog
behavior. Rebuild the desktop installer to test changed sources in the installed app.

## Coloring book authoring

`editor/coloringBook.ts` defines versioned portable books, geometry-only page normalization, and stable-ID merging. `platform/localColoringBook.ts` stores workshop revisions in one atomic local-storage record, separate from saved pictures and custom templates. `app/coloringBookWorkshop.ts` composes bundled, custom and revised pages. The canonical shipped collection is `src/assets/coloringBook.json`; workshop JSON can replace it through `npm run books:install -- file.json` after review.

The optional workshop UI requests an immutable document snapshot from the editor session rather than reading saved-picture storage or reaching into Phaser. Normal saves keep their existing behavior. Browser and native JSON exports are adapted in `platform/coloringBookOutput.ts`. See [the workflow and schema](COLORING-BOOKS.md).

## Shared overlay headers

All React overlays use `ui/DialogHeader.tsx` for title and close/back controls. Its styles keep the heading block and controls vertically centered, with labelled 44px targets, decorative SVG semantics, hover feedback, and visible keyboard focus. Native dialogs continue to own focus containment and restoration; destructive confirmations keep initial focus on the safe action. Keep future header changes in this component and its shared CSS rather than introducing per-overlay sizes.
