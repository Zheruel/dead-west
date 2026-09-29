import Phaser from 'phaser';
import { W, H } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import HUDScene from './scenes/HUDScene.js';
import PauseScene from './scenes/PauseScene.js';
import EndScene from './scenes/EndScene.js';
import { Templates } from './gen/Templates.js';
import { runSelfTest } from './gen/FloorGen.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#0d0806',
  pixelArt: false,
  roundPixels: false,
  antialias: true,
  disableContextMenu: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  audio: { disableWebAudio: false },
  input: { activePointers: 1 },
  fps: { target: 60, smoothStep: true },
  scene: [BootScene, MenuScene, GameScene, HUDScene, PauseScene, EndScene],
});
window.__game = game;

// ?selftest=1 -> validate templates and floor generation in the console.
if (new URLSearchParams(location.search).get('selftest')) {
  const te = Templates.validateAll();
  const r = runSelfTest(100);
  console.log('[selftest] templates', te.length ? te : 'OK', '| floorgen', r.ok ? `OK (${r.count} floors)` : r.errors.slice(0, 5));
}
