// CROW (spawned by scarecrow; 3 HP, one-shot at base damage, not floor-scaled). Small flyer: flutters at the player on a weaving
// path; when within ~230 px it hangs (0.35 s wings-tucked telegraph) and DIVES in a straight line (~0.4 s), then flaps off and
// re-approaches. Contact damage 1.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';

class Crow extends Enemy {
  init() {
    this.setState('chase');
    this.t = Math.random() * 6;
    this.diveCd = 0.8 + Math.random() * 0.8;
    this.dir = 0;
    this.weave = Math.random() < 0.5 ? -1 : 1;
    Sfx.play('crow_caw', { vol: 0.35, rate: 1.2 + Math.random() * 0.3, detune: Math.random() * 400 });
  }

  ai(dt) {
    const p = this.player;
    this.t += dt;
    this.faceToward(p.x);
    this.airHeight = 40 + Math.sin(this.t * 9) * 7;
    switch (this.state) {
      case 'chase': {
        this.setPose('move');
        const a = this.angleToPlayer() + Math.sin(this.t * 3.2) * 0.7 * this.weave;
        this.moveAngle(a, this.speed * 0.75);
        this.diveCd -= dt;
        if (this.diveCd <= 0 && this.distToPlayer() < 240) {
          this.setState('aim'); this.stop();
          this.telegraph(0.35, () => {
            this.dir = this.angleToPlayer();
            this.setPose('attack'); this.setState('dive');
            Sfx.play('crow_caw', { vol: 0.3, rate: 1.4 + Math.random() * 0.3, gap: 0.15 });
          });
        }
        break;
      }
      case 'dive':
        this.moveAngle(this.dir, this.speed * 1.9);
        this.airHeight = 26;
        if (this.stateTime > 0.4) this.endDive();
        break;
      case 'aim': this.stop(); this.airHeight = 52; break;
      case 'retreat': {
        this.setPose('move');
        this.moveAngle(this.angleToPlayer() + Math.PI + Math.sin(this.t * 5) * 0.5, this.speed * 0.8);
        if (this.stateTime > 0.6) { this.setState('chase'); this.diveCd = 1 + Math.random() * 0.8; }
        break;
      }
      default: break;
    }
  }

  endDive() { this.setState('retreat'); this.weave *= -1; }
  onWallHit() { if (this.state === 'dive') this.endDive(); }
}

registerEnemy('crow', Crow, { hp: 3, r: 20, hitR: 26, speed: 220, floors: [], weight: 0, flying: true, air: 40, noFloorScale: true });
