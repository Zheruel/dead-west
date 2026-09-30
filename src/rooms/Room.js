// Runtime room: background, obstacle tiles, doors, collision, encounter waves, pickups/pedestals/chests, decals, plus the v2 layer:
// room-type dispatch (ROOM_TYPES), controllers (event / champion / vault / crossroads / secret variants), hazard + modifier hosting,
// elite rolls, mini-boss rewards and the chapter-2 reward economy.
// One Room instance is built each time the player enters a room; persistent data lives in `state` (owned by RoomManager).
import Phaser from 'phaser';
import {
  ROOM, TILE, DOORS, DIRS, DEPTH, actorDepth, tileToWorld, FLOORS, COLS, ROWS, FONT_BODY, FONT_TITLE, OPPOSITE, SPAWN_SAFE_DIST, ROOM_REWARD,
  ROOM_TYPES, VARIETY, MAX_FLOOR, floorInfo, floorBgKey, rewardFor,
} from '../config.js';
import { Assets, SPEC, IMAGE_SPEC } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { RNG, rng, subRng } from '../core/rng.js';
import Templates, { parseTemplate } from '../gen/Templates.js';
import Door from './Door.js';
import Pickup from '../entities/Pickup.js';
import Pedestal from '../entities/Pedestal.js';
import Chest from '../entities/Chest.js';
import Trapdoor from '../entities/Trapdoor.js';
import { spawnEnemy, enemyPool, enemyMeta } from '../enemies/index.js';
import { enemyWeight } from '../enemies/registry.js';
import { spawnBoss } from '../bosses/index.js';
import { getItem } from '../items/registry.js';
import { runHooks, CTX } from '../items/hooks.js';
import { explode } from '../systems/Explosions.js';
import { Affixes } from '../enemies/Affixes.js';
import { Crossroads } from '../systems/Crossroads.js';
import { itemShopPrice, heartShopPrice } from '../entities/Shop.js';
import { Boons } from '../systems/Boons.js';
import { Hazards } from './hazards/index.js';
import { Modifiers } from './special/modifiers/index.js';
import ChampionRoom from './special/ChampionRoom.js';
import EventRoom from './special/EventRoom.js';
import VaultRoom from './special/VaultRoom.js';
import CrossroadsRoom from './special/CrossroadsRoom.js';

// Secret-room variant controllers + door tells (FE-V1). Optional: the room still builds with the plain stash layout when the file is absent.
const SECRETS = Object.values(import.meta.glob('./special/SecretVariants.js', { eager: true }))[0] || {};

const BIG = 400;
/** Tile types nothing may drop onto / spawn from (walkableNear, safe spawns): they hurt or hold whoever stands there. */
const DOOR_SPAWN_MARGIN = 90; // px between an enemy body and the interior door tile centre, on top of its radius
const NO_DROP = new Set(['spikes', 'lava', 'quicksand', 'vent', 'rspikes', 'pit']);
/** Template chars that only Hazards.build draws (Room registers them as tiles and draws nothing). */
const FLOOR_HAZARD = { L: 'lava', V: 'vent', '=': 'rail', '|': 'rail', r: 'roulette', k: 'roulette', Q: 'quicksand', s: 'rspikes' };
const BARREL = { radius: 130, damage: 60, playerDamage: 2, patches: 3, spread: 90, chainMs: 110 }; // EVENTS 6.2 powder barrel `Z`
const SHOP_BASE = { passive: [10, 15], active: [10, 15], heart_full: 3, heart_tin: 5, key: 5, dynamite: 5, heart_half: 2 };
const MINI_REWARD = { itemChance: 0.5, itemChanceF1: 0.65, heartChance: 0.3, suppliesChanceF1: 0.05 }; // remainder = 2 keys + 1 dynamite (EVENTS 4.2)

export default class Room {
  constructor(scene, def, state, floorData) {
    this.scene = scene;
    this.def = def;
    this.state = state;
    this.floorData = floorData;
    this.floor = floorData.floor;
    this.type = def.type;
    this.info = ROOM_TYPES[def.type] || ROOM_TYPES.normal;
    this.pocket = !!def.pocket;
    this.tpl = Templates.get(def.template) || fallbackTemplate(def);
    this.objs = [];
    this.decalSprites = [];
    this.tiles = [];
    this.doors = {};
    this.wallRects = [];
    this.pickups = [];
    this.pedestals = [];
    this.chests = [];
    this.props = [];
    this.rings = []; // HoldRings (entities/HoldRing.js register themselves here)
    this.controllers = [];
    this.roles = {}; // controller by role: champion | event | vault | xroads | variant | tells
    this.trapdoor = null;
    this.locked = false;
    this.mode = 'idle'; // idle | combat | done
    this.waves = [];
    this.waveIdx = -1;
    this.waveEnemies = [];
    this.pending = 0;
    this.waveDelay = 0;
    this.age = 0;
    this.combatAge = 0; // seconds since the encounter started (doors locked)
    this.boss = null;
    this.mod = def.mod || null; // room modifier id (curse_dark may add 'darkness' in buildContents)
    this.hurtInRoom = false;
    this.enteredVia = null;
    this.rng = new RNG(def.seed || 1);
    this.spikeCd = 0;
    this.hazardWalk = false; // room has tiles walkers must route around (lava, retracting spikes)
    this.destroyed = false;
    this.offHurt = bus.scoped(scene, 'player:hurt', () => { this.hurtInRoom = true; });
    this.build();
  }

  track(obj) { this.objs.push(obj); return obj; }
  get center() { return { x: ROOM.cx, y: ROOM.cy }; }
  /** Controller hosted under `role`, or null. */
  controller(role) { return this.roles[role] || null; }

  // ================================================================================================ build
  build() {
    const s = this.scene;
    const kind = this.info;
    const fi = floorInfo(this.floor);
    // background: image key from the ROOM_TYPES row ('floor' = this room's a/b/c variant), falling back to the floor's own backgrounds
    let keys;
    if (kind.bg === 'floor') keys = [floorBgKey(this.floor, this.def.bg), fi.bgA, fi.bgB];
    else if (kind.bg === 'bgB') keys = [fi.bgB, fi.bgA];
    else if (kind.bg === 'bgBoss') keys = [fi.bgBoss, fi.bgA];
    else keys = [kind.bg, fi.bgA];
    this.bg = this.makeBg(keys.filter(Boolean)).setDepth(DEPTH.bg);
    if (kind.tint) this.bg.setTint(kind.tint);
    this.track(this.bg);

    this.buildTiles();
    this.buildDoors();
    this.buildWallRects();
    for (const d of this.state.decals || []) this.makeDecal(d);
    this.buildContents();
    this.buildLights();
    this.hintText();
  }

