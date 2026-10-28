# Interface and interaction

Current user-facing behavior; implementation boundaries are in [architecture](ARCHITECTURE.md).

## Startup and navigation

The splash loads the editor module, stays visible for at least two seconds and
proceeds when ready. Home illustrations load from bundled selection assets; they do not
require fetching or decoding the full sticker library. It does not download every sticker definition.

React owns home/setup, the ribbon and overlays. Blank setup selects a physical paper
preset, Tall/Wide orientation inferred from the window, then background color. The
page is independent of window size and starts fitted beneath the ribbon.

Coloring templates arrange reusable SVG stickers. Choosing a picture prepares its
lazy definition packs before entering the editor. Thumbnail definitions load as needed.
Sticker selection loads only the chosen definition before placing it. Failures retain
the selection view with a dismissible message rather than opening an incomplete scene.

Artwork owns surface paint, regions, placement, order, serialization and compositing.
Canvas2D renders vector ink and vector paint at display resolution. `EditorSession` handles editing commands, undo and gesture transactions; the browser canvas adapter handles
pointer input and draws the selection overlay. React positions the page and controls Fit-relative zoom.

Each completed artwork action queues a background save of the version-5 document;
there is no minute timer. Untouched blank paper and unchanged coloring pages are
not added to Your pictures. Reopened drawings are not rewritten until edited.
Tool/color choices, view changes and canceled gestures do not count as edits.
Undo queues the restored artwork. Home finishes input and returns immediately,
without waiting for storage; the queue and latest previews survive the canvas.
Failed writes preserve the previous committed drawing, retry with bounded backoff
and show a retry notice on Home or in the editor. Ctrl+S waits for its checkpoint;
normal desktop close also flushes pending writes. A browser/process shutdown may
lose the latest pending actions; no asynchronous unload guarantee is made.
Your pictures browses version-5 local saves and offers delete/undo-delete, PNG/SVG/PDF export and vector printing.
Old development save formats are intentionally unsupported. See [the sticker pipeline](STICKER-PIPELINE.md) for
the authoring format, region maps, loading/caches and cleanup decisions.
See [architecture](ARCHITECTURE.md) for repository, output and engine boundaries.

## Paper and templates

Blank-page setup now offers Full page (A4, 210 × 297 mm), Half page (A5, 148 × 210 mm), Photo (4 × 6 inches), and Square (6 × 6 inches). Non-square choices support Tall/Wide orientation. Full A4 is the default, with orientation chosen from the selection window aspect ratio (Wide for a landscape window, Tall for a portrait window). It follows window rotation/resizing until the user selects an orientation manually; opening a new blank-page wizard resets this automatic choice. Background-color selection follows as before.

Dimensions are converted to rounded integer scene units at 96 units per inch, stored in the existing explicit `size` field, and painted as resolution-independent vectors. PNG output defaults to 300 DPI, with 150/600 DPI choices; print, SVG and PDF retain vectors at the document size. The page is fitted to the available window, so choosing larger print dimensions does not change the fit-relative zoom baseline. Physical dimensions are accurate to scene-coordinate rounding. Version-5 saves store their explicit page dimensions. Older development save formats have been retired.

Newly added stickers preserve aspect ratio and vector paint detail, shrink if necessary to fit within 60% of both page dimensions, and start entirely on the page. Small assets are not enlarged. Placement uses the visible silhouette bounds; subsequent selection resizing/movement retains the existing controls. Existing scene placements and duplicates are not automatically fitted.

### Coloring pages and previews

Built-in coloring pages use full A4 landscape paper (1123 x 794 scene units), matching the full-page blank preset. The authored arrangement scales uniformly and centers on that paper; saved documents retain their original dimensions.

Saved-picture and coloring-page previews render vector ink directly at their displayed device-pixel dimensions. A thumbnail-only minimum stroke weight keeps thin outlines visible; exports and editable artwork retain their original line weights. Preview sizing is controlled by CSS rather than the changing raster backing dimensions.

