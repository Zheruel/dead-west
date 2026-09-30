import { registerItem } from '../registry.js';

// Bullets poison: 3 dps for 3 s (dps does not add up, the timer refreshes; extra copies raise the dps). Enemy.takeHit applies it.
registerItem({
  id: 'rattler_fang', name: 'Rattler Fang', desc: 'Bullets poison enemies', type: 'passive', pool: ['treasure', 'boss', 'secret'],
  icon: { sheet: 'items_passive_b', name: 'rattler_fang' },
  tags: ['poison'], tier: 2,
  lore: 'Still wet. Still angry. Points away from you, mostly.',
  apply(player, { stats }) { stats.poison += 3; },
});