  /** Background image: real art, the round-1 placeholder (floors 1-3, shop, treasure) or a code-drawn floor for keys that have neither. */
  makeBg(keys) {
    const s = this.scene;
    const key = keys.find((k) => Assets.has(k)) || keys.find((k) => IMAGE_SPEC[k]);
    if (key) return Assets.makeImage(s, ROOM.cx, ROOM.bgY + 432, key);
    return s.add.image(ROOM.cx, ROOM.bgY + 432, placeholderBg(s, keys[0], floorInfo(this.floor).tint));
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
    if (this.pocket) return;
    if (this.floor === 3) {
      for (const row of this.tiles) for (const t of row) {
        if (t.type === 'decor' && t.decorName === 'decor_b' && t.sprite) add(t.sprite.x, t.sprite.y - 26, 0x7fdc3a, 1.5, 1.2, 0.34, 2.2);
      }
    } else if (this.floor === 2 && this.type !== 'shop') {
      add(ROOM.cx, ROOM.cy, 0xffa050, 9.4, 5.2, 0.05, 5);
    } else if (this.floor === 4) {
      add(ROOM.cx, ROOM.cy, 0xff8a30, 9.4, 5.2, 0.06, 4.2); // warm orange flicker
    } else if (this.floor === 5) {
      add(ROOM.cx, ROOM.cy, 0xd63a2a, 9.4, 5.2, 0.05, 1.3); // slow red signal blink
    } else if (this.floor === 6) {
      add(ROOM.cx, ROOM.cy, 0xf0a640, 9.4, 5.2, 0.06, 6); // gold candle flicker
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
    const want = floorInfo(this.floor).obst || `obst_f${this.floor}`;
    const obst = Assets.has(want) || SPEC[want] ? want : 'obst_f3'; // floors without obstacle art yet reuse the mine set
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
        } else if (ch === 'd') {
          // V-033: scenery must fit the room's theme. Vaults / secret rooms stay clean (no gravestones round the Dealer's safe); events use one
          // prop kind (gravestone for the gravedigger, tipped chair everywhere else). `r.chance` is still drawn so other tiles keep their variants.
          const pick = r.chance(0.5) ? 'decor_a' : 'decor_b';
          if (this.type === 'supersecret' || this.type === 'secret') { /* bare floor */ }
          else { name = this.type === 'event' ? (this.def.event === 'gravedigger' ? 'decor_a' : 'decor_b') : pick; t.type = 'decor'; t.decorName = name; }
        }
        else if (ch === 'Z') { // explosive powder barrel: breakable by one hit, chain-detonates (breakTile)
          t.type = 'breakable'; t.barrel = true; t.solid = true; t.hp = 1;
          if (broken[`${col},${row}`]) { t.broken = true; t.solid = false; }
          t.sprite = this.hazardSprite(x, bottom, t.broken ? 'rubble' : 'powder_barrel', t.broken);
        } else if (ch === 'G') { // gravestone: solid, blocks bullets (ambush handled by Hazards)
          t.type = 'block'; t.grave = true; t.solid = true;
          t.sprite = this.hazardSprite(x, bottom, 'gravestone', false);
        } else if (ch === 'T') { t.type = 'block'; t.pipe = true; t.solid = true; } // steam pipe (Hazards draws it and owns the jet)
        else if (FLOOR_HAZARD[ch]) {
          t.type = FLOOR_HAZARD[ch];
          if (t.type === 'rail') t.dir = ch === '=' ? 'h' : 'v';
          else if (t.type === 'roulette') t.color = ch;
          if (t.type === 'lava' || t.type === 'rspikes') this.hazardWalk = true;
        }
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
    // sprinkle decor on free tiles (not near doors / spawn slots); special rooms keep their floor clear for props
    const decorN = this.type === 'normal' || this.type === 'start' ? 3 : this.info.grid === false || this.type === 'event' || this.type === 'supersecret' ? 0 : 1;
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
    Hazards.build(this);
  }

  /** Obstacle-like hazard tile art: `obst_hazards` cell when the art exists, otherwise a code-drawn 96 px placeholder. */
  hazardSprite(x, bottom, name, flat) {
    const s = this.scene;
    const im = Assets.has('obst_hazards') ? Assets.makeCell(s, x, bottom, 'obst_hazards', name, 1) : s.add.image(x, bottom, hazardTexture(s, name)).setOrigin(0.5, 1);
    im.setDepth(flat ? DEPTH.floor : actorDepth(bottom));
    this.track(im);
    return im;
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
    const pal = { 1: [0xa8783c, 0x5a3418], 2: [0x6e4c2c, 0x2e1c10], 3: [0x6a5a4c, 0x261c18], 4: [0x6a2a1c, 0x2a0c08], 5: [0x3a4658, 0x141a24], 6: [0x6a1a2a, 0x2a0810] }[this.floor] || [0xa8783c, 0x5a3418];
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
    // bottom-left corner (the spawn point is the room centre); fades out on the first move / shot / roll
    this._hint = lines.map((l, i) => this.track(s.add.text(ROOM.x + 36, ROOM.bottom - 152 + i * 34, l, { fontFamily: FONT_BODY, fontSize: '26px', color: '#e8dcc0' }).setOrigin(0, 0.5).setAlpha(0.4).setDepth(DEPTH.decals + 1)));
  }

  /** Fade the first-visit controls hint once the player does anything. */
  updateHint() {
    const s = this.scene, gi = s.gameInput, p = s.player;
    if (!gi || !p || s.cutscene) return;
    const m = gi.move;
    if (!(m.x || m.y) && !gi.aim(p) && !p.rolling) return;
    const list = this._hint;
    this._hint = null;
    for (const t of list) if (t && t.scene) s.tweens.add({ targets: t, alpha: 0, duration: 500, onComplete: () => { if (t.scene) t.destroy(); } });
  }

