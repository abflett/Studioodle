# First-Pass Conversion Review

The library now contains 364 stickers across 10 categories. The latest pass converts 96 PNG sources: 48 fantasy assets and 48 interiors. Earlier conversion notes below remain useful for visual review.

[Searchable SVG gallery](catalog/index.html) ? [Conversion statistics](conversion-report.json)

Use the asset ID shown in the catalog when reporting flaws. Review line quality, white areas that should be transparent, missing fill regions, and tiny regions. Letter counters, handles, wheel spokes and gaps between overlapping limbs deserve particular attention. This conversion pass does not certify every enclosed white area as intentional.

## Source review notes

- **alphabet:** A astronaut: helmet makes the silhouette more costume-heavy; review letter recognition.
- **alphabet:** V viking: belt/tunic softens bottom point; review silhouette before conversion.
- **alphabet:** All sources require region/cutout review during later SVG conversion.
- **category-expansion:** Sandwich: simplify excess small bread texture marks during conversion.
- **category-expansion:** Toy Blocks: remove or simplify fine wood-grain lines during conversion.
- **category-expansion:** Fire Engine: generated with a friendly windshield face; keep as a characterful vehicle or remove face at vector cleanup if a plain vehicle is preferred.
- **category-expansion:** Windmill: review sail lattice region ownership; gaps should reveal the background where appropriate.
- **category-expansion:** All sources need the normal region/cutout review before app registration.
- **collection-expansion:** Stegosaurus: only three tail spikes clearly visible; add/rework fourth at cleanup.
- **collection-expansion:** Child Using a Wheelchair: simplify fine spokes where needed; preserve open spaces and chair/limb separation.
- **collection-expansion:** Seabed Horizon: retain complete square viewBox and blank water area; proposed logical size 1200 x 1200. Scenery continues off sides; region closures need normal horizon handling.
- **collection-expansion:** Seabed Horizon: more foreground contour lines and rocks than requested; optionally simplify for quieter composition.
- **collection-expansion:** Pteranodon is a pterosaur, grouped with dinosaurs as a theme only; Animals remains the subject category.
- **collection-expansion:** Every source requires region/cutout review during later SVG conversion.

## User-Supplied Dinosaur Illustrations

All three original JPEGs were located in Downloads/pics, copied into art/source/dinosaurs, and converted as separate Animals variants: Spotted Long-Neck Dinosaur, Striped Tyrannosaurus, and Spotted Triceratops. The tyrannosaurus retains its ground patch. The live library now has 268 assets.

## Horizons

25 new square horizons (24 landscapes plus seabed) retain their full 1200 ? 1200 logical canvas. Transparent sky is preserved and ground closes at the canvas boundaries. Initial width uses 1.2 overscan; adjust vertical placement after adding.

Birch Woodland required an explicit sky seed and a one-unit analysis-only gap closure; its ground is now paintable. Detailed canopy and trunk gaps still warrant normal visual review.

## Fantasy and Interiors

All 96 PNGs are converted to single region SVGs and registered in the app. IDs use `fantasy-` and `interiors-` prefixes. Browse the searchable catalog for final art and the source galleries for PNG comparisons.

- 48 fantasy assets: adventurers, magical folk, creatures and props.
- 48 interiors: 16 full-canvas backgrounds and 32 isolated props across eight settings.
- Interior backgrounds preserve paintable walls, ceiling and floor, with no outdoor-sky removal. They start centered behind stickers, covering the page with 5% overscan.
- Basket/tankard handle openings and office-chair arm gaps have explicit transparent cutouts. Other detailed negative spaces still warrant visual review.
- Some fine wood grain, masonry and costume detail remain; tiny regions and decorative gaps can be refined during the user review pass.

All 96 definitions passed browser load, hit coverage and save/restore checks. Interior backing and page coverage passed in square, portrait and landscape; authored cutouts were confirmed nonpaintable. Project tests (15), typecheck, lint and production build passed. See [validation data](fantasy-interiors-validation.json). The Windows installer has not been rebuilt.
