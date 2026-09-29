// Spirit Lantern: ghost-flame familiar orbiting the player. Blocks enemy bullets (Bullets.js reads blocksBullets/x/y/radius/onBlock),
// deals 6 contact dps to enemies (1.5 every 0.25 s per enemy) and ignites them. Several copies share the orbit evenly.
import Phaser from 'phaser';
import Familiar from './Familiar.js';
import { Assets } from '../../core/Assets.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH, actorDepth } from '../../config.js';

const ORBIT = 96, SPEED = 2.8, LIFT = 40;
const hitAt = new WeakMap(); // enemy -> scene time of last lantern hit (shared between lanterns so 2 copies do not double-tick)

export default class SpiritLantern extends Familiar {
  constructor(player) {
    super(player);
    const s = this.scene;
    this.blocksBullets = true;
    this.radius = 34;
    this.ang = Math.random() * 6.28;
    this.t = 0;
    this.trailT = 0;
    this.shadow = this.own(s.add.image(0, 0, 'shadow').setScale(0.3).setAlpha(0.6).setDepth(DEPTH.shadows));
    this.glow = this.own(s.add.image(0, 0, 'glow').setTint(0x60ffb0).setBlendMode(Phaser.BlendModes.ADD).setScale(1.5).setDepth(DEPTH.bullets - 2));
    this.body = this.own(Assets.makeCell(s, 0, 0, 'projectiles', 'bullet_ghostfire', 0.5).setScale(1.7).setDepth(DEPTH.bullets - 1));
    this.core = this.own(s.add.image(0, 0, 'glow').setTint(0xe0fff0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.45).setDepth(DEPTH.bullets));
    this.place();
  }

  onBlock(b) {
    this.scene.fx.burst(b.x, b.y - LIFT, { color: [0x60ffb0, 0xe0fff0], count: 8, speed: [60, 200], life: [200, 380], scale: [1.5, 2.5] });
    Sfx.play('bullet_hit_wall', { vol: 0.35, rate: 1.6 + Math.random() * 0.3, gap: 0.08 });
    this.pulse = 0.18;
  }

  place() {
    const y = this.y - LIFT + Math.sin(this.t * 5) * 4;
    const a = Math.min(1, this.appear);
    const pl = 1 + (this.pulse > 0 ? this.pulse * 3 : 0);
    this.body.setPosition(this.x, y).setRotation(this.t * 3).setAlpha(a).setScale(1.7 * pl);
    this.glow.setPosition(this.x, y).setAlpha(a * (0.55 + Math.sin(this.t * 9) * 0.12)).setScale(1.5 * pl);
    this.core.setPosition(this.x, y).setAlpha(a * 0.9);
    this.shadow.setPosition(this.x, this.y + 6).setAlpha(0.5 * a);
    this.body.setDepth(actorDepth(this.y) + 2); this.core.setDepth(actorDepth(this.y) + 3);
  }

  update(dt, player) {
    if (!this.alive) return;
    this.t += dt;
    this.appear = Math.min(1, this.appear + dt * 4);
    this.pulse = Math.max(0, (this.pulse || 0) - dt);
    const mates = player.familiars.filter((f) => f instanceof SpiritLantern);
    const idx = mates.indexOf(this);
    this.ang += SPEED * dt;
    const a = this.ang + (idx / mates.length) * Math.PI * 2;
    // orbit centre = player body; the orbit point is followed loosely so the flame trails behind sharp turns
    this.follow(player.x + Math.cos(a) * ORBIT, player.y - 10 + Math.sin(a) * ORBIT * 0.85, dt, 30);
    // burn enemies
    const now = this.scene.time.now / 1000;
    for (const e of this.scene.enemies) {
      if (!e.alive || !e.targetable || e.invulnerable) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) > this.radius + e.hitRadius) continue;
      if (now - (hitAt.get(e) || 0) < 0.25) continue;
      hitAt.set(e, now);
      const res = e.takeHit(1.5, { x: this.x, y: this.y, angle: Math.atan2(e.y - this.y, e.x - this.x), knock: 0.5, source: this });
      if (res === 'hit' && e.alive) e.applyStatus('burn', { dps: 1, t: 1.2 });
    }
    // ghost-fire trail
    this.trailT -= dt;
    if (this.trailT <= 0) { this.trailT = 0.05; this.scene.fx.trail(this.x, this.y - LIFT, 0x60ffb0, 0.5); }
    this.place();
  }
}
