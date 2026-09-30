// Curses and blessings (EVENTS 9, 3.5). Run-long modifiers stored on the player as plain id arrays: `player.curses[]` (max one of each,
// max 4) and `player.blessings[]` (stackable). Everything here is player-first-argument so it works from deals, events, secrets and tests.
//
//   applyBoons(player, stats)          curses, blessings and the glass_cannon pact (`player.pacts[]`); called at the end of Player.recomputeStats (after items, before buffs)
//   Boons.gainCurse(player, rng[, id]) / removeCurse(player[, rng, id]) / gainBlessing(player[, id, rng])
//   Boons.price(player, base)          curse_debt price rule (Player.price applies discounts first, then calls this)
//   Boons.eliteMult(player)            curse_rot elite chance multiplier (Affixes.roll)
//   Boons.darkRoomMod(player, def)     curse_dark: 'darkness' for 25 % of modifier-less normal rooms (Room.buildContents), deterministic per room
//
// Pure logic + bus events (`curse:gained/removed`, `blessing:gained`, `ui:toast`); no Phaser scene needed so it runs in node tests.
import { RNG, hashStr } from '../core/rng.js';
import * as CFG from '../config.js';

// The event bus and audio extend Phaser, which cannot load in plain node. Boons / Crossroads / Affixes keep their rules importable from
// tools/qa scripts by resolving those modules lazily: in the browser they are ready long before gameplay, in node emits/sfx are dropped.
export const deps = { bus: null, Sfx: null };
if (typeof window !== 'undefined') {
  Promise.all([import('../core/events.js'), import('../core/Audio.js')])
    .then(([e, a]) => { deps.bus = e.bus; deps.Sfx = a.Sfx; return import('./CodexHooks.js'); })
    .then((m) => m.CodexHooks.install())
    .catch((err) => console.warn('[Boons] bus unavailable', err));
}
export const emit = (evt, payload) => { if (deps.bus) deps.bus.emit(evt, payload); };
export const sfx = (key, opts) => { if (deps.Sfx) deps.Sfx.play(key, opts); };

export const MAX_CURSES = 4;

export const CURSES = {
  curse_debt: { id: 'curse_debt', name: 'DEBT', desc: 'Everything costs half again as much.', icon: { sheet: 'icons_events', name: 'curse_debt' } },
  curse_dark: { id: 'curse_dark', name: 'THE DARK', desc: 'A quarter of the plain rooms go dark.', icon: { sheet: 'icons_events', name: 'curse_dark' } },
  curse_rot: { id: 'curse_rot', name: 'ROT', desc: 'Elites come twice as often.', icon: { sheet: 'icons_events', name: 'curse_rot' } },
  curse_lead: { id: 'curse_lead', name: 'LEAD', desc: 'Slower on foot, slower to roll.', icon: { sheet: 'icons_events', name: 'curse_lead' } },
};
export const CURSE_IDS = Object.keys(CURSES);

export const BLESSINGS = {
  bless_steady: { id: 'bless_steady', name: 'STEADY HAND', desc: 'Shoot 8 % faster.', icon: { sheet: 'icons_events', name: 'bless_steady' } },
  bless_grace: { id: 'bless_grace', name: 'GRACE', desc: '+1.5 luck.', icon: { sheet: 'icons_events', name: 'bless_grace' } },
  bless_iron: { id: 'bless_iron', name: 'IRON', desc: '+0.4 damage, 2 tin when blessed.', icon: { sheet: 'icons_events', name: 'bless_iron' } },
  bless_fleet: { id: 'bless_fleet', name: 'FLEET FOOT', desc: '+40 speed, rolls recover sooner.', icon: { sheet: 'icons_events', name: 'bless_fleet' } },
};
export const BLESSING_IDS = Object.keys(BLESSINGS);

/** Numbers in one place (EVENTS 9 / 3.5). */
export const BOON_NUM = {
  debtMult: 1.5,
  darkChance: CFG.CURSE_DARK_CHANCE ?? 0.25,
  rotEliteMult: 2,
  leadSpeed: -40, leadRollCd: 0.3,
  steadyFireDelay: 0.92,
  graceLuck: 1.5,
  ironDamage: 0.4, ironTin: 2,
  fleetSpeed: 40, fleetRollCd: -0.15,
  glassDamage: 1.5, // pact glass_cannon
};

const arr = (player, key) => (player[key] || (player[key] = []));
const count = (list, id) => { let n = 0; for (let i = 0; i < list.length; i++) if (list[i] === id) n++; return n; };
const recompute = (player) => { try { if (player.recomputeStats) player.recomputeStats(); } catch (e) { console.error(e); } };
const toast = (text, color) => emit('ui:toast', { text, color });
const runOf = (player) => (player.scene && player.scene.run) || null;

/**
 * Has `player` signed pact `id`? Pacts live on `player.pacts[]` AND on `run.pacts[]`: RunState is serialised whole into checkpoints while the Player
 * snapshot does not carry `pacts`, so a CONTINUE keeps glass_cannon through the run copy.
 */
export function hasPact(player, id) {
  if (!player) return false;
  if (player.pacts && player.pacts.includes(id)) return true;
  const run = runOf(player);
  return !!(run && Array.isArray(run.pacts) && run.pacts.includes(id));
}

