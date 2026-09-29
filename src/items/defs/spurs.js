import { registerItem } from '../registry.js';

registerItem({
  id: 'spurs', name: 'Silver Spurs', desc: '+60 move speed', type: 'passive', pool: ['treasure', 'shop', 'boss', 'secret'],
  icon: { sheet: 'items_passive_a', name: 'spurs' },
  apply(player, { stats }) { stats.moveSpeed += 60; },
});
