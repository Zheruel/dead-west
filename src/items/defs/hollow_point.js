import { registerItem } from '../registry.js';

registerItem({
  id: 'hollow_point', name: 'Hollow Point Rounds', desc: '+1.5 damage', type: 'passive', pool: ['treasure', 'shop', 'boss', 'secret'],
  icon: { sheet: 'items_passive_a', name: 'hollow_point' },
  tags: ['ammo'], tier: 1,
  lore: 'Hollow on the inside. Like the man who bought it.',
  apply(player, { stats }) { stats.damage += 1.5; },
});
