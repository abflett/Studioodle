import { definedColor, slotColor } from './colorPalettes';
import { Artwork } from './Artwork';
import { UndoHistory } from './UndoHistory';
import { preparePaintWorker } from './paintWorker';
import { StrokeSmoothing } from './strokeSmoothing';
import { defaultBrush } from './toolOptions';
import type { EditorCommand, EditorTool } from './bridge';
import { initialDrawingSettings } from './setup';
import type { EditorSetup } from './setup';
import { paperSize } from './document';
import type { Point } from './document';
import type { SavedPicture } from './savedPicture';
import type { ArtworkChange } from './artworkChange';

export type EditorSessionPorts = {
  save: (picture: SavedPicture, prepare?: () => Promise<SavedPicture>) => void|Promise<void>;
  autoSave?: boolean;
  failed?: (message: string) => void;
  changed: () => void;
};

/** Editing rules and gesture transactions; no UI framework, storage or window APIs. */
export class EditorSession {
  private document: Artwork;
  private disposed = false;
  private readonly history = new UndoHistory();
  private revision = 0;
  private nextRevision = 0;
  private savedRevision = 0;
  private lastRequestedRevision = 0;
  private savesPending = 0;
  private lastSave?: { revision: number; result: Promise<boolean> };
  private lastSnapshotTime = 0;
  private readonly previousRevisions = new WeakMap<ArtworkChange, number>();
  private color: number;
  private selected?: string;
  private focused?: string;
  private focusHistoryStart = 0;
  private drag?: { id: string; dx: number; dy: number };
  private tool: EditorTool = 'bucket';
  private brushOptions = defaultBrush;
  private previous?: Point;
  private stroke?: StrokeSmoothing;
  private activePointer?: number;
  private selectionExit = false;
  private gestureUndo?: { selected?: string; tool: EditorTool };
  private nextSpray = 0;
  private nextSmoothing = 0;
  private strokeTrail = 2;
  private pendingOperation?: Promise<void>;
  private deferred: (()=>void)[] = [];
  private defer(action:()=>void){if(!this.pendingOperation)return false;this.deferred.push(action);return true;}
  constructor(private readonly setup: EditorSetup, private readonly ports: EditorSessionPorts) {
    if (!setup.id) throw new Error('An editor document must have an ID before opening.');
    if ('updatedAt' in setup && typeof setup.updatedAt === 'number') this.lastSnapshotTime = setup.updatedAt;
    preparePaintWorker();
    const initial = initialDrawingSettings(setup);
    this.color = initial.color;
    this.tool = initial.tool;
    const size = paperSize(setup.format, setup.size);
    this.document = setup.document ? Artwork.restore(setup.document) : Artwork.create(size.width, size.height, setup.background);
  }

  get customColors() { return this.document.customColors; }
  get activeColor() { return this.color; }
  get artwork() { return this.document; }
  get state() {
    return {
      tool: this.tool, selected: this.selected, focused: this.focused,
      bounds: this.selected ? this.document.bounds(this.selected) : undefined,
      order: this.focused ? { forward: false, backward: false } : this.document.selectionOrder(this.selected),
    };
  }

