// Round 2 item-engine stats (ITEMS_V2 s2.1, s1.3). Pure data (node-safe). config.js composes
//   PLAYER_BASE = { ...V1, ...ITEM_BASE_V2, ...CHAR_BASE_V2 }
// Every key defaults to "off" so the 28 round-1 items behave exactly as before. `Player.recomputeStats` also merges ITEM_BASE_V2 under
// PLAYER_BASE itself, so a missing config wiring can never leave a key undefined.
//
// Item authors: set these in `apply(player, {stats, count})` (pure). Keys marked [engine] are consumed by Player / Bullets / Enemy /
// Explosions / ItemSystem; you never need to code the behaviour, only set the number.
export const ITEM_BASE_V2 = {
  // ---- bullet mods (rolled per pellet in Player.fire, resolved in Bullets.update) ----
  splitCount: 0, splitMult: 0.4, // [engine] children spawned on the first enemy hit / their damage vs the parent
  boomerangEvery: 0, // [engine] every Nth non-Sixth shot is a boomerang (0 = off)
  chainChance: 0, chainCount: 2, chainMult: 0.5, chainRange: 260, // [engine] lightning arcs on hit
  explodeChance: 0, explodeRadius: 90, explodeMult: 0.6, // [engine] blasting-cap shots
  ghostChance: 0, // [engine] spectral +1 pierce x1.15 shots
  pullRadius: 0, pullSpeed: 110, // [engine] bullets drag nearby foes (lodestone)
  chillChance: 0, // [engine] chill status (3 stacks = frozen)
  smiteChance: 0, smiteRadius: 80, smiteMult: 2, // [engine] holy light on hit (0.4 s global cooldown)
  bulletFrame: '', // [engine] override sprite frame name (projectiles_v2)
  dowse: 0, // [engine] > 0: minimap shows every shop / treasure / boss / secret room icon (ItemSystem.syncMap)
  // ---- status power ----
  burnVuln: 0, burnSpread: 0, burnDpsMult: 1, // [engine] burning foes take +N% / ignite neighbours on death (px) / burn dps multiplier
  poisonStackMax: 1, poisonCloud: 0, // [engine] poison stacks / toxic cloud radius on poisoned death
  markCount: 0, markBonus: 0.5, // markCount: wanted_poster hook marks N foes per wave; markBonus = extra damage taken by a marked foe
  frozenBonus: 0.4, // [engine] extra damage taken by frozen foes
  burnPoolR: 0, burnPoolHurts: 0, // [engine] burning kills leave a fire patch (pact_of_ashes); hurts the player when burnPoolHurts = 1
  // ---- Sixth Bullet axis ----
  sixthExplode: 0, sixthSplit: 0, sixthOrbit: 0, sixthRefund: 0, sixthCost: 0, sixthHoming: 0, sixthRicochet: 0, // [engine]
  normalDamageMult: 1, // [engine] multiplier for non-Sixth shots
  sixthKillHeal: 0, // [engine] chance a Sixth kill heals 1 unit
  // ---- crit / luck ----
  critMult: 1.5, critCap: 0.3, critCoinChance: 0, critPierce: 0, // [engine] lucky shots (luck * 3 %, capped by critCap)
  // ---- defence ----
  rollShock: 0, rollShockMult: 3, rollStun: 0.6, // [engine] stomp at the end of a roll (radius px, damage = damage * mult, stun s)
  rollReflect: 0, rollGrace: 0, // [engine] reflect enemy bullets during a roll (radius px) / extra i-frames after a roll (s)
  hitCap: 0, // [engine] max units per hit while tin > 0 (0 = off)
  hushCost: 0, // hush_money: coins paid to ignore a hit (its `hurt` hook)
  hurtInvuln: 1.0, // [engine] i-frame seconds after a hit (base from difficulty)
  roomEntryInvuln: 0.5, // [engine] i-frames on room entry (base from difficulty)
  haloCharges: 0, // [engine] saints_halo: hits absorbed per floor
  // ---- economy ----
  interestDiv: 0, interestCap: 5, // banker_ledger (roomClear hook)
  roomClearDynChance: 0, killHeal: 0, // [engine] killHeal: chance a kill heals 1 unit (max once per 0.25 s)
  heartToCoin: 0, // [engine] red-heart pickups become 2 coins
  coinDamagePct: 0, coinDamageCap: 0.75, // gold_fever (applyLate)
  coinLossOnHit: 0, jackpot: 0, bountyMark: 0, // gold_fever / house_always_wins / wanted_poster helpers
  // ---- dynamite ----
  dynamiteThrow: 0, // [engine] px the stick is thrown ahead of you
  dynamiteFirePool: 0, // [engine] player explosions leave a fire patch
  dynamiteRefund: 0, // [engine] chance an explosion kill refunds a stick
  dynamiteRegen: 0, dynamiteRegenCap: 0, // [engine] seconds per regrown stick / regrow ceiling
  dynamiteCluster: 0, // [engine] extra mini blasts per player explosion
  explosionVuln: 0, // [engine] overrides explosionImmune, +1 unit from explosions
  // ---- familiars ----
  familiarMult: 1, familiarCd: 1, spectralFamiliars: 0, // familiars read these (damage / cooldown multipliers)
  // ---- curse ----
  curseHunted: 0, // elite chance x(1 + 1.5 * curseHunted) (Room / Affixes read it); HUD chip HUNTED
  // ---- synergy flags (set by synergies.js `apply`, read by the engine) ----
  witchesBrew: 0, staticRicochet: 0, smiteHeartDrop: 0, boneyard: 0, hushDrop: 0, patientHand: 0, pyroImmune: 0, undeadHeartDrop: 0,
  familiarInherit: 0, tinDropChance: 0, sacrament: 0, hellstorm: 0, sixthBlastKills: 0, elemTrinity: 0, elemPoisonExtra: 0, dustTrail: 0,
  avengingAngel: 0, houseWins: 0,
};

