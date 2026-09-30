// Steam pipes `T` (F5): a pipe on an outer-edge tile jets along its row / column inward, 5 tiles long, 88 px wide. 4.4 s cycle: idle 2.0 s ->
// warn 0.9 s (white puffs, hiss) -> jet 1.5 s. No damage: everything inside is pushed along the jet (player 300 px/s via player.env.push, rolls ignore it;
// ground enemies 200 px/s). Jets stay on in cleared rooms.
import { TILE, COLS, ROWS, DEPTH, actorDepth } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { envOf, warnDepth, hasCell } from './common.js';
import { TEX } from './tiles.js';

export const STEAM = { cycle: 4.4, idle: 2.0, warn: 0.9, jet: 1.5, len: 5 * TILE, width: 88, playerPush: 300, enemyPush: 200 };

class Jet {
  constructor(field, t) {
    const s = field.scene;
    this.c = t.c; this.r = t.r; this.x = t.x; this.y = t.y;
    // direction inward from the outer edge (left/right walls take priority at corners)
    let dx = 0, dy = 0;
    if (t.c === 0) dx = 1; else if (t.c === COLS - 1) dx = -1; else if (t.r === 0) dy = 1; else if (t.r === ROWS - 1) dy = -1; else dx = t.c < COLS / 2 ? 1 : -1;
    this.dx = dx; this.dy = dy;
    // jet rectangle (world): starts at the pipe tile's inner edge
    const sx = t.x + dx * TILE / 2, sy = t.y + dy * TILE / 2;
    const ex = sx + dx * STEAM.len, ey = sy + dy * STEAM.len;
    this.x0 = Math.min(sx, ex) - (dx ? 0 : STEAM.width / 2); this.x1 = Math.max(sx, ex) + (dx ? 0 : STEAM.width / 2);
    this.y0 = Math.min(sy, ey) - (dy ? 0 : STEAM.width / 2); this.y1 = Math.max(sy, ey) + (dy ? 0 : STEAM.width / 2);
    this.sx = sx; this.sy = sy;
    this.off = ((t.c + t.r * 3) % 4) * 1.1;
    this.state = 0;
    this.puffT = 0;
    const real = hasCell('haz_f5', 'steam_pipe');
    this.pipe = real ? Assets.makeCell(s, t.x, t.y + TILE / 2, 'haz_f5', 'steam_pipe', 1) : s.add.image(t.x, t.y, TEX.pipe(s));
    this.pipe.setRotation(dx === 1 ? 0 : dx === -1 ? Math.PI : dy === 1 ? Math.PI / 2 : -Math.PI / 2);
    if (real) this.pipe.setOrigin(0.5, 0.5).setPosition(t.x, t.y);
    this.pipe.setDepth(actorDepth(t.y + TILE / 2 - 1));
    // one Graphics-free visual: a stretched soft band while jetting
    this.band = s.add.image(sx, sy, 'px').setOrigin(dx ? (dx > 0 ? 0 : 1) : 0.5, dy ? (dy > 0 ? 0 : 1) : 0.5).setTint(0xdde4e8).setVisible(false);
    this.band.__noSnap = true;
    this.band.setDisplaySize(dx ? STEAM.len : STEAM.width, dy ? STEAM.len : STEAM.width);
  }

  destroy() { this.pipe.destroy(); this.band.destroy(); }
}

export class SteamField {
  constructor(hz, tiles) {
    this.hz = hz;
    this.room = hz.room;
    this.scene = hz.scene;
    this.jets = tiles.map((t) => new Jet(this, t));
  }

  update(dt) {
    const s = this.scene, p = s.player, clock = this.hz.clock;
    const env = p ? envOf(s) : null;
    const dark = this.room.darkMask;
    for (const j of this.jets) {
      const ph = (clock + j.off) % STEAM.cycle;
      const st = ph < STEAM.idle ? 0 : ph < STEAM.idle + STEAM.warn ? 1 : 2;
      if (st !== j.state) {
        j.state = st;
        if (st === 1) Sfx.play('steam_hiss', { vol: 0.8 });
        else if (st === 2) { Sfx.play('steam_blast', { vol: 0.6 }); j.band.setVisible(true).setDepth(dark ? warnDepth(this.room) : DEPTH.fx - 20); }
        else j.band.setVisible(false);
      }
      if (st === 1) this._puffs(j, dt, 0.12 + 0.4 * ((ph - STEAM.idle) / STEAM.warn), 60);
      else if (st === 2) {
        const k = (ph - STEAM.idle - STEAM.warn) / STEAM.jet;
        const fade = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
        j.band.setAlpha(0.16 * fade * (0.85 + 0.15 * Math.sin(clock * 35)));
        this._puffs(j, dt, 1, 240);
        this._push(j, dt, env, p, fade);
      }
    }
  }

  _puffs(j, dt, rate, reach) {
    j.puffT -= dt;
    if (j.puffT > 0) return;
    j.puffT = 0.08 / rate;
    const along = Math.random() * Math.min(reach * 2, STEAM.len), lat = (Math.random() - 0.5) * (STEAM.width - 30);
    const x = j.sx + j.dx * along - j.dy * lat, y = j.sy + j.dy * along + j.dx * lat;
    this.scene.fx.burst(x, y, { color: [0xdde4e8, 0xffffff], tex: 'glow', count: 1, speed: [30, 70], life: [450, 750], scale: [0.25, 0.85], alpha: [0.5, 0], dir: Math.atan2(j.dy, j.dx), spread: 12, depth: this.room.darkMask ? warnDepth(this.room) + 1 : DEPTH.fx - 15 });
  }

  _push(j, dt, env, p, fade) {
    if (env && p && !p.dead && !p.rolling && p.x > j.x0 && p.x < j.x1 && p.y > j.y0 && p.y < j.y1) {
      env.push.x += j.dx * STEAM.playerPush; env.push.y += j.dy * STEAM.playerPush;
    }
    const list = this.scene.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e.flying || e.isBoss || e.x <= j.x0 || e.x >= j.x1 || e.y <= j.y0 || e.y >= j.y1) continue;
      e.moveBy(j.dx * STEAM.enemyPush * dt, j.dy * STEAM.enemyPush * dt);
    }
  }

  destroy() { for (const j of this.jets) j.destroy(); this.jets.length = 0; }
}

export default SteamField;
