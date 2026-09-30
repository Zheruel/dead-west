// rabbits_foot: +1 luck, lucky shots x2.5 (critMult 1 + 1.5), critCap 0.4.
import { install } from './_i2.mjs';

export default {
  id: 'rabbits_foot',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      o.luck0 = p.stats.luck; o.cm0 = p.stats.critMult; o.cc0 = p.stats.critCap;
      I.give('rabbits_foot'); const s = p.stats; o.luck = s.luck; o.cm = s.critMult; o.cc = s.critCap;
      // statistical: with high luck (cap 40 %) lucky shots carry mult 2.5
      I.prep(); I.dummy(300, 0); s.luck = 100; const mults = new Set(); let crits = 0; const N = 200;
      for (let i = 0; i < N; i++) { I.shoot(1, 0); const bl = sc.bullets.player.list.filter((b) => b.active); const b = bl[bl.length - 1]; if (b) { mults.add(+b.mult.toFixed(2)); if (b.mult > 2) crits++; } sc.bullets.player.clear(); p.cyl.pos = 0; }
      o.mults = [...mults]; o.rate = crits / N;
      return o;
    });
    ok('luck +1', r.luck === r.luck0 + 1, `${r.luck0} -> ${r.luck}`);
    ok('critMult 2.5, critCap 0.4', Math.abs(r.cm - 2.5) < 1e-6 && Math.abs(r.cc - 0.4) < 1e-6, `${r.cm} ${r.cc}`);
    ok('lucky shots really deal x2.5, about 40% at the cap', r.mults.includes(2.5) && r.rate > 0.25 && r.rate < 0.55, `${r.mults} ${r.rate}`);
  },
};
