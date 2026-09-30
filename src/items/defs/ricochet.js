import { registerItem } from '../registry.js';

// Bullets bounce off walls and obstacles once (+1 bounce per copy). Handled by Bullets.js (b.ricochet).
registerItem({
  id: 'ricochet', name: 'Ricochet Rounds', desc: 'Bullets bounce off walls once', type: 'passive', pool: ['treasure', 'boss'],
  icon: { sheet: 'items_passive_a', name: 'ricochet' },
  tags: ['bounce'], tier: 2,
  lore: "Trust the wall to finish it.",
  apply(player, { stats }) { stats.ricochet += 1; },
});
