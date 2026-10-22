import { Artwork } from '../../src/editor/Artwork';
import { rectangleGeometry } from '../../src/editor/vectorPaintStyles';
import { portfolioPapers } from '../../src/app/startup';
import { drawPaperPreview } from '../../src/ui/paperPreview';

function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }

/** Boundary features must survive both thumbnail fitting and the real generated alpha mask. */
export async function checkPaperPreview() {
  for (const paper of portfolioPapers) {
    const width = Math.round(210 * paper.ratio), height = 210;
    const colors = [0xff2020, 0x20ff20, 0x2020ff, 0xff20ff, 0x20ffff];
    const positions = [[3, 3], [width - 11, 3], [3, height - 11], [width - 11, height - 11], [width / 2 - 4, 3]];
    const artwork = Artwork.restore({ version: 5, width, height, surfaces: [{
      id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0x24335c,
      vectorPaint: { version: 1, regions: [{ id: 1, base: 0x24335c, blobs: positions.map(([x, y], i) => ({
        color: colors[i]!, geometry: rectangleGeometry(x!, y!, 8, 8),
      })) }] },
    }] });
    try {
      const canvas = document.createElement('canvas');
      const frame = paper.frame;
      canvas.height = 300;
      canvas.width = Math.round(canvas.height * width / height * paper.outline.height / paper.outline.width);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      drawPaperPreview(ctx, artwork, frame);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const image = new Image(); image.src = paper.artwork; await image.decode();
      const mask = document.createElement('canvas'); mask.width = canvas.width; mask.height = canvas.height;
      const maskCtx = mask.getContext('2d', { willReadFrequently: true })!;
      maskCtx.drawImage(image, 0, 0, mask.width, mask.height);
      const alpha = maskCtx.getImageData(0, 0, mask.width, mask.height).data;
      const counts = colors.map(() => 0);
      for (let i = 0; i < pixels.length; i += 4) {
        assert(pixels[i + 3] === 255, 'Edge bleed must cover the page without blank strips');
        const color = (pixels[i]! << 16) | (pixels[i + 1]! << 8) | pixels[i + 2]!;
        const feature = colors.indexOf(color);
        if (feature >= 0) {
          counts[feature]!++;
          assert(alpha[i + 3]! > 240, `${paper.shape} mask must not cut off boundary artwork`);
        }
      }
      assert(counts.every(count => count > 0), `${paper.shape} preview must retain its corner and top-center features`);
      const edge = (Math.floor(canvas.height / 2) * canvas.width) * 4;
      assert(pixels[edge] === 0x24 && pixels[edge + 1] === 0x33 && pixels[edge + 2] === 0x5c, 'Full-color background must bleed to the paper edge without fading');
    } finally { artwork.dispose(); }
  }
}
