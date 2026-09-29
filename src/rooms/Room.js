// Runtime room: background, obstacle tiles, doors, collision, encounter waves, pickups/pedestals/chests, decals.
// One Room instance is built each time the player enters a room; persistent data lives in `state` (owned by RoomManager).
import Phaser from 'phaser';
import { ROOM, TILE, DOORS, DIRS, DEPTH, actorDepth, tileToWorld, FLOORS, COLS, ROWS, FONT_BODY, OPPOSITE, ENEMY_DEFAULTS, SPAWN_SAFE_DIST, ROOM_REWARD } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { RNG, rng } from '../core/rng.js';
import Templates from '../gen/Templates.js';
import Door from './Door.js';
import Pickup from '../entities/Pickup.js';
import Pedestal from '../entities/Pedestal.js';
import Chest from '../entities/Chest.js';
import Trapdoor from '../entities/Trapdoor.js';
import { spawnEnemy, enemyPool, enemyMeta } from '../enemies/index.js';
import { spawnBoss } from '../bosses/index.js';

const BIG = 400;
const OBST_KEYS = { 1: 'obst_f1', 2: 'obst_f2', 3: 'obst_f3' };

export default class Room {
  constructor(scene, def, state, floorData) {
    this.scene = scene;
    this.def = def;
    this.state = state;
    this.floorData = floorData;
    this.floor = floorData.floor;
    this.type = def.type;
    this.tpl = Templates.get(def.template);
    this.objs = [];
    this.decalSprites = [];
    this.tiles = [];
    this.doors = {};
    this.wallRects = [];
    this.pickups = [];
    this.pedestals = [];
    this.chests = [];
    this.props = [];
    this.trapdoor = null;
    this.locked = false;
    this.mode = 'idle'; // idle | combat | done
    this.waves = [];
    this.waveIdx = -1;
    this.pending = 0;
    this.waveDelay = 0;
    this.age = 0;
    this.boss = null;
    this.enteredVia = null;
    this.rng = new RNG(def.seed || 1);
    this.spikeCd = 0;
    this.destroyed = false;
    this.build();
  }

  track(obj) { this.objs.push(obj); return obj; }
  get center() { return { x: ROOM.cx, y: ROOM.cy }; }

  // ================================================================================================ build
  build() {
    const s = this.scene;
    const fi = FLOORS[this.floor] || FLOORS[1];
    // background
    let keys;
    if (this.type === 'shop') keys = ['bg_shop'];
    else if (this.type === 'treasure') keys = ['bg_treasure'];
    else if (this.type === 'boss') keys = [fi.bgBoss, fi.bgA];
    else keys = this.def.bg === 'b' ? [fi.bgB, fi.bgA] : [fi.bgA, fi.bgB];
    const key = keys.find((k) => Assets.has(k)) || keys[0];
    this.bg = Assets.makeImage(s, ROOM.cx, ROOM.bgY + 432, key).setDepth(DEPTH.bg);
    if (this.type === 'secret') this.bg.setTint(0xb0b0c0);
    this.track(this.bg);

    this.buildTiles();
    this.buildDoors();
    this.buildWallRects();
    for (const d of this.state.decals || []) this.makeDecal(d);
    this.buildContents();
    this.buildLights();
    this.hintText();
  }

