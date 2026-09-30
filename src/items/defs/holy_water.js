import { registerItem } from '../registry.js';

// 10% of hits call down holy light: AoE r 80 at the victim for damage x2 (x2 more against the undead), 0.4 s global cooldown (Bullets smite hook,
// items/fx/Smite.js). Extra copies stack the chance (capped 35%).
registerItem({
  id: 'holy_water', name: 'Vial of Holy Water', desc: '10% of hits call down holy light', type: 'passive', pool: ['treasure', 'shop', 'boss'], weight: 0.8,
  icon: { sheet: 'items2_b', name: 'holy_water' },
  tags: ['holy', 'undead_slayer'], tier: 2,
  lore: 'Blessed by a priest who owed us.',
  apply(player, { stats }) {
    stats.smiteChance += 0.1;
    stats.smiteRadius = Math.max(stats.smiteRadius, 80);
    stats.smiteMult = Math.max(stats.smiteMult, 2);
  },
});
