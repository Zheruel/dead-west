import { registerItem } from '../registry.js';

// 25% of shots are ghostly: they ignore rocks, gain +1 pierce and x1.15 damage, tinted pale green (`bullet_ghost`). Rolled per pellet in Player.fire.
registerItem({
  id: 'wraith_rounds', name: 'Wraith Rounds', desc: '25% of shots are ghostly: through rocks, +1 pierce', type: 'passive', pool: ['treasure', 'secret'], weight: 0.7,
  icon: { sheet: 'items2_a', name: 'wraith_rounds' },
  tags: ['ghost', 'pierce'], tier: 2, gate: 'sniper',
  lore: 'Rocks are just suggestions.',
  apply(player, { stats }) { stats.ghostChance += 0.25; },
});