  /** Ambient light life: F3 lanterns pulse green, F2 gets a faint candle-warm flicker over the whole room. Flicker is driven from update(). */
  buildLights() {
    const s = this.scene;
    this.lights = [];
    const add = (x, y, color, sx, sy, alpha, speed) => {
      const im = s.add.image(x, y, 'glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(sx, sy).setAlpha(alpha).setDepth(DEPTH.bullets - 6);
      this.track(im);
      this.lights.push({ im, base: alpha, sx, sy, speed, ph: Math.random() * 6.28 });
    };
    if (this.floor === 3) {
      for (const row of this.tiles) for (const t of row) {
        if (t.type === 'decor' && t.decorName === 'decor_b' && t.sprite) add(t.sprite.x, t.sprite.y - 26, 0x7fdc3a, 1.5, 1.2, 0.34, 2.2);
      }
    } else if (this.floor === 2 && this.type !== 'shop') {
      add(ROOM.cx, ROOM.cy, 0xffa050, 9.4, 5.2, 0.05, 5);
    }
  }
  updateLights() {
    const t = this.age;
    for (const L of this.lights) {
      if (!L.im.scene) continue;
      const f = 1 + 0.22 * Math.sin(t * L.speed + L.ph) + 0.12 * Math.sin(t * L.speed * 2.9 + L.ph * 3) + 0.06 * Math.sin(t * L.speed * 7.3);
      L.im.setAlpha(L.base * f).setScale(L.sx * (1 + 0.04 * (f - 1)), L.sy * (1 + 0.04 * (f - 1)));
    }
  }

  buildTiles() {
    const s = this.scene;
    const tpl = this.tpl;
    const obst = OBST_KEYS[this.floor] || 'obst_f1';
    const broken = this.state.broken || (this.state.broken = {});
    const r = new RNG(this.def.seed ^ 0x9e37);
    this.tiles = [];
    for (let row = 0; row < ROWS; row++) {
      const line = [];
      for (let col = 0; col < COLS; col++) {
        const ch = tpl.grid[row][col];
        const { x, y } = tileToWorld(col, row);
        const bottom = y + TILE / 2;
        const t = { c: col, r: row, ch, type: null, solid: false, x, y, sprite: null, hp: 0, broken: false, obst };
        let name = null;
        if (ch === 'R') { t.type = 'block'; t.solid = true; name = r.chance(0.5) ? 'block_a' : 'block_b'; }
        else if (ch === 'P') { t.type = 'pit'; t.solid = true; name = this.pitJoined(col, row) ? null : 'pit'; }
        else if (ch === 'S') { t.type = 'spikes'; name = 'spikes'; }
        else if (ch === 'B') {
          t.type = 'breakable'; t.solid = true; t.hp = 2; name = 'breakable';
          if (broken[`${col},${row}`]) { t.broken = true; t.solid = false; name = 'breakable_broken'; }
        } else if (ch === 'd') { t.type = 'decor'; name = r.chance(0.5) ? 'decor_a' : 'decor_b'; t.decorName = name; }
        if (name) {
          t.sprite = Assets.makeCell(s, x, bottom, obst, name, 1);
          const flat = t.type === 'pit' || t.type === 'spikes' || t.broken;
          t.sprite.setDepth(flat ? DEPTH.floor : actorDepth(bottom));
          this.track(t.sprite);
        }
        line.push(t);
      }
      this.tiles.push(line);
    }
    this.mergePits();
    // sprinkle decor on free tiles (not near doors / spawn slots)
    const decorN = this.type === 'normal' || this.type === 'start' ? 3 : 1;
    let placed = 0, guard = 0;
    while (placed < decorN && guard++ < 40) {
      const col = r.int(1, COLS - 2), row = r.int(1, ROWS - 2);
      const t = this.tiles[row][col];
      if (t.ch !== '.' || t.type) continue;
      if ((col === 6 && (row === 1 || row === 5)) || (row === 3 && (col === 1 || col === 11))) continue;
      t.type = 'decor';
      const name = r.chance(0.5) ? 'decor_a' : 'decor_b';
      t.decorName = name;
      t.sprite = Assets.makeCell(s, t.x + r.int(-20, 20), t.y + TILE / 2 - r.int(0, 20), t.obst, name, 1).setDepth(DEPTH.floor + 1).setAlpha(0.95);
      this.track(t.sprite);
      placed++;
    }
  }

  /** True if the template pit at (c,r) touches another pit (those are drawn as one merged hole by mergePits instead of one sprite per tile). */
  pitJoined(c, r) {
    const g = this.tpl.grid;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[r + dy] && g[r + dy][c + dx] === 'P');
  }

  /** Neighbouring pit tiles read as ONE hole: layered rounded shapes (rim, wall, shadow, void) drawn as a union of the tile rects. */
  mergePits() {
    const pit = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && this.tiles[r][c].type === 'pit';
    const joined = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (pit(c, r) && this.pitJoined(c, r)) joined.push(this.tiles[r][c]);
    if (!joined.length) return;
    const pal = { 1: [0xa8783c, 0x5a3418], 2: [0x6e4c2c, 0x2e1c10], 3: [0x6a5a4c, 0x261c18] }[this.floor] || [0xa8783c, 0x5a3418];
    const layers = [[3, pal[0], 0], [9, pal[1], 0], [17, 0x22140b, 5], [28, 0x0a0604, 9]]; // [inset px, colour, downward shift: shows the far cliff wall]
    const gfx = this.track(this.scene.add.graphics().setDepth(DEPTH.floor));
    const half = TILE / 2;
    for (const [inset, col, dy] of layers) {
      gfx.fillStyle(col, 1);
      for (const t of joined) {
        const rad = Math.max(6, 22 - inset * 0.3);
        // a tile corner is rounded only when it borders open floor on both sides (keeps the union smooth inside the lake)
        const l = pit(t.c - 1, t.r), rr = pit(t.c + 1, t.r), u = pit(t.c, t.r - 1), d = pit(t.c, t.r + 1);
        const x0 = t.x - half + (l ? 0 : inset), x1 = t.x + half - (rr ? 0 : inset), y0 = t.y - half + (u ? 0 : inset) + (u ? 0 : dy), y1 = t.y + half - (d ? 0 : inset) + (d ? 0 : dy * 0.4);
        gfx.fillRoundedRect(x0, y0, x1 - x0, y1 - y0, { tl: !l && !u ? rad : 0, tr: !rr && !u ? rad : 0, bl: !l && !d ? rad : 0, br: !rr && !d ? rad : 0 });
      }
    }
  }

  buildDoors() {
    for (const dir of DIRS) {
      const data = this.def.doors[dir];
      if (data) this.doors[dir] = new Door(this, dir, data);
    }
  }

