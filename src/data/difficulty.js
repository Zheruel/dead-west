// Difficulty modes, mutators and the Daily Ride generator (CHARACTERS_META C, B6; ARCH_V2 s13). Pure data + pure helpers (node-safe).
//   scene.diff        = getDiff(mode, daily)                      (GameScene via meta/runSetup.applyRunSetup)
//   scene.mutators    = ['glass_jaw', ...]                        ids active this run
//   scene.mut         = mutatorFlags(ids)                         merged behaviour flags read by Enemy / Room / Player / GameScene
//   Player.recomputeStats calls applyMutators(stats, scene.mutators) (after items/boons, before clamps).
// Flag keys of mutatorFlags (all optional): enemySpeed, enemyBulletSpeed, enemyHp (multipliers, default 1), shopMult (default 1),
//   noRoll, noCoinDrops, noHearts, allCursed, slippery {friction, accel}, lightsOut {alpha, radius}, startDynamite, startHearts {maxHearts, tin}.
import { hashStr } from '../core/rng.js';
import { CHAR_ORDER } from './characters.js';

const D = (o) => ({ ...o, mul(kind) { const v = this[kind]; return typeof v === 'number' ? v : 1; } });

export const DIFFICULTY = {
  normal: D({
    id: 'normal', name: 'NORMAL', enemyHp: 1, bossHp: 1, bulletSpeed: 1, cooldown: 1, extraEnemy: 0, eliteMult: 1, dropChance: 0.4, pityRooms: 3,
    heartDowngrade: 0, shopHeartPlus: 0, hurtInvuln: 1.0, roomEntryInvuln: 0.5, rewardMult: 1, npMult: 1,
  }),
  hell: D({
    id: 'hell', name: 'HELL ON EARTH', enemyHp: 1.3, bossHp: 1.25, bulletSpeed: 1.12, cooldown: 0.88, extraEnemy: 0.35, eliteMult: 1.6, dropChance: 0.32, pityRooms: 5,
    heartDowngrade: 0.5, shopHeartPlus: 1, hurtInvuln: 0.85, roomEntryInvuln: 0.4, rewardMult: 1.5, npMult: 1.5,
  }),
};

/** Difficulty for a run: daily runs use Hell on Hell Sunday, contracts are always Normal. `daily` = dailyFor(...) result or null. */
export function getDiff(mode, daily = null) {
  if (mode === 'daily') return daily && daily.hell ? DIFFICULTY.hell : DIFFICULTY.normal;
  if (mode === 'hell') return DIFFICULTY.hell;
  return DIFFICULTY.normal;
}

const mulStat = (k, m) => (s) => { s[k] *= m; };
const addStat = (k, n) => (s) => { s[k] += n; };
const chain = (...fns) => (s) => { for (const f of fns) f(s); };

