import { Scene } from 'phaser';
import type { GameObjects } from 'phaser';
import type { EditorBridge } from '../../editor/bridge';

// An integration preview, not the painting/document engine.
export class StudioScene extends Scene {
  private leafColor: number;
  private artwork?: GameObjects.Graphics;

  constructor(private readonly bridge: EditorBridge, private readonly initialColor: number) {
    super('Studio');
    this.leafColor = initialColor;
  }

  create() {
    this.artwork = this.add.graphics();
    const unsubscribe = this.bridge.subscribe((command) => {
      this.leafColor = command.type === 'set-color' ? command.color : this.initialColor;
      this.drawPreview();
    });
    this.scale.on('resize', this.drawPreview, this);
    this.events.once('shutdown', () => {
      unsubscribe();
      this.scale.off('resize', this.drawPreview, this);
    });
    this.drawPreview();
  }

  private drawPreview() {
    const art = this.artwork;
    if (!art) return;
    const { width, height } = this.scale;
    const size = Math.min(width / 420, height / 360, 1.4);
    art.clear().setPosition(width / 2, height / 2).setScale(size);
    art.fillStyle(0x000000, 0.08).fillEllipse(0, 122, 190, 25);
    art.lineStyle(5, 0x39483e, 1);
    art.fillStyle(0xc99569).fillRoundedRect(-22, 0, 44, 120, 8);
    art.strokeRoundedRect(-22, 0, 44, 120, 8);
    art.fillStyle(this.leafColor).fillRoundedRect(-95, -110, 190, 160, 65);
    art.strokeRoundedRect(-95, -110, 190, 160, 65);
  }
}
