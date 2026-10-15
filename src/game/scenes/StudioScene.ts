import { Scene } from 'phaser';
import type { GameObjects, Input } from 'phaser';
import type { EditorBridge, EditorTool } from '../../editor/bridge';
import type { EditorSetup } from '../../editor/setup';

import { paperSize } from '../../editor/document';
import type { Mark } from '../../editor/document';
import { savePicture } from '../../editor/storage';
export class StudioScene extends Scene {
  private artwork?: GameObjects.Graphics;
  private marks: Mark[] = [];
  private history: Mark[][] = [];
  private color: number;
  private selected?: Exclude<Mark, { kind: 'stroke' }>;
  private drag?: { mark: Exclude<Mark, { kind: 'stroke' }>; dx: number; dy: number; remembered: boolean };
  private tool: EditorTool = 'bucket';
  private stroke?: Extract<Mark, { kind: 'stroke' }>;
  constructor(private readonly bridge: EditorBridge, private readonly setup: EditorSetup) {
    super('Studio');
    this.color = setup.leafColor;
    if (!setup.id) throw new Error('An editor document must have an ID before opening.');
  }
  create() {
    this.cameras.main.setBackgroundColor(this.setup.background);
    this.artwork = this.add.graphics();
    const size = paperSize(this.setup.format);
    this.marks = this.setup.marks ? structuredClone(this.setup.marks) : this.setup.title === 'Blank page' ? [] : [{ kind: 'tree', x: size.width / 2, y: size.height / 2, color: this.color }];
    const unsubscribe = this.bridge.subscribe((command) => {
      this.stroke = undefined;
      this.drag = undefined;
      if (command.type === 'set-color') this.color = command.color;
      if (command.type === 'set-tool') this.tool = command.tool;
      if (command.type === 'undo') { this.marks = this.history.pop() ?? this.marks; this.selected = undefined; }
      if (command.type === 'add-sticker') {
        this.remember();
        const offset = this.marks.filter((mark) => mark.kind !== 'stroke').length % 5;
        this.marks.push({ kind: command.sticker, x: Math.min(size.width - 110, 200 + offset * 100), y: Math.min(size.height - 130, 300 + (offset % 2) * 100), color: this.color });
      }
      this.draw();
      if (command.type === 'save') {
        try {
          savePicture({ ...this.setup, id: this.setup.id!, version: 1, updatedAt: Date.now(), marks: this.marks });
          command.onComplete(true);
        } catch { command.onComplete(false); }
      }
    });
    this.input.on('pointerdown', this.begin, this);
    this.input.on('pointermove', this.move, this);
    this.input.on('pointerup', this.end, this);
    this.input.on('pointerupoutside', this.end, this);
    this.scale.on('resize', this.draw, this);
    const cleanup = () => {
      unsubscribe();
      this.scale.off('resize', this.draw, this);
      this.input.off('pointerdown', this.begin, this);
      this.input.off('pointermove', this.move, this);
      this.input.off('pointerup', this.end, this);
      this.input.off('pointerupoutside', this.end, this);
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
    this.draw();
  }
  private remember() {
    this.history.push(structuredClone(this.marks));
    if (this.history.length > 50) this.history.shift();
  }
  private point(pointer: Input.Pointer) { return { x: pointer.x, y: pointer.y }; }
  private begin(pointer: Input.Pointer) {
    const point = this.point(pointer);
    if (this.tool === 'pan') return;
    if (this.tool === 'inspect' || this.tool === 'move') {
      this.selected = [...this.marks].reverse().find((mark): mark is Exclude<Mark, { kind: 'stroke' }> => mark.kind !== 'stroke' && Math.abs(mark.x - point.x) < 100 && Math.abs(mark.y - point.y) < 125);
      if (this.selected && this.tool === 'move') this.drag = { mark: this.selected, dx: point.x - this.selected.x, dy: point.y - this.selected.y, remembered: false };
      this.draw(); return;
    }
    if (this.tool === 'brush') {
      this.remember();
      this.stroke = { kind: 'stroke', color: this.color, points: [point] };
      this.marks.push(this.stroke);
    } else {
      const hit = [...this.marks].reverse().find((mark) => mark.kind !== 'stroke' && Math.abs(mark.x - point.x) < 100 && Math.abs(mark.y - point.y) < 125);
      if (hit && hit.color !== this.color) { this.remember(); hit.color = this.color; }
    }
    this.draw();
  }
  private move(pointer: Input.Pointer) {
    if (!pointer.isDown) { this.end(); return; }
    if (this.drag) {
      if (!this.drag.remembered) { this.remember(); this.drag.remembered = true; }
      const p = this.point(pointer), size = paperSize(this.setup.format);
      this.drag.mark.x = Math.max(100, Math.min(size.width - 100, p.x - this.drag.dx));
      this.drag.mark.y = Math.max(125, Math.min(size.height - 125, p.y - this.drag.dy));
      this.draw(); return;
    }
    if (!this.stroke) return;
    this.stroke.points.push(this.point(pointer));
    this.draw();
  }
  private end() { this.stroke = undefined; this.drag = undefined; }
  private draw() {
    const art = this.artwork;
    if (!art) return;
    art.clear();
    for (const mark of this.marks) {
      if (mark.kind === 'stroke') {
        art.lineStyle(10, mark.color).fillStyle(mark.color);
        const first = mark.points[0];
        if (!first) continue;
        art.beginPath().moveTo(first.x, first.y);
        for (const point of mark.points) art.lineTo(point.x, point.y);
        art.strokePath();
        for (const point of mark.points) art.fillCircle(point.x, point.y, 5);
      } else {
        const { x, y } = mark;
        art.lineStyle(5, 0x39483e);
        if (mark.kind === 'tree') {
          art.fillStyle(0xc99569).fillRoundedRect(x - 22, y, 44, 120, 8).strokeRoundedRect(x - 22, y, 44, 120, 8);
          art.fillStyle(mark.color).fillRoundedRect(x - 95, y - 110, 190, 160, 65).strokeRoundedRect(x - 95, y - 110, 190, 160, 65);
        } else if (mark.kind === 'circle') {
          art.fillStyle(mark.color).fillCircle(x, y, 80).strokeCircle(x, y, 80);
        } else if (mark.kind === 'square') {
          art.fillStyle(mark.color).fillRect(x - 80, y - 80, 160, 160).strokeRect(x - 80, y - 80, 160, 160);
        } else if (mark.kind === 'triangle') {
          art.fillStyle(mark.color).fillTriangle(x, y - 85, x - 85, y + 75, x + 85, y + 75).strokeTriangle(x, y - 85, x - 85, y + 75, x + 85, y + 75);
        } else {
          art.lineStyle(12, 0x87b999).lineBetween(x, y, x, y + 120);
          art.lineStyle(5, 0x39483e).fillStyle(mark.color);
          for (let i = 0; i < 5; i++) {
            const angle = i * Math.PI * 2 / 5 - Math.PI / 2;
            const px = x + Math.cos(angle) * 42, py = y + Math.sin(angle) * 42;
            art.fillCircle(px, py, 32).strokeCircle(px, py, 32);
          }
          art.fillStyle(0xe7c46e).fillCircle(x, y, 26).strokeCircle(x, y, 26);
        }
      }
    }
    if (this.selected && (this.tool === 'inspect' || this.tool === 'move')) art.lineStyle(3, 0x549bd1).strokeRoundedRect(this.selected.x - 105, this.selected.y - 130, 210, 260, 14);
  }
}


