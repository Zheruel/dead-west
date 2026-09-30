import { registerItem } from '../registry.js';

registerItem({
  id: 'spurs', name: 'Silver Spurs', desc: '+60 move speed', type: 'passive', pool: ['treasure', 'shop', 'boss', 'secret'],
  icon: { sheet: 'items_passive_a', name: 'spurs' },
  tags: ['speed', 'roll'], tier: 1,
  lore: 'Jingle-jangle. Everyone hears you coming. Nobody catches you.',
  apply(player, { stats }) { stats.moveSpeed += 60; },
});
