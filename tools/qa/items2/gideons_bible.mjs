// gideons_bible: holy nova, 45 damage in 380 px (undead take undeadDamageMult), wipes enemy bullets there, heals 1 unit when it kills 3+.
import { install } from './_i3.mjs';
export default {
  id: 'gideons_bible',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(() => {
      const I = window.__i3, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      I.give('gideons_bible'); I.prep(); o.max = p.active.max;
      // three foes with plenty of hp, one outside the radius, an enemy bullet inside and one outside
      const a = I.dummy(150, 0, { hp: 500 }), b = I.dummy(0, 250, { hp: 500 }), c = I.dummy(300, -100, { hp: 500 }), far = I.dummy(430, 0, { hp: 500 });
      sc.bullets.enemy.fire({ x: p.x + 200, y: p.y + 60, angle: 0, speed: 1, damage: 1, life: 5 });
      sc.bullets.enemy.fire({ x: p.x + 700, y: p.y, angle: 0, speed: 1, damage: 1, life: 5 });
      const liveEnemyBullets = () => sc.bullets.enemy.list.filter((k) => k.active).length;
      o.blt0 = liveEnemyBullets();
      p.hp = 4; o.ret = I.use();
      I.sim(0.1);
      o.a = I.lost(a); o.b = I.lost(b); o.c = I.lost(c); o.far = I.lost(far); o.blt1 = liveEnemyBullets(); o.hpNoKill = p.hp;
      // three kills heal one unit
      I.prep(); p.hp = 4;
      const k1 = I.dummy(120, 0, { hp: 45 }), k2 = I.dummy(0, 120, { hp: 45 }), k3 = I.dummy(-100, 0, { hp: 45 });
      I.use(); I.sim(0.1);
      o.alive = [k1, k2, k3].filter((e) => e.alive).length; o.hpKill = p.hp;
      // two kills: no heal
      I.prep(); p.hp = 4;
      const j1 = I.dummy(120, 0, { hp: 45 }), j2 = I.dummy(0, 120, { hp: 45 }), j3 = I.dummy(-100, 0, { hp: 500 });
      I.use(); I.sim(0.1); o.hpTwo = p.hp;
      // undead take the silver multiplier
      I.prep(); p.stats.undeadDamageMult = 1.5;
      const u = I.dummy(150, 0, { id: 'skeleton', hp: 500 }); I.use(); I.sim(0.1); o.undead = I.lost(u);
      return o;
    });
    ok('active, 6 charges', r.max === 6);
    ok('45 damage to every foe within 380 px, none beyond', r.ret === true && r.a === 45 && r.b === 45 && r.c === 45 && r.far === 0, `${r.a} ${r.b} ${r.c} ${r.far}`);
    ok('enemy bullets in the radius are wiped, one outside stays', r.blt0 === 2 && r.blt1 === 1, `${r.blt0} -> ${r.blt1}`);
    ok('no heal without 3 kills', r.hpNoKill === 4 && r.hpTwo === 4, `${r.hpNoKill} ${r.hpTwo}`);
    ok('3 kills heal 1 unit', r.alive === 0 && r.hpKill === 5, `alive ${r.alive} hp ${r.hpKill}`);
    ok('undeadDamageMult applies (45 x 1.5)', Math.abs(r.undead - 67.5) < 0.6, `${r.undead}`);
  },
};
