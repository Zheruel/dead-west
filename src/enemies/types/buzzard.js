// BUZZARD (floors 1-2): skull-faced flyer (ignores pits/obstacles, bobbing hover). Circles the room along an ellipse near the walls,
// then hangs in the air and SCREECHES (0.6 s telegraph: wings back, wide aim line to the far wall through the player, direction locked),
// then dives across the room in a straight line at high speed. Ends at the wall, recovers ~0.8 s (low, vulnerable), resumes circling.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { ROOM } from '../../config.js';

const SWOOP_SPEED = 600;

class Buzzard extends Enemy {
  init() {
    this.setState('circle');
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.th = Math.atan2((this.y - ROOM.cy) / (ROOM.h / 2), (this.x - ROOM.cx) / (ROOM.w / 2));
    this.circleT = 2 + Math.random() * 1.5;
    this.bob = Math.random() * 6;
    this.baseAir = this.meta.air ?? 50;
    this.airHeight = this.baseAir;
  }

  ai(dt) {
    const p = this.player;
    this.bob += dt * 5;
    switch (this.state) {
      case 'circle': {
        this.setPose('move');
        this.airHeight = this.baseAir + Math.sin(this.bob) * 7;
        this.faceToward(p.x);
        this.circleT -= dt;
        this.th += this.dir * (this.speed / 480) * dt;
        const rx = ROOM.w / 2 - 120, ry = ROOM.h / 2 - 95;
        const tx = ROOM.cx + Math.cos(this.th) * rx, ty = ROOM.cy + Math.sin(this.th) * ry;
        const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
        const sp = Math.min(this.speed * 1.4, d / Math.max(dt, 0.001));
        this.vx = (dx / d) * sp; this.vy = (dy / d) * sp;
        if (this.circleT <= 0) this.screech();
        break;
      }
      case 'screech':
        this.stop();
        this.airHeight = this.baseAir + 14 + Math.sin(this.stateTime * 40) * 3; // rears up, trembling
        break;
      case 'swoop': {
        this.airHeight += (24 - this.airHeight) * Math.min(1, dt * 12);
        this.trailT = (this.trailT || 0) - dt;
        if (this.trailT <= 0) { this.trailT = 0.05; this.scene.fx.trail(this.x, this.footY - this.airHeight - 20, 0x8a7a70, 0.7); }
        this.moveAngle(this.aimAngle, SWOOP_SPEED); // re-applied every frame so stun / fear cannot stall the dive
        this.travel += SWOOP_SPEED * dt;
        if (this.travel > 1900) this.endSwoop();
        break;
      }
      case 'recover':
        this.airHeight += (8 - this.airHeight) * Math.min(1, dt * 6);
        this.stop();
        break;
      default: break;
    }
  }

  screech() {
    this.setState('screech');
    this.stop();
    const a = this.angleToPlayer();
    this.aimAngle = a;
    this.warn = this.scene.fx.warnLine(this.x, this.y, this.x + Math.cos(a) * 1500, this.y + Math.sin(a) * 1500, 64, 0.6);
    Sfx.play('buzzard_screech', { vol: 0.85, detune: (Math.random() - 0.5) * 240 });
    this.telegraph(0.6, () => {
      this.setState('swoop');
      this.setPose('attack');
      this.travel = 0;
      this.moveAngle(this.aimAngle, SWOOP_SPEED);
      this.faceToward(this.x + this.vx);
      Sfx.play('whip_crack', { vol: 0.3, rate: 1.8 });
    });
  }

  onWallHit(nx, ny) {
    if (this.state === 'swoop') {
      this.scene.fx.dust(this.x, this.footY, 0.8);
      this.scene.fx.shake(0.003, 80);
      this.endSwoop();
    }
  }

  onDeath() { if (this.warn) this.warn.destroy(); }

  endSwoop() {
    this.setState('recover');
    this.stop();
    this.setPose('move');
    this.after(0.8, () => {
      this.setState('circle');
      this.circleT = 2 + Math.random() * 1.5;
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.th = Math.atan2((this.y - ROOM.cy) / (ROOM.h / 2), (this.x - ROOM.cx) / (ROOM.w / 2));
    });
  }
}

registerEnemy('buzzard', Buzzard, { hp: 10, r: 30, speed: 200, floors: [1, 2], weight: 2, flying: true, air: 50, knockback: 90, fps: 9 });
