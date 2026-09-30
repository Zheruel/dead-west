import { registerItem } from '../registry.js';

// +1 luck (drops, loot, lucky-shot chance luck x 3 %), lucky shots hit for x2.5 instead of x1.5 (critMult +1.0) and the lucky-shot chance cap rises
// from 30 % to 40 % (critCap +0.10). All consumed by Player.fire.
registerItem({
  id: 'rabbits_foot', name: "Rabbit's Foot", desc: '+1 luck. Lucky shots hit x2.5', type: 'passive', pool: ['treasure', 'shop', 'secret'], weight: 1,
  icon: { sheet: 'items2_c', name: 'rabbits_foot' },
  tags: ['luck', 'crit'], tier: 1,
  lore: 'Lucky for someone. Not the rabbit.',
  apply(player, { stats }) { stats.luck += 1; stats.critMult += 1.0; stats.critCap += 0.10; },
});
