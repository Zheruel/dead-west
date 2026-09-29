// BOSS 2 - MARSHAL GRIMM (floor 2, HP 420). Undead lawman: keeps mid range, circles the player, and cycles telegraphed attacks:
//   quickDraw : freezes, gun-line tracks you 0.3 s then LOCKS 0.2 s, then 3 rapid shots along the locked line, x2 (x3 enraged).
//   lasso     : noose flies along a locked telegraph band; if it connects it drags you in (input locked ~0.4 s) and Grimm slams
//               (0.5 s ring telegraph, 2 dmg). Rolling through the noose (i-frames) or leaving the band dodges it.
//   dynamite  : lobs 3-5 lit sticks in a ring around your position; each landing spot is marked for the whole flight + fuse.
//   spin      : (phase 2+) walks while spinning revolvers: radial 8-bullet bursts every ~0.55 s with a slowly rotating offset.
//   summon    : (phase 2+) re-summons ghost deputies if fewer than 2 are alive.
// Phase 2 (<60% HP): roar + 2 ghost deputies, spin/summon unlocked. Phase 3 (<25%): enrage - faster, red aura, dual-hand bursts, 3 volleys.
// The player pull is implemented here (player.locked + moveBy); it is always released on cancel/death/destroy.
import Phaser from 'phaser';
import Boss from '../Boss.js';
import { registerBoss } from '../registry.js';
import Dynamite from '../../entities/Dynamite.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH, ROOM } from '../../config.js';
import { rad } from '../../core/util.js';

const NOOSE_R = 30; // noose head radius (hit test = NOOSE_R + 0.6*player.hurtRadius)
const NOOSE_SPEED = 1250;
const LASSO_RANGE = 720;
const SLAM_R = 150;
const STICK_R = 112;
const rv = (a, b) => a + Math.random() * (b - a);

class Grimm extends Boss {
  setup() {
    const s = this.scene;
    this.dt = 1 / 60;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 1.5;
    this.enraged = false;
    this.pulling = false;
    this.sticks = [];
    this.warn = s.add.graphics().setDepth(DEPTH.decals + 8); // floor telegraphs (aim line, lasso band)
    this.rope = s.add.graphics().setDepth(DEPTH.bullets + 2); // lasso rope/noose
    s.fx._track(this.warn); s.fx._track(this.rope);
    this.addAttack('quickDraw', this.atkQuickDraw, { weight: 3 });
    this.addAttack('lasso', this.atkLasso, { weight: 2.2 });
    this.addAttack('dynamite', this.atkDynamite, { weight: 2 });
    this.addAttack('spin', this.atkSpin, { weight: 3, minPhase: 1 });
    this.addAttack('summon', this.atkSummon, { weight: 1.3, minPhase: 1, maxPhase: 1 });
    this.phases = [
      { at: 0.6, name: 'deputies', enter() { this.interrupt(this.roar(false)); } },
      { at: 0.25, name: 'enrage', enter() { this.interrupt(this.roar(true)); } },
    ];
  }

  /** Thick duster: 15% less damage from everything (tuned so a real player needs ~90-120 s at starting stats). */
  damageMultiplier() { return 0.85; }
  attackDelay() { return [1.3, 1.0, 0.8, 0.5][Math.min(3, this.phase)] * (this.enraged ? 0.85 : 1); }

  // ------------------------------------------------------------------------------------------------ helpers
  ai(dt) { this.dt = dt; super.ai(dt); }
  faceP() { if (this.sprite && this.player) this.sprite.setFlipX(this.player.x > this.x); }
  get spd() { return this.speed * (this.enraged ? 1.3 : 1); }
  onWallHit() { this.strafe *= -1; }

  /** Replace the running attack (phase change). Releases everything the old attack may hold. */
  interrupt(gen) {
    this.cancelAttack();
    this.gen = gen; this.wait = 0;
    this.scene.bullets.enemy.clear();
  }
  cancelAttack() {
    this.release();
    this.warn.clear(); this.rope.clear();
    this.pose = ''; this.setPose('move');
  }
  release() {
    if (this.pulling) { this.pulling = false; const p = this.player; if (p) p.locked = false; }
  }

