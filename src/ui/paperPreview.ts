import type { Artwork } from '../editor/Artwork';

/** Normalized rectangle wholly inside the illustrated paper's opaque face. */
export type PaperFrame = { left: number; top: number; right: number; bottom: number };

/** Keep the complete drawing inside the face, then bleed edge pixels to the cut outline. */
export function drawPaperPreview(ctx: CanvasRenderingContext2D, artwork: Artwork, frame: PaperFrame) {
  const { width: w, height: h } = ctx.canvas;
  const { width, height } = artwork.size;
  const left = Math.round(w * frame.left), top = Math.round(h * frame.top);
  const right = Math.round(w * frame.right), bottom = Math.round(h * frame.bottom);
  const scale = Math.min((right - left) / width, (bottom - top) / height);
  const x = left + ((right - left) - width * scale) / 2;
  const y = top + ((bottom - top) - height * scale) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(scale, 0, 0, scale, x, y);
  artwork.render(ctx, true);
  // Copy fully rendered edge pixels, not the antialiased boundary of the drawing.
  const x0 = Math.min(w - 1, Math.ceil(x)), y0 = Math.min(h - 1, Math.ceil(y));
  const x1 = Math.max(x0, Math.floor(x + width * scale) - 1), y1 = Math.max(y0, Math.floor(y + height * scale) - 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const sourceWidth = x1 - x0 + 1;
  if (y0 > 0) ctx.drawImage(ctx.canvas, x0, y0, sourceWidth, 1, x0, 0, sourceWidth, y0);
  if (y1 < h - 1) ctx.drawImage(ctx.canvas, x0, y1, sourceWidth, 1, x0, y1 + 1, sourceWidth, h - y1 - 1);
  if (x0 > 0) ctx.drawImage(ctx.canvas, x0, 0, 1, h, 0, 0, x0, h);
  if (x1 < w - 1) ctx.drawImage(ctx.canvas, x1, 0, 1, h, x1 + 1, 0, w - x1 - 1, h);
  ctx.restore();
}
