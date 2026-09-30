import { registerItem } from '../registry.js';

// +1 damage; x1.5 vs undead (ghost, skeleton, possessed, coffin, miner, Undertaker): Enemy.takeHit reads stats.undeadDamageMult.
registerItem({
  id: 'silver_bullets', name: 'Silver Bullets', desc: '+1 damage, x1.5 vs the undead', type: 'passive', pool: ['treasure', 'shop', 'boss'],
  icon: { sheet: 'items_passive_b', name: 'silver_bullets' },
  tags: ['undead_slayer', 'holy', 'ammo'], tier: 2,
  lore: "For the ones who will not stay buried.",
  apply(player, { stats }) { stats.damage += 1; stats.undeadDamageMult += 0.5; },
});
