import { registerItem } from '../registry.js';

// Dynamite is thrown dynamiteThrow px (3 tiles) ahead along your facing (Player.placeDynamite arcs the stick), with a 40 % shorter fuse (min 0.5 s) and
// +25 % blast damage.
registerItem({
  id: 'lit_cigar', name: 'Lit Cigar', desc: 'Throw dynamite 3 tiles ahead. Short fuse, +25% blast', type: 'passive', pool: ['treasure', 'shop'], weight: 1,
  icon: { sheet: 'items2_c', name: 'lit_cigar' },
  tags: ['dynamite', 'explosive'], tier: 1,
  lore: 'Smoke it or throw it.',
  apply(player, { stats }) {
    stats.dynamiteThrow = Math.max(stats.dynamiteThrow, 288);
    stats.dynamiteFuse = Math.max(0.5, stats.dynamiteFuse * 0.6);
    stats.dynamiteDamage *= 1.25;
  },
});
