// HELLFIRE (F4-F6): every 2.2 s (first at 2.0 s) an ember warns at a random walkable tile >= 140 px from the player for 1.0 s, then a fire patch burns
// there for 4.0 s. At most 5 hellfire patches at once (the oldest is recycled).
import { Sfx } from '../../../core/Audio.js';
import { GroundHaz } from '../../../systems/GroundHaz.js';
import { Hazards } from '../../hazards/index.js';
import { Mod } from './Base.js';

export class Hellfire extends Mod {
  constructor(room, cfg) {
    super(room, cfg, 0x4e11);
    this.next = cfg.first;
    this.handles = [];
    this.heatT = 0;
  }

  effect(dt) {
    const c = this.cfg, s = this.scene, p = s.player;
    this.heatT -= dt;
    if (this.heatT <= 0) { this.heatT = 0.35; s.fx.burst(this.rng.float(120, 1320), this.rng.float(300, 860), { color: [0xff7020, 0xffd060], count: 1, speed: [20, 60], life: [700, 1200], scale: [1, 2], gravity: -60, blend: 'ADD', angle: [250, 290] }); }
    if (this.t < this.next) return;
    this.next = this.t + c.gap;
    if (!p || p.dead) return;
    const hz = Hazards.of(this.room);
    if (!hz) return;
    const cand = [];
    for (const row of this.room.tiles) for (const t of row) if (!hz.unsafe(t.c, t.r) && Math.hypot(t.x - p.x, t.y - p.y) >= c.minPlayerDist) cand.push(t);
    if (!cand.length) return;
    const t = cand[this.rng.int(0, cand.length - 1)];
    for (let i = this.handles.length - 1; i >= 0; i--) if (this.handles[i].done) this.handles.splice(i, 1);
    this.handles.push(GroundHaz.of(s).circle({
      x: t.x, y: t.y, r: c.radius, tell: c.warn, active: 0.05, hold: 0.05, dmg: 0, kind: 'fire', color: c.color, fx: 'none',
      fire: { r: c.radius, dur: c.life, team: 'enemy', tag: 'hellfire', maxTag: c.max },
      onLand: (h) => { s.fx.burst(h.x, h.y - 10, { color: [0xff7020, 0xffd060, 0xffffff], count: 12, speed: [80, 260], life: [250, 500], gravity: 200, blend: 'ADD' }); Sfx.play('fire_whoosh', { vol: 0.6 }); },
    }));
    Sfx.play('ember_warn', { vol: 0.5 });
  }

  onClear() { for (const h of this.handles) if (!h.fired) h.cancel(); }
  onDestroy() { this.onClear(); }
}
export default Hellfire;
