// Importing this module registers every enemy in src/enemies/types/*.js (Vite import.meta.glob, eager) and exposes spawnEnemy().
import './registry.js';
import Grunt from './Grunt.js';
import { getEnemy, enemyMeta, ENEMY_META, isImplemented, capSubstitute } from './registry.js';
import { Affixes } from './Affixes.js';
import.meta.glob('./types/*.js', { eager: true });

export { registerEnemy, enemyPool, enemyMeta, isImplemented, ENEMY_META, capSubstitute } from './registry.js';
export { default as Enemy } from './Enemy.js';

/**
 * Spawn enemy `id` (falls back to a Grunt placeholder when not implemented). opts: {cursed, hpMult, instant, affixes, noLoot, noSplit, floor}.
 * Wave spawns (no `instant`, no split clone) honour `meta.maxPerRoom` (signalman 2): an over-cap record spawns the heaviest uncapped enemy of the floor
 * instead, keeping only the affixes that enemy may roll.
 */
export function spawnEnemy(scene, id, x, y, opts = {}) {
  const meta0 = enemyMeta(id);
  if (meta0 && meta0.maxPerRoom && !opts.instant && !opts.noSplit) {
    const sub = capSubstitute(id, scene.enemies, opts.floor || scene.floorNum || 1);
    if (sub !== id) {
      id = sub;
      if (opts.affixes && opts.affixes.length) {
        const ban = (enemyMeta(sub) || {}).affixBan;
        opts = { ...opts, affixes: Affixes.eligible(sub) ? opts.affixes.filter((a) => !(Array.isArray(ban) && ban.includes(a))) : [] };
        opts.cursed = opts.affixes.includes('cursed');
      }
    }
  }
  const entry = getEnemy(id);
  if (entry) return new entry.Class(scene, x, y, { id, meta: entry.meta, ...opts });
  const meta = { ...(ENEMY_META[id] || { hp: 12, r: 28, speed: 90 }) };
  if (!isImplemented(id)) console.debug(`[enemies] '${id}' not implemented: spawning Grunt placeholder`);
  return new Grunt(scene, x, y, { id, meta, ...opts });
}
