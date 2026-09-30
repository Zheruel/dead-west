// Global constants. Pure data (no Phaser import) so node scripts can use it.
import { ITEM_BASE_V2 } from './items/baseStats.js';
import { CHAR_BASE_V2 } from './data/charBaseStats.js';

export const W = 1440;
export const H = 960;
export const TILE = 96;
export const COLS = 13; // interior tiles wide
export const ROWS = 7; // interior tiles tall

// Interior (playable) rectangle. The room bg image (1440x864) is drawn at y=96; wall band = 96px on every side.
export const ROOM = {
  x: 96,
  y: 192,
  w: COLS * TILE, // 1248
  h: ROWS * TILE, // 672
  cx: 720,
  cy: 528,
  get right() { return this.x + this.w; }, // 1344
  get bottom() { return this.y + this.h; }, // 864
  bgX: 0,
  bgY: 96,
};

/** Tile centre in world px. */
export const tileToWorld = (c, r) => ({ x: ROOM.x + c * TILE + TILE / 2, y: ROOM.y + r * TILE + TILE / 2 });
export const worldToTile = (x, y) => ({ c: Math.floor((x - ROOM.x) / TILE), r: Math.floor((y - ROOM.y) / TILE) });

/**
 * Door geometry. `x,y` = centre of the door frame in the wall band; `rot` = sprite rotation (sprite art is drawn for the TOP wall).
 * `dx,dy` = unit vector pointing OUT of the room. `tile` = the interior door tile (c,r); `front` = tile in front of the door.
 * `entry` = where the player is placed when arriving THROUGH this door (i.e. standing in the doorway).
 * NOTE: the brief listed left/right door spots as x=144/1296 (first interior tile); the wall band is really x 0..96 and
 * 1344..1440, so the door centres are 48 / 1392.
 */
export const DOORS = {
  up: { dir: 'up', opp: 'down', x: 720, y: 160, rot: 0, dx: 0, dy: -1, tile: [6, 0], front: [6, 1], entry: { x: 720, y: 172 }, gapX: 672, gapY: 0, gapW: 96, gapH: 192 },
  down: { dir: 'down', opp: 'up', x: 720, y: 896, rot: Math.PI, dx: 0, dy: 1, tile: [6, 6], front: [6, 5], entry: { x: 720, y: 884 }, gapX: 672, gapY: 864, gapW: 96, gapH: 96 },
  left: { dir: 'left', opp: 'right', x: 64, y: 528, rot: -Math.PI / 2, dx: -1, dy: 0, tile: [0, 3], front: [1, 3], entry: { x: 68, y: 528 }, gapX: 0, gapY: 480, gapW: 96, gapH: 96 },
  right: { dir: 'right', opp: 'left', x: 1376, y: 528, rot: Math.PI / 2, dx: 1, dy: 0, tile: [12, 3], front: [11, 3], entry: { x: 1372, y: 528 }, gapX: 1344, gapY: 480, gapW: 96, gapH: 96 },
};
export const DIRS = ['up', 'right', 'down', 'left'];
export const DIR_VEC = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
export const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

// Depth layers. Actors/obstacles are y-sorted: depth = DEPTH.actors + y * 0.01 (max ~ +9.6).
export const DEPTH = {
  bg: 0,
  decals: 10,
  shadows: 20,
  floor: 30, // pits, spikes, doors, trapdoor, pedestal base
  pickups: 40,
  actors: 100, // + y*0.01
  bullets: 200,
  fx: 300,
  overlay: 400,
  ui: 500,
};
export const actorDepth = (y) => DEPTH.actors + y * 0.01;

