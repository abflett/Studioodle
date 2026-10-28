# Sticker overlay / study 01

Layout proposal only; the app is unchanged. Open [the interactive study](index.html)
through the Vite dev server at `/docs/sticker-overlay-examples/index.html`.
Use `?preview` for the overlay alone, or `?preview&theme=light` for light mode.

- Keep the current ten category icons, without visible titles or a visible dialog heading.
  Buttons retain accessible names and hover tooltips.
- Show every category together: five columns on desktop, three on phones. Keep generous
  spacing and use the available height instead of category pagination.
- Keep black versus selected-color line art in a small centered segmented footer well.
  The palette icon represents the selected-color option; its dot shows the chosen color.
- Black ink is `#000000`; sticker sample wells are `#ffffff`. Theme surfaces and interface
  icons retain their existing softer palette. No global color conversion is implemented.
- Category navigation opens twelve sample stickers with back and paging controls.
  Sticker placement is deliberately inactive in this standalone layout preview.

| View | Capture |
| --- | --- |
| Desktop, dark | [Categories](01-categories-desktop-dark.png) |
| Phone, dark | [Categories](02-categories-phone-dark.png) |
| Desktop, light | [Categories](03-categories-desktop-light.png) |
| Short landscape | [Categories](04-categories-short-dark.png) |

Browser QA verified all ten categories fit without horizontal overflow at 1000×720,
390×844 and 844×390, both ink selections work, and category navigation opens the
sticker grid. Captures use the real app category catalog and current Lucide icons.

Color follow-up for implementation: `EditorPreview.tsx` sets newly placed sticker
outlines to `0x242428` unless selected-color ink is enabled. Review that value,
the default paint swatches and document/page defaults together when applying pure
black/white across the app. Preserve the selected-color ink option and deliberate
nonwhite user backgrounds; this study does not alter saved drawings or export colors.

## Header comparison / study 02

Open [the interactive header comparison](headers.html). `?preview&layout=balanced`
shows A, `?preview&layout=centered` shows B; append `&theme=light` for light mode.
The review header switches arrangements and themes. Both variants remove the footer.

| Layout | Dark | Light |
| --- | --- | --- |
| A: ink left, difficulty centered, close right | [Desktop](05-header-balanced-dark.png) | [Desktop](07-header-balanced-light.png) |
| B: ink and difficulty grouped at center, close right | [Desktop](06-header-centered-dark.png) | [Desktop](08-header-centered-light.png) |

The four difficulty controls are All, Easy, Medium and Detailed. Terrain paths match
those in the current coloring-page picker; All uses the existing grid icon. This
preview demonstrates exclusive filter selection, not sticker difficulty classification
or real filtering. Categories are static in this header comparison.

The single ink button starts at pure black and opens a small illustrative palette;
selecting a swatch returns to the browser and updates its color dot. This is a layout
stand-in for the app's full color picker, not a new production picker implementation.

Browser QA at 1000×720 verified ten visible categories, all controls within the panel,
no footer, exclusive difficulty state and ink palette selection/return. Both themes
were captured. The app remains unchanged. Comparing the two, A has the calmer balance
and most directly matches the coloring-page overlay; B groups browsing settings together.