/** Record a signed pact on the player and the run (see hasPact). */
export function addPact(player, id) {
  const list = arr(player, 'pacts');
  if (!list.includes(id)) list.push(id);
  const run = runOf(player);
  if (run) { if (!Array.isArray(run.pacts)) run.pacts = []; if (!run.pacts.includes(id)) run.pacts.push(id); }
}

/** Apply curse + blessing stat effects. Pure over `stats` (called on every recompute). */
export function applyBoons(player, stats) {
  const cu = player.curses, bl = player.blessings;
  if (hasPact(player, 'glass_cannon')) stats.damage += BOON_NUM.glassDamage;
  if (cu && cu.length) {
    if (cu.includes('curse_lead')) {
      stats.moveSpeed += BOON_NUM.leadSpeed;
      stats.rollCooldown += BOON_NUM.leadRollCd;
    }
    if (cu.includes('curse_debt')) stats.curseDebt = 1; // read by Boons.price
    if (cu.includes('curse_rot')) stats.curseRot = 1; // read by Affixes.roll (also derivable from player.curses)
  }
  if (bl && bl.length) {
    const st = count(bl, 'bless_steady'), gr = count(bl, 'bless_grace'), ir = count(bl, 'bless_iron'), fl = count(bl, 'bless_fleet');
    if (st) stats.fireDelay *= Math.pow(BOON_NUM.steadyFireDelay, st);
    if (gr) stats.luck += BOON_NUM.graceLuck * gr;
    if (ir) stats.damage += BOON_NUM.ironDamage * ir;
    if (fl) { stats.moveSpeed += BOON_NUM.fleetSpeed * fl; stats.rollCooldown += BOON_NUM.fleetRollCd * fl; }
  }
}

export const Boons = {
  CURSES, BLESSINGS, MAX_CURSES,
  applyBoons, hasPact, addPact,

  hasCurse(player, id) { return !!(player.curses && player.curses.includes(id)); },
  curseCount(player) { return player.curses ? player.curses.length : 0; },
  /** Room for one more curse? (`item_curse` deals need this: `NO ROOM FOR MORE SIN`.) */
  canCurse(player) { return this.curseCount(player) < MAX_CURSES; },

  /** Random not-owned curse (or `id` when it is free). Returns the id, or null (pool full / owned = no-op). */
  gainCurse(player, rng, id) {
    const have = arr(player, 'curses');
    if (have.length >= MAX_CURSES) return null;
    let pick = id;
    if (pick) { if (!CURSES[pick] || have.includes(pick)) return null; }
    else {
      const free = CURSE_IDS.filter((c) => !have.includes(c));
      if (!free.length) return null;
      pick = rng ? rng.pick(free) : free[0];
    }
    have.push(pick);
    const run = runOf(player);
    if (run && Array.isArray(run.curses)) run.curses.push(pick);
    recompute(player);
    emit('curse:gained', { id: pick });
    toast(`CURSED: ${CURSES[pick].name}`, '#d63a2a');
    return pick;
  },

  /** Remove `id` or a random owned curse. Returns the removed id or null. */
  removeCurse(player, rng, id) {
    const have = player.curses;
    if (!have || !have.length) return null;
    let pick = id;
    if (pick) { if (!have.includes(pick)) return null; }
    else pick = rng ? rng.pick(have) : have[have.length - 1];
    have.splice(have.indexOf(pick), 1);
    const run = runOf(player);
    if (run && Array.isArray(run.curses)) { const i = run.curses.indexOf(pick); if (i >= 0) run.curses.splice(i, 1); }
    recompute(player);
    emit('curse:removed', { id: pick });
    return pick;
  },

  /** `id` given, else a random blessing preferring not-owned ones (they stack once all are owned). Returns the id. */
  gainBlessing(player, id, rng) {
    const have = arr(player, 'blessings');
    let pick = id;
    if (!pick || !BLESSINGS[pick]) {
      const fresh = BLESSING_IDS.filter((b) => !have.includes(b));
      const from = fresh.length ? fresh : BLESSING_IDS;
      pick = rng ? rng.pick(from) : from[0];
    }
    have.push(pick);
    const run = runOf(player);
    if (run && Array.isArray(run.blessings)) run.blessings.push(pick);
    if (pick === 'bless_iron' && typeof player.addTin === 'function') player.addTin(BOON_NUM.ironTin);
    recompute(player);
    emit('blessing:gained', { id: pick });
    toast(`BLESSED: ${BLESSINGS[pick].name}`, '#f0d060');
    return pick;
  },

  /** Drop all boons (run reset / tests). */
  clear(player) { if (player.curses) player.curses.length = 0; if (player.blessings) player.blessings.length = 0; },

  /** curse_debt: ceil(base x 1.5) (shop discounts are applied by the caller first). */
  price(player, base) {
    return this.hasCurse(player, 'curse_debt') ? Math.ceil(base * BOON_NUM.debtMult) : base;
  },
  /** curse_rot: elite chance multiplier. */
  eliteMult(player) { return this.hasCurse(player, 'curse_rot') ? BOON_NUM.rotEliteMult : 1; },

  /** curse_dark: 'darkness' for 25 % of modifier-less normal rooms, decided by the room seed (stable across re-entry). */
  darkRoomMod(player, def) {
    if (!def || def.type !== 'normal' || def.mod || !this.hasCurse(player, 'curse_dark')) return null;
    const r = new RNG(hashStr(`curse_dark:${def.seed || 0}`));
    return r.chance(BOON_NUM.darkChance) ? 'darkness' : null;
  },
};
export default Boons;
