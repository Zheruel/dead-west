// short_cylinder: sixthEvery 5 (min 3): the 5th shot is a Sixth Bullet and the HUD cylinder shows 5 chambers.
import { install } from './_i2.mjs';

export default {
  id: 'short_cylinder',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      o.e0 = p.stats.sixthEvery; I.give('short_cylinder'); o.e1 = p.stats.sixthEvery;
      I.prep(); I.dummy(300, 0); p.cyl.pos = 0; o.flags = [];
      for (let i = 0; i < 10; i++) { I.shoot(1, 0); const bl = sc.bullets.player.list.filter((b) => b.active); o.flags.push(bl.some((b) => b.sixth) ? 1 : 0); sc.bullets.player.clear(); }
      o.max = p.cylinder.max; o.loaded = p.cylinder.loaded;
      I.give('short_cylinder'); I.give('short_cylinder'); I.give('short_cylinder'); o.min = p.stats.sixthEvery;
      return o;
    });
    ok('sixthEvery 6 -> 5', r.e0 === 6 && r.e1 === 5, `${r.e0} ${r.e1}`);
    ok('every 5th shot is a Sixth Bullet', JSON.stringify(r.flags) === '[0,0,0,0,1,0,0,0,0,1]', JSON.stringify(r.flags));
    ok('the cylinder model has 5 chambers', r.max === 5, `${r.max}`);
    ok('never below 3', r.min === 3, `${r.min}`);
  },
};
