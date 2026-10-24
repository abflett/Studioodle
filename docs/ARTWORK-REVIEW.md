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
- Search by title, ID or category. **History 1** is the default and contains only
  artwork changed by the latest repair pass (v5: 17 assets). **History 2** contains
  only the immediately preceding pass (v4: seven assets). These are pass-specific sets,
  not a cumulative list. When another pass is accepted, rotate the sets: the new
  pass becomes History 1 and the previous History 1 becomes History 2. Older ledgers
  remain on disk for provenance and annotation reconciliation.
- History membership does not depend on Reviewed status. Selecting a filter updates
  the list immediately and selects its first match if the current artwork is outside
  the set. A/D and Previous/Next browse only the selected history or filter.
- **All artwork** shows the library. **Not reviewed** hides
  assets already inspected. The selected filter survives reload in the page URL.
- Browse filters apply immediately: **Reviewed only**, **Proposed lines only**,
  **Markers only**, **Notes only**, or **All refinements**. All refinements includes
  any Reviewed flag, marker, proposed line or note. Notes includes artwork, marker
  and line notes. Empty filters show an explicit no-matches message. A/D follows
  the chosen list, and the filter survives reload in the URL.
- **Clear from entire review** selects Reviewed status, Markers, Notes, Proposed
  lines, or **Everything - fresh review**. Choosing a category immediately switches
  the Browse filter so you can inspect that category. Nothing is removed until
  you click **Apply delete**. Clearing applies across all artwork, including outside
  the current search or filter.
- Each category removes only that data. Clearing Notes preserves marker positions
  and line geometry. Everything resets Reviewed and removes every marker, note and
  proposed line. Actual artwork geometry and revision metadata stay intact.
  **Undo cleanup** restores the removed fields until the next saved edit or reload.
- Recorded cutout and line repairs refresh automatically when artwork opens:
  completed cutout markers leave the working copy, pending marker region IDs are
  refreshed. Applied line IDs leave the proposal overlay; unsubmitted lines and
  notes remain. Repeated repairs follow the recorded checksum chain through the
  line and marker ledgers, keeping earlier history. Only applied marker IDs and
  line IDs are retired; later annotations remain. A rebuilt asset starts unchecked once, then its
  new Reviewed status survives reload. Original
  exports and the repair ledger are unchanged. Export also refreshes known repairs
  on assets not yet opened, without modifying local annotations.
- Ctrl-click (Cmd-click on Mac): mark a region that should become transparent.
- Shift-click: mark a location that needs a fill region, including an open gap
  that should be closed in the line art.
- Normal left-click selects a marker or line; left-drag moves a marker or line
  handle. Moving a marker updates its region ID. Click empty artwork to deselect.
  **Delete** removes the selected marker or line, except while editing a text field.
- Select / move is the default tool. Keys 1-3 explicitly select marker tools;
  key 4 selects Close line (left-click A/B is available for touch screens).
  Right-click A/B works from any tool and returns to Select / move when complete.
  Ctrl/Shift click always takes priority, including over existing handles.
- Select a numbered marker in the artwork or sidebar to edit its note. Alt-click
  deletes it directly. Artwork notes describe broader issues. Notes never take
  focus automatically. Escape deselects and cancels incomplete line placement.
- Wheel over the artwork to zoom around the cursor; it never changes images.
  The point under the cursor stays anchored. The + / − buttons zoom around the
  current view center. **Middle-button drag** pans, including over existing
  markers and handles. Alt-left-drag also pans. Left drag is reserved for editing
  handles. Fit resets zoom and pan. Marker coordinates
  always refer to the SVG, regardless of display size, pan or zoom.
- Hide Markers for an unobstructed inspection. Zoom resets when changing assets.

Annotations describe requested repairs; they do not change artwork or regions.
Make transparent can flag an existing white region. Add fill region can flag
transparent space, line art, or an existing region that needs splitting.

## Proposing line closures

1. **Right-click A, then right-click B** from any tool to create a line. You can
   also choose **4 · Close line** and left-click A and B.
2. The initial preview is straight. Width is estimated from nearby visible ink;
   adjust the **Line width** slider from 0.1 to 2 SVG units in the sidebar.
   With a line selected, **Ctrl + wheel up/down** increases/decreases width by
   0.1 within that range, without zooming or changing selection. Ordinary wheel
   still zooms. Existing wider proposals retain their width until you adjust them.
3. Left-drag **A** or **B** to join the original ink precisely. Left-drag **Curve** in the
   middle to bend the line; the curve passes through this visible handle. Use
   **Straighten line** to remove the bend. Focus a handle with Tab and use arrow
   keys for adjustment; Shift reduces the movement to 0.1 SVG units.
4. Optionally choose **Set fill point**, then left-click inside the intended new
   fill region. This saves a seed associated with the closure. It is never requested
   automatically, so normal clicks remain available for selection and deselection.
   An existing fill point is draggable. Several closures can share one fill seed.


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

While a history is selected, **Export History 1** or **Export History 2** downloads
all locally stored review entries belonging to that pass, including assets already
marked Reviewed. Search does not reduce this export set. Other browse filters retain
**Export all JSON** for a full backup. Exports retain the same review schema, closure
geometry and marker coordinates; `scope` identifies the selected history.


The export includes the selected set of annotated/reviewed assets, including per-asset notes,
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
