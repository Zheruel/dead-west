// Scald clouds (FE-E3, steam_stoker): pooled steam discs, r 110 for 2.0 s. The player standing inside takes 1 dmg per 0.8 s (first tick after a 0.4 s
// grace so the vent blast and the cloud never stack in one instant); a roll through it is safe (i-frames). Other enemies ignore it.
//   ScaldField.of(scene).add(x, y, { r = 110, life = 2.0 })
// One manager per scene, driven by `postupdate` (skipped during hit-stop), cleared on every room transition. Everything is pooled: no allocation per frame.
import { DEPTH } from '../../../config.js';
import { bus } from '../../../core/events.js';
import { hurtPlayer, warnDepth, clamp, TAU } from '../../../rooms/hazards/common.js';

export const SCALD = { r: 110, life: 2.0, tick: 0.8, grace: 0.4, cap: 8 };
const PUFFS = 5;
const STEAM = 0xdde4e8;

class Cloud {
  constructor(scene) {
    const mk = (key) => { const o = scene.add.image(0, 0, key).setVisible(false); o.__noSnap = true; return o; };
    this.active = false;
    this.disc = mk('disc').setTint(STEAM);
    this.ring = mk('ring').setTint(STEAM);
    this.puffs = [];
    for (let i = 0; i < PUFFS; i++) this.puffs.push(mk('glow').setTint(STEAM));
  }

  start(x, y, r, life, depth) {
    this.active = true;
    this.x = x; this.y = y; this.r = r; this.life = life; this.t = 0;
    this.inT = 0; this.nextTick = SCALD.grace;
    this.seed = ((x * 7 + y * 13) % 6.28) + 0.1;
    this.disc.setVisible(true).setDepth(depth).setPosition(x, y);
    this.ring.setVisible(true).setDepth(depth + 0.1).setPosition(x, y);
    for (const p of this.puffs) p.setVisible(true).setDepth(DEPTH.fx - 20);
  }

  stop() {
    this.active = false;
    this.disc.setVisible(false); this.ring.setVisible(false);
    for (const p of this.puffs) p.setVisible(false);
  }

  destroy() { this.disc.destroy(); this.ring.destroy(); for (const p of this.puffs) p.destroy(); this.puffs.length = 0; }
}

export class ScaldField {
  static of(scene) {
    let f = scene._scald;
    if (!f || f.dead) f = scene._scald = new ScaldField(scene);
    return f;
  }

  constructor(scene) {
    this.scene = scene;
    this.dead = false;
    this.pool = [];
    this._stamp = -1;
    this._post = (time, delta) => this.update(Math.min(delta / 1000, 0.05));
    scene.events.on('postupdate', this._post);
    scene.events.once('shutdown', () => this.destroy());
    bus.scoped(scene, 'room:transition', () => this.clear());
  }

  get count() { let n = 0; for (const c of this.pool) if (c.active) n++; return n; }

  /** Spawn a cloud (oldest is recycled when the cap is reached). Returns true when created. */
  add(x, y, o = {}) {
    if (this.dead) return false;
    let c = null;
    for (const k of this.pool) if (!k.active) { c = k; break; }
    if (!c) {
      if (this.pool.length < SCALD.cap) { c = new Cloud(this.scene); this.pool.push(c); }
      else { c = this.pool[0]; for (const k of this.pool) if (k.t > c.t) c = k; }
    }
    const room = this.scene.room;
    c.start(x, y, o.r ?? SCALD.r, o.life ?? SCALD.life, warnDepth(room) + 1);
    this.place(c);
    return true;
  }

  clear() { for (const c of this.pool) if (c.active) c.stop(); }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.scene.events.off('postupdate', this._post);
    for (const c of this.pool) c.destroy();
    this.pool.length = 0;
    if (this.scene._scald === this) this.scene._scald = null;
  }

  place(c) {
    const k = clamp(c.t / 0.25, 0, 1); // swell-in
    const fade = clamp((c.life - c.t) / 0.5, 0, 1);
    const R = c.r * (0.7 + 0.3 * k);
    c.disc.setDisplaySize(R * 2, R * 2).setAlpha(0.26 * fade);
    c.ring.setDisplaySize(R * 2, R * 2).setAlpha(0.6 * fade);
    for (let i = 0; i < PUFFS; i++) {
      const a = c.seed + c.t * (0.55 + i * 0.07) + (i / PUFFS) * TAU;
      const rr = R * (0.28 + 0.4 * (0.5 + 0.5 * Math.sin(c.t * 1.3 + i * 1.9)));
      const sc = (R / 128) * (1.05 + 0.4 * Math.sin(c.t * 2.1 + i));
      c.puffs[i].setPosition(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.62 - 12 - c.t * 6).setScale(sc).setAlpha(0.5 * fade * (0.7 + 0.3 * Math.sin(c.t * 3 + i * 2)));
    }
  }

  update(dt) {
    const s = this.scene;
    if (s.fx && s.fx.frozen) return; // hit-stop
    const p = s.player;
    for (let i = 0; i < this.pool.length; i++) {
      const c = this.pool[i];
      if (!c.active) continue;
      c.t += dt;
      if (c.t >= c.life) { c.stop(); continue; }
      this.place(c);
      if (!p || p.dead) { c.inT = 0; continue; }
      const rr = c.r + p.hurtRadius * 0.5;
      if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 >= rr * rr) { c.inT = 0; c.nextTick = SCALD.grace; continue; }
      c.inT += dt;
      if (c.inT >= c.nextTick && (c.life - c.t) > 0.25 && hurtPlayer(s, 1, c.x, c.y, 'scald', { enemyName: 'steam_stoker' })) c.nextTick = c.inT + SCALD.tick;
    }
  }
}

export default ScaldField;