The Landscapes sticker category includes meadow, seashore, snow and moon-crater horizons. These are finite, wide background stickers, not repeating tiles yet. New horizon stickers fit the full page width in either orientation; their deeper fill region extends below the page. The visible SVG contains only the horizon curves. Hidden closure paths are added solely for offline region generation, so bucket fills remain enclosed without drawing rectangular scenery borders. They can still be moved, scaled, colored, and reordered normally.

The Cottage garden template uses the reusable meadow horizon behind the fence and buildings to separate sky and grass fills. Its repeating fence has uniform 60-unit picket spacing, and its curved path and progressively sized stepping stones align with the cottage doorway.

Horizon stickers now use manifest placement metadata and insert immediately above the paper, behind existing artwork. The moon crater starts higher than meadow/shore/snow horizons to keep its main detail on the page. Portrait placement adjusts for the ground depth so it still reaches the page bottom.

### Custom coloring pages

The selection screen's save utility button copies the selected saved picture into the coloring-page picker. Templates keep paper size, sticker order, positions, scale, rotation and flips. All vector paint is removed, the canvas becomes white and sticker ink colors are preserved. Freehand marks are paint and are omitted. A picture needs at least one sticker to create a useful template.

Templates are stored locally under `studioodle.v5.coloring.` separately from `Your pictures`. Each use receives a new picture ID, so coloring a template never overwrites it or the source picture. The picker previews the new template immediately; custom entries can be deleted through the existing confirmation dialog. Built-in pages cannot be deleted. `coloringPage.ts` creates copies and storage adapters validate both libraries.

## Shortcuts and gestures

Space toggles adjusted mouse control at the saved speed. Escape releases it. Key repeat is ignored for the toggle. Editable fields, range inputs, and focused dialog controls retain normal keyboard behavior. Browser pointer-lock restrictions still apply, and failure leaves the normal cursor available.

Editor shortcuts pause while a dialog is open or a field is being edited. Ctrl below also means Cmd on macOS.

| Shortcut | Action |
| --- | --- |
| B / G / E | Brush / Fill / Eraser |
| V / H | Select / Pan |
| S / C | Stickers / Colors |
| Z | Cycle zoom levels |
| + or = / - | Zoom in / out at the viewport center |
| 0 | Fit the page, or refit the focused sticker |
| Ctrl+Z or Backspace | Undo |
| Ctrl+S | Save the current picture |
| Ctrl+D | Duplicate the selected sticker |
| Delete | Delete the selected sticker |
| F | Focus or refit the selected sticker |
| Enter | Finish selection/focus when canvas or general content is focused |

Focus mode retains its existing restrictions on duplicate/delete/add stickers. Keyboard tool selection shares the toolbar actions, including advanced painting options. The settings panel opens the shortcut guide in its own centered dialog; tool button titles also show shortcuts.

One finger uses the current tool. Two fingers pan and pinch simultaneously, anchored at their midpoint, between fitted scale and 8x (relative to the focused sticker while in focus mode). The gesture finishes when all fingers lift; the remaining finger cannot accidentally start painting. Trackpad scrolling pans, and Ctrl-wheel/trackpad pinch zooms at the pointer position. These gestures are limited to the canvas, preserving normal dialog scrolling and browser behavior elsewhere.

The canvas touch adapter owns native touch input and routes one synthetic pointer stream into the editor. Mouse compatibility events are unnecessary for drawing. A second finger cancels precision fill or pan and rolls back an in-progress brush/eraser stroke or sticker drag, including its undo history entry. A new gesture requires lifting all fingers. Touch cancellation, resize, and window blur cancel active input. Pointer/pen and mouse input otherwise retain their existing routes.

Implementation: `useEditorShortcuts.ts`, `useCanvasGestures.ts`, `usePaperView.ts`, `appMouse.ts`, and the session's `cancel-input` transaction command. See [architecture](ARCHITECTURE.md) for automated checks and manual interaction coverage.

### Vector stroke smoothing