export const COLORS = {
  ink: 0x120c0a,
  sepia: 0x6b4423,
  ochre: 0xb8843f,
  sand: 0xd9b071,
  bone: 0xe8dcc0,
  blood: 0x8a1c1c,
  hell: 0xd63a2a,
  poncho: 0xa02c24,
  rust: 0x8a4b1f,
  green: 0x8fc23f,
  purple: 0x4a3358,
  amber: 0xf0a640,
  cave: 0x1e1612,
  bg: 0x0d0806,
};
export const CSS = {
  bone: '#e8dcc0',
  ink: '#120c0a',
  blood: '#8a1c1c',
  hell: '#d63a2a',
  amber: '#f0a640',
  green: '#8fc23f',
  sand: '#d9b071',
  sepia: '#6b4423',
};
export const FONT_TITLE = 'Rye, "Rockwell Extra Bold", Georgia, serif';
export const FONT_BODY = '"Special Elite", "Courier New", Georgia, serif';

/**
 * Floor definitions. Chapter 1 = floors 1-3 (Perdition County), chapter 2 = floors 4-6 (Hell's Frontier).
 * `bgC` (floors 4-6 only) is a third room background; `accent` is the floor-card colour; `ambience` is optional (AudioDirector decides for 1-3).
 * Boss rooms use `bgBoss`. `palette` documents the art direction (CHAPTER2 s3-s5) for code-drawn hazards and placeholders.
 */
export const FLOORS = {
  1: { n: 1, name: 'DRY GULCH', subtitle: 'Where the buzzards circle', bgA: 'bg_f1_a', bgB: 'bg_f1_b', bgBoss: 'bg_f1_boss', obst: 'obst_f1', music: 'mus_floor1', hpMult: 1.5, tint: 0xb8843f, boss: 'cascabel', accent: 0xd9a04a },
  2: { n: 2, name: 'PERDITION', subtitle: 'A town that forgot to die', bgA: 'bg_f2_a', bgB: 'bg_f2_b', bgBoss: 'bg_f2_boss', obst: 'obst_f2', music: 'mus_floor2', hpMult: 1.8, tint: 0x6b5a48, boss: 'grimm', accent: 0xa07ad0 },
  3: { n: 3, name: 'SUNDOWN MINE', subtitle: 'Deeper than the Devil digs', bgA: 'bg_f3_a', bgB: 'bg_f3_b', bgBoss: 'bg_f3_boss', obst: 'obst_f3', music: 'mus_floor3', hpMult: 2.2, tint: 0x1e1612, boss: 'undertaker', accent: 0x8fc23f },
  4: {
    n: 4, name: 'BRIMSTONE BLUFFS', subtitle: "The Devil's front porch", bgA: 'bg_f4_a', bgB: 'bg_f4_b', bgC: 'bg_f4_c', bgBoss: 'bg_f4_boss', obst: 'obst_f4', haz: 'haz_f4',
    music: 'mus_floor4', ambience: 'amb_lava', hpMult: 2.6, tint: 0x7a2a1a, boss: 'toro', accent: 0xff7a1f,
    palette: { char: 0x2a0f0c, basalt: 0x3b2320, lava: 0xff7a1f, sulfur: 0xd8c43a, ember: 0xd63a2a, ash: 0x8a807a, bone: 0xe8dcc0 },
  },
  5: {
    n: 5, name: 'BLOOD RAIL', subtitle: 'The midnight run never ends', bgA: 'bg_f5_a', bgB: 'bg_f5_b', bgC: 'bg_f5_c', bgBoss: 'bg_f5_boss', obst: 'obst_f5', haz: 'haz_f5',
    music: 'mus_floor5', ambience: 'amb_rail', hpMult: 2.9, tint: 0x2b3140, boss: 'engine', accent: 0x6fe0d0,
    palette: { steel: 0x1b2230, slate: 0x2b3140, rust: 0x8a4b1f, signal: 0xd63a2a, steam: 0xd8dde0, lantern: 0xf0a640, ghost: 0x6fe0d0, coal: 0x141010 },
  },
  6: {
    n: 6, name: 'THE LAST CHANCE SALOON', subtitle: 'The house always wins', bgA: 'bg_f6_a', bgB: 'bg_f6_b', bgC: 'bg_f6_c', bgBoss: 'bg_f6_boss', obst: 'obst_f6',
    music: 'mus_floor6', ambience: 'amb_saloon', hpMult: 3.2, tint: 0x5a1020, boss: 'scratch', accent: 0xd4a537,
    palette: { velvet: 0x5a0f1a, black: 0x120c0a, gold: 0xd4a537, felt: 0x1f4a34, smoke: 0x4a3358, candle: 0xf0a640, bone: 0xe8dcc0, suit: 0xd63a2a },
  },
};
export const MAX_FLOOR = 6;
/** The trapdoor of this floor leads into the chapter interlude (banner, cards, cutscene) instead of straight to the next floor. */
export const INTERLUDE_AFTER = 3;
export const CHAPTER_OF = (n) => (n <= 3 ? 1 : 2);
/** `FLOORS[n]` clamped to the defined range (safe for stray floor numbers). */
export const floorInfo = (n) => FLOORS[Math.max(1, Math.min(MAX_FLOOR, n | 0))] || FLOORS[1];
/** Background image key for a normal room of floor `n` (`bg` = 'a' | 'b' | 'c'; 'c' exists on floors 4-6 only). */
export const floorBgKey = (n, bg) => { const f = floorInfo(n); return bg === 'c' && f.bgC ? f.bgC : bg === 'b' ? f.bgB : f.bgA; };