  /** Big timed banner (event names, modifier names, vault plate). One reusable text per room. */
  banner(text, { color = '#e8dcc0', hold = 1600, size = 44, y = 262 } = {}) {
    const s = this.scene;
    let t = this.bannerText;
    if (!t) {
      t = this.bannerText = this.track(s.add.text(ROOM.cx, y, '', { fontFamily: FONT_TITLE, fontSize: `${size}px`, color, stroke: '#120c0a', strokeThickness: 8, align: 'center' }).setOrigin(0.5).setDepth(DEPTH.overlay - 10));
    }
    s.tweens.killTweensOf(t);
    t.setText(text).setColor(color).setFontSize(size).setY(y).setAlpha(0);
    s.tweens.add({ targets: t, alpha: 1, duration: 220, onComplete: () => { if (t.scene) s.tweens.add({ targets: t, alpha: 0, delay: hold, duration: 420 }); } });
    return t;
  }

  // ================================================================================================ contents
  buildContents() {
    const st = this.state;
    const tpl = this.tpl;
    const def = this.def;
    const RW = rewardFor(this.floor);
    if (!st.populated) {
      st.populated = true;
      st.pickups = st.pickups || [];
      st.pedestals = st.pedestals || [];
      st.chests = st.chests || [];
      const items = this.scene.items;
      const r = subRng('room', def.seed); // deterministic per room and seed, independent of how the run played out (daily fairness)
      const roll = (pool, slot, o) => items.roll(pool, subRng('item', def.seed, slot), o); // ARCH D15
      if (this.type === 'treasure') {
        const group = tpl.pickOne ? 1 : null;
        tpl.slots.I.forEach((p, i) => {
          const id = roll('treasure', i);
          if (id) st.pedestals.push({ ...tileToWorld(p.c, p.r), itemId: id, price: null, group, taken: false });
          else st.pickups.push({ type: r.pick(['heart_tin', 'heart_full', 'key']), ...tileToWorld(p.c, p.r) }); // item pool exhausted: never leave the reward spot empty
        });
      } else if (this.type === 'shop') {
        const P = { ...SHOP_BASE, ...(RW.shop || {}) };
        const slots = tpl.slots.H;
        const item = roll('shop', 0);
        const hp = (t) => (t.startsWith('heart') ? heartShopPrice(P[t], this.scene.diff) : P[t]); // Hell: +1 on red hearts (Shop.js)
        const range = item && getItem(item) && getItem(item).type === 'active' ? P.active : P.passive;
        const rp = r.int(range[0], range[1]); // always drawn: keeps the room stream (and every later roll) identical to before the tier prices
        if (item) {
          const def0 = getItem(item);
          st.pedestals.push({ ...tileToWorld(slots[0].c, slots[0].r), itemId: item, price: def0 ? itemShopPrice(def0, this.floor) : rp, group: null, taken: false }); // tier price (T1 10 / T2 13 / T3 16, +2 active, +3 on F4-6)
        } else { const t = r.pick(['heart_full', 'key', 'dynamite', 'heart_tin']); st.pickups.push({ type: t, ...tileToWorld(slots[0].c, slots[0].r), price: hp(t) }); } // item pool exhausted
        const kind2 = r.chance(0.7) ? 'heart_full' : 'heart_tin';
        st.pickups.push({ type: kind2, ...tileToWorld(slots[1].c, slots[1].r), price: hp(kind2) });
        const kind3 = r.pick(['key', 'dynamite', 'key', 'dynamite', 'heart_half']);
        st.pickups.push({ type: kind3, ...tileToWorld(slots[2].c, slots[2].r), price: hp(kind3) });
      } else if (this.type === 'secret' && (!def.variant || def.variant === 'stash')) {
        for (const p of tpl.slots.C) {
          const w = tileToWorld(p.c, p.r);
          st.pickups.push({ type: this.rollPickup(1.2, true), ...w });
        }
        if (r.chance(0.4)) {
          const id = roll('secret', 0);
          const p = tpl.slots.I[0];
          if (id && p) st.pedestals.push({ ...tileToWorld(p.c, p.r), itemId: id, price: null, group: null, taken: false });
        }
      }
    }
    for (const rec of st.pedestals || []) this.makePedestal(rec);
    for (const rec of st.pickups || []) this.pickups.push(new Pickup(this.scene, rec.type, rec.x, rec.y, { price: rec.price }));
    for (const rec of st.chests || []) this.makeChest(rec);
    if (this.type === 'shop' && tpl.slots.K.length) {
      const k = tileToWorld(tpl.slots.K[0].c, tpl.slots.K[0].r);
      const ped = Assets.makeCell(this.scene, k.x, k.y + 50, 'props', 'peddler', 1).setDepth(actorDepth(k.y + 50));
      this.track(ped);
      this.peddler = ped;
    }
    if (st.trapdoor) { this.trapdoor = new Trapdoor(this.scene, st.trapdoor, this); this.props.push(this.trapdoor); }
    if (this.type === 'boss' && !this.pocket && typeof Crossroads.restoreGate === 'function') Crossroads.restoreGate(this.scene, this);
    // modifiers: template/floor-gen modifier, or the curse of the dark (deterministic per room seed)
    if (!this.mod && this.type === 'normal' && typeof Boons.darkRoomMod === 'function') this.mod = Boons.darkRoomMod(this.scene.player, def) || null;
    if (this.mod) Modifiers.build(this);
    this.buildControllers();
    // encounter plan
    st.cleared = st.cleared ?? !!this.info.cleared;
    if (!st.cleared) this.planEncounter();
  }

  /** Host the controller(s) this room needs. A controller that throws is dropped (logged once) instead of taking the room down. */
  buildControllers() {
    const st = this.state, def = this.def;
    const ctl = st.ctl || (st.ctl = {});
    const add = (role, C, state) => {
      if (!C) return null;
      let c = null;
      try { c = new C(this, def, state); c.role = role; c.build(); } catch (e) { console.error(`[Room] ${role} controller failed to build`, e); return null; }
      this.controllers.push(c);
      this.roles[role] = c;
      return c;
    };
    if (this.type === 'champion') add('champion', ChampionRoom, ctl);
    else if (this.type === 'event') add('event', EventRoom, st.event || (st.event = { id: def.event, uses: 0, net: 0, done: false, data: {} }));
    else if (this.type === 'supersecret') add('vault', VaultRoom, ctl);
    else if (this.type === 'crossroads') add('xroads', CrossroadsRoom, ctl);
    else if (this.type === 'secret' && def.variant && def.variant !== 'stash' && SECRETS.VARIANTS) add('variant', SECRETS.VARIANTS[def.variant], ctl);
    if (SECRETS.Tells && this.secretDoors().length) add('tells', SECRETS.Tells, ctl.tells || (ctl.tells = {}));
  }