Non-spray brush strokes blend input samples to damp hand jitter and use rounded quadratic joins, with the deliberate trailing distance capped at two screen pixels (converted through the current page zoom). Curves are sampled into short segments and swept into vector brush geometry, clipped to the SVG regions. Paint is saved as vector polygons; no blur or instance raster paint buffer is used. Initial taps remain immediate. When movement pauses, short display-frame updates settle the tail to the pointer even before release, then stop. Release still includes the actual pointer-up position and flushes any remaining tail. Eraser, spray, sticker movement, fill and pan keep their existing behavior. Cancelling a stroke for a two-finger gesture discards the smoothing tail after restoring the original document and undo history.

## Editor ribbons

The primary ribbon uses icon-only controls in this order:

Home | Move page, Zoom, Select | Erase, Brush, Fill, Stickers, Colors | Undo

Home is separate because it leaves the workspace. View and selection controls form one group; drawing controls form another. Undo stays at the far end as an easy-to-find recovery action away from Home. This placement is a product design choice, not a universal usability rule.

Groups use subtle rounded wells separated by spacing, with compact outer ribbon padding. On narrow screens, the primary ribbon stays on one row and shares the available width proportionally between its ten buttons. Buttons use 48px targets on wide screens and 44px height on compact screens, with widths adapting to the available space, accessible names, desktop title tooltips, visible keyboard focus, and selected-tool feedback. The color picker uses a neutral palette icon with a separate current-color dot so the icon remains visible for very light or dark colors.

The selected-sticker ribbon is also icon-only. Shrink/grow and counterclockwise/clockwise rotation use directional icons, with grouped pairs, named actions, and desktop tooltips. Done is highlighted; Delete is spaced apart.

