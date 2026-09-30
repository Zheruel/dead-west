// blast_caps: explodeChance 0.12, radius 90, 60% damage to neighbours, never hurts the player.
import { install } from './_i1.mjs';
export default {
  id: 'blast_caps',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, o = {};
      I.give('blast_caps'); const s = p.stats; o.s = [s.explodeChance, s.explodeRadius, s.explodeMult];
      I.prep(); p.godMode = false; p.hp = 10;
      const a = I.dummy(60, 0), n = I.dummy(130, 0), far = I.dummy(60, 300); // blast (r 90) covers the player, a and n; not far
      s.explodeChance = 1;
      p.hurtT = 0; p.entryInv = 0; I.shoot(1, 0);
      I.sim(8.0, () => I.lost(n) > 0); I.sim(0.4);
      o.a = I.lost(a); o.n = I.lost(n); o.far = I.lost(far); o.hp = p.hp;
      return o;
    });
    ok('explodeChance 0.12, radius 90, mult 0.6', r.s[0] === 0.12 && r.s[1] === 90 && r.s[2] === 0.6, JSON.stringify(r.s));
    ok('the neighbour inside the blast takes 60% (2.1)', Math.abs(r.n - 2.1) < 0.15, `${r.n}`);
    ok('the victim takes the hit but not the blast', Math.abs(r.a - 3.5) < 0.1, `${r.a}`);
    ok('nothing outside the radius is hurt', r.far === 0);
    ok('the player is never hurt by the blast', r.hp === 10, `hp ${r.hp}`);
  },
};
