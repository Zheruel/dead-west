import { registerItem } from '../registry.js';

// Devil's deal (12 coins): every kill has a 7% chance to heal one unit (max one per 0.25 s, Kill.js), Sixth Bullet kills 20% on top.
// Drawback: red-heart pickups pay out as coins instead (heartToCoin, Player.collect: full heart = 2 coins, half = 1).
registerItem({
  id: 'leech_contract', name: 'Leech Contract', desc: 'Kills may heal you. Hearts turn to coins', type: 'passive', pool: ['crossroads'], weight: 1,
  icon: { sheet: 'items2_f', name: 'leech_contract' },
  tags: ['blood', 'heal', 'curse'], tier: 3,
  deal: { pay: { coins: 12 } },
  lore: 'Sign here. Bleed there.',
  apply(player, { stats }) {
    stats.killHeal += 0.07;
    stats.sixthKillHeal += 0.2;
    stats.heartToCoin = 1;
  },
});
