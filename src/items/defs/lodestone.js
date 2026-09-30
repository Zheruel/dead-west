import { registerItem } from '../registry.js';

// Bullets drag foes within 140 px toward them at 110 px/s (x2 for the Sixth Bullet). Bosses and `heavy` enemies are immune (Bullets._pull).
// The `fire` hook gives the slugs a cold iron tint unless a status colour (burn / poison / fear / crit) already owns them.
registerItem({
  id: 'lodestone', name: 'Lodestone', desc: 'Bullets drag nearby foes along', type: 'passive', pool: ['treasure', 'boss'], weight: 0.7,
  icon: { sheet: 'items2_a', name: 'lodestone' },
  tags: ['ammo'], tier: 2, gate: 'mine',
  lore: 'Everything comes to it eventually.',
  apply(player, { stats }) {
    stats.pullRadius = Math.max(stats.pullRadius, 140);
    stats.pullSpeed = Math.max(stats.pullSpeed, 110);
  },
  hooks: {
    fire(player, ctx) {
      const list = ctx.bullets;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (!b.m || !b.m.pull || b.sixth || b.dead || b.crit || b.burn || b.poison || b.fear || b.m.chain || b.m.ghost || b.m.chill || b.m.explode) continue;
        b.sprite.setTint(0xc8c8dc); b.glow.setTint(0xa0a0b0); b.streak.setTint(0xa0a0b0);
      }
    },
  },
});
