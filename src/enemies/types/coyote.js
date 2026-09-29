// COYOTE (floor 1): mangy fast pack hunter. Circles the player at ~300 px, then stops and HOWLS (0.45 s telegraph: crouch pose,
// aim line drawn on the floor, direction locked), then charges in a straight line at high speed. Bounces off a wall/obstacle ONCE
// (dust + shake), ends the charge on the second impact (or after a max distance), then stands panting for ~0.9 s (vulnerable).
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';

const CHARGE_SPEED = 640;
const MAX_CHARGE = 1500; // px of total travel before it gives up

class Coyote extends Enemy {
  init() {
    this.setState('circle');
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.orbit = Math.random() * 6.28;
    this.circleT = 1.4 + Math.random() * 1.2;
    this.bounces = 0; this.travel = 0;
    this.lastDust = 0;
  }

  ai(dt) {
    const p = this.player;
    switch (this.state) {
      case 'circle': {
        this.setPose('move');
        this.faceToward(p.x);
        this.circleT -= dt;
        // orbit point around the player; radius eases toward 300; advance angle by our own tangential speed
        const d = Math.max(120, this.distToPlayer());
        this.orbit += this.dir * (this.speed * 0.8 / 320) * dt;
        const rad = 280 + Math.sin(this.stateTime * 2.2) * 40;
        const tx = Math.min(1290, Math.max(150, p.x + Math.cos(this.orbit) * rad));
        const ty = Math.min(810, Math.max(246, p.y + Math.sin(this.orbit) * rad * 0.8));
        this.steerToward(tx, ty, this.speed);
        // stuck against an obstacle -> flip orbit direction
        if (this.hit && Math.random() < 0.05) this.dir *= -1;
        if (this.circleT <= 0 && d < 560 && d > 200) this.howl();
        else if (this.circleT <= -2) this.howl();
        break;
      }
      case 'howl': this.stop(); this.faceToward(p.x); break;
      case 'charge': {
        this.moveAngle(this.cAng, CHARGE_SPEED); // re-applied every frame so stun / fear cannot leave it stalled mid-charge
        this.travel += CHARGE_SPEED * dt;
        this.lastDust -= dt;
        if (this.lastDust <= 0) { this.lastDust = 0.06; this.scene.fx.dust(this.x, this.footY, 0.5); }
        if (this.travel > MAX_CHARGE) this.endCharge(false);
        break;
      }
      case 'rest': this.stop(); this.setPose('move'); break;
      default: break;
    }
  }

  howl() {
    this.setState('howl');
    this.stop();
    const a = this.angleToPlayer();
    // lock direction slightly before the charge (0.15 s into the howl the aim is frozen) so a sideways step dodges it
    const line = this.scene.fx.warnLine(this.x, this.y, this.x + Math.cos(a) * 760, this.y + Math.sin(a) * 760, 54, 0.45);
    this.aimAngle = a;
    this.warn = line;
    Sfx.play('coyote_howl', { vol: 0.85, detune: (Math.random() - 0.5) * 240 });
    this.telegraph(0.45, () => this.startCharge());
    this.scene.fx.dust(this.x, this.footY, 0.8);
  }

  startCharge() {
    this.setState('charge');
    this.setPose('attack');
    this.travel = 0; this.bounces = 0;
    this.cAng = this.aimAngle;
    this.moveAngle(this.cAng, CHARGE_SPEED);
    this.faceToward(this.x + this.vx);
    this.scene.fx.dust(this.x, this.footY, 1.1);
    Sfx.play('whip_crack', { vol: 0.35, rate: 1.5 });
  }

  onWallHit(nx, ny) {
    if (this.state !== 'charge') return;
    this.scene.fx.dust(this.x - nx * this.radius, this.footY, 0.9);
    this.scene.fx.shake(0.004, 90);
    Sfx.play('bullet_hit_wall', { vol: 0.5, detune: -500 });
    if (this.bounces >= 1) { this.endCharge(true); return; }
    this.bounces++;
    // reflect velocity about the surface normal
    const dx = Math.cos(this.cAng), dy = Math.sin(this.cAng), dot = dx * nx + dy * ny;
    if (dot < 0) this.cAng = Math.atan2(dy - 2 * dot * ny, dx - 2 * dot * nx);
    this.moveAngle(this.cAng, CHARGE_SPEED);
    this.faceToward(this.x + this.vx);
  }

  onDeath() { if (this.warn) this.warn.destroy(); }

  endCharge(hitWall) {
    this.setState('rest');
    this.stop();
    this.setPose('move');
    if (hitWall) { this.knock.x = 0; this.knock.y = 0; }
    this.after(0.9 + Math.random() * 0.3, () => { this.setState('circle'); this.circleT = 1.3 + Math.random() * 1.2; this.dir = Math.random() < 0.5 ? -1 : 1; });
  }
}

registerEnemy('coyote', Coyote, { hp: 12, r: 30, speed: 210, floors: [1], weight: 3, knockback: 110, fps: 12 });
