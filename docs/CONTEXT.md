# Current context

Updated 28 October 2026. Read `AGENTS.md` first, then this file and the documentation
for the requested feature. Use the checked-out repository root (`git rev-parse
--show-toplevel`); a client's initial working directory may point elsewhere.

## Product and architecture

Studioodle is a pre-v1 drawing/coloring app with React, Canvas2D display and vector
paint/ink. Phaser and raster painting have been removed. Keep one vector engine;
old development drawings can break. Saved documents are format 5; the current
drawing database is `studioodle-library-v8`. See [architecture](ARCHITECTURE.md).
No native builds unless the user explicitly asks. Completed coherent changes are
committed and pushed to the configured upstream after appropriate checks.

The wordless selection screen uses an easel, open coloring book and saved-art
paper stack. Hover scales slightly without layout shifts. Composite paper layers
share square/A4 portrait/A4 landscape geometry: masked full-bleed art, border/fold
overlay and a static stack. Preserve aspect ratios, edge alignment, stable carousel
layout and the user's artwork; do not invent preview backgrounds to hide cropping.

## Artwork status

All 364 stickers were upgraded to the current small-region pipeline. Accepted
editable ink lives in `art/source/stickers/line-repairs/`, selected by manifest
`inkSource`; original `source` art remains untouched. Current minimum clickable
region area is 10.2 square pixels at proportional A4/150 DPI. Do not bulk regenerate
or revise this threshold without reviewing a targeted example.

Repairs through full-library v5 are complete: 13 lines first, then 13 transparency
markers, eight fills and one rounded-rectangle alignment correction; 17 assets
changed. History 1 is v5 (17); History 2 is v4 (seven). There are no deferred v5
instructions. The user may now inspect regions and submit another export.
See [repair summary](ARTWORK-REPAIR-LOG.md) and [pipeline](STICKER-PIPELINE.md).

## Reviewer and annotations

`tools/artwork-review/` is a standalone Vite/TypeScript project. `npm run review`
opens it; `review:build` writes only `work/artwork-review-dist/`. Normal app dev
scanning/typechecking/building excludes reviewer source. Dependencies are shared.

Preserve the review storage key `studioodle-artwork-review-v1` and annotation data.
Storage belongs to the browser origin; stop the app server and reuse the same
hostname/port to continue a review. Never reset user review data to simplify a fix.
The compact revision graph in `tools/artwork-review/data/repair-history.json`
retires only actually applied instructions and preserves later annotations.
Original completed exports/verbose ledgers are in Git history; retained regression
samples are in `tests/fixtures/artwork-review/`. New exports belong in `art/reviews/`.

Reviewer controls: A/D navigate; Space toggles Reviewed; wheel zooms at cursor;
middle drag pans; Ctrl-click removes a region, Shift-click adds one; right clicks
define line endpoints; left click selects/drags or deselects on empty space;
Delete removes selection; Ctrl-wheel adjusts selected line width by 0.1 (.1–2).
Adding a marker must not focus notes. Cleanup categories are explicit and undoable.

## Current interface design focus

The new Coloring Pages overlay is implemented with the existing six scenes.
Single preview is the default; artwork or the magical pencil/book action opens a
fresh drawing directly. Grid is an optional six-page overview; choosing a card
returns to single view. Side arrows/keyboard/swipes browse, and counts refer to
the active filter. Page hearts persist locally; initial order puts favorites first
without jumping when a heart is toggled. Filter controls use All, Characters,
Animals, Places & Nature, Things, Letters & Numbers, and terrain detail icons.
Shipped pages have curated `browse` metadata in the canonical book. Custom pages
use lightweight subject/sticker-count defaults, not geometric difficulty scoring.

Single view has Add (paste code/.studioodle file with validation and preview), Share
(copy code/download the same code as a .studioodle text file) and custom-only Delete. Imports create independent IDs. Portable codes use studioodle-page:3: and carry sticker layouts and ink colors without paint fields; internal books/storage remain JSON.
The dedicated Edit Page action is removed; normal open/arrange/save-as-page is the
user authoring route. All current custom templates consolidate into the workshop
record on the next successful atomic write; failed writes preserve original data.
Existing source keys are read-only and ignored once that record is authoritative.
See [coloring books](COLORING-BOOKS.md). Simple/toddler modes and parent lock remain
future work. Blank paper setup now also uses the approved two-step layout: bold size marks
inside folded paper silhouettes, icon-only orientation/navigation, clickable
paper/color step icons, a selected-paper/color summary and the shared magical
drawing action. Physical sizes and automatic/manual orientation behavior remain
unchanged. Blank setup shows all 32 colors; editor palette pagination is unchanged.
Other editor/settings/output overlays still await refinement.

[Design brief](OVERLAY-DESIGN.md) and [layout examples](overlay-examples/README.md)
record the review. No new scene artwork or blanket asset processing was included.

Brush/eraser gestures can now start in the surrounding drawing workspace and
continue onto the page, with page clipping, single-action undo and cancellation.

Tool/menu cursors use one theme-independent palette with dark contours and a fine
light edge for mixed canvas backgrounds; brush/bucket accents keep selected paint.

Bucket results now publish fully compacted geometry before display, preventing
temporary old-color fringes that previously vanished after cleanup and redraw.

Temporary hold-to-fill zoom preserves the exact pointer anchor without pan
clamping, including through layout updates; release/cancellation restores the view.

Editor saves now write only after committed artwork edits. Untouched blank paper,
unchanged coloring pages and reopened drawings skip writes on autosave/Home/close.
Undo tracks the last-saved revision (or opening state before the first save); canceled gestures and tool/color
choices do not start saving. Failed writes remain dirty for retry. The minute
interval remains unchanged.

## Next work and verification

[Refinement tasks](REFINEMENT-TASKS.md) is the single implementation backlog.
Highest priorities needing a behavior decision are save/recovery scheduling and
brush/render fault recovery. Other open items cover export budgets, atomic custom
pages, background sizing, async input, offline policy and physical device testing.
The user wants to resume feature work after important refinements; don't invent
another engine migration or treat old completed reports as new tasks.

Run `npm run check` for normal checks; `npm run test:browser` for app behavior.
Reviewer changes also need `npm run review:typecheck`, `npm run test:review` and,
for entry/config changes, `npm run review:build`. Use memory/scene profiles only
when relevant. No asset regeneration is part of these checks.

`work/`, `dist/` and local `release/` are disposable generated output. Portable
Potrace belongs in ignored `tools/bin/potrace/`, or set `POTRACE_PATH`; deleting
scratch output must not remove required conversion tools or active review inputs.

Local cleanup limitation: automatic approval rejected bulk deletion of `work/`,
`dist/` and `release/` during this cleanup. Existing generated artifacts remain on
this machine; they are ignored and do not represent active repair work. The source
cleanup and validation are independent of that local disk housekeeping.
