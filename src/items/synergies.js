// The 26 named synergies (ITEMS_V2 s5). Pure data + pure evaluation (node-safe). Runtime hooks / activation callbacks live in
// items/fx/synergyHooks.js (Phaser side) and are attached to these records at import time by items/index.js.
//
// Record: { id, name, kind:'pair'|'tag'|'capstone', req, desc, cue, apply(stats, player) [, hooks] [, onActivate/onLose] }
//   req: { items?: [ids all owned], tags?: {tag: minCount}, anyTags?: {of: [tags], n}, syn?: [synergy ids all active] }   (all parts must hold)
// Evaluation order = array order (pairs, then tag thresholds, then capstones) so capstones can require earlier synergies.
// `apply` runs inside Player.recomputeStats after every item apply/applyLate (ARCH s10.2) and only mutates `stats`.
import { getItem } from './registry.js';
import { ownedIds, countTags } from './tags.js';

const add = (s, k, v) => { s[k] = (s[k] || 0) + v; };
const mul = (s, k, v) => { s[k] = (s[k] || 0) * v; };
const P = (id, name, a, b, desc, cue, apply, extra) => ({ id, name, kind: 'pair', req: { items: [a, b] }, desc, cue, apply, ...extra });
const G = (id, name, tag, n, desc, cue, apply, extra) => ({ id, name, kind: 'tag', req: { tags: { [tag]: n } }, desc, cue, apply, ...extra });
const C = (id, name, req, desc, cue, apply, extra) => ({ id, name, kind: 'capstone', req, desc, cue, apply, ...extra });

