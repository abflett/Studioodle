# Editor ribbons

The primary ribbon uses icon-only controls in this order:

Home | Move page, Zoom, Select | Erase, Brush, Fill, Stickers, Colors | Undo

Home is separate because it saves and leaves the workspace. View and selection controls form one group; drawing controls form another. Undo stays at the far end as an easy-to-find recovery action away from Home. This placement is a product design choice, not a universal usability rule.

Groups use subtle rounded wells separated by spacing, with compact outer ribbon padding. On narrow screens, the primary ribbon stays on one row and shares the available width proportionally between its ten buttons. Buttons use 48px targets on wide screens and 44px height on compact screens, with widths adapting to the available space, accessible names, desktop title tooltips, visible keyboard focus, and selected-tool feedback. The color picker uses a neutral palette icon with a separate current-color dot so the icon remains visible for very light or dark colors.

The selected-sticker ribbon is also icon-only. Shrink/grow and counterclockwise/clockwise rotation use directional icons, with grouped pairs, named actions, and desktop tooltips. Done is highlighted; Delete is spaced apart.

References: [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) for accessible names and pressed state; [NN/g icon usability](https://www.nngroup.com/articles/icon-usability/) for the recognition tradeoff when removing visible labels. Icon-only controls follow the app's requested visual direction; accessible names and tooltips do not provide equivalent discoverability to visible labels on touch devices.

Selection controls open as a compact rounded drawer centered beneath the main ribbon, with its top edge tucked behind it. A slightly shaded surface and downward reveal distinguish it from the primary controls. The drawer overlays the canvas so selecting a sticker does not resize or recenter the page. Focus framing accounts for the drawer height.

The selected-sticker drawer includes separate horizontal and vertical flip buttons. Flips mirror the whole sticker in its local axes (before rotation), including its paint, silhouette, and ink; a second tap reverses the same flip. They participate in undo, duplication, saved documents, preview rendering, and export.

Size, rotation, flip, and layer order each have a shared well containing their two action icons, without a leading label icon.

Layer controls are ordered Backward, Forward. Each action crosses the nearest overlapping sticker in that direction, skipping unrelated layers and preserving their relative order. Overlap uses scene-pixel silhouette coverage within the paper, including transparent cutouts and transforms, rather than bounding boxes alone. The paper is never crossed. Controls disable when no overlapping sticker exists in their direction. Pairwise overlap results are cached until scene geometry/order changes. Undo records the complete reorder as one action.

Advanced painting controls are off by default and can be enabled from Settings on the selection screen. Simple mode selects the standard 5-unit round ink brush or solid bucket fill immediately, without opening a tool overlay. Advanced mode opens the existing brush-size/type and fill-pattern controls. The preference is stored locally for later sessions and does not alter existing picture data.

Bucket fills apply on pointer release in both simple and advanced mode. Holding for 500ms temporarily zooms to the current mode's maximum (8x page Fit, or 8x sticker Fit while focused), anchored at the pointer. A target marker follows the mouse/finger while held. Release fills at the current zoomed position and restores the prior zoom/pan. Releasing outside the drawing viewport, pointer cancellation, capture loss, Escape, window blur, resizing, or changing tools cancels without filling and restores the view. Each completed fill is a single undo step.
