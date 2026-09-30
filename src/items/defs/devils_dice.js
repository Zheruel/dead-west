import { registerItem } from '../registry.js';

// Devil's deal (3 keys): +4 luck, lucky shots hit x2 (critMult +0.5 over the base 1.5) and lucky shots happen up to 50% of the time (critCap +0.20).
// Drawback: the Hunted curse (cursed-elite chance x2.5).
registerItem({
  id: 'devils_dice', name: "Devil's Dice", desc: '+4 luck, lucky shots x3. You are hunted', type: 'passive', pool: ['crossroads'], weight: 1,
  icon: { sheet: 'items2_f', name: 'devils_dice' },
  tags: ['luck', 'crit', 'curse'], tier: 3, gate: 'gambler',
  deal: { pay: { keys: 3 } },
  lore: 'The house has a hoof.',
  apply(player, { stats }) {
    stats.luck += 4;
    stats.critMult += 0.5;
    stats.critCap += 0.2;
    stats.curseHunted = Math.max(stats.curseHunted, 1);
  },
});
