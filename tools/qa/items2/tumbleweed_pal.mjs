// tumbleweed_pal: a familiar that rolls and bounces, hurts a stationary foe (5 per touch, 0.4 s per foe) and cracks a breakable tile on a bounce.
import { install } from './_i2.mjs';

export default {
  id: 'tumbleweed_pal',
  async run({ ev, ok }) {
    await install(ev);
    const r = await ev(async () => {
      const I = window.__fei2, I2 = window.__fei2, dw = window.__dw, p = dw.player, sc = dw.scene, o = {};
      const n0 = p.familiars.length; I.give('tumbleweed_pal'); o.added = p.familiars.length - n0;
      const pal = I2.fam('TumbleweedPal')[0];
      // 1. it moves and bounces around the empty room (never leaves it)
      I.prep(); I.sim(0.5); const x0 = pal.x, y0 = pal.y; let travelled = 0, out = false, px = pal.x, py = pal.y;
      for (let i = 0; i < 300; i++) { I.ff(1); travelled += Math.hypot(pal.x - px, pal.y - py); px = pal.x; py = pal.y; if (pal.x < 96 || pal.x > 1344 || pal.y < 192 || pal.y > 864) out = true; }
      o.travelled = travelled; o.out = out;
      // 2. damages a stationary foe on its path
      I.prep(); pal.x = 500; pal.y = 600; pal.dx = 1; pal.dy = 0; const e = I.dummy(300, 72);
      I.sim(3); o.lost = I.lost(e);
      // 3. breaks a breakable tile on a bounce
      I.prep(); const room = sc.room, row = 3; let col = -1;
      for (let c = 9; c >= 6; c--) { let clear = true; for (let k = 2; k <= c; k++) if (room.tiles[row][k].solid) clear = false; if (clear) { col = c; break; } }
      o.col = col;
      if (col >= 0) {
        const t = room.tiles[row][col]; t.type = 'breakable'; t.solid = true; t.hp = 1; t.broken = false; t.barrel = false; t.sprite = null;
        pal.x = t.x - 300; pal.y = t.y; pal.dx = 1; pal.dy = 0; p.x = t.x - 100; p.y = 760;
        I.sim(4, () => t.broken); o.broken = t.broken;
        t.type = null; t.solid = false;
      }
      p.restore({ items: [], active: null, hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 });
      return o;
    });
    ok('+1 familiar (a TumbleweedPal)', r.added === 1);
    ok('it rolls around and stays inside the room', r.travelled > 600 && !r.out, `${r.travelled} ${r.out}`);
    ok('it hurts a stationary enemy in its way', r.lost >= 4.9, `${r.lost}`);
    ok('it breaks a breakable tile on a bounce', r.col >= 0 && r.broken, `col ${r.col} ${r.broken}`);
  },
};
