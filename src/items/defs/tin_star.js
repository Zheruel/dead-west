import { registerItem } from '../registry.js';

registerItem({
  id: 'tin_star', name: 'Tin Star', desc: '+2 tin hearts (armour)', type: 'passive', pool: ['treasure', 'shop', 'boss'],
  icon: { sheet: 'items_passive_b', name: 'tin_star' },
  onPickup(player) { player.addTin(4); }, // 2 tin units per tin heart
});
