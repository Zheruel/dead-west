import { registerItem } from '../registry.js';

// Devil's deal (2 keys): every 3rd shot is a Sixth Bullet (x1 more Sixth damage, +1 pierce), but every other shot hits at 60%.
registerItem({
  id: 'cylinder_of_sin', name: 'Cylinder of Sin', desc: 'Every 3rd shot is a Sixth Bullet. Others hit weak', type: 'passive', pool: ['crossroads'], weight: 1,
  icon: { sheet: 'items2_e', name: 'cylinder_of_sin' },
  tags: ['sixth', 'curse'], tier: 3, gate: 'bloodpact',
  deal: { pay: { keys: 2 } },
  lore: 'Three chambers. Three sins.',
  apply(player, { stats }) {
    stats.sixthEvery = 3;
    stats.sixthMult += 1;
    stats.sixthPierce += 1;
    stats.normalDamageMult *= 0.6;
  },
});
