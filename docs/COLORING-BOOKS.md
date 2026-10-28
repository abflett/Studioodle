# Coloring Books and the Page Workshop

Books are offline JSON files referencing shipped sticker IDs. No account, server,
custom sticker embedding or online hub is involved. A recipient needs an app
version containing the referenced stickers.

## Browsing and editing

Open the coloring book on Home. The picker starts with one large preview; tap the
artwork or pencil/book action to start a fresh drawing. Grid toggles a six-preview
overview; tapping a grid page returns to that page in single view. Arrows, left/right
keys and horizontal swipes browse; grid arrows move by batches. The compact count
is relative to the current filters. Filters wrap on narrow screens; previews keep
their original proportions without cropping.

Subject filters are All, Characters, Animals, Places & Nature, Things (vehicles and
objects), and Letters & Numbers. Pages can belong to multiple subjects. Terrain
icons represent Simple, Medium and High detail; tapping an active detail filter
clears it to show any detail. No detail is selected initially. Favorites use a
solid red outline/filled heart, persist in `studioodle.page-favorites.v1`, and have
a separate favorites-only filter. Existing favorites come first on entry/filter
changes; toggling a heart does not reorder the current browsing sequence.

The six bundled scenes have curated optional `browse` metadata in
`src/assets/coloringBook.json`: `{ "categories": ["nature", "animals"], "detail": "simple" }`.
Category IDs are `characters`, `animals`, `nature`, `things`, `learning`; detail IDs
are `simple`, `medium`, `detailed`. Imported/custom pages without metadata get
lightweight subject defaults from sticker categories and a provisional sticker-
count detail band (under 12 / under 24 / 24+). This is not a region-size calculation
or age/ability rating. Further automatic classification needs visual review.

There is no dedicated Edit Page button. Open a page normally, use Select to arrange
stickers, save the drawing, then Save as coloring page from Your pictures. The
optional editor workshop ribbon remains available for Save New Page, revisions of
that session's new page, and export. Ordinary autosave/Home/Ctrl+S save drawings;
they do not revise coloring templates.

## Manual sharing

Single view exposes Add, Share, and Delete for custom pages only. Grid has no
utilities; choose a page to return to single view first.

- Add accepts a pasted `studioodle-page:2:` base64 UTF-8 sharing code, raw book JSON,
  or a JSON file. Validate and preview before adding. Multi-page books are supported.
- Imported pages always get fresh independent IDs, so another user's page cannot
  replace a bundled or device-local revision. Repeated imports create separate copies.
- Share offers Copy Code and Download File for the current page. If clipboard
  access is unavailable, the code is selected for manual copying. Codes encode
  data, not online links; base64 is neither compression nor encryption.
- File export uses browser download or the existing native JSON save adapter.
  Cancelled native saves do not report success. No native build is required for web work.

Templates keep sticker order, position, size, rotation and flips. Paint, paper
colors and outline colors are stripped to black ink on white. JSON does not embed
sticker assets. PNG/SVG/PDF picture exports remain separate from template sharing.
Device-local storage is not a backup; export pages before clearing app/browser data.

## Local storage

`studioodle.workshop.v2` is the authoritative custom-page/revision record. For
existing current-format templates previously saved under `studioodle.v5.coloring.`,
reads combine those pages with workshop revisions without writing. The next
successful save/import/delete writes the complete collection once with a local-only
`localPages` marker. Thereafter old individual template keys are ignored. This
consolidates the current two authoring sources without discarding valid pages;
quota failures leave both previous sources intact. Deletion no longer performs
partial writes across two repositories. The marker is never exported.

Painted drawings remain in `studioodle-library-v8` IndexedDB. The picker uses
bounded disposable SVG image previews and does not construct Artwork/hit maps for
all grid cards. Editor geometry still prepares only when a page is opened.

## Format

```json
{
  "format": "studioodle-coloring-book",
  "version": 2,
  "title": "My Coloring Book",
  "pages": [
    {
      "id": "stable-page-id",
      "title": "Page Title",
      "version": 5,
      "updatedAt": 0,
      "format": "landscape",
      "size": { "width": 1000, "height": 700 },
      "background": "#ffffff",
      "leafColor": 2368552,
      "document": {
        "version": 5,
        "width": 1000,
        "height": 700,
        "surfaces": [
          { "id": "canvas", "kind": "canvas", "x": 0, "y": 0, "color": 16777215 },
          { "id": "tree-1", "kind": "garden-tree", "x": 500, "y": 350, "scale": 1, "rotation": 0, "color": 0 }
        ]
      }
    }
  ]
}
```

Book format version 2 wraps vector-only document/saved-picture format 5. Old development exports are intentionally unsupported. Page IDs must be unique, 1–120 letters/digits/dots/underscores/hyphens, starting with a letter or digit. Limits: 20 MB per import/export, 1,000 pages, 1,000 surfaces per page, and 160-character titles. Unknown sticker IDs, unsupported versions, malformed geometry, and duplicate IDs reject the entire import. Additional fields are discarded during normalization. An ID collision deliberately means a revision, so use Save New Page for an independent variant.

## Updating the production collection

The canonical bundled collection is `src/assets/coloringBook.json`, loaded by `src/app/coloringPages.ts`. Its IDs remain stable (`winter`, `beach`, `spring`, `counting`, `garden`, `safari` for the initial six pages). Workshop exports use exactly the same format. Scene previews and catalogs read this same collection directly.

After reviewing an exported file, install it with:

```sh
npm run books:install -- path/to/reviewed-book.json
npm run check
```

The install command validates the file before replacing the bundled collection. It replaces the complete collection rather than merging, so supply a complete collection when updating the whole app. Then commit the JSON and rebuild the web/native app. You can also supply that JSON to an assistant for a reviewed source update. Existing device-local revisions with matching IDs take precedence over newly bundled pages; test a production update in a clean profile to see the bundled version.

The domain format and normalization live in `src/editor/coloringBook.ts`, storage
in `src/platform/localColoringBook.ts`, collection composition in
`src/app/coloringBookWorkshop.ts`, and sharing-code helpers in
`src/app/coloringPageSharing.ts`.