/**
 * Floor-gen params. Grid is 9x8. `normals` = start + normal rooms (the treasure, boss and optional shop are added on top), so the CORE room count
 * (start normal treasure shop boss) is normals + 2 + shop. `core` = the resulting [min, max] (asserted by validateFloor, ARCH D11). Extra leaves
 * (champion, event, supersecret) and the secret room come on top of the core count. F5 uses a fixed 9 normals so its core range is 11-12 as designed
 * even when the 70 % shop is missing.
 */
export const GRID = { cols: 9, rows: 8 };
export const FLOOR_GEN = {
  1: { normals: [5, 6], shopChance: 1.0, core: [8, 9] },
  2: { normals: [6, 7], shopChance: 0.7, core: [8, 10] },
  3: { normals: [7, 8], shopChance: 1.0, core: [10, 11] },
  4: { normals: [7, 8], shopChance: 1.0, core: [10, 11] },
  5: { normals: [9, 9], shopChance: 0.7, core: [11, 12] },
  6: { normals: [9, 10], shopChance: 1.0, core: [12, 13] },
};
/** Room types that count towards `FLOOR_GEN[n].core`. */
export const CORE_TYPES = ['start', 'normal', 'treasure', 'shop', 'boss'];

/** Player base stats. `player.stats` is rebuilt from this + item modifiers (recomputeStats). See ARCHITECTURE.md. */
const PLAYER_BASE_V1 = {
  // core
  damage: 3.5,
  fireDelay: 0.33, // seconds between shots
  range: 0.55, // bullet lifetime in seconds
  shotSpeed: 780, // px/s
  moveSpeed: 330, // px/s
  luck: 0,
  maxHearts: 3, // containers (1 = 2 HP units)
  bulletCount: 1,
  spreadDeg: 12, // angle between pellets when bulletCount > 1
  inaccuracy: 0, // random +/- degrees on each shot
  bulletSize: 1,
  // bullet flags
  pierce: 0, // extra enemies pierced by every bullet
  ricochet: 0, // wall bounces
  homing: 0, // 0..1 steering strength
  poison: 0, // poison dps applied on hit (0 = off)
  burn: 0, // burn chance 0..1
  fearChance: 0, // 0..1
  // revolver
  sixthEvery: 6,
  sixthMult: 2,
  sixthPierce: 1,
  // dead eye
  deadEye: 0, // multiplier for first shot after `deadEyeDelay` idle (0 = off)
  deadEyeDelay: 2,
  // roll
  rollCooldown: 1.0,
  rollDuration: 0.3,
  rollDistance: 240,
  // dynamite
  dynamiteRadius: 150,
  dynamiteDamage: 60,
  dynamiteFuse: 1.4,
  explosionImmune: 0, // 1 = explosions don't hurt you
  dynamiteVestChance: 0, // chance to drop lit dynamite when hit
  // economy / rewards
  coinMult: 1,
  shopDiscount: 0,
  roomClearCoins: 0,
  roomClearKeyChance: 0,
  // conditional
  undeadDamageMult: 1, // multiplier vs enemies tagged 'undead'
  roomShield: 0, // ignore first hit in each room (count of shields per room)
  bulletDamageMult: 1, // multiplies final bullet damage (per-pellet penalties etc.)
  contactDamageTaken: 1,
  // familiars etc are handled by items via player.familiars
};
/** Composed base stats: round-1 keys, then the round-2 item engine keys, then the rider keys (each file is pure data; every added key defaults to 'off'). */
export const PLAYER_BASE = { ...PLAYER_BASE_V1, ...ITEM_BASE_V2, ...CHAR_BASE_V2 };
export const PLAYER = {
  radius: 26,
  hurtRadius: 20, // enemy bullets use this
  invulnAfterHit: 1.0,
  roomEntryInvuln: 0.5,
  accel: 4400, // px/s^2: full speed in ~0.075 s (a hair of weight, still Isaac-snappy)
  friction: 3800, // stops in ~0.09 s (~14 px slide)
  maxHearts: 12,
  maxPickups: 99,
  startCoins: 0,
  startKeys: 0,
  startDynamite: 1,
  frame: 128,
};

