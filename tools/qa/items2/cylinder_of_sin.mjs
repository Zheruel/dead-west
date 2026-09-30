// cylinder_of_sin: pay 2 keys -> every 3rd shot is a Sixth Bullet (x3 total, +1 pierce); every other shot does 60%.
import { install } from './_i3.mjs';
export default {
  id: 'cylinder_of_sin',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__i3, p = window.__dw.player, o = {};
      const { bus } = await import('/src/core/events.js');
      I.prep(); p.keys = 3;
      const base = { dmg: p.stats.damage, every: p.stats.sixthEvery, pierce: p.stats.sixthPierce, sm: p.stats.sixthMult };
      const d = await I.deal('cylinder_of_sin'); o.can = d.can; o.paid = d.paid; o.keys = p.keys;
      o.s = { every: p.stats.sixthEvery, ndm: p.stats.normalDamageMult, sm: p.stats.sixthMult, sp: p.stats.sixthPierce };
      o.base = base; o.slots = p.cylinder.max;
      const seq = [], dm = []; const f = (e) => seq.push(!!e.sixth), g = (e) => dm.push(e.bullet.dmg * e.bullet.mult);
      bus.on('player:fired', f); bus.on('bullet:fired', g);
      p.cyl.pos = 0; for (let i = 0; i < 6; i++) I.shoot(0, -1);
      bus.off('player:fired', f); bus.off('bullet:fired', g);
      o.seq = seq; o.dm = dm;
      // short_cylinder + sin: still 3
      I.give('short_cylinder'); o.withShort = p.stats.sixthEvery;
      // unaffordable
      p.keys = 1; p.removeItem('cylinder_of_sin'); const d2 = await I.deal('cylinder_of_sin'); o.denied = d2.can; o.keysAfter = p.keys; o.owned = p.hasItem('cylinder_of_sin');
      return o;
    });
    ok('paid 2 keys', r.can === true && r.keys === 1 && r.paid.keys === 2, `${r.keys}`);
    ok('sixthEvery 3 (HUD 3 slots), sixthMult +1, sixthPierce +1, normalDamageMult 0.6', r.s.every === 3 && r.slots === 3 && r.s.sm === r.base.sm + 1 && r.s.sp === r.base.pierce + 1 && Math.abs(r.s.ndm - 0.6) < 1e-9, JSON.stringify(r.s));
    ok('shots 3 and 6 are Sixth Bullets', JSON.stringify(r.seq) === '[false,false,true,false,false,true]', JSON.stringify(r.seq));
    ok('normal shots do 60%, Sixth shots x3', Math.abs(r.dm[0] - r.base.dmg * 0.6) < 0.01 && Math.abs(r.dm[2] - r.base.dmg * 3) < 0.01, JSON.stringify(r.dm));
    ok('stays at 3 next to short_cylinder', r.withShort === 3);
    ok('unaffordable (1 key): denied, no state change', r.denied === 'NEED KEYS' && r.keysAfter === 1 && !r.owned, `${r.denied} ${r.keysAfter}`);
  },
};
