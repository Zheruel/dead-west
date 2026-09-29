// BOSS 3 - THE UNDERTAKER (chapter finale, HP 650, 3 phases). Sprites boss_undertaker_idle / _atk (atk: 0 shovel raised, 1 shovel in ground,
// 2 arms spread, 3 coffin-lid shield).
//   Phase 1  shovel SLAM (line telegraph -> shockwave line, then telegraphed falling rocks) + coffin NAILS (3 aimed fan bursts).
//   Phase 2  (<66%) opens wall COFFINS (3 'coffin' adds) + GRAVE-DIG: burrows, telegraphed checkerboard of bone spikes that alternates,
//            resurfaces under the player (telegraphed ring), then is stunned/vulnerable ~1.3 s.
//   Phase 3  (<33%) LID SHIELD: whenever the lid is up (idle walk + charge) hits inside the FRONT ARC (drawn on the floor) are blocked;
//            hit him from the sides/back. Shield CHARGE (locked line telegraph, wall crash -> rocks + 1.8 s stun with x1.35 damage) and
//            GHOSTFIRE SPIRAL (shield down while casting). Slam/nails/dig stay in the mix.
// Extras: fear/stun immune, adds are removed silently on death, dramatic finale death (slow-mo explosion chain, big blast) then
// GameScene.playFinale() -> chapter-complete End screen. All damage zones are drawn as telegraphs first (>= 0.5 s).
import Boss from '../Boss.js';
import { registerBoss } from '../registry.js';
import { spawnEnemy } from '../../enemies/index.js';
import { Assets } from '../../core/Assets.js';
import { Sfx, Music } from '../../core/Audio.js';
import { bus } from '../../core/events.js';
import { ROOM, TILE, COLS, ROWS, DEPTH, actorDepth, tileToWorld } from '../../config.js';
import { angleDiff, clamp, rad } from '../../core/util.js';

const RED = 0xd63a2a, AMBER = 0xe0c060;
const TOP_LIMIT = 352; // min ground y of the boss (sprite is 256 px tall, the HUD strip covers y < 136)
const SHIELD_HALF = rad(64); // half-angle of the immune front arc
const rnd = (a, b) => a + Math.random() * (b - a);

/** Distance from (x,y) to the room edge along angle a (minus a margin). */
function rayLen(x, y, a, m = 0) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let t = 1e9;
  if (dx > 1e-4) t = Math.min(t, (ROOM.right - m - x) / dx); else if (dx < -1e-4) t = Math.min(t, (ROOM.x + m - x) / dx);
  if (dy > 1e-4) t = Math.min(t, (ROOM.bottom - m - y) / dy); else if (dy < -1e-4) t = Math.min(t, (ROOM.y + m - y) / dy);
  return Math.max(0, t);
}

class Undertaker extends Boss {
  setup() {
    const s = this.scene;
    this.tags = [];
    this.faceAngle = Math.PI / 2; // direction the lid points (shield arc centre)
    this.faceRate = null; // shield turn rate override (rad/s)
    this.lockFace = false;
    this.shield = false; // lid raised: front arc blocks damage
    this.stunned = 0; // >0: vulnerable window (x1.35 damage)
    this.stunFx = 0;
    this.sinkT = 0; this.sinkDir = 0; // burrow animation (0 = surfaced, 1 = underground)
    this.bonk = false;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 1.5;
    this.arcFlash = 0;
    this.dtLast = 1 / 60;
    this.haz = []; // timed ground hazards (rocks / spikes / eruption rings)
    this.waves = []; // moving shockwave lines
    this.hg = s.add.graphics().setDepth(DEPTH.decals + 6);
    this.arcG = s.add.graphics().setDepth(DEPTH.fx - 20);
    s.fx._track(this.hg); s.fx._track(this.arcG);

    this.addAttack('slam', this.atkSlam, { weight: 3 });
    this.addAttack('nails', this.atkNails, { weight: 3 });
    this.addAttack('coffins', this.atkCoffins, { weight: 3, minPhase: 1, maxPhase: 1 });
    this.addAttack('dig', this.atkDig, { weight: 2, minPhase: 1 });
    this.addAttack('charge', this.atkCharge, { weight: 4, minPhase: 2 });
    this.addAttack('spiral', this.atkSpiral, { weight: 3, minPhase: 2 });
    this.phases = [
      { at: 0.66, name: 'coffins', enter() { this.interrupt(this.roar(1)); } },
      { at: 0.33, name: 'lid', enter() { this.interrupt(this.roar(2)); } },
    ];
  }

