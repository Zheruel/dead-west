// MiniBase: shared kit of the six champion-room mini-bosses (EVENTS s4.3): ol_fury, hangman, motherlode, ash_deacon, stoker, head_bouncer.
// A MiniBoss whose attacks are generator functions like every boss (`addAttack` + `yield seconds`), plus the pieces they all need:
//   * seeded attack picking (`subRng('mini', id, floor)`, never Math.random for outcomes),
//   * `zone()`  a timed ground circle (GroundHaz telegraph -> landing -> optional damage / fire patch),
//   * `sweep()` a row sweeper (minecart, mugs): red band telegraph, then a body crosses the room,
//   * `dash()`  a locked-direction charge that ends on a wall, an obstacle or max distance,
//   * `lockLine()` / cone drawing on one shared Graphics (tracking aim lines, steam cone),
//   * a stun window (`stunT`, x1.2 damage) with a star trail, phase-change roar that cancels everything cleanly, fear/stun immunity.
// Subclass: override `build()` (addAttack calls, fields), `enterPhase2()`, optionally `moveBehaviour(dt)`, `onCancel()`, `damageMultiplier()`.
// Everything here degrades without art: code-drawn textures (`mini_mug`, `mini_stool`) are generated on demand.
import MiniBoss from '../MiniBoss.js';
import { GroundHaz } from '../../systems/GroundHaz.js';
import { Sfx } from '../../core/Audio.js';
import { subRng } from '../../core/rng.js';
import { ROOM, TILE, COLS, ROWS, DEPTH, actorDepth } from '../../config.js';

export const RED = 0xd63a2a;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;
const STUN_MULT = 1.2; // damage multiplier while the mini is stunned / venting
const WALL = 70; // ground positions of zones stay this far inside the room edge
const TOP_LIMIT = 300; // minis never stand above this y (their sprites are 192 px tall and the HUD covers y < 136)

/** Generate (once per game) the small code-drawn props: a beer mug and a bar stool. */
export function ensureMiniTextures(scene) {
  const tx = scene.textures;
  if (!tx.exists('mini_mug')) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2a1a10, 1).fillRoundedRect(4, 8, 36, 44, 6);
    g.fillStyle(0xe0a830, 1).fillRoundedRect(7, 14, 30, 36, 5);
    g.fillStyle(0xfff4d0, 1).fillRoundedRect(6, 6, 32, 12, 6);
    g.lineStyle(6, 0x2a1a10, 1).strokeRoundedRect(38, 18, 14, 24, 6);
    g.lineStyle(3, 0xe0a830, 1).strokeRoundedRect(38, 18, 14, 24, 6);
    g.generateTexture('mini_mug', 56, 56);
    g.destroy();
  }
  if (!tx.exists('mini_noose')) { // hangman: hanging rope ending in a loop (origin bottom)
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.lineStyle(9, 0x2a1a10, 1).lineBetween(22, 0, 22, 150).strokeCircle(22, 172, 20);
    g.lineStyle(5, 0xb8945a, 1).lineBetween(22, 0, 22, 150).strokeCircle(22, 172, 20);
    g.generateTexture('mini_noose', 44, 194);
    g.destroy();
  }
  if (!tx.exists('mini_grate')) { // stoker: floor grate of the boiler vents
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x14100e, 1).fillEllipse(48, 30, 92, 54);
    g.lineStyle(4, 0x6a6e78, 1).strokeEllipse(48, 30, 88, 50);
    g.lineStyle(4, 0x3a3e48, 1);
    for (let i = -3; i <= 3; i++) g.lineBetween(48 + i * 11, 10, 48 + i * 11, 50);
    g.generateTexture('mini_grate', 96, 60);
    g.destroy();
  }
  if (!tx.exists('mini_stool')) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2a1a10, 1).fillRoundedRect(2, 2, 44, 16, 6);
    g.fillStyle(0x8a5a2a, 1).fillRoundedRect(5, 4, 38, 11, 5);
    g.lineStyle(5, 0x2a1a10, 1).lineBetween(10, 16, 6, 42).lineBetween(38, 16, 42, 42).lineBetween(24, 16, 24, 44);
    g.lineStyle(2, 0x8a5a2a, 1).lineBetween(10, 16, 6, 42).lineBetween(38, 16, 42, 42).lineBetween(24, 16, 24, 44);
    g.generateTexture('mini_stool', 48, 48);
    g.destroy();
  }
}

