import { EditorSession } from '../editor/EditorSession';
import type { EditorSessionPorts } from '../editor/EditorSession';
import type { EditorBridge } from '../editor/bridge';
import type { EditorSetup } from '../editor/setup';
import { paperSize } from '../editor/document';
import { releaseStickerDefinitions } from '../editor/vectorStickers';
import { CanvasViewport } from './CanvasViewport';

/** Browser input/display adapter. Editing rules stay in EditorSession. */
export class CanvasEditor {
  private readonly session: EditorSession;
  private readonly viewport: CanvasViewport;
  private readonly unsubscribe: () => void;
  private readonly observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private pointer?: number;

  constructor(private readonly host: HTMLElement, private readonly bridge: EditorBridge, setup: EditorSetup, save: EditorSessionPorts['save']) {
    const size = paperSize(setup.format, setup.size);
    this.viewport = new CanvasViewport(host, size.width, size.height);
    this.session = new EditorSession(setup, { save, changed: this.changed });
    this.unsubscribe = bridge.subscribe(command => this.session.execute(command));
    host.addEventListener('pointerdown', this.begin);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.release);
    window.addEventListener('pointercancel', this.cancel);
    host.addEventListener('lostpointercapture', this.cancel);
    window.addEventListener('blur', this.end);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    window.addEventListener('resize', this.invalidate);
    window.addEventListener('scroll', this.invalidate, true);
    this.observer = new ResizeObserver(this.invalidate);
    this.observer.observe(host);
    const workspace = host.closest('.art-canvas');
    if (workspace) this.observer.observe(workspace);
    this.changed();
  }

  private changed = () => {
    if (this.disposed) return;
    const { selected, order, tool, focused } = this.session.state;
    this.bridge.selectionChanged(selected, order);
    this.bridge.toolChanged(tool);
    this.bridge.focusChanged(focused);
    this.invalidate();
  };

  /** Coalesce input/view changes; idle pages have no animation loop or layout reads. */
  invalidate = () => {
    if (!this.disposed && !this.frame && !document.hidden) this.frame = requestAnimationFrame(this.draw);
  };

  private draw = (time: number) => {
    // Keep the current frame marked pending while update publishes changes.
    this.session.update(time);
    this.viewport.render(this.session.artwork, this.session.state);
    this.frame = 0;
    if (this.session.needsAnimation) this.invalidate();
  };

  private coordinates(event: PointerEvent) {
    const box = this.host.getBoundingClientRect();
    const { width, height } = this.session.artwork.size;
    return { point: { x: (event.clientX - box.left) * width / box.width, y: (event.clientY - box.top) * height / box.height }, zoom: box.width / width };
  }

  private begin = (event: PointerEvent) => {
    if (this.pointer !== undefined || (event.button !== 0 && event.button !== 2)) return;
    const tool = this.session.state.tool;
    if (tool === 'bucket' || tool === 'pan') return;
    event.preventDefault();
    this.pointer = event.pointerId;
    // Virtual mouse/touch events are routed by the UI; only real pointers can be captured.
    if (event.isTrusted) this.host.setPointerCapture(event.pointerId);
    this.session.begin(this.coordinates(event).point, event.pointerId, event.button);
    this.invalidate();
  };
  private move = (event: PointerEvent) => {
    if (event.pointerId !== this.pointer) return;
    const { point, zoom } = this.coordinates(event);
    this.session.move(point, event.pointerId, event.buttons !== 0, zoom);
    if (!event.buttons) this.end();
  };
  private release = (event: PointerEvent) => {
    if (event.pointerId !== this.pointer) return;
    const { point, zoom } = this.coordinates(event);
    this.pointer = undefined;
    this.session.release(point, event.pointerId, zoom);
    if (this.host.hasPointerCapture(event.pointerId)) this.host.releasePointerCapture(event.pointerId);
    this.invalidate();
  };
  private cancel = (event: PointerEvent) => {
    if (event.pointerId !== this.pointer) return;
    this.pointer = undefined;
    this.session.execute({ type: 'cancel-input' });
    if (this.host.hasPointerCapture(event.pointerId)) this.host.releasePointerCapture(event.pointerId);
  };
  private end = () => {
    const pointer = this.pointer;
    this.pointer = undefined;
    this.session.end();
    if (pointer !== undefined && this.host.hasPointerCapture(pointer)) this.host.releasePointerCapture(pointer);
    this.invalidate();
  };
  private visibilityChanged = () => {
    if (document.hidden) { this.end(); cancelAnimationFrame(this.frame); this.frame = 0; }
    else this.invalidate();
  };

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.unsubscribe();
    this.observer.disconnect();
    this.session.dispose();
    this.host.removeEventListener('pointerdown', this.begin);
    this.host.removeEventListener('lostpointercapture', this.cancel);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.release);
    window.removeEventListener('pointercancel', this.cancel);
    window.removeEventListener('blur', this.end);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    window.removeEventListener('resize', this.invalidate);
    window.removeEventListener('scroll', this.invalidate, true);
    if (this.pointer !== undefined && this.host.hasPointerCapture(this.pointer)) this.host.releasePointerCapture(this.pointer);
    this.viewport.destroy();
    releaseStickerDefinitions();
  }
}
