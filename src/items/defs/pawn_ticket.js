import { registerItem } from '../registry.js';
import { Sfx } from '../../core/Audio.js';

const KEY_PRICE = 4, DYN_PRICE = 3, KEEP = 1, CAP = 99;

// Active (3 room clears): pawn every key and dynamite stick beyond the first of each for coins (4c a key, 3c a stick). Coins are added directly
// (99 cap, `coinMult` does not apply). Refuses (charge kept) when there is nothing to sell or the purse is full.
registerItem({
  id: 'pawn_ticket', name: 'Pawn Ticket', desc: 'Sell spare keys (4c) and dynamite (3c) for coins', type: 'active', charges: 3, pool: ['shop', 'treasure'], weight: 0.8,
  icon: { sheet: 'items2_d', name: 'pawn_ticket' },
  tags: ['gold'], tier: 1,
  lore: 'Everything has a price. Even that.',
  use(player, { scene }) {
    let keys = 0, dyn = 0, gain = 0;
    while (player.keys - keys > KEEP && player.coins + gain < CAP) { keys++; gain += KEY_PRICE; }
    while (player.dynamite - dyn > KEEP && player.coins + gain < CAP) { dyn++; gain += DYN_PRICE; }
    if (gain <= 0) return false; // nothing to sell: do not waste the charge
    player.keys -= keys;
    player.dynamite -= dyn;
    player.coins = Math.min(CAP, player.coins + gain);
    Sfx.play('pickup_coin', { vol: 0.8, rate: 0.9 });
    scene.fx.text(player.x, player.y - 90, `+${gain} COINS`, { color: '#e8c84a', size: 26 });
    const what = [keys ? `${keys} KEY${keys > 1 ? 'S' : ''}` : '', dyn ? `${dyn} DYNAMITE` : ''].filter(Boolean).join(' + ');
    scene.fx.text(player.x, player.y - 64, `SOLD ${what}`, { color: '#e8dcc0', size: 18, delay: 120 });
    scene.fx.burst(player.x, player.y - 40, { color: [0xe8c84a, 0xf0d060, 0xffffff], count: 14, speed: [80, 240], life: [300, 650], scale: [1, 2], gravity: 260 });
    return true;
  },
});
