import { paperSize } from '../editor/document';
import { Game, WEBGL } from 'phaser';
import type { EditorBridge } from '../editor/bridge';
import type { EditorSetup } from '../editor/setup';
import { StudioScene } from './scenes/StudioScene';

export function startGame(parent: HTMLElement, bridge: EditorBridge, setup: EditorSetup) {
  return new Game({
    type: WEBGL,
    parent,
    // Let the CSS workspace surface follow the system theme without rebuilding Phaser.
    transparent: true,
    antialias: true,
    ...paperSize(setup.format),
    scene: [new StudioScene(bridge, setup)],
  });
}


