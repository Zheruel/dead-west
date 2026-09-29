// Room template parser + validator + registry. Pure JS (runs in node).
//
// Template format (see docs/ARCHITECTURE.md):
//   { id, kind:'normal'|'start'|'treasure'|'shop'|'boss'|'secret', floors:[1,2,3], weight:1,
//     layout:[7 strings of 13 chars], waves:{1:['coyote','outlaw'],2:[...]}, boss:'cascabel' }
// Layout chars:  . floor   R rock(block)   P pit   S spikes   B breakable   d decor
//   1..9 enemy spawn slot (digit = wave number)   E random-enemy slot (wave 1)   X no-spawn marker   D door spot
//   I item pedestal   H shop table   K shopkeeper   C chest / pickup spot
// Optional fields: tier 1..3 (difficulty bucket, floorgen matches it to distance from the start), pickOne (treasure),
//   air: { waveDigit: [[col,row,'buzzard'], ...] }  extra FLYING spawns for that wave that may sit on any tile (e.g. over a pit).
import { COLS, ROWS, DOORS, DIRS } from '../config.js';
import ALL from './templates/index.js';

export const BLOCKING = new Set(['R', 'P', 'B']);
const VALID = new Set('.RPSBdXDEIHKC123456789'.split(''));
const DOOR_TILES = DIRS.map((d) => DOORS[d].tile);
const FRONT_TILES = DIRS.map((d) => DOORS[d].front);

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
  return { kind: 'normal', floors: [1, 2, 3], weight: 1, waves: {}, ...def, grid, slots };
}

export function validateTemplate(t) {
  const errs = [];
  const id = t.id || '?';
  if (!t.layout || t.layout.length !== ROWS) errs.push(`${id}: needs ${ROWS} rows (has ${t.layout && t.layout.length})`);
  t.layout.forEach((row, r) => {
    if (row.length !== COLS) errs.push(`${id}: row ${r} has ${row.length} chars, needs ${COLS}`);
    for (const ch of row) if (!VALID.has(ch)) errs.push(`${id}: bad char '${ch}' in row ${r}`);
  });
  if (errs.length) return errs;
  const g = t.grid;
  for (const [c, r] of DOOR_TILES) if (BLOCKING.has(g[r][c]) || g[r][c] === 'S') errs.push(`${id}: door tile (${c},${r}) blocked by '${g[r][c]}'`);
  for (const [c, r] of FRONT_TILES) if (BLOCKING.has(g[r][c]) || g[r][c] === 'S') errs.push(`${id}: tile in front of door (${c},${r}) blocked by '${g[r][c]}'`);
  // flood fill from the 4 door tiles through non-blocking tiles
  const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const stack = [...DOOR_TILES];
  while (stack.length) {
    const [c, r] = stack.pop();
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS || seen[r][c] || BLOCKING.has(g[r][c])) continue;
    seen[r][c] = true;
    stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
  }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!BLOCKING.has(g[r][c]) && !seen[r][c]) errs.push(`${id}: unreachable floor tile (${c},${r}) '${g[r][c]}'`);
  }
  for (const [c, r] of [...DOOR_TILES, ...FRONT_TILES]) if (/[1-9EIHKC]/.test(g[r][c])) errs.push(`${id}: spawn/marker '${g[r][c]}' on door tile (${c},${r})`);
  for (const [dgt, list] of Object.entries(t.air || {})) {
    if (!t.slots.waves[dgt]) errs.push(`${id}: air spawns for wave ${dgt} but no '${dgt}' slot in layout`);
    for (const [c, r, eid] of list) if (c < 0 || r < 0 || c >= COLS || r >= ROWS || !eid) errs.push(`${id}: bad air spawn (${c},${r},${eid})`);
  }
  if (t.tier != null && ![1, 2, 3].includes(t.tier)) errs.push(`${id}: tier must be 1..3`);
  if (t.kind === 'boss' && !t.boss) errs.push(`${id}: boss template needs boss id`);
  if (t.kind === 'boss' && !(t.slots.waves[1] || []).length) errs.push(`${id}: boss template needs a '1' marker`);
  if (t.kind === 'treasure' && !t.slots.I.length) errs.push(`${id}: treasure template needs an 'I' slot`);
  if (t.kind === 'shop' && t.slots.H.length < 3) errs.push(`${id}: shop template needs 3 'H' slots`);
  return errs;
}

const parsed = [];
const byId = new Map();
for (const def of ALL) {
  const t = parseTemplate(def);
  const errs = validateTemplate(t);
  if (errs.length) {
    // Rejected templates never reach gameplay; report loudly.
    console.error('[Templates] REJECTED', errs.join('; '));
    continue;
  }
  parsed.push(t);
  byId.set(t.id, t);
}

export const Templates = {
  all: parsed,
  get: (id) => byId.get(id),
  validateAll() { return ALL.flatMap((d) => validateTemplate(parseTemplate(d))); },
  /**
   * Pick a template for floor/kind. `rng` is an RNG. Falls back to any floor, then to the first of that kind.
   * opts (normal rooms): `want` = desired difficulty tier 1..3 (templates far from it are down-weighted), `used` = Map id->times already
   * used on this floor (repeats are down-weighted so a floor does not show the same room over and over).
   */
  pick(floor, kind, rng, opts = {}) {
    let list = parsed.filter((t) => t.kind === kind && t.floors.includes(floor));
    if (!list.length) list = parsed.filter((t) => t.kind === kind);
    if (!list.length) list = parsed.filter((t) => t.kind === 'normal');
    const { want, used } = opts;
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
