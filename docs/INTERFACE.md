# Interface and interaction

Current user-facing behavior; implementation boundaries are in [architecture](ARCHITECTURE.md).

## Startup and navigation

Landscape selection uses the user's sketched regions: Blank at upper left,
settings/fullscreen/exit at upper right with Pages beneath, and a centered saved
picture carousel across the lower band. The composition is bounded to
1120px wide / 860px tall, with extra top space
and side gutters on larger displays. A shared gallery-based size keeps the book
near the paper stack's width and the easel smaller. The arrangement is an open
stagger, not an equal-sided triangle: the easel lifts, the smaller book moves
right, and the gallery lowers on tall displays. Compare visible edge gaps
(easel-to-book and book-to-gallery), rather than only center distances.
Offsets shrink on short displays to keep all controls in view. The gallery receives half the composition height,
while settings remain independently anchored at the screen corner. Gallery
arrows flank the stack and actions sit
under it. Utility/action targets stay at least 44px, including 568 x 320 and
667 x 375 phone landscapes. Desktop uses the same arrangement; portrait retains
a stronger stagger: easel lifted 24-44px, book lowered 8-18px and tilted
9 degrees counterclockwise. The gallery stays anchored. Taller phones use a
smaller contribution from the older book stagger so its rotated edge still has
breathing room above the paper stack.

The splash loads the editor module, stays visible for at least two seconds and
proceeds when ready. Home illustrations load from bundled selection assets; they do not
require fetching or decoding the full sticker library. It does not download every sticker definition.

React owns home/setup, the ribbon and overlays. Blank setup selects Display or a physical paper
preset, Tall/Wide/Square orientation, then background color. The
page is independent of window size and starts fitted beneath the ribbon.

Coloring templates arrange reusable SVG stickers. Choosing a picture prepares its
lazy definition packs before entering the editor. Thumbnail definitions load as needed.
Sticker selection loads only the chosen definition before placing it. Failures retain
the selection view with a dismissible message rather than opening an incomplete scene.

Artwork owns surface paint, regions, placement, order, serialization and compositing.
Canvas2D renders vector ink and vector paint at display resolution. `EditorSession` handles editing commands, undo and gesture transactions; the browser canvas adapter handles
pointer input and draws the selection overlay. React positions the page and controls Fit-relative zoom.

Each completed artwork action queues a background save of the version-6 document;
there is no minute timer. Untouched blank paper and unchanged coloring pages are
not added to Your pictures. Reopened drawings are not rewritten until edited.
Tool/color choices, view changes and canceled gestures do not count as edits.
Undo queues the restored artwork. Home finishes input and returns immediately,
without waiting for storage; the queue and latest previews survive the canvas.
Failed writes preserve the previous committed drawing, retry with bounded backoff
and show a retry notice on Home or in the editor. Ctrl+S waits for its checkpoint;
normal desktop close also flushes pending writes. A browser/process shutdown may
lose the latest pending actions; no asynchronous unload guarantee is made.
Your pictures browses version-6 local saves and offers delete/undo-delete, PNG/SVG/PDF export and vector printing.
Old development save formats are intentionally unsupported. See [the sticker pipeline](STICKER-PIPELINE.md) for
the authoring format, region maps, loading/caches and cleanup decisions.
See [architecture](ARCHITECTURE.md) for repository, output and engine boundaries.

The ribbon's Hide tools button (an upward arrow above a horizontal line) releases its space to the canvas. A floating
Show tools button at the top right restores it, using the reversed symbol: a
downward arrow below a horizontal line. Reopen is circular; Collapse uses the ribbon's rounded tile shape. The collapse control matches
the borderless ribbon buttons, using theme-colored icons, a contrast glow and a
theme-tinted hover film; only the floating reopen control has a transparent
center, theme-colored border/icon, an even contrast glow and a theme-tinted hover film. Collapse is the final ordinary button in the main ribbon, without a reserved side gutter.
Fit mode expands/refits
with the workspace; manual zoom keeps its scale and center artwork point. Keyboard
focus transfers between the two controls. Hidden tools are excluded from tab order,
while drawing shortcuts remain available. Visibility resets for each editor session.

