import { registerItem } from '../registry.js';
import { ROOM } from '../../config.js';
import { Sfx } from '../../core/Audio.js';

// A hit that would land is paid off instead: hushCost coins (8) leave the purse, the hit is cancelled and you get 0.6 s of grace. Once per room and at
// most once per 6 s. Money Talks (with the Banker's Ledger) cuts the price to 5 and the paid coins drop on the floor (stats.hushDrop). State is plain data
// (checkpoint safe): `used` resets on room entry, `cd` counts down in the `update` hook.
const COOLDOWN = 6, GRACE = 0.6;

registerItem({
  id: 'hush_money', name: 'Hush Money', desc: 'Pay 8 coins to ignore a hit (once per room)', type: 'passive', pool: ['treasure', 'shop', 'secret'], weight: 0.6,
  icon: { sheet: 'items2_c', name: 'hush_money' },
  tags: ['gold', 'armor'], tier: 2, gate: 'gulch',
  lore: 'Silence is golden. So is this.',
  state: () => ({ used: false, cd: 0 }),
  apply(player, { stats }) { stats.hushCost = stats.hushCost > 0 ? Math.min(stats.hushCost, 8) : 8; },
  hooks: {
    roomEnter(player, ctx, { state }) { state.used = false; },
    update(player, ctx, { state }) { if (state.cd > 0) state.cd -= ctx.dt; },
    hurt(player, ctx, { scene, stats, state }) {
      const cost = stats.hushCost;
      if (!(cost > 0) || player.coins < cost || state.used || state.cd > 0) return undefined;
      state.used = true; state.cd = COOLDOWN;
      player.coins -= cost;
      player.hurtT = Math.max(player.hurtT, GRACE);
      const fx = scene.fx;
      fx.text(player.x, player.y - 76, `HUSHED -${cost}`, { color: '#e8c84a', size: 24 });
      fx.burst(player.x, player.y - 30, { color: [0xffe090, 0xf0c040, 0xffffff], count: 10 + cost, speed: [90, 300], life: [300, 650], scale: [1.4, 3], gravity: 420, blend: 'ADD' });
      fx.ringPulse(player.x, player.footY, 0xe8c84a, 70, 380, 0.7);
      Sfx.play('shop_buy', { vol: 0.5, rate: 0.9, gap: 0.2 });
      if (stats.hushDrop && scene.room && scene.room.dropPickup) { // Money Talks: the bribe lands on the floor and can be picked up again
        for (let i = 0; i < cost; i++) scene.room.dropPickup('coin', player.x + (i - (cost - 1) / 2) * 22, player.y + 46, { pop: true });
      }
      return { cancel: true };
    },
  },
});
