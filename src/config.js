// Global constants. Pure data (no Phaser import) so node scripts can use it.

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

/** Floor definitions. */
export const FLOORS = {
  1: { n: 1, name: 'DRY GULCH', subtitle: 'Where the buzzards circle', bgA: 'bg_f1_a', bgB: 'bg_f1_b', bgBoss: 'bg_f1_boss', obst: 'obst_f1', music: 'mus_floor1', hpMult: 1.5, tint: 0xb8843f, boss: 'cascabel' },
  2: { n: 2, name: 'PERDITION', subtitle: 'A town that forgot to die', bgA: 'bg_f2_a', bgB: 'bg_f2_b', bgBoss: 'bg_f2_boss', obst: 'obst_f2', music: 'mus_floor2', hpMult: 1.8, tint: 0x6b5a48, boss: 'grimm' },
  3: { n: 3, name: 'SUNDOWN MINE', subtitle: 'Deeper than the Devil digs', bgA: 'bg_f3_a', bgB: 'bg_f3_b', bgBoss: 'bg_f3_boss', obst: 'obst_f3', music: 'mus_floor3', hpMult: 2.2, tint: 0x1e1612, boss: 'undertaker' },
};
export const MAX_FLOOR = 3;

/** Floor-gen params. Grid is 9x8. Counts = start+normals (specials are added on top: boss, treasure, shop). */
export const GRID = { cols: 9, rows: 8 };
export const FLOOR_GEN = {
  1: { normals: [5, 6], shopChance: 1.0 },
  2: { normals: [6, 7], shopChance: 0.7 },
  3: { normals: [7, 8], shopChance: 1.0 },
};

/** Player base stats. `player.stats` is rebuilt from this + item modifiers (recomputeStats). See ARCHITECTURE.md. */
export const PLAYER_BASE = {
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
  cursedChance: 0.08,
};

/** Room-clear reward curve (Room.clearRoom): base drop chance, +luck*luckBonus, +tierBonus per template tier above 1; guaranteed drop after `pityRooms` dry clears. */
export const ROOM_REWARD = { dropChance: 0.4, luckBonus: 0.05, tierBonus: 0.04, chestChance: 0.06, pityRooms: 3, breakableDrop: 0.3, enemyCoin: 0.10, enemyNickel: 0.15 };

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

export const AUDIO_DEFAULTS = { sfxVolume: 0.7, musicVolume: 0.5 };

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
