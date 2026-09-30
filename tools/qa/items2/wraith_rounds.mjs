// wraith_rounds: ghostChance 0.25; a ghost shot ignores rocks, has +1 pierce and x1.15 damage.
import { install } from './_i1.mjs';
export default {
  id: 'wraith_rounds',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei1, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      I.give('wraith_rounds'); const s = p.stats; o.chance = s.ghostChance;
      I.prep();
      // a rock two tiles right of the player between us and the targets
      const c = Math.floor((p.x + 192 - 96) / 96), rr = Math.floor((p.y - 192) / 96), t = sc.room.tiles[rr][c], old = t.type, oldSolid = t.solid;
      t.type = 'block'; t.solid = true;
      const a = I.dummy(400, 0), b = I.dummy(470, 0);
      s.ghostChance = 1;
      let bl = null; const { bus } = await import('/src/core/events.js'); const f = (e) => { bl = e.bullet; }; bus.on('bullet:fired', f);
      I.shoot(1, 0); bus.off('bullet:fired', f);
      o.spectral = bl.spectral; o.pierce = bl.pierce;
      I.sim(8.0, () => I.lost(b) > 0); I.sim(0.2);
      o.a = I.lost(a); o.b = I.lost(b);
      t.type = old; t.solid = oldSolid;
      // control: with the chance back at 0 the same rock stops a plain bullet
      p.recomputeStats(); I.prep(); t.type = 'block'; t.solid = true; const c2 = I.dummy(400, 0); p.crng.chance = () => false; I.shoot(1, 0); I.sim(0.9); delete p.crng.chance; // ghostChance is back to 0.25: force the roll to miss
      o.ctl = I.lost(c2); t.type = old; t.solid = oldSolid;
      return o;
    });
    ok('ghostChance 0.25', r.chance === 0.25);
    ok('a ghost slug is spectral with +1 pierce', r.spectral === true && r.pierce >= 1, `pierce ${r.pierce}`);
    ok('it passes the rock and pierces both targets at x1.15', Math.abs(r.a - 4.025) < 0.1 && Math.abs(r.b - 4.025) < 0.1, `${r.a} ${r.b}`);
    ok('control: a plain bullet is stopped by the rock', r.ctl === 0, `${r.ctl}`);
  },
};
