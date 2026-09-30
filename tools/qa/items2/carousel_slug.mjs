// carousel_slug: the Sixth Bullet orbits at r 130 for 4 s (+1 s per copy), hits stationary foes on the circle, cap 3 orbiters.
import { install } from './_i2.mjs';

export default {
  id: 'carousel_slug',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, I2 = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      I.give('carousel_slug'); o.orbit = p.stats.sixthOrbit;
      I.prep(); const e = I.dummy(130, 0);
      const bl = I2.sixth(1, 0); o.n = p.orbiters.length; o.bullets = bl.length;
      I.sim(0.3); const ob = p.orbiters[0]; o.r = ob ? Math.hypot(ob.x - p.x, ob.y - (p.y - 6)) : -1;
      I.sim(3.4); o.at37 = p.orbiters.length; o.lost = I.lost(e);
      I.sim(0.5); o.at42 = p.orbiters.length;
      // cap of 3
      I.prep(); for (let i = 0; i < 6; i++) { I2.sixth(1, 0); I.sim(0.05); } o.cap = p.orbiters.length;
      // 2nd copy: 5 s
      I.give('carousel_slug'); o.orbit2 = p.stats.sixthOrbit; I.prep(); I2.sixth(1, 0); I.sim(4.5); o.at45 = p.orbiters.length; I.sim(0.7); o.at52 = p.orbiters.length;
      return o;
    });
    ok('sixthOrbit 4 (5 with a second copy)', r.orbit === 4 && r.orbit2 === 5, `${r.orbit} ${r.orbit2}`);
    ok('one orbiter replaces the flying Sixth Bullet, on a 130 px circle', r.n === 1 && r.bullets === 1 && Math.abs(r.r - 130) < 6, `${r.n} ${r.bullets} ${r.r}`);
    ok('it damages a stationary foe on the circle', r.lost > 0, `${r.lost}`);
    ok('it lives ~4 s (there at 3.7 s, gone at 4.2 s)', r.at37 === 1 && r.at42 === 0, `${r.at37} ${r.at42}`);
    ok('at most 3 orbit at once', r.cap === 3, `${r.cap}`);
    ok('a second copy lasts 5 s', r.at45 === 1 && r.at52 === 0, `${r.at45} ${r.at52}`);
  },
};
