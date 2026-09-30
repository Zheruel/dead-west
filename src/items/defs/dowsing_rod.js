import { registerItem } from '../registry.js';

// Reveals the minimap icons of every shop, treasure, boss and secret room of the floor (icon only: the rooms stay unvisited) and gives a key.
// Native engine support: stats.dowse > 0 is read by ItemSystem.syncMap -> RoomManager.revealKinds (pickup, room entry, floor change).
registerItem({
  id: 'dowsing_rod', name: 'Dowsing Rod', desc: 'Reveals shops, treasure and secret rooms. +1 key', type: 'passive', pool: ['treasure', 'shop'], weight: 1,
  icon: { sheet: 'items2_c', name: 'dowsing_rod' },
  tags: ['luck'], tier: 1, gate: 'gulch',
  lore: 'It twitches toward trouble.',
  apply(player, { stats }) { stats.dowse = 1; },
  onPickup(player, { scene }) { player.collect('key'); if (scene.items) scene.items.syncMap(); },
});
