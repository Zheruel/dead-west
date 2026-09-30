import { registerItem } from '../registry.js';

// +8% chance to ignite, burning foes take +30% damage (Enemy.takeHit), a burning death ignites everything within 150 px for 2.5 s (items/fx/Kill.js).
registerItem({
  id: 'brand_iron', name: 'Branding Iron', desc: 'Burning foes take +30% damage; fire spreads on death', type: 'passive', pool: ['treasure', 'boss'], weight: 0.8,
  icon: { sheet: 'items2_a', name: 'brand_iron' },
  tags: ['fire'], tier: 2, gate: 'perdition',
  lore: 'Property of the Devil.',
  apply(player, { stats }) {
    stats.burn += 0.08;
    stats.burnVuln += 0.3;
    stats.burnSpread = Math.max(stats.burnSpread, 150);
  },
});