  /** Unrevealed secret doors of this room that carry a tell (crack / knock / chalk). */
  secretDoors() {
    const out = [];
    for (const d of Object.values(this.doors)) if (d.kind === 'secret' && !d.data.revealed && d.data.tell) out.push(d);
    return out;
  }

  /** Run `fn(controller)` on every hosted controller, isolating failures. */
  eachController(name, arg) {
    for (let i = 0; i < this.controllers.length; i++) {
      const c = this.controllers[i];
      if (c.failed || typeof c[name] !== 'function') continue;
      try { c[name](arg); } catch (e) { c.failed = true; console.error(`[Room] ${c.role} controller ${name} failed`, e); }
    }
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
  makeChest(rec) {
    const c = new Chest(this.scene, rec, this);
    this.chests.push(c);
    return c;
  }

  // ================================================================================================ encounters
  planEncounter() {
    const tpl = this.tpl;
    const r = new RNG(this.def.seed ^ 0x51ed);
    const pool = enemyPool(this.floor);
    const pickFrom = (rr) => (pool.length ? rr.weighted(pool.map((id) => ({ id, w: enemyWeight(id, this.floor) })), (o) => o.w).id : 'outlaw');
    const pick = () => pickFrom(r);
    if (this.type === 'boss' || this.type === 'champion') {
      this.waves = [];
      return;
    }
    const waves = [];
    const digits = Object.keys(tpl.slots.waves).sort();
    // r.next() where the round-1 code rolled the 8 % `cursed` flag: keeps wave composition of existing seeds unchanged (elites use their own stream below)
    for (const dgt of digits) {
      const positions = tpl.slots.waves[dgt];
      const list = tpl.waves[dgt] || [];
      waves.push(positions.map((p, i) => { const id = list[i] || pick(); r.next(); return { id, ...tileToWorld(p.c, p.r) }; }));
    }
    // template `air` spawns: flyers that may hover over pits/obstacles, added to the wave with that digit
    for (const [dgt, list] of Object.entries(tpl.air || {})) {
      const w = waves[digits.indexOf(dgt)];
      if (w) for (const [c, rr, id] of list) { r.next(); w.push({ id, ...tileToWorld(c, rr), air: true }); }
    }
    if (tpl.slots.E.length) {
      const extra = tpl.slots.E.map((p) => { const id = pick(); r.next(); return { id, ...tileToWorld(p.c, p.r) }; });
      if (waves.length) waves[0].push(...extra); else waves.push(extra);
    }
    // gentle start: rooms right next to the start room only get their first wave
    if (this.def.dist <= 1 && waves.length > 1) waves.length = 1;
    // difficulty: Hell adds one more enemy to a wave with probability diff.extraEnemy (own stream: never shifts the composition above)
    const diff = this.scene.diff;
    if (diff && diff.extraEnemy > 0) this.addExtraEnemies(waves, new RNG(this.def.seed ^ 0xD1FF), diff.extraEnemy, pickFrom);
    if (!waves.length) this.state.cleared = true;
    else { this.capEnemy(waves, pool, 'signalman', 2); this.rollElites(waves); }
    this.waves = waves;
  }
  /** Per-room cap for one enemy id (CHAPTER2 s4: signalman <= 2): surplus records are re-picked from the floor pool without it, own rng stream. */
  capEnemy(waves, pool, id, max) {
    let n = 0, xr = null;
    const rest = pool.filter((p) => p !== id);
    for (const w of waves) for (const rec of w) {
      if (rec.id !== id || ++n <= max) continue;
      xr = xr || new RNG(this.def.seed ^ 0x5163);
      rec.id = rest.length ? xr.pick(rest) : 'outlaw';
    }
  }

  /** One extra enemy per wave with probability `p`, on a random free floor tile (safeSpawns still keeps it away from the player). */
  addExtraEnemies(waves, xr, p, pickFrom) {
    const free = [];
    const doorTiles = new Set(DIRS.flatMap((d) => [DOORS[d].tile.join(','), DOORS[d].front.join(',')]));
    for (const row of this.tiles) for (const t of row) if (t.ch === '.' && !t.type && !doorTiles.has(`${t.c},${t.r}`)) free.push(t);
    if (!free.length) return;
    for (const w of waves) {
      if (!w.length || !xr.chance(p)) continue;
      const t = xr.pick(free);
      w.push({ id: pickFrom(xr), x: t.x, y: t.y });
    }
  }

  /** Elite affixes (D3): one dedicated stream over every wave record in wave order; Affixes sets rec.affixes[] / rec.cursed. */
  rollElites(waves) {
    if (typeof Affixes.rollWave !== 'function') return;
    const records = [];
    for (const w of waves) for (const rec of w) records.push(rec);
    const sc = this.scene;
    Affixes.rollWave(new RNG(this.def.seed ^ 0xE11E), records, { floor: this.floor, diff: sc.diff, player: sc.player, allCursed: !!(sc.mut && sc.mut.allCursed) });
  }

  /** Called by RoomManager once the player has walked in. */
  onEntered(via) {
    this.enteredVia = via;
    const st = this.state;
    const first = !st.entered;
    st.entered = true;
    st.visited = true;
    const p = this.scene.player;
    p.onRoomEntered();
    this.hookRoom('roomEnter');
    bus.emit('room:entered', { room: this, roomId: this.def.id, type: this.type, first });
    if (first && this.type === 'secret') bus.emit('secret:found', { variant: this.def.variant || 'stash' });
    if (first && this.type === 'supersecret') bus.emit('supersecret:entered', {});
    this.eachController('onEnter');
    if (!st.cleared) this.startEncounter();
  }

  /** Item hooks roomEnter / wave / roomClear through the shared context object (no allocation). */
  hookRoom(name) {
    const p = this.scene.player;
    if (!p) return;
    const c = CTX.room;
    c.room = this; c.perfect = !this.hurtInRoom; c.enemies = this.waveEnemies.length;
    runHooks(p, name, c);
  }

  startEncounter() {
    if (this.mode !== 'idle') return;
    this.mode = 'combat';
    this.combatAge = 0;
    this.lock();
    if (this.type === 'boss') { this.startBoss(); return; }
    if (this.type === 'champion') { this.startMini(); return; }
    this.waveIdx = -1;
    this.waveDelay = 0.35;
    this.pending = 0;
  }

  lock() {
    this.locked = true;
    for (const d of Object.values(this.doors)) d.refresh();
    this.buildWallRects();
    Modifiers.onLock(this);
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
    const spawned = [];
    this.waveEnemies = spawned;
    let left = wave.length;
    for (const w of wave) {
      const meta = enemyMeta(w.id);
      if (meta && meta.ambush) { // disguised ambushers (crate_mimic): no spawn puff / telegraph, they simply are there
        const e = spawnEnemy(this.scene, w.id, w.x, w.y, { cursed: !!w.cursed, affixes: w.affixes, floor: this.floor, instant: true });
        if (e) spawned.push(e);
        if (--left === 0) { bus.emit('room:wave', { room: this, enemies: spawned }); this.hookRoom('wave'); }
        continue;
      }
      this.scene.fx.spawn(w.x, w.y, Math.max(0.8, (meta?.r ?? 30) / 34));
      bus.emit('spawn:telegraph', { x: w.x, y: w.y });
      this.pending++;
      this.scene.time.delayedCall(560, () => {
        this.pending--;
        if (this.destroyed || this.scene.room !== this) return;
        const e = spawnEnemy(this.scene, w.id, w.x, w.y, { cursed: !!w.cursed, affixes: w.affixes, floor: this.floor });
        if (e) spawned.push(e);
        if (--left === 0) { bus.emit('room:wave', { room: this, enemies: spawned }); this.hookRoom('wave'); }
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
    const D = SPAWN_SAFE_DIST;
    const minD = pts.length ? (x, y) => Math.min(...pts.map((q) => Math.hypot(q.x - x, q.y - y))) : () => Infinity;
    // door margin (V-005): a body may not sit on / against any door of the room (big enemies like the magma golem overlapped the frame)
    const doorC = Object.keys(this.doors || {}).filter((d) => DOORS[d]).map((d) => tileToWorld(DOORS[d].tile[0], DOORS[d].tile[1]));
    const nearDoor = (x, y, r) => doorC.some((c) => Math.hypot(c.x - x, c.y - y) < r + DOOR_SPAWN_MARGIN);
    const doorTiles = new Set(DIRS.flatMap((d) => [DOORS[d].tile.join(','), DOORS[d].front.join(',')]));
    const used = [];
    const out = [];
    for (const w of wave) {
      let pos = { x: w.x, y: w.y };
      const em = enemyMeta(w.id) || {};
      const er = em.r || 30;
      if (minD(w.x, w.y) < D || nearDoor(w.x, w.y, er)) {
        const fly = !!em.flying;
        let best = null, bestScore = Infinity, far = null, farD = -1;
        for (const row of this.tiles) for (const t of row) {
          if ((NO_DROP.has(t.type) && t.type !== 'pit') || (t.solid && !(fly && t.type === 'pit')) || doorTiles.has(`${t.c},${t.r}`)) continue;
          if (used.some((u) => Math.hypot(u.x - t.x, u.y - t.y) < 70)) continue;
          if (nearDoor(t.x, t.y, er)) continue;
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

  /** Spawn position for the '1' slot of a boss / champion template: mirrored away from the entry door, pushed off the door axis. */
  entrySlotPos(slot) {
    let { x, y } = tileToWorld(slot.c, slot.r);
    const via = this.enteredVia;
    if (via === 'up' && y < ROOM.cy) y = 2 * ROOM.cy - y;
    else if (via === 'down' && y > ROOM.cy) y = 2 * ROOM.cy - y;
    else if (via === 'left' && x < ROOM.cx) x = 2 * ROOM.cx - x;
    else if (via === 'right' && x > ROOM.cx) x = 2 * ROOM.cx - x;
    // vertical entrances: push the boss further from the door
    if (via === 'up') y = Math.max(y, ROOM.cy + 60);
    if (via === 'down') y = Math.min(y, ROOM.cy - 60);
    return { x, y };
  }

  startBoss() {
    const tpl = this.tpl;
    const { x, y } = this.entrySlotPos(tpl.slots.waves['1'][0]);
    this.boss = spawnBoss(this.scene, tpl.boss, x, y, { floor: this.floor });
    this.scene.beginBossIntro(this.boss);
  }

  /** Champion room: spawn the mini-boss (invulnerable until the WANTED card ends, ChampionRoom.intro then calls startFight). */
  startMini() {
    const tpl = this.tpl;
    const id = this.def.mini || (tpl.waves['1'] || [])[0];
    const slot = (tpl.slots.waves['1'] || [])[0];
    if (!id || !slot) { console.error(`[Room] champion room ${this.def.id} has no mini / '1' slot`); this.clearRoom({ boss: true }); return; }
    const { x, y } = this.entrySlotPos(slot);
    this.boss = spawnBoss(this.scene, id, x, y, { floor: this.floor });
    const c = this.controller('champion');
    if (c) c.intro(this.boss);
    else { this.scene.time.delayedCall(1000, () => { if (this.boss && this.boss.alive) this.boss.startFight(); }); }
  }

  onBossDefeated(boss) {
    // kill leftover adds silently
    for (const e of [...this.scene.enemies]) if (e !== boss && e.alive) { e.hp = 0; e.die({ silent: true }); }
    this.scene.bullets.enemy.clear();
    const st = this.state;
    if (this.floor >= MAX_FLOOR) { this.clearRoom({ boss: true }); return; } // the final boss ends the run (flow.js), no reward
    const pos = { x: ROOM.cx, y: ROOM.cy };
    st.trapdoor = { x: pos.x, y: pos.y + 40 };
    st.pedestals = st.pedestals || [];
    st.pickups = st.pickups || [];
    // reward (CHAPTER2 s7): Undertaker and Engine offer a pick-one pair, the others a single boss-pool item; plus a heart and the trapdoor
    const pair = this.floor === 3 || this.floor === 5;
    const seed = this.def.seed;
    const spots = pair ? [pos.x - 90, pos.x + 90] : [pos.x];
    spots.forEach((px, i) => {
      const id = this.scene.items.roll('boss', subRng('item', seed, i));
      if (id) this.spawnPedestal({ x: px, y: pos.y - 110, itemId: id, price: null, group: pair ? 'boss' : null, taken: false });
      else this.dropPickup('heart_tin', px, pos.y - 110, { pop: true }); // item pool exhausted
    });
    this.dropPickup('heart_full', pos.x + 130, pos.y + 40, { pop: true });
    this.trapdoor = new Trapdoor(this.scene, st.trapdoor, this); this.props.push(this.trapdoor);
    if (this.floor <= 5 && typeof Crossroads.onBossDefeated === 'function') Crossroads.onBossDefeated(this.scene, this);
    this.clearRoom({ boss: true });
  }

  /**
   * Champion reward (EVENTS 4.2), rolled with subRng('mini', floor): bounty coins (bounty / 5 nickels), a free gold chest and ONE bonus:
   * item pedestal (treasure pool) / heart container / keys + dynamite. `mini:defeated` is emitted by MiniBoss itself.
   */
  onMiniDefeated(mini) {
    const st = this.state;
    if (st.miniDone) return;
    st.miniDone = true;
    for (const e of [...this.scene.enemies]) if (e !== mini && e.alive) { e.hp = 0; e.die({ silent: true }); }
    this.scene.bullets.enemy.clear();
    const r = subRng('mini', this.floor);
    const meta = (mini && mini.meta) || {};
    const bounty = meta.bounty ?? 10 + 5 * this.floor;
    const cx = ROOM.cx, cy = ROOM.cy;
    st.pedestals = st.pedestals || [];
    st.chests = st.chests || [];
    const nick = Math.max(1, Math.round(bounty / 5));
    for (let i = 0; i < nick; i++) this.dropPickup('coin_nickel', cx + (i - (nick - 1) / 2) * 34, cy + 70, { pop: true });
    this.spawnChest('chest_gold', cx - 170, cy + 10, { free: true });
    const f1 = this.floor === 1;
    const roll = r.next();
    const itemP = f1 ? MINI_REWARD.itemChanceF1 : MINI_REWARD.itemChance;
    const supplyP = f1 ? MINI_REWARD.suppliesChanceF1 : 1 - MINI_REWARD.itemChance - MINI_REWARD.heartChance;
    const spot = { x: cx, y: cy - 110 };
    if (roll < itemP) {
      const id = this.scene.items.roll('treasure', subRng('item', this.def.seed, 0));
      if (id) this.spawnPedestal({ x: spot.x, y: spot.y, itemId: id, price: null, group: null, taken: false });
      else this.dropPickup('heart_container', spot.x, spot.y, { pop: true }); // pool empty: the heart container instead
    } else if (roll < 1 - supplyP) this.dropPickup('heart_container', spot.x, spot.y, { pop: true });
    else { this.dropPickup('key', spot.x - 30, spot.y, { pop: true }); this.dropPickup('key', spot.x + 30, spot.y, { pop: true }); this.dropPickup('dynamite', spot.x, spot.y + 30, { pop: true }); }
    this.eachController('onMiniDefeated', mini);
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
    this.hookRoom('roomClear');
    Modifiers.onClear(this);
    this.eachController('onCleared');
    if (!o.boss) { this.scene.fx.ringPulse(ROOM.cx, ROOM.cy + 20, 0xf0d080, 420, 700, 0.3); this.scene.fx.flash(0xf0d080, 0.1); } // room-clear chime flourish (doors swing open via Door.juice)
    const p = this.scene.player;
    const r = rng.game;
    if (!o.boss) {
      // reward drop
      const luck = p.stats.luck;
      // reward curve (config ROOM_REWARD, chapter-2 overrides via rewardFor): harder templates pay slightly more, a drop is guaranteed after a dry streak,
      // elites (+0.25, guaranteed from 2) and modifier rooms (+0.08 / blood moon guaranteed) pay extra; Hell lowers the base chance and stretches the streak
      const RW = rewardFor(this.floor);
      const diff = this.scene.diff;
      const sc = this.scene.run || this.scene; // per-run counter (scene objects are reused between runs)
      const pity = diff && diff.pityRooms ? Math.max(1, diff.pityRooms - (ROOM_REWARD.pityRooms - RW.pityRooms)) : RW.pityRooms;
      const elites = st.eliteKills || 0;
      const mb = Modifiers.clearBonus(this) || (this.mod ? { drop: VARIETY.mod.clearBonus } : null);
      const chance = (diff && diff.dropChance != null ? diff.dropChance : RW.dropChance) + luck * RW.luckBonus + ((this.tpl.tier || 1) - 1) * RW.tierBonus + (elites >= 1 ? 0.25 : 0) + (mb && mb.drop ? mb.drop : 0);
      const sure = elites >= 2 || (mb && mb.guaranteed);
      const drop = sure || r.chance(chance) || (sc.dryClears || 0) >= pity;
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

  /** `o.free` = gold chest that opens without a key (mini-boss reward). */
  spawnChest(type, x, y, o = {}) {
    ({ x, y } = this.walkableNear(x, y));
    const rec = { x, y, type, opened: false };
    if (o.free) rec.free = true;
    this.state.chests.push(rec);
    return this.makeChest(rec);
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
    const RW = rewardFor(this.floor);
    const W = RW.pickupWeights; // chapter-2 table (CHAPTER2 s7), absent on floors 1-3
    const cm = p.stats.coinMult > 1 ? 1.4 : 1;
    const items = W
      ? [
        { t: 'coin', w: W.coin * cm }, { t: 'coin_nickel', w: W.coin_nickel + bonus * 3 + lk },
        { t: 'heart_full', w: W.heart_full + lk * 0.7 + (hurt ? 9 : 0) }, { t: 'heart_half', w: W.heart_half + (hurt ? 10 : 0) }, { t: 'heart_tin', w: W.heart_tin + bonus + lk * 0.4 },
        { t: 'key', w: W.key }, { t: 'dynamite', w: W.dynamite },
      ]
      : [
        { t: 'coin', w: 40 * cm }, { t: 'coin_nickel', w: 6 + bonus * 3 + lk },
        { t: 'heart_full', w: 7 + lk * 0.7 + (hurt ? 9 : 0) }, { t: 'heart_half', w: 14 + (hurt ? 10 : 0) }, { t: 'heart_tin', w: 3 + bonus + lk * 0.4 },
        { t: 'key', w: 12 }, { t: 'dynamite', w: 12 },
      ];
    const mut = this.scene.mut;
    const diff = this.scene.diff;
    let list = items;
    if (mut && (mut.noHearts || mut.noCoinDrops)) {
      list = items.filter((o) => !(mut.noHearts && o.t.startsWith('heart')) && !(mut.noCoinDrops && (o.t === 'coin' || o.t === 'coin_nickel' || o.t === 'key')));
      if (!list.length) list = items;
    }
    const g = rng.game;
    let t = g.weighted(list, (o) => o.w).t;
    if (t === 'heart_full' && diff && diff.heartDowngrade > 0 && g.chance(diff.heartDowngrade)) t = 'heart_half'; // Hell: fewer full hearts
    return t;
  }
  tileAt(x, y) {
    const c = Math.floor((x - ROOM.x) / TILE), r = Math.floor((y - ROOM.y) / TILE);
    return (this.tiles[r] && this.tiles[r][c]) || null;
  }
  /** Nearest spot a pickup / chest can actually be reached from: drops over a pit / rock / spikes / lava / quicksand were unreachable or punishing. */
  walkableNear(x, y) {
    const ok = (t) => t && !t.solid && !NO_DROP.has(t.type);
    if (!this.probe(x, y, 18) && ok(this.tileAt(x, y))) return { x, y };
    let best = null, bd = Infinity;
    for (const row of this.tiles) for (const t of row) {
      if (!ok(t)) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bd) { bd = d; best = t; }
    }
    return best ? { x: best.x, y: best.y } : { x, y };
  }
  reachableSpot(x, y) { return this.walkableNear(x, y); }
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

  // ================================================================================================ fire / lanes (Hazards facade)
  /** FirePatch (D2): circle r, life `dur`; o = {dmg = 1, team = 'enemy'|'player', dps}. */
  addFire(x, y, r, dur, o) { return Hazards.addFire(this, x, y, r, dur, o); }
  /** Several patches around (x, y): o = {r, life, count, spread}. */
  ignite(x, y, o) { return Hazards.ignite(this, x, y, o); }
  /** Lane sweep (cart / ghost / herd): {axis, index, dir, speed, kind, dmg, w, tell}. */
  spawnLane(o) { return Hazards.spawnLane(this, o); }
  /** Lava tile graph for magma_eel (BFS over lava tiles only). */
  lavaPath() { return Hazards.lavaPath(this); }

  /** Called by explode(): player dynamite (and o.fire === true blasts) leave four fire patches within 0.8 R. */
  onExplosion(x, y, radius, o = {}) {
    const src = o.source;
    const so = src && src.o;
    // any player-owned stick whose blast can hurt its owner (placed dynamite, lit_cigar throws); the Dynamite Crate ring (hurtPlayer:false) stays clean
    const playerBlast = o.fire === true || (so && so.owner === 'player' && so.hurtPlayer !== false && so.hurtEnemies !== false && src.fuse !== undefined);
    if (o.fire === false || o.noFire || !playerBlast) return;
    this.ignite(x, y, { r: 44, life: 3.5, count: 4, spread: radius * 0.8 });
  }

  /** A player bullet died on the room bounds at (x, y): brittle secret doors ("crack" tell) open after VARIETY.secret.brittleHits hits nearby. */
  onWallHit(x, y) {
    for (const d of Object.values(this.doors)) {
      if (d.kind !== 'secret' || d.data.revealed || !d.data.brittle) continue;
      if (Math.hypot(d.geom.x - x, d.geom.y - y) > 130) continue;
      d.data.hits = (d.data.hits || 0) + 1;
      this.scene.fx.burst(x, y, { color: [0x8a7a68, 0xb8a888], count: 4, speed: [30, 120], life: [200, 420], gravity: 160 });
      if (d.data.hits >= VARIETY.secret.brittleHits) this.revealDoor(d);
    }
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

  /**
   * True if a circle at (x,y,r) would overlap a solid obstacle tile (for steering probes). With an `actor` on a room that has lava /
   * retracting spikes, walkers also ask the hazards whether the spot is off limits (lava is not solid: the player may cross it).
   */
  probe(x, y, r, actor) {
    if (actor && actor.flying) return false;
    const c0 = Math.floor((x - r - ROOM.x) / TILE), c1 = Math.floor((x + r - ROOM.x) / TILE);
    const r0 = Math.floor((y - r - ROOM.y) / TILE), r1 = Math.floor((y + r - ROOM.y) / TILE);
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      if (rr < 0 || cc < 0 || rr >= ROWS || cc >= COLS) return true;
      if (this.tiles[rr][cc].solid) return true;
    }
    return !!(actor && this.hazardWalk && Hazards.blocks(this, x, y, r, actor));
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
    if (t.barrel) { this.detonateBarrel(t); return; }
    if (t.sprite) { t.sprite.setFrame(Assets.frame(t.obst, 'breakable_broken')).setDepth(DEPTH.floor); }
    this.scene.fx.burst(t.x, t.y, { color: [0x8a5a2a, 0x6b4423, 0xb8843f], count: 14, speed: [60, 260], gravity: 200 });
    this.scene.fx.dust(t.x, t.y + 20, 1.1);
    Sfx.play('bullet_hit_wall', { vol: 0.8, detune: -300 });
    if (rng.game.chance(ROOM_REWARD.breakableDrop + (this.scene.player ? this.scene.player.stats.luck : 0) * ROOM_REWARD.luckBonus * 0.5)) this.dropPickup(this.rollPickup(), t.x, t.y, { pop: true }); // luck-weighted
  }
  /** Powder barrel: blast r130 (60 to enemies, 2 units to the player unless explosion-immune), three fire patches, neighbours chain-detonate. */
  detonateBarrel(t) {
    const s = this.scene;
    if (t.sprite) {
      const flat = Assets.has('obst_hazards');
      if (flat) t.sprite.setFrame(Assets.frame('obst_hazards', 'rubble')); else t.sprite.setTexture(hazardTexture(s, 'rubble'));
      t.sprite.setDepth(DEPTH.floor);
    }
    const p = s.player;
    explode(s, t.x, t.y, { radius: BARREL.radius, damage: BARREL.damage, playerDamage: p && p.stats.explosionImmune ? 0 : BARREL.playerDamage, source: 'barrel' });
    this.ignite(t.x, t.y, { r: 44, life: 3.5, count: BARREL.patches, spread: BARREL.spread });
  }
  /** Chain reaction: a barrel inside another blast goes off a beat later (never recursively inside the same call). */
  armBarrel(t) {
    if (t.armed || t.broken) return;
    t.armed = true;
    this.scene.time.delayedCall(BARREL.chainMs, () => { if (!this.destroyed && this.scene.room === this) this.breakTile(t); });
  }
  explodeAt(x, y, radius) {
    for (const row of this.tiles) for (const t of row) {
      if (t.type !== 'breakable' || t.broken || Math.hypot(t.x - x, t.y - y) >= radius + TILE * 0.5) continue;
      if (t.barrel) this.armBarrel(t); else this.breakTile(t);
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
    if (this.mode === 'combat') this.combatAge += dt;
    for (const p of [...this.pickups]) p.update(dt);
    for (const p of this.pedestals) p.update(dt);
    for (const c of this.chests) c.update(dt);
    for (const p of this.props) p.update(dt);
    for (let i = this.rings.length - 1; i >= 0; i--) this.rings[i].update(dt);
    if (this._hint) this.updateHint();
    this.updateEncounter(dt);
    this.updateDoors(dt);
    if (this.destroyed) return; // a door transition just tore this room down: don't run spikes/lights against the dead room
    this.updateSpikes(dt);
    if (this.controllers.length) this.eachController('update', dt);
    Hazards.update(this, dt);
    if (this.mod) Modifiers.update(this, dt);
    if (this.lights && this.lights.length) this.updateLights();
  }

  updateEncounter(dt) {
    if (this.mode !== 'combat' || this.type === 'boss' || this.type === 'champion') return;
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
            bus.emit('key:used', { room: this.def.id, door: g.dir });
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
    if (this.offHurt) { this.offHurt(); this.offHurt = null; }
    for (const c of this.controllers) { try { c.destroy(); } catch (e) { console.error('[Room] controller destroy failed', e); } }
    this.controllers.length = 0;
    this.roles = {};
    for (let i = this.rings.length - 1; i >= 0; i--) this.rings[i].destroy();
    try { if (this.mod) Modifiers.destroy(this); } catch (e) { console.error('[Room] modifier destroy failed', e); }
    try { Hazards.dispose(this); } catch (e) { console.error('[Room] hazard dispose failed', e); }
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

// ==================================================================================================== fallbacks
const OPEN = ['.............', '.............', '.............', '.............', '.............', '.............', '.............'];
const put = (rows, c, r, ch) => { rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1); };

/** Template used when `def.template` is not registered (new special rooms before their templates exist): an open arena with the marker slots. */
function fallbackTemplate(def) {
  const rows = [...OPEN];
  const waves = {};
  if (def.type === 'crossroads') { put(rows, 6, 1, 'K'); for (const c of [2, 6, 10]) put(rows, c, 3, 'I'); }
  else if (def.type === 'event') { put(rows, 6, 2, 'K'); for (const c of [4, 8]) put(rows, c, 4, 'I'); for (const c of [2, 4, 6, 8, 10]) put(rows, c, 5, 'C'); }
  else if (def.type === 'champion') { put(rows, 6, 2, '1'); for (const [c, r] of [[3, 2], [9, 2], [3, 4], [9, 4]]) put(rows, c, r, 'R'); if (def.mini) waves[1] = [def.mini]; }
  else if (def.type === 'supersecret') { for (const c of [4, 8]) put(rows, c, 3, 'I'); }
  else if (def.type === 'secret') { for (const c of [4, 6, 8]) put(rows, c, 3, 'C'); put(rows, 6, 2, 'I'); }
  console.warn(`[Room] template '${def.template}' missing for ${def.type} room ${def.id}: using the built-in fallback layout`);
  return parseTemplate({ id: `fallback_${def.type}`, kind: def.type, floors: [1, 2, 3, 4, 5, 6], layout: rows, waves });
}

/** Code-drawn background for keys with neither art nor a round-1 placeholder (floors 4-6, crossroads): dark floor + wall band in the floor's tint. */
function placeholderBg(scene, key, tint) {
  const k = `phbg_${key}`;
  if (scene.textures.exists(k)) return k;
  const crossroads = key === 'bg_crossroads';
  const base = crossroads ? [42, 16, 20] : [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255];
  const rgb = (m, a = 1) => `rgba(${Math.round(base[0] * m)},${Math.round(base[1] * m)},${Math.round(base[2] * m)},${a})`;
  const t = scene.textures.createCanvas(k, 1440, 864);
  const c = t.getContext();
  c.fillStyle = rgb(0.45); c.fillRect(0, 0, 1440, 864);
  c.fillStyle = rgb(1.15); c.fillRect(96, 96, 1248, 672);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.07})`; c.fillRect(96 + rnd() * 1248, 96 + rnd() * 672, 4 + rnd() * 20, 2); }
  for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.04})`; c.fillRect(96 + rnd() * 1248, 96 + rnd() * 672, 3, 3); }
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 6; c.strokeRect(96, 96, 1248, 672);
  const g = c.createRadialGradient(720, 432, 260, 720, 432, 900);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
  c.fillStyle = g; c.fillRect(0, 0, 1440, 864);
  t.refresh();
  return k;
}

/** Code-drawn 96 px placeholders for the obstacle-like hazard tiles (powder barrel, gravestone, rubble), generated once per texture manager. */
function hazardTexture(scene, name) {
  const k = `ph_${name}`;
  if (scene.textures.exists(k)) return k;
  const t = scene.textures.createCanvas(k, 96, 96);
  const c = t.getContext();
  c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = '#120c0a';
  if (name === 'powder_barrel') {
    c.fillStyle = '#7a4a22'; c.beginPath(); c.roundRect(22, 22, 52, 66, 12); c.fill(); c.stroke();
    c.fillStyle = '#3a2418'; c.fillRect(22, 38, 52, 6); c.fillRect(22, 68, 52, 6);
    c.fillStyle = '#c0392b'; c.beginPath(); c.arc(48, 55, 9, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = '#e8c84a'; c.lineWidth = 3; c.beginPath(); c.moveTo(48, 22); c.quadraticCurveTo(58, 8, 66, 12); c.stroke();
  } else if (name === 'gravestone') {
    c.fillStyle = '#8a8a88'; c.beginPath(); c.moveTo(24, 90); c.lineTo(24, 36); c.arc(48, 36, 24, Math.PI, 0); c.lineTo(72, 90); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#3a3a3a'; c.lineWidth = 5; c.beginPath(); c.moveTo(48, 36); c.lineTo(48, 70); c.moveTo(38, 46); c.lineTo(58, 46); c.stroke();
  } else { // rubble
    c.fillStyle = '#4a3a30';
    for (const [x, y, r] of [[34, 78, 12], [56, 80, 10], [46, 70, 9], [70, 84, 7], [24, 84, 7]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    c.fillStyle = '#120c0a'; c.globalAlpha = 0.35; c.beginPath(); c.ellipse(48, 82, 34, 9, 0, 0, 7); c.fill();
  }
  t.refresh();
  return k;
}
