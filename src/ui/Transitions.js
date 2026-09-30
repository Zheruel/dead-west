// Code-drawn screen transitions (STORY_PRESENTATION s5.4). No assets, any scene can call them:
//   Transitions.iris(scene, {x, y, ms, open, hold, depth, color, onDone})   circular mask closing on a focus point (open:true = iris-in)
//   Transitions.ink(scene, {ms, reverse, hold, depth, seed, color, onDone}) ink-splatter wipe: 24 seeded blobs (5-9 lobes) scale from 0 to cover (reverse = shrink away)
//   Transitions.flash(scene, {color, alpha, ms, depth})                     quick full-screen flash
//   Transitions.slam(scene, {shake, ms})                                    hard cut feel: white pop + camera shake (honours the Screenshake setting)
// Every call returns a handle {cancel(), destroy(), open(ms, x, y, cb)?}; `hold:true` keeps the covering overlay until destroy() / open().
// HudTransitions (installed by Cards on the HUD scene) wires the in-run moments: trapdoor iris (out on the player, in on arrival) and the death ink wipe.
import { W, H, ROOM } from '../config.js';
import { bus } from '../core/events.js';
import { RNG } from '../core/rng.js';
import { Save } from '../core/Save.js';

const INK = 0x0d0806;      // the game's fade colour (13, 8, 6)
const RIM = 0x4a0e0a;      // dried-blood edge of the ink splatter
const CIRCLE_N = 44;
const COS = new Float32Array(CIRCLE_N), SIN = new Float32Array(CIRCLE_N);
for (let i = 0; i < CIRCLE_N; i++) { COS[i] = Math.cos(-(i / CIRCLE_N) * Math.PI * 2); SIN[i] = Math.sin(-(i / CIRCLE_N) * Math.PI * 2); }

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const easeIn = (t) => t * t;

// ------------------------------------------------------------------------------------------------ iris
class Iris {
  constructor(scene, { x = W / 2, y = H / 2, depth = 200, color = INK } = {}) {
    this.scene = scene;
    this.x = x; this.y = y; this.color = color;
    this.g = scene.add.graphics().setDepth(depth).setScrollFactor(0);
    this.g.__noSnap = true;
    // one reusable quad (4 points)
    this.pts = [];
    for (let i = 0; i < 4; i++) this.pts.push({ x: 0, y: 0 });
    this.rMax = 0;
    this.r = 0;
    this.tween = null;
    this.dead = false;
    this.onDone = null;
    this.moveTo(x, y);
  }

  moveTo(x, y) {
    this.x = x; this.y = y;
    this.rMax = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 6; // radius that shows the whole screen
    this.draw(this.r);
  }

  draw(r) {
    const g = this.g;
    this.r = r;
    g.clear();
    if (r >= this.rMax) return;
    g.fillStyle(this.color, 1);
    if (r <= 0.5) { g.fillRect(0, 0, W, H); return; }
    // annulus between the hole (radius r) and a ring just past the farthest screen corner: 44 convex quads (no earcut on a holed polygon)
    const p = this.pts, x = this.x, y = this.y, R = this.rMax * 1.012 + 8;
    for (let i = 0; i < CIRCLE_N; i++) {
      const j = (i + 1) % CIRCLE_N;
      p[0].x = x + COS[i] * r; p[0].y = y + SIN[i] * r;
      p[1].x = x + COS[i] * R; p[1].y = y + SIN[i] * R;
      p[2].x = x + COS[j] * R; p[2].y = y + SIN[j] * R;
      p[3].x = x + COS[j] * r; p[3].y = y + SIN[j] * r;
      g.fillPoints(p, true);
    }
  }

  /** Animate the radius to `to` over `ms`. */
  run(to, ms, onDone, ease = easeIn) {
    if (this.tween) this.tween.stop();
    const from = this.r;
    const st = { t: 0 };
    this.onDone = onDone || null;
    this.tween = this.scene.tweens.addCounter({
      from: 0, to: 1, duration: Math.max(1, ms),
      onUpdate: (tw) => { st.t = tw.getValue(); this.draw(from + (to - from) * ease(st.t)); },
      onComplete: () => { this.draw(to); this.tween = null; const cb = this.onDone; this.onDone = null; if (cb) cb(); },
    });
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    if (this.tween) { this.tween.stop(); this.tween = null; }
    this.g.destroy();
  }
}

