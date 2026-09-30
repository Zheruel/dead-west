import { registerItem } from '../registry.js';

// The Sixth Bullet comes one shot sooner: every 5th shot (Player.cyl / stats.sixthEvery, clamped 3..8; the Cylinder HUD draws that many chambers).
// Patient Hand (with Dead Eye) makes the dead-eye shot a Sixth Bullet too.
registerItem({
  id: 'short_cylinder', name: 'Short Cylinder', desc: 'Every 5th shot is a Sixth Bullet', type: 'passive', pool: ['treasure', 'boss'], weight: 0.8,
  icon: { sheet: 'items2_d', name: 'short_cylinder' },
  tags: ['sixth'], tier: 2,
  lore: 'One chamber fewer, one truth sooner.',
  apply(player, { stats }) { stats.sixthEvery = Math.max(3, stats.sixthEvery - 1); },
});