export default class MiniBase extends MiniBoss {
  /** Boss.init calls this once; MiniBoss's generic fan + ring kit is deliberately NOT kept. */
  setup(opts) {
    const s = this.scene;
    this.tags = [];
    this.rng = subRng('mini', this.id, this.floor);
    this.marks = []; // cancellable handles: GroundHaz hazards, Fx warn shapes, bullet spirals
    this.sweeps = []; // live row sweepers
    this.stunT = 0;
    this.stunFx = 0;
    this.atkAge = 0; // seconds since the current attack was picked (QA: first damaging frame audit)
    this.baseContact = this.meta.contactDamage ?? 1;
    this.bonk = false; // set by onWallHit (dash end)
    this.lock = null; // {x, y, a, len, w, alpha, color}: tracking aim line drawn on `g`
    this.cone = null; // {x, y, a, half, len, alpha, color}: steam cone
    this.gDirty = false;
    this.g = null;
    this.stunned = false;
    this.phases = [{ at: 0.5, name: 'phase2', enter: () => this.roar() }];
    this.idleT = 1.4;
    ensureMiniTextures(s);
    this.build(opts);
  }

  /** Subclass hook: `this.addAttack(name, fn, {weight, minPhase, maxPhase})` and per-mini fields. */
  build() {}

  get p2() { return this.phase >= 1; }
  attackDelay() { return this.cd(this.phase > 0 ? 1.0 : 1.4); }
  applyStatus(name, o) { if (name === 'fear' || name === 'stun') return; super.applyStatus(name, o); }
  hurt(dmg, info = {}) {
    if (info.dot && this.invulnerable) return; // poison / burn never tick through the intro or a dissolve
    super.hurt(dmg, info);
  }
  damageMultiplier() { return this.stunT > 0 ? STUN_MULT : 1; }
  onWallHit() { this.bonk = true; }

  // ------------------------------------------------------------------------------------------ scheduler
  /** Seeded weighted pick (Boss.startAttack uses Math.random). */
  startAttack() {
    this.stop();
    const cands = this.attacks.filter((a) => a.minPhase <= this.phase && a.maxPhase >= this.phase);
    if (!cands.length) { this.idleT = 1; return; }
    let pool = cands.filter((a) => a.name !== this.lastAttack);
    if (!pool.length) pool = cands;
    let total = 0;
    for (const a of pool) total += a.weight;
    let r = this.rng.next() * total;
    let pick = pool[0];
    for (const a of pool) { r -= a.weight; if (r <= 0) { pick = a; break; } }
    this.lastAttack = pick.name;
    this.atkAge = 0;
    this.bonk = false;
    this.gen = pick.fn.call(this);
    this.wait = 0;
  }
  /** Force one attack by name (QA / audits): cancels whatever is running first. */
  forceAttack(name) {
    const a = this.attacks.find((x) => x.name === name);
    if (!a) return false;
    this.cancelAttack();
    this.lastAttack = name;
    this.atkAge = 0;
    this.gen = a.fn.call(this);
    this.wait = 0;
    return true;
  }

  /** Stop and forget everything the running attack owns (phase change, death, room exit). */
  cancelAttack() {
    this.stop();
    if (this.gen) { try { this.gen.return(); } catch (e) { /* generator already finished */ } this.gen = null; }
    this.wait = 0;
    for (const m of this.marks) { if (m.h.cancel) m.h.cancel(); else if (m.h.destroy) m.h.destroy(); }
    this.marks.length = 0;
    for (const w of this.sweeps) this.killSweep(w);
    this.sweeps.length = 0;
    this.lock = null; this.cone = null;
    this.contactDamage = this.baseContact;
    this.invulnerable = false;
    this.targetable = true;
    this.flying = false;
    this.alphaOverride = undefined;
    this.stunT = 0;
    if (this.sprite) this.sprite.setAlpha(1);
    this.onCancel();
  }
  /** Subclass hook: reset per-attack fields (speed overrides, grate marks ...). */
  onCancel() {}

