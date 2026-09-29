import { registerItem } from '../registry.js';

registerItem({
  id: 'bandolier', name: 'Bandolier', desc: '+4 dynamite, blasts 30% wider', type: 'passive', pool: ['treasure', 'shop', 'secret'],
  icon: { sheet: 'items_passive_b', name: 'bandolier' },
  apply(player, { stats }) { stats.dynamiteRadius += 45; }, // +30% of the 150 base
  onPickup(player) { player.dynamite = Math.min(99, player.dynamite + 4); },
});
