# Startup, artwork, and persistence

## Startup and navigation

React displays the Studioodle wordmark and inline sketchbook/pencil icon while `prepareStudio` decodes selection illustrations and imports the editor. Progress reports completed tasks. The splash lasts at least two seconds, concurrently with loading. Failed loading offers retry; abandoned startup effects cannot update state.

Blank page and Coloring page open modal setup wizards. Blank setup selects paper shape and background; coloring setup offers starter scenes. Your pictures browses actual saved documents. Clicking outside a dialog or its close button dismisses it. The system/light/dark selector saves its preference locally, independently of paper color. Nunito and Lucide are bundled with the app.

A new picture receives a GUID before Phaser mounts. Returning to selection destroys the game and immediately disconnects its command listeners. Saving a reopened document updates the same GUID.

## Artwork model

`Artwork` owns an ordered stack of surfaces. The canvas is the fixed bottom surface. Each sticker or shape has a stable object ID, position, immutable base artwork, protected outline mask, and an editable paint buffer in local coordinates. The buffer stores added solid colors; empty pixels reveal the base artwork.

All shapes and nature stickers use the selected outline color and white interiors, including tree trunks and flower stems. The Stickers wizard starts with Shapes and Nature categories, then shows items with a Back control. There is no separate Shapes ribbon button. New categories can be registered in stickerCatalog.ts. Saved objects use these same default bases while retaining added paint. The canvas base is the paper color chosen at creation.

An ownership map assigns every document pixel to its topmost visible surface. It is rebuilt when an object is added or moved. Drawing and erasing route each brush pixel to that surface only. A stroke crossing the canvas and a sticker is therefore split between their buffers. Covered surfaces receive no hidden duplicate paint. Moving a sticker carries its paint and leaves the canvas's existing paint where it was.

The default brush is a hard 10-pixel round brush. Erase is a hard 40-pixel brush that removes added paint and reveals the original surface, including its default fill. Neither changes protected outlines. Paint cannot make the underlying sticker silhouette disappear.

Bucket fills a connected region of matching color on the clicked surface, limited to its currently visible, editable pixels. It respects freehand boundaries and outlines. Fill resolves into actual paint pixels once; moving another object never reruns the fill or changes its result. No-op fills and erasing untouched defaults do not consume undo steps.

Undo stores up to 50 document snapshots, with one entry per brush/eraser gesture, fill, move, or insertion. Inspect currently highlights a selected sticker; part focus, rotation, resize, patterns, and additional brushes are deferred.

## View and input

Landscape paper is 1000 × 700 document pixels, portrait 700 × 1000, and square 800 × 800. Pan freely translates the paper while leaving a small portion reachable. Zoom cycles through 50%, 75%, 100%, 150%, and 200%. View changes never modify saved artwork geometry. The ribbon wraps on narrow screens.

Both mouse buttons activate tools and controls. Pan supports pointer capture for mouse/touch dragging. Browser context menus, native dragging, and text selection are suppressed within the app. Traditional scrollbar navigation is disabled.

## Saved documents

Version 2 saves the surface stack and run-length encoded paint buffers, rather than a global replay of strokes and flood-fill seeds. Previews and the editor render the same surface model. Saves use one local-storage key per picture GUID; storage errors are reported. Saving is manual, Back discards unsaved edits, and clearing browser storage removes the library.

Version 1 documents are imported in memory by replaying their operations into the surface model and are written as version 2 only on Save. Their bases use the same white-interior defaults; imported paint operations are retained. Old global erasures adopt the new reset-to-default semantics; there was no reliable per-object paint ownership in the old format to recover. Existing saved keys are not deleted or automatically overwritten during migration.

## Responsibilities

React owns navigation, dialogs, and view placement. `Artwork` owns document editing, surface masks, selection, rendering, and serialization. Phaser owns input delivery and the displayed canvas texture. The storage adapter persists documents independently of Phaser. Modules preload at startup; GPU resources initialize when entering the editor. Larger future sticker packs should load on demand rather than all at startup.


## Binary sticker assets

All sticker coverage and outline pixels are binary. Procedural paths are rasterized once and thresholded at 50% coverage; the resulting base contains only fully opaque outline color, fully opaque white, or transparency. Outline masks are bit-packed. The texture uses nearest-neighbor filtering and canvas previews use pixelated scaling, so zoom does not introduce blended edge colors.

Eight source-image stickers are available from the cottage garden BMP in Nature, Sky, Fruit, and Cottage categories. Their silhouettes and outlines are stored as separate 1-bit planes and use the same painting/selection/persistence model as procedural shapes. See `src/assets/stickers/README.md` for extraction provenance, source bounds, and the repeatable extraction command.

## Window-sized blank pages and cottage garden

New blank pages default to Fit screen. EditorPreview measures the actual drawing viewport after ribbon layout, before mounting Phaser, and persists those integer dimensions in setup.size and the artwork document. This is a one-time size choice: later window changes pan/recenter the view without stretching or resizing artwork. Explicit Wide, Tall and Square choices remain available. Saved pictures and previews use the saved dimensions.

The Cottage garden template uses a 1536 by 1024 document and reusable sticker instances. See art/GARDEN-PACK.md for asset sources, exact generation prompts, binary mask conversion and regeneration commands.

## Child playtest adjustments

The sticker picker defaults to charcoal outlines (#242428), with a Current color override at its footer. New stickers are placed near the visible viewport center and enter Select immediately. Clicking empty space, Done, or toggling Select off returns to Fill without filling on the dismissal click. Scene tool changes are reported through the bridge so React stays synchronized.

Home replaces Back and saves before navigation; failures leave the editor open. The manual ribbon Save button is removed. A cleanup-managed one-minute timer saves to the same document ID. Saving does not interrupt an active paint or drag gesture.

The selection screen provides bottom-centered Delete, Print and PNG export actions for the displayed saved picture. Delete offers Undo while the message remains present. Print and export render the saved document at native dimensions without editor selection graphics; printing opens a dedicated browser print window. No app tests or build were run for these changes.