The editor background flows continuously through the ribbon, sticker submenu
and letterboxing: all use the same viewport-aligned image. The submenu
uses auto-margin centering. Only vertical image offsets suggest glass depth: the top ribbon stays fixed,
the submenu shifts 4px upward and the letterboxing shifts 8px upward. Shared
16px overscan keeps the shifted edges covered without repeating the image. It tucks 4px behind the opaque main ribbon;
the shadow tier follows the gap between casting and receiving surfaces:

| Tier | Appearance | Surfaces |
| --- | --- | --- |
| 1 | Short contact shadow with a little softness | Ribbon onto submenu; submenu onto paper; paper onto desk |
| 2 | Wider reach with medium softness | Ribbon onto paper; submenu onto desk |
| 3 | Broadest and softest, still visible | Ribbon onto desk |

Tier 1 is shared across the three adjacent gaps (orange, purple and red in the
user's reference); blue is tier 2 and green is tier 3. Masks keep these regions
separate as the page pans/zooms or the submenu opens/closes. All tiers use theme
shadow colors; changing one tier updates every matching gap.
The workspace retains its additional theme tint to distinguish it from the
ribbons; focus mode keeps its separate spotlight background.

## Paper and templates

Blank-page setup defaults to Display, labeled with the device screen aspect ratio (for example 16:9), falling back to the window when screen dimensions are unavailable. A4, A5 and 4 x 6 inch Photo remain available. Tall, Wide and Square are independent orientation choices; Square uses the preset's shorter edge. Automatic orientation follows the display until manually selected and resets when opening a new blank-page wizard.

New pages use a stable 1000-unit short edge, with the longer edge derived from the chosen ratio. Saved geometry never follows window resizing or device density; the viewport fits the page and renders at native device-pixel density. Physical dimensions live separately in `printSizeMm`: A4/A5/Photo retain their real sizes, while Display uses a 210 mm short edge as its output reference. PNG defaults to 300 DPI, with 150/600 choices; SVG, PDF and printing retain vectors at that physical size. Existing saved and bundled layouts keep their explicit dimensions.

Newly added stickers preserve aspect ratio and vector paint detail, shrink if necessary to fit within 60% of both page dimensions, and start entirely on the page. Small assets are not enlarged. Placement uses the visible silhouette bounds; subsequent selection resizing/movement retains the existing controls. Existing scene placements and duplicates are not automatically fitted.

### Coloring pages and previews

Built-in coloring pages use full A4 landscape paper (1123 x 794 scene units), retaining their authored coordinates independently of new blank-page normalization. The authored arrangement scales uniformly and centers on that paper; saved documents retain their original dimensions.

Saved-picture and coloring-page previews render vector ink directly at their displayed device-pixel dimensions. A thumbnail-only minimum stroke weight keeps thin outlines visible; exports and editable artwork retain their original line weights. Preview sizing is controlled by CSS rather than the changing raster backing dimensions.

The Landscapes sticker category includes meadow, seashore, snow and moon-crater horizons. These are finite, wide background stickers, not repeating tiles yet. New horizon stickers fit the full page width in either orientation; their deeper fill region extends below the page. The visible SVG contains only the horizon curves. Hidden closure paths are added solely for offline region generation, so bucket fills remain enclosed without drawing rectangular scenery borders. They can still be moved, scaled, colored, and reordered normally.

The Cottage garden template uses the reusable meadow horizon behind the fence and buildings to separate sky and grass fills. Its repeating fence has uniform 60-unit picket spacing, and its curved path and progressively sized stepping stones align with the cottage doorway.

Horizon stickers now use manifest placement metadata and insert immediately above the paper, behind existing artwork. The moon crater starts higher than meadow/shore/snow horizons to keep its main detail on the page. Portrait placement adjusts for the ground depth so it still reaches the page bottom.

### Custom coloring pages

The selection screen's save utility button copies the selected saved picture into the coloring-page picker. Templates keep paper size, sticker order, positions, scale, rotation and flips. All vector paint is removed, the canvas becomes white and sticker ink colors are preserved. Freehand marks are paint and are omitted. A picture needs at least one sticker to create a useful template.

Templates are stored locally in the atomic `studioodle.workshop.v3` collection separately from `Your pictures`. Each use receives a new picture ID, so coloring a template never overwrites it or the source picture. The picker previews the new template immediately; custom entries can be deleted through the existing confirmation dialog. Built-in pages cannot be deleted. `coloringPage.ts` creates copies and storage adapters validate both libraries.

Ribbon tool groups are transparent without wells. Icons are 32px on desktop
and up to 28px on narrow screens; desktop button targets are 52px. Buttons
use circular hover targets and the theme text color: dark teal with a soft cream
glow in light mode, warm white with a dark blue glow in dark mode.
The active tool retains the theme action fill and contrasting icon. Sticker adjustments use
the same treatment while keeping their grouped layout.

## Shortcuts and gestures

Space toggles adjusted mouse control at the saved speed. Escape releases it. Key repeat is ignored for the toggle. Editable fields, range inputs, and focused dialog controls retain normal keyboard behavior. Browser pointer-lock restrictions still apply, and failure leaves the normal cursor available.

Editor shortcuts pause while a dialog is open or a field is being edited. Ctrl below also means Cmd on macOS.

| Shortcut | Action |
| --- | --- |
| B / G / E | Brush / Fill / Eraser |
| V / H | Select / Pan |
| S / C | Stickers / Colors |
| T | Hide or show the tools ribbon |
| Z | Cycle zoom levels |
| + or = / - | Zoom in / out at the viewport center |
| 0 | Fit the page, or refit the focused sticker |
| Ctrl+Z or Backspace | Undo |
| Ctrl+S | Save the current picture |
| Ctrl+D | Duplicate the selected sticker |
| Delete | Delete the selected sticker |
| F | Enter or exit sticker focus |
| Enter | Finish selection/focus when canvas or general content is focused |

Focus mode retains its existing restrictions on duplicate/delete/add stickers. Keyboard tool selection shares the toolbar actions, including advanced painting options. The settings panel opens the shortcut guide in its own centered dialog; tool button titles also show shortcuts.

One finger uses the current tool. Two fingers pan and pinch simultaneously, anchored at their midpoint, between fitted scale and 8x (relative to the focused sticker while in focus mode). The gesture finishes when all fingers lift; the remaining finger cannot accidentally start painting. Trackpad scrolling pans, and Ctrl-wheel/trackpad pinch zooms at the pointer position. These gestures are limited to the canvas, preserving normal dialog scrolling and browser behavior elsewhere.

The canvas touch adapter owns native touch input and routes one synthetic pointer stream into the editor. Mouse compatibility events are unnecessary for drawing. A second finger cancels precision fill or pan and rolls back an in-progress brush/eraser stroke or sticker drag, including its undo history entry. A new gesture requires lifting all fingers. Touch cancellation, resize, and window blur cancel active input. Pointer/pen and mouse input otherwise retain their existing routes.

Implementation: `useEditorShortcuts.ts`, `useCanvasGestures.ts`, `usePaperView.ts`, `appMouse.ts`, and the session's `cancel-input` transaction command. See [architecture](ARCHITECTURE.md) for automated checks and manual interaction coverage.

### Vector stroke smoothing

Non-spray brush strokes blend input samples to damp hand jitter and use rounded quadratic joins, with the deliberate trailing distance capped at two screen pixels (converted through the current page zoom). Curves are sampled into short segments and swept into vector brush geometry, clipped to the SVG regions. Paint is saved as vector polygons; no blur or instance raster paint buffer is used. Initial taps remain immediate. When movement pauses, short display-frame updates settle the tail to the pointer even before release, then stop. Release still includes the actual pointer-up position and flushes any remaining tail. Eraser, spray, sticker movement, fill and pan keep their existing behavior. Cancelling a stroke for a two-finger gesture discards the smoothing tail after restoring the original document and undo history.

## Editor ribbons

Main and sticker ribbons each remain a single row at every width. Spacing and
icons compress on narrow screens while keeping every action visible. Up to 800px
wide, the submenu fills the screen width with 44px buttons and reduced padding;
larger displays keep the inset rounded drawer. Full-width shadow masks also use
square corners. Ribbon button fills use softly rounded tiles across their hit areas.

The primary ribbon uses icon-only controls in this order:

Home | Move page, Zoom, Select | Erase, Brush, Fill, Stickers, Colors | Undo | Collapse

Home is separate because it leaves the workspace. View and selection controls form one group; drawing controls form another. Undo stays at the far end as an easy-to-find recovery action away from Home. This placement is a product design choice, not a universal usability rule.

The borderless controls use compact outer ribbon padding. On narrow screens, the primary ribbon stays on one row and shares the available width between all eleven buttons, including Collapse. Buttons use 52px targets on wide screens and 44px height on compact screens, with widths adapting to the available space, accessible names, desktop title tooltips, visible keyboard focus, and selected-tool feedback. The color picker uses a neutral palette icon with a separate current-color dot so the icon remains visible for very light or dark colors.

The selected-sticker ribbon is also icon-only. Shrink/grow and counterclockwise/clockwise rotation use directional icons, with grouped pairs, named actions, and desktop tooltips. Done is omitted on every screen. At widths up to 800px, Duplicate is also omitted, leaving ten actions including Focus and Delete; larger displays retain Duplicate. Another tool, another press of Select, or an empty-space tap leaves ordinary selection.

Focus uses an eye icon and replaces the submenu with a single X exit
button floating below the ribbon. Its transparent circular outline and subtle glow
match the floating ribbon control; no submenu background or shadow bar remains.
Brush, Fill, Eraser and navigation tools preserve focus. Exit focus (or F/Enter) exits
focus, restores the previous page view and returns to selection on the same sticker.

References: [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) for accessible names and pressed state; [NN/g icon usability](https://www.nngroup.com/articles/icon-usability/) for the recognition tradeoff when removing visible labels. Icon-only controls follow the app's requested visual direction; accessible names and tooltips do not provide equivalent discoverability to visible labels on touch devices.

Selection controls open as a compact rounded drawer centered beneath the main ribbon, with its top edge tucked behind it. A slightly shaded surface and downward reveal distinguish it from the primary controls. The drawer overlays the canvas so selecting a sticker does not resize or recenter the page. Focus framing accounts for its smaller floating exit button.

The selected-sticker drawer includes separate horizontal and vertical flip buttons. Flips mirror the whole sticker in its local axes (before rotation), including its paint, silhouette, and ink; a second tap reverses the same flip. They participate in undo, duplication, saved documents, preview rendering, and export.

Size, rotation, flip, and layer order each have a shared well containing their two action icons, without a leading label icon.

Layer controls are ordered Backward, Forward. Each action crosses the nearest overlapping sticker in that direction, skipping unrelated layers and preserving their relative order. Overlap uses scene-pixel silhouette coverage within the paper, including transparent cutouts and transforms, rather than bounding boxes alone. The paper is never crossed. Controls disable when no overlapping sticker exists in their direction. Pairwise overlap results are cached until scene geometry/order changes. Undo records the complete reorder as one action.

Brush controls are enabled by default. Settings can turn them off; simple/toddler modes and parent locking are future work. Simple mode selects the standard 5-unit round brush or solid bucket fill immediately, without opening a tool overlay. Advanced mode opens brush-tip/size controls. Fill always selects immediately, including with the G shortcut, and applies the selected solid color without an overlay or pattern options. The brush overlay uses one segmented well for round, rising diagonal, falling diagonal and opaque scattered-circle tips; a full-width 1?64 unit slider, numeric entry and one-unit buttons; and a small premade, theme-colored preview well beside the icon-only Apply action. Diagonal nibs keep their fixed angle. Scattered circles accumulate solid vector coverage with no transparency or blending. The preference is stored locally for later sessions and does not alter existing picture data.

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
focused-sticker mode keeps its explicit X exit control.

Brush and eraser gestures may begin in the surrounding drawing workspace and
continue onto the page. Paint remains clipped to the page; the entire gesture
is one undo action and cancellation restores the previous artwork. Toolbar and
overlay presses do not start painting.

## Coloring Pages picker

On portrait screens, Grid occupies the upper-left position with Favorites directly
below it. The six categories form a centered 3 x 2 well, with the centered detail
well beneath. The single-page preview uses nearly the full width, with Previous and
Next in a dedicated row eight pixels beneath it rather than occupying side gutters.
The paper and navigation form one group centered between the filters and footer;
the preview row fits the paper's aspect ratio so unused space stays outside that
group. The preview shares the same side inset as the dialog controls. Larger
layouts retain the wide arrangement.

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

Small-screen overlays (width <=600px or height <=540px) fill the viewport without an outer border, gutter or rounded corners, respecting safe areas. Delete confirmation stays compact. Blank paper colors prefer the familiar four landscape rows/eight narrow portrait rows, adapting only when swatches become too small.

The two-icon step header is a segmented switch with a sliding theme-colored
highlight, no connector dash, and reduced-motion support.
Square shows a single 1:1 card instead of square versions of A4/A5/Photo.
Switching back to Tall/Wide restores the remembered preset. Square documents use
1000 x 1000 logical units with a separate 210 x 210mm default print size.

Orientation controls share the fixed footer with Next; neither step scrolls.
Paper cards use equal flexible grid cells and contain their artwork, shrinking
when needed. The background picker prefers eight columns / four rows in landscape
and four columns / eight rows on narrow portrait screens, fitting swatches up to
60px. It tries other column counts only when swatches would be smaller than 32px.
Partial rows center. The
selection ring and footer actions remain inside the dialog.

The two-step blank-page layout shows Display's ratio and A4/A5/Photo markings
inside folded paper artwork. The selected preset has a gold paper face and
highlighted well. Tall/Wide/Square controls are icon-only with accessible labels.
The paper and palette step icons provide direct back/forward
navigation while keeping selections intact. Redundant headings/captions are
visually hidden; dialog names, focus management and tooltips remain.

The color step shows the complete 32-color palette, a small paper-size/orientation
summary reflecting the chosen background, and the shared magical pencil/book
Start action. Summary text uses contrasting ink on dark/light backgrounds. On
narrow portrait screens presets use two columns, while short landscapes use four.
The color columns and button size adapt to the available area. Header and footer
stay fixed and the choices fit between them without scrolling. Editor painting and ink pickers use the five-palette selector described below. Preview references are in overlay examples 56-60.


### Sticker browser

The sticker overlay uses the centered header from sticker study 02: a palette
button with the same borderless color dot as the main ribbon, followed by an
All/Easy/Medium/Detailed filter well, with Close on the right and Back on the left
inside categories. Category icons show all ten subjects in a responsive grid;
category and sticker buttons retain accessible names/tooltips without visible labels.
Filters use authored simple/moderate/detailed metadata. Categories without matches
remain in position but disabled. Sticker pages show twelve previews on desktop or
six on small/short screens. Changing category or detail starts at the first page.

Ink defaults to #000000 for a new editor session. Its separate native color dialog
reuses the drawing palette without changing the current paint color. Choosing ink
or cancelling returns to the same category, detail and page, with focus restored to
the ink button. The chosen ink remains available for subsequent sticker placements.
Black and white palette swatches and new blank paper use #000000/#ffffff; bundled
page ink is black. Theme surfaces stay soft, and saved custom colors are preserved.


The main app has no developer workshop controls or authoring mode. The editor
workshop ribbon action, revision/export dialog and advanced-settings switch are
removed. Regular picture saving, page import/export and saving a picture as a
coloring page remain user features. Development diagnostics and artwork review
belong in standalone tools rather than the app UI.


The saved-picture action uses custom curved open-book artwork with a plus outside
the page. Once its sticker layout exists in custom coloring pages, it becomes a
muted disabled book-check labeled ?Added to coloring pages.? Layout identity includes
paper dimensions, sticker kinds, transforms, order and ink; it excludes paint,
paper color, IDs and titles. This confirmation survives reopening and resets for
a changed layout or removal of its matching custom page. A failed write does not
show confirmation and can be retried.


### Five-palette color selector

Painting and sticker ink use the same wordless color overlay: a centered well with
Everyday/Pastel/Vivid/Moody/Custom triangle-dot previews and a 32-swatch grid. Changing
a palette does not change the selected color. Normal swatch selection returns to
the canvas (or sticker browser for ink). Custom starts with empty outlined slots.
Clicking an empty slot opens a nested solid-color picker; confirming assigns and
selects that slot. The footer pencil enables edit mode for every custom slot; its
highlighted check exits editing. Editing a filled slot changes all marks/ink linked
to that slot, without switching the selected slot or changing any other drawing.
There is no deletion or opacity control. Used slots stay defined except when undoing
the action that first assigned them.

The custom picker has saturation/brightness (pointer or arrow keys), hue, previous/
new previews, copy/paste hex entry and Apply. Invalid hex disables Apply. Cancel,
Escape or the backdrop discards draft changes. Focus returns to the initiating slot.
Palette edits are undoable and saved as artwork actions. On compact screens the
grid uses four columns and scrolls within short dialogs; wide short screens retain
eight smaller columns. Blank paper background selection remains a simple fixed
32-color palette; background RGB is independent of linked custom paint.
