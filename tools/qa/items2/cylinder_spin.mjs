// cylinder_spin: the next 3 shots are Sixth Bullets (queued ahead of the normal cylinder), the 4th is normal; the queue expires after 10 s.
import { install } from './_i3.mjs';
export default {
  id: 'cylinder_spin',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__i3, p = window.__dw.player, o = {};
      const { bus } = await import('/src/core/events.js');
      I.give('cylinder_spin'); I.prep(); o.max = p.active.max;
      p.cyl.pos = 2;
      const seq = []; const f = (e) => seq.push(!!e.sixth); bus.on('player:fired', f);
      o.ret = I.use(); o.forced = p.forceSixth; o.loaded = p.cylinder.loaded;
      for (let i = 0; i < 4; i++) { I.shoot(0, -1); }
      bus.off('player:fired', f);
      o.seq = seq; o.posAfter = p.cyl.pos; o.forcedAfter = p.forceSixth;
      // expiry
      I.use(); o.f2 = p.forceSixth; I.sim(10.5); o.f3 = p.forceSixth;
      // modifiers apply: with widows / hellfire style stats a forced Sixth reads sixthMult
      p.forceSixth = 0; p.cyl.pos = 0;
      const dmg = []; const g = (e) => { if (e.bullet) dmg.push(e.bullet.dmg * e.bullet.mult); }; bus.on('bullet:fired', g);
      I.use(); I.shoot(0, -1); I.shoot(0, -1); I.shoot(0, -1); I.shoot(0, -1);
      bus.off('bullet:fired', g); o.dmg = dmg;
      return o;
    });
    ok('active, 4 charges', r.max === 4);
    ok('use -> forceSixth 3, HUD cylinder loaded', r.ret === true && r.forced === 3 && r.loaded === 1, `${r.forced} ${r.loaded}`);
    ok('shots 1-3 are Sixth Bullets, the 4th is not', JSON.stringify(r.seq) === '[true,true,true,false]', JSON.stringify(r.seq));
    ok('forced shots leave the natural cylinder cycle untouched (pos 2 -> 3 after the 4th)', r.posAfter === 3 && r.forcedAfter === 0, `${r.posAfter}`);
    ok('the queue expires after 10 s', r.f2 === 3 && r.f3 === 0, `${r.f2} ${r.f3}`);
    ok('forced Sixths use the Sixth damage multiplier', r.dmg.length === 4 && r.dmg[0] > r.dmg[3] * 1.5, JSON.stringify(r.dmg));
  },
};
