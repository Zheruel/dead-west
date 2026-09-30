// Crossroads (devil deals): the post-boss gate roll, the offer tables and the cost rules (EVENTS 2, ARCH D6 / D7 / s11).
//
//   Gate        rollGate(floor, scene)            chance = min(cap, 0.30 + 0.30*[boss fight without a hit] + 0.10*curses); two missed floors in a
//                                                 row = 1.0. Roll: subRng('gate', floor). Floors 1-5 only.
//               onBossDefeated(scene, room)       roll + open (HellGate prop in the boss room, `room.state.gate`); call once per boss death
//               restoreGate(scene, room)          rebuild the HellGate from `room.state.gate` when the boss room is rebuilt
//   Offers      buildOffers({floor, player, items, rng})   L / C / R tables, schema below, generated once per floor
//   Costs       canAfford(player, offer) -> true | reason string, pay(player, cost), price(player, coins)
//   Pacts       PACTS table (name, effect text) + grantPact(player, id, rng)
//
// Offer: { id:'L'|'C'|'R', kind:'item_hearts'|'item_coins'|'item_goods'|'item_curse'|'pact'|'pity', itemId?, pact?,
//          cost:{hearts?, coins?, keys?, tin?, dynamite?, curse?}, taken:false }   (`coins` is the BASE price; the player's price() applies)
// Pure logic: everything except openGate/restoreGate (which need a live scene) runs in plain node (tools/qa/xroads-sim.mjs).
import * as CFG from '../config.js';
import { subRng } from '../core/rng.js';
import { Boons, emit, sfx } from './Boons.js';
import { getItem } from '../items/registry.js';

const X = () => CFG.VARIETY.xroads;
const PICKUP_CAP = (CFG.PLAYER && CFG.PLAYER.maxPickups) || 99;

// ---------------------------------------------------------------------------------------------------------- gate roll
/** Chance of a gate after a boss on any floor. in: {flawless (no hit taken in the boss room), curses (count), gateMisses}. */
export function gateChance({ flawless = false, curses = 0, gateMisses = 0 } = {}) {
  const x = X();
  if (gateMisses >= x.pityMisses) return 1;
  return Math.min(x.cap, x.baseChance + (flawless ? x.flawlessBonus : 0) + x.perCurse * curses);
}

/** Does floor `n` get a gate at all? */
export const gateFloor = (n) => n >= X().floors[0] && n <= X().floors[1];

/** Pure roll: (floor, {flawless, curses, gateMisses}) -> boolean, using subRng('gate', floor). */
export function rollGateRaw(floor, inputs) {
  if (!gateFloor(floor)) return false;
  return subRng('gate', floor).chance(gateChance(inputs));
}

function liveScene(scene) {
  return scene || (typeof globalThis !== 'undefined' && globalThis.__dw && globalThis.__dw.scene) || null;
}

/** Roll the gate for the boss of `floor` and update the run counters (`gateMisses`, `gateOpened`). Returns true on a hit. */
export function rollGate(floor, scene) {
  const s = liveScene(scene);
  if (!s || !gateFloor(floor)) return false;
  const run = s.run || {};
  const player = s.player;
  const curses = player && player.curses ? player.curses.length : (run.curses ? run.curses.length : 0);
  const hit = rollGateRaw(floor, { flawless: (run.bossHitsTaken || 0) === 0, curses, gateMisses: run.gateMisses || 0 });
  if (hit) {
    run.gateMisses = 0;
    if (Array.isArray(run.gateOpened)) run.gateOpened.push(floor); else run.gateOpened = [floor];
  } else run.gateMisses = (run.gateMisses || 0) + 1;
  return hit;
}

// ---------------------------------------------------------------------------------------------------------- gate lifecycle (scene)
const gateSpot = () => ({ x: CFG.ROOM.cx - 210, y: CFG.ROOM.cy + 40 });

