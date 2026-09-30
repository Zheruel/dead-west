// Room template parser + validator + registry. Pure JS (runs in node).
//
// Template format (see docs/ARCHITECTURE.md):
//   { id, kind, floors:[1,2,3], weight:1, layout:[7 strings of 13 chars], waves:{1:['coyote','outlaw'],2:[...]}, boss:'cascabel' }
//   kind: normal | start | treasure | shop | boss | secret | champion | event | crossroads | supersecret
// Layout chars:  . floor   R rock(block)   P pit   S spikes   B breakable   d decor
//   1..9 enemy spawn slot (digit = wave number)   E random-enemy slot (wave 1)   X no-spawn marker   D door spot
//   I item pedestal   H shop table   K shopkeeper / NPC   C chest / pickup spot
//   Round 2 (CHAPTER2 s2, EVENTS s6):  L lava (walkable only by flying, blocks the flood fill)   V sulfur vent   = | rail (horizontal / vertical)
//   T steam pipe (outer-edge tile)   r k roulette red / black   Q quicksand   s retracting spikes   Z powder barrel (solid)   G gravestone (solid)
// Optional fields: tier 1..3 (difficulty bucket, floorgen matches it to distance from the start), pickOne (treasure),
//   air: { waveDigit: [[col,row,'buzzard'], ...] }  extra FLYING spawns for that wave that may sit on any tile (e.g. over a pit).
//   lanes: [{axis:'h'|'v', index, period, offset, dir:1|-1|0, kind:'cart'|'ghost'|'herd'}]   chandelier / roulette / lavaSpit / graveAmbush: true
//   modBias: { modifierId: multiplier }   variant (secret rooms): 'stash' (default) | 'dead_mans_hand' | 'cache' | 'shrine'
//
// Floors 4-6 fall back to derived stand-ins until real templates exist for them (fallback.js): floor-3 normals with random enemy fill, the floor-3
// boss arena, and the built-in champion / event / crossroads / vault / secret-variant rooms. Real templates always take precedence.
import { COLS, ROWS, DOORS, DIRS, MODIFIERS, MAX_FLOOR } from '../config.js';
import ALL from './templates/index.js';
import { BUILTIN, deriveNormals, deriveBoss } from './fallback.js';

export const BLOCKING = new Set(['R', 'P', 'B', 'G', 'Z']);
const VALID = new Set('.RPSBdXDEIHKC123456789LV=|TrkQsZG'.split(''));
const KINDS = new Set(['normal', 'start', 'treasure', 'shop', 'boss', 'secret', 'champion', 'event', 'crossroads', 'supersecret']);
const SECRET_VARIANTS = new Set(['stash', 'dead_mans_hand', 'cache', 'shrine']);
const LANE_KINDS = new Set(['cart', 'ghost', 'herd']);
const NO_DOOR_RULES = new Set(['crossroads']); // pocket room: no doors are ever cut into it
const DOOR_TILES = DIRS.map((d) => DOORS[d].tile);
const FRONT_TILES = DIRS.map((d) => DOORS[d].front);
/** Tiles the door-to-door flood fill cannot cross: obstacles, pits, lava and the wall-side pipes. */
const FLOOD_BLOCK = new Set([...BLOCKING, 'L', 'T']);
/** Tiles that hurt or hinder a player standing on a door (or in front of it). */
const NOT_ON_DOOR = new Set(['S', 's', 'Q', 'L', 'V', 'r', 'k', 'T']);

export function parseTemplate(def) {
  const grid = def.layout.map((row) => row.split(''));
  const slots = { waves: {}, E: [], I: [], H: [], K: [], C: [], X: [] };
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r] ? grid[r].length : 0); c++) {
      const ch = grid[r][c];
      if (/[1-9]/.test(ch)) (slots.waves[ch] ||= []).push({ c, r });
      else if (slots[ch]) slots[ch].push({ c, r });
    }
  }
  const counts = {};
  for (const row of grid) for (const ch of row) counts[ch] = (counts[ch] || 0) + 1;
  return { kind: 'normal', floors: [1, 2, 3], weight: 1, waves: {}, ...def, grid, slots, counts };
}

