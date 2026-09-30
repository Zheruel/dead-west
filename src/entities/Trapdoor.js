// Trapdoor to the next floor (spawned after a boss). rec {x,y}. The floor-4 hole (into Hell proper) glows red (CHAPTER2 s6): red tint + a pulsing ember glow.
import { DEPTH } from '../config.js';
import { Assets } from '../core/Assets.js';

const HELL_FLOOR = 4;
const HELL_TINT = 0xff6a48;

export default class Trapdoor {
  constructor(scene, rec, room) {
    this.scene = scene; this.rec = rec; this.room = room;
    this.x = rec.x; this.y = rec.y;
    this.age = 0;
    this.used = false;
    this.sprite = Assets.makeCell(scene, this.x, this.y + 60, 'props', 'trapdoor_open', 1).setDepth(DEPTH.floor + 3);
    this.sprite.setScale(1.0);
    this.sprite.setAlpha(0);
    this.glow = null;
    if (room && room.floor === HELL_FLOOR) {
      this.sprite.setTint(HELL_TINT);
      if (scene.textures.exists('glow')) {
        this.glow = scene.add.image(this.x, this.y + 30, 'glow').setTint(0xff3a10).setBlendMode('ADD').setScale(3.2, 1.6).setAlpha(0).setDepth(DEPTH.floor + 2);
        scene.tweens.add({ targets: this.glow, alpha: { from: 0.15, to: 0.5 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
    scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 500 });
  }
  get objs() { return this.glow ? [this.sprite, this.glow] : [this.sprite]; }
  update(dt) {
    this.age += dt;
    const p = this.scene.player;
    if (this.used || !p || p.dead || this.age < 0.8 || this.scene.transitioning) return;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    // arm only after the player has been clear of the hole: a boss that dies while you stand on the spot must not drop you through
    // before you can grab the reward pedestal next to it
    if (!this.armed) { if (d > 90) this.armed = true; return; }
    if (d < 46) {
      this.used = true;
      this.scene.roomMgr.descend();
    }
  }
  destroy() {
    if (this.glow) { this.scene.tweens.killTweensOf(this.glow); this.glow.destroy(); this.glow = null; }
    this.sprite.destroy();
  }
}
