import { Artwork } from './Artwork';
import { StrokeSmoothing } from './strokeSmoothing';
import { defaultBrush, defaultFill } from './toolOptions';
import type { EditorCommand, EditorTool } from './bridge';
import { initialDrawingSettings } from './setup';
import type { EditorSetup } from './setup';
import { paperSize } from './document';
import type { ArtworkDocument, Point } from './document';
import type { SavedPicture } from './savedPicture';

export type EditorSessionPorts = {
  save: (picture: SavedPicture) => void;
  changed: () => void;
};

/** Editing rules and gesture transactions; no React, Phaser, storage or window APIs. */
export class EditorSession {
  private document: Artwork;
  private history: ArtworkDocument[] = [];
  private pending?: ArtworkDocument;
  private color: number;
  private selected?: string;
  private focused?: string;
  private focusHistoryStart = 0;
  private drag?: { id: string; dx: number; dy: number };
  private tool: EditorTool = 'bucket';
  private brushOptions = defaultBrush;
  private fillOptions = defaultFill;
  private previous?: Point;
  private stroke?: StrokeSmoothing;
  private activePointer?: number;
  private gestureUndo?: { document: ArtworkDocument; history: ArtworkDocument[]; selected?: string; tool: EditorTool; focusHistoryStart: number };
  private nextSpray = 0;
  constructor(private readonly setup: EditorSetup, private readonly ports: EditorSessionPorts) {
    if (!setup.id) throw new Error('An editor document must have an ID before opening.');
    const initial = initialDrawingSettings(setup);
    this.color = initial.color;
    this.tool = initial.tool;
    const size = paperSize(setup.format, setup.size);
    this.document = setup.document ? Artwork.restore(setup.document) : Artwork.create(size.width, size.height, setup.background);
  }

  get artwork() { return this.document; }
  get state() {
    return {
      tool: this.tool, selected: this.selected, focused: this.focused,
      bounds: this.selected ? this.document.bounds(this.selected) : undefined,
      order: this.focused ? { forward: false, backward: false } : this.document.selectionOrder(this.selected),
    };
  }

