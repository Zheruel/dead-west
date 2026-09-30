import { registerItem } from '../registry.js';

// The Sixth Bullet does not fly: it circles you (r 130, 5.5 rad/s, infinite pierce, wipes enemy bullets it touches, 0.35 s re-hit per foe, x0.7 damage
// per hit) for 4 s, +1 s per extra copy. At most 3 orbit at once (Bullets), the oldest expires. Orbit beats Ten-Gauge Hammer's split.
registerItem({
  id: 'carousel_slug', name: 'Carousel Slug', desc: 'The Sixth Bullet circles you for 4 s', type: 'passive', pool: ['treasure', 'boss', 'c2'], weight: 0.5,
  icon: { sheet: 'items2_d', name: 'carousel_slug' },
  tags: ['sixth', 'ammo'], tier: 3, gate: 'sixth',
  lore: 'Round and round and round he goes.',
  apply(player, { stats, count }) { stats.sixthOrbit += count === 1 ? 4 : 1; },
});
