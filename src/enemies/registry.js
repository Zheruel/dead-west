// Enemy registry + metadata table (kept free of class imports so type files can import it without cycles).
// Unimplemented ids still have META (hp/floors/size) so templates and random pools work; they spawn as `Grunt` placeholders.

/** Design table (GAME_DESIGN.md). hp is BASE hp (floor multiplier applied on spawn). r = body circle radius. */
export const ENEMY_META = {
  coyote: { hp: 12, floors: [1], r: 30, speed: 210, weight: 3 },
  rattlesnake: { hp: 14, floors: [1, 2], r: 28, speed: 70, weight: 2 },
  tumbleweed: { hp: 10, floors: [1], r: 30, speed: 200, weight: 2 },
  tumbleweed_mini: { hp: 5, floors: [], r: 18, speed: 240, weight: 0 },
  outlaw: { hp: 16, floors: [1, 2], r: 30, speed: 130, weight: 3 },
  buzzard: { hp: 10, floors: [1, 2], r: 30, speed: 200, weight: 2, flying: true, air: 50 },
  possessed: { hp: 24, floors: [2, 3], r: 30, speed: 120, weight: 3 },
  skeleton: { hp: 18, floors: [2, 3], r: 30, speed: 90, weight: 3, tags: ['undead'] },
  dynamiter: { hp: 20, floors: [2], r: 30, speed: 100, weight: 2 },
  ghost: { hp: 14, floors: [2, 3], r: 30, speed: 80, weight: 2, flying: true, ghost: true, air: 20, tags: ['undead'] },
  scarecrow: { hp: 30, floors: [2], r: 36, speed: 0, weight: 1 },
  crow: { hp: 3, floors: [], r: 20, speed: 220, weight: 0, flying: true, air: 40 },
  miner: { hp: 40, floors: [3], r: 40, speed: 60, weight: 2, tags: ['undead'] },
  bat: { hp: 8, floors: [3], r: 22, speed: 260, weight: 2, flying: true, air: 50 },
  mole: { hp: 22, floors: [3], r: 30, speed: 130, weight: 2 },
  coffin: { hp: 28, floors: [3], r: 40, speed: 130, weight: 2, tags: ['undead'] },
};

const reg = new Map(); // id -> {Class, meta}

/**
 * registerEnemy('coyote', CoyoteClass, { hp, r (body radius), speed, floors:[1], weight, flying, tags:['undead'], sprite?, contactDamage?, ... })
 * Anything omitted falls back to ENEMY_META[id] then to the Enemy defaults.
 */
export function registerEnemy(id, Class, meta = {}) {
  reg.set(id, { Class, meta: { ...(ENEMY_META[id] || {}), ...meta } });
}
export const getEnemy = (id) => reg.get(id);
export const isImplemented = (id) => reg.has(id);
export const enemyMeta = (id) => (reg.get(id) ? reg.get(id).meta : ENEMY_META[id]) || null;

/** Ids that can appear as random fill on a floor (implemented or not). */
export function enemyPool(floor) {
  const ids = new Set([...Object.keys(ENEMY_META), ...reg.keys()]);
  return [...ids].filter((id) => {
    const m = enemyMeta(id);
    return m && (m.floors || []).includes(floor) && (m.weight ?? 1) > 0;
  });
}
