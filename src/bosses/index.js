// Importing this module registers every boss in src/bosses/types/*.js and exposes spawnBoss().
import './registry.js';
import Boss from './Boss.js';
import { getBoss, BOSS_META } from './registry.js';
import.meta.glob('./types/*.js', { eager: true });

export { registerBoss, bossMeta, BOSS_META } from './registry.js';
export { default as Boss } from './Boss.js';
export { default as MiniBoss } from './MiniBoss.js';
export { MINI_IDS, FINAL_BOSS } from './registry.js';

/** Spawn boss `id`; unimplemented bosses use the generic Boss (fan + ring) with their design metadata. */
export function spawnBoss(scene, id, x, y, opts = {}) {
  const entry = getBoss(id);
  if (entry) return new entry.Class(scene, x, y, { id, meta: entry.meta, ...opts });
  console.debug(`[bosses] '${id}' not implemented: spawning generic Boss`);
  return new Boss(scene, x, y, { id, meta: { ...(BOSS_META[id] || { name: id.toUpperCase(), title: '', hp: 300, r: 80 }) }, ...opts });
}
