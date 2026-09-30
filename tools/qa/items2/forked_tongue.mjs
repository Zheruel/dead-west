// forked_tongue: splitCount 2 (+1 per extra copy, max 5); the first hit spawns children (40% dmg, never re-split).
import { install } from './_i1.mjs';
export default {
  id: 'forked_tongue',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, o = {};
      const { bus } = await import('/src/core/events.js');
      I.give('forked_tongue'); o.s1 = [p.stats.splitCount, p.stats.splitMult];
      I.prep(); const a = I.dummy(300, 0), b = I.dummy(349, 34); // b sits on the +35 degree child path
      let kids = 0; const f = (e) => { if (e.bullet.child) kids++; }; bus.on('bullet:fired', f);
      I.shoot(1, 0);
      I.sim(8.0, () => kids >= 2); I.sim(0.7);
      bus.off('bullet:fired', f);
      o.kids = kids; o.aLoss = I.lost(a); o.bLoss = I.lost(b);
      I.give('forked_tongue'); o.s2 = p.stats.splitCount;
      I.give('forked_tongue', 3); o.s5 = p.stats.splitCount;
      return o;
    });
    ok('splitCount 2, splitMult 0.4', r.s1[0] === 2 && r.s1[1] === 0.4, JSON.stringify(r.s1));
    ok('one hit spawns exactly 2 children', r.kids === 2, `kids ${r.kids}`);
    ok('primary victim takes the full hit (3.5)', Math.abs(r.aLoss - 3.5) < 0.05, `${r.aLoss}`);
    ok('a child hits the neighbour for 40% (1.4)', r.bLoss > 1.3 && r.bLoss < 1.5, `${r.bLoss}`);
    ok('extra copy +1 child, capped at 5', r.s2 === 3 && r.s5 === 5, `${r.s2} ${r.s5}`);
  },
};