export const SYNERGIES = [
  // ---- pairs (10) ----
  P('witches_brew', "Witches' Brew", 'hex_bag', 'rattler_fang', 'Burning and poisoned foes take poison damage x2', "WITCHES' BREW - burning poison bites twice",
    (s) => { s.witchesBrew = 1; }),
  P('rolling_thunder', 'Rolling Thunder', 'bronco_boots', 'spurs', 'Stomp +60 radius, +0.4 s stun, roll cooldown -0.35 s', 'ROLLING THUNDER - the stomp shakes the room',
    (s) => { add(s, 'rollShock', 60); add(s, 'rollStun', 0.4); add(s, 'rollCooldown', -0.35); }),
  P('sanctified_silver', 'Sanctified Silver', 'holy_water', 'silver_bullets', 'Smite +10%. Smited undead may drop a half heart', 'SANCTIFIED SILVER - the light finds the dead',
    (s) => { add(s, 'smiteChance', 0.10); s.smiteHeartDrop = 0.15; }),
  P('static_ricochet', 'Static Ricochet', 'lightning_rod', 'ricochet', 'A bounced bullet always chains, +1 target', 'STATIC RICOCHET - bounced bolts always arc',
    (s) => { s.staticRicochet = 1; }, { hookNames: ['bounce'] }),
  P('fireworks', 'Fireworks', 'lit_cigar', 'nitro_jelly', 'Every blast spawns 3 mini blasts that leave fire', 'FIREWORKS - the blast has friends',
    (s) => { s.dynamiteCluster = Math.max(s.dynamiteCluster || 0, 3); }, { hookNames: ['explosion'] }),
  P('boneyard_pack', 'Boneyard Pack', 'bone_hound', 'little_coffin', 'Hound x1.5 speed and marks; coffin: 4 bats, cd -1 s', 'BONEYARD PACK - the whole graveyard barks',
    (s) => { s.boneyard = 1; }),
  P('six_feet_under', 'Six Feet Under', 'widowmaker', 'hellfire_round', 'Hellfire kills count as Sixth kills. Blast +40', 'SIX FEET UNDER - one grave, many more',
    (s) => { add(s, 'sixthExplode', 40); s.sixthBlastKills = 1; }),
  P('patient_hand', 'Patient Hand', 'dead_eye', 'short_cylinder', 'The dead-eye shot is also a Sixth Bullet', 'PATIENT HAND - wait, then end it',
    (s) => { s.patientHand = 1; }),
  P('money_talks', 'Money Talks', 'banker_ledger', 'hush_money', 'Hush costs 5 coins and drops as pickups. Interest cap +3', 'MONEY TALKS - silence is cheaper now',
    (s) => { s.hushCost = 5; add(s, 'interestCap', 3); s.hushDrop = 1; }),
  P('hail_of_lead', 'Hail of Lead', 'sawed_off', 'fan_the_hammer', 'Pellets deal x0.85 instead of x0.7. Fan spread tightens', 'HAIL OF LEAD - the whole room gets a piece',
    (s) => { s.bulletDamageMult *= 1.21; if (s.inaccuracy > 5) s.inaccuracy = 5; }),

  // ---- tag thresholds (8) ----
  G('pyromaniac', 'Pyromaniac', 'fire', 3, 'Burn +20%, burn x1.5, immune to your own fire', 'PYROMANIAC - everything burns better',
    (s) => { add(s, 'burn', 0.20); mul(s, 'burnDpsMult', 1.5); s.pyroImmune = 1; }),
  G('demolition_crew', 'Demolition Crew', 'explosive', 3, 'Blasts +30 wide, x1.25 damage, sticks refund, +6% caps', 'DEMOLITION CREW - the fuse never ends',
    (s) => { add(s, 'dynamiteRadius', 30); mul(s, 'dynamiteDamage', 1.25); add(s, 'dynamiteRefund', 0.20); add(s, 'explodeChance', 0.06); }),
  G('consecrated_ground', 'Consecrated Ground', 'holy', 3, 'x1.5 vs undead, smite +5%, undead may drop a half heart', 'CONSECRATED GROUND - the dead cannot rest',
    (s) => { add(s, 'undeadDamageMult', 0.5); add(s, 'smiteChance', 0.05); s.undeadHeartDrop = 0.08; }),
  G('high_roller', 'High Roller', 'luck', 4, '+2 luck, crit cap +10%, lucky shots pierce', 'HIGH ROLLER - the dice love you',
    (s) => { add(s, 'luck', 2); add(s, 'critCap', 0.10); add(s, 'critPierce', 1); }),
  G('gold_rush', 'Gold Rush', 'gold', 4, 'Coins +25%, shops -1, +1 coin per room', 'GOLD RUSH - the floor is paved with it',
    (s) => { add(s, 'coinMult', 0.25); add(s, 'shopDiscount', 1); add(s, 'roomClearCoins', 1); }),
  G('pack_leader', 'Pack Leader', 'familiar', 3, 'Familiars x1.35 damage, 20% faster, shots inherit status', 'PACK LEADER - the posse follows',
    (s) => { mul(s, 'familiarMult', 1.35); mul(s, 'familiarCd', 0.8); s.familiarInherit = 1; }),
  G('iron_hide', 'Iron Hide', 'armor', 3, 'A hit costs 1 unit while you have tin. Rooms may drop tin', 'IRON HIDE - the star deflects',
    (s) => { s.hitCap = 1; s.tinDropChance = 0.05; }),
  G('quicksilver', 'Quicksilver', 'speed', 3, 'Roll -0.3 s, +30 speed, +0.1 s roll grace', 'QUICKSILVER - faster than the draw',
    (s) => { add(s, 'rollCooldown', -0.3); add(s, 'moveSpeed', 30); add(s, 'rollGrace', 0.1); }),

  // ---- capstones (8) ----
  C('sixth_sacrament', 'The Sixth Sacrament', { tags: { sixth: 4 } }, 'Sixth: +2 pierce, +1 bounce, homing, x+0.5; multi-hit charges', 'THE SIXTH SACRAMENT',
    (s) => { add(s, 'sixthPierce', 2); add(s, 'sixthRicochet', 1); add(s, 'sixthHoming', 0.35); add(s, 'sixthMult', 0.5); s.sacrament = 1; }),
  C('hellstorm', 'Hellstorm', { syn: ['pyromaniac', 'demolition_crew'] }, 'Blasts ignite everything; burning deaths explode', 'HELLSTORM - rain fire, bury it',
    (s) => { s.hellstorm = 1; }),
  C('dead_man_walking', 'Dead Man Walking', { tags: { blood: 3 } }, 'At 1 heart: fire x1.5 faster, x1.5 damage. Kills heal', 'DEAD MAN WALKING - one heart, all guns',
    (s, p) => {
      add(s, 'killHeal', 0.04);
      if (p && p.hp <= 2) { mul(s, 'fireDelay', 0.65); mul(s, 'bulletDamageMult', 1.5); s.hurtInvuln = 2.0; add(s, 'pierce', 1); }
    }),
  C('spectral_posse', 'Spectral Posse', { tags: { ghost: 3, familiar: 3 } }, 'Familiar shots pass rocks, +50% ghost shots, a free lantern', 'SPECTRAL POSSE - the dead ride with you',
    (s) => { s.spectralFamiliars = 1; mul(s, 'ghostChance', 1.5); }),
  C('house_always_wins', 'The House Always Wins', { syn: ['high_roller', 'gold_rush'] }, 'Rooms may pay a jackpot. Lucky shots drop coins', 'JACKPOT ROOM - the house always wins',
    (s) => { s.jackpot = 1; s.houseWins = 1; add(s, 'critCoinChance', 0.25); }),
  C('avenging_angel', 'Avenging Angel', { syn: ['consecrated_ground', 'iron_hide'] }, 'Every hit taken unleashes a holy nova. +1 tin per floor', 'AVENGING ANGEL - be struck, strike back',
    (s) => { s.avengingAngel = 1; }),
  C('elemental_trinity', 'Elemental Trinity', { anyTags: { of: ['fire', 'poison', 'frost', 'shock', 'holy'], n: 3 } }, 'Each element +10% on every shot; 3 afflictions = x1.5', 'ELEMENTAL TRINITY - convergence',
    (s, p, ctx) => {
      s.elemTrinity = 1;
      const t = (ctx && ctx.tags) || {};
      if (t.fire) add(s, 'burn', 0.10);
      if (t.poison) s.elemPoisonExtra = 0.10;
      if (t.frost) add(s, 'chillChance', 0.10);
      if (t.shock) add(s, 'chainChance', 0.10);
      if (t.holy) add(s, 'smiteChance', 0.10);
    }),
  C('devils_dust', "Devil's Dust", { syn: ['quicksilver'], tags: { roll: 2 } }, 'Your roll leaves a biting dust trail', "DEVIL'S DUST - the road bites back",
    (s) => { s.dustTrail = 1; }),
];

