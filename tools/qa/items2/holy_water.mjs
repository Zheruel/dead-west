// holy_water: smiteChance 0.10; a smite hits everything within 80 px for damage x2 (undead x2 more), 0.4 s cooldown.
import { install } from './_i1.mjs';
export default {
  id: 'holy_water',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, o = {};
      I.give('holy_water'); const s = p.stats; o.s = [s.smiteChance, s.smiteRadius, s.smiteMult];
      I.prep(); s.smiteChance = 1;
      const a = I.dummy(140, 0), ghost = I.dummy(140, 60, { id: 'skeleton' }), far = I.dummy(140, 250);
      p._smiteAt = 0; I.shoot(1, 0); I.sim(0.2);
      o.a1 = I.lost(a); o.g1 = I.lost(ghost); o.far = I.lost(far);
      I.shoot(1, 0); I.sim(0.2); o.a2 = I.lost(a) - o.a1; // lands ~0.1 s after the first smite: inside the 0.4 s cooldown, bullet only
      I.sim(0.5); I.shoot(1, 0); I.sim(0.2); o.a3 = I.lost(a) - o.a1 - o.a2; // cooldown over: smite again
      p.restore({ items: ['holy_water', 'silver_bullets'], hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 });
      o.silver = [p.synergies.has('sanctified_silver'), Math.round(p.stats.smiteChance * 100) / 100];
      return o;
    });
    ok('smiteChance 0.1, radius 80, x2', r.s[0] === 0.1 && r.s[1] === 80 && r.s[2] === 2, JSON.stringify(r.s));
    ok('the target takes bullet 3.5 + smite 7', Math.abs(r.a1 - 10.5) < 0.1, `${r.a1}`);
    ok('an undead neighbour takes x2 more (14)', Math.abs(r.g1 - 14) < 0.1, `${r.g1}`);
    ok('nothing outside the radius is smitten', r.far === 0);
    ok('cooldown 0.4 s: the second shot is bullet-only, the third smites', Math.abs(r.a2 - 3.5) < 0.1 && Math.abs(r.a3 - 10.5) < 0.1, `${r.a2} ${r.a3}`);
    ok('with Silver Bullets: Sanctified Silver (smite 20%)', r.silver[0] && r.silver[1] === 0.2, JSON.stringify(r.silver));
  },
};
