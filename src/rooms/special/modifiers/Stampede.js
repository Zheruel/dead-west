// STAMPEDE (F1, F2, F4, F6): while in combat, every 6.5-8.5 s (first at 3.0 s) `rows` of the 7 tile rows get red chevrons at both edges + a rumble for
// 1.0 s, then 3 spectral bulls per row cross at 820 px/s (direction alternates). Contact 1 to the player (200 px/s shove, roll i-frames dodge it),
// 25 to every enemy touched once. Built on the LaneSweep `stampede` kind.
import { ROWS } from '../../../config.js';
import { Hazards } from '../../hazards/index.js';
import { Mod } from './Base.js';

export class Stampede extends Mod {
  constructor(room, cfg) {
    super(room, cfg, 0x57a3);
    this.next = cfg.first;
    this.n = 0; // events so far (direction flips each time)
    this.rows = cfg.rows[room.floor] || 2;
  }

  effect() {
    if (this.t < this.next) return;
    const c = this.cfg, lanes = Hazards.of(this.room);
    if (!lanes) return;
    this.next = this.t + this.rng.float(c.gap[0], c.gap[1]);
    const pool = [];
    for (let r = 0; r < ROWS; r++) pool.push(r);
    this.rng.shuffle(pool);
    for (let i = 0; i < this.rows; i++) {
      Hazards.spawnLane(this.room, { axis: 'h', index: pool[i], dir: (i + this.n) % 2 ? -1 : 1, kind: 'stampede', tell: c.warn, speed: c.speed, dmg: c.dmg, enemyDmg: c.enemyDmg, shove: c.knock });
    }
    this.n++;
  }
}
export default Stampede;
