import { Artwork } from '../../src/editor/Artwork';
import { rectangleGeometry } from '../../src/editor/vectorPaintStyles';
import { portfolioPapers } from '../../src/app/startup';

function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
async function load(src: string) { const image = new Image(); image.src = src; await image.decode(); return image; }
function canvas(width: number, height: number) {
  const element = document.createElement('canvas'); element.width = width; element.height = height;
  return element;
}

/** Verify actual alpha compositing: transparent center, preserved folds and no exposed gaps. */
export async function checkPaperPreview() {
  for (const paper of portfolioPapers) {
    const [original, cutout, rim] = await Promise.all([paper.artwork, paper.artworkMask, paper.overlayMask].map(load));
    const width = 420, height = Math.round(width / paper.ratio * (paper.box.right - paper.box.left) / (paper.box.bottom - paper.box.top));
    const x = width * paper.box.left, y = height * paper.box.top;
    const w = width * (paper.box.right - paper.box.left), h = height * (paper.box.bottom - paper.box.top);
    const art = Artwork.restore({ version: 5, width: 210, height: Math.round(210 / paper.ratio), surfaces: [{
      id: 'paper', kind: 'canvas', x: 0, y: 0, color: 0x24335c,
      vectorPaint: { version: 1, regions: [{ id: 1, base: 0x24335c, blobs: [{
        color: 0xff2020, geometry: rectangleGeometry(101, 4, 8, 8),
      }] }] },
    }] });
    try {
      const image = canvas(Math.round(w), Math.round(h)), ctx = image.getContext('2d')!;
      ctx.setTransform(image.width / art.size.width, 0, 0, image.height / art.size.height, 0, 0);
      art.render(ctx, true);
      ctx.resetTransform(); ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(cutout!, 0, 0, image.width, image.height);
      // The second CSS mask registers the original paper alpha against this image rectangle.
      ctx.drawImage(original!, -x / w * image.width, -y / h * image.height, width / w * image.width, height / h * image.height);
      const overlay = canvas(width, height), overlayCtx = overlay.getContext('2d', { willReadFrequently: true })!;
      overlayCtx.drawImage(original!, 0, 0, width, height);
      overlayCtx.globalCompositeOperation = 'destination-in'; overlayCtx.drawImage(rim!, 0, 0, width, height);
      const overlayPixels = overlayCtx.getImageData(0, 0, width, height).data;
      const center = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
      assert(overlayPixels[center + 3] === 0, 'The paper overlay center must be actually transparent');
      const composite = canvas(width, height), result = composite.getContext('2d', { willReadFrequently: true })!;
      result.drawImage(image, x, y, w, h); result.drawImage(overlay, 0, 0);
      const pixels = result.getImageData(0, 0, width, height).data;
      assert(pixels[center] === 0x24 && pixels[center + 1] === 0x33 && pixels[center + 2] === 0x5c, 'Artwork must show through unchanged, without texture blending');
      const reference = canvas(width, height), ref = reference.getContext('2d', { willReadFrequently: true })!;
      ref.drawImage(original!, 0, 0, width, height);
      const paperPixels = ref.getImageData(0, 0, width, height).data;
      let head = 0, folds = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (paperPixels[i + 3]! >= 250) assert(pixels[i + 3]! >= 235, paper.shape + ' layers must not leave an exposed gap');
        if (paperPixels[i + 3] === 0) assert(pixels[i + 3]! <= 8, paper.shape + ' artwork must not poke outside the paper silhouette');
        if (pixels[i]! > 230 && pixels[i + 1]! < 60 && pixels[i + 2]! < 60) head++;
        if (i / 4 % width > width * .85 && Math.floor(i / 4 / width) > height * .75 && overlayPixels[i + 3]! >= 250) folds++;
      }
      assert(head > 5, paper.shape + ' preview must retain the top-center feature');
      assert(folds > 20, paper.shape + ' overlay must keep its folded paper corner');
    } finally { art.dispose(); }
  }
}