/** Char keys of CHARACTERS_META A1 (CHAR_BASE_V2 in data/charBaseStats.js is authoritative; this is the fallback merged UNDER it). */
export const CHAR_KEYS_FALLBACK = {
  tinPlating: 0, dualGuns: 0, markMult: 1, markBossMult: 1, coinDamage: 0, jackpotPerCoin: 0, jackpotKillCoins: 0, coinDropBonus: 0, damageTakenMin: 0,
};

/** Anti-runaway clamps [min, max] applied at the very end of recomputeStats (ITEMS 1.3). */
export const ITEM_CAPS = {
  bulletDamageMult: [0, 4],
  chainChance: [0, 0.6],
  explodeChance: [0, 0.5],
  ghostChance: [0, 1],
  chillChance: [0, 0.6],
  smiteChance: [0, 0.35],
  burn: [0, 1],
  sixthEvery: [3, 8],
  critCap: [0, 0.6],
  fearChance: [0, 1],
  hurtInvuln: [0.5, 3],
};

/** Clamp the capped keys in place (integer sixthEvery). */
export function applyCaps(stats) {
  for (const k in ITEM_CAPS) {
    const c = ITEM_CAPS[k];
    const v = stats[k];
    if (v === undefined || Number.isNaN(v)) { stats[k] = c[0] > 0 ? c[0] : 0; continue; }
    stats[k] = v < c[0] ? c[0] : v > c[1] ? c[1] : v;
  }
  stats.sixthEvery = Math.round(stats.sixthEvery);
  return stats;
}

/** Shop price by tier (ITEMS 4.5): T1 10c, T2 13c, T3 16c; actives +2; floors 4-6 +3. Discounts are applied by Player.price. */
export const TIER_PRICE = { 1: 10, 2: 13, 3: 16 };
export const shopPrice = (def, floor = 1) => (TIER_PRICE[def.tier || 2] || 13) + (def.type === 'active' ? 2 : 0) + (floor >= 4 ? 3 : 0);

/** Pool weight multiplier by tier and chapter (ITEMS 6.2); deals ignore it. */
export const TIER_MULT = {
  ch1: { 1: 1.0, 2: 1.0, 3: 0.7 },
  ch2: { 1: 0.55, 2: 1.0, 3: 1.3 },
};
export const tierMult = (tier, floor) => (floor >= 4 ? TIER_MULT.ch2 : TIER_MULT.ch1)[tier || 2] ?? 1;