  /** End of a ray from (x,y) along angle: stops at walls / blocking tiles / maxLen. */
  rayEnd(x, y, a, maxLen, step = 20) {
    const room = this.scene.room;
    let d = 0;
    const c = Math.cos(a), s = Math.sin(a);
    while (d < maxLen) {
      const nx = x + c * (d + step), ny = y + s * (d + step);
      if (nx < ROOM.x + 6 || nx > ROOM.right - 6 || ny < ROOM.y + 6 || ny > ROOM.bottom - 6) break;
      if (room && room.bulletBlock(nx, ny, 8)) break;
      d += step;
    }
    return { x: x + c * d, y: y + s * d, len: d };
  }

  handPos(a, side = 0) { return { x: this.x + Math.cos(a) * 54 - Math.sin(a) * side, y: this.y + Math.sin(a) * 40 + Math.cos(a) * side * 0.4 }; }
  muzzleFx(a, side = 0) {
    const h = this.handPos(a, side);
    this.scene.fx.muzzle(h.x + Math.cos(a) * 18, h.y - 44 + Math.sin(a) * 6, a, 0.9);
  }
  fireShot(a, o = {}) {
    const h = this.handPos(a, o.side || 0);
    const b = this.scene.bullets.enemy.fire({ x: h.x, y: h.y, angle: a, speed: o.speed ?? 400, damage: 1, kind: 'enemy', ...o.b });
    this.muzzleFx(a, o.side || 0);
    Sfx.play('shoot', { vol: 0.55, rate: (o.rate ?? 0.75) + Math.random() * 0.12, gap: 0.03 });
    return b;
  }

