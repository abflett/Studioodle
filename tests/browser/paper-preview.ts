import { Artwork } from '../../src/editor/Artwork';
import { rectangleGeometry } from '../../src/editor/vectorPaintStyles';
import { portfolioPapers } from '../../src/app/startup';
import { drawPaperPreview, paperFacePath } from '../../src/ui/paperPreview';

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
      canvas.height = 300;
      canvas.width = Math.round(canvas.height * width / height * paper.outline.height / paper.outline.width);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      drawPaperPreview(ctx, artwork, paper.surface, document.createElement('canvas'));
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const image = new Image(); image.src = paper.artwork; await image.decode();
      const mask = document.createElement('canvas'); mask.width = canvas.width; mask.height = canvas.height;
      const maskCtx = mask.getContext('2d', { willReadFrequently: true })!;
      maskCtx.drawImage(image, 0, 0, mask.width, mask.height);
      const alpha = maskCtx.getImageData(0, 0, mask.width, mask.height).data;
      maskCtx.clearRect(0, 0, mask.width, mask.height);
      maskCtx.fill(paperFacePath(paper.surface, mask.width, mask.height));
      const face = maskCtx.getImageData(0, 0, mask.width, mask.height).data;
      const counts = colors.map(() => 0);
      for (let i = 0; i < pixels.length; i += 4) {
        const stride = canvas.width * 4;
        if ([-4, 0, 4, -stride, stride].every(offset => (face[i + offset + 3] ?? 0) === 255)) assert(pixels[i + 3]! > 250, `${paper.shape} face has a seam at ${i / 4 % canvas.width},${Math.floor(i / 4 / canvas.width)}: alpha ${pixels[i + 3]}`);
        if (face[i + 3] === 0 && pixels[i + 3]! > 0) {
          assert([-4, 4, -stride, stride].some(offset => (face[i + offset + 3] ?? 0) > 0), 'Artwork must not extend beyond the face, except its one-pixel antialiased outline');
        }
        const color = (pixels[i]! << 16) | (pixels[i + 1]! << 8) | pixels[i + 2]!;
        const feature = colors.indexOf(color);
        if (feature >= 0) {
          counts[feature]!++;
          assert(alpha[i + 3]! > 240, `${paper.shape} mask must not cut off boundary artwork`);
        }
      }
      assert(counts.every(count => count > 0), `${paper.shape} preview must retain its corner and top-center features`);
    } finally { artwork.dispose(); }
  }
}
