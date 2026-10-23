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

- Wheel over the artwork, use Previous / Next, or press A / D, Left / Right or
  Page Up / Page Down. Browsing wraps around and follows the search and review filter.
- Space toggles Reviewed for the current asset. Holding it down does not repeatedly
  toggle the status. Shortcuts are inactive while typing in notes or search fields.
- Search by title, ID or category. Mark an asset Reviewed to track progress;
  use Not reviewed yet or With notes or markers to narrow the library.
- Ctrl-click (Cmd-click on Mac): mark a region that should become transparent.
- Shift-click: mark a location that needs a fill region, including an open gap
  that should be closed in the line art.
- Ordinary click: place the selected marker tool. Keys 1–3 choose tools. These
  buttons also provide the modifier actions on touch screens.
- Select a numbered marker in the artwork or sidebar to edit its note or delete
  it. Alt-click a marker to delete it directly, including markers on an older
  artwork revision. Deletions save immediately. Artwork notes describe broader
  issues. Escape deselects a marker.
- Zoom with + / − or Ctrl/Cmd + wheel. Drag when zoomed to pan; Alt-drag or a
  middle-button drag also pans. Fit resets zoom and pan. Marker coordinates
  always refer to the SVG, regardless of display size, pan or zoom.
- Hide Markers for an unobstructed inspection. Zoom resets when changing assets.

Annotations describe requested repairs; they do not change artwork or regions.
Make transparent can flag an existing white region. Add fill region can flag
transparent space, line art, or an existing region that needs splitting.

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
the same file does not duplicate markers. Matching marker IDs use the imported
note; differing asset notes are retained together. Imports with conflicting
asset checksums are rejected to avoid combining coordinates from different
versions. Invalid imports leave local annotations untouched.

If an asset changes after annotation, the inspector keeps its old notes visible
and blocks new edits for that asset. Export those notes and reconcile the repair
against the recorded checksum before starting a new review. Region IDs alone
must never be used to apply repairs to regenerated artwork.

Use `npm run test:review` for the dedicated browser regression checks.
