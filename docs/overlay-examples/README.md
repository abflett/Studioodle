# Coloring Pages overlay examples

Design studies for discussion, 26 October 2026. These are review artifacts, not
changes to the app. Open [index.html](index.html) directly in a browser, or inspect
the screenshots below. The text above the panel belongs to the comparison viewer;
the proposed app overlays themselves have no visible headings or button captions.

| Study | Screenshot | What to compare |
| --- | --- | --- |
| A: Focus | [Desktop](01-focus.png) | Largest single preview; filters above, utilities below |
| B: Side tools | [Desktop](02-side-tools.png) | Add/share/custom-delete in a side rail |
| C: Filmstrip | [Desktop](03-filmstrip.png) | Large preview plus direct visual jumps to nearby pages |
| Optional grid | [Desktop](04-grid.png) | Six previews, with independent heart targets |
| Narrow portrait | [Dark](05-phone-focus.png), [light](06-phone-light.png) | Wrapped filters and a panel inset from the screen edges |

## Focus refinement

The current HTML incorporates the desktop/landscape refinement. New overlay-only
captures: [ordinary heart](07-focus-refined.png) and [favorited](08-focus-favorite.png).
Latest variant: [flat white badge](09-focus-white-badge.png) and
[favorited](10-focus-white-badge-favorite.png). The page number uses regular-weight
text on a thin-bordered white badge at bottom right; the dotted/filled red heart
is at top right. Grid/single sits beside the filters after the favorites filter. Earlier
screenshots above retain the initial comparison layouts; phone refinements are
not part of this round. Page numbers currently refer to the filtered sequence.

Latest action/detail study: [Focus with shape filters and larger drawing action](11-focus-shapes-and-draw.png),
[filled-heart variant](12-focus-shapes-and-draw-favorite.png). Detail progresses
from circle to hexagon to a lobed floral outline, avoiding star ratings and wheel
spokes. The larger primary button uses a paper-and-pencil drawing illustration.
These remain icon proposals for review.

Centered-controls experiment: [Focus](13-focus-centered-controls.png),
[favorited](14-focus-centered-controls-favorite.png). Filters and bottom utilities
are centered independently, with Close and the primary action at the right.
The drawing button is wider and shorter, showing a pencil, loose scribble and
small spark accents rather than a document. Detail uses a nested hexagon instead
of the floral/cog outline. This is a reversible desktop comparison, not a final choice.

Magic-pencil study: [Focus](15-focus-magic-pencil.png),
[favorited](16-focus-magic-pencil-favorite.png). Grid/single now sits at far left,
mirroring Close. Filters remain centered. The short, wide drawing action uses a
generated monochrome pencil with a looping trail, dust dots and sparkles. Original
transparent artwork and generation metadata are retained under
`art/source/interface/magic-pencil-flourish-v1.*`; the HTML uses its alpha as a CSS
mask so ink follows the button foreground. This remains a mockup-only proposal.

Winged-pencil/book study: [Focus](17-focus-winged-pencil-book.png),
[favorited](18-focus-winged-pencil-book-favorite.png). The pencil travels toward
an open coloring book with a small flower outline, with page-like wings and short
airy motion strokes instead of a continuous ink trail. The original RGBA artwork
and generation metadata are retained as `art/source/interface/magic-pencil-flourish-v2.*`.
This variant displays the generated image directly, including its pale wing accents;
version 1 is preserved for comparison. No app controls have been changed.

Polished pencil/book study: [Focus](19-focus-polished-pencil-book.png),
[favorited](20-focus-polished-pencil-book-favorite.png). Removes the page wings,
white highlights and flower. A simple flying pencil meets a blank open book,
with restrained wind strokes and sparkles. Original transparent artwork and
metadata are `art/source/interface/magic-pencil-flourish-v3.*`.

Balanced magical-book study: [Focus](21-focus-buoyant-magic-book.png),
[favorited](22-focus-buoyant-magic-book-favorite.png). Keeps the downward pencil
angle with a smaller, buoyant blank book, lifted curved pages, tapered wind behind
the pencil, a short breeze beside the book and sparkles around the book itself.
Original artwork/metadata are `art/source/interface/magic-pencil-flourish-v4.*`.

Fitted-button refinement: [Focus](23-focus-fitted-draw-button.png),
[favorited](24-focus-fitted-draw-button-favorite.png). The button is now 142 x 50
CSS pixels, with the illustration fitted at 118 x 44. Transparent padding was
trimmed from v4 using crop bounds (332, 48, 2033, 683), retaining an 18-pixel margin
around visible ink. The derivative is `assets/magic-pencil-v4-cropped.png`; the
original under `art/source/interface/` is untouched. No redraw or stretching.

