// BOSS 4 - EL TORO INFERNAL "Horns of the Furnace" (floor 4, HP 800, r 92, 3 phases). CHAPTER2 s3. Sprites boss_toro_idle / _atk
// (atk: 0 paw / head low, 1 full charge, 2 head up (rear / fire breath), 3 dazed with horns stuck).
//   P0 "Bull Ring"   (100-66 %)  CHARGE (paw, locked lane, wall crash = 2.0 s stun / pillar shatters = 1.0 s stun), FIRE BREATH (sweeping ember
//                                stream, pillars stop it), MAGMA STOMP (disc r260 + 3 eruption circles).
//   P1 "Enrage"      (<66 %)     roar + 2 hellhounds (once); double charge with a fire trail, double-sweep breath, HERD STAMPEDE (3 lanes).
//   P2 "Hellfire Frenzy" (<33 %) triple charge (4 s trail), 5-eruption stomp, 4-lane herd, HELLFIRE LEAP (off-screen, tracking shadow, landing ring).
// Damage windows (damageMultiplier): wall crash x1.4, pillar hit x1.25, leap landing x1.3. Fear / stun immune; fire-tagged (lava, fire patches,
// vents cannot hurt him). Every damaging zone is drawn first: charge lane (>= 0.4 s once locked), breath cone (0.5 s), stomp / eruptions / leap
// disc (0.9 s), herd lanes (1.2 s). A phase change (or death) cancels the running attack, its hazards, lane bodies and shadows cleanly.
// Balance notes vs the doc: breath rear 0.85 s (cone visible 0.5 s instead of 0.35), chained charge pauses 0.6 / 0.55 s (doc 0.5 / 0.45), the charge
// lane is drawn at the real body-contact width (doc 110 px was narrower than the body), aim locks 0.4 s before the charge.
import Boss from '../Boss.js';
import { registerBoss } from '../registry.js';
import { spawnEnemy } from '../../enemies/index.js';
import { GroundHaz } from '../../systems/GroundHaz.js';
import { ToroTel } from '../parts/toroTel.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { subRng } from '../../core/rng.js';
import { ROOM, TILE, COLS, ROWS, DEPTH } from '../../config.js';
import { clamp, rad } from '../../core/util.js';

const NAME = 'El Toro Infernal';
const CHARGE_SPEED = 720;
const TRAIL_STEP = 110;
const BREATH_HALF = rad(35);
const WEIGHTS = [
  { charge: 4, fire_breath: 3, magma_stomp: 2 },
  { charge: 4, fire_breath: 3, magma_stomp: 2, herd_stampede: 2 },
  { charge: 4, fire_breath: 2, magma_stomp: 2, herd_stampede: 3, hellfire_leap: 3 },
];
const DELAYS = [1.4, 1.1, 0.85];

class Toro extends Boss {
  setup() {
    const s = this.scene, room = s.room; // (homeRoom is assigned after the constructor chain)
    this.tags = ['fire'];
    this.rng = subRng('toro', room && room.def ? room.def.seed : 0, s.floorNum || 4);
    this.selfBanner = true; // phase barks are shown here (Cards must not add a second banner)
    this.stunned = 0; this.stunMult = 1; this.stunFx = 0;
    this.charging = false; this.bonk = false; this.hitN = { x: 0, y: 0 };
    this.airborne = false; this.land = 0; // land: seconds of the drop-in animation left
    this.faceAngle = Math.PI / 2;
    this.dtLast = 1 / 60;
    this.gz = []; // GroundHaz handles of the running attack
    this.lns = []; // lane handles of the running stampede
    this.tel = new ToroTel(s);
    this.addAttack('charge', this.atkCharge, { weight: 4 });
    this.addAttack('fire_breath', this.atkFireBreath, { weight: 3 });
    this.addAttack('magma_stomp', this.atkStomp, { weight: 2 });
    this.addAttack('herd_stampede', this.atkHerd, { weight: 2, minPhase: 1 });
    this.addAttack('hellfire_leap', this.atkLeap, { weight: 3, minPhase: 2 });
    this.phases = [
      { at: 0.66, name: 'enrage', enter() { this.interrupt(this.roar(1)); this.invulnerable = true; } },
      { at: 0.33, name: 'frenzy', enter() { this.interrupt(this.roar(2)); this.invulnerable = true; } },
    ];
  }

