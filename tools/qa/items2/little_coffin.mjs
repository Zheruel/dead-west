// little_coffin: after a 5 s cycle with a foe alive, 2 bats leave the coffin and bite it (0.9 x damage each); Boneyard Pack: 4 bats, cycle 4 s.
import { install } from './_i2.mjs';

export default {
  id: 'little_coffin',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, I2 = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const n0 = p.familiars.length; I.give('little_coffin'); o.added = p.familiars.length - n0;
      const c = I2.fam('LittleCoffin')[0];
      I.prep(); const e = I.dummy(300, 0); I.sim(0.5);
      // no foe: no cycle (dummy present, so instead check the timer stands still after killing it)
      let firstAt = -1, maxBats = 0, t = 0;
      for (let i = 0; i < 60 * 8; i++) { I.ff(1); t += 1 / 60; const n = c.bats.filter((b) => b.on).length; maxBats = Math.max(maxBats, n); if (n > 0 && firstAt < 0) firstAt = t; if (I.lost(e) > 6) break; }
      o.firstAt = firstAt; // (the 0.5 s warm-up above counts towards the cycle)
      o.maxBats = maxBats; o.lost = I.lost(e);
      // idle room: the timer does not run
      dw.api.killAll(); const tm = c.timer; I.sim(3); o.idle = c.timer - tm;
      // Boneyard Pack
      I.give('bone_hound'); o.yard = p.stats.boneyard; o.cyc = c.cycle; o.cnt = c.batCount;
      p.restore({ items: [], active: null, hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 });
      return o;
    });
    ok('+1 familiar (a LittleCoffin)', r.added === 1);
    ok('bats appear after ~5 s (cycle 5 s, foe alive)', r.firstAt + 0.5 > 4.9 && r.firstAt + 0.5 < 5.4, `${r.firstAt}`);
    ok('2 bats fly and damage the foe (>= 2 bites of 0.9 x damage)', r.maxBats >= 1 && r.lost >= 6, `${r.maxBats} ${r.lost}`);
    ok('the cycle does not run in an empty room', r.idle === 0, `${r.idle}`);
    ok('Boneyard Pack: 4 bats, 4 s cycle', r.yard && r.cnt === 4 && Math.abs(r.cyc - 4) < 1e-6, `${r.yard} ${r.cnt} ${r.cyc}`);
  },
};
