// Quicksand `Q` (F1, tar on F4): walkable. The player on a Q tile moves at x0.5 and rolls x0.6 as far (player.env), and a sink meter fills in 1.6 s
// (drains at 2/s off the tile). At 1.0: 1 damage (`quicksand`) and the player is pushed out to the nearest safe walkable tile with a dust burst.
// Walkers on Q move at x0.6; flyers, ghosts and bullets ignore it. Q stays active in cleared rooms.
import { TILE, COLS, ROWS, DEPTH } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { envOf, hurtPlayer, slowEnemy, colOf, rowOf, inGrid, tileX, tileY, hasCell } from './common.js';
import { TEX } from './tiles.js';

export const SAND = { fill: 1.6, drain: 2, playerSpeed: 0.5, playerRoll: 0.6, walkerSpeed: 0.6 };

export class QuicksandField {
  constructor(hz, tiles) {
    this.hz = hz;
    this.room = hz.room;
    this.scene = hz.scene;
    this.mask = new Uint8Array(COLS * ROWS);
    this.imgs = [];
    const s = this.scene, real = hasCell('obst_hazards', 'quicksand');
    for (const t of tiles) {
      this.mask[t.r * COLS + t.c] = 1;
      const im = real ? Assets.makeCell(s, t.x, t.y, 'obst_hazards', 'quicksand', 0.5) : s.add.image(t.x, t.y, TEX.quicksand(s));
      im.setDepth(DEPTH.decals + 1).setDisplaySize(TILE + 4, TILE + 4); // slight overlap so neighbours merge
      this.imgs.push(im);
    }
    this.tiles = tiles;
    this.meter = 0;
    this.bar = s.add.graphics().setDepth(DEPTH.bullets - 8);
    this.bar.__noSnap = true;
    this.bubT = 0;
    this.barOn = false;
  }

  has(c, r) { return inGrid(c, r) && this.mask[r * COLS + c] === 1; }
  at(x, y) { return this.has(colOf(x), rowOf(y)); }

  update(dt) {
    const s = this.scene, p = s.player;
    if (p && !p.dead) {
      const on = this.at(p.x, p.y);
      if (on) {
        const env = envOf(s);
        if (env.speedMult > SAND.playerSpeed) env.speedMult = SAND.playerSpeed;
        if (env.rollMult > SAND.playerRoll) env.rollMult = SAND.playerRoll;
        this.meter = Math.min(1, this.meter + dt / SAND.fill);
        this.bubT -= dt;
        if (this.bubT <= 0) { this.bubT = 0.35; Sfx.play('quicksand_bubble', { vol: 0.6 }); s.fx.burst(p.x + (Math.random() - 0.5) * 30, p.y + 22, { color: [0xd9b071, 0xb8955a], count: 3, speed: [20, 70], life: [250, 450], scale: [1, 2], gravity: 100, angle: [230, 310] }); }
        if (this.meter >= 1) this._swallow(p);
      } else if (this.meter > 0) this.meter = Math.max(0, this.meter - SAND.drain * dt);
      this._bar(p);
    }
    const list = s.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.alive && !e.flying && !e.ghost && !e.isBoss && this.at(e.x, e.y)) slowEnemy(e, SAND.walkerSpeed);
    }
  }

  _bar(p) {
    const g = this.bar;
    if (this.meter <= 0.001) { if (this.barOn) { g.clear(); this.barOn = false; } return; }
    this.barOn = true;
    const w = 46, x = p.x - w / 2, y = p.footY + 6;
    g.clear().fillStyle(0x120c0a, 0.75).fillRect(x - 2, y - 2, w + 4, 10);
    g.fillStyle(this.meter > 0.75 ? 0xd63a2a : 0xd9b071, 1).fillRect(x, y, w * this.meter, 6);
  }

  /** Meter full: 1 damage and out to the nearest walkable non-Q tile. */
  _swallow(p) {
    const s = this.scene;
    hurtPlayer(s, 1, p.x, p.y, 'quicksand', { noKnock: true });
    p.knock.x = p.knock.y = 0;
    let best = null, bd = Infinity;
    const tiles = this.room.tiles;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = tiles[r] && tiles[r][c];
      if (!t || t.solid || this.mask[r * COLS + c] || this.hz.unsafe(c, r)) continue;
      const d = (tileX(c) - p.x) ** 2 + (tileY(r) - p.y) ** 2;
      if (d < bd) { bd = d; best = { x: tileX(c), y: tileY(r) }; }
    }
    s.fx.burst(p.x, p.y + 10, { color: [0xd9b071, 0xb8955a, 0xe8d2a0], count: 16, speed: [60, 240], life: [250, 550], gravity: 300 });
    s.fx.dust(p.x, p.y + 14, 1);
    if (best) { const dx = best.x - p.x, dy = best.y - p.y, d = Math.hypot(dx, dy) || 1; const k = Math.min(1, (d - 6) / d); if (p.teleport) p.teleport(p.x + dx * k, p.y + dy * k); else { p.x += dx * k; p.y += dy * k; } }
    this.meter = 0;
  }

  destroy() {
    for (const im of this.imgs) im.destroy();
    this.imgs.length = 0;
    this.bar.destroy();
  }
}

export default QuicksandField;
