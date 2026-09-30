// Bone Hound (ITEMS_V2 4.4): trails the player at 90-140 px. With a living foe within 380 px it dashes (520 px/s), bites for max(3, damage * 1.5) x familiarMult
// (cooldown 0.6 s x familiarCd) and trots back; with the room empty it fetches coins / nickels / keys / dynamite (and hearts when hurt) within 400 px and collects
// them for you. Boneyard Pack: x1.5 speed and every bite marks. Pack Leader: bites carry burn / poison / chill / fear. Invulnerable, ignores bullets.
import { Pet, nearestEnemy, validTarget, bite as biteEnemy } from './familiarKit.js';
import { Sfx } from '../../core/Audio.js';

const DASH_SPEED = 520, TRAIL_SPEED = 360, FETCH_SPEED = 430;
const SEEK = 380, FETCH_R = 400;
const RING_MIN = 90, RING_MAX = 140;
const BITE_CD = 0.6, RETREAT = 0.3, DASH_MAX = 0.9, FETCH_MAX = 2.2;
const FETCH_TYPES = new Set(['coin', 'coin_nickel', 'key', 'dynamite', 'heart_full', 'heart_half']);

export default class BoneHound extends Pet {
  constructor(player) {
    super(player, { key: 'bone_hound', radius: 16, footOffset: 8, scale: 1, shadow: 0.34, fps: 7 });
    this.state = 'follow';
    this.target = null; // enemy while dashing, pickup while fetching
    this.stateT = 0;
    this.cd = 0.4;
    this.stuckT = 0;
    this.px = this.x; this.py = this.y;
  }

  tick(dt, p) {
    const st = p.stats;
    const k = st.boneyard ? 1.5 : 1;
    this.stateT += dt;
    if (this.cd > 0) this.cd -= dt;
    const ox = this.x, oy = this.y;
    switch (this.state) {
      case 'dash': this.dash(dt, p, k); break;
      case 'fetch': this.fetch(dt, p, k); break;
      case 'retreat': this.follow2(dt, p, k, true); if (this.stateT >= RETREAT) this.go('follow'); break;
      default: this.follow2(dt, p, k, false); this.think(p);
    }
    // stuck behind a rock: give up the task, or blink to the player when far
    const moved = Math.hypot(this.x - ox, this.y - oy);
    if (moved < 30 * dt && (this.state !== 'follow' || Math.hypot(p.x - this.x, p.y - this.y) > 220)) {
      this.stuckT += dt;
      if (this.stuckT > 0.7) { this.stuckT = 0; if (this.state === 'follow') this.warpToPlayer(p); else this.go('follow'); }
    } else this.stuckT = 0;
    const speed = moved / Math.max(dt, 1e-4);
    this.bob = speed > 60 ? Math.abs(Math.sin(this.t * 16)) * 5 : 0;
  }

  go(state, target = null) { this.state = state; this.stateT = 0; this.target = target; this.stuckT = 0; }

  /** Pick the next job (called while trailing): bite a foe, or fetch a pickup when the room is quiet. */
  think(p) {
    if (this.cd > 0) return;
    const scene = this.scene;
    const foe = nearestEnemy(scene, this.x, this.y, SEEK);
    if (foe) { this.go('dash', foe); return; }
    if (this.anyFoe()) return;
    const pk = this.findPickup(p);
    if (pk) { pk._claim = this; this.go('fetch', pk); }
  }

  anyFoe() {
    const list = this.scene.enemies;
    for (let i = 0; i < list.length; i++) if (validTarget(list[i])) return true;
    return false;
  }

  findPickup(p) {
    const room = this.scene.room;
    if (!room) return null;
    let best = null, bd = FETCH_R * FETCH_R;
    const list = room.pickups;
    for (let i = 0; i < list.length; i++) {
      const pk = list[i];
      if (!pk.alive || !pk.settled || pk.basePrice != null || !FETCH_TYPES.has(pk.type) || !p.canCollect(pk.type)) continue;
      if (pk._claim && pk._claim !== this && pk._claim.alive && pk._claim.state === 'fetch' && pk._claim.target === pk) continue;
      const d = (pk.x - this.x) ** 2 + (pk.y - this.y) ** 2;
      if (d < bd) { bd = d; best = pk; }
    }
    return best;
  }

  /** Trail the player on a 90-140 px ring (or trot back after a bite). */
  follow2(dt, p, k, hurry) {
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
    let vx = 0, vy = 0;
    if (d > RING_MAX) {
      const sp = Math.min(TRAIL_SPEED * k, 90 + (d - RING_MAX) * 5) * (hurry ? 1.2 : 1);
      vx = (dx / d) * sp; vy = (dy / d) * sp;
    } else if (d < RING_MIN) { vx = -(dx / d) * 150; vy = -(dy / d) * 150; } // do not stand on the player
    if (vx || vy) { if (Math.abs(vx) > 20) this.faceLeft = vx < 0; this.walk(vx, vy, dt); }
  }

  dash(dt, p, k) {
    const e = this.target;
    if (!validTarget(e) || this.stateT > DASH_MAX) { this.cd = Math.max(this.cd, 0.25); this.go('retreat'); return; }
    const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy) || 1;
    if (Math.abs(dx) > 10) this.faceLeft = dx < 0;
    if (d <= e.hitRadius + this.radius + 6) { this.bite(p, e, Math.atan2(dy, dx)); return; }
    const sp = DASH_SPEED * k;
    this.walk((dx / d) * sp, (dy / d) * sp, dt);
    this.spark(dt);
  }

  bite(p, e, ang) {
    const st = p.stats;
    const dmg = Math.max(3, st.damage * 1.5) * this.power;
    biteEnemy(p, e, dmg, ang, this);
    this.cd = BITE_CD * this.cdMult;
    this.squash = 0.14;
    this.scene.fx.burst(e.x, e.y - 24, { color: [0xe8dcc0, 0xff5a3a], count: 5, speed: [60, 200], life: [160, 340], scale: [1, 2.2] });
    Sfx.play('hound_growl', { vol: 0.4, rate: 1.15 + Math.random() * 0.2, gap: 0.3 });
    this.go('retreat');
  }

  fetch(dt, p, k) {
    const pk = this.target;
    if (!pk || !pk.alive || !p.canCollect(pk.type) || this.stateT > FETCH_MAX) { this.go('follow'); return; }
    if (this.anyFoe()) { this.go('follow'); return; }
    const dx = pk.x - this.x, dy = pk.y - this.y, d = Math.hypot(dx, dy) || 1;
    if (Math.abs(dx) > 10) this.faceLeft = dx < 0;
    if (d < 30) {
      pk.touch(p); // collects for the player (canCollect, coin multiplier, pop text...)
      this.scene.fx.burst(this.x, this.y - 20, { color: [0xffe090, 0xffffff], count: 4, speed: [30, 110], life: [160, 320], scale: [1, 2], blend: 'ADD' });
      this.squash = 0.1;
      this.go('follow');
      return;
    }
    const sp = FETCH_SPEED * k;
    this.walk((dx / d) * sp, (dy / d) * sp, dt);
    this.spark(dt);
  }

  /** Dust puffs while running flat out. */
  spark(dt) {
    this.dustT = (this.dustT || 0) - dt;
    if (this.dustT <= 0) { this.dustT = 0.09; this.scene.fx.dust(this.x, this.y + this.footOffset, 0.4); }
  }
}
