// Roulette floor (F6): `r` red / `k` black tiles (code-drawn). With template `roulette:true`, combat only: every 6.0 s a colour is called (never the same
// colour 3 times in a row), "RED!" / "BLACK!" over the room, that colour's tiles flicker 1.0 s (amber -> white, roulette_tick), then zap 1.4 s: the
// player on a zapped tile takes 1 at zap start and every 0.7 s, walkers on it take 6 once. Tiles outside the region are always safe.
// Boss code can call a colour on demand: `Hazards.rouletteCall(room, 'r' | 'k')`.
import { DEPTH, FONT_BODY, ROOM, TILE } from '../../config.js';
import { Sfx } from '../../core/Audio.js';
import { hurtPlayer, groundFoe, circleHitsTile, warnDepth, lerp, clamp } from './common.js';
import { TEX } from './tiles.js';

export const ROULETTE = { period: 6.0, first: 3.0, tell: 1.0, zap: 1.4, zapEvery: 0.7, dmg: 1, enemyDmg: 6 };

const AMBER = [0xf0a640, 0xffffff];

export class RouletteField {
  constructor(hz, tiles) {
    this.hz = hz;
    this.room = hz.room;
    this.scene = hz.scene;
    this.tiles = tiles.map((t) => ({ c: t.c, r: t.r, x: t.x, y: t.y, col: t.ch === 'r' ? 'r' : 'k', img: null }));
    const s = this.scene;
    for (const t of this.tiles) t.img = s.add.image(t.x, t.y, TEX.roulette(s, t.col)).setDepth(DEPTH.decals - 1);
    this.g = s.add.graphics().setDepth(DEPTH.decals + 4);
    this.g.__noSnap = true;
    this.txt = s.add.text(ROOM.cx, ROOM.y + 60, '', { fontFamily: FONT_BODY, fontSize: '84px', color: '#f0d080', stroke: '#120c0a', strokeThickness: 10 }).setOrigin(0.5).setDepth(DEPTH.fx + 10).setVisible(false);
    this.txt.__noSnap = true;
    this.state = 'idle'; // idle | tell | zap
    this.t = 0;
    this.col = null;
    this.last = [null, null];
    this.next = ROULETTE.first;
    this.tickT = 0; this.zapN = 0; this.arcT = 0;
    this.hitAt = 0;
    this.enemyHit = new Set();
    this.auto = !!hz.def.roulette;
  }

  get active() { return this.state !== 'idle'; }

  /** Call a colour now (scheduler, or boss). Returns false when a call is already running or the colour has no tile. */
  call(col) {
    if (this.state !== 'idle') return false;
    if (!this.tiles.some((t) => t.col === col)) return false;
    this.col = col; this.state = 'tell'; this.t = 0; this.tickT = 0;
    this.last[0] = this.last[1]; this.last[1] = col;
    this.txt.setText(col === 'r' ? 'RED!' : 'BLACK!').setColor(col === 'r' ? '#ff5a4a' : '#e8dcc0').setVisible(true).setDepth(warnDepth(this.room) + 5).setAlpha(1).setScale(1.25);
    return true;
  }

  /** Pick the next colour: random, never three of a kind in a row. */
  _pick() {
    let col = this.hz.rng.chance(0.5) ? 'r' : 'k';
    if (this.last[0] === col && this.last[1] === col) col = col === 'r' ? 'k' : 'r';
    return col;
  }

  update(dt) {
    const hz = this.hz;
    if (this.auto && hz.live && this.state === 'idle' && hz.t >= this.next) {
      this.next += ROULETTE.period;
      this.call(this._pick());
    }
    const g = this.g;
    if (this.state === 'idle') { if (this._drawn) { g.clear(); this._drawn = false; this.txt.setVisible(false); } return; }
    this._drawn = true;
    this.t += dt;
    g.clear().setDepth(warnDepth(this.room));
    if (this.state === 'tell') this._tell(g, dt);
    else this._zap(g, dt);
  }

