import { registerItem } from '../registry.js';

// Engine sample (FN-4): proves the chill / frozen / shatter pipeline with stats only. FE-I1 owns the final file.
// 20% of shots chill; three chills freeze (Enemy.applyStatus), frozen foes take x1.4 and shatter into ice shards on death (items/fx/Kill.js).
registerItem({
  id: 'blue_norther', name: 'Blue Norther', desc: '20% of shots chill; three chills freeze', type: 'passive', pool: ['treasure', 'shop', 'boss'], weight: 0.8,
  icon: { sheet: 'items2_a', name: 'blue_norther' },
  tags: ['frost'], tier: 2,
  lore: 'The wind that kills by noon.',
  apply(player, { stats }) { stats.chillChance += 0.2; },
});