export const ENEMY_DEFAULTS = {
  contactDamage: 1,
  spawnTime: 0.6,
  knockback: 200, // px/s impulse (decays e^-8t): ~25 px per normal hit, ~40 px per Sixth Bullet
  /** Legacy flat elite chance, derived from VARIETY.elite (floor 1). Per-floor chance: `eliteChance(floor)`. */
  get cursedChance() { return VARIETY.elite.chance[1]; },
};

/** Room-clear reward curve (Room.clearRoom): base drop chance, +luck*luckBonus, +tierBonus per template tier above 1; guaranteed drop after `pityRooms` dry clears. */
export const ROOM_REWARD = {
  dropChance: 0.4, luckBonus: 0.05, tierBonus: 0.04, chestChance: 0.06, pityRooms: 3, breakableDrop: 0.3, enemyCoin: 0.10, enemyNickel: 0.15,
  /** Chapter-2 (floors 4-6) overrides, CHAPTER2 s7: earlier pity, hearts x1.25 in the pickup table, more nickels, dearer shop. Read through `rewardFor(floor)`. */
  ch2: {
    pityRooms: 2, enemyNickel: 0.20, heartMult: 1.25,
    pickupWeights: { heart_half: 26, heart_full: 12, heart_tin: 10, coin: 30, coin_nickel: 12, key: 6, dynamite: 4 },
    shop: { passive: [15, 20], active: [20, 25], heart_full: 4, heart_tin: 6, key: 6, dynamite: 6 },
  },
};
/** Reward numbers for a floor: the base table with the chapter-2 overrides merged in on floors 4-6. */
export const rewardFor = (floor) => (CHAPTER_OF(floor) === 2 ? { ...ROOM_REWARD, ...ROOM_REWARD.ch2 } : ROOM_REWARD);

/** Encounter fairness: enemy waves never spawn closer than this (px) to the player / the door they entered through. */
export const SPAWN_SAFE_DIST = 300;

/** Game-feel tunables (Fx / Bullets / Player / GameScene / Room). */
export const FEEL = {
  lookahead: 9, // max camera px toward the aim (or move) direction
  lookaheadRate: 5, // camera follow rate (1/s)
  playerBulletScale: 1.35, // visual scale of player slugs (hitbox unchanged)
  streakLen: 0.045, // player bullet streak length in seconds of travel
  casings: true, // eject shells
  vignette: 0.22, // permanent dark-edge vignette alpha (0 = off)
  hitSquash: 0.16, // enemy squash amount on hit
};

/**
 * Room types (EVENTS s1.1). `grid: false` = pocket room that is not part of the floor grid. `bg` is an image key or a FLOORS field name
 * ('bgB', 'bgBoss'); `tint` is applied to that image; `cleared` = the room needs no encounter (state.cleared is true from the start).
 */