Action placement comparison: [utilities left, action right](25-focus-left-tools-right-action.png)
and [utilities left, action centered](26-focus-left-tools-center-action.png).
The viewer has an Action: right / center switch outside the app panel. Both
variants use simplified, stronger pencil/book contours, fewer details, an optical
upward adjustment, and consistent red dotted/filled hearts. Add has a small gap
before page-specific Share/Delete. Page counts are confirmed relative to the
current filter, not stable global page IDs. Original artwork is v5, with a cropped
documentation derivative under `assets/` and crop metadata beside the original.

Grid wells and arrows study:

- [Single view with restored fancier artwork and centered utilities](27-focus-preferred-single.png).
- [Six landscape pages in matching wells](28-grid-landscape-wells.png).
- [Landscape, portrait and square together](29-grid-mixed-paper-wells.png).
- [Next batch with two remaining pages](30-grid-next-batch.png).

Use the grid toggle and Landscape / mixed paper control in the comparison viewer.
Arrows page through batches of six and retain the current batch when returning to
single view. Each well has a favorite heart and a filter-relative page count.
Artwork is contained at its original aspect ratio; no stretching or cover crop.
The six landscape previews are the canonical bundled pages. Portrait dragon and
square butterfly are explicitly mockup-only single-subject paper-format studies
using shipped stickers, not additions to the bundled coloring book.

The grid shows Add in the footer and omits the drawing action because tapping a
card opens it directly. Share/Delete have no implicit selected target in grid mode;
their grid placement remains a design decision. The restored utility placement
interprets the user's preferred earlier version as example 23; confirm if another
reference was intended. No app UI has changed during this grid discussion.

Edge-fit grid refinement: [landscape](31-grid-edge-fit-landscape.png),
[mixed paper](32-grid-edge-fit-mixed.png). Card padding is removed; each image
expands until one dimension meets the card edges, retaining original proportions
and the full drawing. Unused space on the other axis stays as the card well.
Favorite and page-number badges stay fixed at top/bottom right and may overlay art.

Floating-paper grid study: [landscape](33-grid-floating-landscape.png),
[mixed paper](34-grid-floating-mixed.png). Removes per-card page counts and visible
well borders/backgrounds. Each paper keeps its actual proportions with a subtle
edge/shadow; the favorite badge attaches to the paper corner, not an invisible
cell corner. Bottom range remains the only grid numbering. The top favorites
filter uses a solid red outline, filled when active; page hearts remain dotted.

## Interactions in the example

- Switch A/B/C using the controls outside the overlay; Light / Dark changes theme.
- Left/right browse; the grid/single toggle remembers the current browsing index.
  Grid images open directly rather than entering a selection mode. Returning to
  single view resumes the last browsing position, or the last image tapped.
- Tapping the large artwork or pencil action simulates opening the drawing canvas.
  The example displays a notice; it does not actually open an editor.
- Hearts toggle in memory only. The top heart filters to favorites. Category icons
  filter a small illustrative grouping of the six shipped pages.
- Circle/hexagon/floral-outline icons propose a visual language for detail.
  They change their selected appearance only; no difficulty scoring is implemented.
- Add, Share, Close and Delete show explanatory notices instead of performing writes.
  Delete is displayed to compare placement for a custom-page scenario; the shipped
  example pages cannot actually be deleted. The final app would show it only for custom pages.

## Review questions

A is the simplest starting point. Does the lower-left utility group feel clear,
or does B's grouped side rail make the controls easier to discover? Does C add
useful visual navigation, or too much competing imagery? Are the circle detail
symbols understandable without labels? Does the optional grid need more than one
density, or is one overview plus one large-page view enough?

The sample category/detail symbols and import/share icons are proposals, not a
final icon set. Favorites-first ordering and the sharing/paste dialogs are outside
these layout studies. Keeping a stable page while toggling favorites is deliberate.

## Artwork and verification

Previews under `pages/` are documentation-only raster renders of the canonical
`src/assets/coloringBook.json`, using the current vector SVG exporter. They are not
a second authored book or runtime asset catalog. The actual scene proportions and
ink are preserved. Panel/background colors follow the existing app theme; the
backgrounds are referenced directly from the app's interface assets.

Rendered in Chromium at 1080 x 800 and 430 x 880, checked visually, with runtime
error and horizontal-overflow checks. This does not establish touch usability or
approve any layout for implementation. No storage, original artwork or app UI changed.
