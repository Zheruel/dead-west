import { registerItem } from '../registry.js';

// 15% of bullets ignite enemies (Player.fire rolls stats.burn per bullet; Enemy.takeHit applies the burn). Burning bullets are tinted orange.
registerItem({
  id: 'hex_bag', name: 'Hex Bag', desc: '15% chance bullets set enemies ablaze', type: 'passive', pool: ['treasure', 'shop', 'secret'],
  icon: { sheet: 'items_passive_c', name: 'hex_bag' },
  apply(player, { stats }) { stats.burn = Math.min(1, stats.burn + 0.15); },
});