  _tell(g, dt) {
    const k = clamp(this.t / ROULETTE.tell, 0, 1);
    const flick = Math.floor(this.t * (8 + 14 * k)) & 1; // accelerating flicker: amber -> white
    const mix = flick ? AMBER[1] : AMBER[0];
    for (const t of this.tiles) {
      if (t.col !== this.col) continue;
      g.fillStyle(mix, 0.18 + 0.4 * k).fillRect(t.x - TILE / 2 + 4, t.y - TILE / 2 + 4, TILE - 8, TILE - 8);
      g.lineStyle(3, mix, 0.5 + 0.4 * k).strokeRect(t.x - TILE / 2 + 4, t.y - TILE / 2 + 4, TILE - 8, TILE - 8);
    }
    this.txt.setScale(lerp(1.25, 1, Math.min(1, this.t / 0.25)));
    this.tickT -= dt;
    if (this.tickT <= 0) { this.tickT = 0.28 - 0.16 * k; Sfx.play('roulette_tick', { vol: 0.7 }); }
    if (this.t >= ROULETTE.tell) { this.state = 'zap'; this.t = 0; this.zapN = 0; this.hitAt = 0; this.arcT = 0; this.enemyHit.clear(); Sfx.play('roulette_zap', { vol: 0.9 }); this.scene.fx.shake(0.004, 120); }
  }

  _zap(g, dt) {
    const s = this.scene, p = s.player;
    const k = this.t / ROULETTE.zap;
    const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
    this.txt.setAlpha(Math.max(0, 1 - this.t / 0.5));
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 40);
    for (const t of this.tiles) {
      if (t.col !== this.col) continue;
      g.fillStyle(0xfff2a0, (0.28 + 0.22 * pulse) * fade).fillRect(t.x - TILE / 2 + 2, t.y - TILE / 2 + 2, TILE - 4, TILE - 4);
      g.lineStyle(4, 0xffffff, 0.8 * fade).strokeRect(t.x - TILE / 2 + 3, t.y - TILE / 2 + 3, TILE - 6, TILE - 6);
    }
    // arcs between random zapped tiles (pooled Fx arcs)
    this.arcT -= dt;
    if (this.arcT <= 0) {
      this.arcT = 0.09;
      const n = this.tiles.length;
      for (let tries = 0, made = 0; tries < 8 && made < 2; tries++) {
        const a = this.tiles[(Math.random() * n) | 0];
        if (a.col !== this.col) continue;
        const b = this.tiles[(Math.random() * n) | 0];
        if (b.col !== this.col || b === a) continue;
        s.fx.arc(a.x + (Math.random() - 0.5) * 50, a.y + (Math.random() - 0.5) * 50, b.x + (Math.random() - 0.5) * 50, b.y + (Math.random() - 0.5) * 50, { ms: 110, color: 0xffe070 });
        made++;
      }
    }
    // player: 1 at zap start and every 0.7 s while on a zapped tile
    if (p && !p.dead && this.t >= this.hitAt && this.hitAt < ROULETTE.zap - 0.05) {
      if (!this._onZapped(p.x, p.y, p.hurtRadius * 0.5)) this.hitAt += ROULETTE.zapEvery; // off the tiles: pulse missed
      else if (hurtPlayer(s, ROULETTE.dmg, p.x, p.y + 30, 'roulette')) this.hitAt += ROULETTE.zapEvery; // else i-frames / roll: retry next frame
    }
    // walkers on a zapped tile: 6 once
    const list = s.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!groundFoe(e) || this.enemyHit.has(e) || !this._onZapped(e.x, e.y, 0)) continue;
      this.enemyHit.add(e);
      e.hurt(ROULETTE.enemyDmg, { x: e.x, y: e.y, hazard: 'roulette' });
    }
    if (this.t >= ROULETTE.zap) { this.state = 'idle'; this.txt.setVisible(false); }
  }

  _onZapped(x, y, pad) {
    for (const t of this.tiles) if (t.col === this.col && circleHitsTile(x, y, pad + 0.5, t.c, t.r)) return true;
    return false;
  }

  /** Room cleared: a pending call is cancelled, a running zap finishes. */
  stop() { this.auto = false; if (this.state === 'tell') { this.state = 'idle'; this.txt.setVisible(false); this.g.clear(); this._drawn = false; } }

  destroy() {
    for (const t of this.tiles) t.img.destroy();
    this.tiles.length = 0;
    this.g.destroy(); this.txt.destroy();
  }
}

export default RouletteField;
