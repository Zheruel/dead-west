// Trapdoor to the next floor (spawned after a boss). rec {x,y}
import { DEPTH } from '../config.js';
import { Assets } from '../core/Assets.js';

export default class Trapdoor {
  constructor(scene, rec, room) {
    this.scene = scene; this.rec = rec; this.room = room;
    this.x = rec.x; this.y = rec.y;
    this.age = 0;
    this.used = false;
    this.sprite = Assets.makeCell(scene, this.x, this.y + 60, 'props', 'trapdoor_open', 1).setDepth(DEPTH.floor + 3);
    this.sprite.setScale(1.0);
    this.sprite.setAlpha(0);
    scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 500 });
  }
  get objs() { return [this.sprite]; }
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
  destroy() { this.sprite.destroy(); }
}
