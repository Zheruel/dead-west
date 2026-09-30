import { registerItem } from '../registry.js';

// +2 pellets (3-shot spread), each pellet deals x0.7 damage. Per copy: +2 more pellets, x0.7 again.
registerItem({
  id: 'sawed_off', name: 'Sawed-Off', desc: '3-shot spread, pellets deal x0.7 damage', type: 'passive', pool: ['treasure', 'boss'],
  icon: { sheet: 'items_passive_a', name: 'sawed_off' },
  tags: ['spread'], tier: 2,
  lore: "Aiming is optional.",
  apply(player, { stats }) { stats.bulletCount += 2; stats.bulletDamageMult *= 0.7; stats.spreadDeg = Math.max(stats.spreadDeg, 12); },
});
