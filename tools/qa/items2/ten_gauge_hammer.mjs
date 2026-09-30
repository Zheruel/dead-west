// ten_gauge_hammer: the Sixth Bullet is 5 slugs at 0, +-10, +-20 degrees, each x0.6 of the Sixth damage; Carousel Slug (orbit) wins over the split.
import { install } from './_i2.mjs';

export default {
  id: 'ten_gauge_hammer',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, I2 = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      I.give('ten_gauge_hammer'); o.split = p.stats.sixthSplit; const sm = p.stats.sixthMult;
      I.prep(); I.dummy(600, 0);
      const bl = I2.sixth(1, 0);
      o.n = bl.length; o.angles = bl.map((b) => Math.round((Math.atan2(b.vy, b.vx) * 180) / Math.PI)).sort((x, y) => x - y);
      o.mults = bl.map((b) => +(b.mult / sm).toFixed(3));
      o.allSixth = bl.every((b) => b.sixth);
      // a normal shot is a single bullet
      sc.bullets.player.clear(); p.cyl.pos = 0; I.shoot(1, 0); o.normal = sc.bullets.player.list.filter((b) => b.active).length;
      // with Carousel Slug: only the orbiter
      I.give('carousel_slug'); o.split2 = p.stats.sixthSplit; I.prep(); const b2 = I2.sixth(1, 0); o.n2 = b2.length; o.orb = p.orbiters.length;
      return o;
    });
    ok('sixthSplit 4', r.split === 4, `${r.split}`);
    ok('5 slugs in a 40 degree fan', r.n === 5 && JSON.stringify(r.angles) === '[-20,-10,0,10,20]', `${r.n} ${JSON.stringify(r.angles)}`);
    ok('each slug is x0.6 of the Sixth damage', r.mults.every((m) => Math.abs(m - 0.6) < 0.01), JSON.stringify(r.mults));
    ok('normal shots stay single', r.normal === 1, `${r.normal}`);
    ok('orbit beats split: with Carousel Slug one orbiter only', r.split2 === 0 && r.n2 === 1 && r.orb === 1, `${r.split2} ${r.n2} ${r.orb}`);
  },
};
