# Current context

Updated 30 October 2026. Read `AGENTS.md` first, then this file and the documentation
for the requested feature. Use the checked-out repository root (`git rev-parse
--show-toplevel`); a client's initial working directory may point elsewhere.

## Product and architecture

Android ARM64 tester packaging is now supported alongside Windows. See
[Android setup](ANDROID.md) for `npm run android:build`, signing and USB install.
The shared Rust library has a mobile entry point; desktop window-state behavior
stays desktop-only. Android uses `com.studioodle.app` and native content-URI file
exports. Print saves a PDF on Android. Keep the generated Android Gradle sources
tracked; build output, local SDK paths, secrets and generated Tauri glue stay ignored.

Studioodle is a pre-v1 drawing/coloring app with React, Canvas2D display and vector
paint/ink. Phaser and raster painting have been removed. Keep one vector engine;
old development drawings can break. Saved documents are format 6; the current
drawing database is `studioodle-library-v9`. See [architecture](ARCHITECTURE.md).
No native builds unless the user explicitly asks. Completed coherent changes are
committed and pushed to the configured upstream after appropriate checks.

The wordless selection screen uses an easel, open coloring book and saved-art
paper stack. Hover scales slightly without layout shifts. Composite paper layers
share square/A4 portrait/A4 landscape geometry: masked full-bleed art, border/fold
overlay and a static stack. Preserve aspect ratios, edge alignment, stable carousel
layout and the user's artwork; do not invent preview backgrounds to hide cropping.

Fill now selects immediately (toolbar or G) and applies the selected solid color.
The fill-pattern overlay and settings command are removed; the painting-controls
preference now controls the brush overlay only. Existing saved patterned artwork
still renders and exports through the current vector paint format.

The sticker overlay implements study 02's centered ink/detail header. All ten
category icons appear without labels or category paging; unavailable categories
stay in place but are disabled by the All/Easy/Medium/Detailed filter. Sticker
metadata comes from authored `detail` in `art/stickers.json` through assetLibrary.
The separate native ink-color dialog reuses the full drawing palette and preserves
category/filter/page, returning focus to the ink button. Ink starts at pure black
per drawing session and is independent of the drawing color. No footer remains.
Default black/white palette values, new blank paper, bundled page ink and new-page
paint defaults are now #000000/#ffffff. Existing saves and deliberately colored
ink/backgrounds are preserved. Study captures remain design references.

The main app no longer exposes developer workshop controls: the editor ribbon
button, revision/export dialog, settings toggle and ephemeral authoring route are
removed. Keep development/review tooling standalone. User page import/export and
save-as-coloring-page remain, including existing custom pages and their storage.

The saved-picture Add to coloring pages action uses the custom curved open book.
A matching custom page changes plus to a muted disabled check, derived from saved
layout content so it survives navigation/reloads. Paint, paper color and metadata
are ignored; sticker transforms, order, ink and page dimensions determine a match.
Failed additions leave the action available; deleting the matching custom page
restores it. No extra save-format fields or browser tracking records are added.

The color selector implements study 01: five 32-slot palettes, three-dot selector,
custom edit mode, solid HSV/hex picker and shared use by painting/sticker ink.
Version-1 fixed slots 0?127 use Everyday/Pastel/Vivid/Moody; custom slots 128?159
start null and belong to each drawing. Compact negative color tokens encode the
slot index as `-slot-1`, distinct from literal RGB paper/source art. Production
painting and chosen ink use slot tokens; merging compares tokens, never resolved
RGB. Palette edits capture one previous table value, invalidate display pixels
without rebuilding geometry, participate in undo and action-based saving, and
update ribbon/cursor colors. All serialized drawings include paletteVersion 1 and
32 custom entries. PNG/SVG/PDF/print resolve colors; page sharing v4 carries custom
ink tables. New storage namespaces are library-v9, workshop.v3 and v6.coloring;
format-5 saves and v3 sharing codes are intentionally unsupported. Blank paper
setup retains its simple fixed RGB background palette.

Icon redesign is **deferred at the user's request**. The app's original icons and
button styling are restored to their pre-redesign state (`11ea35b`): standard
Lucide delete/print/export controls and the original custom open-book plus/check.
No new icon trial is active. Other features and artwork are unchanged.

