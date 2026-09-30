import { registerItem } from '../registry.js';

// The Sixth Bullet becomes 5 heavy slugs at 0, +-10, +-20 degrees: stats.sixthSplit = 4 extra slugs. Player.fire owns the rest natively: every slug of the
// burst is x0.6 of the Sixth damage, and orbit (Carousel Slug) beats split (ITEMS_V2 2.3) so the extras are never spawned while orbiting.
registerItem({
  id: 'ten_gauge_hammer', name: 'Ten-Gauge Hammer', desc: 'The Sixth Bullet is a spread of 5 heavy slugs', type: 'passive', pool: ['treasure', 'boss'], weight: 0.7,
  icon: { sheet: 'items2_d', name: 'ten_gauge_hammer' },
  tags: ['sixth', 'spread'], tier: 2,
  lore: 'Subtle is for the living.',
  apply(player, { stats }) { stats.sixthSplit = Math.max(stats.sixthSplit, 4); },
});
