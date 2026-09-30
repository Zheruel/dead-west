import { registerItem } from '../registry.js';

// Bullets poison for 1.5 dps per stack, up to 3 stacks (4.5 dps); a poisoned foe dies in a toxic cloud (r 110, 3 s, 4 dps + poison to foes inside,
// never hurts you: items/fx/ItemFx.js). Stacks with Rattler Fang (its 3 dps becomes 4.5 per stack).
registerItem({
  id: 'gila_gland', name: 'Gila Gland', desc: 'Poison stacks 3x and bursts into a cloud', type: 'passive', pool: ['treasure', 'secret'], weight: 0.8,
  icon: { sheet: 'items2_b', name: 'gila_gland' },
  tags: ['poison'], tier: 2, gate: 'mine',
  lore: 'Bitten once, thrice regretted.',
  apply(player, { stats }) {
    stats.poison += 1.5;
    stats.poisonStackMax = Math.max(stats.poisonStackMax, 3);
    stats.poisonCloud = Math.max(stats.poisonCloud, 110);
  },
});
