// Lava tiles `L` (F4): 1 unit per 1.0 s while the player stands in it (i-frames give the rate; a roll crosses free), walkers that are not fireproof
// avoid it (Hazards.blocks) and burn at 6 dps, flyers ignore it. Optional `lavaSpit`: every 4.0 s a lava tile bubbles 0.6 s and lobs one ember.
// Also owns the lava graph for `magma_eel` (room.lavaPath()).
import Phaser from 'phaser';
import { TILE, COLS, ROWS, DEPTH } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { hurtPlayer, fireproof, circleHitsTile, colOf, rowOf, tileX, tileY, inGrid, warnDepth, hasCell } from './common.js';
import { TEX } from './tiles.js';

const SPIT = { first: 2.5, gap: 4.0, bubble: 0.6, minDist: 280, speed: 240, dmg: 1, maxLive: 2, emberLife: 2.6 };
const ENEMY_DPS = 6;
const TICK = 0.25;

export class LavaField {
  constructor(hz, tiles) {
    this.hz = hz;
    this.room = hz.room;
    this.scene = hz.scene;
    this.tiles = tiles; // [{c, r, x, y}]
    this.mask = new Uint8Array(COLS * ROWS);
    for (const t of tiles) this.mask[t.r * COLS + t.c] = 1;
    this.imgs = [];
    this.real = hasCell('haz_f4', 'lava_a');
    const s = this.scene;
    const g = this.edge = s.add.graphics().setDepth(DEPTH.decals + 1.5);
    for (const t of tiles) {
      const im = this.real ? Assets.makeCell(s, t.x, t.y, 'haz_f4', 'lava_a', 0.5) : s.add.image(t.x, t.y, TEX.lava(s, 0));
      im.setDepth(DEPTH.decals + 1).setAngle(90 * ((t.c * 3 + t.r) & 3));
      this.imgs.push(im);
      this._edges(g, t);
    }
    this.glows = [];
    this.frame = 0; this.frameT = 0; this.tickT = TICK;
    this.spits = [];
    this.spitNext = SPIT.first;
    this._graph = null;
    for (let i = 0; i < SPIT.maxLive; i++) {
      const glow = s.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff7a1f).setVisible(false);
      glow.__noSnap = true;
      this.spits.push({ live: false, t: 0, tile: null, fired: false, glow, bubT: 0 });
    }
  }

  has(c, r) { return inGrid(c, r) && this.mask[r * COLS + c] === 1; }

  _edges(g, t) {
    const x = t.x - TILE / 2, y = t.y - TILE / 2, B = 9;
    const side = (dc, dr, rx, ry, rw, rh, lx1, ly1, lx2, ly2) => {
      if (this.has(t.c + dc, t.r + dr)) return;
      g.fillStyle(0x2a0f0c, 0.95).fillRect(rx, ry, rw, rh);
      g.lineStyle(3, 0xff7a1f, 0.7).lineBetween(lx1, ly1, lx2, ly2);
    };
    side(0, -1, x, y, TILE, B, x, y + B + 1, x + TILE, y + B + 1);
    side(0, 1, x, y + TILE - B, TILE, B, x, y + TILE - B - 1, x + TILE, y + TILE - B - 1);
    side(-1, 0, x, y, B, TILE, x + B + 1, y, x + B + 1, y + TILE);
    side(1, 0, x + TILE - B, y, B, TILE, x + TILE - B - 1, y, x + TILE - B - 1, y + TILE);
  }

  /** Circle overlaps any lava tile? Allocation-free. */
  overlaps(x, y, rad) {
    const c0 = colOf(x - rad), c1 = colOf(x + rad), r0 = rowOf(y - rad), r1 = rowOf(y + rad);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.has(c, r) && circleHitsTile(x, y, rad, c, r)) return true;
    return false;
  }

  /** Steering probe: walkers that lava hurts treat lava as a wall. */
  blocks(x, y, r, actor) {
    if (!actor || actor.flying || actor.ghost || actor === this.scene.player || fireproof(actor)) return false;
    return this.overlaps(x, y, r * 0.8);
  }

  update(dt) {
    // animation: 3-frame flow at ~3 fps
    this.frameT += dt;
    if (this.frameT >= 0.33) {
      this.frameT -= 0.33; this.frame = (this.frame + 1) % 3;
      if (this.real) { const f = Assets.frame('haz_f4', `lava_${'abc'[this.frame]}`); for (const im of this.imgs) im.setFrame(f); }
      else { const k = TEX.lava(this.scene, this.frame); for (const im of this.imgs) im.setTexture(k); }
    }
    const s = this.scene, p = s.player;
    // player: hit circle over a lava tile
    if (p && !p.dead && p.canBeHit()) {
      const pad = p.hurtRadius * 0.6;
      if (this.overlaps(p.x, p.y, pad)) hurtPlayer(s, 1, p.x, p.y + 40, 'lava');
    }
    // enemies: 6 dps while standing on it (ticked, no allocation)
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT += TICK;
      const list = s.enemies;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e.flying || e.ghost || e.isBoss || fireproof(e)) continue;
        if (this.has(colOf(e.x), rowOf(e.y))) e.hurt(ENEMY_DPS * TICK, { dot: true, hazard: 'lava', fire: true });
      }
    }
    this._spit(dt);
  }

  // ------------------------------------------------------------------------------------------------ spit
  _spit(dt) {
    const hz = this.hz;
    for (const sp of this.spits) {
      if (!sp.live) continue;
      sp.t += dt;
      if (!sp.fired) {
        const k = Math.min(1, sp.t / SPIT.bubble);
        sp.glow.setAlpha((0.35 + 0.55 * k) * (0.85 + 0.15 * Math.sin(sp.t * 40))).setScale(0.9 + 0.7 * k);
        sp.bubT -= dt;
        if (sp.bubT <= 0) { sp.bubT = 0.12; this.scene.fx.burst(sp.tile.x + (Math.random() - 0.5) * 60, sp.tile.y + (Math.random() - 0.5) * 60, { color: [0xff7a1f, 0xffd060], count: 2, speed: [20, 70], life: [250, 450], scale: [1, 2], gravity: -80, angle: [250, 290], blend: 'ADD', depth: warnDepth(this.room) + 1 }); }
        if (sp.t >= SPIT.bubble) this._lob(sp);
      } else if (sp.t >= SPIT.bubble + SPIT.emberLife) { sp.live = false; }
    }
    if (!hz.live || !hz.def.lavaSpit || this.tiles.length < 3 || hz.t < this.spitNext) return;
    this.spitNext += SPIT.gap;
    const p = this.scene.player;
    if (!p) return;
    let free = null, n = 0;
    for (const sp of this.spits) { if (sp.live) n++; else if (!free) free = sp; }
    if (!free || n >= SPIT.maxLive) return;
    let cand = 0;
    for (const t of this.tiles) if (Math.hypot(t.x - p.x, t.y - p.y) >= SPIT.minDist) cand++;
    if (!cand) return;
    let pick = hz.rng.int(0, cand - 1), tile = null;
    for (const t of this.tiles) if (Math.hypot(t.x - p.x, t.y - p.y) >= SPIT.minDist && pick-- === 0) { tile = t; break; }
    free.live = true; free.fired = false; free.t = 0; free.tile = tile; free.bubT = 0;
    free.glow.setPosition(tile.x, tile.y).setDepth(warnDepth(this.room)).setVisible(true);
    Sfx.play('lava_bubble', { vol: 0.8 });
  }

  _lob(sp) {
    sp.fired = true;
    sp.glow.setVisible(false);
    const p = this.scene.player, t = sp.tile;
    if (!p || p.dead || p.stats.pyroImmune) return; // pyromaniac synergies shrug the ember off: the bubble still pops, nothing is thrown
    const a = Math.atan2(p.y - t.y, p.x - t.x);
    this.scene.bullets.enemy.fire({ x: t.x, y: t.y, angle: a, speed: SPIT.speed, damage: SPIT.dmg, kind: 'ember', life: SPIT.emberLife, noObstacle: true, source: { kind: 'lava', hazard: 'lava' } });
    this.scene.fx.burst(t.x, t.y, { color: [0xff7a1f, 0xffd060], count: 8, speed: [60, 200], life: [200, 400], gravity: 300, depth: warnDepth(this.room) + 1 });
  }

  /** Stop pending bubbles (room cleared). In-flight embers finish on their own. */
  stopSpit() { for (const sp of this.spits) if (sp.live && !sp.fired) { sp.live = false; sp.glow.setVisible(false); } }

  // ------------------------------------------------------------------------------------------------ eel graph
  /** Lava graph for magma_eel: { tiles, count, has(c,r), nearest(x,y), path(x0,y0,x1,y1) -> [{x,y}] (tile centres, BFS over 4-connected lava) }. */
  graph() {
    if (this._graph) return this._graph;
    const self = this;
    const nearest = (x, y) => {
      let best = null, bd = Infinity;
      for (const t of self.tiles) { const d = (t.x - x) ** 2 + (t.y - y) ** 2; if (d < bd) { bd = d; best = t; } }
      return best;
    };
    const path = (x0, y0, x1, y1) => {
      const a = nearest(x0, y0), b = nearest(x1, y1);
      if (!a || !b) return [];
      const prev = new Int16Array(COLS * ROWS).fill(-2);
      const q = [a.r * COLS + a.c];
      prev[q[0]] = -1;
      const goal = b.r * COLS + b.c;
      for (let h = 0; h < q.length && prev[goal] === -2; h++) {
        const cur = q[h], c = cur % COLS, r = (cur / COLS) | 0;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc, nr = r + dr;
          if (!self.has(nc, nr)) continue;
          const id = nr * COLS + nc;
          if (prev[id] !== -2) continue;
          prev[id] = cur; q.push(id);
        }
      }
      if (prev[goal] === -2) return [{ x: a.x, y: a.y }];
      const out = [];
      for (let id = goal; id !== -1; id = prev[id]) out.push({ x: tileX(id % COLS), y: tileY((id / COLS) | 0) });
      return out.reverse();
    };
    return (this._graph = { tiles: this.tiles, count: this.tiles.length, has: (c, r) => self.has(c, r), nearest, path });
  }

  destroy() {
    for (const im of this.imgs) im.destroy();
    this.imgs.length = 0;
    this.edge.destroy();
    for (const sp of this.spits) sp.glow.destroy();
    this.spits.length = 0;
  }
}

export default LavaField;
