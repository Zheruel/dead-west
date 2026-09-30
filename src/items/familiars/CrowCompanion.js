// Crow Companion: follows the player, hovering behind them, and shoots 0.5x-damage bullets (inheriting poison/burn/fear) at the nearest enemy.
import Familiar from './Familiar.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { ROOM, DEPTH, actorDepth } from '../../config.js';

const LIFT = 56;

export default class CrowCompanion extends Familiar {
  constructor(player) {
    super(player);
    const s = this.scene;
    this.t = Math.random() * 6;
    this.cd = 0.6;
    this.shots = 0;
    this.squash = 0;
    this.shadow = this.own(s.add.image(0, 0, 'shadow').setScale(0.3).setAlpha(0.5).setDepth(DEPTH.shadows));
    Assets.ensureAnim(s, 'enemy_crow', { start: 0, end: 3, fps: 12, name: 'familiar' });
    this.sprite = this.own(Assets.makeSprite(s, 0, 0, 'enemy_crow', 0).setScale(0.78));
    this.sprite.play('enemy_crow:familiar');
    this.sprite.anims.setProgress(Math.random());
    this.sprite.setOrigin(0.5, 0.75);
    this.x -= 50; this.y += 20;
    this.place(0);
  }

  place(vx) {
    const a = Math.min(1, this.appear);
    const bob = Math.sin(this.t * 3.2) * 6;
    const sq = this.squash > 0 ? 1 + this.squash * 2.5 : 1;
    this.sprite.setPosition(this.x, this.y - LIFT + bob).setAlpha(a).setScale(0.78 * sq, 0.78 / sq).setRotation(Math.max(-0.35, Math.min(0.35, vx * 0.0012)));
    this.sprite.setDepth(actorDepth(this.y) + 5);
    this.shadow.setPosition(this.x, this.y + 8).setAlpha(0.45 * a).setScale(0.3 - bob * 0.004);
  }

  update(dt, player) {
    if (!this.alive) return;
    this.t += dt;
    this.appear = Math.min(1, this.appear + dt * 3);
    this.squash = Math.max(0, this.squash - dt);
    const mates = player.familiars.filter((f) => f instanceof CrowCompanion);
    const idx = mates.indexOf(this);
    // hover behind the player (opposite of facing/velocity) with a slow figure-8 drift; extra crows fan out
    const sp = Math.hypot(player.vx, player.vy);
    let bx = -player.vx, by = -player.vy;
    const bl = Math.hypot(bx, by);
    if (bl > 60) { bx /= bl; by /= bl; } else { bx = -0.6; by = 0.5; }
    const spread = (idx - (mates.length - 1) / 2) * 1.1;
    const c = Math.cos(spread), sn = Math.sin(spread);
    const dx = bx * c - by * sn, dy = bx * sn + by * c;
    const tx = player.x + dx * 78 + Math.sin(this.t * 1.3) * 16;
    const ty = player.y + dy * 62 + Math.sin(this.t * 2.1) * 12 + 14;
    const ox = this.x;
    this.follow(tx, ty, dt, 3.2 + sp * 0.004);
    this.x = Math.max(ROOM.x + 30, Math.min(ROOM.right - 30, this.x));
    this.y = Math.max(ROOM.y + 30, Math.min(ROOM.bottom - 10, this.y));

    // shooting
    this.cd -= dt;
    if (this.cd <= 0) {
      let best = null, bd = 720 * 720;
      for (const e of this.scene.enemies) {
        if (!e.alive || !e.targetable || e.spawnT > 0) continue;
        const d2 = (e.x - this.x) ** 2 + (e.y - this.y) ** 2;
        if (d2 < bd) { bd = d2; best = e; }
      }
      if (best) this.shoot(best, player);
      else this.cd = 0.2;
    }
    this.place((this.x - ox) / Math.max(dt, 0.001));
  }

  shoot(target, player) {
    const s = player.stats;
    const ang = Math.atan2(target.y - this.y, target.x - this.x);
    const b = this.scene.bullets.player.fire({
      x: this.x + Math.cos(ang) * 22, y: this.y + Math.sin(ang) * 22, angle: ang, speed: 640, life: 1.0,
      damage: Math.max(0.5, s.damage * 0.5), size: 0.7, lift: LIFT - 4, source: this,
      poison: s.poison, burn: s.burn && player.crng.chance(s.burn) ? 1 : 0, fear: s.fearChance && player.crng.chance(s.fearChance) ? 1 : 0, // seeded combat stream
      homing: 0.35, tint: 0xb8a0ff,
    });
    if (b) { b.glow.setTint(0x9070ff); if (b.streak) b.streak.setTint(0x9070ff); } // null when the live-bullet cap refused the shot
    this.cd = Math.max(0.55, s.fireDelay * 1.5) * this.cdMult; // Pack Leader: faster
    this.squash = 0.12;
    this.shots++;
    Sfx.play('shoot', { vol: 0.28, rate: 1.5 + Math.random() * 0.3, gap: 0.05 });
    if (this.shots % 5 === 1) Sfx.play('crow_caw', { vol: 0.3, rate: 1.1 + Math.random() * 0.3, gap: 0.5 });
    this.scene.fx.burst(this.x, this.y - LIFT, { color: [0xb8a0ff, 0x3a2a5a], count: 3, speed: [30, 90], life: [150, 300], scale: [1, 2] });
  }
}
