# Startup and navigation

The splash loads the editor module and home illustrations, stays visible for at least
two seconds and proceeds when ready. It does not download every sticker definition.

React owns home/setup, the ribbon and overlays. Blank setup selects a physical paper
preset, Tall/Wide orientation inferred from the window, then background color. The
page is independent of window size and starts fitted beneath the ribbon.

Coloring templates arrange reusable hybrid stickers. Choosing a picture prepares its
lazy definition packs before entering the editor. Thumbnail definitions load as needed.
Sticker selection loads only the chosen definition before placing it. Failures retain
the selection view with a dismissible message rather than opening an incomplete scene.

Artwork owns surface paint, regions, placement, order, serialization and compositing.
Canvas2D renders vectors and raster paint at display resolution. Phaser handles pointer
input and the selection overlay. React positions the page and controls Fit-relative zoom.

Home saves the editable version-3 document before returning; autosave runs every minute.
Your pictures browses version-3 local saves and offers delete/undo-delete, PNG and print.
Old development save formats are intentionally unsupported. See HYBRID-ENGINE.md for
the authoring format, region maps, loading/caches and cleanup decisions.