/**
 * Iris transition. `open:false` (default) closes the hole on (x, y) until the screen is black; `open:true` starts black and opens.
 * hold:true keeps the black overlay after closing (handle.open(ms, x, y, cb) reveals it later); otherwise the overlay is removed when done.
 */
function iris(scene, { x = ROOM.cx, y = ROOM.cy, ms = 500, open = false, hold = false, depth = 200, color = INK, onDone } = {}) {
  const ir = new Iris(scene, { x, y, depth, color });
  const handle = {
    iris: ir,
    cancel() { ir.destroy(); },
    destroy() { ir.destroy(); },
    /** Reveal a held overlay. */
    open(ms2 = 600, x2 = x, y2 = y, cb) {
      if (ir.dead) { if (cb) cb(); return; }
      ir.moveTo(x2, y2);
      ir.run(ir.rMax, ms2, () => { ir.destroy(); if (cb) cb(); }, easeOut);
    },
  };
  scene.events.once('shutdown', () => ir.destroy());
  if (open) { ir.r = 0; ir.draw(0); ir.run(ir.rMax, ms, () => { ir.destroy(); if (onDone) onDone(); }, easeOut); }
  else { ir.r = ir.rMax; ir.run(0, ms, () => { if (!hold) ir.destroy(); if (onDone) onDone(); }, easeIn); }
  return handle;
}

// ------------------------------------------------------------------------------------------------ ink splatter
const COLS = 6, ROWS = 4; // 24 blobs on a jittered grid: every point of the screen is inside at least one blob at full size

/** One blob outline (radius 1) as flat [x, y, ...]: 5-9 lobes plus a smaller harmonic so no two look alike. */
function blobPoints(rng, n = 40) {
  const lobes = rng.int(5, 9), ph = rng.float(0, 6.28), lobes2 = lobes + rng.int(2, 4), ph2 = rng.float(0, 6.28), amp = rng.float(0.16, 0.26);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.8 + amp * Math.cos(lobes * a + ph) + 0.07 * Math.cos(lobes2 * a + ph2);
    out[i] = { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }
  return out;
}

function polyGraphics(scene, pts, radius, color, depth) {
  const g = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  g.__noSnap = true;
  g.fillStyle(color, 1);
  const scaled = pts.map((p) => ({ x: p.x * radius, y: p.y * radius }));
  g.fillPoints(scaled, true);
  return g;
}

/** Ink splatter wipe. reverse:true starts fully covered and shrinks away. */
function ink(scene, { ms = 700, reverse = false, hold = false, depth = 200, seed = 1, color = INK, onDone } = {}) {
  const rng = new RNG(seed);
  const cw = W / COLS, ch = H / ROWS;
  const blobs = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = (c + 0.5) * cw + rng.float(-0.28, 0.28) * cw, cy = (r + 0.5) * ch + rng.float(-0.28, 0.28) * ch;
      const R = rng.float(300, 380), pts = blobPoints(rng);
      blobs.push({ cx, cy, R, pts, delay: rng.float(0, 0.32), rim: null, body: null });
    }
  }
  // rims first (all of them), bodies above: the red edge only shows on the outside of the merged mass
  for (const b of blobs) { b.rim = polyGraphics(scene, b.pts, b.R * 1.08, RIM, depth); b.rim.setPosition(b.cx, b.cy).setScale(0); }
  for (const b of blobs) { b.body = polyGraphics(scene, b.pts, b.R, color, depth + 0.5); b.body.setPosition(b.cx, b.cy).setScale(0); }
  const apply = (t) => { // t: 0 = clear, 1 = covered
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      const s = easeOut(clamp01((t - b.delay) / (1 - 0.32)));
      b.rim.setScale(s); b.body.setScale(s);
    }
  };
  let dead = false, tween = null;
  const destroy = () => { if (dead) return; dead = true; if (tween) tween.stop(); for (const b of blobs) { b.rim.destroy(); b.body.destroy(); } };
  apply(reverse ? 1 : 0);
  tween = scene.tweens.addCounter({
    from: 0, to: 1, duration: Math.max(1, ms),
    onUpdate: (tw) => { const v = tw.getValue(); apply(reverse ? 1 - v : v); },
    onComplete: () => { tween = null; apply(reverse ? 0 : 1); if (reverse || !hold) destroy(); if (onDone) onDone(); },
  });
  scene.events.once('shutdown', destroy);
  return { cancel: destroy, destroy };
}