  attackDelay() { return [1.5, 1.25, 1.4][Math.min(2, this.phase)]; }
  applyStatus(name, o) { if (name === 'fear' || name === 'stun') return; super.applyStatus(name, o); }

  startFight() {
    super.startFight();
    this.idleT = 1.4;
    Sfx.play('zombie_groan', { vol: 0.9, rate: 0.8 });
  }

  // ------------------------------------------------------------------------------------------ damage / shield
  takeHit(dmg, info = {}) {
    if (this.shield && this.alive && !this.invulnerable && !this.dying && info.x != null) {
      const a = Math.atan2(info.y - this.y, info.x - this.x);
      if (Math.abs(angleDiff(this.faceAngle, a)) < SHIELD_HALF) {
        this.arcFlash = 0.18;
        Sfx.play('bullet_hit_wall', { vol: 0.9, rate: 0.55, detune: (Math.random() - 0.5) * 200, gap: 0.06 });
        Sfx.play('door_locked', { vol: 0.25, rate: 1.6, gap: 0.12 });
        const R = this.radius + 24;
        this.scene.fx.impact(this.x + Math.cos(a) * R, this.y + Math.sin(a) * R - 30, a + Math.PI, 1.1);
        return 'hit'; // bullet is consumed, no damage
      }
    }
    return super.takeHit(dmg, info);
  }
  damageMultiplier() { return this.stunned > 0 ? 1.35 : 1; }

