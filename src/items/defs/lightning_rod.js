import { registerItem } from '../registry.js';

// 20% of shots are charged: on hit they arc to 2 other foes within 260 px for 50% damage (Bullets._chain, Fx.arc, capped 60%).
// The `fire` hook only paints the charged slugs pale yellow (no allocation; runs once per trigger pull).
registerItem({
  id: 'lightning_rod', name: 'Lightning Rod', desc: '20% of hits arc lightning to 2 nearby foes', type: 'passive', pool: ['treasure', 'boss', 'secret'], weight: 0.8,
  icon: { sheet: 'items2_a', name: 'lightning_rod' },
  tags: ['shock'], tier: 2,
  lore: 'Stand near the tall fellow.',
  apply(player, { stats }) {
    stats.chainChance += 0.2;
    stats.chainCount = Math.max(stats.chainCount, 2);
    stats.chainMult = 0.5;
    stats.chainRange = Math.max(stats.chainRange, 260);
  },
  hooks: {
    fire(player, ctx) {
      const list = ctx.bullets;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (!b.m || !b.m.chain || b.sixth || b.dead || b.crit) continue;
        b.sprite.setTint(0xfff2a0); b.glow.setTint(0xffe070); b.streak.setTint(0xffe070);
      }
    },
  },
});
