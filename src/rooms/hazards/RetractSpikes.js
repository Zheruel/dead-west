// Retracting spikes `s` (F1-F3, optional later): cycle 2.8 s = down 1.4 s (safe) -> warn 0.5 s (tips shiver, click) -> up 0.9 s (1 damage, once per 0.8 s
// to the same actor). Phase offset ((c+r)*0.35) s so rows sweep like a wave. Flyers and ghosts ignore them; walkers avoid a tile only while it is up
// (Hazards.blocks). Tile hazards stay active in cleared rooms.
import { DEPTH } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { hurtPlayer, circleHitsTile, hasCell, colOf, rowOf } from './common.js';
import { TEX } from './tiles.js';

export const RSPIKE = { cycle: 2.8, down: 1.4, warn: 0.5, up: 0.9, again: 0.8 };
const CELLS = ['spikes_ret_down', 'spikes_ret_warn', 'spikes_ret_up'];

export class SpikeField {
  constructor(hz, tiles) {
    this.hz = hz;
    this.room = hz.room;
    this.scene = hz.scene;
    const s = this.scene;
    this.real = hasCell('obst_hazards', CELLS[0]);
    this.spikes = tiles.map((t) => {
      const st = { c: t.c, r: t.r, x: t.x, y: t.y, off: ((t.c + t.r) * 0.35) % RSPIKE.cycle, state: 0, hits: new Map() };
      st.img = this.real ? Assets.makeCell(s, t.x, t.y + 48, 'obst_hazards', CELLS[0], 1) : s.add.image(t.x, t.y, TEX.rspikes(s, 0));
      st.img.setDepth(DEPTH.floor);
      return st;
    });
    this.upN = 0; // spikes currently up (Hazards.blocks fast path)
  }

  /** A walker of radius r at (x,y) would stand on a raised spike. */
  blocks(x, y, r) {
    if (!this.upN) return false;
    const c0 = colOf(x - r), c1 = colOf(x + r), r0 = rowOf(y - r), r1 = rowOf(y + r);
    for (const sp of this.spikes) if (sp.state === 2 && sp.c >= c0 && sp.c <= c1 && sp.r >= r0 && sp.r <= r1) return true;
    return false;
  }

  update(dt) {
    const clock = this.hz.clock, s = this.scene, p = s.player;
    let up = 0;
    for (const sp of this.spikes) {
      const ph = (clock + sp.off) % RSPIKE.cycle;
      const st = ph < RSPIKE.down ? 0 : ph < RSPIKE.down + RSPIKE.warn ? 1 : 2;
      if (st !== sp.state) {
        sp.state = st;
        if (this.real) sp.img.setFrame(Assets.frame('obst_hazards', CELLS[st])); else sp.img.setTexture(TEX.rspikes(s, st));
        if (st === 1) Sfx.play('spikes_ret', { vol: 0.5 });
        if (st === 0) sp.hits.clear();
        if (st === 2) sp.hits.clear();
      }
      if (st === 1) sp.img.x = sp.x + (Math.sin(clock * 90) > 0 ? 1.5 : -1.5); else if (sp.img.x !== sp.x) sp.img.x = sp.x;
      if (st !== 2) continue;
      up++;
      if (p && !p.dead && p.canBeHit() && circleHitsTile(p.x, p.y, p.hurtRadius * 0.4, sp.c, sp.r)) hurtPlayer(s, 1, sp.x, sp.y, 'spikes');
      const list = s.enemies;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e.flying || e.ghost || e.isBoss) continue;
        if (!circleHitsTile(e.x, e.y, e.hitRadius * 0.4, sp.c, sp.r)) continue;
        const last = sp.hits.get(e);
        if (last !== undefined && clock - last < RSPIKE.again) continue;
        sp.hits.set(e, clock);
        e.hurt(1, { x: sp.x, y: sp.y, hazard: 'spikes', dot: true });
      }
    }
    this.upN = up;
  }

  destroy() { for (const sp of this.spikes) sp.img.destroy(); this.spikes.length = 0; }
}

export default SpikeField;
