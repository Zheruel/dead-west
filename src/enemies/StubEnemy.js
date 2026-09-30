// Placeholder behaviours for the chapter-2 enemies until their FE-E* jobs replace the stub files in `types/`.
// StubShooter: holds a mid distance, strafes, and fires one telegraphed aimed shot every ~2.6 s (windup >= 0.5 s). Chasers just extend Grunt.
// Remove this file once every chapter-2 enemy has its real class.
import Enemy from './Enemy.js';

export class StubShooter extends Enemy {
  init() {
    this.setState('move');
    this.shotCd = 1.2 + Math.random() * 1.2;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 1 + Math.random();
    this.wobble = Math.random() * 6;
  }

  ai(dt) {
    const p = this.player;
    this.faceToward(p.x);
    if (this.flying) { this.wobble += dt; this.airHeight = (this.meta.air ?? 30) + Math.sin(this.wobble * 4) * 6; }
    if (this.state === 'aim') { this.stop(); return; }
    this.setPose('move');
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = 1.2 + Math.random() * 1.2; }
    if (this.speed > 0) this.keepDistance(this.meta.stubRange ?? 360, this.strafe, Math.min(this.speed, 140), 60); else this.stop();
    this.shotCd -= dt;
    if (this.shotCd > 0 || this.distToPlayer() > 720) return;
    this.setState('aim');
    this.stop();
    this.telegraph(0.5, () => {
      this.setPose('attack');
      this.shoot(this.angleToPlayer(), { speed: 300, damage: 1, kind: 'enemy', offset: 32, up: 4 });
      this.after(0.3, () => { this.setPose('move'); this.setState('move'); this.shotCd = 2.2 + Math.random() * 0.8; });
    });
  }

  onWallHit() { this.strafe *= -1; }
}
