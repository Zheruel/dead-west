import { registerItem } from '../registry.js';

// Engine sample (FN-4): proves the roll-end seam with stats only. FE-I1 owns the final file.
// The roll ends in a stomp (Player._stomp): damage x rollShockMult, stun rollStun, enemy bullets within 120 px are cleared.
registerItem({
  id: 'bronco_boots', name: 'Bronco Boots', desc: 'Your dodge roll ends in a stunning stomp', type: 'passive', pool: ['treasure', 'boss'], weight: 0.8,
  icon: { sheet: 'items2_b', name: 'bronco_boots' },
  tags: ['roll', 'speed'], tier: 2,
  lore: 'Broke a few horses. Then broke the rest.',
  apply(player, { stats }) { stats.rollShock = 170; stats.rollShockMult = 3; stats.rollStun = 0.6; stats.rollCooldown += 0.25; },
});
