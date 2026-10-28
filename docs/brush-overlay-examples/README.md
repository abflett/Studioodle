# Brush overlay · study 01

Open [the interactive study](index.html) in a browser. This is a standalone visual
proposal, not app implementation. `?preview` hides the comparison-page text;
`?preview&theme=light` shows the light version. No network libraries are required.
For the bundled app font, use the existing Vite server at
`/docs/brush-overlay-examples/index.html`; direct file opening can fall back to the
system font if the browser restricts local font loading.

| View | Screenshot |
| --- | --- |
| Desktop, dark | [First version](01-brush-desktop-dark.png) |
| Phone, portrait | [Portrait](02-brush-portrait-dark.png) |
| Desktop, light | [Light theme](03-brush-desktop-light.png) |
| Short landscape | [Landscape](04-brush-short-landscape.png) |

The tool cards combine small illustrated instruments with their stroke samples.
The overlay itself has no visible word labels: tools, tip shapes, clear, close and
apply use artwork/icons with accessible names and hover titles. The selected tool
and tip share the app's gold treatment (teal in light mode).

Instead of five fixed sizes, a continuous slider, editable number and one-unit
minus/plus controls offer every whole size from 1 to 64. The number is retained
for precision, not as a caption. Values represent page units, not screen pixels.
Changing type, shape or size redraws the sample; draw on the paper to try it, or
use the eraser icon to clear it. Practice marks and selections stay in memory.

Four types reflect the current choices: ink, pencil, paintbrush and spray. Round
and square tips already exist. Oval and chisel are proposals; 1–64 is a proposed
range. The small Canvas2D sample illustrates the visual idea and does not run the
app's vector engine. Texture and tip behavior need review before implementation;
in particular pencil/spray footprints are illustrative, not final tip simulation.

The footer check means use this brush and return to drawing. Apply/Close only show
mockup notices; there is no storage access, save queue or editor modification.
The hand cue and blank paper invite testing instead of explanatory copy. Custom
SVG tool illustrations are provisional studies, not a replacement app icon set.

Review the hierarchy, recognition of each instrument, four tip shapes, size range
and whether a practice surface earns this space. Existing app features stay enabled.
