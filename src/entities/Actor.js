// Base for anything that walks the room plane: a circle (x,y = circle centre on the ground) + sprite + shadow.
// Collision is custom (Room.resolve): walls with door gaps + obstacle tiles. Arcade bodies are NOT used for actors.
import { DEPTH, actorDepth } from '../config.js';

export default class Actor {
  constructor(scene, x, y, o = {}) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = o.radius ?? 24;
    this.flying = !!o.flying; // ignores obstacles/pits (still bound by walls)
    this.ghost = !!o.ghost; // ignores obstacles and pits AND stays inside walls (used by phasing enemies)
    this.footOffset = o.footOffset ?? this.radius * 0.6; // sprite feet below circle centre
    this.airHeight = 0; // visual lift for flyers
    this.sprite = null;
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.shadows);
    this.shadowScale = o.shadowScale ?? (this.radius * 2.6) / 128;
    this.shadow.setScale(this.shadowScale);
    // last collision result (unit normal sum of pushes)
    this.hnx = 0;
    this.hny = 0;
    this.hit = false;
  }

  get footY() { return this.y + this.footOffset; }

  /** Move by (dx,dy) and resolve against walls/obstacles. */
  moveBy(dx, dy) {
    const room = this.scene.room;
    if (!room) { this.x += dx; this.y += dy; this.hit = false; return; }
    // sub-step long moves (dodge roll, knockback, lag spikes) so an actor can never tunnel through a wall or a 96px tile
    const maxStep = Math.max(8, this.radius * 0.8);
    const n = Math.min(8, Math.ceil(Math.hypot(dx, dy) / maxStep));
    if (n <= 1) { this.x += dx; this.y += dy; room.resolve(this); return; }
    let hit = false, hnx = 0, hny = 0;
    for (let i = 0; i < n; i++) {
      this.x += dx / n; this.y += dy / n;
      room.resolve(this);
      if (this.hit) { hit = true; hnx += this.hnx; hny += this.hny; }
    }
    this.hit = hit;
    if (hit) { const l = Math.hypot(hnx, hny); if (l > 0.001) { this.hnx = hnx / l; this.hny = hny / l; } }
  }

  /** Keep sprite + shadow glued to the circle. Call once per frame after movement. */
  syncVisual() {
    if (this.sprite) {
      this.sprite.setPosition(this.x, this.footY - this.airHeight);
      this.sprite.setDepth(actorDepth(this.footY));
    }
    if (this.shadow) {
      this.shadow.setPosition(this.x, this.footY - 3);
      this.shadow.setDepth(DEPTH.shadows);
      const k = 1 - Math.min(0.4, this.airHeight / 200);
      this.shadow.setScale(this.shadowScale * k);
    }
  }

  destroy() {
    if (this.sprite) { this.sprite.destroy(); this.sprite = null; }
    if (this.shadow) { this.shadow.destroy(); this.shadow = null; }
  }
}
