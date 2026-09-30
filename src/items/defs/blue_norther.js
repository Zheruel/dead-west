import { registerItem } from '../registry.js';

// 20% of shots chill (3 s, x0.7 speed, stacks to 3); the third chill freezes: stunned 1.2 s and x1.4 damage taken. A foe killed while frozen
// shatters into 5 ice shards (40% of the killing blow, items/fx/Kill.js). Bosses only slow (x0.85), never freeze. Frame `bullet_ice`.
registerItem({
  id: 'blue_norther', name: 'Blue Norther', desc: '20% of shots chill; three chills freeze', type: 'passive', pool: ['treasure', 'shop', 'boss'], weight: 0.8,
  icon: { sheet: 'items2_a', name: 'blue_norther' },
  tags: ['frost'], tier: 2,
  lore: 'The wind that kills by noon.',
  apply(player, { stats }) { stats.chillChance += 0.2; },
});
