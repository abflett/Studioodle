# Blank paper and initial sticker sizing

Blank-page setup now offers Full page (A4, 210 × 297 mm), Half page (A5, 148 × 210 mm), Photo (4 × 6 inches), and Square (6 × 6 inches). Non-square choices support Tall/Wide orientation. Full A4 is the default, with orientation chosen from the selection window aspect ratio (Wide for a landscape window, Tall for a portrait window). It follows window rotation/resizing until the user selects an orientation manually; opening a new blank-page wizard resets this automatic choice. Background-color selection follows as before.

Dimensions are converted to rounded integer scene units at 96 units per inch, stored in the existing explicit `size` field, and painted at the default 150 DPI. The page is fitted to the available window, so choosing larger print dimensions does not change the fit-relative zoom baseline. Physical dimensions are accurate to scene-coordinate rounding. Existing saved pages keep their sizes, including legacy fit-to-window documents.

Newly added stickers preserve aspect ratio and native paint detail, shrink if necessary to fit within 60% of both page dimensions, and start entirely on the page. Small assets are not enlarged. Placement uses the visible silhouette bounds; subsequent selection resizing/movement retains the existing controls. Existing scene placements, duplicates and legacy mark imports are not automatically fitted.

No app tests or builds run; user visual review remains the validation workflow.