Keep the exploration assets for future inspiration: seven ImageGen boards, the
Paper Charms printer study and the actual color-mask/Potrace book proof under
`docs/icons/`. The compact Enchanted Ink SVG sources remain under
`art/source/interface/`; the earlier smooth Paper Charms SVGs are preserved under
`art/source/interface/icon-studies/paper-charms/`. Neither set is imported by the
app. Bulk raster/draft work remains parked under ignored `work/`; do not resume
icon generation or rollout without a new user request. `docs/icons/index.html`
once again records the original 135 uses/states, 15 groups and 61 Lucide imports.

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
(copy code/download the same code as a .studioodle text file) and custom-only Delete. Imports create independent IDs. Portable codes use studioodle-page:4: and carry sticker layouts and ink colors without paint fields; internal books/storage remain JSON.
The dedicated Edit Page action is removed; normal open/arrange/save-as-page is the
user authoring route. All current custom templates consolidate into the workshop
record on the next successful atomic write; failed writes preserve original data.
Existing source keys are read-only and ignored once that record is authoritative.
See [coloring books](COLORING-BOOKS.md). Simple/toddler modes and parent lock remain
future work. Blank paper setup now also uses the approved two-step layout: bold size marks
inside folded paper silhouettes, icon-only orientation/navigation, clickable
paper/color step icons, a selected-paper/color summary and the shared magical
drawing action. Physical sizes and automatic/manual orientation behavior remain
unchanged. Blank setup shows all 32 colors; the editor shows all 32 slots of the selected palette.
Other editor/settings/output overlays still await refinement.

[Design brief](OVERLAY-DESIGN.md) and [layout examples](overlay-examples/README.md)
record the review. No new scene artwork or blanket asset processing was included.

The implemented brush overlay follows approved study 04 in `docs/brush-overlay-examples/`:
one brush with round, two fixed diagonal and opaque scattered-circle tip effects.
A full-width 1-64 size control sits below one compact segmented tip selector;
a smaller muted gold/teal sample has a matching shallow well beside Apply. The
size row stays unboxed and there is no divider. Tip and preview wells follow the
existing overlay grouping language without enclosing every control.
Scattered circles accumulate geometrically,
without transparency or blending. The old ink/pencil/brush modes are replaced by tip effects. Size supports single-unit steps, direct numeric entry and a slider; the default remains 5. Paint is still saved as vector geometry, with no save-format change. Earlier captures remain for visual comparison.

Brush/eraser gestures can now start in the surrounding drawing workspace and
continue onto the page, with page clipping, single-action undo and cancellation.

Tool/menu cursors use one theme-independent palette with dark contours and a fine
light edge for mixed canvas backgrounds; brush/bucket accents keep selected paint.

Bucket results now publish fully compacted geometry before display, preventing
temporary old-color fringes that previously vanished after cleanup and redraw.

Temporary hold-to-fill zoom preserves the exact pointer anchor without pan
clamping, including through layout updates; release/cancellation restores the view.

Editor saves now run after completed artwork actions, including undo, with no minute
timer. Untouched pages, canceled gestures and tool/color choices do not start saves.
Detached checkpoints share immutable geometry; worker compaction and IndexedDB
writes run independently of editing. The app-level queue retains one active and
one latest pending checkpoint per drawing, survives Home/canvas disposal and supplies
pending previews/reopens. Failures retry with bounded backoff and an app-wide notice.
Drawing and summary remain atomic; losing the latest pending actions on abrupt
shutdown is acceptable. Home finishes input without waiting for disk; Ctrl+S and
normal desktop close can flush. See architecture and the picture-library guide.

Selection now switches directly between clicked stickers. Empty page/workspace
presses outside the border clear the drawer and return to Fill on release, consuming
the pointer stream; cancellation restores selection and focused mode retains Done.
Save preparation reuses immutable compacted regions until their paint changes,
including safe invalidation on undo. Live maintenance reuses prepared results
instead of forcing duplicate work at gesture end. Saving yields the input task;
save completion/status no longer restarts the saved-picture loader/previews.
`npm run test:save` verifies eight geometry edits only compact existing paint once.

## Next work and verification

The core feature mechanics are now considered complete for the 1.0 direction.
The user reports positive parent/child testing and wants release readiness next,
not more main-app tooling. [Refinement tasks](REFINEMENT-TASKS.md) is the single
ordered release backlog: (1) performance/reliability, (2) one friendly, playful/zen
custom icon and ribbon/overlay control family in both themes, (3) 1,000+ accepted
stickers from the current 364, (4) a much larger solo-page and composed-scene library
from the current six pages, and (5) structured beta/release validation.

The next implementation batch is storage and the selection page, as recorded in
the performance section of REFINEMENT-TASKS.md: remain web-first with centralized
IndexedDB persistence, move custom pages and then app preferences off localStorage,
and persist revision-aware raster thumbnails generated lazily on gallery cache
misses. Preserve current custom pages during the transition; standalone reviewer
storage stays untouched. Compare bounded two-stage downsampling with direct rendering.
Measure 1,000/5,000-picture libraries and operation-specific gains against the user's
10x ambition. SQLite is a later native-platform option, not current implementation.
These are agreed planning directions; no storage/thumbnail code has changed yet.