export const MUTATORS = {
  glass_jaw: { id: 'glass_jaw', name: 'Glass Jaw', tag: 'GJ', desc: 'You deal x1.5 damage. Every hit you take costs at least 2 units.', apply: chain(mulStat('bulletDamageMult', 1.5), (s) => { s.damageTakenMin = Math.max(s.damageTakenMin || 0, 2); }), flags: {} },
  rusty_iron: { id: 'rusty_iron', name: 'Rusty Iron', tag: 'RI', desc: 'Fire delay x1.4, damage x1.5, bullets pierce one more.', apply: chain(mulStat('fireDelay', 1.4), mulStat('damage', 1.5), addStat('pierce', 1)), flags: {} },
  hell_for_leather: { id: 'hell_for_leather', name: 'Hell for Leather', tag: 'HL', desc: 'Enemies and their bullets x1.25 speed. You move x1.15 and shoot x1.18 faster.', apply: chain(mulStat('moveSpeed', 1.15), mulStat('fireDelay', 0.85)), flags: { enemySpeed: 1.25, enemyBulletSpeed: 1.25 } },
  hobbled: { id: 'hobbled', name: 'Hobbled', tag: 'HB', desc: 'No dodge roll. +45 move speed.', apply: addStat('moveSpeed', 45), flags: { noRoll: true } },
  dry_town: { id: 'dry_town', name: 'Dry Town', tag: 'DT', desc: 'Enemies and rooms drop no coins or keys. Shop prices halved.', apply: null, flags: { noCoinDrops: true, shopMult: 0.5 } },
  powder_party: { id: 'powder_party', name: 'Powder Party', tag: 'PP', desc: 'Start with 9 dynamite, blasts 50% wider, explosions never hurt you. Fire delay x1.3.', apply: chain(mulStat('dynamiteRadius', 1.5), (s) => { s.explosionImmune = 1; }, mulStat('fireDelay', 1.3)), flags: { startDynamite: 9 } },
  bank_shot: { id: 'bank_shot', name: 'Bank Shot', tag: 'BS', desc: 'Bullets ricochet twice more. Damage x0.8.', apply: chain(addStat('ricochet', 2), mulStat('damage', 0.8)), flags: {} },
  chambered_three: { id: 'chambered_three', name: 'Chambered Three', tag: 'C3', desc: 'The Sixth Bullet comes every third shot. Damage x0.75.', apply: chain((s) => { s.sixthEvery = 3; }, mulStat('damage', 0.75)), flags: {} },
  lights_out: { id: 'lights_out', name: 'Lights Out', tag: 'LO', desc: 'The screen is dark. Only a small circle around you is lit.', apply: null, flags: { lightsOut: { alpha: 0.72, radius: 340 } } },
  all_cursed: { id: 'all_cursed', name: 'Everyone\'s Cursed', tag: 'AC', desc: 'Every enemy is cursed (x1.25 HP). Cursed enemies drop hearts 25% of the time.', apply: null, flags: { allCursed: true } },
  pale_horse: { id: 'pale_horse', name: 'Pale Horse', tag: 'PH', desc: 'No hearts drop. Heal 1 unit every 15 kills.', apply: (s) => { s.killHeal = 15; }, flags: { noHearts: true } },
  whiskey_legs: { id: 'whiskey_legs', name: 'Whiskey Legs', tag: 'WL', desc: 'The ground is slick. You slide.', apply: null, flags: { slippery: { friction: 0.3, accel: 0.6 } } },
  stampede: { id: 'stampede', name: 'Stampede', tag: 'ST', desc: 'Enemies move x1.3 faster but have x0.8 HP.', apply: null, flags: { enemySpeed: 1.3, enemyHp: 0.8 } },
  last_breath: { id: 'last_breath', name: 'Last Breath', tag: 'LB', desc: 'One heart and two tin hearts. Damage x1.4.', apply: chain((s) => { s.maxHearts = 1; }, mulStat('damage', 1.4)), flags: { startHearts: { maxHearts: 1, tin: 4 } } },
  big_iron: { id: 'big_iron', name: 'Big Iron', tag: 'BI', desc: 'Bullets x1.8 size and x0.8 speed. Fire delay x1.3, damage x1.2.', apply: chain(mulStat('bulletSize', 1.8), mulStat('fireDelay', 1.3), mulStat('shotSpeed', 0.8), mulStat('damage', 1.2)), flags: {} },
};
export const MUTATOR_IDS = Object.keys(MUTATORS);
/** Daily Ride never rolls the two harshest contract-only mutators. */
export const DAILY_POOL = MUTATOR_IDS.filter((id) => id !== 'hobbled' && id !== 'last_breath');

/** Apply every active mutator's stat changes (in list order; two mutators stack multiplicatively). Mutates and returns `stats`. */
export function applyMutators(stats, ids) {
  if (!ids) return stats;
  for (let i = 0; i < ids.length; i++) { const m = MUTATORS[ids[i]]; if (m && m.apply) m.apply(stats); }
  return stats;
}

const MULT_FLAGS = ['enemySpeed', 'enemyBulletSpeed', 'enemyHp', 'shopMult'];
/** Merge behaviour flags of the active mutators: multipliers multiply (default 1), other flags OR / max. */
export function mutatorFlags(ids) {
  const out = { enemySpeed: 1, enemyBulletSpeed: 1, enemyHp: 1, shopMult: 1 };
  for (const id of ids || []) {
    const m = MUTATORS[id];
    if (!m) continue;
    for (const [k, v] of Object.entries(m.flags)) {
      if (MULT_FLAGS.includes(k)) out[k] *= v;
      else if (k === 'startDynamite') out[k] = Math.max(out[k] || 0, v);
      else out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- Daily Ride
export const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
/** UTC calendar date 'YYYY-MM-DD' of `now` (ms). Pure: pass the clock in. */
export const utcDate = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const utcWeekday = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();
export const addDays = (dateStr, n) => new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** Milliseconds until the next UTC midnight. */
export const msToReset = (now = Date.now()) => 86400000 - (now % 86400000);

/** Today's Daily Ride definition (pure): { date, seed, char, mutator, hell, code }. */
export function dailyFor(dateStr) {
  const h = hashStr(`dw2:daily:${dateStr}`);
  return {
    date: dateStr,
    seed: h,
    char: CHAR_ORDER[h % CHAR_ORDER.length],
    mutator: DAILY_POOL[(h >>> 8) % DAILY_POOL.length],
    hell: utcWeekday(dateStr) === 0,
    code: `DW-${dateStr.replace(/-/g, '')}`,
  };
}
