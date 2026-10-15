import { Game, Scale, WEBGL } from 'phaser';
import type { EditorBridge } from '../editor/bridge';
import { StudioScene } from './scenes/StudioScene';

export function startGame(parent: HTMLElement, bridge: EditorBridge, leafColor: number) {
  return new Game({
    type: WEBGL,
    parent,
    // Let the CSS workspace surface follow the system theme without rebuilding Phaser.
    transparent: true,
    antialias: true,
    scale: { mode: Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    scene: [new StudioScene(bridge, leafColor)],
  });
}
