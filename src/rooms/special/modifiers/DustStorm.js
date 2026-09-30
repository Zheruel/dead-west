// DUST STORM (F1, F2, F4 as ASH STORM): sand haze through the LightMask, 40 streaks crossing at 900 px/s, and a wind that shoves the player 45 px/s along
// one cardinal direction while in combat (not while rolling).
import { W, H } from '../../../config.js';
import { envOf } from '../../hazards/common.js';
import { MaskMod } from './MaskMod.js';
import { MASK_DEPTH } from './LightMask.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class DustStorm extends MaskMod {
  constructor(room, cfg) {
    const ash = room.floor === 4 && cfg.ash;
    super(room, cfg, 0xd057, { ...cfg.mask, color: ash ? cfg.ash.color : cfg.mask.color });
    this.ash = !!ash;
    this.name = ash ? cfg.ash.name : cfg.name;
    const d = DIRS[this.rng.int(0, 3)];
    this.wx = d[0]; this.wy = d[1];
    const s = this.scene, tex = s.textures.exists('fx_streak') ? 'fx_streak' : 'px';
    this.streaks = [];
    const col = this.ash ? 0xb08070 : 0xf0dcb0;
    for (let i = 0; i < cfg.streaks; i++) {
      const im = s.add.image(0, 0, tex).setTint(col).setDepth(MASK_DEPTH + 1).setRotation(Math.atan2(this.wy, this.wx));
      im.__noSnap = true;
      this.streaks.push({ im, x: this.rng.float(0, W), y: this.rng.float(120, H - 60), k: this.rng.float(0.7, 1.3), a: this.rng.float(0.2, 0.5), len: this.rng.float(1, 2.6) });
      im.setAlpha(this.streaks[i].a).setScale(this.streaks[i].len * 1.4, 1);
    }
  }

  visuals(dt) {
    const sp = this.cfg.streakSpeed;
    for (const st of this.streaks) {
      st.x += this.wx * sp * st.k * dt; st.y += this.wy * sp * st.k * dt;
      if (st.x > W + 80) st.x = -80; else if (st.x < -80) st.x = W + 80;
      if (st.y > H + 80) st.y = 120; else if (st.y < 100) st.y = H + 40;
      st.im.setPosition(st.x, st.y);
    }
  }

  effect() {
    const p = this.scene.player;
    if (!p || p.dead || p.rolling) return;
    const env = envOf(this.scene);
    env.push.x += this.wx * this.cfg.wind; env.push.y += this.wy * this.cfg.wind;
  }

  onLock() { const p = this.scene.player; if (p) envOf(this.scene); }
  onClear() { super.onClear(); for (const st of this.streaks) st.im.setVisible(false); }
  onDestroy() { super.onDestroy(); for (const st of this.streaks) st.im.destroy(); this.streaks.length = 0; }
}
export default DustStorm;