  /** Wall rectangles (outside the interior), with gaps where doors are passable. */
  buildWallRects() {
    const open = (d) => this.doors[d] && this.doors[d].passable;
    const R = [];
    const X0 = ROOM.x, X1 = ROOM.right, Y0 = ROOM.y, Y1 = ROOM.bottom;
    const FULLW = 1440 + 2 * BIG;
    // top
    if (open('up')) {
      R.push({ x: -BIG, y: -BIG, w: BIG + 672, h: BIG + Y0 }, { x: 768, y: -BIG, w: BIG + 672, h: BIG + Y0 }, { x: 672, y: -BIG, w: 96, h: BIG + 96 });
    } else R.push({ x: -BIG, y: -BIG, w: FULLW, h: BIG + Y0 });
    // bottom
    if (open('down')) {
      R.push({ x: -BIG, y: Y1, w: BIG + 672, h: 96 + BIG }, { x: 768, y: Y1, w: BIG + 672, h: 96 + BIG }, { x: 672, y: 960, w: 96, h: BIG });
    } else R.push({ x: -BIG, y: Y1, w: FULLW, h: 96 + BIG });
    // left
    if (open('left')) {
      R.push({ x: -BIG, y: -BIG, w: BIG + X0, h: BIG + 480 }, { x: -BIG, y: 576, w: BIG + X0, h: 384 + BIG }, { x: -BIG, y: 480, w: BIG, h: 96 });
    } else R.push({ x: -BIG, y: -BIG, w: BIG + X0, h: 960 + 2 * BIG });
    // right
    if (open('right')) {
      R.push({ x: X1, y: -BIG, w: 96 + BIG, h: BIG + 480 }, { x: X1, y: 576, w: 96 + BIG, h: 384 + BIG }, { x: 1440, y: 480, w: BIG, h: 96 });
    } else R.push({ x: X1, y: -BIG, w: 96 + BIG, h: 960 + 2 * BIG });
    this.wallRects = R;
  }

  hintText() {
    if (this.floor !== 1 || this.type !== 'start' || this.state.hinted) return;
    const s = this.scene;
    this.state.hinted = true; // controls hint only on the first visit
    const lines = ['WASD  -  MOVE', 'ARROWS  -  SHOOT', 'SPACE  -  DODGE ROLL', 'E  -  DYNAMITE'];
    lines.forEach((l, i) => {
      const t = s.add.text(ROOM.cx, ROOM.cy - 80 + i * 40, l, { fontFamily: FONT_BODY, fontSize: '30px', color: '#e8dcc0' }).setOrigin(0.5).setAlpha(0.33).setDepth(DEPTH.decals + 1);
      this.track(t);
    });
  }

  // ================================================================================================ contents
  buildContents() {
    const st = this.state;
    const tpl = this.tpl;
    if (!st.populated) {
      st.populated = true;
      st.pickups = st.pickups || [];
      st.pedestals = st.pedestals || [];
      st.chests = st.chests || [];
      const items = this.scene.items;
      const r = rng.game;
      if (this.type === 'treasure') {
        const group = tpl.pickOne ? 1 : null;
        for (const p of tpl.slots.I) {
          const id = items.roll('treasure', r);
          if (id) st.pedestals.push({ ...tileToWorld(p.c, p.r), itemId: id, price: null, group, taken: false });
          else st.pickups.push({ type: r.pick(['heart_tin', 'heart_full', 'key']), ...tileToWorld(p.c, p.r) }); // item pool exhausted: never leave the reward spot empty
        }
      } else if (this.type === 'shop') {
        const slots = tpl.slots.H;
        const item = items.roll('shop', r);
        if (item) st.pedestals.push({ ...tileToWorld(slots[0].c, slots[0].r), itemId: item, price: r.int(10, 15), group: null, taken: false });
        else { const t = r.pick(['heart_full', 'key', 'dynamite', 'heart_tin']); st.pickups.push({ type: t, ...tileToWorld(slots[0].c, slots[0].r), price: t === 'heart_full' ? 3 : 5 }); } // item pool exhausted
        const kind2 = r.chance(0.7) ? 'heart_full' : 'heart_tin';
        st.pickups.push({ type: kind2, ...tileToWorld(slots[1].c, slots[1].r), price: kind2 === 'heart_full' ? 3 : 5 });
        const kind3 = r.pick(['key', 'dynamite', 'key', 'dynamite', 'heart_half']);
        st.pickups.push({ type: kind3, ...tileToWorld(slots[2].c, slots[2].r), price: kind3 === 'heart_half' ? 2 : 5 });
      } else if (this.type === 'secret') {
        for (const p of tpl.slots.C) {
          const w = tileToWorld(p.c, p.r);
          st.pickups.push({ type: this.rollPickup(1.2, true), ...w });
        }
        if (r.chance(0.4)) {
          const id = items.roll('secret', r);
          const p = tpl.slots.I[0];
          if (id && p) st.pedestals.push({ ...tileToWorld(p.c, p.r), itemId: id, price: null, group: null, taken: false });
        }
      }
    }
    for (const rec of st.pedestals || []) this.makePedestal(rec);
    for (const rec of st.pickups || []) this.pickups.push(new Pickup(this.scene, rec.type, rec.x, rec.y, { price: rec.price }));
    for (const rec of st.chests || []) this.chests.push(new Chest(this.scene, rec, this));
    if (this.type === 'shop' && tpl.slots.K.length) {
      const k = tileToWorld(tpl.slots.K[0].c, tpl.slots.K[0].r);
      const ped = Assets.makeCell(this.scene, k.x, k.y + 50, 'props', 'peddler', 1).setDepth(actorDepth(k.y + 50));
      this.track(ped);
      this.peddler = ped;
    }
    if (st.trapdoor) { this.trapdoor = new Trapdoor(this.scene, st.trapdoor, this); this.props.push(this.trapdoor); }
    // encounter plan
    st.cleared = st.cleared ?? !(this.type === 'normal' || this.type === 'boss');
    if (!st.cleared) this.planEncounter();
  }

