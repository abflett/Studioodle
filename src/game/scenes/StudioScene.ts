import { Scene } from 'phaser';
import type { GameObjects, Input } from 'phaser';
import type { EditorSessionPorts } from '../../editor/EditorSession';
import { EditorSession } from '../../editor/EditorSession';
import type { EditorBridge } from '../../editor/bridge';
import type { EditorSetup } from '../../editor/setup';
import { paperSize } from '../../editor/document';
import { releaseStickerDefinitions } from '../../editor/vectorStickers';
import { VectorViewport } from '../VectorViewport';

/** Phaser owns pointer adaptation, its selection overlay, and renderer lifecycle. */
export class StudioScene extends Scene {
  private selection?: GameObjects.Graphics;
  private session!: EditorSession;
  private vectorViewport?: VectorViewport;

  constructor(private readonly bridge: EditorBridge, private readonly setup: EditorSetup, private readonly save: EditorSessionPorts['save']) {
    super('Studio');
  }

  create() {
    const size = paperSize(this.setup.format, this.setup.size);
    this.session = new EditorSession(this.setup, {
      save: this.save,
      changed: () => this.draw(),
    });
    this.selection = this.add.graphics();
    this.vectorViewport = new VectorViewport(this.game.canvas, size.width, size.height);
    const unsubscribe = this.bridge.subscribe(command => this.session.execute(command));
    this.input.on('pointerdown', this.begin, this);
    this.input.on('pointermove', this.move, this);
    this.input.on('pointerup', this.release, this);
    this.input.on('pointerupoutside', this.release, this);
    this.game.events.on('blur', this.end, this);
    let disposed = false;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      this.vectorViewport?.destroy(); this.vectorViewport = undefined;
      releaseStickerDefinitions();
      unsubscribe();
      this.input.off('pointerdown', this.begin, this);
      this.input.off('pointermove', this.move, this);
      this.input.off('pointerup', this.release, this);
      this.input.off('pointerupoutside', this.release, this);
      this.game.events.off('blur', this.end, this);
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
    this.draw();
  }

  update(time: number) {
    this.vectorViewport?.render(this.session.artwork);
    this.session.update(time);
  }

  private begin(pointer: Input.Pointer) {
    this.session.begin({ x: pointer.x, y: pointer.y }, pointer.id, pointer.button);
  }
  private move(pointer: Input.Pointer) {
    this.session.move({ x: pointer.x, y: pointer.y }, pointer.id, pointer.isDown, this.scale.zoom);
  }
  private release(pointer: Input.Pointer) {
    this.session.release({ x: pointer.x, y: pointer.y }, pointer.id, this.scale.zoom);
  }
  private end() { this.session.end(); }

  private draw() {
    this.vectorViewport?.render(this.session.artwork, true);
    this.selection?.clear();
    const { bounds, tool, selected, focused, order } = this.session.state;
    if (bounds && tool === 'select') this.selection?.lineStyle(3, 0x549bd1).strokeRoundedRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10, 8);
    this.bridge.selectionChanged(selected, order);
    this.bridge.toolChanged(tool);
    this.bridge.focusChanged(focused);
  }
}