let HellGateClass = null;
if (typeof window !== 'undefined') import('../entities/HellGate.js').then((m) => { HellGateClass = m.default; }).catch((e) => console.warn('[Crossroads] HellGate unavailable', e));

function spawnGateProp(scene, room) {
  if (!HellGateClass || !room.state.gate) return null;
  if (room.props && room.props.some((p) => p instanceof HellGateClass)) return null;
  const gate = new HellGateClass(scene, room.state.gate, room);
  (room.props || (room.props = [])).push(gate);
  return gate;
}

/** Open the gate now (no roll): stores the spot, spawns the prop with the rumble. Also the debug entry (`api.openGate`). */
export function openGate(scene, room) {
  if (!room || !room.state) return null;
  const st = room.state;
  const fresh = !st.gate;
  if (fresh) st.gate = gateSpot();
  const gate = spawnGateProp(scene, room);
  if (fresh) {
    scene.fx.shake(0.008, 600);
    scene.fx.flash(0xd63a2a, 0.3);
    sfx('hellgate_open');
    emit('ui:toast', { text: 'THE GROUND OPENS...', color: '#d63a2a' });
    emit('gate:opened', { floor: scene.floorNum || room.floor });
  }
  return gate;
}

/** Boss died on `room`: roll and (on a hit) open the gate. Returns true when a gate opened. */
export function onBossDefeated(scene, room) {
  const floor = scene.floorNum || (room && room.floor) || 1;
  if (!room || !gateFloor(floor)) return false;
  if (!rollGate(floor, scene)) return false;
  openGate(scene, room);
  return true;
}

/** Boss room rebuilt on a later visit: bring the persistent gate back (silently). */
export function restoreGate(scene, room) {
  if (!room || !room.state || !room.state.gate) return null;
  return spawnGateProp(scene, room);
}

// ---------------------------------------------------------------------------------------------------------- pacts (EVENTS 2.4)
export const PACTS = {
  glass_cannon: { id: 'glass_cannon', name: 'GLASS CANNON', w: 25, cost: { hearts: 2 }, lines: ['+1.5 DAMAGE, FOR GOOD.'], floors: [1, 6] },
  devils_dollar: { id: 'devils_dollar', name: "DEVIL'S DOLLAR", w: 25, cost: { curse: true }, lines: ['+40 COINS, +2 KEYS, +2 DYNAMITE.'], floors: [1, 6] },
  iron_hide: { id: 'iron_hide', name: 'IRON HIDE', w: 20, cost: { coins: 20 }, lines: ['3 TIN HEARTS AND A FULL HEAL.'], floors: [1, 6] },
  ace_in_hole: { id: 'ace_in_hole', name: 'ACE IN THE HOLE', w: 10, cost: { hearts: 2 }, lines: ['RISE ONCE FROM DEATH.', 'BACK WITH 3 HEARTS.'], floors: [2, 6] },
  absolution: { id: 'absolution', name: 'ABSOLUTION', w: 20, cost: { keys: 1 }, lines: ['WASH AWAY ONE CURSE.'], floors: [1, 6] },
};
export const PACT_IDS = Object.keys(PACTS);
export const PACT_NUM = { dollarCoins: 40, dollarKeys: 2, dollarDynamite: 2, hideTin: 6, aceHp: 6 };

const has = (p, k) => !!(p && p[k] && p[k].length);
const hasPact = (player, id) => !!(player.pacts && player.pacts.includes(id));

/** Pact table for the R slot (D6 / EVENTS 2.4): absolution needs a curse (else its weight moves to iron_hide), ace_in_hole floors >= 2 and no charge held. */
export function pactWeights(floor, player) {
  const w = {};
  for (const id of PACT_IDS) w[id] = floor >= PACTS[id].floors[0] ? PACTS[id].w : 0;
  if (!has(player, 'curses')) { w.iron_hide += w.absolution; w.absolution = 0; }
  if (hasPact(player, 'ace_in_hole') || (player && player.aceCharges > 0)) { w.iron_hide += w.ace_in_hole; w.ace_in_hole = 0; }
  return w;
}

