// Shared base of the 8 room modifiers. A modifier instance lives as long as its Room (room._mod). Overlays run always; gameplay effects only while the
// room is in combat, on a clock that starts at Room.lock(). Subclasses implement `overlay(dt)` (visuals, every frame) and `effect(dt)` (combat only).
import { RNG } from '../../../core/rng.js';
import { bus } from '../../../core/events.js';

export class Mod {
  constructor(room, cfg, salt) {
    this.room = room;
    this.scene = room.scene;
    this.cfg = cfg;
    this.id = cfg.id;
    this.rng = new RNG(((room.def && room.def.seed) ^ salt) >>> 0);
    this.t = 0; // seconds of combat since lock
    this.running = false;
    this.offs = [];
  }

  /** bus subscription removed with the modifier */
  on(event, fn) { this.offs.push(bus.scoped(this.scene, event, fn, this)); }

  get combat() { return this.running && this.room.mode === 'combat'; }

  lock() { this.running = true; this.t = 0; this.onLock(); }
  update(dt) {
    this.overlay(dt);
    if (this.combat) { this.t += dt; this.effect(dt); }
  }
  clear() { this.running = false; this.onClear(); }
  destroy() {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.onDestroy();
  }

  onLock() {}
  onClear() {}
  onDestroy() {}
  overlay(dt) {}
  effect(dt) {}
}
