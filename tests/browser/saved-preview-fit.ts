import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { SavedPreview } from '../../src/ui/SavedPreview';
import { Artwork } from '../../src/editor/Artwork';
import { rectangleGeometry } from '../../src/editor/vectorPaintStyles';
import { portfolioPaper } from '../../src/app/startup';
import type { EditorSetup } from '../../src/editor/setup';
import { renderThumbnail } from '../../src/app/pictureThumbnails';

function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }

/** Exercise the real preview with edge markings, including non-A4 source proportions. */
export async function checkSavedPreviewFit() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;width:420px';
  document.body.append(host);
  const root = createRoot(host);
  try {
    for (const [width, height] of [[1123, 794], [794, 1123], [900, 900], [1200, 900], [1600, 900], [800, 1200], [600, 1200]]) {
      const ratio = portfolioPaper(width! / height!).ratio;
      host.style.height = `${420 / ratio}px`;
      const picture: EditorSetup = { title: 'Edge-to-edge fit', format: 'landscape', background: '#ffffff', leafColor: 0,
        size: { width: width!, height: height! }, document: { version: 6, width: width!, height: height!, surfaces: [{
          id: 'canvas', kind: 'canvas', x: 0, y: 0, color: 0x202748,
          vectorPaint: { version: 1, regions: [{ id: 1, base: 0x202748, blobs: [
            { color: 0xff2020, geometry: rectangleGeometry(0, 0, width!, height! * .04) },
            { color: 0x20cc20, geometry: rectangleGeometry(0, 0, width! * .04, height!) },
            { color: 0x2020ff, geometry: rectangleGeometry(width! * .96, 0, width! * .04, height!) },
          ] }] },
        }] } };
      root.render(createElement(SavedPreview, { picture, fillContainer: true }));
      let preview: HTMLElement | null = null;
      for (let n = 0; n < 200; n++) {
        preview = host.querySelector<HTMLElement>('.saved-preview[aria-busy="false"]');
        if (preview?.style.aspectRatio === `${width} / ${height}`) break;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert(preview?.style.aspectRatio === `${width} / ${height}`, 'The new drawing must finish rendering');
      const canvas = preview.querySelector('canvas')!;
      assert(canvas.clientWidth === preview.clientWidth && canvas.clientHeight === preview.clientHeight, 'The actual drawing must fill the viewport without inset padding');
      assert(getComputedStyle(preview).backgroundColor === 'rgba(0, 0, 0, 0)', 'The preview must not manufacture background outside the drawing');
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const matrix = ctx.getTransform();
      assert(matrix.a === matrix.d, 'Cover must use one uniform scale, preserving drawing proportions');
      const expected = document.createElement('canvas'); expected.width = canvas.width; expected.height = canvas.height;
      const reference = expected.getContext('2d', { willReadFrequently: true })!;
      const scale = Math.max(expected.width / width!, expected.height / height!);
      reference.setTransform(scale, 0, 0, scale, (expected.width - width! * scale) / 2, (expected.height - height! * scale) / 2);
      const artwork = Artwork.restore(picture.document!);
      try { artwork.render(reference, true); } finally { artwork.dispose(); }
      const actual = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const wanted = reference.getImageData(0, 0, canvas.width, canvas.height).data;
      let error = 0;
      for (let n = 0; n < actual.length; n++) error += Math.abs(actual[n]! - wanted[n]!);
      assert(error / actual.length < .1, 'Visible edge markings must match an undistorted cover render');
      const thumbnail = await renderThumbnail({ ...picture, id: 'preview-fit', version: 6, updatedAt: 1, document: picture.document! });
      const bitmap = await createImageBitmap(thumbnail.blob);
      const cached = document.createElement('canvas'); cached.width = canvas.width; cached.height = canvas.height;
      try {
        const cachedCtx = cached.getContext('2d')!, cover = Math.max(cached.width / bitmap.width, cached.height / bitmap.height);
        cachedCtx.drawImage(bitmap, (cached.width - bitmap.width * cover) / 2, (cached.height - bitmap.height * cover) / 2, bitmap.width * cover, bitmap.height * cover);
        const pixels = cachedCtx.getImageData(0, 0, cached.width, cached.height).data;
        let error = 0; for (let n = 0; n < pixels.length; n++) error += Math.abs(pixels[n]! - actual[n]!);
        assert(error / pixels.length < 1.5, 'Bounded PNG cover must retain source colors, proportions and edge markings');
      } finally { bitmap.close(); cached.width = cached.height = 1; }
    }
    return { a4Portrait: true, a4Landscape: true, square: true, customSizes: true, uniformCover: true, noPadding: true, noSyntheticBackground: true };
  } finally { root.unmount(); host.remove(); }
}
