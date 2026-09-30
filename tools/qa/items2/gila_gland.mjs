// gila_gland: poison 1.5 dps, up to 3 stacks (4.5 dps); a poisoned death leaves a toxic cloud (r 110, 3 s) that never hurts the player.
import { install } from './_i1.mjs';
export default {
  id: 'gila_gland',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, o = {};
      const { itemFx } = await import('/src/items/fx/ItemFx.js');
      I.give('gila_gland'); const s = p.stats; o.s = [s.poison, s.poisonStackMax, s.poisonCloud];
      I.prep(); const e = I.dummy(300, 0);
      for (let i = 0; i < 3; i++) { I.shoot(1, 0); I.sim(0.45); }
      const pz = e.status.poison; o.stacks = pz && pz.stacks; o.dps = pz && pz.dps * pz.stacks;
      // a poisoned kill: player stands inside the cloud, godMode off
      I.prep(); p.godMode = false; p.hp = 10;
      const v = I.dummy(70, 0, { hp: 30 }), n = I.dummy(70, 60);
      v.applyStatus('poison', { dps: 1.5, t: 5, max: 3 }); v.takeHit(100, {});
      const cl = itemFx(dw.scene).clouds.find((c) => c.on); o.cloud = cl ? [cl.r, cl.life] : null;
      I.sim(1.6); o.neighbour = !!n.status.poison; o.hp = p.hp;
      return o;
    });
    ok('poison 1.5, stackMax 3, cloud 110', r.s[0] === 1.5 && r.s[1] === 3 && r.s[2] === 110, JSON.stringify(r.s));
    ok('three hits stack poison to 3 (4.5 dps)', r.stacks === 3 && Math.abs(r.dps - 4.5) < 1e-9, `${r.stacks} ${r.dps}`);
    ok('a poisoned kill leaves a 110 px, 3 s cloud', r.cloud && r.cloud[0] === 110 && r.cloud[1] === 3, JSON.stringify(r.cloud));
    ok('the cloud poisons neighbours and never hurts the player', r.neighbour && r.hp === 10, `n ${r.neighbour} hp ${r.hp}`);
  },
};
