import { registerItem } from '../registry.js';

// Bullets split on their first enemy hit (Bullets._split): 2 children at +-35 deg, 0.8x speed, 0.35 s life, 40% damage, never re-split.
// Extra copies add +1 child each (max 5). Pure stat item: Player.fire copies stats.splitCount into the bullet mods.
registerItem({
  id: 'forked_tongue', name: 'Forked Tongue', desc: 'Bullets split in two when they hit', type: 'passive', pool: ['treasure', 'boss'], weight: 1.0,
  icon: { sheet: 'items2_a', name: 'forked_tongue' },
  tags: ['spread', 'ammo'], tier: 2,
  lore: 'Say it twice, hit it twice.',
  apply(player, { stats, count }) {
    stats.splitCount = Math.min(5, stats.splitCount + (count === 1 ? 2 : 1));
    stats.splitMult = 0.4;
  },
});
