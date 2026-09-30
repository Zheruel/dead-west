import { registerItem } from '../registry.js';

// While rolling, enemy bullets within 70 px (+30 per extra copy) are thrown back: they become a spectral player bullet for your damage aimed at the
// nearest foe (Bullets._reflect). Pure stat item.
registerItem({
  id: 'hand_mirror', name: 'Hand Mirror', desc: 'Bullets that meet you mid-roll fly back', type: 'passive', pool: ['treasure', 'boss', 'secret'], weight: 0.6,
  icon: { sheet: 'items2_b', name: 'hand_mirror' },
  tags: ['roll', 'armor'], tier: 2, gate: 'lawman',
  lore: "Seven years' bad luck. Seven bullets back.",
  apply(player, { stats, count }) { stats.rollReflect += count === 1 ? 70 : 30; },
});
