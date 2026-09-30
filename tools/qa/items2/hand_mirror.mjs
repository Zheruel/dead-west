// hand_mirror: rollReflect 70 (+30 per extra copy); an enemy bullet meeting a rolling player becomes a spectral player bullet aimed at the nearest foe.
import { install } from './_i1.mjs';
export default {
  id: 'hand_mirror',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const { bus } = await import('/src/core/events.js');
      I.give('hand_mirror'); o.r1 = p.stats.rollReflect; I.give('hand_mirror'); o.r2 = p.stats.rollReflect;
      p.restore({ items: ['hand_mirror'], hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 });
      const trial = (rolling) => {
        I.prep({ god: true }); const e = I.dummy(400, 0);
        sc.bullets.enemy.fire({ x: p.x + 60, y: p.y + 20, angle: Math.PI, speed: 1, damage: 1, kind: 'enemy', life: 6 });
        let refl = 0; const f = (ev) => { if (ev.bullet.m && ev.bullet.m.reflected) refl++; }; bus.on('bullet:fired', f);
        if (rolling) p.startRoll({ x: 0, y: -1 }, { x: 0, y: -1 }); // roll up: the bullet stays within reach of the roll
        I.sim(0.6); bus.off('bullet:fired', f);
        return { refl, loss: I.lost(e), enemy: sc.bullets.enemy.list.filter((b) => b.active).length };
      };
      o.roll = trial(true);
      p.rolling = false;
      o.still = trial(false);
      return o;
    });
    ok('rollReflect 70, +30 per extra copy', r.r1 === 70 && r.r2 === 100, `${r.r1} ${r.r2}`);
    ok('a bullet meeting the roll is reflected (1 player bullet, enemy bullet gone)', r.roll.refl === 1 && r.roll.enemy === 0, JSON.stringify(r.roll));
    ok('the reflected bullet flies at the nearest foe for your damage (3.5)', Math.abs(r.roll.loss - 3.5) < 0.05, `${r.roll.loss}`);
    ok('control: no roll, no reflection', r.still.refl === 0, JSON.stringify(r.still));
  },
};