export const ROOM_TYPES = {
  start: { grid: true, tplKind: 'start', bg: 'floor', cleared: true },
  normal: { grid: true, tplKind: 'normal', bg: 'floor', cleared: false },
  treasure: { grid: true, tplKind: 'treasure', doorKind: 'treasure', bg: 'bg_treasure', cleared: true },
  shop: { grid: true, tplKind: 'shop', bg: 'bg_shop', cleared: true },
  boss: { grid: true, tplKind: 'boss', doorKind: 'boss', bg: 'bgBoss', cleared: false },
  secret: { grid: true, tplKind: 'secret', doorKind: 'secret', bg: 'floor', tint: 0xb0b0c0, minimap: 'secret', cleared: true },
  crossroads: { grid: false, tplKind: 'crossroads', doorKind: null, bg: 'bg_crossroads', music: 'mus_crossroads', minimap: null, cleared: true },
  event: { grid: true, tplKind: 'event', doorKind: 'normal', bg: 'bgB', tint: 0xd8ccc0, minimap: 'event', cleared: true },
  champion: { grid: true, tplKind: 'champion', doorKind: 'champion', bg: 'bgBoss', tint: 0xc8a890, doorTint: 0xe0a040, minimap: 'champion', music: 'mus_miniboss', cleared: false },
  supersecret: { grid: true, tplKind: 'supersecret', doorKind: 'secret', bg: 'bg_treasure', tint: 0x9a80c0, minimap: 'supersecret', cleared: true },
};
/** Door kinds a Door / Minimap knows about. */
export const DOOR_KINDS = ['normal', 'treasure', 'boss', 'secret', 'champion'];

/**
 * Run-variety tunables (EVENTS s0.1, ARCH D3/D6). Per-floor tables are objects keyed by floor number (1-6); read them through the helpers below.
 * Difficulty modes scale these from outside (data/difficulty.js); no magic numbers in code.
 */
export const VARIETY = {
  /** Post-boss devil gate (floors 1-5): chance = min(cap, base + flawless*(no boss hit) + perCurse*curses); `pityMisses` missed floors in a row = certain. */
  xroads: { baseChance: 0.30, flawlessBonus: 0.30, perCurse: 0.10, cap: 0.70, pityMisses: 2, floors: [1, 5] },
  event: {
    chance: { 1: 0.40, 2: 0.55, 3: 0.55, 4: 0.55, 5: 0.55, 6: 0.40 },
    weights: { card_sharp: 2, wishing_well: 2, gravedigger: 2, snake_oil: 2, preacher: 1.5, quick_draw: 1.5 },
    repeatMult: 0.25, // an event already shown earlier in the run
  },
  champion: { chance: 1.0, minDist: 2 },
  /** Elite affix chance per spawned wave enemy (ARCH D3 formula: min(cap, base * diff.eliteMult * curses * (1 + 1.5 * curseHunted))). */
  elite: {
    chance: { 1: 0.08, 2: 0.10, 3: 0.12, 4: 0.14, 5: 0.16, 6: 0.18 },
    maxPerRoom: { 1: 2, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3 },
    secondAffix: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0.25, 6: 0.25 },
    cap: 0.40,
  },
  mod: {
    chance: { 1: 0.10, 2: 0.14, 3: 0.18, 4: 0.22, 5: 0.24, 6: 0.24 },
    maxPerFloor: { 1: 2, 2: 2, 3: 3, 4: 3, 5: 3, 6: 3 },
    minDist: 2,
    clearBonus: 0.08, // extra room-clear drop chance in a cleared modifier room
  },
  supersecret: { chance: { 1: 0, 2: 0.15, 3: 0.15, 4: 0.20, 5: 0.20, 6: 0 } },
  secret: {
    variantWeights: { stash: 40, dead_mans_hand: 25, cache: 20, shrine: 15 },
    tellWeights: { crack: 0.30, knock: 0.40, chalk: 0.30 },
    brittleHits: 12,
  },
};
/** Per-floor lookups (floor clamped to 1..MAX_FLOOR). */
const byFloor = (tbl, floor) => tbl[Math.max(1, Math.min(MAX_FLOOR, floor | 0))];
export const eliteChance = (floor) => byFloor(VARIETY.elite.chance, floor);
export const eliteMaxPerRoom = (floor) => byFloor(VARIETY.elite.maxPerRoom, floor);
export const eventChance = (floor) => byFloor(VARIETY.event.chance, floor);
export const modChance = (floor) => byFloor(VARIETY.mod.chance, floor);
export const modMaxPerFloor = (floor) => byFloor(VARIETY.mod.maxPerFloor, floor);
export const superSecretChance = (floor) => byFloor(VARIETY.supersecret.chance, floor);

