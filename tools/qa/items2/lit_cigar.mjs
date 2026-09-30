// lit_cigar: dynamite lands dynamiteThrow 288 px ahead, fuse 1.4 x 0.6 = 0.84 s, +25 % blast damage.
import { install } from './_i2.mjs';

export default {
  id: 'lit_cigar',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const d0 = p.stats.dynamiteDamage; I.give('lit_cigar'); const s = p.stats;
      o.s = [s.dynamiteThrow, +s.dynamiteFuse.toFixed(3), s.dynamiteDamage / d0];
      I.prep(); p.dynamite = 3; p.facing = 'right'; sc.dynamites.length = 0;
      p.placeDynamite(); const d = sc.dynamites[sc.dynamites.length - 1];
      o.tx = d.x; o.dx = d.x - p.x; o.fuse = d.maxFuse;
      I.sim(0.6); o.landed = d.flightT >= d.flight && d.fuse > 0 && d.fuse < d.maxFuse;
      o.exploded = I.sim(2, () => !d.alive);
      p.facing = 'left'; p.dynamite = 3; p.placeDynamite(); const d2 = sc.dynamites[sc.dynamites.length - 1]; o.left = p.x - d2.x;
      return o;
    });
    ok('dynamiteThrow 288, fuse 0.84, damage x1.25', r.s[0] === 288 && r.s[1] === 0.84 && Math.abs(r.s[2] - 1.25) < 1e-6, JSON.stringify(r.s));
    ok('the stick lands 288 px ahead (facing right and left)', Math.abs(r.dx - 288) < 2 && Math.abs(r.left - 288) < 2, `${r.dx} ${r.left}`);
    ok('the fuse starts after the flight and is 0.84 s', Math.abs(r.fuse - 0.84) < 1e-6 && r.landed && r.exploded, `${r.fuse} ${r.landed} ${r.exploded}`);
  },
};
