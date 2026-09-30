import { registerItem } from '../registry.js';

// Coins are worth x2 (coinMult, +1 per extra copy), +1 luck, shop prices -1 (min 1; Player.price()).
registerItem({
  id: 'cursed_coin', name: 'Cursed Coin', desc: 'Coins worth double, +1 luck, shops cost 1 less', type: 'passive', pool: ['treasure', 'secret'],
  icon: { sheet: 'items_passive_b', name: 'cursed_coin' },
  tags: ['gold', 'luck'], tier: 1,
  lore: 'It always lands heads. That should worry you.',
  apply(player, { stats }) { stats.coinMult += 1; stats.luck += 1; stats.shopDiscount += 1; },
});
