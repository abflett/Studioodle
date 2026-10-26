# Overlay design direction

Working design brief, 24 October 2026. This records the requested direction and
proposals for discussion; it does not describe shipped behavior. Implementation
work is tracked only in [Refinement tasks](REFINEMENT-TASKS.md).

## Goal and scope

Make selection easy to understand through artwork, recognizable icons, predictable
navigation and responsive use of space. Reduce reading and unnecessary steps.
Start with Coloring Pages, then carry a shared interaction pattern across paper
setup, colors, stickers/categories, brush/fill options, saved-picture actions,
sharing/export, deletion and settings.

Design with all existing features enabled. Simple mode, toddler mode and parent
locking are later work. The library should accommodate hundreds of pages and a
sticker collection growing from 364 toward 1,000 before public release.

## Requested direction

- Remove redundant visible headings where the opening action and content already
  explain the overlay. Keep accessible dialog names and labelled controls.
- Use clearer icons, large targets and consistent control positions. Retain short
  text where an unfamiliar action, format or destructive choice needs explanation.
- Adapt content density to available width, height and aspect ratio. Avoid the
  current fixed six-item layout wasting space on larger displays.
- Make browsing possible without cycling through every page individually.
- Add manual page sharing through portable data: import/export files and ideally
  strings that users can copy and paste. A future online hub is outside this phase.
- Remove the dedicated Edit Page action from the user-facing flow. Users can open
  a page, arrange its stickers, save the drawing and save it as a new coloring page.
  Decide separately whether any revision/debug tooling still serves authoring.
- Keep finished-picture export/print distinct from sharing an editable coloring
  template. Saving a drawing as a coloring page creates that template; sharing
  transfers it to someone else.

## Observations from the supplied examples

The overlays share colors and rounded panels, but their navigation and density
vary. Large headings and empty margins compete with previews; the coloring picker
shows only one page, while sticker lists show six regardless of available space.
Back sits at the top in sticker categories and at the bottom in paper setup.
Action placement and text vary between selection, export and delete dialogs.
The examples establish the redesign scope; they are not final layout references.

## Proposed shared interaction pattern ? discuss first

Use a stable close target at the top right and a stable back target at the top
left when there is a parent view. Put filters near the top, browsable artwork in
the central area and optional secondary utilities in a consistent action area.
Use one predictable primary-action location when confirmation is required.
Do not mix returning to a parent view with moving to another page of results.

Prefer a responsive thumbnail gallery for browsing. On small/short screens, reduce
columns and preserve usable previews and touch targets. Decide scrolling versus
pagination with actual portrait, landscape and short-window mockups. Keep selected
items and filters stable when returning from a preview or sharing dialog.

Visible titles can disappear from obvious pickers while useful page names remain.
Errors, destructive confirmations, file formats and sharing instructions can keep
concise text. Icon meaning must be tested rather than assumed. Keyboard focus,
Escape/back, screen-reader names and touch navigation remain part of the design.

## Coloring-page discovery ? proposed model

Separate three independent questions instead of mixing them into one category:

| Dimension | Candidate choices | Purpose |
| --- | --- | --- |
| Composition | All, Single subjects, Scenes | What the user wants to color |
| Detail | All, Simple, Medium, Detailed | How much small detail they want |
| Subject/theme | Animals, Fantasy, Nature, Seasonal, etc. | What interests them |

These are candidate names, not approved taxonomy. A dragon can be a single subject
with either simple or detailed ink; a scene can also be simple. Recommend starting
with composition and detail, then adding subject/theme only when the catalog makes
it useful. Decide whether personal/imported pages use a separate collection filter.
Search is a candidate supplement for a large catalog, not a replacement for visual
browsing. Do not expose every filter at once if that makes the picker harder.

Clarify whether shipped stickers automatically become single-subject coloring
pages or whether those pages are curated. Automatically exposing the whole sticker
catalog creates questions about framing, titles, duplicate variants and discoverability.
The canonical authored scene collection stays in `src/assets/coloringBook.json`.

## Detail estimation ? research proposal

Region count and area can help suggest a detail level, but a plain average loses
important differences. Consider distributions of visible fillable-region sizes,
the fraction of tiny regions, and region density at a common physical page size.
For scenes account for sticker scale, repeated instances, clipping and occlusion;
summing source sticker scores can count detail that is no longer visible.

Treat the result as a suggested coloring-detail band, not an age or ability rating.
Compare representative single subjects and scenes by eye before choosing thresholds.
Allow curated overrides. Derive lightweight catalog metadata ahead of browsing;
do not decode all sticker geometry when opening the picker. No bulk regeneration
or ink-cleanup threshold change is needed to explore this design.

## Sharing ? proposed flow and decisions

A Share action in the coloring-page picker could offer Copy Code / Export File;
an Import action could offer Paste Code / Open File. Names and icon treatment need
review. Keep PNG/SVG/PDF under picture export rather than this template transfer.
The existing version-2 coloring-book JSON and validation are the starting point:
geometry and bundled sticker references, with paint removed. Recipients need the
referenced sticker assets in their app version.

Decide single-page versus multi-page sharing, code encoding and practical size
limits. JSON is readable but can be long; compression/encoding may make copying
more manageable but is not encryption. Clipboard failures need a manual-copy path.
Preview and validate incoming content before accepting it. Decide duplicate-ID
behavior explicitly: the current book merge treats a matching ID as a revision,
which may be surprising for user-to-user imports. Preserve existing local pages on
failure and resolve authoritative/atomic template storage before adding more writes.

## Confirmed browsing preference and layout examples

As of 26 October 2026, tapping an image or a drawing-action icon should open the
canvas directly. Do not add a selection/confirmation step. A single large preview
is preferred for simplicity; a grid toggle remains a candidate for finding pages.
When switching back to single view, retain the last browsing position rather than
requiring a selected page. Review [the layout examples](overlay-examples/README.md)
before implementing. The three arrangements and icon choices are proposals.

Focus is the preferred layout. The next desktop study moves current/total page
numbering and the red dotted/filled favorite heart onto the preview, and places
the grid toggle after the favorites filter. See the overlay-only Focus captures
in the examples folder. Badge styling remains provisional.

## First discussion

1. Choose a single-preview layout and whether an optional grid overview is useful.
   Direct tap-to-open is confirmed.
2. Agree on composition/detail filters and whether single-subject pages are
   generated from every sticker or curated.
3. Agree on where Import/Share live and whether sharing starts with one page.
4. Review a few responsive layouts, then settle the shared overlay control positions.

After those decisions, implement the Coloring Pages slice and use it to test the
pattern before changing the other overlays.
