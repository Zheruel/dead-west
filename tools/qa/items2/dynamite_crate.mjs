// dynamite_crate: a ring of 5 lit sticks around you (no inventory use), all blast ~1.0 s later with the normal dynamite stats, you are immune.
import { install } from './_i3.mjs';
export default {
  id: 'dynamite_crate',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(() => {
      const I = window.__i3, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      I.give('dynamite_crate'); I.prep(); o.max = p.active.max;
      p.godMode = false; p.hp = 10; p.dynamite = 2;
      const near = I.dummy(110, 0, { hp: 500 }), far = I.dummy(0, 330, { hp: 500 });
      o.hp0 = p.hp; o.ret = I.use();
      o.sticks = sc.dynamites.length; o.dynAfter = p.dynamite;
      o.ring = sc.dynamites.map((d) => Math.round(Math.hypot(d.x - 500, d.y - 528)));
      o.fuse = sc.dynamites[0] && sc.dynamites[0].o.fuse; o.dmgOpt = sc.dynamites[0] && sc.dynamites[0].o.playerDamage;
      const frames = I.ff(180, () => sc.dynamites.length === 0); o.secs = +(frames / 60).toFixed(2);
      I.sim(0.3);
      o.hp = p.hp; o.near = I.lost(near); o.far = I.lost(far); o.left = sc.dynamites.length;
      // lit_cigar style stats feed the blasts: radius / damage come from the player stats
      p.stats.dynamiteDamage = 120; near.hp = near.maxHp = 500; I.use();
      I.ff(200, () => sc.dynamites.length === 0); I.sim(0.3);
      o.near2 = I.lost(near);
      return o;
    });
    ok('active, 4 charges', r.max === 4);
    ok('5 sticks in a ring of radius ~110, inventory untouched', r.ret === true && r.sticks === 5 && r.dynAfter === 2, `${r.sticks} ${r.dynAfter} ${JSON.stringify(r.ring)}`);
    ok('fuse 1.0 s in total (0.2 s toss + 0.8 fuse), playerDamage 0', r.fuse === 0.8 && r.dmgOpt === 0 && r.secs >= 0.9 && r.secs <= 1.2, `fuse ${r.fuse} t ${r.secs}`);
    ok('the player is immune to the ring (hp unchanged)', r.hp === r.hp0, `${r.hp} vs ${r.hp0}`);
    ok('an enemy inside the ring takes the blasts, one 330 px away does not', r.near >= 60 && r.far === 0, `${r.near} ${r.far}`);
    ok('blast damage follows the dynamite stats', r.near2 > r.near, `${r.near2} > ${r.near}`);
    ok('all sticks are gone afterwards', r.left === 0);
  },
};
