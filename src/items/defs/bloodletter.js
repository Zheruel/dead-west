import { registerItem } from '../registry.js';

// Devil's deal (15 coins): the Sixth Bullet hits for +2 Sixth multiplier (x4 in total), but every Sixth shot costs 1 hp unit (half a heart).
// The engine takes the unit in Player.fire (`sixthCost`, then recomputes). At 2 hp or less the deal goes dry: no cost and the +2 is lost, so it
// can never kill you. Both numbers are hp-dependent, hence applyLate (Player.damage / heal / fire recompute the stats after every hp change).
registerItem({
  id: 'bloodletter', name: 'Bloodletter', desc: 'Sixth Bullet hits x4, but costs half a heart', type: 'passive', pool: ['crossroads', 'c2'], weight: 1,
  icon: { sheet: 'items2_e', name: 'bloodletter' },
  tags: ['sixth', 'blood', 'curse'], tier: 3, gate: 'bloodpact',
  deal: { pay: { coins: 15 } },
  lore: 'A little off the top.',
  apply(player, { stats }) { stats.sixthMult += 2; },
  applyLate(player, { stats }) {
    if (player.hp > 2) stats.sixthCost = Math.max(stats.sixthCost, 1);
    else stats.sixthMult -= 2;
  },
});
