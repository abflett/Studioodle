# Coloring Books and the Page Workshop

Books are offline JSON files. No account, server, image upload, or custom sticker embedding is involved. A book references the sticker IDs shipped with the app; a recipient needs an app version containing those stickers. Book-management controls have been removed from general Settings while integration with the coloring-page picker is being reviewed. Single-page export remains available in the workshop.

## Editing and exchanging pages

1. On Home, open Settings > Advanced Settings and enable **Coloring page workshop** (off by default).
2. Open **Coloring Page**, browse to a page, and choose **Edit Page**. The editor starts with Select for arranging stickers.
3. Use the book button on the ribbon to open **Save Coloring Page**. Change the title if needed.
4. **Save Revision** replaces the local template with the same stable page ID. **Save New Page** adds a separate page with a new ID; subsequent revisions target that new page. **Export Page** downloads a one-page book without requiring a local template save.
5. Collection-level import/export is temporarily disconnected from Settings pending the page-picker design. Its implementation and saved collection remain intact.
6. The retained **Import Book** implementation validates the whole file and shows a review before applying it. Matching IDs replace local revisions; new IDs append. Other pages and saved pictures remain intact. Import is one local-storage write, so quota failure leaves the previous workshop collection intact.

Only explicit **Save Revision** / **Save New Page** actions update the workshop collection. Normal Home, autosave and Ctrl+S continue to save to Your pictures; they do not update templates. Workshop targets are transient editor metadata and do not leak into saved pictures or book files. Workshop revisions continue to appear in the picker when the mode is switched off; switching off only hides editing and transfer controls.

Book pages preserve paper dimensions, sticker order, placement, scale, rotation and flips. All paint, background colors and colored outlines are stripped: exported templates are black outlines on white paper. The PNG/SVG sticker assets themselves are not duplicated. Hand-edit titles and layouts in the app; report sticker geometry flaws separately by asset ID.

The browser downloads JSON; Windows uses a native JSON Save dialog. Canceling the native dialog is not reported as a successful export. Local storage is not a backup—export revisions before clearing app/browser data. Existing Windows installations need a rebuilt installer to get this feature.

## Format

```json
{
  "format": "studioodle-coloring-book",
  "version": 1,
  "title": "My Coloring Book",
  "pages": [
    {
      "id": "stable-page-id",
      "title": "Page Title",
      "version": 3,
      "updatedAt": 0,
      "format": "landscape",
      "size": { "width": 1000, "height": 700 },
      "background": "#ffffff",
      "leafColor": 2368552,
      "document": {
        "version": 3,
        "horizonLayout": 2,
        "width": 1000,
        "height": 700,
        "surfaces": [
          { "id": "canvas", "kind": "canvas", "x": 0, "y": 0, "color": 16777215, "paint": [] },
          { "id": "tree-1", "kind": "garden-tree", "x": 500, "y": 350, "scale": 1, "rotation": 0, "color": 0, "paint": [] }
        ]
      }
    }
  ]
}
```

Book format version 1 wraps the existing document/saved-picture version 3. The current geometry convention requires `horizonLayout: 2`. Page IDs must be unique, 1–120 letters/digits/dots/underscores/hyphens, starting with a letter or digit. Limits: 20 MB per import/export, 1,000 pages, 1,000 surfaces per page, and 160-character titles. Unknown sticker IDs, unsupported versions, malformed geometry, and duplicate IDs reject the entire import. Additional fields are discarded during normalization. An ID collision deliberately means a revision, so use Save New Page for an independent variant.

## Updating the production collection

The canonical bundled collection is `src/assets/coloringBook.json`, loaded by `src/app/coloringPages.ts`. Its IDs remain stable (`winter`, `beach`, `spring`, `counting`, `garden`, `safari` for the initial six pages). Workshop exports use exactly the same format. Legacy scene authoring modules remain available as seed/reference fixtures for scene tooling.

After reviewing an exported file, install it with:

```sh
npm run books:install -- path/to/reviewed-book.json
npm run check
```

The install command validates the file before replacing the bundled collection. It replaces the complete collection rather than merging, so supply a complete collection when updating the whole app. Then commit the JSON and rebuild the web/native app. You can also supply that JSON to an assistant for a reviewed source update. Existing device-local revisions with matching IDs take precedence over newly bundled pages; test a production update in a clean profile to see the bundled version.

Workshop storage uses the separate `studioodle.workshop.v1` key. Existing saved pictures and custom coloring templates retain their original storage namespaces. The domain format and normalization live in `src/editor/coloringBook.ts`, storage in `src/platform/localColoringBook.ts`, and collection composition in `src/app/coloringBookWorkshop.ts`.
