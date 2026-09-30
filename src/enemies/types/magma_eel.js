// MAGMA EEL (floor 4, lava ambusher; CHAPTER2 s3 no. 4). Lives ONLY on lava tiles: it swims the connected lava graph (`Room.lavaPath()`) at 200 px/s,
// SUBMERGED = untargetable + invulnerable (bullets pass, DoT ignored), drawn as a ripple and a dark fin. Once its cooldown is up and the player is
// 200-520 px away it SURFACES (0.4 s, frame 4 mound + bubble ring r 36 = the tell), spits two volleys of 3 embers (18 deg fan, 300 px/s, 0.35 s apart,
// jaws open = frame 5), stays up 1.6 s (targetable, the window to shoot it), sinks for 0.4 s, and swims to a new spot for 1.2 s. Only one eel fires
// at a time (room token). If no lava tile has the player in range for 5 s it surfaces anyway so the room can always be cleared.
// Never in rooms without lava (templates guarantee >= 3 `L`); spawned elsewhere it degrades to a stationary spitter. No contact damage (lava hurts).
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { ROOM, TILE, DEPTH } from '../../config.js';
import { enemyRng, sfx, warnDepth } from '../parts/fe_e2/common.js';

const NEAR = 200, FAR = 520; // surfacing band (distance to the player)
const RISE = 0.4, UP = 1.6, SINK = 0.4, COOL = 1.2, VOLLEY_GAP = 0.35;
const VOLLEYS = 2, SPREAD = 18, EMBER_SPEED = 300, EMBER_LIFE = 2.6;
const SINK_PX = 46; // sprite sits this far down while it rises / sinks
const FORCE_AFTER = 5.0;
const ORANGE = 0xff7a1f, TAU = Math.PI * 2;

const colOf = (x) => Math.floor((x - ROOM.x) / TILE);
const rowOf = (y) => Math.floor((y - ROOM.y) / TILE);

class MagmaEel extends Enemy {
  init() {
    this.rn = enemyRng(this);
    const room = this.scene.room;
    const graph = room && room.lavaPath ? room.lavaPath() : null;
    this.lava = graph && graph.count > 0 ? graph : null; // null = no lava here: stationary fallback
    this.comp = this.lava ? this.component() : [{ c: colOf(this.x), r: rowOf(this.y), x: this.x, y: this.y }];
    this.contactDamage = 0;
    this.knockback = 0;
    this.shadow.setVisible(false);
    this.phase = 'sub';
    this.cool = this.lava ? COOL + this.rn.float(0, 0.6) : 0.4; // no lava (debug spawn): surface promptly
    this.idle = 0;
    this.path = null; this.pi = 0; this.dest = null; this.avoidAt = null; this.retargetT = 0;
    this.fired = 0;
    this.t = 0; // ripple clock
    this.g = null;
    this.face = 1;
    this.submerge(true);
  }

