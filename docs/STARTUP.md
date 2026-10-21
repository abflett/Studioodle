# Startup and navigation

The splash loads the editor module and home illustrations, stays visible for at least
two seconds and proceeds when ready. It does not download every sticker definition.

React owns home/setup, the ribbon and overlays. Blank setup selects a physical paper
preset, Tall/Wide orientation inferred from the window, then background color. The
page is independent of window size and starts fitted beneath the ribbon.

Coloring templates arrange reusable SVG stickers. Choosing a picture prepares its
lazy definition packs before entering the editor. Thumbnail definitions load as needed.
Sticker selection loads only the chosen definition before placing it. Failures retain
the selection view with a dismissible message rather than opening an incomplete scene.

Artwork owns surface paint, regions, placement, order, serialization and compositing.
Canvas2D renders vector ink and vector paint at display resolution. `EditorSession` handles editing commands, undo and gesture transactions; the browser canvas adapter handles
pointer input and draws the selection overlay. React positions the page and controls Fit-relative zoom.

Home saves the editable version-5 document before returning; autosave runs every minute.
Your pictures browses version-5 local saves and offers delete/undo-delete, PNG/SVG/PDF export and vector printing.
Old development save formats are intentionally unsupported. See [the sticker pipeline](STICKER-PIPELINE.md) for
the authoring format, region maps, loading/caches and cleanup decisions.
See [architecture](ARCHITECTURE.md) for repository, output and engine boundaries.