export function validateTemplate(t) {
  const errs = [];
  const id = t.id || '?';
  if (!KINDS.has(t.kind)) errs.push(`${id}: unknown kind '${t.kind}'`);
  if (!t.layout || t.layout.length !== ROWS) errs.push(`${id}: needs ${ROWS} rows (has ${t.layout && t.layout.length})`);
  (t.layout || []).forEach((row, r) => {
    if (row.length !== COLS) errs.push(`${id}: row ${r} has ${row.length} chars, needs ${COLS}`);
    for (const ch of row) if (!VALID.has(ch)) errs.push(`${id}: bad char '${ch}' in row ${r}`);
  });
  if (errs.length) return errs;
  const g = t.grid;
  const at = ([c, r]) => g[r][c];
  const isDoor = new Set([...DOOR_TILES, ...FRONT_TILES].map((p) => p.join(',')));
  const doorRules = !NO_DOOR_RULES.has(t.kind);
  if (doorRules) {
    for (const p of DOOR_TILES) if (BLOCKING.has(at(p)) || NOT_ON_DOOR.has(at(p))) errs.push(`${id}: door tile (${p}) blocked by '${at(p)}'`);
    for (const p of FRONT_TILES) if (BLOCKING.has(at(p)) || NOT_ON_DOOR.has(at(p))) errs.push(`${id}: tile in front of door (${p}) blocked by '${at(p)}'`);
    for (const p of [...DOOR_TILES, ...FRONT_TILES]) if (/[1-9EIHKC]/.test(at(p))) errs.push(`${id}: spawn/marker '${at(p)}' on door tile (${p})`);
    // flood fill from the first door through walkable tiles: every door and every floor tile must be reachable without crossing lava
    const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const stack = [DOOR_TILES[0]];
    while (stack.length) {
      const [c, r] = stack.pop();
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS || seen[r][c] || FLOOD_BLOCK.has(g[r][c])) continue;
      seen[r][c] = true;
      stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
    for (const [c, r] of DOOR_TILES) if (!seen[r][c]) errs.push(`${id}: door (${c},${r}) not connected to the other doors`);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!FLOOD_BLOCK.has(g[r][c]) && !seen[r][c]) errs.push(`${id}: unreachable floor tile (${c},${r}) '${g[r][c]}'`);
    }
    // sulfur vents never next to a door; steam pipes hug the outer wall and never on a door
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = g[r][c];
      if (ch === 'V' && DOOR_TILES.some(([dc, dr]) => Math.abs(dc - c) <= 1 && Math.abs(dr - r) <= 1)) errs.push(`${id}: vent (${c},${r}) within 1 tile of a door`);
      if (ch === 'T' && !(r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1)) errs.push(`${id}: steam pipe (${c},${r}) is not on the outer edge`);
      if (ch === 'T' && isDoor.has(`${c},${r}`)) errs.push(`${id}: steam pipe on a door tile (${c},${r})`);
    }
  }
  for (const [dgt, list] of Object.entries(t.air || {})) {
    if (!t.slots.waves[dgt]) errs.push(`${id}: air spawns for wave ${dgt} but no '${dgt}' slot in layout`);
    for (const [c, r, eid] of list) if (c < 0 || r < 0 || c >= COLS || r >= ROWS || !eid) errs.push(`${id}: bad air spawn (${c},${r},${eid})`);
  }
  if (t.tier != null && ![1, 2, 3].includes(t.tier)) errs.push(`${id}: tier must be 1..3`);
  // hazard fields
  for (const [i, ln] of (t.lanes || []).entries()) {
    const max = ln.axis === 'h' ? ROWS : COLS;
    if (ln.axis !== 'h' && ln.axis !== 'v') errs.push(`${id}: lane ${i} axis must be 'h' or 'v'`);
    else if (!Number.isInteger(ln.index) || ln.index < 0 || ln.index >= max) errs.push(`${id}: lane ${i} index ${ln.index} out of range 0..${max - 1}`);
    if (![1, -1, 0].includes(ln.dir)) errs.push(`${id}: lane ${i} dir must be 1, -1 or 0`);
    if (!(ln.period > 0)) errs.push(`${id}: lane ${i} needs period > 0`);
    if (!LANE_KINDS.has(ln.kind || 'cart')) errs.push(`${id}: lane ${i} kind '${ln.kind}'`);
  }
  for (const f of ['chandelier', 'roulette', 'lavaSpit', 'graveAmbush']) if (t[f] != null && typeof t[f] !== 'boolean') errs.push(`${id}: ${f} must be boolean`);
  for (const [m, v] of Object.entries(t.modBias || {})) if (!MODIFIERS[m] || !(v >= 0)) errs.push(`${id}: bad modBias '${m}': ${v}`);
  if (t.variant != null && (t.kind !== 'secret' || !SECRET_VARIANTS.has(t.variant))) errs.push(`${id}: bad variant '${t.variant}'`);
  // per-kind slots
  const n = (ch) => t.counts[ch] || 0;
  if (t.kind === 'boss' && !t.boss) errs.push(`${id}: boss template needs boss id`);
  if (t.kind === 'boss' && !(t.slots.waves[1] || []).length) errs.push(`${id}: boss template needs a '1' marker`);
  if (t.kind === 'champion' && (t.slots.waves[1] || []).length !== 1) errs.push(`${id}: champion template needs exactly one '1' slot`);
  if (t.kind === 'champion' && (t.waves[1] || []).length !== 1) errs.push(`${id}: champion template needs waves[1] = [mini id]`);
  if (t.kind === 'treasure' && !t.slots.I.length) errs.push(`${id}: treasure template needs an 'I' slot`);
  if (t.kind === 'shop' && t.slots.H.length < 3) errs.push(`${id}: shop template needs 3 'H' slots`);
  if (t.kind === 'event' && (!t.slots.K.length || !t.slots.I.length)) errs.push(`${id}: event template needs a 'K' and an 'I'`);
  if (t.kind === 'crossroads' && (t.slots.K.length !== 1 || t.slots.I.length !== 3)) errs.push(`${id}: crossroads template needs one 'K' and three 'I'`);
  if (t.kind === 'supersecret' && t.slots.I.length !== 2) errs.push(`${id}: supersecret template needs two 'I'`);
  if (t.kind !== 'normal' && t.kind !== 'boss' && t.kind !== 'champion' && Object.keys(t.slots.waves).length) errs.push(`${id}: '${t.kind}' template must not have enemy digits`);
  if (Object.values(t.waves || {}).flat().includes('magma_eel') && n('L') < 3) errs.push(`${id}: magma_eel needs >= 3 lava tiles`);
  return errs;
}

