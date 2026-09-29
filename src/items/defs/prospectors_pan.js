import { registerItem } from '../registry.js';

// +3 coins dropped on every room clear, 10% chance of a key (Room.clearRoom reads roomClearCoins / roomClearKeyChance).
registerItem({
  id: 'prospectors_pan', name: "Prospector's Pan", desc: '+3 coins per cleared room, sometimes a key', type: 'passive', pool: ['treasure', 'shop'],
  icon: { sheet: 'items_passive_c', name: 'prospectors_pan' },
  apply(player, { stats }) { stats.roomClearCoins += 3; stats.roomClearKeyChance += 0.1; },
});
