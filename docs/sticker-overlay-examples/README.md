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
