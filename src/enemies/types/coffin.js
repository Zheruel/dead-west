// COFFIN (floor 3): upright coffin that hops at the player. Cycle: rest 0.5 s (crouch; last 0.3 s = green-wisp windup pose) -> hop 0.55 s
// toward the player's position (max 300 px, arcs through the air) -> LANDING SHOCKWAVE (1 dmg inside the ring) -> rest again.
// The landing spot is marked with a warn ring from the moment the windup starts (~0.85 s total). It walks over obstacles while airborne.
// On death the lid bursts open and 2 bats fly out.
import Phaser from 'phaser';
import Enemy from '../Enemy.js';
import { registerEnemy, getEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { ROOM, actorDepth } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { darkWarn, shockRing } from '../f3fx.js';

const REST = 0.5;
const CROUCH = 0.3; // windup pose + ring shown before take-off
const HOP_T = 0.55;
const HOP_MAX = 300;
const HOP_H = 120;
const WAVE_R = 96;
const WOOD = [0x8a5a2a, 0x6b4423, 0xb8843f];

class Coffin extends Enemy {
  init() {
    this.setState('rest');
    this.timer = 0.6 + Math.random() * 0.5;
    this.baseContact = this.contactDamage;
    this.start = null; this.target = null; this.warn = null;
    this.frame(0);
  }

  frame(i) { if (this.sprite) { this.pose = `f${i}`; this.sprite.anims.stop(); this.sprite.setFrame(i); } }

  ai(dt) {
    switch (this.state) {
      case 'rest': {
        this.stop();
        this.timer -= dt;
        if (this.timer <= CROUCH && !this.warn) this.beginCrouch();
        if (this.timer <= 0) this.takeOff();
        break;
      }
      case 'hop': {
        const k = Math.min(1, this.stateTime / HOP_T);
        this.airHeight = Math.sin(Math.PI * k) * HOP_H;
        this.frame(k < 0.22 ? 1 : k < 0.82 ? 2 : 3);
        if (k >= 1) this.land();
        break;
      }
      default: break;
    }
  }

  beginCrouch() {
    const p = this.player;
    const d = this.distToPlayer();
    const a = this.angleToPlayer();
    const hop = Math.min(d, HOP_MAX);
    const tx = Phaser.Math.Clamp(this.x + Math.cos(a) * hop, ROOM.x + this.radius, ROOM.right - this.radius);
    const ty = Phaser.Math.Clamp(this.y + Math.sin(a) * hop, ROOM.y + this.radius, ROOM.bottom - this.radius);
    this.target = { x: tx, y: ty };
    this.frame(4);
    this.pulse(CROUCH);
    this.warn = darkWarn(this.scene, tx, ty, WAVE_R, CROUCH + HOP_T);
    Sfx.play('coffin_open', { vol: 0.5, rate: 1.2 + Math.random() * 0.2, gap: 0.15 });
  }

  takeOff() {
    this.setState('hop');
    this.start = { x: this.x, y: this.y };
    this.flying = true; // hops over rocks and pits
    this.contactDamage = 0;
    this.moveToward(this.target.x, this.target.y, Math.hypot(this.target.x - this.x, this.target.y - this.y) / HOP_T);
    this.scene.fx.dust(this.x, this.y + 20, 1.1);
    Sfx.play('step_wood', { vol: 0.7, rate: 0.7 });
  }

  land() {
    const s = this.scene, fx = s.fx, p = this.player;
    this.warn = null;
    this.stop();
    this.airHeight = 0;
    this.flying = !!this.meta.flying;
    this.moveBy(0, 0);
    this.contactDamage = this.baseContact;
    this.frame(3);
    this.setState('rest');
    this.timer = REST;
    fx.shake(0.007, 170);
    fx.dust(this.x, this.y + 18, 1.7);
    shockRing(s, this.x, this.y, WAVE_R, 0xffc890, 340);
    fx.burst(this.x, this.y + 10, { color: [0x6b5a48, 0x3a2f28, 0x9a8468], count: 12, speed: [90, 260], life: [250, 500], scale: [1.4, 2.6], gravity: 300, angle: [190, 350] });
    Sfx.play('bullet_hit_wall', { vol: 0.9, rate: 0.55 });
    Sfx.play('dig', { vol: 0.5, rate: 0.55 });
    if (Math.hypot(p.x - this.x, p.y - this.y) < WAVE_R) p.damage(1, { x: this.x, y: this.y, enemy: this, enemyName: 'coffin', kind: 'shockwave' });
  }

  onDeath(info) {
    if (info && info.silent) return;
    const s = this.scene, fx = s.fx;
    Sfx.play('coffin_open', { vol: 1, rate: 0.95 });
    Sfx.play('zombie_groan', { vol: 0.6, rate: 0.75 });
    fx.shake(0.008, 220);
    fx.burst(this.x, this.y - 50, { color: [0x9be060, 0x5acb30, 0xe8ffc0], count: 18, speed: [80, 260], life: [300, 650], scale: [1.4, 3], gravity: -60 });
    fx.burst(this.x, this.y - 40, { color: WOOD, count: 14, speed: [120, 340], life: [350, 700], scale: [1.6, 3.2], gravity: 500 });
    // lid-burst ghost frame (pose 5) flares and fades
    const g = Assets.makeSprite(s, this.x, this.footY - this.airHeight, this.spriteKey, 5);
    g.setDepth(actorDepth(this.footY) + 1);
    fx._track(g);
    s.tweens.add({ targets: g, alpha: 0, scale: 1.12, duration: 380, ease: 'Quad.easeIn', onComplete: () => { if (g.scene) g.destroy(); } });
    // release 2 bats
    const entry = getEnemy('bat');
    if (!entry) return;
    for (let i = 0; i < 2; i++) {
      const dx = (i ? 1 : -1) * 44;
      const bx = Phaser.Math.Clamp(this.x + dx, ROOM.x + 30, ROOM.right - 30), by = Phaser.Math.Clamp(this.y - 20, ROOM.y + 30, ROOM.bottom - 30);
      new entry.Class(s, bx, by, { id: 'bat', meta: entry.meta, floor: this.floor, instant: true, released: true });
    }
  }

  destroy() {
    if (this.warn) { this.warn.destroy(); this.warn = null; }
    super.destroy();
  }
}

registerEnemy('coffin', Coffin, { hp: 28, r: 40, speed: 130, floors: [3], weight: 2, tags: ['undead'], flip: false });
