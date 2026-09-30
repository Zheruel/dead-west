// lightning_rod: chainChance 0.2, chainCount 2, chainMult 0.5, chainRange 260; a chained hit arcs to 2 nearby foes for 50%.
import { install } from './_i1.mjs';
export default {
  id: 'lightning_rod',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, o = {};
      I.give('lightning_rod'); const s = p.stats; o.s = [s.chainChance, s.chainCount, s.chainMult, s.chainRange];
      I.prep(); const a = I.dummy(300, 0), b = I.dummy(300, 90), c = I.dummy(300, -90), far = I.dummy(300, 400);
      s.chainChance = 1; // force the roll
      I.shoot(1, 0);
      I.sim(8.0, () => I.lost(b) > 0 && I.lost(c) > 0); I.sim(0.3);
      o.a = I.lost(a); o.b = I.lost(b); o.c = I.lost(c); o.far = I.lost(far);
      p.recomputeStats(); o.chanceBack = p.stats.chainChance;
      p.restore({ items: ['lightning_rod', 'ricochet'], hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 });
      o.static = [p.synergies.has('static_ricochet'), !!p.stats.staticRicochet];
      return o;
    });
    ok('chain stats 0.2 / 2 / 0.5 / 260', r.s[0] === 0.2 && r.s[1] === 2 && r.s[2] === 0.5 && r.s[3] === 260, JSON.stringify(r.s));
    ok('a forced chain hurts the 2 neighbours for 50%', Math.abs(r.b - 1.75) < 0.1 && Math.abs(r.c - 1.75) < 0.1, `${r.b} ${r.c}`);
    ok('the primary target takes the full hit, a far foe nothing', Math.abs(r.a - 3.5) < 0.1 && r.far === 0, `${r.a} ${r.far}`);
    ok('with Ricochet: Static Ricochet active', r.static[0] && r.static[1], JSON.stringify(r.static));
  },
};
