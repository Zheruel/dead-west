import { registerItem } from '../registry.js';

// Devil's deal (1 heart container, paid by the Crossroads room / ItemSystem.payDeal): x1.5 bullet damage, but you shoot 15% slower. Pure stats.
registerItem({
  id: 'devils_own_colt', name: "Devil's Own Colt", desc: 'x1.5 damage, slower fire. Costs a heart container', type: 'passive', pool: ['crossroads'], weight: 1,
  icon: { sheet: 'items2_e', name: 'devils_own_colt' },
  tags: ['curse', 'ammo'], tier: 3,
  deal: { pay: { container: 1 } },
  lore: 'Signed, sealed, loaded.',
  apply(player, { stats }) { stats.bulletDamageMult *= 1.5; stats.fireDelay *= 1.15; },
});
