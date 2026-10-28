Implementation note: study 01 is now implemented in the app, including slot-linked
custom colors, undo, fresh format-6 storage and resolved-color exports. The captures
and standalone prototype below remain unchanged as design references. Production
custom palettes start empty; the six colors in these screenshots are demo data.

# Color overlay / study 01

The standalone study is a visual reference. The production app now implements
the linked palette model; current behavior is documented in [Interface](../INTERFACE.md).

Open [the interactive study](index.html) through the Vite dev server at
`/docs/color-overlay-examples/index.html`. Use `?preview` for the overlay alone,
`?preview&custom` for Custom, `?preview&custom&edit` for editing, and
`?preview&custom&edit&picker` for the custom-color dialog. Append `&theme=light`
for light mode. The review header switches themes when preview mode is absent.

## Layout and starter colors

Five buttons share a centered top well. Each uses three slightly overlapping solid
circles in that palette's red/green/blue character. All palettes contain 32 slots.
Everyday imports the current app's exact colors; Pastel, Vivid and Moody are draft
curated sets in `study.js`, aligned roughly by hue family with Everyday. All four
built-in sets include pure black and white. These colors are a reviewable starting
point, not frozen/versioned production palette definitions.

Custom demonstrates six assigned colors and 26 empty circles. Actual new drawings
will start with 32 undefined slots. Slot numbers remain internal. The three Custom
tab dots use its first three slots, with outlined placeholders for undefined values.
There is no delete mode. Normal clicks select a filled slot or open an empty slot.
The footer pencil enables edit mode for any custom slot; it becomes a highlighted
check to finish editing. Dashed gold outlines reinforce edit mode.

The custom picker offers saturation/brightness, hue, old/new previews, editable
copy/paste `#RRGGBB` and an explicit Apply action. Cancel discards the draft. Assigning
an empty slot in normal mode also selects it; editing does not switch the active
slot. The prototype keeps the palette open when a swatch is selected for easier
comparison; normal app color selection will retain its immediate return to drawing.
Custom values exist only in this preview's memory and reset on reload.

## Agreed implementation direction (now implemented in the app)

- Slots 0–127: four fixed app palettes; saves reference slot IDs and a palette version.
- Slots 128–159: 32 drawing-owned custom values, initially undefined, stored in that save.
  Once assigned, slots remain defined and can be edited; no delete action.
- Merge paint by slot identity, even when different slots resolve to the same RGB.
- Custom edits recolor linked marks in that drawing, are undoable and saved as changes.
- Switching the available palette never changes the selected color or existing artwork.
- PNG/SVG/print resolve references; portable editable artwork carries the custom table.

These behaviors are not implemented by this visual study.

## Captures

| View | Capture |
| --- | --- |
| Everyday + palette selector | [Desktop](01-everyday-desktop-dark.png) |
| Custom, normal mode + edit button | [Desktop](11-custom-desktop-dark.png) |
| Custom, edit mode | [Desktop](02-custom-edit-desktop-dark.png) |
| Custom-color picker | [Desktop](03-custom-picker-desktop-dark.png) |
| Pastel | [Desktop](04-pastel-desktop-dark.png) |
| Vivid | [Desktop](05-vivid-desktop-dark.png) |
| Moody | [Desktop](06-moody-desktop-dark.png) |
| Everyday, light | [Desktop](07-everyday-desktop-light.png) |
| Custom, phone | [Portrait](08-custom-phone-dark.png) |
| Custom picker, phone | [Portrait](09-picker-phone-dark.png) |
| Everyday, short window | [Landscape](10-everyday-short-dark.png) |

Browser QA verified five tabs and 32 visible swatches per set, no panel overflow at
1000×760, 390×844 and 844×390, custom assignment via hex, confirmation and cancellation.
JavaScript syntax and ESLint checks pass. Production keyboard/focus and linked-paint
behavior will need implementation checks separately.
