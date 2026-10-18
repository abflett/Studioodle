import { Artwork } from '../../editor/Artwork';
import { StrokeSmoothing } from '../../editor/strokeSmoothing';
import { defaultBrush, defaultFill } from '../../editor/toolOptions';
import { Scene } from 'phaser';
import type { GameObjects, Input } from 'phaser';
import type { EditorBridge, EditorTool } from '../../editor/bridge';
import type { EditorSetup } from '../../editor/setup';
import { initialDrawingSettings } from '../../editor/setup';
import { paperSize } from '../../editor/document';
import type { ArtworkDocument, Point } from '../../editor/document';
import { savePicture } from '../../editor/storage';
import { VectorViewport } from '../VectorViewport';
import { releaseStickerDefinitions } from '../../editor/vectorStickers';

export class StudioScene extends Scene {
  private selection?: GameObjects.Graphics;
  private document!: Artwork;
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
  private vectorViewport?: VectorViewport;
  constructor(private readonly bridge: EditorBridge, private readonly setup: EditorSetup) {
    super('Studio');
    const initial = initialDrawingSettings(setup);
    this.color = initial.color; this.tool = initial.tool;
    if (!setup.id) throw new Error('An editor document must have an ID before opening.');
  }
  create() {
    const size = paperSize(this.setup.format, this.setup.size);
    this.document = this.setup.document ? Artwork.restore(this.setup.document) : Artwork.create(size.width, size.height, this.setup.background);
    this.selection = this.add.graphics();
    this.vectorViewport = new VectorViewport(this.game.canvas, size.width, size.height);
    const unsubscribe = this.bridge.subscribe((command) => {
      if (command.type === 'save') {
        try {
          savePicture({ id: this.setup.id!, title: this.setup.title, format: this.setup.format, size, background: this.setup.background, leafColor: this.setup.leafColor,
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
        this.end(false); this.draw(); return;
      }
      this.end();
      if (this.focused && ['add-sticker', 'duplicate-selection', 'delete-selection', 'order-selection', 'clear-selection'].includes(command.type)) return;
      if (command.type === 'exit-focus') {
        this.focused = undefined; this.selected = undefined;
        this.document.setFocus(); this.tool = 'bucket';
      }
      if (command.type === 'fill-at' && this.tool === 'bucket') {
        this.pending = this.document.serialize();
        if (this.document.fill(command.point, this.color, this.fillOptions)) this.changed();
        this.pending = undefined;
      }
      if (command.type === 'order-selection' && this.selected) {
        this.pending = this.document.serialize();
        if (this.document.reorder(this.selected, command.direction)) this.changed();
        this.pending = undefined;
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
        this.pending = this.document.serialize();
        if (this.document.transform(this.selected, command.scaleDelta, command.rotationDelta)) this.changed();
        this.pending = undefined;
      }
      if (command.type === 'flip-selection' && this.selected) {
        this.pending = this.document.serialize();
        if (this.document.flip(this.selected, command.axis)) this.changed();
        this.pending = undefined;
      }
      if (command.type === 'set-color') this.color = command.color;
      if (command.type === 'set-brush') this.brushOptions = command.options;
      if (command.type === 'set-fill') this.fillOptions = command.options;
      if (command.type === 'set-tool') { this.tool = command.tool; this.selected = this.focused; }
      if (command.type === 'clear-selection') { this.selected = undefined; this.tool = 'bucket'; }
      if ((command.type === 'duplicate-selection' || command.type === 'delete-selection') && this.selected) {
        this.pending = this.document.serialize(); this.changed();
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
        this.pending = this.document.serialize(); this.changed();
        this.selected = this.document.add(command.sticker, command.outlineColor, {
          x: Math.max(0, Math.min(size.width - 1, command.point.x)),
          y: Math.max(0, Math.min(size.height - 1, command.point.y)),
        });
        this.tool = 'select';
      }
      this.draw();

    });
    this.input.on('pointerdown', this.begin, this);
    this.input.on('pointermove', this.move, this);
    this.input.on('pointerup', this.release, this);
    this.input.on('pointerupoutside', this.release, this);
    this.game.events.on('blur', this.end, this);
    const cleanup = () => {
      this.vectorViewport?.destroy(); this.vectorViewport = undefined;
      releaseStickerDefinitions();
      unsubscribe();
      this.input.off('pointerdown', this.begin, this); this.input.off('pointermove', this.move, this);
      this.input.off('pointerup', this.release, this); this.input.off('pointerupoutside', this.release, this);
      this.game.events.off('blur', this.end, this);
    };
    this.events.once('shutdown', cleanup); this.events.once('destroy', cleanup);
    this.draw();
  }
  update(time: number) {
    this.vectorViewport?.render(this.document);
    if (this.tool !== 'brush' || this.brushOptions.kind !== 'spray' || !this.previous || this.activePointer === undefined || time < this.nextSpray) return;
    this.nextSpray = time + 40;
    if (this.document.brush(this.previous, this.previous, this.color, false, this.brushOptions)) { this.changed(); this.draw(); }
  }
  private changed() {
    if (!this.pending) return;
    this.history.push(this.pending); this.pending = undefined;
    if (this.history.length > 50) {
      this.history.shift();
      if (this.focused) this.focusHistoryStart = Math.max(0, this.focusHistoryStart - 1);
    }
  }
  private point(pointer: Input.Pointer) { return { x: pointer.x, y: pointer.y }; }
  private begin(pointer: Input.Pointer) {
    if ((pointer.button !== 0 && pointer.button !== 2) || this.activePointer !== undefined || this.tool === 'pan' || this.tool === 'bucket') return;
    this.activePointer = pointer.id;
    const snapshot = this.document.serialize();
    this.gestureUndo = { document: snapshot, history: this.history.slice(), selected: this.selected, tool: this.tool, focusHistoryStart: this.focusHistoryStart };
    const point = this.point(pointer);
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
      if (this.document.brush(point, point, this.color, this.tool === 'erase', this.brushOptions)) this.changed();
    }
    this.draw();
  }
  private move(pointer: Input.Pointer) {
    if (pointer.id !== this.activePointer) return;
    if (!pointer.isDown) { this.end(); return; }
    const point = this.point(pointer);
    if (this.drag) {
      const old = this.document.position(this.drag.id)!;
      const next = { x: point.x - this.drag.dx, y: point.y - this.drag.dy };
      this.document.move(this.drag.id, next);
      const actual = this.document.position(this.drag.id)!;
      if (old.x !== actual.x || old.y !== actual.y) this.changed();
    } else if (this.previous) {
      this.paintStroke(point);
    }
    this.draw();
  }
  private paintStroke(point: Point) {
    const points = this.stroke ? this.stroke.append(point, 6 / Math.max(.01, this.scale.zoom)) : [point];
    for (const next of points) {
      if (!this.previous) break;
      if (this.document.brush(this.previous, next, this.color, this.tool === 'erase', this.brushOptions)) this.changed();
      this.previous = next;
    }
  }
  private release(pointer: Input.Pointer) {
    if (pointer.id !== this.activePointer) return;
    if (this.previous && this.stroke) this.paintStroke(this.point(pointer));
    this.end();
  }
  private end(flush = true) {
    const hadStroke = this.stroke !== undefined;
    let changed = false;
    if (flush && this.stroke && this.previous) {
      const tip = this.stroke.finish();
      if (tip.x !== this.previous.x || tip.y !== this.previous.y)
        changed = this.document.brush(this.previous, tip, this.color, false, this.brushOptions);
      if (changed) this.changed();
    }
    this.stroke = undefined; this.gestureUndo = undefined; this.previous = undefined;
    this.drag = undefined; this.pending = undefined; this.activePointer = undefined;
    // Include the release position even when the tail writes no additional pixels.
    if (flush && hadStroke) this.draw();
  }
  private draw() {
    this.vectorViewport?.render(this.document, true);
    this.selection?.clear();
    const bounds = this.selected ? this.document.bounds(this.selected) : undefined;
    if (bounds && this.tool === 'select') this.selection?.lineStyle(3, 0x549bd1).strokeRoundedRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10, 8);
    this.bridge.selectionChanged(this.selected, this.focused ? { forward: false, backward: false } : this.document.selectionOrder(this.selected));
    this.bridge.toolChanged(this.tool);
    this.bridge.focusChanged(this.focused);
  }
}


