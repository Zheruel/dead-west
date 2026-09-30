import { registerItem } from '../registry.js';

// 12% of shots (per copy) carry fear: enemies flee for 2 s (Enemy.takeHit; bosses are immune). Fear bullets are tinted violet.
registerItem({
  id: 'voodoo_doll', name: 'Voodoo Doll', desc: '12% chance shots terrify enemies', type: 'passive', pool: ['treasure', 'shop', 'secret'],
  icon: { sheet: 'items_passive_c', name: 'voodoo_doll' },
  tags: ['hex'], tier: 2,
  lore: 'It looks a lot like the Marshal. Coincidence, probably.',
  apply(player, { stats }) { stats.fearChance = Math.min(1, stats.fearChance + 0.12); },
});
