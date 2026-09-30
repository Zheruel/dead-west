// LURCH (F5, F6): every 5.0 s (first at 4.0 s) the room lurches: 0.7 s warn (camera rumble ramping 0.002 -> 0.008, chevrons at both edges), then every
// non-flying actor, the player included, is shoved 260 px left or right over 0.35 s (ease-out). Not damage; walls and obstacles stop the shove (moves go
// through collision), a roll does not cancel it. The player's share goes through player.env.push, enemies move directly.
import { ROOM } from '../../../config.js';
import { Sfx } from '../../../core/Audio.js';
import { envOf, warnDepth, lerp, clamp } from '../../hazards/common.js';
import { Mod } from './Base.js';

export class Lurch extends Mod {
  constructor(room, cfg) {
    super(room, cfg, 0x10c8);
    this.next = cfg.first;
    this.state = 'idle'; // idle | warn | push
    this.s = 0; this.dir = 1;
    this.g = this.scene.add.graphics().setDepth(warnDepth(room));
    this.g.__noSnap = true;
    this.rumbleT = 0; this.dustT = 0;
    this.drawn = false;
  }

  effect(dt) {
    const c = this.cfg, s = this.scene;
    if (this.state === 'idle') {
      if (this.t < this.next) return;
      this.next = this.t + c.gap;
      this.state = 'warn'; this.s = 0; this.dir = this.rng.chance(0.5) ? 1 : -1; this.rumbleT = 0;
      Sfx.play('lurch_creak', { vol: 0.9 });
      return;
    }
    this.s += dt;
    if (this.state === 'warn') {
      const k = clamp(this.s / c.warn, 0, 1);
      this.rumbleT -= dt;
      if (this.rumbleT <= 0) { this.rumbleT = 0.1; s.fx.shake(lerp(0.002, 0.008, k), 110); }
      this._chevrons(k);
      if (this.s >= c.warn) { this.state = 'push'; this.s = 0; this.g.clear(); this.drawn = false; }
      return;
    }
    // push: ease-out displacement 260 px over dur => v(k) = 2 (1 - k) push / dur
    const k = clamp(this.s / c.dur, 0, 1), v = (2 * (1 - k) * c.push) / c.dur * this.dir;
    const p = s.player;
    if (p && !p.dead) { const env = envOf(s); env.push.x += v; }
    const list = s.enemies;
    for (let i = 0; i < list.length; i++) { const e = list[i]; if (e.alive && !e.flying && !e.isBoss) e.moveBy(v * dt, 0); }
    this.dustT -= dt;
    if (this.dustT <= 0) { this.dustT = 0.05; s.fx.burst(this.rng.float(ROOM.x, ROOM.right), this.rng.float(ROOM.y + 40, ROOM.bottom), { color: [0x8a7a68, 0x6b5a48], count: 2, speed: [40, 120], life: [300, 600], scale: [1, 2], dir: this.dir > 0 ? Math.PI : 0, spread: 20 }); }
    if (this.s >= c.dur) this.state = 'idle';
  }

  _chevrons(k) {
    const g = this.g.clear(), a = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(this.s * 25)) * (0.4 + 0.6 * k);
    this.drawn = true;
    g.setDepth(warnDepth(this.room)).fillStyle(0x80b0ff, a);
    for (const edge of [ROOM.x + 26, ROOM.right - 26]) for (let i = 0; i < 4; i++) {
      const y = ROOM.y + 100 + i * 150, x = edge, d = this.dir;
      g.fillTriangle(x + d * 22, y, x - d * 14, y - 28, x - d * 14, y + 28);
    }
  }

  onClear() { this.state = 'idle'; this.g.clear(); }
  onDestroy() { this.g.destroy(); }
}
export default Lurch;
