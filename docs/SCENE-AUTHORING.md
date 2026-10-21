# Coloring-page authoring

The single source of built-in page layouts is `src/assets/coloringBook.json`.
Do not create parallel scene-builder modules or hand-maintained copies of those pages.

## Choose artwork

Run `npm run assets:catalog`, then open `work/catalog/index.html` or read
`work/catalog/index.json`. The index contains asset IDs, source paths, descriptions,
roles, dimensions, bounds and the bundled pages using each asset. `art/scene-kits.json`
contains suggested collections. Assets have one subject category, independent of theme.

## Compose a page

Use the app's coloring-page workshop to arrange and export a page, or edit a copy
of the current book JSON. Book format is 2 and document/picture format is 5.
See [the workshop and schema](COLORING-BOOKS.md).

The first surface is the canvas; subsequent surfaces are stickers in back-to-front
order. Each sticker uses its manifest ID as `kind`, with a unique instance `id`,
center position `x`/`y`, optional uniform `scale`, `rotation`, `flipX` and `flipY`.
Page width and height are independent of the window. Scaling artwork preserves aspect.

Start with background/interior/horizon stickers, then larger subjects, then accents.
Keep faces and limbs clear, leave space around subjects, and use off-page clipping
only deliberately. Check both visible bounds and logical sticker dimensions.
Templates contain unpainted geometry, black outlines and a white canvas.

## Validate and preview

```sh
npm run books:install -- path/to/reviewed-book.json
npm run assets:preview -- <page-id>
npm run assets:catalog
npm run check
```

Installing replaces the complete bundled collection; use a complete reviewed book.
The preview tool reads that same JSON and writes `work/scenes/<page-id>.svg` and PNG.
Omit the ID to render every bundled page. Inspect clipping, tangencies, overlap and
visual density. Metadata catalog generation updates page-usage references.

The preview command requires ImageMagick; it does not build the app or native host.

## Add or change stickers

Edit `art/stickers.json` and the accepted original source under
`art/source/stickers/<pack>/`. IDs, titles, category, sort order, descriptions, tags,
roles, detail, facing and placement notes belong in the manifest. Convert a changed
asset with `npm run assets:build -- <asset-id>`; use `assets:catalog` for metadata-only
changes. Review generated region boundaries before rebuilding a whole pack.
