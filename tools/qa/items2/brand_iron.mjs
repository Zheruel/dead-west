// brand_iron: +8% burn, burning foes take +30%, a burning death ignites everything within 150 px.
import { install } from './_i1.mjs';
export default {
  id: 'brand_iron',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, o = {};
      I.give('brand_iron'); const s = p.stats; o.s = [s.burn, s.burnVuln, s.burnSpread];
      I.prep(); const e = I.dummy(300, 0);
      let h = e.hp; e.takeHit(10, {}); o.plain = h - e.hp;
      e.applyStatus('burn', { dps: 3, t: 5 }); h = e.hp; e.takeHit(10, {}); o.burning = h - e.hp;
      I.prep(); const v = I.dummy(300, 0, { hp: 5 }), near = I.dummy(400, 0), far = I.dummy(300, 300);
      v.applyStatus('burn', { dps: 3, t: 5 }); v.takeHit(50, {}); I.sim(0.1);
      o.dead = !v.alive; o.near = !!near.status.burn; o.far = !!far.status.burn;
      return o;
    });
    ok('burn +0.08, burnVuln 0.3, burnSpread 150', Math.abs(r.s[0] - 0.08) < 1e-9 && r.s[1] === 0.3 && r.s[2] === 150, JSON.stringify(r.s));
    ok('a burning foe takes x1.3, a plain one x1', Math.abs(r.plain - 10) < 0.01 && Math.abs(r.burning - 13) < 0.01, `${r.plain} ${r.burning}`);
    ok('a burning death ignites a neighbour within 150 px', r.dead && r.near);
    ok('but not one 300 px away', !r.far);
  },
};