  execute(command: EditorCommand) {
    const size = paperSize(this.setup.format, this.setup.size);
    if (command.type === 'save') {
      try {
        this.ports.save({ id: this.setup.id!, title: this.setup.title, format: this.setup.format, size, background: this.setup.background, leafColor: this.setup.leafColor,
          version: 3, updatedAt: Date.now(), document: this.document.serialize() });
        command.onComplete(true);
      } catch { command.onComplete(false); }
      return;
    }
    if (command.type === 'cancel-input') {
      const before = this.gestureUndo;
      if (before) {
        this.document = Artwork.restore(before.document); this.document.setFocus(this.focused);
        this.history = before.history; this.selected = before.selected; this.tool = before.tool;
        this.focusHistoryStart = before.focusHistoryStart;
      }
      this.end(false); this.notifyChanged(); return;
    }
    this.end();
    if (this.focused && ['add-sticker', 'duplicate-selection', 'delete-selection', 'order-selection', 'clear-selection'].includes(command.type)) return;
    if (command.type === 'exit-focus') {
      this.focused = undefined; this.selected = undefined;
      this.document.setFocus(); this.tool = 'bucket';
    }
    if (command.type === 'fill-at' && this.tool === 'bucket') {
      this.edit(() => this.document.fill(command.point, this.color, this.fillOptions));
    }
    if (command.type === 'order-selection' && this.selected) {
      const selected = this.selected;
      this.edit(() => this.document.reorder(selected, command.direction));
    }
    if (command.type === 'focus-selection' && this.selected) {
      const bounds = this.document.bounds(this.selected);
      if (bounds) {
        if (!this.focused) this.focusHistoryStart = this.history.length;
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
    if (command.type === 'set-color') this.color = command.color;
    if (command.type === 'set-brush') this.brushOptions = command.options;
    if (command.type === 'set-fill') this.fillOptions = command.options;
    if (command.type === 'set-tool') { this.tool = command.tool; this.selected = this.focused; }
    if (command.type === 'clear-selection') { this.selected = undefined; this.tool = 'bucket'; }
    if ((command.type === 'duplicate-selection' || command.type === 'delete-selection') && this.selected) {
      this.pending = this.document.serialize(); this.recordChange();
      if (command.type === 'duplicate-selection') this.selected = this.document.duplicate(this.selected);
      else { this.document.remove(this.selected); this.selected = undefined; this.tool = 'bucket'; }
    }
    if (command.type === 'undo' && (!this.focused || this.history.length > this.focusHistoryStart)) {
      const snapshot = this.history.pop();
      if (snapshot) this.document = Artwork.restore(snapshot);
      this.document.setFocus(this.focused);
      this.selected = this.focused;
      if (this.tool === 'select') this.tool = 'bucket';
    }
    if (command.type === 'add-sticker') {
      this.pending = this.document.serialize(); this.recordChange();
      this.selected = this.document.add(command.sticker, command.outlineColor, {
        x: Math.max(0, Math.min(size.width - 1, command.point.x)),
        y: Math.max(0, Math.min(size.height - 1, command.point.y)),
      });
      this.tool = 'select';
    }
    this.notifyChanged();
  }
  update(time: number) {
    if (this.tool !== 'brush' || this.brushOptions.kind !== 'spray' || !this.previous || this.activePointer === undefined || time < this.nextSpray) return;
    this.nextSpray = time + 40;
    if (this.document.brush(this.previous, this.previous, this.color, false, this.brushOptions)) { this.recordChange(); this.notifyChanged(); }
  }
  /** One undo snapshot per command, shared with the gesture transaction path. */
  private edit(change: () => boolean) {
    this.pending = this.document.serialize();
    try { if (change()) this.recordChange(); }
    finally { this.pending = undefined; }
  }

  private recordChange() {
    if (!this.pending) return;
    this.history.push(this.pending); this.pending = undefined;
    if (this.history.length > 50) {
      this.history.shift();
      if (this.focused) this.focusHistoryStart = Math.max(0, this.focusHistoryStart - 1);
    }
  }
  begin(point: Point, pointerId: number, button: number) {
    if ((button !== 0 && button !== 2) || this.activePointer !== undefined || this.tool === 'pan' || this.tool === 'bucket') return;
    this.activePointer = pointerId;
    const snapshot = this.document.serialize();
    this.gestureUndo = { document: snapshot, history: this.history.slice(), selected: this.selected, tool: this.tool, focusHistoryStart: this.focusHistoryStart };
    if (this.tool === 'select') {
      this.selected = this.focused
        ? (this.document.pick(point) === this.focused ? this.focused : undefined)
        : this.document.pick(point);
      if (this.selected) {
        const position = this.document.position(this.selected)!;
        this.pending = snapshot;
        this.drag = { id: this.selected, dx: point.x - position.x, dy: point.y - position.y };
      } else { this.selected = this.focused; if (!this.focused) this.tool = 'bucket'; }
    } else {
      this.pending = snapshot;
      this.previous = point;
      this.stroke = this.tool === 'brush' && this.brushOptions.kind !== 'spray' ? new StrokeSmoothing(point) : undefined;
      if (this.document.brush(point, point, this.color, this.tool === 'erase', this.brushOptions)) this.recordChange();
    }
    this.notifyChanged();
  }
  move(point: Point, pointerId: number, isDown: boolean, zoom: number) {
    if (pointerId !== this.activePointer) return;
    if (!isDown) { this.end(); return; }
    if (this.drag) {
      const old = this.document.position(this.drag.id)!;
      const next = { x: point.x - this.drag.dx, y: point.y - this.drag.dy };
      this.document.move(this.drag.id, next);
      const actual = this.document.position(this.drag.id)!;
      if (old.x !== actual.x || old.y !== actual.y) this.recordChange();
    } else if (this.previous) {
      this.paintStroke(point, zoom);
    }
    this.notifyChanged();
  }
  private paintStroke(point: Point, zoom: number) {
    const points = this.stroke ? this.stroke.append(point, 6 / Math.max(.01, zoom)) : [point];
    for (const next of points) {
      if (!this.previous) break;
      if (this.document.brush(this.previous, next, this.color, this.tool === 'erase', this.brushOptions)) this.recordChange();
      this.previous = next;
    }
  }
  release(point: Point, pointerId: number, zoom: number) {
    if (pointerId !== this.activePointer) return;
    if (this.previous && this.stroke) this.paintStroke(point, zoom);
    this.end();
  }
  end(flush = true) {
    const hadStroke = this.stroke !== undefined;
    let changed = false;
    if (flush && this.stroke && this.previous) {
      const tip = this.stroke.finish();
      if (tip.x !== this.previous.x || tip.y !== this.previous.y)
        changed = this.document.brush(this.previous, tip, this.color, false, this.brushOptions);
      if (changed) this.recordChange();
    }
    this.stroke = undefined; this.gestureUndo = undefined; this.previous = undefined;
    this.drag = undefined; this.pending = undefined; this.activePointer = undefined;
    // Include the release position even when the tail writes no additional pixels.
    if (flush && hadStroke) this.notifyChanged();
  }
  private notifyChanged() { this.ports.changed(); }
}
