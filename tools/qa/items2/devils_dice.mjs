// devils_dice: pay 3 keys -> +4 luck, lucky shots hit for critMult +0.5, critCap +0.20, Hunted.
import { install } from './_i3.mjs';
export default {
  id: 'devils_dice',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__i3, p = window.__dw.player, o = {};
      const { bus } = await import('/src/core/events.js');
      I.prep(); p.keys = 4;
      const b = { luck: p.stats.luck, cm: p.stats.critMult, cc: p.stats.critCap, dmg: p.stats.damage };
      const d = await I.deal('devils_dice'); o.can = d.can; o.keys = p.keys;
      o.s = { luck: p.stats.luck - b.luck, cm: +(p.stats.critMult - b.cm).toFixed(3), cc: +(p.stats.critCap - b.cc).toFixed(3), hunted: p.stats.curseHunted };
      // lucky shots: with luck 4 the chance is min(critCap, luck * 0.03) = 12%: count crits over 400 shots
      o.chance = Math.min(p.stats.critCap, p.stats.luck * 0.03);
      let crit = 0, big = 0; const g = (e) => { const v = e.bullet.dmg * e.bullet.mult; if (v > b.dmg * 1.2) { crit++; if (Math.abs(v - b.dmg * p.stats.critMult) < 0.05) big++; } }; bus.on('bullet:fired', g);
      for (let i = 0; i < 400; i++) { p.cyl.pos = 0; window.__dw.scene.bullets.player.clear(); I.shoot(0, -1); }
      bus.off('bullet:fired', g); o.crit = crit / 400; o.big = big === crit; o.critMult = p.stats.critMult;
      p.removeItem('devils_dice'); p.keys = 2; const d2 = await I.deal('devils_dice'); o.denied = d2.can; o.keys2 = p.keys;
      return o;
    });
    ok('paid 3 keys', r.can === true && r.keys === 1);
    ok('luck +4, critMult +0.5, critCap +0.20, Hunted 1', r.s.luck === 4 && r.s.cm === 0.5 && r.s.cc === 0.2 && r.s.hunted === 1, JSON.stringify(r.s));
    ok('lucky shots ~12% of shots at critMult (2.0 x)', r.crit > 0.07 && r.crit < 0.18 && r.big && r.critMult === 2, `${r.crit} ${r.critMult}`);
    ok('2 keys: denied, nothing paid', r.denied === 'NEED KEYS' && r.keys2 === 2);
  },
};
