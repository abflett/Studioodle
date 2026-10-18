# Blank paper and initial sticker sizing

Blank-page setup now offers Full page (A4, 210 × 297 mm), Half page (A5, 148 × 210 mm), Photo (4 × 6 inches), and Square (6 × 6 inches). Non-square choices support Tall/Wide orientation. Full A4 is the default, with orientation chosen from the selection window aspect ratio (Wide for a landscape window, Tall for a portrait window). It follows window rotation/resizing until the user selects an orientation manually; opening a new blank-page wizard resets this automatic choice. Background-color selection follows as before.

Dimensions are converted to rounded integer scene units at 96 units per inch, stored in the existing explicit `size` field, and painted at the default 150 DPI. The page is fitted to the available window, so choosing larger print dimensions does not change the fit-relative zoom baseline. Physical dimensions are accurate to scene-coordinate rounding. Version-3 saves store their explicit page dimensions. Older development save formats have been retired.

Newly added stickers preserve aspect ratio and native paint detail, shrink if necessary to fit within 60% of both page dimensions, and start entirely on the page. Small assets are not enlarged. Placement uses the visible silhouette bounds; subsequent selection resizing/movement retains the existing controls. Existing scene placements and duplicates are not automatically fitted.

No app tests or builds run; user visual review remains the validation workflow.

## Coloring pages and previews

All five starter coloring pages use full A4 landscape paper (1123 ? 794 scene units), matching the full-page blank preset. The authored arrangement scales uniformly and centers on that paper; saved documents retain their original dimensions. Older hybrid saves also keep their horizon top edge and paint aligned when loaded with the deeper horizon assets.

Saved-picture and coloring-page previews render vector ink directly at their displayed device-pixel dimensions. A thumbnail-only minimum stroke weight keeps thin outlines visible; exports and editable artwork retain their original line weights. Preview sizing is controlled by CSS rather than the changing raster backing dimensions.

The Horizons sticker category contains meadow, seashore, and snow. These are finite, wide background stickers, not repeating tiles yet. New horizon stickers fit the full page width in either orientation; their deeper fill region extends below the page. The visible SVG contains only the horizon curves. Hidden closure paths are added solely for offline region generation, so bucket fills remain enclosed without drawing rectangular scenery borders. They can still be moved, scaled, colored, and reordered normally.

The Cottage garden template uses the reusable meadow horizon behind the fence and buildings to separate sky and grass fills. Its repeating fence has uniform 60-unit picket spacing, and its curved path and progressively sized stepping stones align with the cottage doorway.

Horizon stickers now use manifest placement metadata and insert immediately above the paper, behind existing artwork. The moon crater starts higher than meadow/shore/snow horizons to keep its main detail on the page. Portrait placement adjusts for the ground depth so it still reaches the page bottom.

## Custom coloring pages

The selection screen's book-plus utility button copies the selected saved picture into the coloring-page picker. Templates keep paper size, sticker order, positions, scale, rotation and flips. All paint runs are removed, the canvas becomes white and sticker outlines become black. Freehand marks are paint and are omitted. A picture needs at least one sticker to create a useful template.

Templates are stored locally under `studioodle.v3.coloring.` separately from `Your pictures`. Each use receives a new picture ID, so coloring a template never overwrites it or the source picture. The picker previews the new template immediately; custom entries can be deleted through the existing confirmation dialog. Built-in pages cannot be deleted. `coloringPage.ts` creates copies and the shared storage reader validates both libraries.
