import { registerItem } from '../registry.js';

// Every 4th shot (3rd with a second copy) is a boomerang bone: full damage out and back, infinite pierce, size 1.25, spins. The Sixth Bullet
// takes priority over it. Player.fire counts the shots (stats.boomerangEvery), Bullets runs the out / return phases.
registerItem({
  id: 'widows_bone', name: "Widow's Bone", desc: 'Every 4th shot is a boomerang bone', type: 'passive', pool: ['treasure', 'boss'], weight: 0.8,
  icon: { sheet: 'items2_a', name: 'widows_bone' },
  tags: ['ammo', 'pierce', 'bounce'], tier: 2, gate: 'scrap',
  lore: 'She always comes back.',
  apply(player, { stats, count }) { stats.boomerangEvery = count > 1 ? 3 : 4; },
});
