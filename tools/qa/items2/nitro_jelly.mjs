// nitro_jelly: dynamiteRadius x1.2 and every player explosion leaves a fire pool (r = 0.5 x blast, 3 s, 6 dps to foes, never to the player).
import { install } from './_i2.mjs';

export default {
  id: 'nitro_jelly',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const { explode } = await import('/src/systems/Explosions.js');
      const r0 = p.stats.dynamiteRadius; I.give('nitro_jelly'); o.rad = p.stats.dynamiteRadius / r0; o.fp = p.stats.dynamiteFirePool;
      I.prep(); const e = I.dummy(300, 0); // 800,528
      const patches0 = (sc.room.fires || sc.room.firePatches || []).length;
      explode(sc, e.x, e.y, { radius: p.stats.dynamiteRadius, damage: 20, owner: 'player', playerDamage: 0 });
      I.sim(0.1); const h1 = e.hp; o.blast = I.lost(e);
      I.sim(2.5); o.burn = h1 - e.hp;
      // the player standing in the fire is unharmed
      I.prep(); p.godMode = false; p.hp = p.maxHp; const e2 = I.dummy(300, 0);
      explode(sc, 800, 528, { radius: 150, damage: 1, owner: 'player', playerDamage: 0 });
      p.x = 800; p.y = 528; const hp = p.hp; I.sim(2.5); o.playerLost = hp - p.hp;
      return o;
    });
    ok('blast radius x1.2, dynamiteFirePool 1', Math.abs(r.rad - 1.2) < 1e-6 && r.fp === 1, `${r.rad} ${r.fp}`);
    ok('the blast leaves ground that keeps burning a foe (~6 dps)', r.burn >= 8, `blast ${r.blast} burn ${r.burn}`);
    ok('the fire never hurts the player', r.playerLost === 0, `${r.playerLost}`);
  },
};