  makePedestal(rec) {
    const p = new Pedestal(this.scene, rec, this);
    this.pedestals.push(p);
    return p;
  }
  spawnPedestal(rec) {
    this.state.pedestals.push(rec);
    return this.makePedestal(rec);
  }
  resolveGroup(group, except) {
    for (const p of this.pedestals) if (p !== except && p.rec.group === group) p.vanish();
  }

  // ================================================================================================ encounters
  planEncounter() {
    const tpl = this.tpl;
    const r = new RNG(this.def.seed ^ 0x51ed);
    const pool = enemyPool(this.floor);
    const pick = () => (pool.length ? r.weighted(pool.map((id) => ({ id, w: (enemyMeta(id) || {}).weight ?? 1 })), (o) => o.w).id : 'outlaw');
    const cursedChance = ENEMY_DEFAULTS.cursedChance; // 8% elite
    if (this.type === 'boss') {
      this.waves = [];
      return;
    }
    const waves = [];
    const digits = Object.keys(tpl.slots.waves).sort();
    for (const dgt of digits) {
      const positions = tpl.slots.waves[dgt];
      const list = tpl.waves[dgt] || [];
      waves.push(positions.map((p, i) => ({ id: list[i] || pick(), ...tileToWorld(p.c, p.r), cursed: r.chance(cursedChance) })));
    }
    // template `air` spawns: flyers that may hover over pits/obstacles, added to the wave with that digit
    for (const [dgt, list] of Object.entries(tpl.air || {})) {
      const w = waves[digits.indexOf(dgt)];
      if (w) for (const [c, rr, id] of list) w.push({ id, ...tileToWorld(c, rr), cursed: r.chance(cursedChance), air: true });
    }
    if (tpl.slots.E.length) {
      const extra = tpl.slots.E.map((p) => ({ id: pick(), ...tileToWorld(p.c, p.r), cursed: r.chance(cursedChance) }));
      if (waves.length) waves[0].push(...extra); else waves.push(extra);
    }
    // gentle start: rooms right next to the start room only get their first wave
    if (this.def.dist <= 1 && waves.length > 1) waves.length = 1;
    if (!waves.length) this.state.cleared = true;
    this.waves = waves;
  }

  /** Called by RoomManager once the player has walked in. */
  onEntered(via) {
    this.enteredVia = via;
    const st = this.state;
    const first = !st.entered;
    st.entered = true;
    st.visited = true;
    this.scene.player.onRoomEntered();
    bus.emit('room:entered', { room: this, roomId: this.def.id, type: this.type, first });
    if (!st.cleared) this.startEncounter();
    else if (this.type === 'boss' && st.trapdoor) { /* already beaten */ }
  }

  startEncounter() {
    if (this.mode !== 'idle') return;
    this.mode = 'combat';
    this.lock();
    if (this.type === 'boss') { this.startBoss(); return; }
    this.waveIdx = -1;
    this.waveDelay = 0.35;
    this.pending = 0;
  }

  lock() {
    this.locked = true;
    for (const d of Object.values(this.doors)) d.refresh();
    this.buildWallRects();
    bus.emit('room:locked', { room: this });
  }
  unlock() {
    this.locked = false;
    for (const d of Object.values(this.doors)) d.refresh();
    this.buildWallRects();
  }

  nextWave() {
    this.waveIdx++;
    if (this.waveIdx >= this.waves.length) { this.clearRoom(); return; }
    const wave = this.safeSpawns(this.waves[this.waveIdx]);
    for (const w of wave) {
      this.scene.fx.spawn(w.x, w.y, Math.max(0.8, (enemyMeta(w.id)?.r ?? 30) / 34));
      bus.emit('spawn:telegraph', { x: w.x, y: w.y });
      this.pending++;
      this.scene.time.delayedCall(560, () => {
        this.pending--;
        if (this.destroyed || this.scene.room !== this) return;
        spawnEnemy(this.scene, w.id, w.x, w.y, { cursed: w.cursed, floor: this.floor });
      });
    }
  }

