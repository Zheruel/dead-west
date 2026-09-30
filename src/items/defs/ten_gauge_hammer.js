import { registerItem } from '../registry.js';

// The Sixth Bullet becomes 5 heavy slugs at 0, +-10, +-20 degrees (stats.sixthSplit = 4, engine spawns the extras at 0.6 x). The engine leaves the centre
// slug(s) at full damage, so the `sixthFired` hook scales the non-extra slugs to 0.6 x as well (INTEGRATION_REQUESTS: move into Player.fire). Orbit beats
// split (ITEMS_V2 2.3): `applyLate` zeroes sixthSplit while Carousel Slug is owned.
registerItem({
  id: 'ten_gauge_hammer', name: 'Ten-Gauge Hammer', desc: 'The Sixth Bullet is a spread of 5 heavy slugs', type: 'passive', pool: ['treasure', 'boss'], weight: 0.7,
  icon: { sheet: 'items2_d', name: 'ten_gauge_hammer' },
  tags: ['sixth', 'spread'], tier: 2,
  lore: 'Subtle is for the living.',
  apply(player, { stats }) { stats.sixthSplit = Math.max(stats.sixthSplit, 4); },
  applyLate(player, { stats }) { if (stats.sixthOrbit > 0) stats.sixthSplit = 0; }, // orbit beats split: no extra slugs would only evict older orbiters
  hooks: {
    sixthFired(player, ctx, { stats }) {
      const list = ctx.bullets, n = Math.max(1, stats.bulletCount | 0);
      if (stats.sixthOrbit > 0) return; // orbiting Sixth: single orbiter at its own damage
      for (let i = 0; i < list.length && i < n; i++) list[i].mult *= 0.6;
    },
  },
});
