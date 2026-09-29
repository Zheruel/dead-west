// Importing this module registers every enemy in src/enemies/types/*.js (Vite import.meta.glob, eager) and exposes spawnEnemy().
import './registry.js';
import Grunt from './Grunt.js';
import { getEnemy, enemyMeta, ENEMY_META, isImplemented } from './registry.js';
import.meta.glob('./types/*.js', { eager: true });

export { registerEnemy, enemyPool, enemyMeta, isImplemented, ENEMY_META } from './registry.js';
export { default as Enemy } from './Enemy.js';

/** Spawn enemy `id` (falls back to a Grunt placeholder when not implemented). opts: {cursed, hpMult, instant} */
export function spawnEnemy(scene, id, x, y, opts = {}) {
  const entry = getEnemy(id);
  if (entry) return new entry.Class(scene, x, y, { id, meta: entry.meta, ...opts });
  const meta = { ...(ENEMY_META[id] || { hp: 12, r: 28, speed: 90 }) };
  if (!isImplemented(id)) console.debug(`[enemies] '${id}' not implemented: spawning Grunt placeholder`);
  return new Grunt(scene, x, y, { id, meta, ...opts });
}