  /** Snap to the nearest free lava tile and collect the tiles of its connected pool (the eel never leaves it). */
  component() {
    const tiles = this.lava.tiles, list = this.scene.enemies;
    let start = null, bd = Infinity;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      let taken = false;
      for (let j = 0; j < list.length; j++) { const o = list[j]; if (o !== this && o.id === 'magma_eel' && o.alive && Math.hypot(o.x - t.x, o.y - t.y) < 60) { taken = true; break; } }
      const d = (t.x - this.x) ** 2 + (t.y - this.y) ** 2 + (taken ? 1e9 : 0);
      if (d < bd) { bd = d; start = t; }
    }
    this.x = start.x; this.y = start.y;
    const comp = [start];
    for (let grew = true; grew;) {
      grew = false;
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        if (comp.indexOf(t) >= 0) continue;
        for (let j = 0; j < comp.length; j++) if (Math.abs(comp[j].c - t.c) + Math.abs(comp[j].r - t.r) === 1) { comp.push(t); grew = true; break; }
      }
    }
    return comp;
  }

  /** Stay on lava: knockback, fear or a steering slip can never carry it onto dry ground. */
  moveBy(dx, dy) {
    if (!this.lava) { super.moveBy(dx, dy); return; }
    const x0 = this.x, y0 = this.y;
    super.moveBy(dx, dy);
    if (!this.lava.has(colOf(this.x), rowOf(this.y))) { this.x = x0; this.y = y0; }
  }

  applyStatus(name, o) { if (name === 'fear') return; super.applyStatus(name, o); } // fear would walk it out of the lava

  /** DoT (burn / poison) bypasses takeHit: keep it immune while submerged. */
  hurt(dmg, info = {}) { if (this.invulnerable && !info.force) return; super.hurt(dmg, info); }

  // ------------------------------------------------------------------------------------------ AI
  ai(dt) {
    this.faceToward(this.player.x);
    switch (this.phase) {
      case 'sub': this.swim(dt); break;
      case 'rise': {
        this.stop();
        const k = Math.min(1, this.stateTime / RISE);
        this.alphaOverride = k; this.airHeight = -SINK_PX * (1 - k);
        if (this.stateTime >= RISE) this.openFire();
        break;
      }
      case 'up': {
        this.stop();
        const t = this.stateTime;
        if (this.fired < VOLLEYS && t >= this.fired * VOLLEY_GAP) this.volley();
        if (this.pose === 'attack' && t >= 0.6) this.setPose('move');
        if (this.fired >= VOLLEYS && t >= (VOLLEYS - 1) * VOLLEY_GAP + 0.3) this.releaseToken('eel');
        if (t >= UP) this.startSink();
        break;
      }
      case 'sink': {
        this.stop();
        const k = Math.min(1, this.stateTime / SINK);
        this.alphaOverride = 1 - k; this.airHeight = -SINK_PX * k;
        if (this.stateTime >= SINK) this.submerge(false);
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------------------------------ submerged: swim + decide
  submerge(first) {
    this.setState('sub');
    this.phase = 'sub';
    this.invulnerable = true; this.targetable = false;
    this.alphaOverride = 0; this.airHeight = 0;
    this.sprite.setAlpha(0);
    this.setPose('move');
    this.releaseToken('eel');
    if (!first) { this.cool = this.cd(COOL); this.avoidAt = { x: this.x, y: this.y }; this.dest = null; }
    this.idle = 0;
    this.retargetT = 0;
  }

  swim(dt) {
    this.cool -= dt;
    this.retargetT -= dt;
    const d = this.distToPlayer();
    const inBand = d >= NEAR && d <= FAR;
    if (this.cool <= 0) {
      this.idle += dt;
      if ((inBand || this.idle >= FORCE_AFTER) && this.takeToken('eel', 1)) { this.rise(); return; }
    }
    if (this.retargetT <= 0) { this.retargetT = 0.3; this.retarget(); }
    this.follow(dt);
  }

  /** Pick the lava tile to swim to: inside the surfacing band, nearest to the eel, and not the tile it just surfaced on. */
  retarget() {
    const p = this.player, comp = this.comp, av = this.avoidAt;
    if (comp.length < 2 && !this.lava) return;
    let best = null, bs = Infinity;
    for (let pass = 0; pass < 3 && !best; pass++) {
      for (let i = 0; i < comp.length; i++) {
        const t = comp[i], d = Math.hypot(t.x - p.x, t.y - p.y);
        if (pass < 2 && (d < NEAR + 30 || d > FAR - 40)) continue;
        if (pass === 0 && av && Math.hypot(t.x - av.x, t.y - av.y) < 100) continue;
        const s = pass < 2 ? Math.hypot(t.x - this.x, t.y - this.y) + this.rn.float(0, 50) : Math.abs(d - (NEAR + FAR) / 2);
        if (s < bs) { bs = s; best = t; }
      }
    }
    if (!best) return;
    if (this.dest !== best) {
      this.dest = best;
      this.path = this.lava ? this.lava.path(this.x, this.y, best.x, best.y) : null;
      this.pi = 0;
    }
  }

  follow(dt) {
    const path = this.path;
    if (!path || this.pi >= path.length) { this.stop(); if (this.dest && this.avoidAt && Math.hypot(this.dest.x - this.x, this.dest.y - this.y) < 20) this.avoidAt = null; return; }
    const w = path[this.pi];
    const dx = w.x - this.x, dy = w.y - this.y, d = Math.hypot(dx, dy);
    if (d < 4) { this.pi++; this.stop(); return; }
    const v = Math.min(this.speed, d / Math.max(dt, 0.001));
    this.vx = (dx / d) * v; this.vy = (dy / d) * v;
  }

  // ------------------------------------------------------------------------------------------ surfaced
  rise() {
    this.setState('rise');
    this.phase = 'rise';
    this.stop();
    this.invulnerable = false; this.targetable = true; // visible = hittable
    this.setPose('windup');
    this.fired = 0;
    this.pulse(RISE);
    const fx = this.scene.fx;
    fx.ringPulse(this.x, this.y + 8, ORANGE, 36, 420, 0.9);
    fx.burst(this.x, this.y + 6, { color: [ORANGE, 0xffd060], count: 10, speed: [40, 150], life: [250, 500], scale: [1.4, 2.6], gravity: 120, angle: [230, 310], blend: 'ADD' });
    sfx('lava_burst', 'lava_bubble', { vol: 0.8 });
  }

  openFire() {
    this.setState('up');
    this.phase = 'up';
    this.alphaOverride = undefined; this.airHeight = 0;
    this.fired = 0;
  }

  volley() {
    this.fired++;
    this.setPose('attack');
    const a = this.angleToPlayer(), half = (SPREAD * Math.PI) / 180 / 2;
    for (let i = 0; i < 3; i++) this.shoot(a + (i - 1) * half, { kind: 'ember', speed: EMBER_SPEED, damage: 1, life: EMBER_LIFE, offset: 34, up: 38 });
    this.scene.fx.burst(this.x + Math.cos(a) * 34, this.y - 30 + Math.sin(a) * 34, { color: [ORANGE, 0xffd060], count: 6, speed: [60, 200], life: [150, 320], scale: [1.4, 2.6], blend: 'ADD', dir: a, spread: 24 });
    sfx('fire_whoosh', null, { vol: 0.4, rate: 1.3 });
  }

  startSink() {
    this.setState('sink');
    this.phase = 'sink';
    this.invulnerable = true; this.targetable = false;
    this.setPose('windup');
    this.releaseToken('eel');
  }

  // ------------------------------------------------------------------------------------------ ripple + fin while submerged
  /** The spawn-in fade would otherwise show the sprite before it dives. */
  syncVisual() {
    super.syncVisual();
    if (this.phase === 'sub' && this.sprite) this.sprite.setAlpha(0);
  }

  update(dt) {
    super.update(dt);
    if (this.alive) this.drawRipple(dt);
  }

  drawRipple(dt) {
    this.t += dt;
    const sub = this.phase === 'sub' || this.phase === 'sink' || this.phase === 'rise';
    const vis = this.phase === 'sub' ? 1 : this.phase === 'rise' ? 1 - Math.min(1, this.stateTime / RISE) : this.phase === 'sink' ? Math.min(1, this.stateTime / SINK) : 0;
    if (!sub || vis <= 0.01) { if (this.g && this.g.visible) { this.g.clear(); this.g.setVisible(false); } return; }
    if (!this.g || !this.g.scene) { this.g = this.scene.add.graphics(); this.g.__noSnap = true; }
    const g = this.g, room = this.scene.room, x = this.x, y = this.y + 12, moving = Math.abs(this.vx) + Math.abs(this.vy) > 8;
    g.setVisible(true).setDepth(room && room.darkMask ? warnDepth(room) : DEPTH.decals + 3);
    g.clear();
    if (Math.abs(this.vx) > 8) this.face = this.vx > 0 ? 1 : -1;
    for (let i = 0; i < 2; i++) { // two expanding ripple rings
      const ph = (this.t * 1.3 + i * 0.5) % 1;
      g.lineStyle(3, 0xffb050, 0.6 * (1 - ph) * vis).strokeEllipse(x, y, 44 + 60 * ph, 19 + 26 * ph);
    }
    const bob = Math.sin(this.t * 9) * 2, lean = moving ? 6 * this.face : 0;
    if (moving) { // wake behind the fin
      g.lineStyle(3, 0xffb050, 0.45 * vis);
      g.lineBetween(x - this.face * 18, y + 2, x - this.face * 46, y - 6);
      g.lineBetween(x - this.face * 18, y + 6, x - this.face * 46, y + 14);
    }
    g.fillStyle(0x2a0f0c, 0.95 * vis).fillTriangle(x - 18, y + 5, x + lean, y - 34 + bob, x + 20, y + 5);
    g.lineStyle(3, ORANGE, 0.9 * vis).strokeTriangle(x - 18, y + 5, x + lean, y - 34 + bob, x + 20, y + 5);
    g.fillStyle(ORANGE, 0.55 * vis).fillCircle(x, y + 3, 7);
  }

  onDeath() {
    const fx = this.scene.fx;
    fx.burst(this.x, this.y - 10, { color: [ORANGE, 0xffd060, 0x2a0f0c], count: 18, speed: [90, 300], life: [300, 700], scale: [1.6, 3.4], gravity: 300, blend: 'ADD' });
    fx.ringPulse(this.x, this.y + 8, ORANGE, 44, 420, 0.9);
    sfx('lava_burst', 'lava_bubble', { vol: 0.6, rate: 0.85 });
  }

  destroy() {
    if (this.g) { this.g.destroy(); this.g = null; }
    super.destroy();
  }
}

registerEnemy('magma_eel', MagmaEel);
