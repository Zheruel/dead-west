import { registerItem } from '../registry.js';

registerItem({
  id: 'snake_oil', name: 'Snake Oil', desc: '+1 heart container, full heal of one heart', type: 'passive', pool: ['treasure', 'shop', 'boss', 'secret'],
  icon: { sheet: 'items_passive_b', name: 'snake_oil' },
  apply(player, { stats }) { stats.maxHearts += 1; },
  onPickup(player) { player.heal(2); }, // one-shot: runs once per pickup, not on every recompute
});
