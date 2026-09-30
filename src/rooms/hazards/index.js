// Hazards facade (FN-2, ARCH_V2 s8). One RoomHaz per Room (room._hz) owns every hazard object of that room; Room calls build / update / dispose and forwards
// addFire / ignite / spawnLane / lavaPath / blocks. Tile hazards (lava, vents, steam, quicksand, retracting spikes, rails) run always; lanes, chandelier,
// roulette and lava spit run only in combat after the first-wave telegraph and stop when the room is cleared.
import { ROOM, TILE, DEPTH } from '../../config.js';
import { Assets } from '../../core/Assets.js';
import { RNG } from '../../core/rng.js';
import { GroundHaz } from '../../systems/GroundHaz.js';
import { envOf, resetEnv, applyEnvShim, hasCell, inGrid } from './common.js';
import { FireField } from './FirePatch.js';
import { LaneField, LaneScheduler } from './LaneSweep.js';
import { LavaField } from './LavaField.js';
import { VentField } from './Vents.js';
import { SteamField } from './SteamJets.js';
import { ChandelierField, dropChandelier } from './Chandelier.js';
import { RouletteField } from './Roulette.js';
import { QuicksandField } from './Quicksand.js';
import { SpikeField } from './RetractSpikes.js';
import { GraveField } from './GraveAmbush.js';
import { TEX } from './tiles.js';

const FIRST_TELL = 0.6; // hazards wait out the first wave's spawn telegraph
const EMPTY_GRAPH = { tiles: [], count: 0, has: () => false, nearest: () => null, path: () => [] };

class RoomHaz {
  constructor(room) {
    this.room = room;
    this.scene = room.scene;
    this.def = room.tpl || {};
    this.rng = new RNG(((room.def && room.def.seed) ^ 0x4a2d) >>> 0); // hazard stream (never Math.random for outcomes)
    this.clock = 0; // seconds since build (tile hazard phases)
    this.t = -FIRST_TELL; // combat clock: 0 = first wave has appeared; scheduler offsets are measured on it
    this.live = false;
    this.stopped = false;
    this.fires = new FireField(room);
    this.lanes = null; this.sched = null; this.lava = null; this.vents = null; this.steam = null;
    this.chand = null; this.roulette = null; this.sand = null; this.spikes = null; this.grave = null;
    this.rails = [];
    this.parts = []; // per-frame updaters, in order
    this._scan();
  }

  _scan() {
    const room = this.room, by = {};
    for (const row of room.tiles) for (const t of row) if (t.ch && t.ch !== '.') (by[t.ch] || (by[t.ch] = [])).push(t);
    const pick = (...chars) => chars.flatMap((c) => by[c] || []);
    if (by.L) this.lava = new LavaField(this, by.L);
    if (by.V) this.vents = new VentField(this, by.V);
    if (by.T) this.steam = new SteamField(this, by.T);
    if (by.Q) this.sand = new QuicksandField(this, by.Q);
    if (by.s) this.spikes = new SpikeField(this, by.s);
    const roul = pick('r', 'k');
    if (roul.length) this.roulette = new RouletteField(this, roul);
    if (by['='] || by['|']) this._rails(pick('=', '|'));
    if (this.def.chandelier) this.chand = new ChandelierField(this);
    if (Array.isArray(this.def.lanes) && this.def.lanes.length) { this.lanes = new LaneField(this); this.sched = new LaneScheduler(this, this.def.lanes); }
    if (by.G && this.def.graveAmbush) this.grave = new GraveField(this, by.G);
    for (const p of [this.lava, this.vents, this.steam, this.sand, this.spikes, this.roulette, this.chand, this.sched, this.grave]) if (p) this.parts.push(p);
  }

  _rails(tiles) {
    const s = this.scene;
    for (const t of tiles) {
      const h = t.ch === '=', cell = h ? 'rail_h' : 'rail_v';
      const im = hasCell('haz_f5', cell) ? Assets.makeCell(s, t.x, t.y, 'haz_f5', cell, 0.5) : s.add.image(t.x, t.y, TEX.rail(s, h ? 'h' : 'v'));
      im.setDepth(DEPTH.decals - 1);
      this.rails.push(im);
    }
  }

  /** Lane body system (lazy: rooms without template lanes only pay for it when a boss / modifier / enemy spawns one). */
  laneField() { return this.lanes || (this.lanes = new LaneField(this)); }

  /** Would a walker rather not stand on tile (c, r)? (lava, quicksand, vents, pits, spikes) */
  unsafe(c, r) {
    if (!inGrid(c, r)) return true;
    if (this.lava && this.lava.has(c, r)) return true;
    const t = this.room.tiles[r] && this.room.tiles[r][c];
    return !t || t.solid || t.type === 'pit' || t.type === 'spikes' || t.type === 'vent' || t.type === 'rspikes' || t.type === 'lava';
  }

