import { registerItem } from '../registry.js';

// The Outlaw Queen's relic (character-only, never rolled). Pure stat item: Player.fire adds coinDamage * coins and alternates the muzzles
// (dualGuns); the Sixth Bullet becomes the Jackpot (sixthMult + jackpotPerCoin * coins, jackpotKillCoins coins per Jackpot kill).
registerItem({
  id: 'gilded_pair', name: 'Gilded Pair', desc: 'Dual guns. Coins add damage; the Sixth Bullet is a Jackpot', type: 'passive', pool: [], charOnly: 'queen',
  icon: { sheet: 'meta_icons', name: 'gilded_pair' }, tier: 3,
  lore: 'Maude never spent a coin she could shoot with.',
  apply(player, { stats }) {
    stats.dualGuns = 1; stats.coinDamage = 0.008; stats.jackpotPerCoin = 0.02; stats.jackpotKillCoins = 3; stats.coinDropBonus = 0.08;
  },
});
