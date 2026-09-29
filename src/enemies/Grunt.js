// Generic placeholder used when a template references an enemy id that has no implementation yet.
// Chases the player slowly using the real/placeholder sprite of the missing id, so rooms stay playable.
import Enemy from './Enemy.js';

export default class Grunt extends Enemy {
  init() { this.setState('chase'); this.wobble = Math.random() * 6; this.hitRadiusBonus = 0; }
  ai(dt) {
    const p = this.player;
    if (this.meta.speed === 0) { this.stop(); return; }
    this.wobble += dt;
    if (this.flying) this.airHeight = (this.meta.air ?? 30) + Math.sin(this.wobble * 4) * 6;
    this.steerToward(p.x, p.y, Math.min(this.speed, 150));
    this.faceToward(p.x);
  }
}