  // ------------------------------------------------------------------------------------------------ movement
  moveBehaviour(dt) {
    this.faceP();
    this.walk(dt, this.enraged ? 300 : 360, 1);
  }
  /** Keep ~`want` px from the player, circling, drifting off walls. `k` scales speed. */
  walk(dt, want, k) {
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = rv(1.4, 3); }
    const a = this.angleToPlayer(), d = this.distToPlayer();
    let fx = 0, fy = 0;
    if (d > want + 50) { fx = Math.cos(a); fy = Math.sin(a); } else if (d < want - 90) { fx = -Math.cos(a); fy = -Math.sin(a); }
    fx += -Math.sin(a) * this.strafe * 0.7; fy += Math.cos(a) * this.strafe * 0.7;
    const m = 150;
    if (this.x < ROOM.x + m) fx += (ROOM.x + m - this.x) / m * 1.6;
    if (this.x > ROOM.right - m) fx -= (this.x - (ROOM.right - m)) / m * 1.6;
    if (this.y < ROOM.y + m) fy += (ROOM.y + m - this.y) / m * 1.6;
    if (this.y > ROOM.bottom - m) fy -= (this.y - (ROOM.bottom - m)) / m * 1.6;
    const l = Math.hypot(fx, fy);
    if (l > 0.01) { this.vx = fx / l * this.spd * k; this.vy = fy / l * this.spd * k; } else this.stop();
  }

  // ------------------------------------------------------------------------------------------------ ATTACK: quick-draw
  *atkQuickDraw() {
    const volleys = this.enraged ? 3 : 2;
    for (let v = 0; v < volleys; v++) {
      this.stop();
      this.atkFrame(0);
      Sfx.play('gun_cock', { vol: 0.7, rate: 0.95 + v * 0.1 });
      const track = v === 0 ? 0.5 : 0.4;
      let t = 0, locked = null;
      while (t < track) {
        this.stop(); this.faceP();
        if (locked == null && track - t <= 0.2) { locked = this.angleToPlayer(); Sfx.play('gun_cock', { vol: 0.4, rate: 1.4 }); }
        const a = locked ?? this.angleToPlayer();
        const h = this.handPos(a);
        const e = this.rayEnd(h.x, h.y, a, 900);
        const g = this.warn.clear();
        g.lineStyle(locked == null ? 4 : 9, locked == null ? 0xffa040 : 0xff3a1a, locked == null ? 0.35 + 0.4 * t / track : 0.85);
        g.lineBetween(h.x, h.y - 30, e.x, e.y - 30);
        t += this.dt;
        yield 0;
      }
      this.warn.clear();
      const a = locked;
      this.atkFrame(1);
      for (let i = 0; i < 3; i++) {
        this.fireShot(a, { speed: 430 });
        if (this.enraged && i === 2) { this.fireShot(a + rad(16), { speed: 400 }); this.fireShot(a - rad(16), { speed: 400 }); }
        this.scene.fx.shake(0.004, 90);
        yield 0.11;
      }
      yield 0.2;
      if (v < volleys - 1) { this.setPose('move'); yield 0.15; }
    }
    yield 0.25;
  }

  // ------------------------------------------------------------------------------------------------ ATTACK: lasso
  *atkLasso() {
    this.stop();
    this.atkFrame(2); this.pulse(0.85);
    Sfx.play('lasso_swish', { vol: 0.8 });
    const p = this.player;
    const track = 0.55, hold = 0.3;
    let t = 0, a = this.angleToPlayer(), lockedAt = null;
    const half = NOOSE_R + p.hurtRadius * 0.6;
    while (t < track + hold) {
      this.stop(); this.faceP();
      if (t < track) a = this.angleToPlayer();
      else if (lockedAt == null) { lockedAt = t; Sfx.play('gun_cock', { vol: 0.5, rate: 0.7 }); }
      const h = this.handPos(a);
      const e = this.rayEnd(h.x, h.y, a, LASSO_RANGE);
      const locked = lockedAt != null;
      const g = this.warn.clear();
      const nx = -Math.sin(a) * half, ny = Math.cos(a) * half;
      g.fillStyle(locked ? 0xff3a1a : 0xffa040, locked ? 0.28 + 0.12 * Math.sin(t * 40) : 0.14);
      g.fillPoints([{ x: h.x + nx, y: h.y + ny }, { x: e.x + nx, y: e.y + ny }, { x: e.x - nx, y: e.y - ny }, { x: h.x - nx, y: h.y - ny }], true);
      g.lineStyle(3, locked ? 0xff3a1a : 0xffa040, locked ? 0.9 : 0.5);
      g.lineBetween(h.x + nx, h.y + ny, e.x + nx, e.y + ny); g.lineBetween(h.x - nx, h.y - ny, e.x - nx, e.y - ny);
      t += this.dt;
      yield 0;
    }
    this.warn.clear();

    // --- throw
    Sfx.play('whip_crack', { vol: 0.9, rate: 1.05 });
    this.atkFrame(2);
    const start = this.handPos(a);
    const maxLen = this.rayEnd(start.x, start.y, a, LASSO_RANGE).len;
    let d = 0, caught = false;
    while (d < maxLen) {
      const nd = Math.min(maxLen, d + NOOSE_SPEED * this.dt);
      // swept test against the player
      const ax = start.x + Math.cos(a) * d, ay = start.y + Math.sin(a) * d, bx = start.x + Math.cos(a) * nd, by = start.y + Math.sin(a) * nd;
      const hit = Phaser.Geom.Intersects.LineToCircle(new Phaser.Geom.Line(ax, ay, bx, by), new Phaser.Geom.Circle(p.x, p.y, NOOSE_R + p.hurtRadius * 0.6));
      d = nd;
      this.drawRope(start.x, start.y, start.x + Math.cos(a) * d, start.y + Math.sin(a) * d);
      if (hit && !p.dead && !(p.rolling && p.rollT > 0) && p.entryInv <= 0) { caught = true; break; }
      yield 0;
    }

    if (!caught) {
      // whiffed (or rolled through): rope snaps back, Grimm is open for a moment
      let r = 0;
      while (r < 0.22) {
        r += this.dt;
        const k = 1 - Math.min(1, r / 0.22);
        this.drawRope(start.x, start.y, start.x + Math.cos(a) * d * k, start.y + Math.sin(a) * d * k);
        yield 0;
      }
      this.rope.clear();
      yield 0.5;
      return;
    }

    // --- pull
    this.pulling = true;
    p.locked = true; p.rolling = false;
    this.scene.fx.text(p.x, p.y - 80, 'LASSOED!', { color: '#e8a33a', size: 26 });
    this.scene.fx.shake(0.008, 200);
    Sfx.play('whip_crack', { vol: 0.8, rate: 0.8 });
    this.atkFrame(2);
    const stopD = this.radius + p.radius + 22;
    let pt = 0;
    while (pt < 0.55 && !p.dead) {
      const dx = this.x - p.x, dy = this.y - p.y, dist = Math.hypot(dx, dy);
      if (dist <= stopD) break;
      const step = Math.min(1500 * this.dt, dist - stopD);
      p.vx = p.vy = 0;
      p.moveBy(dx / dist * step, dy / dist * step);
      p.syncVisual();
      this.stop();
      const h = this.handPos(Math.atan2(p.y - this.y, p.x - this.x));
      this.drawRope(h.x, h.y, p.x, p.y);
      pt += this.dt;
      yield 0;
    }
    this.release();
    this.rope.clear();
    this.scene.fx.dust(p.x, p.footY, 0.9);

    // --- slam
    this.atkFrame(2); this.pulse(0.5);
    this.scene.fx.warnCircle(this.x, this.y, SLAM_R, 0.5, 0xff3a1a);
    Sfx.play('gun_cock', { vol: 0.6, rate: 0.6 });
    yield 0.5;
    const s = this.scene;
    s.fx.shake(0.02, 320); s.fx.hitStop(60);
    Sfx.play('explosion', { vol: 0.7, rate: 0.75 });
    s.fx.burst(this.x, this.y + 10, { color: [0xc9a36a, 0x8a6a3a, 0x6b4423], count: 24, speed: [200, 420], life: [300, 600], scale: [2, 4] });
    s.fx.dust(this.x, this.footY, 2.4);
    this.atkFrame(1);
    if (!p.dead && Math.hypot(p.x - this.x, p.y - this.y) < SLAM_R + p.hurtRadius * 0.5) p.damage(2, { x: this.x, y: this.y, enemy: this, enemyName: 'Marshal Grimm', kind: 'slam' });
    yield 0.7;
  }
  drawRope(x1, y1, x2, y2) {
    const g = this.rope.clear();
    const dy = 40;
    g.lineStyle(7, 0x15100a, 1); g.lineBetween(x1, y1 - dy, x2, y2 - dy);
    g.lineStyle(4, 0xc9a36a, 1); g.lineBetween(x1, y1 - dy, x2, y2 - dy);
    g.lineStyle(9, 0x15100a, 1); g.strokeCircle(x2, y2 - dy, 24);
    g.lineStyle(5, 0xd9b77a, 1); g.strokeCircle(x2, y2 - dy, 24);
  }

  // ------------------------------------------------------------------------------------------------ ATTACK: dynamite volley
  *atkDynamite() {
    this.stop();
    const p = this.player;
    const n = this.enraged ? 5 : this.phase >= 1 ? 4 : 3;
    // first stick lands on the player's (slightly led) position, the rest ring around it
    const clampX = (x) => Math.max(ROOM.x + 80, Math.min(ROOM.right - 80, x));
    const clampY = (y) => Math.max(ROOM.y + 80, Math.min(ROOM.bottom - 80, y));
    const spots = [{ x: clampX(p.x + p.vx * 0.3), y: clampY(p.y + p.vy * 0.3) }];
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < n - 1 && spots.length < n; i++) {
      const a = a0 + (i / (n - 1)) * Math.PI * 2;
      const c = { x: clampX(spots[0].x + Math.cos(a) * 280), y: clampY(spots[0].y + Math.sin(a) * 250) };
      if (spots.every((q) => Math.hypot(q.x - c.x, q.y - c.y) > STICK_R * 2 + 30)) spots.push(c); // never overlap / chain
    }
    this.atkFrame(3); this.pulse(0.4);
    Sfx.play('lasso_swish', { vol: 0.5, rate: 1.3 });
    yield 0.45;
    for (const q of spots) {
      this.faceP();
      this.atkFrame(3);
      const flight = 0.7, fuse = 0.9;
      const dyn = new Dynamite(this.scene, q.x, q.y, { from: { x: this.x, y: this.y - 60 }, flight, fuse, radius: STICK_R, playerDamage: 2, hurtEnemies: false });
      this.sticks.push(dyn);
      this.scene.fx.warnCircle(q.x, q.y, STICK_R, flight + fuse, 0xff5a2a);
      Sfx.play('whip_crack', { vol: 0.35, rate: 1.5, gap: 0.05 });
      this.pulse(0.15);
      yield 0.3;
    }
    this.atkFrame(3);
    yield 0.5;
    this.sticks = this.sticks.filter((d) => d.alive);
  }

  // ------------------------------------------------------------------------------------------------ ATTACK: spinning radial bursts (phase 2+)
  *atkSpin() {
    this.stop();
    this.atkFrame(0); this.pulse(0.55);
    Sfx.play('skeleton_rattle', { vol: 0.6 });
    Sfx.play('gun_cock', { vol: 0.5, rate: 1.2 });
    yield 0.55;
    const rings = this.enraged ? 6 : 5;
    const gap = this.enraged ? 0.55 : 0.6;
    let off = Math.random() * 45;
    for (let i = 0; i < rings; i++) {
      this.atkFrame(i % 2 ? 0 : 1);
      this.faceP();
      const B = this.scene.bullets.enemy;
      const mk = (ox, o) => B.ring({ x: this.x + ox, y: this.y, speed: 235, damage: 1, kind: 'enemy' }, 8, o);
      if (this.enraged) { mk(-38, off); mk(38, off + 22.5); } else mk(0, off);
      off += this.enraged ? 13 : 17;
      Sfx.play('shoot', { vol: 0.5, rate: 0.6 + Math.random() * 0.1, gap: 0.02 });
      this.scene.fx.muzzle(this.x - 50, this.y - 50, Math.PI + rv(-0.5, 0.5), 0.8);
      this.scene.fx.muzzle(this.x + 50, this.y - 50, rv(-0.5, 0.5), 0.8);
      // walk while spinning
      let t = 0;
      while (t < gap) { this.walk(this.dt, 330, 0.6); this.faceP(); t += this.dt; yield 0; }
    }
    this.stop();
    yield 0.3;
  }

  // ------------------------------------------------------------------------------------------------ ATTACK: summon (phase 2)
  *atkSummon() {
    if (this.scene.enemies.filter((e) => e !== this && e.alive && e.id === 'ghost').length >= 2) { yield* this.atkQuickDraw(); return; }
    yield* this.roar(false);
  }

  /** Phase-change / summon roar: arm up, shake, then (phase 2) ghost deputies rise; (enrage) red aura. */
  *roar(enrage) {
    this.stop();
    this.atkFrame(2); this.pulse(1.0);
    Sfx.play('boss_intro', { vol: 0.8, rate: 0.85 });
    Sfx.play('ghost_wail', { vol: 0.7, rate: 0.7 });
    this.scene.fx.shake(0.008, 900);
    this.scene.fx.warnCircle(this.x, this.y, 170, 1.0, 0xb070ff);
    yield 1.0;
    if (enrage) {
      this.enraged = true;
      this.cursed = true; this.refreshTint(); // red tint via the cursed path
      this.aura = this.scene.add.image(this.x, this.y, 'glow').setTint(0xff2a1a).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.shadows + 4).setAlpha(0.55);
      this.aura.setScale((this.radius * 4.2) / 128);
      this.scene.fx.text(this.x, this.y - 190, 'ENRAGED', { color: '#ff5a3a', size: 34 });
    } else {
      const ghosts = this.spawnAdds('ghost', 2, { radius: 230 });
      Sfx.play('spawn', { vol: 0.8 });
      this.scene.fx.text(this.x, this.y - 190, 'DEPUTIES!', { color: '#b8a0ff', size: 30 });
      this.deputies = ghosts;
    }
    this.scene.fx.flash(0xb070ff, 0.25);
    yield 0.4;
  }

  // ------------------------------------------------------------------------------------------------ lifecycle
  die(info = {}) {
    if (this.dying) return;
    this.cancelAttack();
    for (const d of this.sticks) if (d.alive) { d.destroy(); const i = this.scene.dynamites.indexOf(d); if (i >= 0) this.scene.dynamites.splice(i, 1); }
    this.sticks.length = 0;
    if (this.aura) { this.aura.destroy(); this.aura = null; }
    super.die(info);
  }
  destroy() {
    this.release();
    for (const g of [this.warn, this.rope]) if (g && g.scene) g.destroy();
    super.destroy();
  }
}

registerBoss('grimm', Grimm, { hp: 420, r: 62, name: 'MARSHAL GRIMM', title: 'The Law Never Sleeps', speed: 115, scale: 0.9, hitR: 74, foot: 50 });
