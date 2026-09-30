import { registerItem } from '../registry.js';

// 25% chance (per copy) to drop lit dynamite when hit (Player.damage); explosions never hurt you (Player.damage / Dynamite playerDamage).
registerItem({
  id: 'dynamite_vest', name: 'Dynamite Vest', desc: '25% to drop lit dynamite when hit. Blasts cannot hurt you', type: 'passive', pool: ['treasure', 'boss', 'secret'],
  icon: { sheet: 'items_passive_b', name: 'dynamite_vest' },
  tags: ['dynamite', 'explosive', 'armor'], tier: 3,
  lore: "Fashion for the fearless.",
  apply(player, { stats }) { stats.dynamiteVestChance = Math.min(1, stats.dynamiteVestChance + 0.25); stats.explosionImmune = 1; },
});
