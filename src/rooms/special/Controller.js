// Base class for room controllers (event, champion, vault, crossroads, secret variants, modifiers hosted by Room).
//
// Contract (ARCH_V2 s7):  new C(room, def, state)  ->  build() once  ->  onEnter() when the player has walked in  ->  update(dt) every frame
//   -> onCleared() when the room's encounter is cleared  ->  destroy() on room teardown (also when the player merely leaves).
// * Display objects go through `this.track(obj)` (Room destroys them with the room).
// * Persistent data lives ONLY in `this.state` (plain JSON, `state.event` / `state.ctl` of the room state): a revisit rebuilds the
//   controller from it, so nothing is rewarded twice. Never store Phaser objects there.
// * Bus listeners registered through `this.on()` are removed in destroy().
import { bus } from '../../core/events.js';
import { subRng } from '../../core/rng.js';

export default class Controller {
  /**
   * @param room  live Room
   * @param def   room definition (floor.byId[id]): {id, type, template, seed, event?, variant?, mod?, mini?}
   * @param state persistent state object for this controller (Room passes `roomState.event` or `roomState.ctl`)
   */
  constructor(room, def, state) {
    this.room = room;
    this.scene = room.scene;
    this.def = def;
    this.state = state || {};
    this.destroyed = false;
    this.age = 0;
    this._offs = [];
  }

  /** Called once by Room.buildContents after tiles, doors and standard contents exist. */
  build() {}
  /** Called by Room.onEntered once the slide is over (first and every later visit). */
  onEnter() {}
  /** Called once when the room's encounter is cleared (never for rooms that start cleared). */
  onCleared() {}
  /** Per frame while the room is live. Subclasses call super.update(dt) first. */
  update(dt) { this.age += dt; }
  /** Room teardown. Subclasses call super.destroy() last. */
  destroy() {
    this.destroyed = true;
    for (const off of this._offs) off();
    this._offs.length = 0;
  }

  // ---------------------------------------------------------------------------------------------- helpers
  track(obj) { return this.room.track(obj); }
  get player() { return this.scene.player; }
  /** Deterministic stream for outcome rolls: a function of (seed, label, room seed, n) so reordering actions cannot reroll (EVENTS s12). */
  rng(label, n = 0) { return subRng(label, this.def.seed, n); }
  /** Bus listener that lives exactly as long as this controller. */
  on(evt, fn) {
    bus.on(evt, fn, this);
    const off = () => bus.off(evt, fn, this);
    this._offs.push(off);
    return off;
  }
  /** Delayed call that never fires into a destroyed controller / torn-down room. */
  later(ms, fn) {
    return this.scene.time.delayedCall(ms, () => { if (!this.destroyed && !this.room.destroyed && this.scene.room === this.room) fn(); });
  }
  /** True while the player is free to interact (no slide, cutscene, death, forced walk). */
  get interactive() {
    const s = this.scene, p = s.player;
    return !!p && !p.dead && !s.transitioning && !s.cutscene && !this.room.destroyed;
  }
}
export { Controller };
