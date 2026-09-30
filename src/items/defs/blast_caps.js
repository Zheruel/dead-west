import { registerItem } from '../registry.js';

// 12% of shots explode on impact: radius 90, 60% damage to everything else in the blast, no self damage, no obstacle break (Bullets, `cap` source,
// max 6 per frame). Flagged bullets use the `bullet_cap` frame.
registerItem({
  id: 'blast_caps', name: 'Blasting Caps', desc: '12% of shots explode on impact', type: 'passive', pool: ['treasure', 'shop'], weight: 1.0,
  icon: { sheet: 'items2_a', name: 'blast_caps' },
  tags: ['explosive', 'ammo'], tier: 1, gate: 'pyro',
  lore: 'Small pops, big feelings.',
  apply(player, { stats }) {
    stats.explodeChance += 0.12;
    stats.explodeRadius = Math.max(stats.explodeRadius, 90);
    stats.explodeMult = 0.6;
  },
});
