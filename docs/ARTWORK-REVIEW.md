# Artwork review

Run `npm run review` to open the standalone inspector on the Vite development
server. If the server is already running, open `/artwork-review.html` on that
server instead. This page is separate from the normal app and is not included
in the production build.

The inspector displays the shipped SVG's actual white paint regions and black
ink over a dark background. It fits the whole asset without cropping or adding
a background to the artwork. Change the inspection background with the color
picker. The toolbar identifies the region under the pointer; enable Region outline
to trace its boundary. Outlines are off by default so inspection shows the unaltered
artwork, without a hover tint painting over the black ink.

## Reviewing the library

- Use Previous / Next, or press A / D, Left / Right or Page Up / Page Down.
  Browsing wraps around and follows the search and review filter.
- Space toggles Reviewed for the current asset. Holding it down does not repeatedly
  toggle the status. Shortcuts are inactive while typing in notes or search fields.
- Search by title, ID or category. Mark an asset Reviewed to track progress;
  use Not reviewed yet or With notes or markers to narrow the library.
- Ctrl-click (Cmd-click on Mac): mark a region that should become transparent.
- Shift-click: mark a location that needs a fill region, including an open gap
  that should be closed in the line art.
- Ordinary click: place the selected marker tool. Keys 1–3 choose marker tools;
  key 4 selects Close line. These
  buttons also provide the modifier actions on touch screens.
- Select a numbered marker in the artwork or sidebar to edit its note or delete
  it. Alt-click a marker to delete it directly, including markers on an older
  artwork revision. Deletions save immediately. Artwork notes describe broader
  issues. Placing markers keeps keyboard focus on the artwork; note fields only
  receive focus when you choose to edit them. Escape deselects a marker.
- Wheel over the artwork to zoom around the cursor; it never changes images.
  The point under the cursor stays anchored. The + / − buttons zoom around the
  current view center. Drag when zoomed to pan; Alt-drag or a
  middle-button drag also pans. Fit resets zoom and pan. Marker coordinates
  always refer to the SVG, regardless of display size, pan or zoom.
- Hide Markers for an unobstructed inspection. Zoom resets when changing assets.

Annotations describe requested repairs; they do not change artwork or regions.
Make transparent can flag an existing white region. Add fill region can flag
transparent space, line art, or an existing region that needs splitting.

## Proposing line closures

1. Choose **4 · Close line** and click endpoint **A**, then endpoint **B**.
2. The initial preview is straight. Width is estimated from nearby visible ink;
   adjust **Line width (SVG units)** in the sidebar if necessary.
3. Drag **A** or **B** to join the original ink precisely. Drag **Curve** in the
   middle to bend the line; the curve passes through this visible handle. Use
   **Straighten line** to remove the bend. Focus a handle with Tab and use arrow
   keys for adjustment; Shift reduces the movement to 0.1 SVG units.
4. After B, click inside the intended new fill region. This saves a fill seed
   associated with the closure. Escape skips it; **Set fill point** adds or moves
   it later. An existing fill point is also draggable. Several closures can be
   proposed for one region; not every line needs its own seed.

The selected proposal has a blue halo and labeled handles. Its actual stroke is
black, with round ends, so you can compare it with the existing art. Uncheck
**Proposed lines** to view the untouched asset. Hide **Markers** to hide handles
while leaving the proposed black strokes visible. Select a line in the sidebar
or click its stroke to edit it. Alt-click its stroke, or use **Delete line**, to
remove it. Notes remain optional and never take focus automatically.

Only completed A/B lines are saved. Escape cancels an incomplete draft. Handle
drags preview locally and save once on release; cancellation restores the saved
line. Changing assets cancels incomplete drafts and resets zoom. Existing markers,
notes and review status stay in the same storage key.

This is a repair proposal, not live region generation. The export stores exact
SVG endpoints, quadratic Bezier control point (or null for a straight line),
stroke width, optional fill seed, notes, IDs and artwork checksum in each asset's
`closures` array. A later offline repair pass can apply the curves to vector ink,
rediscover regions and verify the seeds. The review planner retains these curves
as `proposedLines`; its cutout-only `--apply` does not silently apply line changes.

## Saving and handing off repairs

Every change saves to a dedicated browser localStorage key,
`studioodle-artwork-review-v1`. This is independent of the drawing library.
Storage is specific to the browser and server origin, including its port.
Closing the tab is safe after the Saved locally message. If saving fails, keep
the tab open and export immediately. Export regularly as a portable backup.

Export all JSON downloads the entire review in one file; export whenever you
want, without exporting individual images. Browser autosave happens on every
edit, so navigation never requires an export. A downloaded file is a snapshot
and is not automatically overwritten by later edits.

The export includes all annotated/reviewed assets, including per-asset notes,
review status, marker type and note, exact SVG x/y coordinates, the region ID
under each marker (0 means no fill region), source/vector paths, viewBox, and
the SHA-256 checksum of the SVG version reviewed. The original artwork is not
embedded or changed. Save reviewed files under `art/reviews/` and share their
path when requesting repairs. The review file can be committed as authoring input.

Import JSON validates the file and merges it into the current review. Reimporting
the same file does not duplicate markers or lines. Matching annotation IDs use
the imported values; differing asset notes are retained together. Imports with conflicting
asset checksums are rejected to avoid combining coordinates from different
versions. Invalid imports leave local annotations untouched.

If an asset changes after annotation, the inspector keeps its old notes visible
and blocks new edits for that asset. Export those notes and reconcile the repair
against the recorded checksum before starting a new review. Region IDs alone
must never be used to apply repairs to regenerated artwork.

Use `npm run test:review` for the dedicated browser regression checks.
