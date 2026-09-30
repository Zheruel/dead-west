import { registerItem } from '../registry.js';

// +50 % Sixth Bullet damage (sixthMult +0.5). A kill with the Sixth Bullet loads the next chamber with another Sixth (items/fx/Kill.js: stats.sixthRefund,
// rate limited to one per 0.15 s), so a clean chain of Sixth kills never stops.
registerItem({
  id: 'widowmaker', name: 'Widowmaker', desc: 'Kill with the Sixth Bullet: the next shot is a Sixth Bullet', type: 'passive', pool: ['boss', 'c2'], weight: 0.5,
  icon: { sheet: 'items2_d', name: 'widowmaker' },
  tags: ['sixth'], tier: 3, gate: 'c2',
  lore: 'Every kill is a wedding.',
  apply(player, { stats }) { stats.sixthRefund = 1; stats.sixthMult += 0.5; },
});
