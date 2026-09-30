import { registerItem } from '../registry.js';

// +0.4 damage per missing red HP unit (half heart). Runs in the late phase so it sees the final max hearts; Player.damage/heal recompute stats.
registerItem({
  id: 'liquid_courage', name: 'Liquid Courage', desc: '+0.4 damage per missing half heart', type: 'passive', pool: ['treasure', 'shop', 'secret'],
  icon: { sheet: 'items_passive_b', name: 'liquid_courage' },
  tags: ['blood'], tier: 2,
  lore: 'The closer you get to dead, the braver you get.',
  applyLate(player, { stats }) {
    const maxHp = Math.max(1, Math.min(12, Math.round(stats.maxHearts))) * 2;
    stats.damage += 0.4 * Math.max(0, maxHp - player.hp);
  },
});
