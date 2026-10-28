# Brush overlay ? study 02

Open [the interactive study](index.html). Use `?preview` for the overlay alone and
`?preview&theme=light` for light mode. The app is unchanged. For the bundled font,
serve `/docs/brush-overlay-examples/index.html` through the existing Vite server;
direct file opening may use the system font.

| View | Screenshot |
| --- | --- |
| Desktop, round | [Study 02](05-brush-v2-desktop-dark.png) |
| Desktop, opaque scatter | [Spray-like tip](06-brush-v2-spray-dark.png) |
| Phone portrait | [Portrait](07-brush-v2-portrait-dark.png) |
| Desktop light | [Light theme](08-brush-v2-desktop-light.png) |
| Short landscape | [Landscape](09-brush-v2-short-landscape.png) |

## Simplified model

One brush has four tip effects: circle, rising diagonal, falling diagonal and
scattered circles. There is no separate ink/pencil/paintbrush/spray instrument
selector, and no oval, square or diamond choice in this study. Tip artwork stands
alone without visible labels; tooltips and accessible names explain each choice.
Fixed diagonals remain predictable; a direction-following diagonal is not part
of this proposal.

The size control spans the complete content width directly beneath the tips.
The slider, editable number and one-unit minus/plus controls retain the proposed
1?64 range in page units. The shallow premade curved stroke updates with the tip
and size. It has no pointer interaction, eraser, hand cue or practice drawing.
Close and the check-mark apply button keep their established positions.

## Opaque scattered circles

The scattered tip stamps solid circles of the selected color, with no opacity,
transparency, blur or blending. More circles overlap toward the middle of the
premade sample to suggest a longer dwell. Increased coverage comes from geometric
overlap, not lower-opacity layers. The intended app behavior is for continuing
application to merge those circles into larger solid painted shapes, using the
existing vector coverage/compaction approach. This study does not implement that
engine behavior or assess its cost.

The tiny Canvas2D example is a visual illustration only, not the production vector
engine. It is deterministic and redraws only when a setting or layout changes;
there is no animated spray, save activity, editor change or storage access.

## Earlier comparison

[Study 01](01-brush-desktop-dark.png) and its [portrait view](02-brush-portrait-dark.png)
retain the earlier instrument choices and large practice surface for comparison.
Current HTML/CSS/JS represent study 02; the earlier source remains in Git history.

Checked at desktop, portrait and short-landscape sizes in dark/light themes.
Tip selection, exact size entry, limits, disabled boundary buttons, full-width
sizing and the noninteractive preview were verified in the browser.