// ---------------------------------------------------------------------------------------------------------- costs
/** Item `deal.pay` ({container, coins, keys, tin, dynamite}) -> offer cost. */
export function normalizePay(pay) {
  const c = {};
  if (!pay) return c;
  if (pay.container) c.hearts = pay.container;
  if (pay.hearts) c.hearts = pay.hearts;
  for (const k of ['coins', 'keys', 'tin', 'dynamite']) if (pay[k]) c[k] = pay[k];
  return c;
}

/** Max hearts still available for payment (the run never drops below one container). */
export const heartsAvailable = (player) => (player && player.stats ? player.stats.maxHearts : 3) - 1;

/** Coins the player really pays for a base price (shop discount, curse_debt). */
export const price = (player, base) => (player && typeof player.price === 'function' ? player.price(base) : base);

const N = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** true when the offer can be signed right now, else the reason text shown on the grey ring. */
export function canAfford(player, offer) {
  if (!offer || offer.taken) return 'SIGNED';
  const c = offer.cost || {};
  if (c.hearts && heartsAvailable(player) < c.hearts) return 'NEED MORE BLOOD';
  if (c.curse && !Boons.canCurse(player)) return 'NO ROOM FOR MORE SIN';
  if (c.coins) { const p = price(player, c.coins); if (player.coins < p) return `NEED ${p} COINS`; }
  if (c.keys && player.keys < c.keys) return `NEED ${N(c.keys, 'KEY', 'KEYS')}`;
  if (c.dynamite && player.dynamite < c.dynamite) return `NEED ${c.dynamite} DYNAMITE`;
  if (c.tin && player.tin < c.tin) return 'NEED MORE TIN';
  if (offer.pact === 'absolution' && !has(player, 'curses')) return 'NO SINS TO WASH AWAY';
  if (offer.pact === 'ace_in_hole' && (hasPact(player, 'ace_in_hole') || player.aceCharges > 0)) return 'ALREADY PROTECTED';
  return true;
}

/** Deduct `cost`. Hearts go through Player.loseMaxHeart (heartDebt), everything else is a plain counter. Returns the paid record. */
export function pay(player, cost) {
  const paid = {};
  if (cost.hearts) {
    if (typeof player.loseMaxHeart === 'function') player.loseMaxHeart(cost.hearts);
    else { player.heartDebt = (player.heartDebt || 0) + cost.hearts; if (player.recomputeStats) player.recomputeStats(); }
    paid.hearts = cost.hearts;
  }
  if (cost.coins) { const p = price(player, cost.coins); player.coins -= p; paid.coins = p; emit('coins:changed', { coins: player.coins }); }
  if (cost.keys) { player.keys -= cost.keys; paid.keys = cost.keys; }
  if (cost.dynamite) { player.dynamite -= cost.dynamite; paid.dynamite = cost.dynamite; }
  if (cost.tin) { player.tin -= cost.tin; paid.tin = cost.tin; if (player.recomputeStats) player.recomputeStats(); }
  if (cost.curse) paid.curse = true;
  return paid;
}

const give = (player, key, n) => { player[key] = Math.min(PICKUP_CAP, (player[key] || 0) + n); if (key === 'coins') emit('coins:changed', { coins: player.coins }); };

