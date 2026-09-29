// Dead Eye visual: a small arc above the player fills while the gun is "held" (no shooting); when full it becomes a pulsing red reticle
// with a revolver click. Player.fire() reads stats.deadEye / deadEyeDelay / lastShotAt; this class only shows the state.
import Familiar from './Familiar.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH } from '../../config.js';

export default class DeadEyeSight extends Familiar {
  constructor(player) {
    super(player);
    this.gfx = this.own(this.scene.add.graphics().setDepth(DEPTH.overlay - 5));
    this.ready = false;
    this.t = 0;
  }

  update(dt, player) {
    if (!this.alive) return;
    this.t += dt;
    const st = player.stats;
    const g = this.gfx;
    g.clear();
    if (!st.deadEye) { this.ready = false; return; }
    const idle = player.time - player.lastShotAt;
    const p = Math.min(1, idle / st.deadEyeDelay);
    const ready = p >= 1;
    if (ready && !this.ready) { Sfx.play('gun_cock', { vol: 0.4, rate: 1.3 }); this.pop = 0.25; }
    this.ready = ready;
    this.pop = Math.max(0, (this.pop || 0) - dt);
    if (idle < 0.35) return; // hide right after shooting: no clutter during normal fire
    const x = player.x, y = player.y - 112;
    if (!ready) {
      g.lineStyle(3, 0xf0a640, 0.55).beginPath().arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2).strokePath();
    } else {
      const r = 14 + this.pop * 30 + Math.sin(this.t * 8) * 1.5;
      g.lineStyle(4, 0x120c0a, 0.9).strokeCircle(x, y, r + 1);
      g.lineStyle(3, 0xff5030, 0.95).strokeCircle(x, y, r);
      g.lineStyle(3, 0xff5030, 0.95);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.lineBetween(x + dx * (r - 6), y + dy * (r - 6), x + dx * (r + 8), y + dy * (r + 8));
    }
  }
}
