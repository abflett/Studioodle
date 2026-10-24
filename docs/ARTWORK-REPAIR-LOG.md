# Artwork repair log

## Pass 1 — 2026-10-23: explicit transparency corrections

Input: [original review export](studioodle-artwork-review-2026-10-23.json). All 364 asset checksums matched before editing. The original file is retained byte-for-byte. The [progress ledger](studioodle-artwork-review-2026-10-23.progress.json) contains every flagged asset, marker ID, original coordinate, original region ID, note, outcome, seed and checksum. Read this log first; consult only the relevant ledger entries for a future pass.

- Fixed **181 markers**, representing **180 distinct regions** across **94 assets** (one duplicate region request).
- One marker was already transparent and is retained as a negative-space constraint.
- **90 markers deferred**: 89 add/fill requests and one conflicting removal in fall-wheat-sheaf.
- All original source artwork and all shipped line art remain unchanged. Repairs live as negative-space seeds in art/stickers.json, so future conversion reproduces them.
- One fall-pumpkin-wagon marker lay on ink above its extended region path. Its seed moved inward to a verified white point in the same region; the original marker coordinates remain in the ledger.
- General asset notes remain open, including the cradle-tree linework and ranger bowstring. A fixed cutout on an asset does not mean its other issues are fixed.

## Effort / token-use assessment

These are **relative attention grades**, not measured token counts or billing. Per-operation token telemetry is unavailable. Converter runtime and file size do not measure AI token use. Do not invent precise per-fix token figures from this pass.

| Task type | Grade | Evidence / recommendation |
| --- | --- | --- |
| Build review ingestion, targeted rebuild and audit tooling | Medium, one-time | Most of this pass's AI attention went into reusable setup and verification rather than individual region edits. Future cutout passes can reuse it. |
| Remove a known isolated region | Low | This pass batched 180 regions using one geometric rule. Prefer this workflow for explicit reviewed cutouts. Marginal AI attention per additional marker is small. |
| Deduplicate markers / detect already-transparent space | Low | Script found one duplicate and one already-satisfied marker. No redraw or image generation. |
| Move an ink-edge cutout seed inward | Low | One local geometry/white-pixel check and one targeted retry; original region identity unchanged. |
| Close one clear gap / extend one line | Medium (estimated) | Not attempted in this pass. Needs a crop, endpoint selection, local vector correction, rebuild and visual verification. Trial one asset before pricing a batch. |
| Resolve conflicting add/remove intent | Medium (estimated) | One wheat-sheaf region contains both kinds of request. Discuss before modifying geometry. |
| Repair multiple open leaves, hair strands, limbs or overlapping objects | High (estimated) | Needs semantic choices and repeated visual verification. Birch woodland (22 markers), cloud serpent (11), trees and dense foliage are poor candidates for blind batch closure. |
| Replace / regenerate complicated artwork | High / separate decision | Compare a small repair trial with replacement quality and source preservation. No image generation was used here. |

The reusable planner, targeted rebuild and validators cost setup attention once. This makes repeated cutout passes much cheaper than treating every marker as an independent image-editing conversation. Deferred grades remain provisional until a bounded trial is approved.

## Validation and scope

- Rebuilt only the 94 affected assets with two isolated converter processes. All completed; one seed-placement failure was corrected and retried.
- Geometry audit: zero unresolved tiny regions, contiguous IDs and one connected outer contour per region.
- Repair audit: exactly 180 fewer regions; every cutout point is transparent; each unmarked region retains its interior; ink commands are byte-identical; source and review checksums match.
- Reviewed four before/after contact sheets on a dark background. [Local gallery](../work/artwork-repair-pass/review.html), diagnostics and render sheets stay under ignored work/.
- All 72 unit tests, type checking, lint, the web production build and full browser suite passed. Browser regressions check cutout hit maps on representative repaired assets, including the ink-edge seed adjustment.
- Runtime region IDs changed. The normal development drawing database now uses studioodle-library-v3, avoiding old colors applying to shifted IDs. Older drawing databases were not deleted.
- The artwork inspector's storage key and browser review progress are untouched. Existing inspector notes for changed assets remain on their original revision and may show the expected changed-asset warning. The exported review is historical evidence; use this ledger to determine what remains. No markers were silently erased from browser storage.

