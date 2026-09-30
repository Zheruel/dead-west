// Runtime registration of the meta scenes (main.js is not owned by the meta layer): MenuScene calls registerMetaScenes(game) before any of them
// is started. Idempotent, and harmless when main.js already registers them.
import CharSelectScene from '../scenes/CharSelectScene.js';
import DailyScene from '../scenes/DailyScene.js';
import BoardScene from '../scenes/BoardScene.js';
import CodexScene from '../scenes/CodexScene.js';

export const META_SCENES = [['CharSelect', CharSelectScene], ['Daily', DailyScene], ['Board', BoardScene], ['Codex', CodexScene]];

export function registerMetaScenes(game) {
  for (const [key, cls] of META_SCENES) {
    try { if (!game.scene.getScene(key)) game.scene.add(key, cls, false); } catch (e) { console.warn('[meta] scene registration failed', key, e); }
  }
}