  /** Phase change: cancel the running attack, clear bullets, roar 0.9 s, then the subclass change. Fires once (Boss.onHit advances `phase`). */
  roar() {
    const s = this.scene;
    this.cancelAttack();
    s.bullets.enemy.clear();
    this.gen = this.phaseGen();
    this.wait = 0;
    s.fx.shake(0.008, 500);
    Sfx.play('bull_roar', { vol: 0.5, rate: 1.1 });
  }
  *phaseGen() {
    this.atkFrame(0);
    this.pulse(0.9);
    this.scene.fx.ringPulse(this.x, this.y, 0xe0a040, 220, 700, 0.5);
    yield 0.9;
    this.enterPhase2();
    yield 0.1;
  }
  enterPhase2() {}

  // ------------------------------------------------------------------------------------------ tracked handles
  track(h, life = 3) {
    if (!h) return h;
    const now = this.scene.time.now, m = this.marks;
    if (m.length > 20) for (let i = m.length - 1; i >= 0; i--) if (m[i].end < now || m[i].h.done) m.splice(i, 1);
    m.push({ h, end: now + life * 1000 });
    return h;
  }

  /** Random room position `pad` px from the walls, at least `minD` from (ax, ay). Seeded. */
  spot(ax, ay, minD = 0, pad = 100) {
    let x = ROOM.cx, y = ROOM.cy;
    for (let i = 0; i < 8; i++) {
      x = this.rng.float(ROOM.x + pad, ROOM.right - pad);
      y = this.rng.float(ROOM.y + pad, ROOM.bottom - pad);
      if (Math.hypot(x - ax, y - ay) >= minD) break;
    }
    return { x, y };
  }
  clampIn(x, y, pad = WALL) { return { x: clamp(x, ROOM.x + pad, ROOM.right - pad), y: clamp(y, ROOM.y + pad, ROOM.bottom - pad) }; }
  /** Player position `t` seconds ahead at the current velocity (clamped into the room). */
  predict(t) {
    const p = this.player;
    return this.clampIn(p.x + (p.vx || 0) * t, p.y + (p.vy || 0) * t);
  }

  // ------------------------------------------------------------------------------------------ ground zones
  /**
   * Timed ground circle. o: {tell (s), dmg (units, 0 = visual only), kind (damage kind), color, fall, fallDur, fire:{r,dur}, sfx, shake, decal, burstColors,
   * onLand(hz, landed)}. Damage is dealt once at landing if the player overlaps (roll i-frames dodge it).
   */
  zone(x, y, r, o = {}) {
    const s = this.scene, self = this;
    const dmg = o.dmg ?? 1, kind = o.kind || 'boss';
    const h = GroundHaz.of(s).circle({
      x, y, r, tell: o.tell ?? 1.0, active: 0.2, dmg: 0, kind, color: o.color ?? RED, style: o.style || 'disc',
      fx: o.fx, fall: o.fall, fallDur: o.fallDur, fallHeight: o.fallHeight, fallLift: o.fallLift, fire: o.fire, sfx: o.sfx, shake: o.shake, decal: o.decal, burstColors: o.burstColors, dust: o.dust,
      onLand(hz) {
        if (self.dying || !self.sprite) return;
        let landed = false;
        const p = s.player;
        if (dmg > 0 && p && !p.dead) {
          const rr = r + p.hurtRadius * 0.5;
          if ((p.x - x) ** 2 + (p.y - y) ** 2 < rr * rr) landed = p.damage(dmg, { x, y, kind, enemy: self, enemyName: self.id });
        }
        if (o.onLand) o.onLand(hz, landed);
      },
    });
    this.track(h, (o.tell ?? 1.0) + 1);
    return h;
  }

  /** Generator helper: `yield* this.hold(sec, each)` waits `sec` s of attack time, calling `each(elapsed)` every frame (tracking lines, steering). */
  *hold(sec, each) {
    const t0 = this.atkAge;
    yield () => { const e = this.atkAge - t0; if (each) each(e); return e >= sec; };
  }

