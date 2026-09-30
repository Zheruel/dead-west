import { registerItem } from '../registry.js';

// At 2 hearts or less (hp <= 4 units): fire 30% faster and +40 move speed (applyLate: hp-dependent). Player recomputes stats on every hp change;
// the `update` hook only double-checks the threshold (a cheap compare) and lays a faint red speed trail while moving.
const LOW = 4;
registerItem({
  id: 'blood_bandana', name: 'Blood Bandana', desc: 'At 2 hearts or less: fire 30% faster, +40 speed', type: 'passive', pool: ['treasure', 'shop'], weight: 1.0,
  icon: { sheet: 'items2_b', name: 'blood_bandana' },
  tags: ['blood', 'speed', 'rapid'], tier: 1,
  lore: 'Wash it and you jinx it.',
  state: () => ({ low: false, trailT: 0 }),
  applyLate(player, { stats }) {
    if (player.hp <= LOW) { stats.fireDelay *= 0.7; stats.moveSpeed += 40; }
  },
  hooks: {
    update(player, ctx, { state }) {
      const low = player.hp <= LOW && !player.dead;
      if (low !== state.low) { state.low = low; player.recomputeStats(); }
      if (!low) return;
      state.trailT -= ctx.dt;
      if (state.trailT > 0 || player.vx * player.vx + player.vy * player.vy < 3600) return;
      state.trailT = 0.07;
      player.scene.fx.burst(player.x, player.footY - 4, { color: [0xd63a2a, 0x8a1c1c], count: 2, speed: [10, 50], life: [220, 420], scale: [0.14, 0.3], tex: 'glow', alpha: [0.55, 0], blend: 'ADD' });
    },
  },
});