  update(dt) {
    const room = this.room, s = this.scene;
    envOf(s); // zero the player environment once per frame; hazards and modifiers then only ever add to it
    this.clock += dt;
    const combat = room.mode === 'combat' && (room.waveIdx >= 0 || room.type === 'boss');
    if (combat && !this.stopped) { this.t += dt; this.live = this.t >= 0; }
    else {
      this.live = false;
      if (!combat && (room.mode === 'done' || room.state.cleared) && !this.stopped) this.stop();
    }
    this.fires.update(dt);
    if (this.lanes) this.lanes.update(dt);
    for (let i = 0; i < this.parts.length; i++) this.parts[i].update(dt);
    const gh = s._groundHaz;
    if (gh) gh.update(dt);
    applyEnvShim(s, dt);
  }

  /** Room cleared: timers stop, telegraphs cancel, active windows finish (bodies fade / zaps end), tile hazards keep running. */
  stop() {
    this.stopped = true;
    if (this.sched) this.sched.items.length = 0;
    if (this.lanes) this.lanes.stopAll();
    if (this.chand) this.chand.stop();
    if (this.roulette) this.roulette.stop();
    if (this.lava) this.lava.stopSpit();
  }

  dispose() {
    for (const p of [this.lava, this.vents, this.steam, this.sand, this.spikes, this.roulette, this.grave, this.lanes]) if (p) p.destroy();
    for (const im of this.rails) im.destroy();
    this.rails.length = 0;
    this.fires.destroy();
    if (this.chand) this.chand.destroy();
    const gh = this.scene._groundHaz;
    if (gh) gh.clear();
    resetEnv(this.scene);
  }
}

const hzOf = (room) => room._hz || null;

export const Hazards = {
  /** Called at the end of Room.buildTiles: creates every hazard object from room.tiles + template fields. */
  build(room) {
    if (room._hz) return room;
    room._hz = new RoomHaz(room);
    return room;
  },
  /** Per-frame update (Room.update). */
  update(room, dt) { const hz = hzOf(room); if (hz) hz.update(dt); },
  /** Tear everything down (Room.destroy). */
  dispose(room) { const hz = hzOf(room); if (hz) { hz.dispose(); room._hz = null; } },

  /** Room.addFire(x, y, r, dur, {dmg = 1, team = 'enemy'|'player', dps, tag, maxTag}) -> patch (or null when the room has no hazard state). */
  addFire(room, x, y, r, dur, o = {}) { const hz = hzOf(room); return hz ? hz.fires.add(x, y, r, dur, o) : null; },

  /**
   * Room.ignite(x, y, {r = 44, life = 3.5, count = 1, spread = 0, team}): `count` patches at random points within `spread` px (min separation 60,
   * only on walkable ground: no rock, pit or lava). Returns the patches.
   */
  ignite(room, x, y, o = {}) {
    const hz = hzOf(room), out = [];
    if (!hz) return out;
    const r = o.r ?? 44, life = o.life ?? 3.5, n = o.count ?? 1, spread = o.spread ?? 0;
    const pts = [];
    for (let i = 0; i < n; i++) {
      let px = x, py = y;
      if (spread > 0) {
        let ok = false;
        for (let tries = 0; tries < 10 && !ok; tries++) {
          const a = hz.rng.float(0, Math.PI * 2), d = spread * Math.sqrt(hz.rng.next());
          px = x + Math.cos(a) * d; py = y + Math.sin(a) * d;
          ok = !hz.unsafe(Math.floor((px - ROOM.x) / TILE), Math.floor((py - ROOM.y) / TILE)) && pts.every((q) => Math.hypot(q.x - px, q.y - py) >= 60);
        }
        if (!ok) continue;
      }
      pts.push({ x: px, y: py });
      const p = hz.fires.add(px, py, r, life, { dmg: o.dmg ?? 1, team: o.team || 'enemy', tag: o.tag, maxTag: o.maxTag });
      if (p) out.push(p);
    }
    return out;
  },

  /** Room.spawnLane({axis, index, dir, speed, kind, dmg, w, tell, onDone}) -> lane handle ({cancel()}) or null when 4 lanes are already alive. */
  spawnLane(room, o) { const hz = hzOf(room); return hz ? hz.laneField().spawn(o) : null; },

  /** Room.lavaPath(): lava graph for magma_eel { tiles, count, has(c,r), nearest(x,y), path(x0,y0,x1,y1) }; an empty graph when the room has no lava. */
  lavaPath(room) { const hz = hzOf(room); return hz && hz.lava ? hz.lava.graph() : EMPTY_GRAPH; },

  /** Steering probe (Room.probe with an actor): lava for walkers that lava hurts, raised retracting spikes for every walker. */
  blocks(room, x, y, r, actor) {
    const hz = hzOf(room);
    if (!hz || !actor || actor.flying || actor.ghost) return false;
    if (hz.lava && hz.lava.blocks(x, y, r, actor)) return true;
    return !!(hz.spikes && actor !== room.scene.player && hz.spikes.blocks(x, y, r));
  },

  /** Boss / enemy helper: drop one chandelier now (same numbers as the room hazard). */
  chandelier(room, x, y, o) { return dropChandelier(room.scene, x, y, o); },
  /** Boss helper (Scratch): call a roulette colour now ('r' | 'k'). False when the room has no roulette tiles or one is already running. */
  rouletteCall(room, col) { const hz = hzOf(room); return !!(hz && hz.roulette && hz.roulette.call(col)); },
  /** Room state for tests / debug (fires, lanes, lava ...). */
  of: hzOf,
};

export { GroundHaz };
export default Hazards;