// ------------------------------------------------------------------------------------------------ flash / slam
function flash(scene, { color = 0xffffff, alpha = 0.9, ms = 90, depth = 210 } = {}) {
  const r = scene.add.rectangle(W / 2, H / 2, W, H, color, alpha).setDepth(depth).setScrollFactor(0);
  r.__noSnap = true;
  scene.tweens.add({ targets: r, alpha: 0, duration: ms, onComplete: () => r.destroy() });
  return { cancel: () => r.destroy(), destroy: () => r.destroy() };
}

function slam(scene, { shake = 6, ms = 120 } = {}) {
  flash(scene, { alpha: 0.35, ms: 80 });
  let on = true;
  try { on = Save.settings().shake !== false; } catch (e) { on = true; }
  if (on && scene.cameras && scene.cameras.main) scene.cameras.main.shake(ms, shake / 960);
}

export const Transitions = { iris, ink, flash, slam };
export default Transitions;

// ------------------------------------------------------------------------------------------------ HUD wiring
/**
 * Run-time moments on the HUD scene: iris on the trapdoor (out on the player, held black through the interlude / cutscene chain, in on arrival) and the
 * ink wipe when the ride ends in death (the End scene reveals it again).
 * The trapdoor moment comes from 'trapdoor:descend' {x, y}; until RoomManager emits it, install() wraps roomMgr.descend of this run (dedupe by time).
 */
export class HudTransitions {
  constructor(hud) {
    this.hud = hud;
    this.hold = null;
    this.lastDescend = -1e9;
    this.g = hud.g || null;
    bus.scoped(hud, 'trapdoor:descend', (p) => this.onDescend(p));
    bus.scoped(hud, 'floor:changed', () => this.onArrive());
    bus.scoped(hud, 'run:ended', (p) => { if (p && p.variant === 'death') this.onDeath(); });
    this.wrapDescend();
    hud.events.once('shutdown', () => this.destroy());
  }

  wrapDescend() {
    const rm = this.g && this.g.roomMgr;
    if (!rm || rm.__irisWrap || typeof rm.descend !== 'function') return;
    const orig = rm.descend;
    const g = this.g;
    rm.__irisWrap = true;
    rm.descend = function descend(...a) {
      if (!g.transitioning && g.player) bus.emit('trapdoor:descend', { x: g.player.x, y: g.player.y, shim: true });
      return orig.apply(this, a);
    };
  }

  onDescend(p) {
    const now = this.hud.time.now;
    if (now - this.lastDescend < 1500) return; // RoomManager and the shim may both announce it
    this.lastDescend = now;
    if (this.hold) { this.hold.destroy(); this.hold = null; }
    const g = this.g, pl = g && g.player;
    this.hold = iris(this.hud, { x: (p && p.x) ?? (pl ? pl.x : ROOM.cx), y: (p && p.y) ?? (pl ? pl.y : ROOM.cy), ms: 500, hold: true, depth: 70 });
  }

  onArrive() {
    const h = this.hold;
    if (!h) return;
    this.hold = null;
    const pl = this.g && this.g.player;
    h.open(600, pl ? pl.x : ROOM.cx, pl ? pl.y : ROOM.cy);
  }

  onDeath() {
    if (this.hold) { this.hold.destroy(); this.hold = null; }
    bus.emit('hud:flash', { color: 0xb01810, alpha: 0.5 });
    const seed = ((this.g && this.g.seed) || 1) ^ 0x9e37;
    ink(this.hud, { ms: 640, hold: true, depth: 300, seed });
  }

  /** Safety: never leave the black overlay up once the run has stopped descending. */
  update(g) {
    if (this.hold && !g.transitioning && this.hud.time.now - this.lastDescend > 2500) this.onArrive();
  }

  destroy() {
    if (this.hold) { this.hold.destroy(); this.hold = null; }
  }
}
