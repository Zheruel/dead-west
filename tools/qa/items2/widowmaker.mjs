// widowmaker: sixthMult +0.5; a kill with the Sixth Bullet loads the next chamber with another Sixth (cyl.pos = sixthEvery - 1), rate limited.
import { install } from './_i2.mjs';

export default {
  id: 'widowmaker',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, I2 = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const m0 = p.stats.sixthMult; I.give('widowmaker'); o.mult = p.stats.sixthMult - m0; o.refund = p.stats.sixthRefund;
      // Sixth kill -> next shot is a Sixth
      I.prep(); const e = I.dummy(300, 0, { hp: 5 }); I2.sixth(1, 0); o.killed = I.sim(2, () => !e.alive); I.sim(0.1);
      o.pos = p.cyl.pos; o.every = p.stats.sixthEvery;
      sc.bullets.player.clear(); I.shoot(1, 0); o.next = sc.bullets.player.list.some((b) => b.active && b.sixth);
      // a normal kill does not refund
      I.prep(); const f = I.dummy(300, 0, { hp: 2 }); p.cyl.pos = 0; I.shoot(1, 0); o.killed2 = I.sim(2, () => !f.alive); I.sim(0.1); o.pos2 = p.cyl.pos;
      return o;
    });
    ok('sixthMult +0.5, sixthRefund 1', Math.abs(r.mult - 0.5) < 1e-6 && r.refund === 1, `${r.mult} ${r.refund}`);
    ok('a Sixth kill sets the chamber (cyl.pos = sixthEvery - 1)', r.killed && r.pos === r.every - 1, `${r.killed} ${r.pos}/${r.every}`);
    ok('the next shot is a Sixth Bullet', r.next);
    ok('a normal kill does not refund', r.killed2 && r.pos2 === 1, `${r.killed2} ${r.pos2}`);
  },
};
