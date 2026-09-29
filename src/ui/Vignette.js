// Screen-edge vignette: red flash when hurt ('hud:flash') + low-health heartbeat pulse (<= 1 heart incl. tin).
// The pulse follows the lub-dub of the 'heartbeat' loop (2 beats per 1.77 s, lub at 0.0 s, dub at 0.19 s) and publishes hud.beat (0..1) for other widgets.
import { bus } from '../core/events.js';
import { W, H } from '../config.js';

const RED = 0xb40a0a;
const PERIOD = 0.885; // seconds per lub-dub (the loop file holds two)

export default class Vignette {
  constructor(hud) {
    this.hud = hud;
    hud.beat = 0;
    // white-based edge texture so 'hud:flash' colours (gold item flash, red damage flash) tint correctly; resting tint = blood red
    if (!hud.textures.exists('vignette_w')) {
      const t = hud.textures.createCanvas('vignette_w', 512, 512), c = t.getContext();
      const g = c.createRadialGradient(256, 256, 512 * 0.28, 256, 256, 512 * 0.72);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.95)');
      c.fillStyle = g; c.fillRect(0, 0, 512, 512); t.refresh();
    }
    this.img = hud.add.image(W / 2, H / 2, 'vignette_w').setDisplaySize(W, H).setDepth(1).setAlpha(0).setTint(RED);
    this.flashAlpha = 0;
    this.lowSince = null;
    bus.scoped(hud, 'hud:flash', (p) => { this.flashAlpha = Math.max(this.flashAlpha, p.alpha ?? 0.5); if (p.color != null) this.img.setTint(p.color); });
  }

  update(g, dt) {
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.6);
    if (this.flashAlpha <= 0.02) this.img.setTint(RED); // back to blood red after a coloured flash
    const p = g.player;
    const units = p.hp + p.tin;
    const low = !p.dead && units <= 2;
    const now = this.hud.time.now / 1000;
    let base = 0, beat = 0;
    if (low) {
      if (this.lowSince == null) this.lowSince = now;
      const t = (now - this.lowSince) % PERIOD;
      beat = Math.min(1, Math.exp(-((t / 0.075) ** 2)) + 0.75 * Math.exp(-(((t - 0.19) / 0.085) ** 2)));
      const sev = units <= 1 ? 1 : 0.7; // last half heart pulses harder
      base = (0.12 + beat * 0.32) * sev;
      beat *= sev;
    } else this.lowSince = null;
    this.hud.beat = beat;
    this.img.setAlpha(Math.min(1, Math.max(this.flashAlpha, base)));
  }
  destroy() { this.img.destroy(); }
}