  // ------------------------------------------------------------------------------------------ scheduler hooks
  /** Replace the running attack (phase changes). */
  interrupt(gen) { this.resetState(); this.gen = gen; this.wait = 0; }
  resetState() {
    this.shield = false; this.lockFace = false; this.faceRate = null; this.charging = false; this.stunned = 0;
    this.contactDamage = this.meta.contactDamage ?? 1;
    this.invulnerable = false; this.targetable = true;
    if (this.sinkT > 0 || this.sinkDir) { this.sinkT = 0; this.sinkDir = 0; }
    this.alphaOverride = undefined;
    this.applySink();
    this.stop();
  }
  startAttack() {
    this.stop(); this.shield = false; this.lockFace = false; this.faceRate = null;
    super.startAttack();
  }
  ai(dt) {
    this.dtLast = dt;
    this.updateHazards(dt);
    if (!this.dying) {
      this.updateFacing(dt);
      if (this.sinkDir) this.stepSink(dt);
      if (this.stunned > 0) {
        this.stunned -= dt;
        this.stunFx -= dt;
        if (this.stunFx <= 0) { this.stunFx = 0.22; this.scene.fx.burst(this.x + rnd(-40, 40), this.y - 150, { color: [0xffe070, 0xfff0a0], count: 2, speed: [10, 50], life: [400, 600], scale: [1.5, 2.5] }); }
      }
    }
    this.drawArc(dt);
    super.ai(dt);
    // keep the hat below the HUD strip (tall sprite): never walk above TOP_LIMIT
    if (!this.dying && !this.burrowed && this.y < TOP_LIMIT) { this.y = TOP_LIMIT; if (this.charging) this.bonk = true; }
  }
  moveBehaviour(dt) {
    if (this.stunned > 0 || this.burrowed) { this.stop(); return; }
    const ph = this.phase;
    if (ph >= 2) { this.shield = true; if (this.pose !== 'atk3') this.atkFrame(3); }
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = rnd(1.4, 2.6); }
    this.keepDistance(ph >= 2 ? 240 : ph >= 1 ? 340 : 300, ph >= 2 ? 0 : 0.35 * this.strafeDir, ph >= 2 ? 105 : 85, 50);
  }
  onWallHit() { this.bonk = true; }

  updateFacing(dt) {
    if (this.lockFace || this.burrowed) return;
    const want = this.angleToPlayer();
    const rate = this.shield ? (this.faceRate ?? 0.9) : 6;
    this.faceAngle += clamp(angleDiff(this.faceAngle, want), -rate * dt, rate * dt);
  }

  /** Glowing arc on the floor showing the immune front while the lid is up. */
  drawArc(dt) {
    const g = this.arcG;
    if (!g || !g.scene) return;
    if (this.arcFlash > 0) this.arcFlash -= dt;
    if (!this.shield || this.dying) { if (this.arcDrawn) { g.clear(); this.arcDrawn = false; } return; }
    this.arcDrawn = true;
    g.clear();
    const R = this.radius + 26, f = this.arcFlash > 0;
    const a0 = this.faceAngle - SHIELD_HALF, a1 = this.faceAngle + SHIELD_HALF;
    g.lineStyle(f ? 34 : 24, f ? 0xffffff : 0x8fc23f, f ? 0.55 : 0.22).beginPath().arc(this.x, this.y, R, a0, a1).strokePath();
    g.lineStyle(f ? 12 : 8, f ? 0xffffff : 0xe8f0c8, f ? 1 : 0.85).beginPath().arc(this.x, this.y, R, a0, a1).strokePath();
  }

  // ------------------------------------------------------------------------------------------ burrow visuals
  get burrowed() { return this.sinkT >= 1; }
  applySink() {
    if (!this.sprite) return;
    const k = this.sinkT;
    this.sprite.setScale(this.baseScale, this.baseScale * (1 - 0.35 * k));
    if (k > 0) this.alphaOverride = k >= 1 ? 0 : 1 - k * 0.9; else if (!this.sinkDir) this.alphaOverride = undefined;
    if (this.shadow) this.shadow.setAlpha(1 - k);
  }
  stepSink(dt) {
    this.sinkT = clamp(this.sinkT + this.sinkDir * dt / 0.45, 0, 1);
    if (this.sinkDir < 0 && this.sinkT <= 0) this.sinkDir = 0;
    this.applySink();
    if (this.sinkT >= 1 && this.sinkDir > 0) this.sinkDir = 0;
  }
  setBurrow(on) {
    this.invulnerable = on; this.targetable = !on;
    this.contactDamage = on ? 0 : (this.meta.contactDamage ?? 1);
    this.sinkDir = on ? 1 : -1;
  }

  // ------------------------------------------------------------------------------------------ hazards
  hurtPlayer(units, x, y) {
    const p = this.player;
    if (p && p.canBeHit()) p.damage(units, { x, y, kind: 'boss', enemyName: 'the Undertaker' });
  }
  addHaz(h) { h.t = 0; h.fired = false; h.hitDone = false; h.color = h.color ?? RED; h.active = h.active ?? 0.25; h.hold = h.hold ?? h.active; this.haz.push(h); return h; }
  rock(x, y, warn) { return this.addHaz({ kind: 'rock', x, y, r: 62, warn, active: 0.2, dmg: 1 }); }

  updateHazards(dt) {
    const g = this.hg;
    if (!g || !g.scene) return;
    g.clear();
    const s = this.scene, p = this.player;
    for (let i = this.haz.length - 1; i >= 0; i--) {
      const h = this.haz[i];
      h.t += dt;
      if (h.t < h.warn) {
        const k = h.t / h.warn;
        g.fillStyle(h.color, 0.14).fillCircle(h.x, h.y, h.r);
        g.fillStyle(h.color, 0.22 + 0.25 * k).fillCircle(h.x, h.y, h.r * k);
        g.lineStyle(3, h.color, 0.55 + 0.4 * k).strokeCircle(h.x, h.y, h.r);
        if (h.kind === 'rock') { // rock drops from above during the last 0.28 s
          const fk = clamp((h.t - (h.warn - 0.28)) / 0.28, 0, 1);
          if (fk > 0) {
            if (!h.spr) h.spr = Assets.makeCell(s, h.x, h.y, 'projectiles', 'rock_debris', 0.5).setScale(2.6).setDepth(DEPTH.fx - 10);
            h.spr.setPosition(h.x, h.y - 24 - (1 - fk) * 560).setRotation(fk * 5);
          }
        }
        continue;
      }
      if (!h.fired) { h.fired = true; this.fireHaz(h); }
      const age = h.t - h.warn;
      if (age < h.active && !h.hitDone && p && p.canBeHit()) {
        const rr = h.r + p.hurtRadius * 0.5;
        if ((p.x - h.x) ** 2 + (p.y - h.y) ** 2 < rr * rr) { h.hitDone = true; this.hurtPlayer(h.dmg, h.x, h.y); }
      }
      if (h.kind === 'spike' && h.spr) {
        const grow = clamp(age / 0.1, 0, 1), fade = clamp((h.hold - age) / 0.2, 0, 1);
        h.spr.setScale(0.9 * (0.3 + 0.7 * grow), 0.9 * (0.2 + 0.8 * grow)).setAlpha(fade);
      }
      if (age >= h.hold) { if (h.spr) { h.spr.destroy(); h.spr = null; } this.haz.splice(i, 1); }
    }
    // shockwave lines
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.dist += w.speed * dt;
      const c = Math.cos(w.a), sn = Math.sin(w.a);
      const fx = w.x + c * w.dist, fy = w.y + sn * w.dist;
      const back = Math.max(0, w.dist - 150);
      const nx = -sn * w.w / 2, ny = c * w.w / 2;
      const bx = w.x + c * back, by = w.y + sn * back;
      g.fillStyle(0xe8dcc0, 0.32).fillPoints([{ x: bx + nx, y: by + ny }, { x: fx + nx, y: fy + ny }, { x: fx - nx, y: fy - ny }, { x: bx - nx, y: by - ny }], true);
      g.lineStyle(4, 0xffffff, 0.6).lineBetween(fx + nx, fy + ny, fx - nx, fy - ny);
      w.puff -= dt;
      if (w.puff <= 0) {
        w.puff = 0.045;
        s.fx.dust(fx + rnd(-30, 30), fy + rnd(-10, 25), 1.0);
        s.fx.burst(fx, fy - 10, { color: [0x8a7a68, 0x6b5a48, 0xe8dcc0], count: 3, speed: [40, 180], life: [200, 400], gravity: 300 });
      }
      if (!w.hit && p && p.canBeHit()) {
        const px = p.x - w.x, py = p.y - w.y;
        const along = px * c + py * sn, perp = Math.abs(-px * sn + py * c);
        if (along > back - 20 && along < w.dist + 30 && perp < w.w / 2 + p.hurtRadius * 0.6) { w.hit = true; this.hurtPlayer(w.dmg, fx, fy); }
      }
      if (w.dist > w.maxLen) this.waves.splice(i, 1);
    }
  }

  fireHaz(h) {
    const s = this.scene, fx = s.fx;
    if (h.kind === 'rock') {
      if (h.spr) { h.spr.destroy(); h.spr = null; }
      fx.burst(h.x, h.y - 10, { color: [0x8a7a68, 0x6b5a48, 0xe8dcc0], count: 16, speed: [100, 340], life: [250, 550], gravity: 400 });
      fx.dust(h.x, h.y + 10, 1.4);
      fx.decal(h.x, h.y, 'scorch', 0.4);
      fx.shake(0.008, 120);
      Sfx.play('bullet_hit_wall', { vol: 1, rate: 0.5, detune: rnd(-150, 150), gap: 0.07 });
    } else if (h.kind === 'spike') {
      h.spr = Assets.makeCell(s, h.x, h.y + 46, 'obst_f3', 'spikes', 1).setDepth(actorDepth(h.y + 46)).setScale(0.27, 0.18);
      h.spr.setTint(0xf2e8d0);
      fx.burst(h.x, h.y + 20, { color: [0x6b4423, 0x8a5a2a], count: 4, speed: [40, 160], life: [200, 400], gravity: 300 });
    } else if (h.kind === 'burst') {
      fx.burst(h.x, h.y, { color: [0x6b4423, 0x8a5a2a, 0xb8843f], count: 30, speed: [120, 420], life: [300, 700], gravity: 300 });
      fx.dust(h.x, h.y + 10, 2);
      fx.shake(0.02, 300);
      Sfx.play('dig', { vol: 1, rate: 0.85 });
      Sfx.play('explosion', { vol: 0.35, rate: 0.7, gap: 0.1 });
    }
  }
  clearHazards() {
    for (const h of this.haz) if (h.spr) { h.spr.destroy(); h.spr = null; }
    this.haz.length = 0; this.waves.length = 0;
    if (this.hg && this.hg.scene) this.hg.clear();
    if (this.arcG && this.arcG.scene) this.arcG.clear();
  }

  spawnWave(x, y, a) { this.waves.push({ x, y, a, dist: 0, speed: 950, w: 100, dmg: 2, hit: false, puff: 0, maxLen: rayLen(x, y, a, 0) + 60 }); }

  /** n falling rocks: the first on the player, the rest scattered around (cascade every `step` s). */
  rockField(n, warn0, step = 0.14) {
    const p = this.player, pts = [{ x: p.x, y: p.y }];
    for (let tries = 0; pts.length < n && tries < 60; tries++) {
      const a = Math.random() * Math.PI * 2, d = rnd(110, 380);
      const x = clamp(p.x + Math.cos(a) * d, ROOM.x + 60, ROOM.right - 60), y = clamp(p.y + Math.sin(a) * d, ROOM.y + 60, ROOM.bottom - 60);
      if (pts.every((q) => Math.hypot(q.x - x, q.y - y) > 130)) pts.push({ x, y });
    }
    pts.forEach((q, i) => this.rock(q.x, q.y, warn0 + i * step));
    return warn0 + (pts.length - 1) * step;
  }

  /** Free floor spot near (x,y) for the boss body (avoids solid tiles). */
  freeSpot(x, y) {
    const room = this.scene.room, r = this.radius;
    const top = Math.max(ROOM.y + r + 10, TOP_LIMIT);
    x = clamp(x, ROOM.x + r + 10, ROOM.right - r - 10); y = clamp(y, top, ROOM.bottom - r - 10);
    if (!room || !room.probe(x, y, r, this)) return { x, y };
    for (let d = 60; d < 400; d += 60) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, px = clamp(x + Math.cos(a) * d, ROOM.x + r + 10, ROOM.right - r - 10), py = clamp(y + Math.sin(a) * d, top, ROOM.bottom - r - 10);
      if (!room.probe(px, py, r, this)) return { x: px, y: py };
    }
    return { x: ROOM.cx, y: ROOM.cy };
  }

  /** Bone-spike checkerboard: cells of `parity` (0/1) telegraph for `warn` s, erupt in a ripple out from the boss. */
  spikeWave(parity, warn) {
    const room = this.scene.room;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (((c + r) & 1) !== parity || room.tiles[r][c].solid) continue;
      const { x, y } = tileToWorld(c, r);
      const d = Math.hypot(x - this.x, y - this.y);
      this.addHaz({ kind: 'spike', x, y, r: 46, warn: warn + d * 0.0003, active: 0.3, hold: 0.6, dmg: 1, color: AMBER });
    }
  }

  addsAlive() { for (const e of this.scene.enemies) if (e !== this && e.alive && !e.isBoss) return true; return false; }

  // ------------------------------------------------------------------------------------------ attacks: phase 1
  *atkSlam() {
    this.setPose('windup'); this.pulse(0.95);
    Sfx.play('zombie_groan', { vol: 0.7, rate: 0.9 });
    yield 0.4; // he tracks you during this part
    const a = this.angleToPlayer();
    this.faceAngle = a; this.lockFace = true;
    const sx = this.x + Math.cos(a) * 90, sy = this.y + Math.sin(a) * 90;
    const len = rayLen(sx, sy, a, 0);
    this.scene.fx.warnLine(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len, 100, 0.55);
    Sfx.play('lasso_swish', { vol: 0.6, rate: 0.7 });
    yield 0.55;
    this.setPose('attack');
    const fx = this.scene.fx;
    fx.shake(0.02, 280); fx.hitStop(45);
    Sfx.play('explosion', { vol: 0.5, rate: 0.75, gap: 0.05 });
    Sfx.play('whip_crack', { vol: 0.7, rate: 0.7 });
    fx.burst(sx, sy, { color: [0x8a7a68, 0x6b4423, 0xe8dcc0], count: 22, speed: [100, 380], gravity: 300 });
    fx.dust(sx, sy + 10, 1.6);
    this.spawnWave(sx, sy, a);
    yield 0.6;
    this.setPose('windup');
    const n = this.phase >= 2 ? 6 : this.phase >= 1 ? 5 : 4;
    const tEnd = this.rockField(n, 1.0);
    Sfx.play('skeleton_rattle', { vol: 0.5, rate: 0.6 });
    yield tEnd * 0.4;
    this.setPose('move');
    yield tEnd * 0.6 + 0.3;
  }

  *atkNails() {
    const bursts = this.phase >= 2 ? 4 : 3;
    for (let i = 0; i < bursts; i++) {
      const a = this.angleToPlayer();
      this.faceAngle = a;
      this.setPose('windup'); this.pulse(i === 0 ? 0.8 : 0.6);
      Sfx.play('gun_cock', { vol: 0.7, rate: 0.6 });
      const x = this.x + Math.cos(a) * 40, y = this.y + Math.sin(a) * 40;
      const wide = i % 2 === 1;
      const spread = wide ? 84 : 52;
      const L = Math.min(560, rayLen(x, y, a, 0));
      this.scene.fx.warnLine(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, wide ? 250 : 130, i === 0 ? 0.8 : 0.6, RED);
      yield i === 0 ? 0.8 : 0.6;
      this.setPose('attack');
      const n = wide ? 7 : this.phase >= 2 ? 6 : 5;
      this.scene.bullets.enemy.fan({ x, y, speed: this.phase >= 2 ? 410 : 370, damage: 1, kind: 'nail', life: 3 }, n, spread, a);
      this.scene.fx.muzzle(x, y - 40, a, 1.1);
      this.scene.fx.shake(0.004, 100);
      Sfx.play('whip_crack', { vol: 0.6, rate: 1.25, detune: rnd(-100, 100) });
      yield 0.32;
    }
    this.setPose('move');
    yield 0.4;
  }

  // ------------------------------------------------------------------------------------------ attacks: phase 2
  *atkCoffins(fromRoar = false) {
    if (this.addsAlive()) { yield* this.atkNails(); return; } // only reopen the coffins once the last add is dead
    this.atkFrame(2); this.pulse(1.0);
    Sfx.play('coffin_open', { vol: 1, rate: 0.85 });
    this.scene.fx.shake(0.006, 900);
    if (!fromRoar) yield 0.6;
    const p = this.player;
    const spots = [
      { x: ROOM.x + 80, y: ROOM.y + 120 }, { x: ROOM.x + 80, y: ROOM.bottom - 120 }, { x: ROOM.right - 80, y: ROOM.y + 120 },
      { x: ROOM.right - 80, y: ROOM.bottom - 120 }, { x: ROOM.cx - 300, y: ROOM.y + 80 }, { x: ROOM.cx + 300, y: ROOM.y + 80 },
      { x: ROOM.cx - 300, y: ROOM.bottom - 80 }, { x: ROOM.cx + 300, y: ROOM.bottom - 80 },
    ].filter((q) => Math.hypot(q.x - p.x, q.y - p.y) > 280).sort(() => Math.random() - 0.5);
    const n = Math.min(spots.length, 3);
    for (let i = 0; i < n; i++) {
      const q = spots[i];
      this.scene.fx.burst(q.x, q.y - 40, { color: [0x8fc23f, 0xc8f07a, 0x3a5a10], count: 18, speed: [40, 200], life: [400, 900], angle: [230, 310], gravity: -60, scale: [2, 3.5] });
      this.scene.fx.spawn(q.x, q.y, 1.4);
      Sfx.play('coffin_open', { vol: 0.8, rate: rnd(0.9, 1.15), gap: 0.05 });
      Sfx.play('zombie_groan', { vol: 0.6, rate: rnd(0.8, 1.0), gap: 0.05 });
      yield 0.3;
      const e = spawnEnemy(this.scene, 'coffin', q.x, q.y, { instant: true, floor: this.floor });
      if (e) e.fromBoss = true;
    }
    yield 0.5;
    this.setPose('move');
  }

  *atkDig() {
    if (this.addsAlive()) { yield* this.atkSlam(); return; } // never stack the spike grid on top of coffins
    const fx = this.scene.fx, k = this.phase >= 2 ? 0.85 : 1;
    this.atkFrame(1); this.pulse(0.5);
    Sfx.play('dig', { vol: 1, rate: 0.9 });
    fx.dust(this.x, this.y + 20, 1.5);
    yield 0.35;
    this.setBurrow(true);
    for (let i = 0; i < 4; i++) { fx.burst(this.x, this.y + 30, { color: [0x6b4423, 0x8a5a2a], count: 8, speed: [60, 200], gravity: 300 }); yield 0.1; }
    yield 0.2;
    // alternating bone-spike checkerboard: the safe cells swap each wave
    let par = Math.random() < 0.5 ? 0 : 1;
    const waves = this.phase >= 2 ? 3 : 2;
    for (let i = 0; i < waves; i++) {
      const warn = (i === 0 ? 1.15 : 1.0) * k;
      this.spikeWave(par, warn);
      Sfx.play('skeleton_rattle', { vol: 0.45, rate: 0.7, gap: 0.2 });
      yield warn + 0.02;
      Sfx.play('dig', { vol: 0.9, rate: 1.2, gap: 0.2 });
      Sfx.play('bullet_hit_wall', { vol: 0.6, rate: 0.7, gap: 0.2 });
      fx.shake(0.008, 200);
      par ^= 1;
      yield 0.45; // spikes retract before the next telegraph starts
    }
    // resurface under the player (telegraphed ring)
    const spot = this.freeSpot(this.player.x, this.player.y);
    this.addHaz({ kind: 'burst', x: spot.x, y: spot.y, r: 105, warn: 0.95 * k, active: 0.25, hold: 0.3, dmg: 1 });
    Sfx.play('zombie_groan', { vol: 0.7, rate: 0.7 });
    yield 0.95 * k;
    this.x = spot.x; this.y = spot.y; this.stop();
    this.setBurrow(false);
    this.atkFrame(1);
    this.stunned = 1.4; this.stunFx = 0; this.contactDamage = 0; // dazed: harmless to touch
    fx.shake(0.012, 250);
    yield 1.4;
    this.contactDamage = this.meta.contactDamage ?? 1;
    this.setPose('move');
  }

  // ------------------------------------------------------------------------------------------ attacks: phase 3
  *atkCharge() {
    const fx = this.scene.fx;
    this.atkFrame(3); this.shield = true; this.pulse(0.9);
    this.faceRate = 4;
    Sfx.play('zombie_groan', { vol: 0.8, rate: 0.7 });
    yield 0.5;
    const a = this.angleToPlayer();
    this.faceAngle = a; this.lockFace = true;
    const L = rayLen(this.x, this.y, a, this.radius);
    fx.warnLine(this.x, this.y, this.x + Math.cos(a) * L, this.y + Math.sin(a) * L, this.radius * 1.9, 0.65);
    Sfx.play('gun_cock', { vol: 0.8, rate: 0.5 });
    yield 0.65;
    this.charging = true; this.bonk = false;
    this.contactDamage = 2;
    Sfx.play('dodge_roll', { vol: 1, rate: 0.5 });
    Sfx.play('coyote_howl', { vol: 0.5, rate: 0.55 });
    let t = 0, trail = 0;
    while (!this.bonk && t < 1.9) {
      this.moveAngle(a, 660);
      t += this.dtLast; trail -= this.dtLast;
      if (trail <= 0) { trail = 0.05; fx.dust(this.x - Math.cos(a) * 40, this.y + 34, 1.1); }
      yield 0;
    }
    this.stop(); this.charging = false;
    this.contactDamage = this.meta.contactDamage ?? 1;
    if (this.bonk) {
      fx.shake(0.03, 420); fx.hitStop(90);
      Sfx.play('explosion', { vol: 0.7, rate: 0.8, gap: 0.05 });
      Sfx.play('bullet_hit_wall', { vol: 1, rate: 0.5 });
      fx.burst(this.x + Math.cos(a) * 60, this.y + Math.sin(a) * 60, { color: [0x8a7a68, 0x6b4423, 0xe8dcc0], count: 30, speed: [100, 420], gravity: 400 });
      this.rockField(this.phase >= 2 ? 4 : 3, 1.1, 0.16);
    }
    // crash: lid drops, dazed and open to damage
    this.shield = false; this.lockFace = false;
    this.setPose('move');
    this.stunned = 1.8; this.stunFx = 0; this.contactDamage = 0;
    yield 1.8;
    this.contactDamage = this.meta.contactDamage ?? 1;
  }

  *atkSpiral() {
    const fx = this.scene.fx;
    this.atkFrame(2); this.pulse(0.8);
    fx.shake(0.004, 800);
    Sfx.play('ghost_wail', { vol: 0.9, rate: 0.8 });
    fx.burst(this.x, this.y - 100, { color: [0x6fe0d0, 0x8fc23f], count: 20, speed: [40, 200], life: [500, 900], scale: [2, 3.5], blend: 'ADD' });
    yield 0.8;
    const B = this.scene.bullets.enemy;
    let dir = Math.random() < 0.5 ? 1 : -1;
    const N = 36, base = Math.random() * 6.28;
    let a = base;
    for (let i = 0; i < N; i++) {
      if (i === Math.floor(N / 2)) dir = -dir; // reverse the swirl halfway
      a += dir * rad(11);
      for (let k = 0; k < 2; k++) {
        const b = a + k * Math.PI;
        B.fire({ x: this.x + Math.cos(b) * 60, y: this.y + Math.sin(b) * 60, angle: b, speed: 235, damage: 1, kind: 'ghostfire', life: 4.5 });
      }
      if (i % 6 === 0) Sfx.play('ghost_wail', { vol: 0.35, rate: 1.4 + (i % 12) * 0.03, gap: 0.2 });
      yield 0.09;
    }
    yield 0.6;
    this.setPose('move');
  }

  // ------------------------------------------------------------------------------------------ phase transitions
  /** Roar between phases (short invulnerable window): 1 = wall coffins, 2 = lid shield. */
  *roar(n) {
    this.invulnerable = true;
    const s = this.scene;
    s.bullets.enemy.clear();
    this.atkFrame(2); this.pulse(1.2);
    s.fx.shake(0.014, 1100); s.fx.flash(0x8fc23f, 0.35);
    s.fx.burst(this.x, this.y - 100, { color: [0x8fc23f, 0xc8f07a], count: 30, speed: [80, 320], life: [500, 900], scale: [2, 4], blend: 'ADD' });
    Sfx.play('boss_intro', { vol: 0.8, rate: 0.9 });
    Sfx.play('zombie_groan', { vol: 1, rate: 0.6 });
    yield 1.2;
    this.invulnerable = false;
    if (n === 1) yield* this.atkCoffins(true);
    else { this.atkFrame(3); Sfx.play('door_locked', { vol: 0.8, rate: 0.6 }); yield 0.5; }
  }

  // ------------------------------------------------------------------------------------------ death (finale)
  /** Remove leftover adds without triggering their death effects (bat release etc). */
  purgeAdds() {
    for (const e of [...this.scene.enemies]) {
      if (e === this || !e.alive) continue;
      this.scene.fx.deathPuff(e.x, e.y - 10, 1);
      e.alive = false; e.destroy();
    }
  }

  die(info = {}) {
    if (!this.alive || this.dying) return;
    const s = this.scene, fx = s.fx;
    this.clearHazards();
    this.purgeAdds();
    this.shield = false; this.charging = false; this.sinkT = 0; this.sinkDir = 0; this.alphaOverride = undefined;
    this.applySink();
    this.dying = true; this.invulnerable = true; this.active = false; this.gen = null; this.contactDamage = 0; this.targetable = false;
    this.stop();
    const i = s.enemies.indexOf(this);
    if (i >= 0) s.enemies.splice(i, 1);
    s.bullets.enemy.clear();
    bus.emit('boss:hp', { hp: 0, maxHp: this.maxHp, boss: this });
    s.player.setEntryInvuln(60); // nothing may hurt the player during the finale
    Sfx.play('boss_die', { vol: 1 });
    Sfx.play('zombie_groan', { vol: 1, rate: 0.5 });
    Music.stop(900);
    s.slowMo(0.28, 3.2);
    fx.hitStop(170); fx.flash(0xffffff, 0.5);
    this.atkFrame(2);
    let n = 0;
    const N = 20;
    s.time.addEvent({
      delay: 150, repeat: N - 1,
      callback: () => {
        if (!this.sprite) return;
        n++;
        const k = n / N;
        const ox = (Math.random() - 0.5) * this.radius * 2.2, oy = -20 - Math.random() * 190;
        fx.explosion(this.x + ox, this.y + oy, 60 + Math.random() * 50 + k * 50);
        Sfx.play('explosion', { vol: 0.5, rate: rnd(0.7, 1.1), gap: 0.08 });
        fx.burst(this.x + ox, this.y + oy, { color: [0x8fc23f, 0xc8f07a], count: 8, speed: [60, 220], angle: [220, 320], gravity: -60, life: [400, 800], blend: 'ADD' });
        fx.shake(0.012 + k * 0.012, 200);
        this.sprite.setTint(n % 2 ? 0xffffff : 0xff6a4a);
        this.sprite.setScale(this.baseScale * (1 + (Math.random() - 0.5) * 0.05));
      },
    });
    s.time.delayedCall(2500, () => this.bigBlast());
    s.time.delayedCall(3300, () => this.finishDeath(info));
  }

  bigBlast() {
    if (!this.sprite) return;
    const s = this.scene, fx = s.fx;
    fx.flash(0xffffff, 0.95);
    fx.explosion(this.x, this.y - 70, 340);
    for (let i = 0; i < 4; i++) fx.explosion(this.x + rnd(-130, 130), this.y - rnd(0, 200), 150 + Math.random() * 70);
    fx.shake(0.04, 800);
    Sfx.play('explosion', { vol: 1, rate: 0.7, gap: 0 });
    Sfx.play('explosion', { vol: 0.9, rate: 0.5, gap: 0 });
    Sfx.play('boss_die', { vol: 0.8, rate: 0.7, gap: 0 });
    fx.burst(this.x, this.y - 80, { color: [0xe8dcc0, 0xb8a888, 0x6b4423], count: 50, speed: [120, 520], life: [500, 1100], gravity: 500, scale: [2, 4] });
    fx.burst(this.x, this.y - 90, { color: [0x8fc23f, 0xc8f07a, 0x6fe0d0], count: 40, speed: [40, 200], angle: [230, 310], gravity: -80, life: [900, 1600], scale: [2, 4], blend: 'ADD' });
    fx.decal(this.x, this.y, 'blood', 2.8);
    this.sprite.setVisible(false);
    if (this.shadow) this.shadow.setVisible(false);
  }

  destroy() {
    this.clearHazards();
    if (this.hg && this.hg.scene) this.hg.destroy();
    if (this.arcG && this.arcG.scene) this.arcG.destroy();
    this.hg = this.arcG = null;
    super.destroy();
  }
}

registerBoss('undertaker', Undertaker, { hp: 650, r: 62, foot: 40, scale: 0.8, speed: 90, name: 'THE UNDERTAKER', title: 'Last Rites For The Living', music: 'boss_final' });