  attackDelay() { return this.cd(DELAYS[Math.min(2, this.phase)]); }
  applyStatus(name, o) { if (name === 'fear' || name === 'stun' || name === 'frozen') return; super.applyStatus(name, o); }
  slowMult() { return this.charging ? 1 : super.slowMult(); }
  get baseContact() { return this.meta.contactDamage ?? 1; }

  startFight() {
    super.startFight();
    this.idleT = 1.4;
    Sfx.play('bull_snort', { vol: 1 });
  }

  // ------------------------------------------------------------------------------------------ damage windows
  damageMultiplier() { return this.stunned > 0 ? this.stunMult : 1; }
  /** DoT (burn / poison) cannot chip an invulnerable boss (it would skip the off-screen leap and roars). */
  hurt(dmg, info = {}) {
    if (info.dot && (this.invulnerable || this.airborne)) return;
    super.hurt(dmg, info);
  }

  // ------------------------------------------------------------------------------------------ scheduler hooks
  /** Replace the running attack (phase changes). */
  interrupt(gen) { this.resetState(); this.gen = gen; this.wait = 0; }
  resetState() {
    this.cancelHazards();
    this.tel.clear();
    this.charging = false; this.airborne = false; this.land = 0;
    this.stunned = 0; this.stunMult = 1;
    this.invulnerable = false; this.targetable = true;
    this.contactDamage = this.baseContact;
    this.alphaOverride = undefined; this.airHeight = 0;
    if (this.shadow) this.shadow.setAlpha(1);
    this.stop();
  }
  cancelHazards() {
    for (const h of this.gz) h.cancel();
    this.gz.length = 0;
    for (const l of this.lns) if (l.state !== 'off') l.cancel();
    this.lns.length = 0;
  }
  startAttack() {
    this.stop();
    const w = WEIGHTS[Math.min(2, this.phase)];
    const room = this.homeRoom;
    const laneOk = !!(room && room._hz);
    let pool = this.attacks.filter((a) => w[a.name] && a.name !== this.lastAttack && (laneOk || a.name !== 'herd_stampede'));
    if (!pool.length) pool = this.attacks.filter((a) => w[a.name]);
    if (!pool.length) { this.idleT = 1; return; }
    const pick = this.rng.weighted(pool, (a) => w[a.name]);
    this.lastAttack = pick.name;
    this.gen = pick.fn.call(this);
    this.wait = 0;
  }

  ai(dt) {
    this.dtLast = dt;
    this.tel.update(dt);
    if (!this.dying) {
      if (this.stunned > 0) {
        this.stunned -= dt; this.stunFx -= dt;
        if (this.stunFx <= 0) { this.stunFx = 0.2; this.scene.fx.burst(this.x + (this.rng.next() - 0.5) * 90, this.y - 130, { color: [0xffe070, 0xfff0a0], count: 2, speed: [10, 50], life: [400, 600], scale: [1.5, 2.5] }); }
      }
      if (this.land > 0) this.stepLand(dt);
    }
    super.ai(dt);
  }
  onWallHit(nx, ny) { this.bonk = true; this.hitN.x = nx; this.hitN.y = ny; }
  /** Idle: drift back toward the ring centre (he only moves on his own attacks otherwise). */
  moveBehaviour(dt) {
    if (this.stunned > 0 || this.airborne || this.land > 0) { this.stop(); return; }
    const dx = ROOM.cx - this.x, dy = ROOM.cy - this.y;
    if (dx * dx + dy * dy > 200 * 200) this.steerToward(ROOM.cx, ROOM.cy, 120); else this.stop();
  }