export const SYN_BY_ID = Object.fromEntries(SYNERGIES.map((s) => [s.id, s]));
export const SYN_IDS = SYNERGIES.map((s) => s.id);
export const SYN_KIND_COLOR = { pair: '#f0d060', tag: '#8fc23f', capstone: '#ff8a40' };
export const SYN_KIND_LABEL = { pair: 'SYNERGY', tag: 'BUILD BONUS', capstone: 'CAPSTONE' };

/** Does `req` hold for owned-id set + tag counts + active-synergy set? */
export function reqMet(req, owned, tags, active) {
  if (req.items) for (const id of req.items) if (!owned.has(id)) return false;
  if (req.tags) for (const t in req.tags) if ((tags[t] || 0) < req.tags[t]) return false;
  if (req.anyTags) { let n = 0; for (const t of req.anyTags.of) if (tags[t]) n++; if (n < req.anyTags.n) return false; }
  if (req.syn) for (const id of req.syn) if (!active.has(id)) return false;
  return true;
}

/**
 * Evaluate which synergies hold for a list of UNIQUE owned item ids. Returns the active ids in evaluation order.
 * `out` (optional Set) is cleared and reused to avoid allocation; `tagsOut` receives the tag counts.
 */
export function evaluateSynergies(ids, out = new Set(), tagsOut = {}) {
  out.clear();
  const owned = new Set(ids);
  countTags(ids, tagsOut);
  for (const s of SYNERGIES) if (reqMet(s.req, owned, tagsOut, out)) out.add(s.id);
  return out;
}

/** Would owning `candidateId` on top of `ids` activate a synergy that is not active yet? (pool bias, pedestal hint) */
export function wouldComplete(ids, candidateId) {
  if (ids.includes(candidateId)) return false;
  const now = evaluateSynergies(ids);
  const after = evaluateSynergies([...ids, candidateId]);
  for (const id of after) if (!now.has(id)) return true;
  return false;
}
/** The synergies a given item id takes part in as a named member (pair) or via a tag it carries (tag/capstone). */
export function synergiesFor(itemId) {
  const def = getItem(itemId);
  const tags = def && def.tags ? def.tags : [];
  return SYNERGIES.filter((s) => (s.req.items && s.req.items.includes(itemId)) || (s.req.tags && Object.keys(s.req.tags).some((t) => tags.includes(t))) || (s.req.anyTags && s.req.anyTags.of.some((t) => tags.includes(t))));
}
/** Human-readable requirement, e.g. "hex_bag + rattler_fang", "FIRE 3", "pyromaniac + demolition_crew". */
export function reqLabel(s, names = true) {
  const parts = [];
  const nm = (id) => { const d = names ? getItem(id) : null; return d ? d.name : id; };
  if (s.req.items) parts.push(s.req.items.map(nm).join(' + '));
  if (s.req.tags) parts.push(Object.entries(s.req.tags).map(([t, n]) => `${t.toUpperCase()} ${n}`).join(' + '));
  if (s.req.anyTags) parts.push(`${s.req.anyTags.n} of ${s.req.anyTags.of.join('/')}`.toUpperCase());
  if (s.req.syn) parts.push(s.req.syn.map((id) => (SYN_BY_ID[id] ? SYN_BY_ID[id].name : id)).join(' + '));
  return parts.join(' + ');
}
export { ownedIds };
