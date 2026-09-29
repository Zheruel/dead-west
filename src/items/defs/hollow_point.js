import { registerItem } from '../registry.js';

registerItem({
  id: 'hollow_point', name: 'Hollow Point Rounds', desc: '+1.5 damage', type: 'passive', pool: ['treasure', 'shop', 'boss', 'secret'],
  icon: { sheet: 'items_passive_a', name: 'hollow_point' },
  apply(player, { stats }) { stats.damage += 1.5; },
});