  // ------------------------------------------------------------------------------------------ helpers
  hurtPlayerAt(units, x, y) {
    const p = this.player;
    if (p && p.canBeHit()) p.damage(units, { x, y, kind: 'boss', enemyName: NAME });
  }
  /** Timed circle through GroundHaz (telegraph, damage once, optional fire patch). */
  circle(o) {
    const h = GroundHaz.of(this.scene).circle({ kind: 'fire', source: { enemyName: NAME }, ...o });
    if (this.gz.length > 12) this.gz = this.gz.filter((q) => !q.done);
    this.gz.push(h);
    return h;
  }
  /** Ground point (x,y) clamped inside the room and off solid tiles for a body of radius `r`. */
  freeSpot(x, y, r = this.radius) {
    const room = this.scene.room;
    x = clamp(x, ROOM.x + r + 6, ROOM.right - r - 6); y = clamp(y, ROOM.y + r + 6, ROOM.bottom - r - 6);
    if (!room || !room.probe(x, y, r, this)) return { x, y };
    for (let d = 48; d < 420; d += 48) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, px = clamp(x + Math.cos(a) * d, ROOM.x + r + 6, ROOM.right - r - 6), py = clamp(y + Math.sin(a) * d, ROOM.y + r + 6, ROOM.bottom - r - 6);
      if (!room.probe(px, py, r, this)) return { x: px, y: py };
    }
    return { x: ROOM.cx, y: ROOM.cy };
  }
  /** Distance the body would travel from (x,y) along angle a before touching a wall or pillar (drawn as the charge lane). */
  chargeReach(a) {
    const room = this.scene.room, c = Math.cos(a), s = Math.sin(a), r = this.radius;
    let d = 0;
    for (; d < 1700; d += 12) if (room.probe(this.x + c * (d + 12), this.y + s * (d + 12), r, this)) break;
    return d;
  }
  /** Solid pillar tile the boss just ran into (null = a wall). */
  pillarAt(a) {
    const room = this.scene.room, r = this.radius, c = Math.cos(a), s = Math.sin(a);
    let best = null, bd = 1e9;
    const c0 = Math.floor((this.x - ROOM.x) / TILE), r0 = Math.floor((this.y - ROOM.y) / TILE);
    for (let rr = r0 - 2; rr <= r0 + 2; rr++) for (let cc = c0 - 2; cc <= c0 + 2; cc++) {
      if (rr < 0 || cc < 0 || rr >= ROWS || cc >= COLS) continue;
      const t = room.tiles[rr][cc];
      if (!t.solid || t.type !== 'block') continue;
      const dx = t.x - this.x, dy = t.y - this.y;
      if (dx * c + dy * s < 0) continue; // behind
      const qx = clamp(this.x, t.x - TILE / 2, t.x + TILE / 2), qy = clamp(this.y, t.y - TILE / 2, t.y + TILE / 2);
      const d = Math.hypot(this.x - qx, this.y - qy);
      if (d < r + 16 && d < bd) { bd = d; best = t; }
    }
    return best;
  }
  shatterPillar(t) {
    const s = this.scene, fx = s.fx;
    t.solid = false; t.type = 'rubble'; t.broken = true;
    if (t.sprite) { // scorched rubble frame of the floor's obstacle sheet (hidden when that art is missing)
      let ok = false;
      try { if (Assets.has(t.obst)) { t.sprite.setFrame(Assets.frame(t.obst, 'breakable_broken')); ok = true; } } catch (e) { ok = false; }
      if (ok) t.sprite.setDepth(DEPTH.floor); else t.sprite.setVisible(false);
    }
    fx.burst(t.x, t.y - 20, { color: [0x3b2320, 0x6b4a3a, 0xff7a1f], count: 26, speed: [120, 420], life: [300, 700], gravity: 420, scale: [2, 4] });
    fx.dust(t.x, t.y + 10, 1.6);
    fx.decal(t.x, t.y, 'scorch', 0.5);
    const B = s.bullets.enemy;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      B.fire({ x: t.x + Math.cos(a) * 40, y: t.y + Math.sin(a) * 40, angle: a, speed: 260, damage: 1, kind: 'rock', life: 2.4, owner: this });
    }
    Sfx.play('bullet_hit_wall', { vol: 1, rate: 0.5, gap: 0.05 });
  }
  banner(text) {
    const r = this.homeRoom;
    if (r && r.banner && !r.destroyed) r.banner(text, { color: '#ff9a3a', hold: 1200 });
  }
  /** Row indices for a stampede: n lanes, >= 3 free rows, never 3 lanes in a row, always one 2-row safe corridor; favours the player's row. */
  pickRows(n) {
    const p = this.player, pr = clamp(Math.floor((p.y - ROOM.y) / TILE), 0, ROWS - 1);
    const ok = (rows) => {
      const has = (r) => rows.includes(r);
      let pair = false;
      for (let r = 0; r < ROWS; r++) {
        if (has(r) && has(r + 1) && has(r + 2)) return false;
        if (!has(r) && r + 1 < ROWS && !has(r + 1)) pair = true;
      }
      return pair && ROWS - rows.length >= 3;
    };
    for (let tries = 0; tries < 80; tries++) {
      const all = this.rng.shuffle([0, 1, 2, 3, 4, 5, 6]);
      let rows = all.slice(0, n);
      if (this.rng.chance(0.75) && !rows.includes(pr)) rows[0] = pr;
      rows = [...new Set(rows)];
      if (rows.length === n && ok(rows)) return rows.sort((a, b) => a - b);
    }
    return n >= 4 ? [0, 2, 3, 6] : [1, 3, 5];
  }

  // ------------------------------------------------------------------------------------------ attack: charge
  /** Paw + aim tracking, then the locked lane. Returns the locked angle. */
  *chargeWindup(total, lockAt) {
    this.atkFrame(0); this.pulse(total);
    Sfx.play('bull_snort', { vol: 0.9 });
    let a = this.angleToPlayer();
    for (let t = 0; t < lockAt; t += this.dtLast) { a = this.angleToPlayer(); yield 0; }
    this.faceAngle = a;
    const len = this.chargeReach(a) + this.radius * 0.5;
    this.tel.showLine(this.x, this.y, a, len, this.radius * 1.7 + 30, total - lockAt);
    Sfx.play('gun_cock', { vol: 0.6, rate: 0.5 });
    yield total - lockAt;
    return a;
  }

  *atkCharge() {
    const n = this.phase >= 2 ? 3 : this.phase >= 1 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      const a = i === 0 ? yield* this.chargeWindup(0.8, 0.4) : yield* this.chargeWindup(this.phase >= 2 ? 0.55 : 0.6, this.phase >= 2 ? 0.15 : 0.2);
      this.tel.hideLine();
      yield* this.chargeRun(a, last);
      if (this.stunned > 0) { yield this.stunned; break; } // (never chains after a stun)
    }
    this.stunned = 0; this.stunMult = 1;
    this.contactDamage = this.baseContact;
    this.setPose('move');
    yield 0.2;
  }

  *chargeRun(a, last) {
    const s = this.scene, fx = s.fx, room = this.homeRoom;
    this.charging = true; this.bonk = false;
    this.contactDamage = 2;
    this.atkFrame(1);
    Sfx.play('hoof_thunder', { vol: 1, rate: 1.1, gap: 0.1 });
    Sfx.play('dodge_roll', { vol: 0.8, rate: 0.45 });
    const dur = this.phase >= 2 ? 4 : 2;
    let t = 0, trail = 0, dust = 0, px = this.x, py = this.y;
    while (!this.bonk && t < 2.4) {
      this.moveAngle(a, CHARGE_SPEED);
      yield 0;
      const d = Math.hypot(this.x - px, this.y - py);
      px = this.x; py = this.y; t += this.dtLast;
      dust -= this.dtLast;
      if (dust <= 0) { dust = 0.05; fx.dust(this.x - Math.cos(a) * 60, this.y + 44, 1.2); }
      if (this.phase >= 1) {
        trail += d;
        if (trail >= TRAIL_STEP) { trail -= TRAIL_STEP; room.addFire(this.x, this.y + 24, 48, dur, {}); }
      }
    }
    this.stop(); this.charging = false;
    this.contactDamage = this.baseContact;
    const tile = this.bonk ? this.pillarAt(a) : null;
    fx.shake(tile ? 0.02 : 0.03, 380); fx.hitStop(tile ? 60 : 90);
    Sfx.play('explosion', { vol: 0.75, rate: 0.75, gap: 0.05 });
    Sfx.play('bull_roar', { vol: 0.6, rate: 1.2, gap: 0.3 });
    if (tile) {
      this.shatterPillar(tile);
      if (last) { this.stunned = 1.0; this.stunMult = 1.25; }
    } else {
      const hx = this.x + Math.cos(a) * this.radius * 0.8, hy = this.y + Math.sin(a) * this.radius * 0.8;
      fx.burst(hx, hy - 30, { color: [0x8a7a68, 0x3b2320, 0xff7a1f], count: 30, speed: [100, 420], gravity: 400 });
      room.ignite(hx, hy, { r: 50, life: 2, count: 4, spread: 120 });
      if (last) { this.stunned = 2.0; this.stunMult = 1.4; }
    }
    if (last) {
      this.stunFx = 0; this.contactDamage = 0;
      this.atkFrame(3);
      fx.burst(this.x, this.y - 110, { color: [0xffe070, 0xff9a3a], count: 14, speed: [40, 180], life: [400, 800], scale: [2, 3.5], blend: 'ADD' });
    }
    yield 0;
  }

  // ------------------------------------------------------------------------------------------ attack: fire breath
  *atkFireBreath() {
    const fx = this.scene.fx, B = this.scene.bullets.enemy;
    this.atkFrame(2); this.pulse(0.85);
    Sfx.play('bull_snort', { vol: 0.9, rate: 0.9 });
    let a = this.angleToPlayer();
    for (let t = 0; t < 0.35; t += this.dtLast) { a = this.angleToPlayer(); yield 0; }
    this.faceAngle = a;
    const mx = this.x + Math.cos(a) * this.radius * 0.5, my = this.y - 40;
    this.tel.showWedge(this.x, this.y, a, BREATH_HALF, 380, 0.5);
    yield 0.5;
    this.tel.hideWedge();
    const sweeps = this.phase >= 1 ? 2 : 1;
    for (let sw = 0; sw < sweeps; sw++) {
      const dir = sw % 2 === 0 ? 1 : -1;
      const N = 12;
      Sfx.play('fire_whoosh', { vol: 0.9, gap: 0.2 });
      for (let i = 0; i < N; i++) {
        const k = i / (N - 1);
        const ang = a + dir * (-BREATH_HALF + k * 2 * BREATH_HALF) + rad((this.rng.next() - 0.5) * 6);
        B.fire({ x: this.x + Math.cos(ang) * (this.radius * 0.6), y: this.y + Math.sin(ang) * (this.radius * 0.6), angle: ang, speed: 400, damage: 1, kind: 'ember', life: 0.9, owner: this });
        if (i % 3 === 0) fx.burst(mx + Math.cos(ang) * 50, this.y + Math.sin(ang) * 50 - 30, { color: [0xffd060, 0xff7a1f], count: 4, speed: [60, 200], life: [200, 400], scale: [1.5, 3], blend: 'ADD', dir: ang, spread: 20 });
        if (i % 4 === 0) Sfx.play('fire_whoosh', { vol: 0.45, rate: 1.1, gap: 0.3 });
        yield 0.09;
      }
      if (sw + 1 < sweeps) yield 0.4;
    }
    this.setPose('move');
    yield 0.4;
  }

  // ------------------------------------------------------------------------------------------ attack: magma stomp
  *atkStomp() {
    const fx = this.scene.fx;
    this.atkFrame(2); this.pulse(0.9);
    Sfx.play('bull_snort', { vol: 0.9, rate: 0.8 });
    this.circle({ x: this.x, y: this.y, r: 260, tell: 0.9, active: 0.25, dmg: 1, dust: true, shake: false, sfx: 'explosion' });
    yield 0.9;
    this.atkFrame(0);
    fx.shake(0.02, 300); fx.hitStop(60);
    fx.ringPulse(this.x, this.y + 20, 0xff7a1f, 260, 400, 0.8);
    fx.dust(this.x, this.y + 30, 2.4);
    const n = this.phase >= 2 ? 5 : 3, p = this.player;
    const spots = [{ x: p.x, y: p.y }];
    for (let tries = 0; spots.length < n && tries < 80; tries++) {
      const a = this.rng.float(0, Math.PI * 2), d = this.rng.float(90, 300);
      const x = clamp(p.x + Math.cos(a) * d, ROOM.x + 60, ROOM.right - 60), y = clamp(p.y + Math.sin(a) * d, ROOM.y + 60, ROOM.bottom - 60);
      if (spots.every((q) => Math.hypot(q.x - x, q.y - y) > 120)) spots.push({ x, y });
    }
    Sfx.play('lava_bubble', { vol: 0.9, gap: 0.3 });
    for (const q of spots) this.circle({ x: q.x, y: q.y, r: 70, tell: 0.9, active: 0.25, dmg: 1, fire: { r: 70, dur: 2 }, burstColors: [0xff7a1f, 0xffd060, 0x3b2320], sfx: 'vent_erupt' });
    yield 0.5;
    this.setPose('move');
    yield 0.75;
  }

  // ------------------------------------------------------------------------------------------ attack: herd stampede
  *atkHerd() {
    const room = this.homeRoom, n = this.phase >= 2 ? 4 : 3;
    this.atkFrame(0); this.pulse(1.2);
    Sfx.play('bull_roar', { vol: 0.8, rate: 1.1, gap: 0.5 });
    const rows = this.pickRows(n);
    let dir = this.rng.sign();
    this.lns.length = 0;
    for (const r of rows) {
      const l = room.spawnLane({ axis: 'h', index: r, dir, kind: 'herd' });
      if (l) this.lns.push(l);
      dir = -dir;
    }
    if (!this.lns.length) { this.setPose('move'); return; }
    yield 1.2; // telegraph
    let guard = 0;
    while (this.lns.some((l) => l.state !== 'off') && guard < 8) { guard += 0.1; yield 0.1; }
    this.lns.length = 0;
    this.setPose('move');
    yield 0.3;
  }

  // ------------------------------------------------------------------------------------------ attack: hellfire leap (P2)
  *atkLeap() {
    const s = this.scene, fx = s.fx, p = this.player;
    this.atkFrame(0); this.pulse(0.35);
    Sfx.play('bull_roar', { vol: 0.9, rate: 1.0, gap: 0.5 });
    yield 0.25;
    // up and out of the frame (0.6 s, invulnerable, harmless)
    this.airborne = true; this.invulnerable = true; this.targetable = false; this.contactDamage = 0;
    this.atkFrame(1);
    fx.dust(this.x, this.y + 40, 2);
    fx.shake(0.012, 250);
    Sfx.play('explosion', { vol: 0.5, rate: 1.2, gap: 0.1 });
    for (let t = 0; t < 0.6; t += this.dtLast) {
      const k = Math.min(1, t / 0.6);
      this.airHeight = k * k * 900;
      if (this.shadow) this.shadow.setAlpha(1 - k);
      yield 0;
    }
    this.alphaOverride = 0; this.airHeight = 900;
    if (this.shadow) this.shadow.setAlpha(0);
    // tracking shadow: 1.0 s at 300 px/s
    let sp = this.freeSpot(this.x, this.y);
    this.tel.showShadow(sp.x, sp.y, 190);
    for (let t = 0; t < 1.0; t += this.dtLast) {
      const tgt = this.freeSpot(p.x, p.y), dx = tgt.x - sp.x, dy = tgt.y - sp.y, d = Math.hypot(dx, dy), m = Math.min(d, 300 * this.dtLast);
      if (d > 0.01) { sp = { x: sp.x + dx / d * m, y: sp.y + dy / d * m }; this.tel.shadow.x = sp.x; this.tel.shadow.y = sp.y; }
      yield 0;
    }
    // lock
    this.tel.hideShadow();
    const lx = sp.x, ly = sp.y;
    Sfx.play('hoof_thunder', { vol: 0.8, rate: 1.3, gap: 0.2 });
    this.circle({ x: lx, y: ly, r: 190, tell: 0.9, active: 0.3, dmg: 2, style: 'shadow', fx: 'none', dust: false });
    yield 0.9;
    // land
    this.x = lx; this.y = ly;
    this.alphaOverride = undefined; this.land = 0.16;
    this.airHeight = 700; this.atkFrame(3);
    yield 0.16;
    this.airborne = false; this.invulnerable = false; this.targetable = true; this.airHeight = 0;
    if (this.shadow) this.shadow.setAlpha(1);
    fx.shake(0.035, 450); fx.hitStop(90);
    fx.explosion(lx, ly, 150);
    fx.ringPulse(lx, ly + 10, 0xff7a1f, 190, 420, 0.9);
    fx.dust(lx, ly + 30, 3);
    Sfx.play('explosion', { vol: 1, rate: 0.7, gap: 0.05 });
    const B = s.bullets.enemy;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + this.rng.float(0, 0.2);
      B.fire({ x: lx + Math.cos(a) * 110, y: ly + Math.sin(a) * 110, angle: a, speed: 280, damage: 1, kind: 'ember', life: 3, owner: this });
    }
    this.homeRoom.ignite(lx, ly, { r: 60, life: 2.5, count: 5, spread: 200 });
    this.stunned = 1.0; this.stunMult = 1.3; this.stunFx = 0; this.contactDamage = 0;
    yield 1.0;
    this.stunned = 0; this.stunMult = 1;
    this.contactDamage = this.baseContact;
    this.setPose('move');
  }
  stepLand(dt) {
    this.land -= dt;
    this.airHeight = Math.max(0, this.land / 0.16) * 700;
  }

  // ------------------------------------------------------------------------------------------ phase transitions
  /** Roar between phases (short invulnerable window): 1 = hellhounds + herd unlock, 2 = frenzy. */
  *roar(n) {
    const s = this.scene, fx = s.fx;
    this.invulnerable = true;
    s.bullets.enemy.clear();
    this.atkFrame(2); this.pulse(1.1);
    fx.shake(0.014, 1000); fx.flash(0xff7a1f, 0.3);
    fx.burst(this.x, this.y - 100, { color: [0xff7a1f, 0xffd060], count: 30, speed: [80, 320], life: [500, 900], scale: [2, 4], blend: 'ADD' });
    Sfx.play('bull_roar', { vol: 1, gap: 0.1 });
    this.banner(n === 1 ? 'THE FURNACE ROARS' : 'HELLFIRE!');
    yield 1.1;
    this.invulnerable = false;
    if (n === 1) this.summonHounds();
    this.setPose('move');
    yield 0.4;
  }
  summonHounds() {
    const p = this.player, room = this.scene.room;
    let made = 0;
    for (let tries = 0; made < 2 && tries < 40; tries++) {
      const x = this.rng.float(ROOM.x + 90, ROOM.right - 90), y = this.rng.float(ROOM.y + 90, ROOM.bottom - 90);
      if (Math.hypot(x - p.x, y - p.y) < 300 || Math.hypot(x - this.x, y - this.y) < this.radius + 70 || (room && room.probe(x, y, 34, null))) continue;
      this.scene.fx.spawn(x, y, 1.3);
      const e = spawnEnemy(this.scene, 'hellhound', x, y, { instant: true, floor: this.floor });
      if (e) { e.fromBoss = true; made++; }
    }
  }

  // ------------------------------------------------------------------------------------------ death
  die(info = {}) {
    if (!this.alive || this.dying) return;
    const s = this.scene, fx = s.fx;
    this.cancelHazards();
    this.tel.clear();
    this.charging = false; this.airborne = false; this.land = 0; this.stunned = 0; this.airHeight = 0; this.alphaOverride = undefined;
    if (this.shadow) this.shadow.setAlpha(1);
    this.targetable = false; this.stop();
    const room = this.homeRoom;
    if (room && room._hz) { if (room._hz.fires) room._hz.fires.clear(); if (room._hz.lanes) room._hz.lanes.stopAll(); }
    if (s.player) s.player.setEntryInvuln(3);
    this.atkFrame(3); // kneels, dazed
    Sfx.play('bull_roar', { vol: 1, rate: 0.6, gap: 0 });
    // embers off the cracking horns
    let n = 0;
    s.time.addEvent({
      delay: 120, repeat: 13,
      callback: () => {
        if (!this.sprite) return;
        n++;
        const ox = (this.rng.next() - 0.5) * 150;
        fx.burst(this.x + ox, this.y - 140, { color: [0xffd060, 0xff7a1f, 0x3b2320], count: 7, speed: [60, 260], life: [500, 1000], scale: [2, 4], gravity: -40, blend: 'ADD' });
        if (n % 4 === 0) Sfx.play('fire_whoosh', { vol: 0.4, rate: 0.7 + n * 0.02, gap: 0.2 });
      },
    });
    super.die(info);
  }

  destroy() {
    this.cancelHazards();
    if (this.tel) { this.tel.destroy(); this.tel = null; }
    super.destroy();
  }
}

registerBoss('toro', Toro, { hp: 800, r: 92, name: 'EL TORO INFERNAL', title: 'Horns of the Furnace', music: 'boss4', speed: 0, bob: true });
