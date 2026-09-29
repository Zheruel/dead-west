// SKELETON (floors 2-3): gunslinger that stands its ground. Rattles (0.55 s arms-out telegraph), then fires a SPINNING CROSS:
// 4 bullets (90 deg apart) every 0.16 s while the cross rotates ~15 deg per volley (9 volleys, ~1.4 s; the first cross is aimed
// so a gap points at the player). Then it relocates to a new spot 260-560 px from the player and repeats. Undead (silver bullets).
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { ROOM } from '../../config.js';

const VOLLEYS = 9, VOLLEY_GAP = 0.16, STEP = 15 * Math.PI / 180, BULLET_SPEED = 250, WINDUP = 0.55;

class Skeleton extends Enemy {
  init() {
    this.setState('idle');
    this.idleT = 0.4 + Math.random() * 0.6;
    this.spin = Math.random() < 0.5 ? -1 : 1;
    this.volley = 0; this.volleyT = 0; this.base = 0;
    this.dest = null;
  }

  ai(dt) {
    const p = this.player;
    this.faceToward(p.x);
    switch (this.state) {
      case 'idle':
        this.stop(); this.setPose('move');
        this.idleT -= dt;
        if (this.idleT <= 0 && this.distToPlayer() < 900) this.startBurst();
        break;
      case 'windup': this.stop(); break;
      case 'burst': {
        this.stop();
        this.volleyT -= dt;
        if (this.volleyT <= 0) {
          this.volleyT += VOLLEY_GAP;
          this.fireVolley();
          if (++this.volley >= VOLLEYS) {
            this.setState('idle'); this.idleT = 99;
            this.after(0.35, () => { this.setPose('move'); this.pickDest(); });
          }
        }
        break;
      }
      case 'relocate': {
        this.setPose('move');
        const d = Math.hypot(this.dest.x - this.x, this.dest.y - this.y);
        if (d < 24 || this.stateTime > 1.8) { this.setState('idle'); this.stop(); this.idleT = 0.5 + Math.random() * 0.5; break; }
        this.steerToward(this.dest.x, this.dest.y, this.speed * 2.4);
        break;
      }
      default: break;
    }
  }

  startBurst() {
    this.setState('windup');
    this.stop();
    this.spin = Math.random() < 0.5 ? -1 : 1;
    Sfx.play('skeleton_rattle', { vol: 0.8, rate: 0.95 + Math.random() * 0.15 });
    this.telegraph(WINDUP, () => {
      this.base = this.angleToPlayer() + Math.PI / 4; // gap toward the player
      this.volley = 0; this.volleyT = 0;
      this.setPose('attack');
      this.setState('burst');
    });
  }

  fireVolley() {
    const a0 = this.base + this.spin * STEP * this.volley;
    for (let i = 0; i < 4; i++) {
      const a = a0 + i * Math.PI / 2;
      this.shoot(a, { speed: BULLET_SPEED, damage: 1, offset: 34, up: 20 });
    }
    if (this.volley % 3 === 0) {
      Sfx.play('gun_cock', { vol: 0.35, rate: 1.2 + Math.random() * 0.3 });
      this.scene.fx.muzzle(this.x + Math.cos(a0) * 40, this.y - 24 + Math.sin(a0) * 24, a0, 0.6);
    }
  }

  pickDest() {
    const room = this.scene.room, p = this.player;
    let best = null, bs = -1;
    for (let i = 0; i < 16; i++) {
      const x = ROOM.x + 100 + Math.random() * (ROOM.w - 200), y = ROOM.y + 100 + Math.random() * (ROOM.h - 200);
      if (room && room.probe(x, y, this.radius + 4, this)) continue;
      const dp = Math.hypot(x - p.x, y - p.y), dm = Math.hypot(x - this.x, y - this.y);
      if (dm < 160) continue;
      const s = 1000 - Math.abs(dp - 400) + dm * 0.2 + Math.random() * 120;
      if (s > bs) { bs = s; best = { x, y }; }
    }
    this.dest = best || { x: ROOM.cx, y: ROOM.cy };
    this.setState('relocate');
  }

  onWallHit() { if (this.state === 'relocate') this.dest = { x: ROOM.cx + (Math.random() - 0.5) * 300, y: ROOM.cy + (Math.random() - 0.5) * 150 }; }
}

registerEnemy('skeleton', Skeleton, { hp: 18, r: 30, speed: 90, floors: [2, 3], weight: 3, tags: ['undead'] });
