// blood_bandana: at hp <= 4 (2 hearts): fireDelay x0.7, +40 move speed; back to normal above 4; red speed trail while moving.
import { install } from './_i1.mjs';
export default {
  id: 'blood_bandana',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      p.hp = p.maxHp; p.recomputeStats(); const fd = p.stats.fireDelay, ms = p.stats.moveSpeed;
      I.give('blood_bandana'); p.hp = p.maxHp; p.recomputeStats();
      o.full = [p.stats.fireDelay / fd, p.stats.moveSpeed - ms];
      p.hp = 5; p.recomputeStats(); o.five = [p.stats.fireDelay / fd, p.stats.moveSpeed - ms];
      p.hp = 4; p.recomputeStats(); o.four = [p.stats.fireDelay / fd, p.stats.moveSpeed - ms];
      p.godMode = false; p.heal(1); o.healed = [p.stats.fireDelay / fd, p.stats.moveSpeed - ms]; // 4 -> 5
      p.hp = 3; I.sim(0.1); o.hook = [p.stats.fireDelay / fd, p.stats.moveSpeed - ms]; // hp changed without a recompute: the update hook catches it
      let trail = 0; const orig = sc.fx.burst; sc.fx.burst = function (...a) { if (a[2] && a[2].alpha && a[2].alpha[0] === 0.55) trail++; return orig.apply(this, a); };
      dw.api.input({ move: { x: 1, y: 0 }, aim: { x: 1, y: 0 }, fire: false }); I.sim(0.6); dw.api.input(null);
      sc.fx.burst = orig; o.trail = trail;
      p.hp = p.maxHp; p.recomputeStats(); I.sim(0.1); o.back = [p.stats.fireDelay / fd, p.stats.moveSpeed - ms];
      return o;
    });
    const near = (a, x, y) => Math.abs(a[0] - x) < 1e-9 && a[1] === y;
    ok('full health: no effect', near(r.full, 1, 0), JSON.stringify(r.full));
    ok('5 units (2.5 hearts): no effect', near(r.five, 1, 0), JSON.stringify(r.five));
    ok('4 units: fireDelay x0.7, +40 speed', near(r.four, 0.7, 40), JSON.stringify(r.four));
    ok('healing to 5 units switches it off', near(r.healed, 1, 0), JSON.stringify(r.healed));
    ok('a raw hp change is caught by the update hook', near(r.hook, 0.7, 40), JSON.stringify(r.hook));
    ok('red trail puffs while moving at low health', r.trail >= 3, `${r.trail}`);
    ok('back to normal at full health', near(r.back, 1, 0), JSON.stringify(r.back));
  },
};
