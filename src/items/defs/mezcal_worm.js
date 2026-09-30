import { registerItem } from '../registry.js';

// +0.7 damage, +30 speed, -1 heart container (Player.recomputeStats keeps maxHearts >= 1 and clamps current hp).
registerItem({
  id: 'mezcal_worm', name: 'Mezcal Worm', desc: '+0.7 damage, +30 speed, but -1 heart container', type: 'passive', pool: ['treasure', 'boss', 'secret'],
  icon: { sheet: 'items_passive_c', name: 'mezcal_worm' },
  tags: ['blood', 'speed'], tier: 2,
  lore: 'It tastes like courage and, a little, like regret.',
  apply(player, { stats }) { stats.damage += 0.7; stats.moveSpeed += 30; stats.maxHearts -= 1; },
});
