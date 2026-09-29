// MINER (floor 3): big slow armoured zombie miner. Its helmet lamp lights a pool on the floor in front of it = its FACING.
// Facing turns slowly toward the player (1.3 rad/s) so circling to its side/back works. Hits from the front cone take x0.6
// damage (sparks + clang); side/rear hits are full damage. Pickaxe smash: when close, 0.7 s windup (locked direction, warn circle
// on the ground in front), then a heavy 2-unit slam; afterwards it is stuck in the recovery pose for ~0.9 s (free flank window).
import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { DEPTH } from '../../config.js';
import { darkWarn, shockRing, wrap } from '../f3fx.js';

const FRONT_ARC = 1.05; // rad half-angle of the armoured front cone (60 deg)
const TURN = 1.3; // rad/s facing turn rate while walking
const WINDUP = 0.7;
const REACH = 84; // slam centre distance from the miner
const SLAM_R = 92; // slam radius
const RECOVER = 0.9;

class Miner extends Enemy {
  init() {
    this.setState('walk');
    this.face = this.angleToPlayer();
    this.groanT = 1.5 + Math.random() * 2;
    this.cool = 0.6; // grace before the first swing
    this.lamp = this.scene.add.image(this.x, this.y, 'glow').setTint(0xffc060).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.32).setDepth(DEPTH.shadows + 3).setDisplaySize(250, 190);
    this.scene.fx._track(this.lamp);
    this.warn = null;
  }

  faceLerp(dt, rate) {
    const p = this.player;
    const want = Math.atan2(p.y - this.y, p.x - this.x);
    const d = wrap(want - this.face);
    this.face = wrap(this.face + Math.max(-rate * dt, Math.min(rate * dt, d)));
  }

  ai(dt) {
    const p = this.player;
    this.sprite.setFlipX(Math.cos(this.face) < 0);
    switch (this.state) {
      case 'walk': {
        this.setPose('move');
        this.faceLerp(dt, TURN);
        this.steerToward(p.x, p.y, this.speed);
        this.cool -= dt;
        this.groanT -= dt;
        if (this.groanT <= 0) { this.groanT = 3 + Math.random() * 3; if (this.distToPlayer() < 650) Sfx.play('zombie_groan', { vol: 0.55, rate: 0.85 + Math.random() * 0.15 }); }
        if (this.cool <= 0 && this.distToPlayer() < REACH + SLAM_R * 0.55 + this.radius) this.startSwing();
        break;
      }
      case 'wind': this.stop(); break; // facing locked
      case 'slam': this.stop(); break;
      default: break;
    }
  }

  startSwing() {
    this.setState('wind');
    this.stop();
    this.face = this.angleToPlayer();
    const cx = this.x + Math.cos(this.face) * REACH, cy = this.y + Math.sin(this.face) * REACH * 0.85;
    this.warn = darkWarn(this.scene, cx, cy, SLAM_R, WINDUP);
    Sfx.play('zombie_groan', { vol: 0.8, rate: 0.7 });
    this.telegraph(WINDUP, () => this.slam(cx, cy));
  }

  slam(cx, cy) {
    this.setState('slam');
    this.setPose('attack');
    const s = this.scene, fx = s.fx;
    Sfx.play('bullet_hit_wall', { vol: 1, rate: 0.55 });
    Sfx.play('dig', { vol: 0.7, rate: 0.6 });
    fx.shake(0.009, 200);
    fx.hitStop(35);
    fx.dust(cx, cy + 10, 1.5);
    shockRing(s, cx, cy, SLAM_R, 0xffb070, 300);
    fx.burst(cx, cy, { color: [0x6b5a48, 0x3a2f28, 0x9a8468], count: 16, speed: [100, 340], life: [300, 600], scale: [1.5, 3], gravity: 400 });
    const p = this.player;
    if (Math.hypot(p.x - cx, p.y - cy) < SLAM_R + p.hurtRadius * 0.4) p.damage(2, { x: cx, y: cy, enemy: this, enemyName: 'miner', kind: 'melee' });
    this.after(RECOVER, () => { this.setPose('move'); this.setState('walk'); this.cool = 0.5 + Math.random() * 0.6; });
  }

  /** Front cone armour. Source position = bullet position (or reverse of travel angle). */
  damageMultiplier(info) {
    if (info.explosion) return 1; // blasts ignore the armour
    let src = null;
    if (info.x != null && info.y != null) src = Math.atan2(info.y - this.y, info.x - this.x);
    else if (info.angle != null) src = info.angle + Math.PI;
    if (src == null || this.state === 'slam') return 1; // no source info / recovering: armour down
    if (Math.abs(wrap(src - this.face)) < FRONT_ARC) {
      const fx = this.scene.fx;
      fx.impact(this.x + Math.cos(src) * this.radius, this.y - 34 + Math.sin(src) * 12, src, 0.9);
      fx.burst(this.x + Math.cos(src) * this.radius, this.y - 34, { color: [0xffe6a0, 0xffffff], count: 4, speed: [80, 220], life: [120, 240], scale: [1.2, 2] });
      Sfx.play('bullet_hit_wall', { vol: 0.5, rate: 1.6 + Math.random() * 0.4, gap: 0.05 });
      return 0.6;
    }
    return 1;
  }

  syncVisual() {
    super.syncVisual();
    if (this.lamp) this.lamp.setPosition(this.x + Math.cos(this.face) * 95, this.footY - 10 + Math.sin(this.face) * 60).setRotation(0).setAlpha(this.state === 'wind' ? 0.18 : 0.32);
  }

  onDeath() { Sfx.play('zombie_groan', { vol: 0.8, rate: 0.6 }); }

  destroy() {
    if (this.warn) { this.warn.destroy(); this.warn = null; }
    if (this.lamp) { this.lamp.destroy(); this.lamp = null; }
    super.destroy();
  }
}

registerEnemy('miner', Miner, { hp: 40, r: 40, speed: 60, floors: [3], weight: 2, tags: ['undead'], heavy: true, fps: 6 });
