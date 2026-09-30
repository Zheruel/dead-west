import { registerItem } from '../registry.js';

// The dodge roll ends in a stomp (Player._stomp on roll timeout): radius 170, damage x3 (10.5 at base), stun 0.6 s, enemy bullets within 120 px are
// wiped. Costs 0.25 s of roll cooldown. Rolling Thunder (with Silver Spurs) widens it.
registerItem({
  id: 'bronco_boots', name: 'Bronco Boots', desc: 'Your dodge roll ends in a stunning stomp', type: 'passive', pool: ['treasure', 'boss'], weight: 0.8,
  icon: { sheet: 'items2_b', name: 'bronco_boots' },
  tags: ['roll', 'speed'], tier: 2,
  lore: 'Land on something soft. Preferably him.',
  apply(player, { stats }) {
    stats.rollShock = Math.max(stats.rollShock, 170);
    stats.rollShockMult = Math.max(stats.rollShockMult, 3);
    stats.rollStun = Math.max(stats.rollStun, 0.6);
    stats.rollCooldown += 0.25;
  },
});