  // ------------------------------------------------------------------------------------------ dash
  /**
   * Generator helper: `yield* this.dash(angle, speed, maxDist, {dmg})`. Moves along a locked angle every frame (stun/knockback cannot stall it) until a wall or
   * obstacle is hit, `maxDist` is covered or the player is hit (`o.stopOnHit`). Sets contact damage for the run and restores it. Returns 'wall' | 'dist' | 'hit'.
   */
  *dash(a, speed, maxDist, o = {}) {
    const x0 = this.x, y0 = this.y, h0 = this.hitsTaken;
    let end = 'dist', stall = 0, lx = x0, ly = y0;
    this.bonk = false;
    this.contactDamage = o.dmg ?? 2;
    yield () => {
      this.moveAngle(a, speed);
      if (o.each) o.each();
      if (this.bonk) { end = 'wall'; return true; }
      if (Math.hypot(this.x - x0, this.y - y0) >= maxDist) return true;
      if (o.stopOnHit && this.hitsTaken > h0) { end = 'hit'; return true; }
      // stuck against something the collision did not report: never stall the fight
      if (Math.hypot(this.x - lx, this.y - ly) < 0.5) { if (++stall > 6) { end = 'wall'; return true; } } else stall = 0;
      lx = this.x; ly = this.y;
      return false;
    };
    this.stop();
    this.contactDamage = this.baseContact;
    return end;
  }

  // ------------------------------------------------------------------------------------------ sweepers
  /**
   * Row sweeper (minecart, mugs): `tell` s of red band across tile row `row`, then a body crosses the room at `speed`.
   * o: {row, dir (1 = left to right), speed, w (band height), len (body length), dmg, kind, tell, make(scene) -> GameObject, color, breaks, sfx}
   */
  sweep(o) {
    const s = this.scene;
    const y = ROOM.y + o.row * TILE + TILE / 2;
    const dir = o.dir < 0 ? -1 : 1;
    const w = { row: o.row, y, dir, speed: o.speed, w: o.w ?? 84, len: o.len ?? 60, dmg: o.dmg ?? 1, kind: o.kind || 'boss', tell: o.tell ?? 1.0, t: 0, state: 'tell',
      x: dir > 0 ? ROOM.x - w0(o) : ROOM.right + w0(o), xEnd: dir > 0 ? ROOM.right + w0(o) : ROOM.x - w0(o), make: o.make, breaks: !!o.breaks, sfx: o.sfx, spr: null, hit: false, warn: null };
    w.warn = s.fx.warnLine(ROOM.x, y, ROOM.right, y, w.w, w.tell, o.color ?? RED);
    this.sweeps.push(w);
    return w;
  }
  killSweep(w) {
    if (w.spr) { w.spr.destroy(); w.spr = null; }
    if (w.warn) { w.warn.destroy(); w.warn = null; }
    w.state = 'done';
  }
  updateSweeps(dt) {
    const s = this.scene, p = s.player, room = s.room, list = this.sweeps;
    for (let i = list.length - 1; i >= 0; i--) {
      const w = list[i];
      if (w.state === 'tell') {
        w.t += dt;
        if (w.t >= w.tell) {
          w.state = 'run';
          w.warn = null;
          w.spr = w.make ? w.make(s) : null;
          if (w.sfx) Sfx.play(w.sfx.key, w.sfx.opts);
        }
        continue;
      }
      w.x += w.dir * w.speed * dt;
      if (w.spr) { w.spr.setPosition(w.x, w.y + 34); w.spr.setDepth(actorDepth(w.y + 34)); }
      if (!w.hit && p && p.canBeHit() && Math.abs(p.y - w.y) < w.w / 2 + p.hurtRadius * 0.5 && Math.abs(p.x - w.x) < w.len / 2 + p.hurtRadius * 0.5) {
        w.hit = p.damage(w.dmg, { x: w.x - w.dir * 40, y: w.y, kind: w.kind, enemy: this, enemyName: this.id });
      }
      if (w.breaks && room && room.tiles[w.row]) {
        for (let c = 0; c < COLS; c++) {
          const t = room.tiles[w.row][c];
          if (t.type === 'breakable' && !t.broken && Math.abs(t.x - w.x) < w.len / 2 + TILE * 0.4) room.breakTile(t);
        }
      }
      if ((w.dir > 0 && w.x > w.xEnd) || (w.dir < 0 && w.x < w.xEnd)) { this.killSweep(w); list.splice(i, 1); }
    }
  }
  /** Any sweeper still alive (attacks wait on this). */
  sweepsBusy() { return this.sweeps.length > 0; }

