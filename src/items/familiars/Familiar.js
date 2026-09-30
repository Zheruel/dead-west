// Base class for item companions / attachments (spirit lantern, crow, shield pip, dead-eye reticle...).
// Contract with Player: player.addFamiliar(f) -> f.update(dt, player) every frame; Player.destroy() -> f.destroy().
// Bullets.js also reads optional f.blocksBullets / f.x / f.y / f.radius / f.onBlock(bullet) for enemy-bullet blocking.
// `isFamiliar` marks bullets fired with `source: familiar`: Bullets applies stats.familiarMult (damage) and stats.spectralFamiliars (pass rocks), and
// Pack Leader's status inheritance. Subclasses scale their own cooldowns with `this.cdMult` (stats.familiarCd).
// Cleanup: every display object created through own() is (a) excluded from room-transition snapshots, (b) faded out when the
// player dies, (c) destroyed on destroy() / scene shutdown. Familiars persist across rooms and floors; they snap to the player
// after a room slide (see follow()).
import { bus } from '../../core/events.js';

export default class Familiar {
  constructor(player) {
    this.player = player;
    this.scene = player.scene;
    this.x = player.x;
    this.y = player.y;
    this.alive = true;
    this.isFamiliar = true;
    this.objs = [];
    this.appear = 0; // 0..1 fade-in after (re)spawn / snap
    this.offDied = bus.scoped(this.scene, 'player:died', () => this.onOwnerDied());
  }

  /** Cooldown multiplier from Pack Leader and friends (< 1 = faster). */
  get cdMult() { return this.player.stats.familiarCd || 1; }
  /** Damage multiplier applied by Bullets to this familiar's shots (for familiars that hurt directly instead of firing bullets). */
  get power() { return this.player.stats.familiarMult || 1; }

  /** Register a display object: hidden from room snapshots, cleaned up automatically. */
  own(o) { o.__noSnap = true; this.objs.push(o); return o; }

  /** Ease toward (tx,ty); teleports (and re-fades in) when the player jumped far (room slide / debug teleport). */
  follow(tx, ty, dt, rate = 6) {
    if (Math.hypot(tx - this.x, ty - this.y) > 520) { this.x = tx; this.y = ty; this.appear = 0; return; }
    const k = Math.min(1, dt * rate);
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
  }

  update(dt, player) {}

  onOwnerDied() {
    if (!this.alive) return;
    this.alive = false; // stops update()
    this.blocksBullets = false;
    const live = this.objs.filter((o) => o.scene);
    if (live.length) this.scene.tweens.add({ targets: live, alpha: 0, y: '-=30', duration: 500, onComplete: () => this.destroy() });
    else this.destroy();
  }

  destroy() {
    this.alive = false;
    this.blocksBullets = false;
    if (this.offDied) { this.offDied(); this.offDied = null; }
    for (const o of this.objs) { try { if (o.scene) { this.scene.tweens.killTweensOf(o); o.destroy(); } } catch (e) { /* scene already gone */ } }
    this.objs.length = 0;
    const i = this.player.familiars.indexOf(this);
    if (i >= 0) this.player.familiars.splice(i, 1);
  }
}
