// LightMask (EVENTS 7.1): shader-less darkness / haze. One RenderTexture 1440x960 at DEPTH.bullets - 4 (above actors, below bullets and fx).
// Each frame (skipped when no light moved or flickered): fill the tint at `alpha`, then erase a soft radial gradient at every light.
// Light = { x, y, radius, soft }: fully clear inside `radius - soft`, fading to the full tint at `radius`. Falls back to a flat 0.35 rect
// when RenderTexture.erase is unavailable. Destroyed with the room (no texture leaks: gradient textures are shared and created once).
import { W, H, DEPTH } from '../../../config.js';
import { lightTexKey } from '../../hazards/common.js';

export const MASK_DEPTH = DEPTH.bullets - 4;

export class LightMask {
  /** cfg: { color, alpha, radius, soft, flicker } (MODIFIERS.<id>.mask). */
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    this.lights = []; // extra lights (familiars): { x, y, radius, soft }; the player light is implicit
    this.rt = scene.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setDepth(MASK_DEPTH);
    this.rt.__noSnap = true;
    this.canErase = typeof this.rt.erase === 'function';
    this.stamp = null;
    this.stampKey = '';
    this.flat = null;
    if (!this.canErase) this.flat = scene.add.rectangle(0, 0, W, H, cfg.color, 0.35).setOrigin(0, 0).setDepth(MASK_DEPTH);
    this.q = { x: -1, y: -1, f: 0, a: -1, n: -1 }; // last drawn state
    this.qs = [];
    this.alphaMul = 1; // fade in / out
    this.t = 0;
  }

  /** Radius jitter (lantern flicker). */
  _flick() { const f = this.cfg.flicker || 0; return f ? Math.sin(this.t * 37) * f * 0.6 + Math.sin(this.t * 91 + 1.3) * f * 0.4 : 0; }

  _stamp(soft, radius) {
    const key = lightTexKey(this.scene, radius > 0 ? (radius - soft) / radius : 0);
    if (!this.stamp) this.stamp = this.scene.make.image({ key, add: false });
    else if (key !== this.stampKey) this.stamp.setTexture(key);
    this.stampKey = key;
    this.stamp.setOrigin(0.5).setScale((radius * 2) / 256);
    return this.stamp;
  }

  /** Redraw when a light moved / flickered / the tint alpha changed. `px, py` = player light centre. */
  update(dt, px, py) {
    this.t += dt;
    if (!this.rt.scene) return;
    const c = this.cfg, fl = this._flick();
    if (this.flat) { this.flat.setAlpha(0.35 * this.alphaMul); return; }
    // skip the fill + erase when nothing moved (allocation-free comparison)
    const q = this.q, qx = px | 0, qy = py | 0, qf = Math.round(fl * 4), qa = Math.round(this.alphaMul * 500);
    let same = q.x === qx && q.y === qy && q.f === qf && q.a === qa && q.n === this.lights.length;
    for (let i = 0; same && i < this.lights.length; i++) { const l = this.lights[i], o = this.qs[i]; same = !!o && o.x === (l.x | 0) && o.y === (l.y | 0) && o.r === l.radius; }
    if (same) return;
    q.x = qx; q.y = qy; q.f = qf; q.a = qa; q.n = this.lights.length;
    for (let i = 0; i < this.lights.length; i++) { const l = this.lights[i], o = this.qs[i] || (this.qs[i] = {}); o.x = l.x | 0; o.y = l.y | 0; o.r = l.radius; }
    const rt = this.rt;
    rt.clear();
    rt.fill(c.color, c.alpha * this.alphaMul);
    if (this.alphaMul <= 0.001) return;
    this._erase(rt, px, py, c.radius + fl, c.soft);
    for (const l of this.lights) this._erase(rt, l.x, l.y, l.radius, l.soft);
  }

  _erase(rt, x, y, radius, soft) {
    const st = this._stamp(soft, radius);
    rt.erase(st, x, y);
  }

  setVisible(v) { this.rt.setVisible(v); if (this.flat) this.flat.setVisible(v); }

  destroy() {
    if (this.rt) this.rt.destroy();
    if (this.flat) this.flat.destroy();
    if (this.stamp) this.stamp.destroy();
    this.rt = this.flat = this.stamp = null;
  }
}

export default LightMask;
