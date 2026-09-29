// REFERENCE ENEMY. Copy this file to add a new enemy: extend Enemy, override init()/ai(), call registerEnemy().
// Behaviour: keeps mid distance, strafes, fires an aimed shot every ~1.4 s with a 0.4 s telegraph. Drops its hat on death.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH } from '../../config.js';
import { rng } from '../../core/rng.js';

class Outlaw extends Enemy {
  init() {
    this.setState('move');
    this.shotCd = 0.7 + Math.random() * 0.8;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 1 + Math.random();
  }

  ai(dt) {
    const p = this.player;
    this.faceToward(p.x);
    switch (this.state) {
      case 'move': {
        this.setPose('move');
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = 1.2 + Math.random() * 1.2; }
        this.keepDistance(380, this.strafe, this.speed, 60);
        this.shotCd -= dt;
        if (this.shotCd <= 0 && this.distToPlayer() < 720) {
          this.setState('aim');
          this.stop();
          this.telegraph(0.4, () => {
            this.setPose('attack');
            this.shoot(this.angleToPlayer(), { speed: 380, damage: 1, kind: 'enemy', offset: 34, up: 4 });
            Sfx.play('gun_cock', { vol: 0.5 });
            this.scene.fx.muzzle(this.x + Math.cos(this.angleToPlayer()) * 44, this.y - 30 + Math.sin(this.angleToPlayer()) * 20, this.angleToPlayer(), 0.8);
            this.setState('recoil');
            this.after(0.3, () => { this.setPose('move'); this.setState('move'); this.shotCd = 1.1 + Math.random() * 0.6; });
          });
        }
        break;
      }
      case 'aim': this.stop(); break; // waiting for telegraph timer
      case 'recoil': this.stop(); break;
      default: break;
    }
  }

  onWallHit() { this.strafe *= -1; }

  onDeath() {
    // hat pops off and settles as a decal-ish sprite
    const s = this.scene;
    const hat = s.add.image(this.x, this.y - 70, 'hat').setDepth(DEPTH.fx);
    s.fx._track(hat);
    const dx = rng.game.float(-60, 60);
    s.tweens.add({ targets: hat, x: this.x + dx, y: { value: this.y + 10, ease: 'Bounce.easeOut' }, angle: rng.game.float(-200, 200), duration: 700, onComplete: () => {
      s.tweens.add({ targets: hat, alpha: 0, delay: 2500, duration: 800, onComplete: () => hat.destroy() });
    } });
  }
}

registerEnemy('outlaw', Outlaw, { hp: 16, r: 30, speed: 130, floors: [1, 2], weight: 3 });
