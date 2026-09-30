// Outcome tables and pure roll helpers of the six event rooms and the secret variants (EVENTS s3, s8). No Phaser imports: `tools/qa/events-sim.mjs`
// runs these in plain node. Every roll takes an RNG made by `Controller.rng(label, n)` (a function of run seed, room seed, label, action index),
// so an outcome never depends on the order the player did things in (EVENTS s12, Daily Ride).

const cumulative = (table, r) => {
  let x = r.next();
  for (let i = 0; i < table.length; i++) { x -= table[i][1]; if (x < 0) return table[i][0]; }
  return table[table.length - 1][0];
};

// ---------------------------------------------------------------------------------------------------------------- card_sharp (3.2)
export const BET = { chips: [3, 6, 10], maxHands: 5, foldNet: 25, luckCap: 5, luckShift: 0.01 };
/** Probability table in resolve order. `luck` (0..5) moves 0.01 per point from bust to win. */
export function betProbs(luck = 0) {
  const l = Math.max(0, Math.min(BET.luckCap, luck || 0)) * BET.luckShift;
  return [['bust', 0.51 - l], ['push', 0.10], ['win', 0.31 + l], ['ace_high', 0.06], ['dead_mans_hand', 0.02]];
}
/** Multiple of the bet returned to the player. */
export const BET_RETURN = { bust: 0, push: 1, win: 2, ace_high: 3, dead_mans_hand: 0 };
export const rollBet = (r, luck = 0) => cumulative(betProbs(luck), r);

// ---------------------------------------------------------------------------------------------------------------- wishing_well (3.3)
export const WELL = { maxThrows: 12, luckMax: 3 };
export const WISH_TABLE = [
  ['nothing', 0.44], ['heart_half', 0.14], ['key', 0.09], ['dynamite', 0.09], ['heart_full', 0.06],
  ['coin_nickel', 0.05], ['heart_tin', 0.04], ['luck', 0.07], ['curse', 0.02],
];
export const rollWish = (r) => cumulative(WISH_TABLE, r);

// ---------------------------------------------------------------------------------------------------------------- gravedigger (3.4)
export const GRAVE_SET = ['loot', 'loot', 'chest', 'ambush', 'bones'];
export const BONES_KEY_CHANCE = 0.25;
/** Contents of the five mounds (index = mound slot, left to right). */
export const shuffleGraves = (r) => r.shuffle(GRAVE_SET.slice());

// ---------------------------------------------------------------------------------------------------------------- preacher (3.5)
export const COMMUNION_TABLE = [['blessing', 0.78], ['false_prophet', 0.14], ['miracle', 0.08]];
export const rollCommunion = (r) => cumulative(COMMUNION_TABLE, r);
export const PLATE_BLESSING_CHANCE = 0.25;
export const PLATE_COST = 12;
export const COMMUNION_COST = 2; // hp units (needs >= 3)
export const ABSOLUTION_TIN_MAX = 3; // tin hearts

// ---------------------------------------------------------------------------------------------------------------- snake_oil (3.6)
export const POTION_COLORS = ['red', 'green', 'blue', 'amber', 'violet', 'white'];
export const POTION_HEX = { red: 0xd63a2a, green: 0x8fc23f, blue: 0x5aa0e8, amber: 0xf0a640, violet: 0xa070d8, white: 0xf0f0e8 };
export const POTION_EFFECTS = ['p_heal', 'p_vigor', 'p_swift', 'p_venom', 'p_laudanum', 'p_kerosene'];
export const POTION_NAME = { p_heal: 'HEAL', p_vigor: 'VIGOR', p_swift: 'SWIFT', p_venom: 'VENOM', p_laudanum: 'LAUDANUM', p_kerosene: 'KEROSENE' };
export const POTION_PRICE = 5;
export const WATER_CHANCE = 0.10;
/** Per-run colour -> effect permutation; `r` = subRng('potions') so every salesman of a run agrees. */
export function potionMap(r) {
  const fx = r.shuffle(POTION_EFFECTS.slice());
  const out = {};
  POTION_COLORS.forEach((c, i) => { out[c] = fx[i]; });
  return out;
}
/** Three distinct shelf colours. */
export const shelfColors = (r) => r.shuffle(POTION_COLORS.slice()).slice(0, 3);

// ---------------------------------------------------------------------------------------------------------------- quick_draw (3.7)
export const DUEL = { bells: [0.9, 1.9, 2.9], drawBase: 3.4, drawSpread: 1.2, quickWindow: 0.7, quickStun: 1.5 };
export const drawDelay = (r) => DUEL.drawBase + r.float(0, DUEL.drawSpread);

// ---------------------------------------------------------------------------------------------------------------- dead_mans_hand (8.1)
/** The five cards. `reward` is resolved by SecretVariants.DeadMansHand. */
export const HAND = [
  { id: 'ace_spades', rank: 14, suit: 'S', reward: 'item' },
  { id: 'ace_clubs', rank: 14, suit: 'C', reward: 'container' },
  { id: 'eight_spades', rank: 8, suit: 'S', reward: 'keys' },
  { id: 'eight_clubs', rank: 8, suit: 'C', reward: 'heal' },
  { id: 'jack_diamonds', rank: 11, suit: 'D', reward: 'devil' },
];
export const shuffleHand = (r) => r.shuffle(HAND.map((c) => c.id));
export const handCard = (id) => HAND.find((c) => c.id === id) || HAND[0];

export const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const rankLabel = (n) => RANK_LABEL[n] || String(n);

// ---------------------------------------------------------------------------------------------------------------- vault / shrine
export const CACHE = { crates: 8, barrels: 3, pickupBonus: 1.5 };
