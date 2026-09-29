// RATTLESNAKE (floors 1-2): slow slithering coil. Weaves toward the player, stops, RATTLES (0.55 s telegraph: rears up, tail buzz,
// jitter) and spits a 3-bullet fan of venom (30 deg total) at the player's position at the moment of the spit. Walker: pits/blocks stop it.
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';

class Rattlesnake extends Enemy {
  init() {
    this.setState('slither');
    this.moveT = 1.6 + Math.random() * 1.4;
    this.weave = Math.random() * 6.28;
    this.ox = 0;
  }

  ai(dt) {
    const p = this.player;
    switch (this.state) {
      case 'slither': {
        this.setPose('move');
        this.faceToward(p.x);
        this.weave += dt * 3;
        // approach with a sinusoidal side-to-side weave; hold off when already close
        const a = this.angleToPlayer() + Math.sin(this.weave) * 0.6;
        const d = this.distToPlayer();
        const sp = d < 240 ? this.speed * 0.4 : this.speed;
        this.steerToward(this.x + Math.cos(a) * 100, this.y + Math.sin(a) * 100, sp);
        this.moveT -= dt;
        if (this.moveT <= 0 && d < 720) this.rattle();
        break;
      }
      case 'rattle':
        this.stop();
        this.faceToward(p.x);
        this.jit = Math.sin(this.stateTime * 90) * 2.5; // buzz: tiny horizontal shake of the sprite
        break;
      case 'spit': this.stop(); break;
      default: break;
    }
  }

  rattle() {
    this.setState('rattle');
    this.stop();
    Sfx.play('snake_rattle', { vol: 0.9, detune: (Math.random() - 0.5) * 200 });
    this.warn = this.scene.fx.warnCircle(this.x, this.y, 46, 0.55, 0x9be060);
    this.telegraph(0.55, () => this.spit());
  }

  syncVisual() { super.syncVisual(); if (this.jit && this.sprite) this.sprite.x += this.jit; }

  onDeath() { if (this.warn) this.warn.destroy(); }

  spit() {
    this.jit = 0;
    this.setState('spit');
    this.setPose('attack');
    const a = this.angleToPlayer();
    this.scene.bullets.enemy.fan({ x: this.x + Math.cos(a) * 34, y: this.y + Math.sin(a) * 34 - 6, speed: 300, damage: 1, kind: 'venom', lift: 34 }, 3, 30, a);
    this.scene.fx.burst(this.x + Math.cos(a) * 36, this.y - 30 + Math.sin(a) * 20, { color: [0x8fc23f, 0xc8f07a], count: 8, speed: [60, 200], life: [200, 380], scale: [1.5, 2.5] });
    Sfx.play('snake_hiss', { vol: 0.8, detune: (Math.random() - 0.5) * 200 });
    this.after(0.45, () => { this.setPose('move'); this.setState('slither'); this.moveT = 1.8 + Math.random() * 1.4; });
  }
}

registerEnemy('rattlesnake', Rattlesnake, { hp: 14, r: 28, speed: 70, floors: [1, 2], weight: 2, knockback: 90, fps: 6 });
