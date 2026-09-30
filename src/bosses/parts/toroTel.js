// Toro telegraph painter (FE-B1): one Graphics object redrawn each frame from plain state, so every warning follows game time (hit-stop, slow-mo,
// fast-forward tests) and can be cancelled instantly on a phase change. Three shapes:
//   line    locked charge lane (band `w` px wide from the boss to the impact point, fill grows across the band)
//   wedge   fire-breath cone (half-angle, radius) that pulses until the stream starts
//   shadow  hellfire-leap landing shadow that tracks the player (the locked disc itself is a GroundHaz circle)
import { DEPTH } from '../../config.js';

const RED = 0xd63a2a, FIRE = 0xff7a1f;

export class ToroTel {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(DEPTH.decals + 6);
    this.g.__noSnap = true;
    scene.fx._track(this.g);
    this.line = { on: false, x: 0, y: 0, a: 0, len: 0, w: 0, t: 0, dur: 1 };
    this.wedge = { on: false, x: 0, y: 0, a: 0, half: 0, len: 0, t: 0, dur: 1 };
    this.shadow = { on: false, x: 0, y: 0, r: 190 };
    this.pts = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    this.fill = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    this.dirty = false;
  }

  showLine(x, y, a, len, w, dur) { Object.assign(this.line, { on: true, x, y, a, len, w, t: 0, dur }); this.dirty = true; }
  showWedge(x, y, a, half, len, dur) { Object.assign(this.wedge, { on: true, x, y, a, half, len, t: 0, dur }); this.dirty = true; }
  showShadow(x, y, r) { Object.assign(this.shadow, { on: true, x, y, r }); this.dirty = true; }
  hideLine() { this.line.on = false; }
  hideWedge() { this.wedge.on = false; }
  hideShadow() { this.shadow.on = false; }
  clear() { this.line.on = this.wedge.on = this.shadow.on = false; this.dirty = true; }
  get any() { return this.line.on || this.wedge.on || this.shadow.on; }

  update(dt) {
    const g = this.g;
    if (!g || !g.scene) return;
    if (!this.any) { if (this.dirty) { g.clear(); this.dirty = false; } return; }
    g.clear();
    this.dirty = true;
    const L = this.line, W = this.wedge, S = this.shadow;
    if (L.on) {
      L.t += dt;
      const k = Math.min(1, L.t / L.dur), pulse = 0.5 + 0.5 * Math.sin(L.t * 25);
      const c = Math.cos(L.a), s = Math.sin(L.a), nx = -s * L.w / 2, ny = c * L.w / 2, ex = L.x + c * L.len, ey = L.y + s * L.len;
      const p = this.pts;
      p[0].x = L.x + nx; p[0].y = L.y + ny; p[1].x = ex + nx; p[1].y = ey + ny; p[2].x = ex - nx; p[2].y = ey - ny; p[3].x = L.x - nx; p[3].y = L.y - ny;
      g.fillStyle(RED, 0.14 + 0.06 * pulse).fillPoints(p, true);
      const f = this.fill, fw = L.w * k / 2, fx = -s * fw, fy = c * fw;
      f[0].x = L.x + fx; f[0].y = L.y + fy; f[1].x = ex + fx; f[1].y = ey + fy; f[2].x = ex - fx; f[2].y = ey - fy; f[3].x = L.x - fx; f[3].y = L.y - fy;
      g.fillStyle(RED, 0.2 + 0.25 * k).fillPoints(f, true);
      g.lineStyle(3, RED, 0.55 + 0.4 * k).strokePoints(p, true);
      // impact marker at the far end
      g.lineStyle(4, 0xffd0a0, 0.4 + 0.4 * pulse).strokeCircle(ex, ey, L.w * 0.32);
    }
    if (W.on) {
      W.t += dt;
      const k = Math.min(1, W.t / W.dur), pulse = 0.5 + 0.5 * Math.sin(W.t * 22);
      g.fillStyle(FIRE, 0.12 + 0.1 * k + 0.06 * pulse);
      g.slice(W.x, W.y, W.len, W.a - W.half, W.a + W.half, false).fillPath();
      g.lineStyle(3, FIRE, 0.5 + 0.4 * k);
      g.slice(W.x, W.y, W.len, W.a - W.half, W.a + W.half, false).strokePath();
      g.fillStyle(FIRE, 0.18 + 0.25 * k);
      g.slice(W.x, W.y, W.len * k, W.a - W.half, W.a + W.half, false).fillPath();
    }
    if (S.on) {
      g.fillStyle(0x000000, 0.28).fillEllipse(S.x, S.y, S.r * 1.5, S.r * 1.0);
      g.lineStyle(3, RED, 0.45).strokeCircle(S.x, S.y, S.r);
    }
  }

  destroy() {
    if (this.g && this.g.scene) this.g.destroy();
    this.g = null;
  }
}

export default ToroTel;
