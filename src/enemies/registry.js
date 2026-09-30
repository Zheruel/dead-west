// Enemy registry + metadata table (kept free of class imports so type files can import it without cycles).
// Unimplemented ids still have META (hp/floors/size) so templates and random pools work; they spawn as `Grunt` placeholders.

/**
 * Design table (GAME_DESIGN.md, CHAPTER2 s3-s6, EVENTS s3.7/s5). hp is BASE hp (floor multiplier applied on spawn). r = body circle radius.
 * Optional fields: `weight` (random-fill weight, 0 = template/event only), `weights` (per-floor weight overrides, see `enemyWeight`), `flying`+`air` (hover height),
 * `ghost`, `tags` (`undead`, `fire`), `threat` (template budget cost, CHAPTER2 s6), `frame` (sprite frame px), `affixBan` (elite affixes it cannot roll,
 * EVENTS s5.2) and `noElite` (never becomes elite: adds, links, event fights).
 */
export const ENEMY_META = {
  // ---- chapter 1
  coyote: { hp: 12, floors: [1], r: 30, speed: 210, weight: 3 },
  rattlesnake: { hp: 14, floors: [1, 2], r: 28, speed: 70, weight: 2 },
  tumbleweed: { hp: 10, floors: [1], r: 30, speed: 200, weight: 2, affixBan: ['splitting'] },
  tumbleweed_mini: { hp: 5, floors: [], r: 18, speed: 240, weight: 0, noElite: true },
  outlaw: { hp: 16, floors: [1, 2], r: 30, speed: 130, weight: 3 },
  buzzard: { hp: 10, floors: [1, 2], r: 30, speed: 200, weight: 2, flying: true, air: 50 },
  possessed: { hp: 24, floors: [2, 3, 4, 6], r: 30, speed: 120, weight: 3, weights: { 4: 1, 6: 1 } },
  skeleton: { hp: 18, floors: [2, 3, 5, 6], r: 30, speed: 90, weight: 3, weights: { 5: 1, 6: 1 }, tags: ['undead'] },
  dynamiter: { hp: 20, floors: [2], r: 30, speed: 100, weight: 2 },
  ghost: { hp: 14, floors: [2, 3, 5], r: 30, speed: 80, weight: 2, weights: { 5: 1 }, flying: true, ghost: true, air: 20, tags: ['undead'], affixBan: ['armored', 'shielded'] },
  scarecrow: { hp: 30, floors: [2], r: 36, speed: 0, weight: 1, affixBan: ['swift', 'splitting'] },
  crow: { hp: 3, floors: [], r: 20, speed: 220, weight: 0, flying: true, air: 40, noElite: true },
  miner: { hp: 40, floors: [3], r: 40, speed: 60, weight: 2, tags: ['undead'] },
  bat: { hp: 8, floors: [3], r: 22, speed: 260, weight: 2, flying: true, air: 50 },
  mole: { hp: 22, floors: [3], r: 30, speed: 130, weight: 2, affixBan: ['swift'] },
  coffin: { hp: 28, floors: [3], r: 40, speed: 130, weight: 2, tags: ['undead'], affixBan: ['splitting'] },

  // ---- floor 4: Brimstone Bluffs (hpMult 2.6)
  hellhound: { hp: 14, floors: [4], r: 30, speed: 250, weight: 3, tags: ['fire'], threat: 2, frame: 128, affixBan: ['burning'] },
  hellsteer: { hp: 26, floors: [4], r: 44, speed: 90, charge: 640, weight: 2, tags: ['fire'], threat: 3, frame: 160, affixBan: ['burning', 'swift'] },
  cinder_skull: { hp: 8, floors: [4], r: 24, speed: 190, weight: 3, flying: true, air: 50, tags: ['fire', 'undead'], threat: 1, frame: 96, affixBan: ['volatile', 'burning', 'splitting'] },
  magma_eel: { hp: 22, floors: [4], r: 30, speed: 200, weight: 0, tags: ['fire'], threat: 2, frame: 128, affixBan: ['splitting', 'swift', 'burning'] },
  sulfur_preacher: { hp: 16, floors: [4], r: 28, speed: 70, weight: 1, threat: 2, frame: 128, affixBan: ['swift'] },
  magma_golem: { hp: 40, floors: [4], r: 48, speed: 55, weight: 1.5, tags: ['fire'], threat: 4, frame: 160, affixBan: ['burning', 'splitting'] },

  // ---- floor 5: Blood Rail (hpMult 2.9)
  handcar_bandit: { hp: 20, floors: [5], r: 34, speed: 180, laneSpeed: 260, weight: 2, threat: 2, frame: 160, affixBan: ['swift'] },
  signalman: { hp: 14, floors: [5], r: 26, speed: 90, weight: 2, flying: true, air: 30, tags: ['undead'], threat: 2, frame: 128, affixBan: ['swift', 'armored', 'shielded'] },
  steam_stoker: { hp: 34, floors: [5], r: 42, speed: 65, weight: 1.5, threat: 3, frame: 160, affixBan: ['volatile'] },
  crate_mimic: { hp: 22, floors: [5], r: 34, speed: 0, hop: 400, weight: 1, threat: 2, frame: 128, affixBan: ['splitting', 'swift'] },
  rail_rat: { hp: 4, floors: [5], r: 16, speed: 290, weight: 3, threat: 0.5, frame: 64, affixBan: ['splitting', 'armored', 'shielded'] },
  chain_gang: { hp: 12, floors: [5], r: 26, speed: 150, charge: 430, weight: 1.5, tags: ['undead'], threat: 4, frame: 128, links: 3, affixBan: ['splitting', 'swift'] },

  // ---- floor 6: The Last Chance Saloon (hpMult 3.2)
  card_shark: { hp: 18, floors: [6], r: 30, speed: 100, weight: 3, threat: 2, frame: 128 },
  loaded_die: { hp: 22, floors: [6], r: 36, speed: 240, weight: 2, threat: 2, frame: 128, affixBan: ['splitting'] },
  slot_fiend: { hp: 36, floors: [6], r: 44, speed: 40, weight: 1, threat: 3, frame: 160, affixBan: ['splitting'] },
  waiter_imp: { hp: 10, floors: [6], r: 24, speed: 150, weight: 2.5, flying: true, air: 50, threat: 1.5, frame: 96 },
  bouncer: { hp: 38, floors: [6], r: 46, speed: 70, weight: 1.5, threat: 4, frame: 160, affixBan: ['armored', 'shielded'] },
  joker: { hp: 16, floors: [6], r: 28, speed: 120, weight: 2, threat: 2, frame: 128, affixBan: ['splitting'] },

  // ---- event / boss adds (never random fill, never elite)
  duelist: { hp: 24, floors: [], r: 30, speed: 150, weight: 0, noElite: true, noLoot: true, sprite: 'enemy_outlaw', frame: 128 },
  contract_seal: { hp: 60, floors: [], r: 26, speed: 0, weight: 0, noElite: true, noFloorScale: true, flying: true, air: 60, contactDamage: 0 },
};

/** Ids of the enemies introduced in chapter 2 (+ the duelist): each has a stub or real class in `types/`. */
export const CHAPTER2_ENEMY_IDS = [
  'hellhound', 'hellsteer', 'cinder_skull', 'magma_eel', 'sulfur_preacher', 'magma_golem',
  'handcar_bandit', 'signalman', 'steam_stoker', 'crate_mimic', 'rail_rat', 'chain_gang',
  'card_shark', 'loaded_die', 'slot_fiend', 'waiter_imp', 'bouncer', 'joker', 'duelist',
];

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

/** Random-fill weight of `id` on `floor` (`meta.weights[floor]` overrides the base `weight`). */
export function enemyWeight(id, floor) {
  const m = enemyMeta(id);
  if (!m) return 0;
  return (m.weights && m.weights[floor]) ?? m.weight ?? 1;
}

/** Ids that can appear as random fill on a floor (implemented or not). */
export function enemyPool(floor) {
  const ids = new Set([...Object.keys(ENEMY_META), ...reg.keys()]);
  return [...ids].filter((id) => {
    const m = enemyMeta(id);
    return m && (m.floors || []).includes(floor) && enemyWeight(id, floor) > 0;
  });
}
