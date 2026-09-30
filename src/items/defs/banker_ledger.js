import { registerItem } from '../registry.js';
import { ROOM } from '../../config.js';

// Interest: clearing a room pops min(interestCap 5, floor(coins / interestDiv 8)) coin PICKUPS (so coinMult and the room's magnet rules apply).
// Money Talks (with Hush Money) raises the cap by 3. Nothing pays out under the dry_town mutator (no coin drops).
registerItem({
  id: 'banker_ledger', name: "Banker's Ledger", desc: 'Cleared rooms pay interest: +1 coin per 8 held', type: 'passive', pool: ['treasure', 'shop'], weight: 1,
  icon: { sheet: 'items2_b', name: 'banker_ledger' },
  tags: ['gold'], tier: 1,
  lore: 'Even the dead earn interest.',
  apply(player, { stats }) { stats.interestDiv = stats.interestDiv > 0 ? Math.min(stats.interestDiv, 8) : 8; stats.interestCap = Math.max(stats.interestCap, 5); },
  hooks: {
    roomClear(player, ctx, { scene, stats }) {
      const room = ctx.room || scene.room;
      if (!room || !room.dropPickup || !(stats.interestDiv > 0) || (scene.mut && scene.mut.noCoinDrops)) return;
      const n = Math.min(stats.interestCap, Math.floor(player.coins / stats.interestDiv));
      if (n <= 0) return;
      for (let i = 0; i < n; i++) room.dropPickup('coin', ROOM.cx + (i - (n - 1) / 2) * 34, ROOM.cy + 112, { pop: true });
      scene.fx.text(ROOM.cx, ROOM.cy + 40, `INTEREST +${n}`, { color: '#e8c84a', size: 22 });
    },
  },
});
