// The four riders (CHARACTERS_META A1-A4). Pure data + pure helpers (node-safe: imports only config.js, the item registry and charBaseStats).
// `stats` lists overrides of PLAYER_BASE only; everything else inherits. Relics are ordinary `charOnly` items (src/items/defs).
import { PLAYER_BASE } from '../config.js';
import { CHAR_BASE_V2 } from './charBaseStats.js';
import { getItem } from '../items/registry.js';

export const CHAR_ORDER = ['gunslinger', 'preacher', 'hunter', 'queen'];

export const CHARACTERS = {
  gunslinger: {
    id: 'gunslinger', name: 'The Gunslinger', alias: 'The Unnamed', role: 'ALL-ROUNDER',
    tagline: 'Six chambers, one debt. Balanced, and stubborn.',
    stats: {},
    start: { coins: 0, keys: 0, dynamite: 1, tin: 0, items: [] },
    flatDmgScale: 1,
    relic: null,
    marks: { undertaker: 0, final: 0, hell: 0 },
    unlockCond: null, hint: '', tint: 0xffffff, skin: 'player',
  },
  preacher: {
    id: 'preacher', name: 'Rev. Josiah Thorne', alias: 'The Hangman\'s Chaplain', role: 'TANK',
    tagline: 'A walking pulpit. Deletes what gets close, and prays through the rest.',
    stats: {
      maxHearts: 3, damage: 2.4, bulletCount: 5, spreadDeg: 9, inaccuracy: 2, fireDelay: 0.66, range: 0.3, shotSpeed: 900, bulletSize: 1.1,
      moveSpeed: 290, rollDistance: 200, rollCooldown: 1.3, sixthMult: 1.5, sixthPierce: 2,
    },
    start: { coins: 0, keys: 0, dynamite: 1, tin: 4, items: ['sermon_bible', 'whiskey_bottle'] },
    flatDmgScale: 0.65,
    relic: 'sermon_bible',
    marks: { undertaker: 0, final: 0, hell: 0 },
    unlockCond: 'E boss:defeated{boss=grimm}', hint: 'Absolve the Marshal - defeat Marshal Grimm.', tint: 0xb0b0ff, skin: 'player_preacher',
  },
  hunter: {
    id: 'hunter', name: 'Cormac Rook', alias: 'Paid In Full', role: 'SNIPER',
    tagline: 'Patient, piercing, one heart from the grave. Dynamite for company.',
    stats: {
      maxHearts: 2, damage: 7.5, fireDelay: 0.62, range: 0.8, shotSpeed: 1150, bulletSize: 0.8, pierce: 1, moveSpeed: 385,
      rollDistance: 290, rollCooldown: 0.8, sixthMult: 2.2, sixthPierce: 2, dynamiteDamage: 80, dynamiteFuse: 1.0,
    },
    start: { coins: 0, keys: 0, dynamite: 3, tin: 0, items: ['hunters_ledger', 'bandolier'] },
    flatDmgScale: 1,
    relic: 'hunters_ledger',
    marks: { undertaker: 0, final: 0, hell: 0 },
    unlockCond: 'E boss:defeated{boss=undertaker}', hint: 'Collect on the Undertaker - defeat the floor-3 boss.', tint: 0xd0a070, skin: 'player_hunter',
  },
  queen: {
    id: 'queen', name: 'Maude Marlowe', alias: 'Queen of Spades', role: 'GUNNER',
    tagline: 'Twin revolvers and a purse that shoots. Spend it, or keep it loaded.',
    stats: {
      maxHearts: 3, damage: 2.0, fireDelay: 0.19, range: 0.5, shotSpeed: 850, bulletSize: 0.85, inaccuracy: 2.5, moveSpeed: 350, luck: 1,
      rollDistance: 260, rollCooldown: 0.9, sixthMult: 1.6,
    },
    start: { coins: 10, keys: 0, dynamite: 1, tin: 0, items: ['gilded_pair', 'cursed_coin'] },
    flatDmgScale: 1,
    relic: 'gilded_pair',
    marks: { undertaker: 0, final: 0, hell: 0 },
    unlockCond: 'E run:ended{variant=complete}', hint: 'Cash out - win a run.', tint: 0xffd070, skin: 'player_queen',
  },
};

export const charDef = (id) => CHARACTERS[id] || CHARACTERS.gunslinger;
export const isChar = (id) => !!CHARACTERS[id];

/**
 * Stats a rider actually starts with: PLAYER_BASE + character overrides + starting items' apply(), then flatDmgScale.
 * Used by CharSelect stat bars and tests (the Player does the same in recomputeStats). `lookup` lets tests inject item defs.
 * Item onPickup effects are not run (dynamite/tin come from `start`). Returns the stats object plus `hearts` (containers + tin hearts).
 */
export function startStats(id, lookup = getItem) {
  const c = charDef(id);
  const stats = { ...CHAR_BASE_V2, ...PLAYER_BASE, ...c.stats };
  const fake = { stats, items: c.start.items, coins: c.start.coins, tin: c.start.tin, scene: null };
  const counts = {};
  for (const iid of c.start.items) {
    const def = lookup(iid);
    if (!def || !def.apply) continue;
    counts[iid] = (counts[iid] || 0) + 1;
    def.apply(fake, { stats, count: counts[iid], scene: null, player: fake });
  }
  for (const iid of c.start.items) {
    const def = lookup(iid);
    if (def && def.applyLate) def.applyLate(fake, { stats, count: 1, scene: null, player: fake });
  }
  const cbase = { ...PLAYER_BASE, ...c.stats }.damage;
  stats.damage = cbase + (stats.damage - cbase) * c.flatDmgScale;
  stats.hearts = stats.maxHearts + c.start.tin / 2;
  return stats;
}

/** The 6 CharSelect stat bars (META A6): `seg(stats)` = raw segment value on a 0..10 scale (rounded and clamped by barSegments). */
export const BAR_DEFS = [
  { key: 'hearts', label: 'HEARTS', seg: (s) => (s.hearts / 6) * 10 },
  { key: 'damage', label: 'DAMAGE (POINT BLANK)', seg: (s) => ((s.damage * s.bulletCount) / 8) * 10 },
  { key: 'rate', label: 'FIRE RATE', seg: (s) => (1 / s.fireDelay / 6) * 10 },
  { key: 'range', label: 'RANGE', seg: (s) => ((s.range * s.shotSpeed) / 900) * 10 },
  { key: 'speed', label: 'SPEED', seg: (s) => s.moveSpeed / 40 },
  { key: 'luck', label: 'LUCK', seg: (s) => s.luck },
];
/** Integer segments 0..10 for one bar of rider `id`. */
export function barSegments(id, key, lookup) {
  const d = BAR_DEFS.find((b) => b.key === key);
  return Math.max(0, Math.min(10, Math.round(d.seg(startStats(id, lookup)))));
}
export default CHARACTERS;
