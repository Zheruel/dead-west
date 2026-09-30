import { registerItem } from '../registry.js';

// Engine sample (FN-4): proves the N-slot cylinder with stats only. FE-I2 owns the final file.
// The Sixth Bullet comes one shot sooner (Player.cyl / stats.sixthEvery, clamped 3..8; the Cylinder HUD draws that many chambers).
registerItem({
  id: 'short_cylinder', name: 'Short Cylinder', desc: 'Every 5th shot is a Sixth Bullet', type: 'passive', pool: ['treasure', 'boss'], weight: 0.8,
  icon: { sheet: 'items2_d', name: 'short_cylinder' },
  tags: ['sixth'], tier: 2,
  lore: 'One chamber shy of a full house.',
  apply(player, { stats }) { stats.sixthEvery = Math.max(3, stats.sixthEvery - 1); },
});
