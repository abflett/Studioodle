# Vector cottage pilot

Checkpoint before implementation: `2c5bec6`, pushed to `origin/main`.

Open **Cottage studio** in the coloring-page picker, or choose the cottage in the **Cottage studio** sticker category. This is an additive pilot. The original cottage garden and other stickers retain their binary definitions. No saved artwork is migrated automatically.

## Composite

`vector-cottage-v1` identifies an immutable definition with native paint dimensions 1312 × 1199. It contains the accepted light-preset vector ink, a traced outer silhouette, binary picking coverage and 89 integer paint-region labels. Raster paint remains per placed instance, using the existing RLE persistence and undo snapshots. The definition ID must change if its coordinate system or segmentation changes in the future.

Each instance renders white base + raster paint clipped by its vector silhouette, followed by vector ink in the instance's outline color. The entire composite follows normal scene stacking and transforms. Brushes may cross internal region boundaries; erasing reveals white. Bucket filling uses both the selected region and connected existing paint color, so a brush stroke can divide a region. Fills and brushes respect visible ownership. Bucket taps on an internal outline use its underlying region assignment; no magnifier or touch assistance is added.

## Display

Documents containing vector stickers use a Canvas2D composite renderer beneath Phaser's transparent input/selection canvas. It redraws the visible viewport at device pixel resolution on paint changes, zoom and pan. Vector ink is evaluated at the displayed transform, not enlarged from a fixed texture. Only the visible viewport gets a display buffer, avoiding huge full-page allocations when zoomed in. Raster paint remains native resolution, and existing raster stickers remain raster. Documents without vector stickers continue through the original renderer.

Saved previews, PNG export and print use the same Artwork compositor at document resolution. Saving/loading validates the new definition's native paint dimensions. Existing version-2 document structure is retained with an additive, explicitly versioned sticker kind.

## Authoring

`node scripts/build-vector-cottage.mjs` freezes the accepted trace and inspection map into `src/assets/vector/cottage-v1.json`. It requires the previously generated region prototype, ImageMagick and Potrace. Native labels are sampled without blending from the 2× inspection map; the builder rejects loss of any of the 89 regions. The bitmap coverage is for picking; the vector silhouette is used for display clipping. No extra smoothing or gap closing is performed on region labels.

The rendered backing silhouette is inset by two native pixels before tracing to
prevent white fringes outside the independently traced ink. This is an inward
boundary offset, not a scale change. Ink, region IDs, picking coverage, native
dimensions and saved paint coordinates remain unchanged.

## User review

App tests and builds are deferred to the user as requested. Useful checks: separate window-pane and roof-tile fills; draw across the wall and canvas then move the cottage; draw across a region and fill either side; erase; resize/rotate; overlap with a second sticker and change order; zoom/pan; undo; Home and reopen; PNG export. This pilot does not convert shapes or other assets, implement named parts, or add magnification.

## Paint density and overlap fills

New background surfaces and vector cottages use `paintDpi: 150`, with scene coordinates
defined at 96 units per inch. Paint buffers therefore contain 150/96 pixels per scene
unit on each axis. Brush sizes, patterns, sticker positions and page dimensions remain
in scene units. Existing saves without density metadata keep their original paint grids;
legacy bitmap stickers retain their original resolution. For example the 1600 × 1200
pilot page exports at 2500 × 1875 pixels. Physical paper-format controls are still deferred.

Bucket filling visits native paint pixels, then pads its boundary up to four scene units
under an overlapping vector sticker. Padding stays hidden, cannot emerge into a different
visible area, and uses the same fill pattern. Reapplying the current background color can
repair an older unpadded fill. This does change a small amount of hidden paint, which may
become visible if the foreground sticker is moved; undo covers the complete operation.

Zoom multipliers are relative to the current fitted page: Fit → 1.5× → 2× → 3× → 4×.
They follow window resizing and are independent of paint density. PNG output uses the
background's density and writes matching pHYs print-density metadata. Export redraws
the vector ink at output scale rather than enlarging a document-size screenshot.

Raster paint on backgrounds and vector stickers is displayed with image smoothing;
integer paint/region values used by fills stay unblended. Near ownership boundaries,
native paint samples are checked against a shared 2× boundary mask sampled offline from
the vector silhouette/ink, rather than the coarser scene-pixel ownership grid. Interior
samples retain the cached fast path. No isPointInPath queries occur during painting.
This removes the scene-grid bottleneck on new fill boundaries without multiplying
the entire ownership buffer. Existing painted edges are not regenerated automatically.

Boundary masks are generated by the cottage builder and decoded on first use, shared
across all placements and undo restores. Moving/scaling/rotating a sticker transforms
the lookup coordinates; it does not resample its definition. Only scene ownership is
invalidated by placement/order changes. A 2624 × 2398 boundary mask occupies 786,544
bytes unpacked as bits. Fill queue/visited buffers are reused for repeated operations
on the same-sized paint surface. Timings and mobile responsiveness still require user
testing; flood filling and raster paint redraw remain proportional to affected data.

As the catalog expands, keep thumbnails/metadata separate from lazily loaded definition
packs, with cache eviction for unused packs. Preloading every sticker at the splash would
increase startup and memory cost without helping fills on the current scene.

Remaining limitation: region labels originate from the fixed native definition and are
sampled without blending for denser paint buffers. Increasing density improves new brush
detail; it does not recreate missing details in older raster artwork. Frame rendering uses
smooth vector boundaries, while picking remains a raster approximation. LocalStorage quota
limitations are unchanged.
