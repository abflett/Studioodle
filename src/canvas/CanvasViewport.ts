import type { Artwork } from '../editor/Artwork';
import type { EditorSession } from '../editor/EditorSession';

/** A single display canvas, bounded by the visible workspace even at high zoom. */
export class CanvasViewport {
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;

  constructor(private readonly host: HTMLElement, private readonly width: number, private readonly height: number, private readonly refresh:()=>void) {
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Unable to create vector display');
    this.context = context;
    this.canvas.className = 'vector-display';
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, { position: 'absolute', pointerEvents: 'none' });
    host.append(this.canvas);
  }

  render(artwork: Artwork, state: EditorSession['state']) {
    const page = this.host.getBoundingClientRect();
    const viewport = this.host.closest('.art-canvas')?.getBoundingClientRect() ?? page;
    const left = Math.max(page.left, viewport.left), top = Math.max(page.top, viewport.top);
    const width = Math.max(0, Math.min(page.right, viewport.right) - left);
    const height = Math.max(0, Math.min(page.bottom, viewport.bottom) - top);
    if (!width || !height || !page.width || !page.height) { this.canvas.style.display = 'none'; return; }
    const x = left - page.left, y = top - page.top, dpr = window.devicePixelRatio || 1;
    Object.assign(this.canvas.style, { display: 'block', left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` });
    const pixelWidth = Math.ceil(width * dpr), pixelHeight = Math.ceil(height * dpr);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    const ctx = this.context;
    ctx.resetTransform(); ctx.clearRect(0, 0, pixelWidth, pixelHeight);
    const pixelScaleX = pixelWidth / width, pixelScaleY = pixelHeight / height;
    ctx.setTransform(pixelScaleX * page.width / this.width, 0, 0, pixelScaleY * page.height / this.height, -x * pixelScaleX, -y * pixelScaleY);
    artwork.render(ctx,false,this.refresh);
    const { bounds, tool } = state;
    if (bounds && tool === 'select') {
      ctx.strokeStyle = '#549bd1'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10, 8); ctx.stroke();
    }
  }

  destroy() { this.canvas.remove(); this.canvas.width=this.canvas.height=1; }
}
