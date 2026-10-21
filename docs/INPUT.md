# Shortcuts and canvas gestures

Space toggles adjusted mouse control at the saved speed. Escape releases it. Key repeat is ignored for the toggle. Editable fields, range inputs, and focused dialog controls retain normal keyboard behavior. Browser pointer-lock restrictions still apply, and failure leaves the normal cursor available.

Editor shortcuts pause while a dialog is open or a field is being edited. Ctrl below also means Cmd on macOS.

| Shortcut | Action |
| --- | --- |
| B / G / E | Brush / Fill / Eraser |
| V / H | Select / Pan |
| S / C | Stickers / Colors |
| Z | Cycle zoom levels |
| + or = / - | Zoom in / out at the viewport center |
| 0 | Fit the page, or refit the focused sticker |
| Ctrl+Z or Backspace | Undo |
| Ctrl+S | Save the current picture |
| Ctrl+D | Duplicate the selected sticker |
| Delete | Delete the selected sticker |
| F | Focus or refit the selected sticker |
| Enter | Finish selection/focus when canvas or general content is focused |

Focus mode retains its existing restrictions on duplicate/delete/add stickers. Keyboard tool selection shares the toolbar actions, including advanced painting options. The settings panel opens the shortcut guide in its own centered dialog; tool button titles also show shortcuts.

One finger uses the current tool. Two fingers pan and pinch simultaneously, anchored at their midpoint, between fitted scale and 8x (relative to the focused sticker while in focus mode). The gesture finishes when all fingers lift; the remaining finger cannot accidentally start painting. Trackpad scrolling pans, and Ctrl-wheel/trackpad pinch zooms at the pointer position. These gestures are limited to the canvas, preserving normal dialog scrolling and browser behavior elsewhere.

The canvas touch adapter owns native touch input and routes one synthetic pointer stream into the editor. Mouse compatibility events are unnecessary for drawing. A second finger cancels precision fill or pan and rolls back an in-progress brush/eraser stroke or sticker drag, including its undo history entry. A new gesture requires lifting all fingers. Touch cancellation, resize, and window blur cancel active input. Pointer/pen and mouse input otherwise retain their existing routes.

Implementation: `useEditorShortcuts.ts`, `useCanvasGestures.ts`, `usePaperView.ts`, `appMouse.ts`, and the session's `cancel-input` transaction command. See [architecture](ARCHITECTURE.md) for automated checks and manual interaction coverage.

## Vector stroke smoothing

Non-spray brush strokes blend input samples to damp hand jitter and use rounded quadratic joins, with the combined trailing distance capped at six screen pixels (converted through the current page zoom). Curves are sampled into short segments and swept into vector brush geometry, clipped to the SVG regions. Paint is saved as vector polygons; no blur or instance raster paint buffer is used. Initial taps remain immediate; release includes the actual pointer-up position and flushes the small tail. Eraser, spray, sticker movement, fill and pan keep their existing behavior. Cancelling a stroke for a two-finger gesture discards the smoothing tail after restoring the original document and undo history.
