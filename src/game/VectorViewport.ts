import type { Artwork } from '../editor/Artwork';

/** Paint raster data and vector outlines directly at the visible display scale.
 * Only allocate the visible portion of the page, even at extreme zoom levels.
 * Phaser remains responsible for input and the selection overlay above it.
 */
export class VectorViewport {
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private geometry = '';
  constructor(private readonly gameCanvas: HTMLCanvasElement, private readonly width: number, private readonly height: number) {
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Unable to create vector display');
    this.context = context;
    this.canvas.className = 'vector-display';
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, { position: 'absolute', pointerEvents: 'none', zIndex: '0' });
    gameCanvas.style.position = 'relative'; gameCanvas.style.zIndex = '1';
    gameCanvas.parentElement?.prepend(this.canvas);
  }
  render(artwork: Artwork, dirty = false) {
    if (!artwork.usesCompositeRenderer) { this.canvas.style.display = 'none'; this.geometry = ''; return; }
    const page = this.gameCanvas.getBoundingClientRect();
    const viewport = this.gameCanvas.closest('.art-canvas')?.getBoundingClientRect() ?? page;
    const left = Math.max(page.left, viewport.left), top = Math.max(page.top, viewport.top);
    const width = Math.max(0, Math.min(page.right, viewport.right) - left);
    const height = Math.max(0, Math.min(page.bottom, viewport.bottom) - top);
    if (!width || !height || !page.width || !page.height) { this.canvas.style.display = 'none'; this.geometry = ''; return; }
    const x = left - page.left, y = top - page.top, dpr = window.devicePixelRatio || 1;
    const geometry = [x, y, width, height, page.width, page.height, dpr].join(',');
    if (!dirty && geometry === this.geometry) return;
    this.geometry = geometry;
    Object.assign(this.canvas.style, { display: 'block', left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` });
    const pixelWidth = Math.ceil(width * dpr), pixelHeight = Math.ceil(height * dpr);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    const ctx = this.context;
    ctx.resetTransform(); ctx.clearRect(0, 0, pixelWidth, pixelHeight);
    // Match the actual rounded backing dimensions to CSS pixels exactly.
    const pixelScaleX = pixelWidth / width, pixelScaleY = pixelHeight / height;
    ctx.setTransform(pixelScaleX * page.width / this.width, 0, 0, pixelScaleY * page.height / this.height, -x * pixelScaleX, -y * pixelScaleY);
    artwork.render(ctx);
  }
  destroy() { this.canvas.remove(); }
}