## Next pass — discuss before implementation

### Tooling follow-up: explicit closure proposals

The inspector now exports user-defined A/B endpoints, a quadratic curve, line
width and an optional fill seed. Wheel zoom is anchored at the cursor. See
[the closure instructions](ARTWORK-REVIEW.md#proposing-line-closures). This was
another one-time tooling investment, graded Medium; it should reduce endpoint
interpretation in future repair passes, but no per-repair token saving has been
measured yet. No additional artwork repairs were applied by this tooling change;
the completed/deferred counts in this log and progress ledger are unchanged.

For the next small trial, prefer a user-authored closure export over guessing
endpoints from a point marker. Apply the supplied geometry offline, regenerate
regions and verify its fill seed before expanding to a batch.

Start with one isolated closure, such as an engine pocket on space-spaceship or a single hair gap. Inspect a crop and establish explicit endpoints; compare correction effort and resulting region quality before expanding. Avoid blanket morphology, which can close intentional negative spaces.

Preserve the transparent constraint near Moon Sorceress hair. Do not turn the 22 birch-woodland markers into 22 independent speculative edits: discuss a small representative repair or replacement first. Decide the wheat-sheaf add/remove conflict before changing that region.

| Asset | Deferred markers | Estimated effort | Instructions / discussion |
| --- | ---: | --- | --- |
| space-spaceship | 2 | Medium | Requires locating and interpreting source line breaks; marker coordinates alone do not define a safe closure. |
| alphabet-c-cat | 2 | Medium | lines not connected so tail does not build a region; missing line to complete the arm and paw, we need to add a line and close gaps to make this an arm |
| alphabet-u-unicorn | 1 | Medium | missing a line to complete the arm and fill |
| nursery-rhymes-friendly-spider | 1 | Medium | missing closing of the web so we can fill. |
| nursery-rhymes-shepherd-child | 2 | Medium | close line so we can fill hair |
| nursery-rhymes-cradle-tree | 0 | High | Many broken lines or at least one thats preventing proper regions. point this out after the fix for re-inspection. |
| nursery-rhymes-jack-be-nimble | 2 | Medium | close line so hair can fill; close line so arm and cuff can fill |
| nursery-rhymes-storybook-fiddler | 1 | Medium | close line so we can fill the arm |
| nursery-rhymes-garden-child | 1 | Medium | needs line so we can fill the shoelace |
| fall-pumpkin | 1 | Medium | close line so we can color the leaf more easy |
| fall-scarecrow | 1 | Medium | close line so we can fill the straw strand |
| fall-autumn-tree | 1 | High | Needs overall line fixing so leaves and tree are closed and have proper regions. |
| fall-harvest-basket | 1 | Medium | close line and fill leaf |
| fall-hay-bale | 1 | Medium | fix open lines and fill side of hay cube. |
| fall-wheat-sheaf | 4 | Medium | close line so we can color the leaf; close line so we can fill leaf |
| fall-raccoon | 5 | High | close lines so we can fill areas like the snout/cheaks, head, chest and leg |
| fall-badger | 3 | Medium | close line so we can color the tail, body and face/eye patch. |
| horizons-forest-clearing | 1 | Medium | fill broken line to fill tree |
| horizons-jungle-opening | 1 | Medium | fill line so we can fill tree leaf   |
| horizons-birch-woodland | 22 | High | Many broken lines, as I'm sure it's just the type of line art, but if difficult to fix we should remove or create a new image like this but make sure there are regions to color. I assume we can close lines but might token use might make more sense to image gen this with a better version. |
| horizons-beach-dunes | 1 | Medium | clean this area but a tad so we can fill this little hill tip |
| category-expansion-octopus | 5 | High | complete the lines so we can fill the arms correctly |
| collection-expansion-pet-dog | 3 | Medium | fill the add regions by closing the lines and adding the regions etc. |
| collection-expansion-child-wheelchair | 2 | Medium | close the line for the hair so we can fill |
| fantasy-moon-sorceress | 3 | Medium | close lines so we can fill hair, the make transparent is a clue for this to keep that way in that enclosed area. |
| fantasy-wandering-wizard | 1 | Medium | close line so we can fill hair |
| fantasy-woodland-ranger | 0 | Medium | needs a straight line for the bow string, just behind the artwork so it doesn't stand out and doesn't need to be thick, just a black line art will work. |
| fantasy-potion-alchemist | 3 | Medium | close and fill region for hair; close and fill region for face; close and fill region for hair part just flowing into another strand maybe. |
| fantasy-forest-elf | 2 | Medium | fill 2 line parts to complete hair strands.; filling the hair strand should close this region for the shirt. |
| fantasy-three-headed-hydra | 2 | Medium | close line so we can fill the head and horn area's |
| fantasy-cloud-serpent | 11 | High | many lines left open. close them and should reveal fills/regions |
| fantasy-forest-treant | 3 | High | fill broken lines to create fills and regions of the leaves. |
| interiors-office-chair | 1 | Medium | close line so we can fill the arm part |

## Completed assets

All entries below are **Low** effort cutout corrections. Full marker IDs and coordinates are in the progress ledger.

| Asset | Regions removed |
| --- | ---: |
| counting-03 | 1 |
| counting-04 | 2 |
| counting-07 | 1 |
| counting-09 | 1 |
| animal-zebra | 1 |
| alphabet-b-bee | 2 |
| alphabet-d-dragon | 1 |
| alphabet-f-firefighter | 1 |
| alphabet-l-lion | 3 |
| alphabet-m-monkey | 1 |
| alphabet-o-octopus | 1 |
| alphabet-p-pirate | 1 |
| alphabet-q-queen | 1 |
| alphabet-r-robot | 1 |
| nursery-rhymes-baby-cradle | 8 |
| nursery-rhymes-fiddle-cat | 1 |
| nursery-rhymes-jack-pail | 1 |
| nursery-rhymes-jill | 1 |
| nursery-rhymes-stone-well | 4 |
| nursery-rhymes-rowboat | 1 |
| nursery-rhymes-friendly-bus | 2 |
| nursery-rhymes-farmer | 1 |
| nursery-rhymes-barn | 1 |
| nursery-rhymes-royal-horse | 2 |
| nursery-rhymes-baa-baa-sheep | 3 |
| nursery-rhymes-schoolhouse | 1 |
| nursery-rhymes-miss-muffet | 2 |
| nursery-rhymes-little-teapot | 1 |
| nursery-rhymes-baker | 1 |
| nursery-rhymes-candlestick | 1 |
| nursery-rhymes-mother-goose | 4 |
| nursery-rhymes-storybook-kettle | 1 |
| nursery-rhymes-storybook-fiddler | 1 |
| nursery-rhymes-singing-blackbird | 1 |
| nursery-rhymes-porridge-pot | 2 |
| nursery-rhymes-garden-bells | 2 |
| nursery-rhymes-garden-child | 1 |
| fall-pumpkin | 1 |
| fall-squirrel-acorn | 1 |
| fall-apple-basket | 1 |
| fall-wheelbarrow-leaves | 2 |
| fall-harvest-basket | 1 |
| fall-rake | 1 |
| fall-wheat-sheaf | 5 |
| fall-pumpkin-wagon | 4 |
| fall-mushroom-cluster | 2 |
| fall-autumn-scarf | 1 |
| fall-mittens | 1 |
| fall-harvest-lantern | 1 |
| fall-apple-picking-child | 1 |
| horizons-snowy-forest | 1 |
| horizons-autumn-woodland | 2 |
| category-expansion-farm-tractor | 2 |
| category-expansion-fire-engine | 9 |
| category-expansion-propeller-airplane | 1 |
| category-expansion-fire-station | 1 |
| category-expansion-lighthouse | 2 |
| collection-expansion-pet-dog | 1 |
| collection-expansion-farm-pig | 1 |
| collection-expansion-child-wheelchair | 5 |
| collection-expansion-firefighter | 1 |
| collection-expansion-gardener | 2 |
| collection-expansion-branching-coral | 2 |
| collection-expansion-triceratops | 1 |
| collection-expansion-stegosaurus | 6 |
| dinosaur-striped-tyrannosaurus | 1 |
| fantasy-wandering-wizard | 1 |
| fantasy-armored-warrior | 2 |
| fantasy-woodland-ranger | 1 |
| fantasy-dwarf-guardian | 2 |
| fantasy-human-bard | 2 |
| fantasy-hooded-scout | 1 |
| fantasy-potion-alchemist | 2 |
| fantasy-goblin-tinkerer | 3 |
| fantasy-merfolk-explorer | 2 |
| fantasy-centaur-guide | 3 |
| fantasy-stone-giant | 1 |
| fantasy-kindly-orc | 1 |
| fantasy-woodland-gnome | 3 |
| fantasy-griffin | 4 |
| fantasy-phoenix | 1 |
| fantasy-pegasus | 1 |
| fantasy-unicorn | 1 |
| fantasy-cave-bat | 2 |
| interiors-tavern-stool | 4 |
| interiors-arched-hallway | 1 |
| interiors-hall-bench | 4 |
| interiors-wall-banner | 2 |
| interiors-wall-torch | 2 |
| interiors-arched-window | 4 |
| interiors-cottage-kitchen | 1 |
| interiors-cooking-pot | 2 |
| interiors-office-chair | 3 |
| interiors-bedside-table | 3 |

## Reproduce / continue

See [the sticker pipeline](STICKER-PIPELINE.md#repairs-from-an-artwork-review) for planning, selected rebuild, resume and validation commands. The completed stage is work/artwork-repair-pass/. Do not rerun the original export as though its checksums describe repaired files. For future operations, start from the ledger's after checksum or a fresh export, and retain the old marker IDs as provenance.

## October 24 - explicit line closures, version 2

Applied `studioodle-line-repairs-2026-10-24-line-repair.json`: **191 lines across
31 assets**, merged into one compound ink path per asset before rediscovering
regions. **2,975 -> 3,111 regions** in the target set; existing cleanup closed
24 tiny pockets with zero unresolved pockets. All marker requests and fill seeds
were ignored; previously accepted cutout seeds were retained. The two exported
assets without closures were left unchanged.

Original source artwork and the submitted review remain intact. Accepted editable
ink sources and the manifest make rebuilds reproducible. Per-asset hashes, applied
line IDs, region totals and pocket cleanup counts are in
[the line repair ledger](studioodle-line-repairs-2026-10-24.progress.json).
Before/after diagnostics and the clean geometry audit are under ignored
`work/line-repair-2026-10-24/`. Cradle Tree, Autumn Tree, Birch Woodland and Cloud
Serpent particularly need the requested region inspection after their many closures.

Effort: **low incremental AI attention per closure** once exact endpoints and
widths are supplied; one script processed all 191. Curve outlining/union and region
tracing consumed local compute rather than per-image prompting. Pipeline setup,
validation and inspector integration were the main fixed effort. Exact token
counts are not available, so this is an effort grade rather than token telemetry.
Remaining decisions about incorrectly enclosed white/transparent areas are deferred
to the next inspection; no semantic add/remove inference was made in this pass.

## October 24 - follow-up line pass (v2 export)

Applied `studioodle-line-repairs-2026-10-24v2.json`: **four additional curves**,
one on Badger and three on Birch Woodland, unioned into their already-repaired
compound ink. Badger: **27 -> 28 regions**; Birch Woodland: **143 -> 145**.
No point markers or fill seeds were applied, and no new tiny pockets needed cleanup.
Birch Woodland's old analysis-only `analysisGapClosure` setting was removed so
region discovery follows the now explicitly repaired ink rather than hidden raster
closures. Existing cutouts and all earlier line repairs were retained.

The previous exports and progress ledger remain unchanged. The additional ledger
is [studioodle-line-repairs-2026-10-24v2.progress.json](studioodle-line-repairs-2026-10-24v2.progress.json).
The inspector still offers the full 31-asset inspection set, reconciles both line
passes, retires only applied line IDs, and preserves markers, notes and later
unsubmitted lines for the upcoming fill/transparency pass. Original source art and
all 29 untargeted runtime SVGs are unchanged. Diagnostics are under ignored
`work/line-repair-2026-10-24v2/`.

Effort remains low per explicit closure; all four were processed by the existing
script. The fixed work was audit, spotting the old analysis-only closure setting,
and extending ledger reconciliation to handle repeated repairs of the same asset.

## October 24 - v3 lines followed by marker repairs

Input: `studioodle-line-repairs-2026-10-24v3.json`, retained unchanged.
Applied **13 new line closures** first: Birch Woodland 6, Moon Sorceress 2,
Forest Elf 5. Their regions increased **541 -> 552**, with no new tiny pockets.
All four add/fill markers on the elf now lie inside newly enclosed regions;
white-pixel checks confirmed fill coverage at all four points.

Then remapped marker coordinates against the promoted line geometry, rather than
reusing old region IDs. Applied **56 distinct transparency requests across nine
assets** as reproducible cutout seeds: Shepherd Child 1, Autumn Tree 6, Harvest
Basket 3, Wheat Sheaf 3, Forest Clearing 10, Jungle Opening 6, Birch Woodland 24,
Moon Sorceress 1, Woodland Ranger 2. The marker stage reduced **1,102 -> 1,046**
regions. No requests remain deferred. Its validation confirms byte-identical ink,
exactly 56 removed regions, transparent seed points, preserved interiors for every
unmarked region, and unchanged original sources/review. Existing deterministic
small-pocket cleanup reran without changing the shipped ink.

The separate [line ledger](studioodle-line-repairs-2026-10-24v3.progress.json) and
[marker ledger](studioodle-marker-repairs-2026-10-24v3.progress.json) record both
revision steps, original/refreshed marker region IDs, cutout seeds and all applied
instruction IDs. Diagnostics are in ignored `work/line-repair-2026-10-24v3/` and
`work/marker-repair-2026-10-24v3/`. Previous exports, ledgers, repairs and the full
31-asset inspection set remain available. Applied markers/proposals retire on
revision refresh; later annotations and notes remain intact.

Effort: **low per submitted instruction**. One line batch, one geometric marker
remap and one cutout batch handled all 73 instructions. No manual line inference,
seed movement or semantic redraw was needed. Exact token telemetry is unavailable;
the fixed effort was validation, proof inspection and recording the revision chain.

## October 24 - v4 repairs and two recent histories

Input: `studioodle-line-repairs-2026-10-24v4.json`, preserved unchanged. Applied
**13 lines across five assets** first (Cradle Tree 1, Badger 1, Birch Woodland 6,
Forest Clearing 3, Forest Elf 2), then remapped markers to those rebuilt regions.
The line-stage region total increased **489 -> 499**. Existing cleanup removed one
tiny new pocket on Badger, retaining the established minimum clickable-region size.
All **five fill requests** landed in newly enclosed white regions (verified at their
coordinates). Applied the **four transparency requests** on Shepherd Child, Jack Be
Nimble and Forest Elf; the marker-stage total decreased **320 -> 316**. Validation
confirmed byte-identical ink in the marker stage, transparent cutout seeds, unchanged
original sources and retained interiors for all unmarked regions. Nothing deferred.

The [line ledger](studioodle-line-repairs-2026-10-24v4.progress.json) and
[marker ledger](studioodle-marker-repairs-2026-10-24v4.progress.json) keep separate
revision steps and exact applied IDs. Diagnostics are in ignored
`work/line-repair-2026-10-24v4/` and `work/marker-repair-2026-10-24v4/`.

The inspector now exposes **History 1: seven assets changed in v4** and
**History 2: ten assets changed in v3**, replacing the cumulative 31-asset rebuilt
linework filter. Each future pass should rotate these two recent sets. Older exports
and ledgers remain unchanged for provenance; the chronological revision graph still
reconciles older annotations without replaying applied lines or markers. Exports,
keyboard navigation and automatic selection follow the chosen history.

Effort: low per explicit instruction; the existing scripts handled all 22 line and
marker instructions. Fixed effort in this pass was splitting recent browse histories
from the complete revision ledger and verifying filter/export isolation. Exact token
telemetry is unavailable.

## October 24 - full-library v5 inspection

Input: `studioodle-artwork-review-2026-10-24v5.json` (all 364 assets), preserved
unchanged. **17 assets changed**, with every submitted instruction resolved.
Applied **13 lines across six assets first** (Shepherd Child 2, Baby Cradle 1,
Schoolhouse 6, Apple Basket 1, Autumn Woodland 1, Fire Engine 2). Line-stage regions
increased **727 -> 741**; established cleanup handled four tiny pockets.

Then resolved **13 transparency markers**, **eight fill markers** and **one alignment
note** against the rebuilt regions. Three fills were already enclosed by the supplied
lines. The other five explicitly reversed earlier cutouts: Spaceship 2, Cave Bat 1,
Office Chair 2. Each add point matched the same enclosed white component as a stored
cutout seed; only those matching seeds were removed. No inferred linework or blanket
restoration was used. All eight fill points were verified white in the final renders.
The 13 cutout-stage targets changed **1,490 -> 1,482 regions** (-13 removals +5 fills).
Cutout-only and restoration validators confirm unchanged ink, requested point states,
original-source preservation, and retained interiors for every unmarked region.

Both Baker cutout markers sat on ink above their propagated region paths. Verified
white seeds in the same regions were selected: (44.7007, 174.395) ->
(44.6875, 174.6875), and (50.2436, 168.5749) -> (50.1875, 168.6875). Submitted marker
coordinates remain unchanged; adjusted seeds and original points are in the ledger.

The Simple Tree alignment note exposed a converter bug: rounded SVG rectangles were
reconstructed with quadratic corners rather than their circular/elliptical arcs. The
converter now preserves exact SVG radius geometry, including separate radius clamps.
Only Tree was regenerated for this correction. A 4x source-alpha comparison improved
from **20,905 mismatched pixels to zero**, with a regression for all four corners and
an inspector browser comparison against the untouched authored SVG.

Separate [line](studioodle-line-repairs-2026-10-24v5.progress.json) and
[marker](studioodle-marker-repairs-2026-10-24v5.progress.json) ledgers retain exact
instruction IDs, source/geometry hashes, restored seeds and outcomes. Diagnostics:
ignored `work/line-repair-2026-10-24v5/` and `work/marker-repair-2026-10-24v5/`.
**History 1 now contains these 17 v5 assets; History 2 contains the seven v4 assets.**
Marker-only repairs now get current repair metadata as well as line repairs. Original
artwork, older repair ledgers and later annotations remain preserved.

Effort: low per explicit line/cutout, medium fixed effort for component-matched cutout
restoration and the rounded-corner converter regression. The existing scripts handled
all 35 instructions; two subpixel seed adjustments required geometric checks. Exact
per-task token telemetry is unavailable. No requests remain deferred.