// ---------------------------------------------------------------------------------------------------------------- registry
const parsed = [];
const byId = new Map();
function register(def, into = parsed, index = byId) {
  const t = parseTemplate(def);
  const errs = validateTemplate(t);
  if (errs.length) {
    // Rejected templates never reach gameplay; report loudly.
    console.error('[Templates] REJECTED', errs.join('; '));
    return null;
  }
  into.push(t);
  index.set(t.id, t);
  return t;
}
for (const def of ALL) register(def);
for (const def of BUILTIN) if (!byId.has(def.id)) register(def); // a real template with the same id replaces the built-in stand-in

/** Derived stand-ins per floor (only for floors and kinds that have no real template): floors[n] = { normal: [...], boss: [...] }. */
const derived = [];
const derivedById = new Map();
const real = (floor, kind) => parsed.filter((t) => t.kind === kind && t.floors.includes(floor));
for (let f = 4; f <= MAX_FLOOR; f++) {
  if (!real(f, 'normal').length) {
    const sources = parsed.filter((t) => t.kind === 'normal' && t.floors.includes(3) && !t.fallback);
    for (const def of deriveNormals(f, sources)) register(def, derived, derivedById);
  }
  if (!real(f, 'boss').length) {
    const src = parsed.find((t) => t.kind === 'boss' && t.floors.includes(3) && !t.fallback);
    if (src) register(deriveBoss(f, src), derived, derivedById);
  }
}

export const Templates = {
  /** Real + built-in templates (derived stand-ins are separate: see `forFloor`). */
  all: parsed,
  derived,
  get: (id) => byId.get(id) || derivedById.get(id),
  validateAll() {
    return [...ALL, ...BUILTIN.filter((d) => !ALL.some((a) => a.id === d.id))].flatMap((d) => validateTemplate(parseTemplate(d)))
      .concat(derived.flatMap((t) => validateTemplate(t)));
  },
  /** Templates of `kind` usable on `floor`: the real ones, else the derived stand-ins, else any floor's (special rooms shared by floors), else normals. */
  forFloor(floor, kind) {
    let list = real(floor, kind);
    if (!list.length) list = derived.filter((t) => t.kind === kind && t.floors.includes(floor));
    if (!list.length) list = parsed.filter((t) => t.kind === kind);
    if (!list.length) list = parsed.filter((t) => t.kind === 'normal');
    return list;
  },
  /**
   * Pick a template for floor/kind. `rng` is an RNG.
   * opts (normal rooms): `want` = desired difficulty tier 1..3 (templates far from it are down-weighted), `used` = Map id->times already
   * used on this floor (repeats are down-weighted so a floor does not show the same room over and over). `variant` filters secret rooms.
   */
  pick(floor, kind, rng, opts = {}) {
    let list = Templates.forFloor(floor, kind);
    const { want, used, variant } = opts;
    if (variant) {
      const is = (t) => (t.variant || 'stash') === variant;
      const v = list.filter(is);
      list = v.length ? v : parsed.filter((t) => t.kind === kind && is(t)); // e.g. the stash rooms are shared by every floor
    }
    const w = (t) => {
      let v = t.weight;
      if (want != null && t.tier != null) v *= Math.max(0.12, 1 - 0.55 * Math.abs(t.tier - want));
      if (used && used.get(t.id)) v *= Math.pow(0.25, used.get(t.id));
      return v;
    };
    const t = rng.weighted(list, w);
    if (used) used.set(t.id, (used.get(t.id) || 0) + 1);
    return t;
  },
};
export default Templates;
