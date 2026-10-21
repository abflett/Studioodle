# Architecture and maintenance

Studioodle separates editing behavior from framework integration while keeping
concrete Canvas2D rendering. There is no service container, generic event bus,
base repository, or interface for every class.

## Boundaries

- **`EditorSession`** owns active tools, selection/focus, gesture transactions,
  undo history and command execution. It receives primitive points/pointer IDs,
  a save function and a change callback. It never imports React, storage
  adapters or Tauri. Undo remains capped at 50 snapshots; a gesture records one
  snapshot, and cancellation restores both artwork and history.
- **`Artwork`** owns surface transforms, paint ownership, hit testing, fills,
  ordering and serialization. It uses browser Canvas2D and prepared vector
  definitions. It is rendering-aware, not a server-safe pure domain model.
- **`canvas/CanvasEditor`** translates DOM pointer events to session calls and
  publishes session state. **`CanvasViewport`** renders artwork and selection into
  one display canvas, allocating only the visible workspace at device resolution.
  **`ui/EditorCanvas`** binds the repository and React lifecycle. Display changes
  coalesce into one animation frame; only an active spray needs continuous frames.
  Resize, view movement, scrolling and visibility changes invalidate the display.
- **`bridge.ts`** is the typed UI command/event boundary. Notifications are
  deduplicated by value so paint redraws do not repeatedly update React with
  unchanged tool, focus or selection state. Command delivery stays synchronous.
- **`svgDefinition.ts` / `rasterizeRegions.ts`** decode the shared SVG sticker format
  and generate immutable region-ID lookup arrays once per loaded definition. There is one SVG decoder and one vector paint engine.
- **`savedPicture.ts`** defines the saved model and the three-method repository
  contract. **`pictureValidation.ts`** validates untrusted records using lightweight
  catalog metadata; it does not load sticker definitions.
- **`localPictureRepository.ts`** implements that contract. **`app/pictures.ts`**
  composes the ordinary-picture and custom-template libraries with their current
  namespaces. Storage access is resolved at call time; UI callers handle errors.
- **`app/pictureOutput.ts`** coordinates rendering, names and PNG resolution.
  **`platform/pictureOutput.ts`** handles browser/native download and print behavior.
  The browser print window must open synchronously from the click handler.

The practical dependency direction is UI/composition -> session/contracts ->
artwork/document logic. Platform implementations depend on contracts. The canvas
adapter receives its save dependency rather than constructing storage itself.

## State ownership

React owns navigation, settings, dialogs, page pan/zoom and temporary bucket zoom.
The session owns editable picture state. The bridge carries commands, not renderer
objects. `useLatest` exposes committed callbacks to long-lived DOM listeners;
do not mutate callback refs during render. Modal and pointer listener cleanup must
remain symmetric, including React development effect replay.

Current picture keys are `studioodle.v5.picture.<id>`; custom templates use `studioodle.v5.coloring.<id>`. Documents use vector-only format 5. This pre-release app intentionally drops old drawing formats rather than retaining migrations or redundant engines. See `AGENTS.md` for the breaking-change policy.

`VectorPaint` owns backing styles and polygon blobs for both paper and stickers. Its worker merges coverage without changing undo snapshots. `paintWorker.ts` owns job transport; the worker and non-worker fallback share one job implementation. Paint regions are indexed by ID, and maintenance sends only dirty regions. Plain base fills need no merge job. Rendering clips to exact SVG curves; adaptive curve flattening supplies boolean/fill geometry. All brush styles and fill patterns stay vector. There are no instance paint arrays or canvases. Shared lookup arrays support only hit testing. See [Vector Painting](VECTOR-PAINT.md).

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
in-memory artwork double; they do not test Canvas2D rendering. The browser regression exercises the real vector paint engine and its worker.
`npm run check` also runs TypeScript, ESLint and the production web build.
Browser regressions live in `tests/browser/` and run with `npm run test:browser`.
Lint excludes generated output and prevents editor/canvas
modules from importing application composition or platform adapters.

For UI/engine changes, also manually review drawing, fills, focus, transforms,
undo, gesture cancellation, save/reopen, print/export, and desktop close/reopen as
applicable. Automated checks do not establish visual correctness or native-dialog
behavior. Build the desktop installer only when requested to test changes in the installed app.

## Coloring book authoring

`editor/coloringBook.ts` defines versioned portable books, geometry-only page normalization, and stable-ID merging. `platform/localColoringBook.ts` stores workshop revisions in one atomic local-storage record, separate from saved pictures and custom templates. `app/coloringBookWorkshop.ts` composes bundled, custom and revised pages. The canonical shipped collection is `src/assets/coloringBook.json`; workshop JSON can replace it through `npm run books:install -- file.json` after review.

The optional workshop UI requests an immutable document snapshot from the editor session rather than reading saved-picture storage or reaching into the canvas adapter. Normal saves keep their existing behavior. Browser and native JSON exports are adapted in `platform/coloringBookOutput.ts`. See [the workflow and schema](COLORING-BOOKS.md).

## Shared overlay headers

All React overlays use `ui/DialogHeader.tsx` for title and close/back controls. Its styles keep the heading block and controls vertically centered, with labelled 44px targets, decorative SVG semantics, hover feedback, and visible keyboard focus. Native dialogs continue to own focus containment and restoration; destructive confirmations keep initial focus on the safe action. Keep future header changes in this component and its shared CSS rather than introducing per-overlay sizes.

## Resource lifetime

Undo/cancellation disposes superseded artwork; deletion disposes the removed
surface. Closing an editor disconnects commands, observers and pointer listeners,
cancels display/paint timers, and ignores late asynchronous fill results. Worker
transport is shared for the application lifetime rather than restarted per stroke.

The definition reuse cache holds at most 24 entries and 64 MiB of typed lookup
data. Eviction does not invalidate live artwork. Source SVG text is retained for
synchronous decoding after eviction; total text is bounded by the shipped catalog.
The limit covers cached lookups, not live documents, Path2D objects, geometry or undo.

State subscriptions replay the latest published state, so mounting React listeners
after the browser adapter cannot miss the initial selection/tool/focus state.
See [the architecture review](ARCHITECTURE-REVIEW.md) for measurements and remaining work.
