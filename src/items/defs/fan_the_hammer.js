import { registerItem } from '../registry.js';

// Fire delay x0.55 but every bullet flies +/-8 degrees off (the Sixth Bullet stays accurate and still crits: Player.fire).
registerItem({
  id: 'fan_the_hammer', name: 'Fan the Hammer', desc: 'Fire much faster, but shots stray', type: 'passive', pool: ['treasure', 'boss'],
  icon: { sheet: 'items_passive_c', name: 'fan_the_hammer' },
  apply(player, { stats, count }) { stats.fireDelay *= 0.55; stats.inaccuracy = Math.max(stats.inaccuracy, 8 + (count - 1) * 2); },
});
