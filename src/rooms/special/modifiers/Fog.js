// FOG (F2, F3, F6): cold grey mask (wide clear radius), six huge slow fog banks drifting across it, and one extra `ghost` with wave 1 on F2-F3.
import { W } from '../../../config.js';
import { spawnEnemy } from '../../../enemies/index.js';
import { MaskMod } from './MaskMod.js';
import { MASK_DEPTH } from './LightMask.js';

export class Fog extends MaskMod {
  constructor(room, cfg) {
    super(room, cfg, 0xf06);
    const s = this.scene;
    this.banks = [];
    for (let i = 0; i < 6; i++) {
      const im = s.add.image(0, 0, 'glow').setTint(cfg.mask.color).setDepth(MASK_DEPTH + 1).setAlpha(0.16 + 0.08 * (i % 3)).setScale(this.rng.float(7, 11), this.rng.float(3, 5));
      im.__noSnap = true;
      this.banks.push({ im, x: this.rng.float(0, W), y: this.rng.float(220, 840), v: this.rng.float(10, 24) * (i % 2 ? -1 : 1) });
    }
    this.ghosted = false;
    if (cfg.extraGhostFloors && cfg.extraGhostFloors.includes(room.floor)) this.on('room:wave', (e) => this._wave(e));
  }

  visuals(dt) {
    for (const b of this.banks) {
      b.x += b.v * dt;
      if (b.x > W + 300) b.x = -300; else if (b.x < -300) b.x = W + 300;
      b.im.setPosition(b.x, b.y);
    }
  }

  /** Wave 1 gains one extra ghost, placed out of the player's reach like any spawn. */
  _wave(e) {
    if (this.ghosted || !e || e.room !== this.room) return;
    this.ghosted = true;
    const room = this.room, s = this.scene, p = s.player;
    let best = null, bd = -1;
    for (const row of room.tiles) for (const t of row) {
      if (t.solid || t.type === 'pit') continue;
      const d = p ? Math.hypot(t.x - p.x, t.y - p.y) : 999;
      const score = d >= 300 ? 1000 - Math.abs(d - 420) : d;
      if (score > bd) { bd = score; best = t; }
    }
    if (!best) return;
    s.fx.spawn(best.x, best.y, 1);
    room.pending++;
    s.time.delayedCall(560, () => {
      room.pending--;
      if (room.destroyed || s.room !== room) return;
      spawnEnemy(s, 'ghost', best.x, best.y, { floor: room.floor });
    });
  }

  onClear() { super.onClear(); for (const b of this.banks) b.im.setVisible(false); }
  onDestroy() { super.onDestroy(); for (const b of this.banks) b.im.destroy(); this.banks.length = 0; }
}
export default Fog;
