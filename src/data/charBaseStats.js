// New PLAYER_BASE keys introduced by the rider system (CHARACTERS_META A1). config.js composes
// PLAYER_BASE = { ...V1, ...ITEM_BASE_V2, ...CHAR_BASE_V2 }. Pure data (node-safe). All defaults are additive-safe (0 / 1).
export const CHAR_BASE_V2 = {
  tinPlating: 0, // 1 = while tin remains, one hit costs at most 1 unit of it (Preacher relic)
  dualGuns: 0, // 1 = muzzle alternates left/right each shot (visual only)
  markMult: 1, // damage multiplier vs the Hunter's marked enemy
  markBossMult: 1, // same, when the marked enemy is a boss
  coinDamage: 0, // + damage per coin held (Queen)
  jackpotPerCoin: 0, // Sixth Bullet multiplier gained per coin held (Queen): effective = sixthMult + jackpotPerCoin * coins (ARCH D8)
  jackpotKillCoins: 0, // coins dropped by a Sixth Bullet kill (Queen)
  coinDropBonus: 0, // added to ROOM_REWARD.enemyCoin
  damageTakenMin: 0, // minimum units per hit taken (mutator glass_jaw)
  killHeal: 0, // heal 1 unit every N kills (mutator pale_horse); 0 = off
};
export default CHAR_BASE_V2;