  /**
   * Fairness: nothing may appear within SPAWN_SAFE_DIST px of the player (wave 1: also of the entry door). Offending spawns move to the nearest
   * free tile that is far enough (flyers may use pit tiles); if the room has no such tile the farthest one is used. Returns a new list.
   */
  safeSpawns(wave) {
    const p = this.scene.player;
    const pts = [];
    if (p) pts.push({ x: p.x, y: p.y });
    if (this.waveIdx === 0 && this.enteredVia && DOORS[this.enteredVia]) pts.push(DOORS[this.enteredVia].entry);
    if (!pts.length) return wave;
    const D = SPAWN_SAFE_DIST;
    const minD = (x, y) => Math.min(...pts.map((q) => Math.hypot(q.x - x, q.y - y)));
    const doorTiles = new Set(DIRS.flatMap((d) => [DOORS[d].tile.join(','), DOORS[d].front.join(',')]));
    const used = [];
    const out = [];
    for (const w of wave) {
      let pos = { x: w.x, y: w.y };
      if (minD(w.x, w.y) < D) {
        const fly = !!(enemyMeta(w.id) || {}).flying;
        let best = null, bestScore = Infinity, far = null, farD = -1;
        for (const row of this.tiles) for (const t of row) {
          if (t.type === 'spikes' || (t.solid && !(fly && t.type === 'pit')) || doorTiles.has(`${t.c},${t.r}`)) continue;
          if (used.some((u) => Math.hypot(u.x - t.x, u.y - t.y) < 70)) continue;
          const d = minD(t.x, t.y);
          if (d > farD) { farD = d; far = t; }
          if (d >= D) { const sc = Math.hypot(t.x - w.x, t.y - w.y); if (sc < bestScore) { bestScore = sc; best = t; } }
        }
        const t = best || far;
        if (t) pos = { x: t.x, y: t.y };
      }
      used.push(pos);
      out.push({ ...w, x: pos.x, y: pos.y });
    }
    return out;
  }

  startBoss() {
    const tpl = this.tpl;
    const slot = tpl.slots.waves['1'][0];
    let { x, y } = tileToWorld(slot.c, slot.r);
    const via = this.enteredVia;
    if (via === 'up' && y < ROOM.cy) y = 2 * ROOM.cy - y;
    else if (via === 'down' && y > ROOM.cy) y = 2 * ROOM.cy - y;
    else if (via === 'left' && x < ROOM.cx) x = 2 * ROOM.cx - x;
    else if (via === 'right' && x > ROOM.cx) x = 2 * ROOM.cx - x;
    // vertical entrances: push the boss further from the door
    if (via === 'up') y = Math.max(y, ROOM.cy + 60);
    if (via === 'down') y = Math.min(y, ROOM.cy - 60);
    this.boss = spawnBoss(this.scene, tpl.boss, x, y, { floor: this.floor });
    this.scene.beginBossIntro(this.boss);
  }

  onBossDefeated(boss) {
    // kill leftover adds silently
    for (const e of [...this.scene.enemies]) if (e !== boss && e.alive) { e.hp = 0; e.die({ silent: true }); }
    this.scene.bullets.enemy.clear();
    const pos = { x: ROOM.cx, y: ROOM.cy };
    const st = this.state;
    st.trapdoor = this.floor < 3 ? { x: pos.x, y: pos.y + 40 } : null;
    st.pedestals = st.pedestals || [];
    st.pickups = st.pickups || [];
    const id = this.scene.items.roll('boss', rng.game);
    if (id) this.spawnPedestal({ x: pos.x, y: pos.y - 110, itemId: id, price: null, group: null, taken: false });
    else this.dropPickup('heart_tin', pos.x, pos.y - 110, { pop: true }); // item pool exhausted
    this.dropPickup('heart_full', pos.x + 130, pos.y + 40, { pop: true });
    if (st.trapdoor) { this.trapdoor = new Trapdoor(this.scene, st.trapdoor, this); this.props.push(this.trapdoor); }
    this.clearRoom({ boss: true });
  }

  clearRoom(o = {}) {
    const st = this.state;
    if (st.cleared) return;
    st.cleared = true;
    this.mode = 'done';
    this.unlock();
    if (this.scene.run) this.scene.run.roomsCleared++;
    bus.emit('room:cleared', { room: this, roomId: this.def.id, type: this.type });
    if (!o.boss) { this.scene.fx.ringPulse(ROOM.cx, ROOM.cy + 20, 0xf0d080, 420, 700, 0.3); this.scene.fx.flash(0xf0d080, 0.1); } // room-clear chime flourish (doors swing open via Door.juice)
    const p = this.scene.player;
    const r = rng.game;
    if (!o.boss) {
      // reward drop
      const luck = p.stats.luck;
      // reward curve (config ROOM_REWARD): harder templates pay slightly more, and a drop is guaranteed after a dry streak
      const RW = ROOM_REWARD;
      const sc = this.scene.run || this.scene; // per-run counter (scene objects are reused between runs)
      const drop = r.chance(RW.dropChance + luck * RW.luckBonus + ((this.tpl.tier || 1) - 1) * RW.tierBonus) || (sc.dryClears || 0) >= RW.pityRooms;
      if (drop) { sc.dryClears = 0; this.dropPickup(this.rollPickup(), ROOM.cx, ROOM.cy, { pop: true }); }
      else {
        sc.dryClears = (sc.dryClears || 0) + 1;
        if (r.chance(RW.chestChance)) this.spawnChest('chest_wood', ROOM.cx, ROOM.cy - 40);
      }
      // guaranteed key for the locked treasure room (see FloorGen keyRoomId)
      if (this.floorData.keyRoomId === this.def.id && !st.keyGiven) { st.keyGiven = true; this.dropPickup('key', ROOM.cx + 70, ROOM.cy + 60, { pop: true }); }
    }
    const coins = p.stats.roomClearCoins || 0;
    for (let i = 0; i < coins; i++) this.dropPickup('coin', ROOM.cx + (i - 1) * 30, ROOM.cy + 60, { pop: true });
    if (p.stats.roomClearKeyChance && r.chance(p.stats.roomClearKeyChance)) this.dropPickup('key', ROOM.cx, ROOM.cy + 90, { pop: true });
  }

