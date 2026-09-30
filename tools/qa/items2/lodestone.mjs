// lodestone: pullRadius 140 / pullSpeed 110; a passing bullet drags foes toward it (Sixth x2); bosses are immune.
import { install } from './_i1.mjs';
export default {
  id: 'lodestone',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, o = {};
      I.give('lodestone'); const s = p.stats; o.s = [s.pullRadius, s.pullSpeed];
      const trial = (sixth, boss) => {
        I.prep(); const e = I.dummy(300, 100); e.isBoss = !!boss; const y0 = e.y;
        p.forceSixth = sixth ? 1 : 0; I.shoot(1, 0);
        const b = dw.scene.bullets.player.list.find((x) => x.active); o.tint = b && b.sprite.tintTopLeft;
        I.sim(0.9);
        const moved = y0 - e.y; e.isBoss = false; return moved;
      };
      o.plain = trial(false, false); o.sixth = trial(true, false); o.boss = trial(false, true);
      return o;
    });
    ok('pullRadius 140, pullSpeed 110', r.s[0] === 140 && r.s[1] === 110, JSON.stringify(r.s));
    ok('a foe 100 px off the path is dragged toward it', r.plain > 12, `${r.plain.toFixed(1)} px`);
    ok('the Sixth Bullet pulls about twice as hard', r.sixth > r.plain * 1.5, `${r.sixth.toFixed(1)} vs ${r.plain.toFixed(1)}`);
    ok('bosses are immune', Math.abs(r.boss) < 0.5, `${r.boss}`);
    ok('lodestone slugs are tinted cold iron', r.tint === 0xc8c8dc, `0x${(r.tint || 0).toString(16)}`);
  },
};
