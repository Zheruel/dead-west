import { registerItem } from '../registry.js';
import { Sfx } from '../../core/Audio.js';

const PER_COIN = 0.015, LOSS = 0.25, LOSS_MIN = 3;

// Devil's deal (25 coins): +1.5% bullet damage per coin held (cap +75%, `coinDamageCap`), recomputed on every coin change by the engine
// (Player._coinsChanged). Drawback: a hit scatters 25% of your coins (min 3) on the floor as pickups you can grab again.
registerItem({
  id: 'gold_fever', name: 'Gold Fever', desc: '+1.5% damage per coin held (max +75%). Hits cost coins', type: 'passive', pool: ['crossroads'], weight: 1,
  icon: { sheet: 'items2_f', name: 'gold_fever' },
  tags: ['gold', 'curse'], tier: 3,
  deal: { pay: { coins: 25 } },
  lore: 'Heavier with every coin.',
  apply(player, { stats }) { stats.coinLossOnHit = LOSS; },
  applyLate(player, { stats }) { stats.bulletDamageMult *= 1 + Math.min(stats.coinDamageCap, player.coins * PER_COIN); },
  hooks: {
    hurtPost(player, ctx, { scene }) {
      const room = scene.room;
      if (!room || !room.dropPickup || player.coins <= 0) return;
      const lose = Math.min(player.coins, Math.max(LOSS_MIN, Math.ceil(player.coins * LOSS)));
      player.coins -= lose;
      const nick = lose <= 12 ? 0 : Math.floor(lose / 5), coins = lose - nick * 5, n = nick + coins; // small losses scatter as single coins
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.6;
        room.dropPickup(i < nick ? 'coin_nickel' : 'coin', player.x + Math.cos(a) * 70, player.y + Math.sin(a) * 50, { pop: true });
      }
      Sfx.play('pickup_coin', { vol: 0.7, rate: 0.7 });
      scene.fx.text(player.x, player.y - 100, `-${lose} COINS`, { color: '#e8c84a', size: 22 });
    },
  },
});
