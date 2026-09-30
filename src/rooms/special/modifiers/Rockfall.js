// ROCKFALL (F3): 1.8 s after the doors lock, every 2.2-3.5 s a rock falls: 60 % at the player's predicted position (pos + vel * 0.5), 40 % uniform.
// Ceiling dust trickles 1.0 s ahead, the warn circle (r 70) shows for 0.9 s, then 1 to the player / 30 to enemies. Max 2 alive; a dynamite explosion
// queues 2 extra rocks with a 1.0 s warn. Built on GroundHaz (damage never lands during the tell).
import { ROOM } from '../../../config.js';
import { Sfx } from '../../../core/Audio.js';
import { GroundHaz } from '../../../systems/GroundHaz.js';
import { clamp } from '../../hazards/common.js';
import { Mod } from './Base.js';

export class Rockfall extends Mod {
  constructor(room, cfg) {
    super(room, cfg, 0x50c4);
    this.next = cfg.first;
    this.pending = []; // { x, y, lead, warn } rocks still in their dust lead-in
    this.live = []; // GroundHaz handles
    this.on('explosion', (e) => this._boom(e));
  }

  _alive() { let n = this.pending.length; for (let i = this.live.length - 1; i >= 0; i--) { if (this.live[i].done) this.live.splice(i, 1); else n++; } return n; }

  _target() {
    const c = this.cfg, p = this.scene.player, m = 60;
    if (p && !p.dead && this.rng.chance(c.predictedShare)) return { x: clamp(p.x + p.vx * c.predictLead, ROOM.x + m, ROOM.right - m), y: clamp(p.y + p.vy * c.predictLead, ROOM.y + m, ROOM.bottom - m) };
    return { x: this.rng.float(ROOM.x + m, ROOM.right - m), y: this.rng.float(ROOM.y + m, ROOM.bottom - m) };
  }

  _queue(x, y, warn) {
    this.pending.push({ x, y, lead: Math.max(0, this.cfg.dustLead - warn), warn });
    Sfx.play('rock_warn', { vol: 0.7 });
  }

  effect(dt) {
    const c = this.cfg;
    if (this.t >= this.next) {
      this.next = this.t + this.rng.float(c.gap[0], c.gap[1]);
      if (this._alive() < c.maxActive) { const q = this._target(); this._queue(q.x, q.y, c.warn); }
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const r = this.pending[i];
      r.lead -= dt;
      if (Math.random() < dt * 30) this.scene.fx.burst(r.x + (Math.random() - 0.5) * 50, ROOM.y + 10, { color: [0x8a7a68, 0x6b5a48], count: 1, speed: [10, 40], life: [400, 800], scale: [1, 2], gravity: 300, dir: Math.PI / 2, spread: 10 });
      if (r.lead > 0) continue;
      this.pending.splice(i, 1);
      this.live.push(GroundHaz.of(this.scene).circle({
        x: r.x, y: r.y, r: c.radius, tell: r.warn, active: 0.25, dmg: c.dmg, kind: 'rock', enemyDmg: c.enemyDmg, color: 0xd63a2a,
        fall: 'rock', fallDur: 0.35, fallHeight: r.y + 200, dust: true, sfx: 'rock_impact', burstColors: [0x8a7a68, 0x6b5a48, 0xb09070],
      }));
    }
  }

  _boom(e) {
    if (!this.combat || !e) return;
    for (let i = 0; i < this.cfg.explosionRocks; i++) { const m = 60; this._queue(this.rng.float(ROOM.x + m, ROOM.right - m), this.rng.float(ROOM.y + m, ROOM.bottom - m), this.cfg.explosionWarn); }
  }

  /** Room cleared: rocks still warning are cancelled, ones that landed just finish. */
  onClear() { this.pending.length = 0; for (const h of this.live) if (!h.fired) h.cancel(); }
  onDestroy() { this.onClear(); }
}
export default Rockfall;
