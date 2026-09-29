import { registerItem } from '../registry.js';

registerItem({
  id: 'long_barrel', name: 'Long Barrel', desc: 'More range, faster bullets', type: 'passive', pool: ['treasure', 'shop', 'boss'],
  icon: { sheet: 'items_passive_a', name: 'long_barrel' },
  apply(player, { stats }) { stats.range += 0.15; stats.shotSpeed += 120; },
});
