// Gravestone ambush (F2 templates with `graveAmbush:true`): their `G` stones are scenery unless `RNG(def.seed ^ 0x6A7E).chance(0.5)` rigs THIS room.
// Rigged, after the normal encounter is cleared, when the player comes within 150 px of a stone: 1.0 s telegraph (stones shake, red glow, grave_crack),
// then every stone crumbles into rubble and releases one enemy (skeleton, skeleton, possessed; extra stones spawn a ghost), the doors re-lock and
// the room pays one extra pickup when the last of them dies. Persistent in `room.state.ctl.graveDone`.
import Phaser from 'phaser';
import { DEPTH } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { RNG } from '../../core/rng.js';
import { spawnEnemy } from '../../enemies/index.js';
import { hasCell } from './common.js';
import { TEX } from './tiles.js';

export const GRAVE = { trigger: 150, tell: 1.0, roster: ['skeleton', 'skeleton', 'possessed'], extra: 'ghost' };

/** Is this room's ambush live? (deterministic per room seed) */
export const isRigged = (def) => new RNG((def.seed ^ 0x6a7e) >>> 0).chance(0.5);

export class GraveField {
  constructor(hz, tiles) {
    this.hz = hz;
    this.room = hz.room;
    this.scene = hz.scene;
    this.stones = tiles.map((t) => this.room.tiles[t.r][t.c]);
    const st = this.room.state;
    const ctl = st.ctl || (st.ctl = {});
    this.ctl = ctl;
    this.rigged = isRigged(this.room.def) && !!hz.def.graveAmbush;
    this.phase = 'wait'; // wait | tell | fight | done
    this.t = 0;
    this.spawned = [];
    this.glows = [];
    if (ctl.graveDone) { this.phase = 'done'; for (const t of this.stones) this._rubble(t); }
  }

  get active() { return this.phase === 'tell' || this.phase === 'fight'; }

  _rubble(t) {
    t.solid = false; t.type = 'rubble'; t.grave = false; t.bb = false;
    if (t.sprite && t.sprite.scene) {
      if (hasCell('obst_hazards', 'rubble')) t.sprite.setFrame(Assets.frame('obst_hazards', 'rubble')); else t.sprite.setTexture(TEX.rubble(this.scene));
      t.sprite.setDepth(DEPTH.floor).setX(t.x);
    }
  }

  update(dt) {
    const room = this.room, s = this.scene, p = s.player;
    if (!this.rigged || this.phase === 'done' || !p || p.dead) return;
    if (this.phase === 'wait') {
      if (!room.state.cleared || room.mode === 'combat') return;
      for (const t of this.stones) if (Math.hypot(t.x - p.x, t.y - p.y) < GRAVE.trigger) { this._begin(); break; }
    } else if (this.phase === 'tell') {
      this.t += dt;
      const k = Math.min(1, this.t / GRAVE.tell);
      for (let i = 0; i < this.stones.length; i++) {
        const t = this.stones[i];
        if (t.sprite && t.sprite.scene) t.sprite.x = t.x + Math.sin(this.t * 70 + i) * (1 + 3 * k);
        const g = this.glows[i];
        if (g) g.setAlpha(0.25 + 0.5 * k);
      }
      if (this.t >= GRAVE.tell) this._release();
    } else if (this.phase === 'fight') {
      let alive = 0;
      for (const e of this.spawned) if (e.alive) alive++;
      if (alive === 0) this._finish();
    }
  }

  _begin() {
    this.phase = 'tell'; this.t = 0;
    const s = this.scene;
    for (const t of this.stones) {
      const g = s.add.image(t.x, t.y - 20, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xd63a2a).setScale(1.6).setAlpha(0.25).setDepth(DEPTH.bullets - 5);
      g.__noSnap = true;
      this.glows.push(g);
    }
    Sfx.play('grave_crack', { vol: 0.9 });
    s.fx.shake(0.004, 900);
  }

  _release() {
    const s = this.scene, room = this.room;
    this.phase = 'fight'; this.t = 0;
    this.ctl.graveDone = true;
    this.stones.forEach((t, i) => {
      if (t.sprite && t.sprite.scene) t.sprite.x = t.x;
      this._rubble(t);
      s.fx.burst(t.x, t.y, { color: [0x8a7a68, 0x6b5a48, 0x3a3632], count: 16, speed: [80, 260], life: [300, 600], gravity: 300 });
      s.fx.dust(t.x, t.y + 10, 1.1);
      const id = i < GRAVE.roster.length ? GRAVE.roster[i] : GRAVE.extra;
      const e = spawnEnemy(s, id, t.x, t.y, { floor: room.floor, instant: true });
      if (e) this.spawned.push(e);
    });
    for (const g of this.glows) g.destroy();
    this.glows.length = 0;
    Sfx.play('grave_crack', { vol: 1 });
    if (this.spawned.length) room.lock(); else this._finish();
  }

  _finish() {
    const room = this.room;
    this.phase = 'done';
    room.unlock();
    const pk = typeof room.rollPickup === 'function' ? room.rollPickup(1.0) : 'coin';
    room.dropPickup(pk, this.stones.length ? this.stones[0].x : room.center.x, this.stones.length ? this.stones[0].y : room.center.y, { pop: true });
    this.scene.fx.ringPulse(this.room.center.x, this.room.center.y + 20, 0xf0d080, 420, 700, 0.3);
  }

  destroy() { for (const g of this.glows) g.destroy(); this.glows.length = 0; }
}

export default GraveField;