  // ------------------------------------------------------------------------------------------ small fx
  stars() {
    this.scene.fx.burst(this.x + this.rng.float(-30, 30), this.y - this.radius * 1.6, { color: [0xffe070, 0xfff0a0], count: 2, speed: [10, 50], life: [400, 600], scale: [1.5, 2.5] });
  }
  /** Stun window: the mini stands vulnerable (x1.2) for `sec`. */
  stun(sec) { this.stunT = Math.max(this.stunT, sec); }
  dustRing(r = 150) {
    const fx = this.scene.fx;
    fx.dustRing(this.x, this.y + 10, r);
    fx.dust(this.x, this.y + 20, 1.6);
  }
  /** Tracking / locked aim line on the shared Graphics (call every frame while aiming; `alpha` 0 hides). */
  lockLine(x, y, a, len, w, alpha = 0.3, color = RED) {
    const l = this.lock || (this.lock = { x: 0, y: 0, a: 0, len: 0, w: 0, alpha: 0, color: 0 });
    l.x = x; l.y = y; l.a = a; l.len = len; l.w = w; l.alpha = alpha; l.color = color;
  }
  clearLine() { this.lock = null; }

  /** Wall-to-wall length of a ray from (x, y) along angle a (minus a margin). */
  rayLen(x, y, a, m = 0) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let t = 1e9;
    if (dx > 1e-4) t = Math.min(t, (ROOM.right - m - x) / dx); else if (dx < -1e-4) t = Math.min(t, (ROOM.x + m - x) / dx);
    if (dy > 1e-4) t = Math.min(t, (ROOM.bottom - m - y) / dy); else if (dy < -1e-4) t = Math.min(t, (ROOM.y + m - y) / dy);
    return Math.max(0, t);
  }

  faceTarget() {}

  // ------------------------------------------------------------------------------------------ frame update
  update(dt) {
    if (this.active && !this.dying) {
      this.atkAge += dt;
      if (this.stunT > 0) {
        this.stunT -= dt;
        this.stunFx -= dt;
        if (this.stunFx <= 0) { this.stunFx = 0.25; this.stars(); }
      }
      if (this.sweeps.length) this.updateSweeps(dt);
    }
    super.update(dt);
    if (this.alive && !this.dying && this.y < TOP_LIMIT) this.y = TOP_LIMIT;
    this.drawOverlay();
  }

  drawOverlay() {
    const l = this.lock, c = this.cone;
    if (!l && !c) {
      if (this.gDirty && this.g) { this.g.clear(); this.gDirty = false; }
      return;
    }
    if (!this.g) {
      this.g = this.scene.add.graphics().setDepth(DEPTH.decals + 6);
      this.g.__noSnap = true;
      this.scene.fx._track(this.g);
      this.pts = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    }
    const g = this.g;
    g.clear();
    this.gDirty = true;
    if (l && l.alpha > 0) {
      const cs = Math.cos(l.a), sn = Math.sin(l.a), nx = -sn * l.w / 2, ny = cs * l.w / 2, ex = l.x + cs * l.len, ey = l.y + sn * l.len, q = this.pts;
      q[0].x = l.x + nx; q[0].y = l.y + ny; q[1].x = ex + nx; q[1].y = ey + ny; q[2].x = ex - nx; q[2].y = ey - ny; q[3].x = l.x - nx; q[3].y = l.y - ny;
      g.fillStyle(l.color, l.alpha).fillPoints(q, true);
      g.lineStyle(2, l.color, Math.min(1, l.alpha * 2.2)).strokePoints(q, true);
    }
    if (c && c.alpha > 0) {
      g.fillStyle(c.color, c.alpha);
      g.slice(c.x, c.y, c.len, c.a - c.half, c.a + c.half, false);
      g.fillPath();
      g.lineStyle(3, c.color, Math.min(1, c.alpha * 2.4));
      g.beginPath(); g.arc(c.x, c.y, c.len, c.a - c.half, c.a + c.half, false); g.strokePath();
    }
  }

  // ------------------------------------------------------------------------------------------ death / teardown
  die(info = {}) {
    if (!this.alive || this.dying) return;
    this.cancelAttack();
    super.die(info);
  }
  destroy() {
    for (const m of this.marks) { if (m.h.cancel) m.h.cancel(); else if (m.h.destroy) m.h.destroy(); }
    this.marks.length = 0;
    for (const w of this.sweeps) this.killSweep(w);
    this.sweeps.length = 0;
    if (this.g) { this.g.destroy(); this.g = null; }
    super.destroy();
  }
}

/** Half body length + margin used to start a sweeper off-screen. */
function w0(o) { return (o.len ?? 60) / 2 + 30; }
export { TAU, ROWS, TILE, ROOM, COLS, DEPTH as DEPTHS };
