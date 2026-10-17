# Cottage garden sticker masks

Source: `art/source/cottage-garden-PAINT-READY.bmp`, provided by the project owner from their Downloads folder.

Regenerate the eight extracted objects from the repository root:

```sh
node scripts/extract-cottage-masks.mjs art/source/cottage-garden-PAINT-READY.bmp
```

The script reads the uncompressed BMP directly. It finds connected black outlines, flood-fills the exterior to separate the object's silhouette, retains internal line details, and copies pixels at their original resolution without resampling. No generated/redrawn artwork is used. Source bounds are retained in `cottageMasks.ts`.

Each object has two bit-packed planes: silhouette coverage and protected outline. This allows a transparent exterior, white editable interior, and a recolorable outline without any partially covered pixels. The SVGs are picker previews generated from the same runs of binary pixels.

Included: sun, right cloud, two butterflies, three apples, upper cottage window. The remaining cottage, apple tree, rainbow, flower beds and mushrooms overlap other artwork and have not been cut out yet. They need individually traced boundaries and, where occluded, deliberate reconstruction rather than rectangular cropping.

The script also writes an ignored diagnostic contact sheet under `work/`.

New stickers use their source crop dimensions: one source pixel is one canvas pixel. Picker thumbnails are scaled only for display. legacyCottageMasks.ts preserves the old fixed-size masks for previously saved stickers and their paint buffers; do not regenerate that compatibility snapshot.