/**
 * Room modifiers (EVENTS s7). `floors` = selection weight per floor; the rest are the exact effect numbers read by src/rooms/special/modifiers/*.
 * `glyph` = minimap colour. Templates can bias selection with `modBias: { id: multiplier }`.
 */
export const MODIFIERS = {
  dust_storm: {
    id: 'dust_storm', name: 'DUST STORM', floors: { 1: 3, 2: 1, 4: 2 }, glyph: 0xd9b071,
    mask: { color: 0xc89a5a, alpha: 0.62, radius: 420, soft: 200 }, wind: 45, streaks: 40, streakSpeed: 900,
    ash: { name: 'ASH STORM', color: 0x7a3a2a }, // floor 4 reskin
  },
  darkness: {
    id: 'darkness', name: 'DARKNESS', floors: { 2: 1, 3: 3, 5: 1, 6: 2 }, glyph: 0x9a80c0,
    mask: { color: 0x0a0806, alpha: 0.92, radius: 300, soft: 120, flicker: 6 }, lanternRadius: 200,
  },
  stampede: {
    id: 'stampede', name: 'STAMPEDE', floors: { 1: 3, 2: 2, 4: 1, 6: 1 }, glyph: 0xd9d0b8,
    rows: { 1: 2, 2: 2, 3: 3, 4: 3, 5: 3, 6: 3 }, first: 3.0, gap: [6.5, 8.5], warn: 1.0, bulls: 3, speed: 820, radius: 44, tint: 0xd8e8e0, dmg: 1, enemyDmg: 25, knock: 200,
  },
  blood_moon: {
    id: 'blood_moon', name: 'BLOOD MOON', floors: { 3: 1, 4: 2, 5: 2, 6: 3 }, glyph: 0xd63a2a,
    playerDamageMult: 1.5, enemyContactBonus: 1, enemyHpMult: 0.75, guaranteedDrop: true, overlay: 0xff2020, overlayAlpha: 0.14,
  },
  fog: {
    id: 'fog', name: 'FOG', floors: { 2: 3, 3: 1, 6: 2 }, glyph: 0xb8c4c8,
    mask: { color: 0xb8c4c8, alpha: 0.55, radius: 520, soft: 260 }, extraGhostFloors: [2, 3],
  },
  rockfall: {
    id: 'rockfall', name: 'ROCKFALL', floors: { 3: 4 }, glyph: 0xa08060, templateBias: 3,
    first: 1.8, gap: [2.2, 3.5], warn: 0.9, dustLead: 1.0, radius: 70, maxActive: 2, predictLead: 0.5, predictedShare: 0.6, dmg: 1, enemyDmg: 30, explosionRocks: 2, explosionWarn: 1.0,
  },
  hellfire: {
    id: 'hellfire', name: 'HELLFIRE', floors: { 4: 3, 5: 2, 6: 2 }, glyph: 0xf0702a,
    first: 2.0, gap: 2.2, warn: 1.0, radius: 60, life: 4.0, max: 5, minPlayerDist: 140, color: 0xff7020,
  },
  lurch: {
    id: 'lurch', name: 'LURCH', floors: { 5: 4, 6: 1 }, glyph: 0x80b0ff,
    first: 4.0, gap: 5.0, warn: 0.7, push: 260, dur: 0.35,
  },
};
/** `curse_dark`: chance that a modifier-less normal room is `darkness` (rolled at room build). */
export const CURSE_DARK_CHANCE = 0.25;

export const AUDIO_DEFAULTS = { sfxVolume: 0.7, musicVolume: 0.5 };

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
