import { registerItem } from '../registry.js';

// +2 luck: better room-clear drops (Room.clearRoom), enemy loot (Enemy.dropLoot) and a small chance for x1.5 "lucky" shots (Player.fire).
registerItem({
  id: 'lucky_horseshoe', name: 'Lucky Horseshoe', desc: '+2 luck: better drops and lucky shots', type: 'passive', pool: ['treasure', 'shop', 'secret'],
  icon: { sheet: 'items_passive_a', name: 'lucky_horseshoe' },
  apply(player, { stats }) { stats.luck += 2; },
});