  spawnChest(type, x, y) {
    ({ x, y } = this.walkableNear(x, y));
    const rec = { x, y, type, opened: false };
    this.state.chests.push(rec);
    this.chests.push(new Chest(this.scene, rec, this));
  }

  aliveCount() {
    let n = 0;
    for (const e of this.scene.enemies) if (e.alive && !e.noClear) n++;
    return n;
  }

  // ================================================================================================ pickups & drops
  rollPickup(bonus = 0, chest = false) {
    const p = this.scene.player;
    const hurt = p.hp < p.maxHp;
    const lk = Math.max(0, p.stats.luck || 0); // luck shifts drops toward the good stuff (nickels, hearts, tin)
    const items = [
      { t: 'coin', w: 40 * (p.stats.coinMult > 1 ? 1.4 : 1) }, { t: 'coin_nickel', w: 6 + bonus * 3 + lk },
      { t: 'heart_full', w: 7 + lk * 0.7 + (hurt ? 9 : 0) }, { t: 'heart_half', w: 14 + (hurt ? 10 : 0) }, { t: 'heart_tin', w: 3 + bonus + lk * 0.4 },
      { t: 'key', w: 12 }, { t: 'dynamite', w: 12 },
    ];
    return rng.game.weighted(items, (o) => o.w).t;
  }
  /** Nearest spot a pickup / chest can actually be reached from: drops over a pit / rock / spikes (room centre of pit templates, flyers dying over pits) were unreachable. */
  walkableNear(x, y) {
    const ok = (t) => t && !t.solid && t.type !== 'spikes';
    if (!this.probe(x, y, 18)) {
      const c = Math.floor((x - ROOM.x) / TILE), r = Math.floor((y - ROOM.y) / TILE);
      if (ok(this.tiles[r] && this.tiles[r][c])) return { x, y };
    }
    let best = null, bd = Infinity;
    for (const row of this.tiles) for (const t of row) {
      if (!ok(t)) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bd) { bd = d; best = t; }
    }
    return best ? { x: best.x, y: best.y } : { x, y };
  }
  dropPickup(type, x, y, o = {}) {
    ({ x, y } = this.walkableNear(x, y));
    const pk = new Pickup(this.scene, type, x, y, { pop: true, ...o });
    this.pickups.push(pk);
    return pk;
  }
  removePickup(pk) {
    const i = this.pickups.indexOf(pk);
    if (i >= 0) this.pickups.splice(i, 1);
  }

  // ================================================================================================ decals
  addDecal(d, save = true) {
    if (save) {
      const list = this.state.decals || (this.state.decals = []);
      if (list.length > 70) list.shift();
      list.push(d);
    }
    this.makeDecal(d);
  }
  makeDecal(d) {
    const s = this.scene;
    let im;
    if (d.kind === 'scorch') im = s.textures.exists('fx_scorch') ? s.add.image(d.x, d.y, 'fx_scorch').setRotation(d.rot).setAlpha(0.8).setScale(d.scale * 0.85) : s.add.image(d.x, d.y, 'glow').setTint(0x000000).setAlpha(0.5).setScale(d.scale);
    else im = Assets.makeCell(s, d.x, d.y, 'fx_blood', `blood_${'abcd'[d.frame % 4]}`, 0.5).setRotation(d.rot).setScale(d.scale * 0.8).setAlpha(0.85);
    im.setDepth(DEPTH.decals);
    // decal sprites are capped (oldest destroyed first): long fights used to accumulate hundreds of blood/scorch sprites
    this.decalSprites.push(im);
    if (this.decalSprites.length > 70) this.decalSprites.shift().destroy();
    return im;
  }

  // ================================================================================================ collision
  _push(a, rx, ry, rw, rh) {
    const r = a.radius;
    const qx = a.x < rx ? rx : a.x > rx + rw ? rx + rw : a.x;
    const qy = a.y < ry ? ry : a.y > ry + rh ? ry + rh : a.y;
    let dx = a.x - qx, dy = a.y - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return;
    a.hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const push = r - d;
      dx /= d; dy /= d;
      a.x += dx * push; a.y += dy * push;
      a.hnx += dx; a.hny += dy;
    } else {
      // centre inside the rect: leave through the nearest side
      const l = a.x - rx, rr = rx + rw - a.x, t = a.y - ry, b = ry + rh - a.y;
      const m = Math.min(l, rr, t, b);
      if (m === l) { a.x = rx - r; a.hnx -= 1; } else if (m === rr) { a.x = rx + rw + r; a.hnx += 1; } else if (m === t) { a.y = ry - r; a.hny -= 1; } else { a.y = ry + rh + r; a.hny += 1; }
    }
  }

  /** Push actor `a` (x,y,radius,flying) out of walls and obstacles. Sets a.hit / a.hnx / a.hny. */
  resolve(a) {
    a.hit = false; a.hnx = 0; a.hny = 0;
    const r = a.radius;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.wallRects.length; i++) { const w = this.wallRects[i]; this._push(a, w.x, w.y, w.w, w.h); }
      if (a.flying) continue;
      const c0 = Math.max(0, Math.floor((a.x - r - ROOM.x) / TILE)), c1 = Math.min(COLS - 1, Math.floor((a.x + r - ROOM.x) / TILE));
      const r0 = Math.max(0, Math.floor((a.y - r - ROOM.y) / TILE)), r1 = Math.min(ROWS - 1, Math.floor((a.y + r - ROOM.y) / TILE));
      for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
        const t = this.tiles[rr][cc];
        if (t.solid) this._push(a, ROOM.x + cc * TILE, ROOM.y + rr * TILE, TILE, TILE);
      }
    }
    if (a.hit) { const l = Math.hypot(a.hnx, a.hny); if (l > 0.001) { a.hnx /= l; a.hny /= l; } }
  }

  /** True if a circle at (x,y,r) would overlap a solid obstacle tile (for steering probes). */
  probe(x, y, r, actor) {
    if (actor && actor.flying) return false;
    const c0 = Math.floor((x - r - ROOM.x) / TILE), c1 = Math.floor((x + r - ROOM.x) / TILE);
    const r0 = Math.floor((y - r - ROOM.y) / TILE), r1 = Math.floor((y + r - ROOM.y) / TILE);
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      if (rr < 0 || cc < 0 || rr >= ROWS || cc >= COLS) return true;
      if (this.tiles[rr][cc].solid) return true;
    }
    return false;
  }

  /** Tile blocking a bullet at (x,y,r): block or unbroken breakable. Pits and spikes are bullet-transparent. */
  bulletBlock(x, y, r) {
    const c0 = Math.floor((x - r - ROOM.x) / TILE), c1 = Math.floor((x + r - ROOM.x) / TILE);
    const r0 = Math.floor((y - r - ROOM.y) / TILE), r1 = Math.floor((y + r - ROOM.y) / TILE);
    for (let rr = Math.max(0, r0); rr <= Math.min(ROWS - 1, r1); rr++) for (let cc = Math.max(0, c0); cc <= Math.min(COLS - 1, c1); cc++) {
      const t = this.tiles[rr][cc];
      if (t.type === 'block' || (t.type === 'breakable' && !t.broken)) return t;
    }
    return null;
  }

  damageTile(t, dmg = 1) {
    if (t.type !== 'breakable' || t.broken) return;
    t.hp -= dmg;
    this.scene.fx.burst(t.x, t.y, { color: [0x8a5a2a, 0x6b4423], count: 5, speed: [40, 160], life: [200, 400] });
    if (t.sprite) this.scene.tweens.add({ targets: t.sprite, x: t.sprite.x + 3, duration: 40, yoyo: true, repeat: 1 });
    if (t.hp <= 0) this.breakTile(t);
  }
  breakTile(t) {
    if (t.broken) return;
    t.broken = true; t.solid = false;
    (this.state.broken || (this.state.broken = {}))[`${t.c},${t.r}`] = true;
    if (t.sprite) { t.sprite.setFrame(Assets.frame(t.obst, 'breakable_broken')).setDepth(DEPTH.floor); }
    this.scene.fx.burst(t.x, t.y, { color: [0x8a5a2a, 0x6b4423, 0xb8843f], count: 14, speed: [60, 260], gravity: 200 });
    this.scene.fx.dust(t.x, t.y + 20, 1.1);
    Sfx.play('bullet_hit_wall', { vol: 0.8, detune: -300 });
    if (rng.game.chance(ROOM_REWARD.breakableDrop + (this.scene.player ? this.scene.player.stats.luck : 0) * ROOM_REWARD.luckBonus * 0.5)) this.dropPickup(this.rollPickup(), t.x, t.y, { pop: true }); // luck-weighted
  }
  explodeAt(x, y, radius) {
    for (const row of this.tiles) for (const t of row) {
      if (t.type === 'breakable' && !t.broken && Math.hypot(t.x - x, t.y - y) < radius + TILE * 0.5) this.breakTile(t);
    }
  }
  revealSecretsAt(x, y, radius) {
    for (const d of Object.values(this.doors)) {
      if (d.kind !== 'secret' || d.data.revealed) continue;
      if (Math.hypot(d.geom.x - x, d.geom.y - y) < radius + 30) this.revealDoor(d);
    }
  }
  revealDoor(d) {
    d.data.revealed = true;
    const other = this.floorData.byId[d.to];
    if (other && other.doors[OPPOSITE[d.dir]]) other.doors[OPPOSITE[d.dir]].revealed = true;
    d.refresh(false);
    this.buildWallRects();
    this.scene.roomMgr.touchMap();
    this.scene.fx.burst(d.geom.x, d.geom.y, { color: [0x8a7a68, 0x6b4423, 0xe8dcc0], count: 22, speed: [80, 320], gravity: 200 });
    this.scene.fx.dust(d.geom.x + d.geom.dx * -30, d.geom.y + d.geom.dy * -30, 1.6);
    Sfx.play('door_unlock', { vol: 0.9 });
    bus.emit('ui:toast', { text: 'A SECRET PASSAGE!', color: '#f0a640' });
    bus.emit('secret:revealed', { roomId: this.def.id, to: d.to });
  }

  // ================================================================================================ update
  update(dt) {
    this.age += dt;
    for (const p of [...this.pickups]) p.update(dt);
    for (const p of this.pedestals) p.update(dt);
    for (const c of this.chests) c.update(dt);
    for (const p of this.props) p.update(dt);
    this.updateEncounter(dt);
    this.updateDoors(dt);
    if (this.destroyed) return; // a door transition just tore this room down: don't run spikes/lights against the dead room
    this.updateSpikes(dt);
    if (this.lights && this.lights.length) this.updateLights();
  }

  updateEncounter(dt) {
    if (this.mode !== 'combat' || this.type === 'boss') return;
    if (this.pending > 0) return;
    if (this.aliveCount() === 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) { this.nextWave(); this.waveDelay = 0.55; }
    }
  }

  updateDoors(dt) {
    const s = this.scene;
    const p = s.player;
    for (const d of Object.values(this.doors)) if (d.bumpCd > 0) d.bumpCd -= dt; // cooldown ticks wherever the player is
    if (!p || p.dead || s.transitioning || p.locked || p.forced) return;
    for (const d of Object.values(this.doors)) {
      const g = d.geom;
      const st = d.state;
      if (st === 'hidden') continue;
      // signed distance from the interior edge along the outward normal (positive = inside the doorway)
      let beyond, lateral;
      if (g.dir === 'up') { beyond = ROOM.y - p.y; lateral = p.x - 720; }
      else if (g.dir === 'down') { beyond = p.y - ROOM.bottom; lateral = p.x - 720; }
      else if (g.dir === 'left') { beyond = ROOM.x - p.x; lateral = p.y - 528; }
      else { beyond = p.x - ROOM.right; lateral = p.y - 528; }
      if (Math.abs(lateral) > 60) continue;
      if (st === 'open') {
        if (beyond > 22) { s.roomMgr.transition(g.dir); return; }
      } else if (st === 'locked') {
        if (beyond > -p.radius - 10 && d.bumpCd <= 0) {
          d.bumpCd = 0.9;
          if (p.keys > 0) {
            p.keys--;
            d.data.locked = false;
            Sfx.play('door_unlock');
            d.refresh(false);
            this.buildWallRects();
            s.fx.text(g.x - g.dx * 60, g.y - g.dy * 60, 'UNLOCKED', { color: '#e8c84a', size: 22 });
          } else {
            Sfx.play('door_locked');
            s.fx.text(g.x - g.dx * 70, g.y - g.dy * 70, 'NEEDS A KEY', { color: '#e8c84a', size: 22 });
          }
        }
      }
    }
  }

  updateSpikes(dt) {
    this.spikeCd -= dt;
    if (this.spikeCd > 0) return;
    let any = false;
    const p = this.scene.player;
    for (const row of this.tiles) for (const t of row) {
      if (t.type !== 'spikes') continue;
      any = true;
      if (p && !p.dead && Math.abs(p.x - t.x) < TILE / 2 - 8 + 12 && Math.abs(p.y - t.y) < TILE / 2 - 8 + 12) {
        if (p.canBeHit()) p.damage(1, { x: t.x, y: t.y, kind: 'spikes' });
      }
      for (const e of this.scene.enemies) {
        if (!e.alive || e.flying) continue;
        if (Math.abs(e.x - t.x) < TILE / 2 && Math.abs(e.y - t.y) < TILE / 2) e.hurt(1, { dot: true });
      }
    }
    this.spikeCd = any ? 0.25 : 1;
  }

  // ================================================================================================ persistence / teardown
  snapshot() {
    this.state.pickups = this.pickups.filter((p) => p.alive).map((p) => p.snapshot());
  }

  destroy() {
    this.destroyed = true;
    this.snapshot();
    for (const o of this.objs) { try { o.destroy(); } catch (e) { /* */ } }
    for (const o of this.decalSprites) { try { o.destroy(); } catch (e) { /* */ } }
    this.decalSprites.length = 0;
    for (const p of this.pickups) p.destroy();
    for (const p of this.pedestals) p.destroy();
    for (const c of this.chests) c.destroy();
    for (const p of this.props) p.destroy();
    this.objs.length = this.pickups.length = this.pedestals.length = this.chests.length = this.props.length = 0;
    if (this.peddler) this.peddler = null;
  }
}
