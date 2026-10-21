# Tool cursors

The canvas uses custom 40 by 40 cursors sourced from SVG. Menus and dialogs use the same cursor family: a custom arrow on general surfaces, a pointing hand on buttons/actions, and a custom text cursor in editable fields. Cursors have a single fine outline without an outer white halo; brush paint and the bucket drip follow the selected color.

| Tool | Hotspot | Meaning |
| --- | --- | --- |
| Brush | 4, 35 | Pointed bristle tip |
| Bucket | 5, 35 | Drip tip |
| Eraser | 7, 32 | Leading eraser corner |
| Select | 5, 3 | Arrow tip |
| Move selected sticker | 20, 20 | Center of movement arrows |
| Pan / drag page | 20, 24 | Palm |
| Menu/button pointing hand | 17, 3 | Index fingertip |
| Editable text | 20, 20 | Center of text beam |

`src/ui/toolCursors.ts` exports the SVG artwork, dimensions, hotspot metadata, generated image URLs, and native cursor styles. The same density-aware images and hotspots also drive the optional adjusted mouse cursor. Normal mode uses native cursor movement. Touch input remains unchanged.

Pan changes from an open hand to a closed hand while pressed. Select changes to movement arrows while pressed. Browser cursor fallbacks remain available if custom cursor rendering is unsupported.

Cursor artwork is kept in `src/assets/cursors/`. Offline previews were reviewed against light and dark backgrounds; app interaction testing remains with the user.

Application cursors are registered at startup by `applyAppCursors()`. The bucket has a metal body, rim, handle, paint band, and pointed drip; the closed hand uses a closed outer contour with short finger creases rather than an implicit closing line across the fist.

Native cursors are rendered from the SVG at 12x resolution, then antialiased down to 1x, 2x and 3x PNG images. CSS image-set selects the display density while preserving the 40 CSS pixel size and hotspot coordinates. Rendering is cached; SVG is the immediate fallback while images prepare. Brush bristles and the bucket pour use filled contours that taper to their exact hotspots, avoiding rounded stroke caps at the precision tip. The pour begins wide at the can rim and narrows continuously toward the click point.

Theme variants update automatically for tools, menus and dialogs. Light mode uses dark blue line art and light tool bodies; dark mode uses muted mint line art and slate tool bodies. Selected paint colors remain unchanged. Theme changes are included in the rendering cache and stale asynchronous results cannot overwrite the latest theme.

## Adjusted mouse speed

Settings provides a saved 10-100% mouse speed (50% initially). The speed takes effect after pressing **Use adjusted speed** or Space, which requests browser pointer lock from that explicit user gesture. Space toggles between adjusted and normal speed; it leaves editable fields, sliders and focused dialog buttons alone. The OS cursor is hidden only while locked. The app accumulates mouse movement deltas multiplied by the chosen speed and uses those same coordinates for the cursor, menus, drawing, sticker dragging, pan, and hold-to-fill precision. The setting does not change OS mouse settings or affect other apps.

Escape, actual browser-window blur, hiding the tab, or exiting the app releases control; it never automatically recaptures the mouse during that session. On desktop the enabled preference is retained through focus loss and app exit, then resumes on the first completed mouse click after reopening. Escape or an explicit toggle off clears that preference. Focus changes between app buttons, dialog close/focus restoration, and scene transitions keep control active. The settings action switches back to normal mouse input as well. Unsupported browsers and rejected requests leave normal mouse input available and show a short status message. Touch and pen input do not enter this mode.

`appMouse.ts` routes virtual pointer and compatibility mouse events while suppressing the locked mouse's fixed-position originals. A virtual press keeps its original target until release, providing capture for canvas drags without native capture of a synthetic pointer. Cancellation releases canvas strokes and cancels precision fills without applying a fill. The cursor is a noninteractive manual popover in the top layer, above dialogs. Mouse wheel scrolling and range dragging are handled explicitly because untrusted events do not perform those native default actions. Hover and press feedback mirror the normal controls.

Source review completed; browser interaction testing (including pointer lock across target browsers and monitors) remains with the user.
