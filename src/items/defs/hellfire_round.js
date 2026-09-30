import { registerItem } from '../registry.js';

// The Sixth Bullet detonates on the first enemy it hits (Bullets._afterHit: radius sixthExplode 130, damage = the bullet's total, burn 2.5 s, no self damage,
// source 'sixth') and keeps flying. Six Feet Under (with Widowmaker) adds +40 px and lets the blast count as a Sixth kill.
registerItem({
  id: 'hellfire_round', name: 'Hellfire Round', desc: 'The Sixth Bullet detonates and ignites', type: 'passive', pool: ['boss', 'secret', 'c2'], weight: 0.5,
  icon: { sheet: 'items2_d', name: 'hellfire_round' },
  tags: ['sixth', 'fire', 'explosive'], tier: 3, gate: 'sixth',
  lore: 'Loaded in the low place.',
  apply(player, { stats }) { stats.sixthExplode = Math.max(stats.sixthExplode, 130); },
});
