// brimstone_bandolier: pay 1 container -> dynamite regrows (1 / 6 s, cap 3), x2 damage, +60 radius; blasts hurt you (+1 unit), even with the vest.
import { install } from './_i3.mjs';
export default {
  id: 'brimstone_bandolier',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__i3, p = window.__dw.player, sc = window.__dw.scene, o = {};
      I.prep();
      const b = { dmg: p.stats.dynamiteDamage, rad: p.stats.dynamiteRadius, mh: p.stats.maxHearts };
      I.give('dynamite_vest'); o.vestImmune = p.stats.explosionImmune;
      const d = await I.deal('brimstone_bandolier'); o.can = d.can;
      o.mh = [b.mh, p.stats.maxHearts];
      o.s = { dmg: p.stats.dynamiteDamage / b.dmg, rad: p.stats.dynamiteRadius - b.rad, regen: p.stats.dynamiteRegen, cap: p.stats.dynamiteRegenCap, vuln: p.stats.explosionVuln, immune: p.stats.explosionImmune };
      // regrowth
      p.dynamite = 0; p._dynT = 0; I.prep(); p.dynamite = 0;
      const seq = []; for (let i = 0; i < 4; i++) { I.sim(6.1); seq.push(p.dynamite); }
      o.regrow = seq;
      // own blast hurts: a placed stick under the player: 2 units + 1 (vuln) even with the vest
      I.prep(); p.extraHearts = 3; p.recomputeStats(); p.hp = 10; p.godMode = false; p.dynamite = 1; p.stats.dynamiteFuse = 0.5;
      p.placeDynamite(); I.ff(240, () => sc.dynamites.length === 0); I.sim(0.1);
      o.blastCost = 10 - p.hp;
      // enemy in the blast takes x2
      I.prep(); p.godMode = true; const e = I.dummy(100, 0, { hp: 1000 }); p.dynamite = 1; p.placeDynamite(); I.ff(240, () => sc.dynamites.length === 0); I.sim(0.1); o.enemy = I.lost(e);
      // unaffordable at 1 container
      p.removeItem('brimstone_bandolier'); p.heartDebt += p.stats.maxHearts - 1; p.recomputeStats();
      const d2 = await I.deal('brimstone_bandolier'); o.denied = d2.can;
      return o;
    });
    ok('paid 1 heart container', r.can === true && r.mh[1] === r.mh[0] - 1, JSON.stringify(r.mh));
    ok('dynamiteDamage x2, radius +60, regen 6 s, cap 3, explosionVuln 1 (vest immunity cancelled)', r.vestImmune === 1 && r.s.dmg === 2 && r.s.rad === 60 && r.s.regen === 6 && r.s.cap === 3 && r.s.vuln === 1 && r.s.immune === 0, JSON.stringify(r.s));
    ok('dynamite regrows 1 per 6 s up to 3', JSON.stringify(r.regrow) === '[1,2,3,3]', JSON.stringify(r.regrow));
    ok('your own blast costs 3 units (2 + 1) despite the vest', r.blastCost === 3, `${r.blastCost}`);
    ok('an enemy in the blast takes double dynamite damage (120)', r.enemy >= 120, `${r.enemy}`);
    ok('refused at 1 container', r.denied === 'NEED MORE HEARTS');
  },
};
