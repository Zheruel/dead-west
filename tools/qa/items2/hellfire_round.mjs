// hellfire_round: the Sixth Bullet detonates (r 130, damage = bullet total, burn) on its first hit, damaging neighbours, never the player.
import { install } from './_i2.mjs';

export default {
  id: 'hellfire_round',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, I2 = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      I.give('hellfire_round'); o.sx = p.stats.sixthExplode;
      I.prep(); p.godMode = false; p.hp = p.maxHp; const a = I.dummy(300, 0), b = I.dummy(300, 100), far = I.dummy(300, 260);
      I2.sixth(1, 0);
      I.sim(1.5, () => I.lost(b) > 0); I.sim(0.3);
      o.a = I.lost(a); o.b = I.lost(b); o.far = I.lost(far); o.hp = p.hp === p.maxHp; o.burn = !!(b.status && b.status.burn);
      // a normal shot does not detonate
      I.prep(); const c = I.dummy(300, 0), d = I.dummy(300, 100); p.cyl.pos = 0; I.shoot(1, 0); I.sim(1.0); o.normalNeighbour = I.lost(d);
      return o;
    });
    ok('sixthExplode 130', r.sx === 130, `${r.sx}`);
    ok('the neighbour 100 px away is hurt by the blast, one 260 px away is not', r.b > 0 && r.far === 0, `${r.b} ${r.far}`);
    ok('the blast ignites, the player is untouched', r.burn && r.hp, `${r.burn} ${r.hp}`);
    ok('the primary target takes the full Sixth hit (2 x 3.5 = 7) and the neighbour the same blast damage (+ burn)', Math.abs(r.a - 7) < 0.01 && r.b >= 7, `${r.a} ${r.b}`);
    ok('normal shots do not explode', r.normalNeighbour === 0, `${r.normalNeighbour}`);
  },
};
