// widows_bone: every 4th shot is a boomerang bone (3rd with a 2nd copy): full damage out and back, pierces, returns to the player.
import { install } from './_i1.mjs';
export default {
  id: 'widows_bone',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const { bus } = await import('/src/core/events.js');
      I.give('widows_bone'); o.every = p.stats.boomerangEvery;
      I.prep(); const e = I.dummy(130, 0);
      let booms = 0, bone = null; const f = (ev) => { if (ev.bullet.m && ev.bullet.m.boom) { booms++; bone = ev.bullet; } }; bus.on('bullet:fired', f);
      for (let i = 0; i < 3; i++) I.shoot(0, -1); // three normal shots at the wall
      o.boomsAfter3 = booms;
      I.shoot(1, 0); o.boomsAfter4 = booms;
      let far = 0, back = false;
      I.sim(12.0, () => { if (bone && bone.active) far = Math.max(far, Math.hypot(bone.x - p.x, bone.y - p.y)); if (bone && !bone.active) { back = true; return true; } return false; });
      bus.off('bullet:fired', f);
      o.far = far; o.back = back; o.loss = I.lost(e); o.pierce = bone ? bone.pierce : 0;
      I.give('widows_bone'); o.every2 = p.stats.boomerangEvery;
      // sixth priority: the 4th shot of a full cylinder counter is a Sixth, not a bone
      return o;
    });
    ok('boomerangEvery 4, 3 with a second copy', r.every === 4 && r.every2 === 3, `${r.every} ${r.every2}`);
    ok('shots 1-3 are normal, the 4th is a boomerang', r.boomsAfter3 === 0 && r.boomsAfter4 === 1);
    ok('the bone flies out and comes back to the player', r.far > 100 && r.back, `far ${Math.round(r.far)} back ${r.back}`);
    ok('the target is hit twice (out and back), full damage', Math.abs(r.loss - 7) < 0.3, `${r.loss}`);
    ok('infinite pierce', r.pierce >= 999);
  },
};
