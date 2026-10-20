# Moon Sorceress threshold comparison

Open [index.html](index.html) for aligned A/B/C previews and close-ups, or [the comparison sheet](threshold-detail-comparison.png).

- **a-**: 40%, generally thinner ink.
- **b-**: 50%, current production baseline.
- **c-**: 60%, generally thicker ink.

Stages retain their original numbers. Shared stages 01-04 are in the parent folder; each variant has its own 05-13 files, settings, and numbered gallery. The detail crops are taken from stage 07, a direct high-resolution render of stage 06's traced ink. Colors in region previews are diagnostic IDs and need not correspond between variants.

| Variant | Threshold | Ink paths | Closed ink contours | Regions |
| --- | --- | --- | --- | --- |
| A | 40% | 129 | 292 | 168 |
| B | 50% | 133 | 338 | 212 |
| C | 60% | 108 | 342 | 247 |

Reproduce all captures and comparisons from the repository root:

```sh
node scripts/compare-moon-thresholds.mjs --capture
```

Without `--capture`, the command only rebuilds comparison previews from existing captures. Production assets are unchanged.
