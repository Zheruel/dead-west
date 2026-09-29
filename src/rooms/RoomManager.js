// Owns the current floor, per-room persistent state, the current Room, room-to-room slide transitions and floor changes.
import { W, H, ROOM, DOORS, DIR_VEC, OPPOSITE, FLOORS, MAX_FLOOR } from '../config.js';
import { generateFloor } from '../gen/FloorGen.js';
import { getSeed } from '../core/rng.js';
import { bus } from '../core/events.js';
import { Sfx } from '../core/Audio.js';
import Room from './Room.js';

const SLIDE_MS = 380;

export default class RoomManager {
  constructor(scene) {
    this.scene = scene;
    this.floor = null;
    this.states = {};
    this.room = null;
    this.currentId = null;
    this.mapVer = 0; // bumped whenever minimap-relevant data changes (visited rooms, revealed secrets, new floor)
  }
  touchMap() { this.mapVer++; }

  stateFor(id) {
    return this.states[id] || (this.states[id] = { visited: false, entered: false, decals: [], broken: {}, pickups: [], pedestals: [], chests: [] });
  }
  get currentDef() { return this.floor ? this.floor.byId[this.currentId] : null; }

  // ------------------------------------------------------------------------------------------------ floors
  loadFloor(n) {
    const s = this.scene;
    this.teardown();
    this.floor = generateFloor(n, getSeed());
    this.floor.byId = Object.fromEntries(this.floor.rooms.map((r) => [r.id, r]));
    this.states = {};
    this.touchMap();
    s.floorNum = n;
    if (s.run) s.run.floor = n;
    this.jump(this.floor.startId, null, { intro: true });
    bus.emit('floor:changed', { floor: n, name: FLOORS[n].name });
    s.updateMusic();
  }

  /** Destroy the current room and everything room-scoped (enemies, bullets, dynamite, fx). */
  teardown() {
    const s = this.scene;
    for (const e of [...s.enemies]) e.destroy();
    s.enemies.length = 0;
    for (const d of [...s.dynamites]) d.destroy();
    s.dynamites.length = 0;
    s.bullets.clear();
    s.fx.clear();
    if (this.room) { this.room.destroy(); this.room = null; }
  }

  /** Enter a room without a slide (floor start, debug teleport). via = door dir in the new room the player comes through (or null: centre). */
  jump(id, via = null, { intro = false } = {}) {
    const s = this.scene;
    this.teardown();
    this.currentId = id;
    const def = this.floor.byId[id];
    const st = this.stateFor(id);
    st.visited = true;
    this.touchMap();
    this.room = new Room(s, def, st, this.floor);
    const p = s.player;
    if (via) p.teleport(DOORS[via].entry.x, DOORS[via].entry.y); else p.teleport(ROOM.cx, ROOM.cy);
    p.setEntryInvuln(intro ? 1.0 : 0.6);
    p.locked = false;
    if (via) p.forceWalk(-DOORS[via].dx, -DOORS[via].dy, 0.4);
    bus.emit('room:transition', { from: null, to: id, dir: via });
    const delay = via ? 430 : 60;
    const room = this.room;
    s.time.delayedCall(delay, () => { if (this.room === room && !room.destroyed) room.onEntered(via); });
  }

  // ------------------------------------------------------------------------------------------------ slide transition
  transition(dir) {
    const s = this.scene;
    if (s.transitioning || !this.room) return;
    const door = this.room.doors[dir];
    if (!door) return;
    const target = door.to;
    const oldId = this.currentId;
    s.transitioning = true;
    s.player.locked = true;
    s.player.vx = s.player.vy = 0;
    bus.emit('room:transition', { from: oldId, to: target, dir });

    // 1) snapshot everything in the old room into a render texture
    let rt = null;
    try { rt = this.snapshotRoom(); } catch (e) { console.warn('[RoomManager] snapshot failed, cutting instead', e); }
    // 2) destroy the old room, build the new one at real coordinates
    this.teardown();
    this.currentId = target;
    const st = this.stateFor(target);
    st.visited = true;
    this.touchMap();
    const def = this.floor.byId[target];
    this.room = new Room(s, def, st, this.floor);
    const inDoor = OPPOSITE[dir];
    const D = DOORS[inDoor];
    const p = s.player;
    p.teleport(D.entry.x, D.entry.y);
    p.setEntryInvuln(0.45 + SLIDE_MS / 1000 + 0.2);
    s.fx.setMotesVisible(false);
    s.updateMusic();

    const v = DIR_VEC[dir];
    const cam = s.cameras.main;
    const sx = -v[0] * W, sy = -v[1] * H;
    if (rt) rt.setPosition(sx, sy);
    cam.setScroll(rt ? sx : 0, rt ? sy : 0);
    const room = this.room;
    s.tweens.addCounter({
      from: 0, to: 1, duration: rt ? SLIDE_MS : 1, ease: 'Sine.easeInOut',
      onUpdate: (tw) => { const k = 1 - tw.getValue(); cam.setScroll(sx * k, sy * k); },
      onComplete: () => {
        cam.setScroll(0, 0);
        if (rt) rt.destroy();
        s.fx.setMotesVisible(true);
        s.transitioning = false;
        p.locked = false;
        p.forceWalk(-D.dx, -D.dy, 0.42);
        s.time.delayedCall(440, () => { if (this.room === room && !room.destroyed) room.onEntered(inDoor); });
      },
    });
  }

  /** Draw the whole current display list (minus the player and excluded objects) into a RenderTexture. */
  snapshotRoom() {
    const s = this.scene;
    const rt = s.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setDepth(1000);
    const list = s.children.list
      .filter((o) => o.visible && o !== rt && !o.__noSnap && o.type !== 'ParticleEmitter' && o.alpha > 0)
      .sort((a, b) => a.depth - b.depth);
    rt.draw(list, 0, 0);
    return rt;
  }

  // ------------------------------------------------------------------------------------------------ descend
  descend() {
    const s = this.scene;
    if (s.transitioning) return;
    s.transitioning = true;
    s.player.locked = true;
    Sfx.play('trapdoor');
    const cam = s.cameras.main;
    // player drops into the hole
    s.tweens.add({ targets: s.player.sprite, scale: 0.2, alpha: 0, duration: 450 });
    cam.fadeOut(600, 13, 8, 6);
    cam.once('camerafadeoutcomplete', () => {
      const n = Math.min(MAX_FLOOR, s.floorNum + 1);
      s.player.sprite.setScale(1).setAlpha(1);
      this.loadFloor(n);
      s.transitioning = false;
      s.player.locked = false;
      cam.fadeIn(600, 13, 8, 6);
      bus.emit('floor:intro', { floor: n, name: FLOORS[n].name, subtitle: FLOORS[n].subtitle });
    });
  }

  // ------------------------------------------------------------------------------------------------ queries for HUD/debug
  /** Rooms to draw on the minimap: visited rooms + rooms adjacent (via a visible door) to visited rooms. */
  discoveredRooms() {
    const out = new Map();
    if (!this.floor) return out;
    for (const r of this.floor.rooms) {
      const st = this.states[r.id];
      if (st && st.visited) {
        out.set(r.id, { def: r, visited: true });
        for (const d of Object.values(r.doors)) {
          if (d.kind === 'secret' && !d.revealed) continue;
          if (!out.has(d.to)) out.set(d.to, { def: this.floor.byId[d.to], visited: false });
        }
      }
    }
    // fix up visited flag for rooms discovered earlier as neighbours
    for (const [id, v] of out) v.visited = !!(this.states[id] && this.states[id].visited);
    return out;
  }
}