After that batch: reproduce/profile scatter/spray and dense paint using the user's detailed
Moon Sorceress when available, a synthetic stress drawing and a simple control.
Other reported problems are slow detailed-canvas fills, panning and saved-gallery
loading/cycling. The user previously saw slowdown even after reverting save changes;
do not assume a save/worker cause without measurement. Keep diagnostics standalone.
Set minimum-device workloads and measurable budgets before choosing optimizations.

Canvas app changes remain planning work in the same backlog:
trial per-surface spray overlays excluded from bucket topology, larger/fewer dots,
compact circle particles rendered with Canvas primitives and bounded raster display
caches. Keep the numeric document authoritative and SVG for source/import/export;
live painting already avoids per-shape SVG DOM. Investigate moving live pan/zoom
out of React state and reusing cached pixels during navigation. Resolve brush/spray
ordering, eraser scope, confinement, appearance, sustained-growth limits and output
quality before implementing the affected behavior. No second paint engine or
pixel-only authoritative spray format is planned.

The standalone cell-brush demo lives under `tools/cell-brush/`; run `npm run cells`
on port 1434. It stays 100 x 100 cells with eight palette slots and three bytes per
cell (29.30 KiB), transparent paper, diameter/grid controls, repeatable test strokes
and circle dabs. The new default is Straight cuts: 16 of 32 base slots, with neighbor
matching off. Empty/full, quarter/half splits, ten corner wedges and two opposite-
edge cuts cover all 80 quarter-edge straight boundaries under transforms/color
swaps. Remaining slots are reserved. The experimental 32 and original eight remain
in the dropdown; switching clears the page and resets matching to that mode's default.

Straight mode now analytically intersects the swept round brush with grid edges.
Each physical edge has one shared per-gesture colored-interval record; cached
quarter crossings determine the cell profile directly via an endpoint index.
Coverage chooses the side colors, not alternative exits. Degenerate same-border
or collapsed-corner cuts become uniform; contour segments may lie on grid edges.
The sampled scorer/neighbor solver remains only for unsupported complex crossings.
This replaces independent whole-edge-mask fitting for simple outside contours.
The user's reported teeth concern these outside contours, not overlapping-dab
cusps; do not conflate them. Tests cover analytic intersections, shared exits,
full-to-3/4 alignment, curves, orientations, rounding ties and the 384-dab sweep.
One-cut/two-color limitations still apply to tiny or conflicting detail.

All gesture samples and analytic edge intervals release afterward. Cell data is
unchanged. Both loaded libraries/shared numeric lookups remain 79.75 KiB; cut-index
maps, polygons/Path2D objects and transient interval records are additional. See
the tool README for limits. Matching is off by default for the straight library.

No source-art conversion, main-app engine change, native build or measured speedup
claim is included. `cells:typecheck`, `cells:build` and `test:cells` verify the isolated
tool; generated output/captures stay under ignored `work/`. The user runs the dev
server manually; do not leave a server running after automated tests.

Thin contour investigation now provides repeatable diameter-one arc/spiral fixtures,
a grid-phase slider and optional per-cell diagnostic capture/inspection. Inspect
actual orange crossings, snapped blue crossings, selected profile and actual fit
route alongside eight neighbors. Capture must be enabled before hand drawing;
inspection clicks do not paint. Latest per-cell copies survive gesture end only
when opted in, release on clear/library change/disable, and add memory beyond the
display counters (including a 300 x 300 inspector canvas). Generated open arcs
pass monotonicity at eight offsets; the user's hand-drawn spikes are not reliably
reproduced yet. Do not assume multi-crossing counts prove the pictured cause.
No new profile, snapping offset or fallback algorithm change was made in this step.

The demo now has a Compare coverage selector: cells, a separately rendered round-
brush reference, and a visual difference overlay. Every incoming gesture/example
also updates a fixed 1000 x 1000 Canvas2D reference (3.81 MiB extra, reported in
display memory); there is no input log and it never changes authoritative cells.
Clear/library switches reset both; draw/resize work in comparison views. The overlap
example demonstrates genuine pointed arc-intersection gaps in the reference as
well as cell approximations. A round brush does not guarantee rounded union/gap
intersections. This instrumentation does not establish another geometry fix or
isolated performance result; use it to reproduce before changing profile rules.

Solo coloring pages should fit visible subject bounds and preserve proportions,
with intentional margins and orientation. Roughly 80% of suitable stickers is a
curation target, not a mandate to publish boring or awkward subjects. Keep composed
scenes as a separate content stream and the canonical bundled layouts in coloringBook.json.
The book-plus/check pair should pilot more organic, slightly asymmetric custom
icons with restrained sparkle; preserve clear meaning and avoid decorative noise.
Existing engineering findings, reviewer protections, palette/undo/save behavior,
physical-device checks and the explicit-native-build rule remain in force.

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