References: [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) for accessible names and pressed state; [NN/g icon usability](https://www.nngroup.com/articles/icon-usability/) for the recognition tradeoff when removing visible labels. Icon-only controls follow the app's requested visual direction; accessible names and tooltips do not provide equivalent discoverability to visible labels on touch devices.

Selection controls open as a compact rounded drawer centered beneath the main ribbon, with its top edge tucked behind it. A slightly shaded surface and downward reveal distinguish it from the primary controls. The drawer overlays the canvas so selecting a sticker does not resize or recenter the page. Focus framing accounts for the drawer height.

The selected-sticker drawer includes separate horizontal and vertical flip buttons. Flips mirror the whole sticker in its local axes (before rotation), including its paint, silhouette, and ink; a second tap reverses the same flip. They participate in undo, duplication, saved documents, preview rendering, and export.

Size, rotation, flip, and layer order each have a shared well containing their two action icons, without a leading label icon.

Layer controls are ordered Backward, Forward. Each action crosses the nearest overlapping sticker in that direction, skipping unrelated layers and preserving their relative order. Overlap uses scene-pixel silhouette coverage within the paper, including transparent cutouts and transforms, rather than bounding boxes alone. The paper is never crossed. Controls disable when no overlapping sticker exists in their direction. Pairwise overlap results are cached until scene geometry/order changes. Undo records the complete reorder as one action.

Painting controls and the coloring page workshop are enabled by default for the current design phase. Settings can still turn them off; simple/toddler modes and parent locking are future work. Simple mode selects the standard 5-unit round ink brush or solid bucket fill immediately, without opening a tool overlay. Advanced mode opens the existing brush-size/type and fill-pattern controls. The preference is stored locally for later sessions and does not alter existing picture data.

Bucket fills apply on pointer release in both simple and advanced mode. Holding for 500ms temporarily zooms to the current mode's maximum (8x page Fit, or 8x sticker Fit while focused), anchored exactly at the pointer without applying ordinary pan limits. The anchor survives the zoom layout update, including at page edges and in surrounding letterbox space. Four dashes converge over the hold and complete a cross at 500ms. Short clicks fill at the original press point; their release pulse retains the incomplete cross. After magnification, the cross follows the pointer and release fills at its zoomed position. A magnified release restores the prior zoom/pan. Releasing outside the drawing viewport, pointer cancellation, capture loss, Escape, window blur, resizing, or changing tools cancels without filling and restores the view. Each completed fill is a single undo step.

## Sticker categories

The sticker browser groups subjects rather than coloring-page themes. Asset IDs retain their source-pack prefixes; those prefixes do not determine where a sticker appears.

| Category | Contents |
| --- | --- |
| Shapes | Basic geometric shapes |
| Characters | People and personified characters, including the costume numbers, skaters, and Santa |
| Animals | Animals, birds, and insects |
| Plants | Trees, flowers, bushes, grass, and mushrooms |
| Sky | Suns, clouds, rainbows, and stars |
| Landscapes | Horizons, ground, ponds, paths, stones, and shells |
| Buildings | Buildings and their parts, including windows and fences |
| Objects | Tools, toys, furnishings, gifts, and decorations |
| Vehicles | Cars, trucks, aircraft and other transport |
| Food | Fruit and other food |

Each sticker has one primary category in `art/stickers.json`, projected into the picker by `scripts/build-asset-catalog.mjs`. Prefer an existing subject category when adding artwork, regardless of season or scene. Categories and sticker lists already paginate in groups of six. Coloring pages keep their themed names independently of this browser.

Display names use a capital letter at the beginning of every word, including short words such as And and With. Asset IDs and source filenames stay stable so existing pictures keep their sticker references. Coloring-page titles follow the same convention.

See [artwork sources](../art/README.md) and [scene authoring guide](SCENE-AUTHORING.md) when assembling new pages. Category guides include thumbnails and placement notes for every asset.

The selected-sticker drawer sits directly below the full main ribbon, including
when the ribbon wraps. It appears immediately without an entrance animation and
does not overlap the main toolbar.

In Select, clicking another sticker switches selection directly. Clicking within
the selected border retains it, including transparent margins; clicking empty page
or surrounding workspace clears the border/drawer and returns to Fill on release.
The exit press/release is consumed, so it cannot also fill. Canceling that gesture
restores the previous selection. Toolbar/drawer presses retain their normal actions;
focused-sticker mode keeps its explicit Done behavior.

Brush and eraser gestures may begin in the surrounding drawing workspace and
continue onto the page. Paint remains clipped to the page; the entire gesture
is one undo action and cancellation restores the previous artwork. Toolbar and
overlay presses do not start painting.

## Coloring Pages picker

The approved Focus layout is now in the app. There is no visible dialog heading;
accessible names/tooltips remain. Categories and terrain detail toggles sit above
a single large paper preview. A thin white current/total badge and centered solid
red favorite heart overlay the paper. The drawing action uses the reviewed
magical pencil/blank-book artwork; utilities are centered in the footer on desktop
and flow beside the action on narrow screens. No Edit Page action remains.

The grid is a floating-paper overview with six bounded previews, original paper
ratios, favorite badges, side arrows and a compact filter-relative range. Choosing
an image returns to single view; single-view image/action opens the canvas directly.
The grid omits utilities and the drawing action. Arrows/left-right keys and horizontal
swipes navigate; details can be toggled off to include all levels. Empty filters
have an explicit reset. Add/Share use a separate focused transfer dialog, and
Delete appears only for custom pages. See [Coloring books](COLORING-BOOKS.md).

## Blank page setup overlays

The reviewed two-step blank-page layout is implemented. Size markings (A4, A5,
4 x 6 in, 6 x 6 in) sit inside solid folded paper artwork rather than below it.
The selected preset has a gold paper face and highlighted well; physical size
ratios, dimensions and orientation behavior are unchanged. Tall/Wide controls are
icon-only with accessible labels; square disables orientation without clearing
the prior choice. The paper and palette step icons provide direct back/forward
navigation while keeping selections intact. Redundant headings/captions are
visually hidden; dialog names, focus management and tooltips remain.

The color step shows the complete 32-color palette, a small paper-size/orientation
summary reflecting the chosen background, and the shared magical pencil/book
Start action. Summary text uses contrasting ink on dark/light backgrounds. On
narrow screens presets use two columns and colors four; short landscape uses a
compact eight-column palette. Shorter viewports scroll only the choice area,
leaving step, close/back and action controls reachable. Other editor color pickers
retain their existing pagination. Preview references are in overlay examples 56-60.
