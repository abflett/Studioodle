# Connected-component cleanup experiment

Reproduce:

```sh
node scripts/build-stickers.mjs fantasy-moon-sorceress --cleanup-components --experiment-output=experiments/moon-sorceress/connected-component-cleanup.svg
```

Uses original B ink, without the earlier contour cleanup. Existing four-connected flood discovery already creates a separate ID for every enclosed white blob. Cleanup now measures those components before extension under the ink, at largest proportional A4 fit at 150 DPI. Components smaller than 10.2 square pixels are filled with vector ink patches. Original traced ink curves remain unchanged.

212 discovered components become 199: 13 removed. Seven removed components are below one normalized pixel in area; the contour-only cleanup missed these. Retained output was checked to have exactly one outer contour per region. This is evidence that cleanup was operating at the wrong stage, not evidence of merged disconnected region IDs in the original flood discovery.

Only experimental output is written. Production assets and default conversion behavior remain unchanged. Patches are traced from the existing 8x analysis grid without curve smoothing; broader pipeline adoption still needs review.
