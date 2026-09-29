// POSSESSED (floors 2-3): red-eyed bandit. Walks at the player; inside ~260 px it plants its feet (0.5 s crouch + red warning
// lane), then LUNGES in a straight line (fast dash, stops at walls), then is winded/vulnerable for a beat before the next stalk.
// Below 50% HP it ENRAGES: red flame aura, groan, +30% speed (walk, lunge, shorter recovery).
import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH } from '../../config.js';

const LUNGE_RANGE = 260, LUNGE_SPEED = 640, LUNGE_TIME = 0.34, WINDUP = 0.5;

class Possessed extends Enemy {
  init() {
    this.setState('stalk');
    this.enraged = false;
    this.lungeCd = 0.6 + Math.random() * 0.8;
    this.dir = 0;
    this.rageT = 0;
    this.wob = Math.random() * 6;
  }

  get mult() { return this.enraged ? 1.3 : 1; }

  ai(dt) {
    const p = this.player;
    this.faceToward(p.x);
    switch (this.state) {
      case 'stalk': {
        this.setPose('move');
        this.steerToward(p.x, p.y, this.speed * this.mult);
        this.lungeCd -= dt * this.mult;
        if (this.lungeCd <= 0 && this.distToPlayer() < LUNGE_RANGE) this.startLunge();
        break;
      }
      case 'windup': this.stop(); break;
      case 'lunge': {
        this.setPose('attack');
        this.moveAngle(this.dir, LUNGE_SPEED * this.mult);
        this.dustT = (this.dustT || 0) - dt;
        if (this.dustT <= 0) { this.dustT = 0.07; this.scene.fx.dust(this.x, this.footY, 0.7); }
        if (this.stateTime >= LUNGE_TIME) this.endLunge();
        break;
      }
      case 'recover': this.stop(); break;
      default: break;
    }
  }

  startLunge() {
    this.setState('windup');
    this.stop();
    const a = this.angleToPlayer();
    const len = LUNGE_SPEED * this.mult * LUNGE_TIME;
    const w = WINDUP / (this.enraged ? 1.15 : 1);
    this.lane = this.scene.fx.warnLine(this.x, this.y, this.x + Math.cos(a) * len, this.y + Math.sin(a) * len, 54, w);
    Sfx.play('zombie_groan', { vol: 0.55, rate: 1.1 + Math.random() * 0.2 });
    this.telegraph(w, () => {
      this.lane = null;
      this.dir = this.angleToPlayer(); // final aim is re-read at the instant of the lunge (lane shows where it was aiming)
      this.dir = a + Phaser.Math.Angle.Wrap(this.dir - a) * 0.5; // half-corrected: rewards moving sideways during windup
      this.setState('lunge');
      Sfx.play('whip_crack', { vol: 0.5, rate: 0.9 });
      this.scene.fx.dust(this.x, this.footY, 1);
    });
  }

  endLunge() {
    this.stop();
    this.setState('recover');
    this.setPose('windup');
    this.lungeCd = 0.9 + Math.random() * 0.6;
    this.after(this.enraged ? 0.45 : 0.7, () => { this.setPose('move'); this.setState('stalk'); });
  }

  onWallHit() {
    if (this.state === 'lunge' && this.stateTime > 0.05) { this.scene.fx.shake(0.004, 90); this.endLunge(); }
  }

  onHit() {
    if (!this.enraged && this.alive && this.hp > 0 && this.hp <= this.maxHp * 0.5) this.enrage();
  }

  enrage() {
    this.enraged = true;
    const s = this.scene;
    this.rage = s.add.image(this.x, this.y, 'glow').setTint(0xff2a1a).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.shadows + 4).setAlpha(0.6);
    this.rage.setScale((this.radius * 4.4) / 128);
    this.pulse(0.5);
    Sfx.play('zombie_groan', { vol: 0.8, rate: 0.75 });
    Sfx.play('snake_hiss', { vol: 0.35, rate: 0.6 });
    s.fx.burst(this.x, this.y - 30, { color: [0xff2a1a, 0xff7a3a], count: 16, speed: [60, 220], life: [300, 600], scale: [1.5, 3], gravity: -120 });
    s.fx.shake(0.006, 160);
  }

  syncVisual() {
    super.syncVisual();
    if (this.rage) {
      this.wob += 0.2;
      this.rage.setPosition(this.x, this.footY - 24).setAlpha(0.5 + Math.sin(this.wob) * 0.12);
    }
    if (this.enraged && Math.random() < 0.12) this.scene.fx.burst(this.x, this.y - 40, { color: [0xff2a1a, 0xff7a3a], count: 1, speed: [10, 40], life: [400, 700], scale: [1.5, 2.5], angle: [250, 290] });
  }

  destroy() {
    if (this.lane) { this.lane.destroy(); this.lane = null; }
    if (this.rage) { this.rage.destroy(); this.rage = null; }
    super.destroy();
  }
}

registerEnemy('possessed', Possessed, { hp: 24, r: 30, speed: 120, floors: [2, 3], weight: 3, tags: ['undead'] });
