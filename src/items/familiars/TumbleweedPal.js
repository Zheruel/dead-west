// Tumbleweed Pal (ITEMS_V2 4.4): a friendly tumbleweed (radius 28) rolling at 260 px/s, bouncing off walls and rocks, drifting 25% toward the nearest foe.
// Contact hurts every foe it touches for 5 x familiarMult (once per 0.4 s per enemy) and it cracks a breakable tile once per bounce (powder barrels only when
// you stand well clear of the blast). It ignores bullets (never blocks, never hit). Pack Leader / Boneyard riders come from familiarKit.bite.
import { Pet, nearestEnemy, validTarget, bite } from './familiarKit.js';
import { Sfx } from '../../core/Audio.js';
import { subRng } from '../../core/rng.js';

const SPEED = 260, RADIUS = 28, CONTACT = 5, TICK = 0.4, STEER = 0.25;
const BARREL_SAFE = 240; // do not detonate powder barrels this close to the player
let uid = 0;

export default class TumbleweedPal extends Pet {
  constructor(player) {
    super(player, { key: 'tumble_pal', radius: RADIUS, footOffset: 20, scale: 0.95, shadow: 0.55, fps: 5 });
    this.id = ++uid;
    this.hitKey = `_pal${this.id}`; // per-enemy contact timer lives on the enemy (no Map churn)
    const r = subRng('tumbleweed_pal', this.id);
    const a = r.next() * Math.PI * 2;
    this.dx = Math.cos(a); this.dy = Math.sin(a);
    this.spin = 0;
    this.bounceT = 0;
    this.stuckT = 0;
    this.clock = 0;
  }

  tick(dt, p) {
    const scene = this.scene;
    this.clock += dt;
    // 25% steering toward the nearest foe (a gentle pull, not a homing missile)
    const foe = nearestEnemy(scene, this.x, this.y, 900);
    if (foe) {
      const tx = foe.x - this.x, ty = foe.y - this.y, tl = Math.hypot(tx, ty) || 1;
      const k = Math.min(1, STEER * dt * 4.2);
      this.dx += (tx / tl - this.dx) * k; this.dy += (ty / tl - this.dy) * k;
      const l = Math.hypot(this.dx, this.dy) || 1; this.dx /= l; this.dy /= l;
    }
    const ox = this.x, oy = this.y;
    const blocked = this.walk(this.dx * SPEED, this.dy * SPEED, dt);
    if (blocked) this.bounce(p);
    else if (Math.hypot(this.x - ox, this.y - oy) < SPEED * dt * 0.25) { // wedged in a corner: pick a fresh heading
      this.stuckT += dt;
      if (this.stuckT > 0.25) { this.stuckT = 0; const a = Math.atan2(this.dy, this.dx) + Math.PI * (0.6 + 0.8 * ((this.clock * 7) % 1)); this.dx = Math.cos(a); this.dy = Math.sin(a); }
    } else this.stuckT = 0;
    if (this.bounceT > 0) this.bounceT -= dt;
    // contact damage
    const list = scene.enemies, now = this.clock;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!validTarget(e)) continue;
      const rr = RADIUS + e.hitRadius * 0.8;
      if ((e.x - this.x) ** 2 + (e.y - this.y) ** 2 > rr * rr) continue;
      const next = e[this.hitKey];
      if (next !== undefined && next > now) continue;
      e[this.hitKey] = now + TICK;
      bite(p, e, CONTACT * this.power, Math.atan2(e.y - this.y, e.x - this.x), this, 1.2);
      this.squash = 0.1;
      Sfx.play('step_dirt', { vol: 0.3, rate: 1.4, gap: 0.12 });
    }
    // rolling look: rocks side to side, hops with the bounces
    this.spin += dt * (SPEED / RADIUS);
    this.sprite.setRotation(Math.sin(this.spin * 0.9) * 0.28);
    this.bob = Math.abs(Math.sin(this.spin * 1.3)) * 7 + (this.bounceT > 0 ? this.bounceT * 60 : 0);
    if (Math.abs(this.dx) > 0.15) this.faceLeft = this.dx < 0;
  }

  /** Reflect off the wall / rock we just hit; crack a breakable tile (once per bounce). */
  bounce(p) {
    const nx = this.hnx, ny = this.hny;
    const dot = this.dx * nx + this.dy * ny;
    if (dot < 0) { this.dx -= 2 * dot * nx; this.dy -= 2 * dot * ny; }
    // a nudge off dead-straight axes keeps it from ping-ponging between two walls forever
    const a = Math.atan2(this.dy, this.dx) + (((this.clock * 13.7) % 1) - 0.5) * 0.35;
    this.dx = Math.cos(a); this.dy = Math.sin(a);
    this.bounceT = 0.18;
    const room = this.scene.room;
    if (room && room.tileAt) {
      const t = room.tileAt(this.x - nx * (RADIUS + 8), this.y - ny * (RADIUS + 8));
      if (t && t.type === 'breakable' && !t.broken) {
        const nearPlayer = Math.hypot(p.x - t.x, p.y - t.y) < BARREL_SAFE;
        if (!(t.barrel && nearPlayer)) room.damageTile(t, 1);
      }
    }
    this.scene.fx.dust(this.x, this.y + this.footOffset, 0.5);
    Sfx.play('step_dirt', { vol: 0.25, rate: 0.9 + ((this.clock * 5) % 1) * 0.3, gap: 0.15 });
  }
}