/** Apply a pact's boon (its cost is paid separately). Returns a short description of what happened. */
export function grantPact(player, id, rng) {
  const P = PACT_NUM;
  switch (id) {
    case 'glass_cannon':
      (player.pacts || (player.pacts = [])).push('glass_cannon');
      if (player.recomputeStats) player.recomputeStats();
      return 'damage';
    case 'devils_dollar':
      Boons.gainCurse(player, rng);
      give(player, 'coins', P.dollarCoins); give(player, 'keys', P.dollarKeys); give(player, 'dynamite', P.dollarDynamite);
      return 'dollar';
    case 'iron_hide':
      if (typeof player.addTin === 'function') player.addTin(P.hideTin);
      if (typeof player.heal === 'function') player.heal(99);
      return 'hide';
    case 'ace_in_hole':
      if (typeof player.grantRevive === 'function') player.grantRevive('ace_in_hole');
      else { (player.pacts || (player.pacts = [])).push('ace_in_hole'); player.aceCharges = 1; }
      return 'ace';
    case 'absolution':
      Boons.removeCurse(player, rng);
      return 'absolution';
    default: return '';
  }
}

// ---------------------------------------------------------------------------------------------------------- offers
const pickWeighted = (rng, entries) => {
  let total = 0;
  for (const [, w] of entries) total += Math.max(0, w);
  if (total <= 0) return entries[0][0];
  let r = rng.next() * total;
  for (const [k, w] of entries) { r -= Math.max(0, w); if (r <= 0) return k; }
  return entries[entries.length - 1][0];
};

const rollItem = (items, pool, rng, floor, fallback) => {
  try { return items.roll(pool, rng, { floor, fallback }) || null; } catch (e) { console.warn('[Crossroads] item roll failed', e); return null; }
};

function tableL(ctx) {
  const { items, rng, floor, player } = ctx;
  const id = rollItem(items, 'crossroads', rng, floor, false);
  if (!id) return { id: 'L', kind: 'pity', cost: {}, taken: false };
  const def = getItem(id);
  const cost = normalizePay(def && def.deal && def.deal.pay ? def.deal.pay : { container: 1 });
  // a heart price that would leave no container becomes a curse deal (EVENTS 2.4)
  if (cost.hearts && heartsAvailable(player) < cost.hearts && Boons.canCurse(player)) return { id: 'L', kind: 'item_curse', itemId: id, cost: { curse: true }, taken: false };
  const kind = cost.hearts ? 'item_hearts' : cost.coins ? 'item_coins' : 'item_goods';
  return { id: 'L', kind, itemId: id, cost, taken: false };
}

function tableC(ctx) {
  const { items, rng, floor, player } = ctx;
  let id = rollItem(items, 'crossroads', rng, floor, false);
  let forced = false;
  if (!id) { id = rollItem(items, 'boss', rng, floor, true); forced = !!id; } // crossroads pool exhausted: a boss item at 2 heart containers
  if (!id) return { id: 'C', kind: 'pity', cost: {}, taken: false };
  if (forced) return { id: 'C', kind: 'item_hearts', itemId: id, cost: { hearts: 2 }, taken: false };
  const curse = rng.chance(0.6) && Boons.canCurse(player);
  return curse
    ? { id: 'C', kind: 'item_curse', itemId: id, cost: { curse: true }, taken: false }
    : { id: 'C', kind: 'item_coins', itemId: id, cost: { coins: 30 }, taken: false };
}

function tableR(ctx) {
  const { rng, floor, player } = ctx;
  const w = pactWeights(floor, player);
  const id = pickWeighted(rng, PACT_IDS.map((k) => [k, w[k]]));
  return { id: 'R', kind: 'pact', pact: id, cost: { ...PACTS[id].cost }, taken: false };
}

/** The three offers. ctx: {floor, player, items: {roll(pool, rng, opts)}, rng (default subRng('offers', floor))}. */
export function buildOffers(ctx) {
  const c = { ...ctx, rng: ctx.rng || subRng('offers', ctx.floor) };
  return [tableL(c), tableC(c), tableR(c)];
}

export const Crossroads = {
  gateChance, gateFloor, rollGateRaw, rollGate, onBossDefeated, openGate, restoreGate,
  PACTS, PACT_IDS, pactWeights, normalizePay, canAfford, pay, grantPact, buildOffers, price, heartsAvailable,
};
export default Crossroads;