  execute(command: EditorCommand) {
    if (this.disposed) return;
    if(this.defer(()=>this.execute(command)))return;
    const size = paperSize(this.setup.format, this.setup.size);
    if (command.type === 'snapshot') {
      this.end();
      command.onComplete(this.snapshot());
      return;
    }
    if (command.type === 'save') {
      this.end();
      if (this.revision === this.savedRevision && this.revision === this.lastRequestedRevision && !this.savesPending) { command.onComplete(true, false); return; }
      const written = this.lastSave?.revision !== this.revision;
      void this.saveCurrent().then(ok => command.onComplete(ok, ok && written));
      return;
    }
    if (command.type === 'leave') {
      this.end();
      command.onComplete();
      return;
    }
    if (command.type === 'cancel-input') {
      const before = this.gestureUndo;
      this.end(false);
      if (before) { this.selected = before.selected; this.tool = before.tool; }
      this.notifyChanged(); return;
    }
    this.end();
    if (this.focused && ['add-sticker', 'duplicate-selection', 'delete-selection', 'order-selection', 'clear-selection'].includes(command.type)) return;
    if (command.type === 'exit-focus') {
      this.focused = undefined; this.selected = undefined;
      this.document.setFocus(); this.tool = 'bucket';
    }
    if (command.type === 'fill-at' && this.tool === 'bucket') {
      this.document.beginChange();
      const failed = (error: unknown) => {
        if (!this.disposed) {
          this.document.undoChange(this.document.endChange());
          this.notifyChanged();
        }
        if(!this.disposed)this.ports.failed?.('Could not fill this area. Your previous paint is safe. Try again or save your picture.');
        console.error('Vector bucket fill failed; paint was preserved.', error);
      };
      let result: boolean | Promise<boolean>;
      try { result = this.document.fill(command.point, this.color); }
      catch (error) { failed(error); return; }
      const finish=(changed:boolean)=>{if(this.disposed)return;const change=this.document.endChange();if(changed)this.recordChange(change);this.notifyChanged();};
      if(typeof result==='boolean')finish(result);
      else this.pendingOperation=result.then(finish).catch(failed).finally(()=>{
        this.pendingOperation=undefined;
        while(!this.pendingOperation&&this.deferred.length)this.deferred.shift()!();
      });
    }
    if (command.type === 'order-selection' && this.selected) {
      const selected = this.selected;
      this.edit(() => this.document.reorder(selected, command.direction));
    }
    if (command.type === 'focus-selection' && this.selected) {
      const bounds = this.document.bounds(this.selected);
      if (bounds) {
        if (!this.focused) this.focusHistoryStart = this.history.mark();
        this.focused = this.selected;
        this.document.setFocus(this.focused);
        this.tool = 'bucket';
        command.onFocus(bounds);
      }
    }
    if (command.type === 'transform-selection' && this.selected) {
      const selected = this.selected;
      this.edit(() => this.document.transform(selected, command.scaleDelta, command.rotationDelta));
    }
    if (command.type === 'flip-selection' && this.selected) {
      const selected = this.selected;
      this.edit(() => this.document.flip(selected, command.axis));
    }
    if (command.type === 'set-color' && definedColor(command.color, this.document.customColors)) this.color = command.color;
    if (command.type === 'set-custom-color') this.edit(() => this.document.setCustomColor(command.index, command.color));
    if (command.type === 'set-brush') this.brushOptions = command.options;
    if (command.type === 'set-tool') { this.tool = command.tool; this.selected = this.focused; }
    if (command.type === 'clear-selection') { this.selected = undefined; this.tool = 'bucket'; }
    if ((command.type === 'duplicate-selection' || command.type === 'delete-selection') && this.selected) {
      this.edit(() => {
        if (command.type === 'duplicate-selection') this.selected = this.document.duplicate(this.selected!);
        else { this.document.remove(this.selected!); this.selected = undefined; this.tool = 'bucket'; }
        return true;
      });
    }
    if (command.type === 'undo') {
      const change = this.history.pop(this.focused ? this.focusHistoryStart : 0);
      if (change) {
        this.document.undoChange(change);
        this.revision = this.previousRevisions.get(change)!;
        this.autoSave();
      }
      this.document.setFocus(this.focused);
      this.selected = this.focused;
      if (this.tool === 'select') this.tool = 'bucket';
    }
    if (command.type === 'add-sticker') {
      this.edit(() => {
        this.selected = this.document.add(command.sticker, command.outlineColor, {
          x: Math.max(0, Math.min(size.width - 1, command.point.x)),
          y: Math.max(0, Math.min(size.height - 1, command.point.y)),
        });
        return true;
      });
      this.tool = 'select';
    }
    this.notifyChanged();
  }
  private snapshot(document = this.document.serialize()): SavedPicture {
    this.lastSnapshotTime = Math.max(Date.now(), this.lastSnapshotTime + 1);
    return { id: this.setup.id!, title: this.setup.title, format: this.setup.format, size: paperSize(this.setup.format, this.setup.size),
      background: this.setup.background, leafColor: this.setup.leafColor, version: document.version, updatedAt: this.lastSnapshotTime, document };
  }
  private autoSave() { if (this.ports.autoSave) void this.saveCurrent(); }
  private saveCurrent(): Promise<boolean> {
    if (this.lastSave?.revision === this.revision) return this.lastSave.result;
    if (this.revision === this.savedRevision && this.revision === this.lastRequestedRevision && !this.savesPending) return Promise.resolve(true);
    const revision = this.revision;
    const checkpoint = this.document.checkpoint();
    const picture = this.snapshot(checkpoint.document);
    this.lastRequestedRevision = revision;
    this.savesPending++;
    // The queue receives the checkpoint immediately, including for Home previews.
    let saving: void | Promise<void>;
    try { saving = this.ports.save(picture, async () => ({ ...picture, document: await checkpoint.compact() })); }
    catch { saving = Promise.reject(Error('Could not save drawing.')); }
    const result = Promise.resolve(saving).then(() => { this.savedRevision = revision; return true; }, () => {
      if (this.lastSave?.revision === revision) this.lastSave = undefined;
      return false;
    }).finally(() => { this.savesPending--; });
    this.lastSave = { revision, result };
    return result;
  }
  get needsAnimation() { return !this.disposed && !this.pendingOperation && this.activePointer !== undefined && ((this.tool === 'brush' && this.brushOptions.tip === 'scatter') || !!this.stroke?.remaining); }
  dispose() {
    this.disposed = true;
    this.deferred = [];
    this.history.clear();
    this.gestureUndo = undefined;
    this.stroke = undefined; this.previous = undefined; this.drag = undefined;
    this.activePointer = undefined;
    this.selectionExit = false;
    this.document.dispose();
  }
  update(time: number) {
    if(this.disposed||this.pendingOperation)return;
    if(this.stroke&&this.previous&&this.activePointer!==undefined&&time>=this.nextSmoothing){
      this.applyStrokePoints(this.stroke.settle(this.strokeTrail));
      this.nextSmoothing=time+12;this.notifyChanged();
    }
    if (this.tool !== 'brush' || this.brushOptions.tip !== 'scatter' || !this.previous || this.activePointer === undefined || time < this.nextSpray) return;
    this.nextSpray = time + 40;
    if (this.paint(this.previous, this.previous, this.color, false, this.brushOptions)) { this.notifyChanged(); }
  }
  /** A failed brush/eraser gesture restores only its affected sections/regions. */
  private paint(from:Point,to:Point,color:number,erase:boolean,options=this.brushOptions) {
    try { return this.document.brush(from,to,color,erase,options); }
    catch(error) {
      const before=this.gestureUndo;
      this.document.undoChange(this.document.endChange());
      this.stroke=undefined;this.previous=undefined;this.drag=undefined;this.activePointer=undefined;
      this.selectionExit=false;this.gestureUndo=undefined;
      if(before){this.selected=before.selected;this.tool=before.tool;}
      this.ports.failed?.('Could not finish this stroke. It was undone. Try again or save your picture.');
      console.error('Brush gesture failed; previous artwork was restored.',error);
      this.notifyChanged();return false;
    }
  }
  /** Geometry edits retain previous values only for the parts they actually change. */
  private recordChange(change: ArtworkChange) {
    if (change.empty) return;
    this.previousRevisions.set(change, this.revision);
    this.revision = ++this.nextRevision;
    this.history.push(change);
    this.autoSave();
  }
  private edit(change: () => boolean) {
    this.document.beginChange();
    try {
      const changed=change(),before=this.document.endChange();
      if(changed)this.recordChange(before);
    } catch(error) { this.document.undoChange(this.document.endChange()); throw error; }
  }
  begin(point: Point, pointerId: number, button: number) {
    if(this.disposed)return;
    if(this.defer(()=>this.begin(point,pointerId,button)))return;
    if ((button !== 0 && button !== 2) || this.activePointer !== undefined || this.tool === 'pan' || this.tool === 'bucket') return;
    this.activePointer = pointerId;
    this.document.beginChange();
    this.gestureUndo = { selected: this.selected, tool: this.tool };
    if (this.tool === 'select') {
      const picked = this.document.pick(point);
      const bounds = this.selected ? this.document.bounds(this.selected) : undefined;
      const insideBorder = bounds && point.x >= bounds.x - 5 && point.x <= bounds.x + bounds.width + 5 && point.y >= bounds.y - 5 && point.y <= bounds.y + bounds.height + 5;
      this.selected = this.focused
        ? (picked === this.focused ? this.focused : undefined)
        : picked ?? (insideBorder ? this.selected : undefined);
      if (this.selected) {
        const position = this.document.position(this.selected)!;
        this.drag = { id: this.selected, dx: point.x - position.x, dy: point.y - position.y };
      } else {
        this.selected = this.focused;
        // Keep this pointer stream in Select until release, so it cannot also fill.
        this.selectionExit = !this.focused;
      }
    } else {
      this.previous = point;
      this.nextSpray = performance.now() + 40;
      this.stroke = this.tool === 'brush' && this.brushOptions.tip !== 'scatter' ? new StrokeSmoothing(point) : undefined;
      this.paint(point, point, this.color, this.tool === 'erase', this.brushOptions);
    }
    this.notifyChanged();
  }
  move(point: Point, pointerId: number, isDown: boolean, zoom: number) {
    if(this.disposed)return;
    if(this.defer(()=>this.move(point,pointerId,isDown,zoom)))return;
    if (pointerId !== this.activePointer) return;
    if (!isDown) { this.end(); return; }
    if (this.drag) {
      const next = { x: point.x - this.drag.dx, y: point.y - this.drag.dy };
      this.document.move(this.drag.id, next);
    } else if (this.previous) {
      this.paintStroke(point, zoom);
    }
    this.notifyChanged();
  }
  private paintStroke(point: Point, zoom: number) {
    this.strokeTrail=2/Math.max(.01,zoom);
    this.nextSmoothing=performance.now()+12;
    this.applyStrokePoints(this.stroke ? this.stroke.append(point,this.strokeTrail) : [point]);
  }
  private applyStrokePoints(points:Point[]){
    for (const next of points) {
      if (!this.previous) break;
      this.paint(this.previous, next, this.color, this.tool === 'erase', this.brushOptions);
      if(this.activePointer===undefined)break;
      this.previous = next;
    }
  }
  release(point: Point, pointerId: number, zoom: number) {
    if(this.disposed)return;
    if(this.defer(()=>this.release(point,pointerId,zoom)))return;
    if (pointerId !== this.activePointer) return;
    if (this.previous && this.stroke) this.paintStroke(point, zoom);
    this.end();
  }
  end(flush = true) {
    if(this.disposed)return;
    // Blur/visibility can arrive while a bucket transaction awaits the worker.
    // Do not consume that transaction as if it belonged to a pointer gesture.
    if(this.defer(()=>this.end(flush)))return;
    const hadStroke = this.stroke !== undefined;
    if (flush && this.stroke && this.previous) {
      const tip = this.stroke.finish();
      if (tip.x !== this.previous.x || tip.y !== this.previous.y)
        this.paint(this.previous, tip, this.color, false, this.brushOptions);
    }
    const change=this.document.endChange();
    if(flush)this.recordChange(change);else this.document.undoChange(change);
    // Paint maintenance already schedules itself; do not duplicate each save job
    // or force compaction during tool changes and selection-only gestures.
    const selectionExit = this.selectionExit;
    if (flush && selectionExit) this.tool = 'bucket';
    this.selectionExit = false;
    this.stroke = undefined; this.gestureUndo = undefined; this.previous = undefined;
    this.drag = undefined; this.activePointer = undefined;
    // Include the release position even when the tail writes no additional pixels.
    if (flush && (hadStroke || selectionExit)) this.notifyChanged();
  }
  private notifyChanged() { if (!definedColor(this.color, this.document.customColors)) this.color = slotColor(0); this.ports.changed(); }
}
