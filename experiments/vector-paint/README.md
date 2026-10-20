# Vector paint browser regression

The prototype is now the only painting engine for pages and all stickers. See [current vector paint architecture](../../docs/VECTOR-PAINT.md).

`npm run check:regions` also runs `check.ts` with real workers, Canvas2D and SVG paths. Captured images go to `work/moon-vector-paint.png`. Earlier high-resolution raster trial reports are historical and no longer describe the runtime.
