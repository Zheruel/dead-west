// Content checks for room templates (pure node, no Phaser): counts per floor/kind, enemy ids valid for the floor, wave sizes, spawn fairness
// (>=300 px from every door entry after Room.safeSpawns relocation is possible), boss arena centre kept clear, special-room slots.
// Used by selftest.mjs; returns { errors:[], warns:[], report:[] }.
import { Templates, BLOCKING } from './Templates.js';
import { ENEMY_META } from '../enemies/registry.js';
import { BOSS_META } from '../bosses/registry.js';
import { DOORS, DIRS, COLS, ROWS, tileToWorld } from '../config.js';

export const SAFE_DIST = 300; // px: nothing spawns this close to the player's entry door
const MIN = { normal: 14, treasure: 3, shop: 2, secret: 2, boss: 1 };
const TILE_SAFE_EXTRA = 3; // spare safe tiles beyond the biggest wave so relocation always has room

export function checkTemplates() {
  const errors = [], warns = [], report = [];
  errors.push(...Templates.validateAll());
  const doorTiles = new Set(DIRS.flatMap((d) => [DOORS[d].tile.join(','), DOORS[d].front.join(',')]));
  for (const f of [1, 2, 3]) {
    for (const [kind, n] of Object.entries(MIN)) {
      const c = Templates.all.filter((t) => t.kind === kind && t.floors.includes(f)).length;
      if (c < n) errors.push(`floor ${f}: ${c} '${kind}' templates (need >= ${n})`);
    }
    const tiers = [1, 2, 3].map((k) => Templates.all.filter((t) => t.kind === 'normal' && t.floors.includes(f) && t.tier === k).length);
    if (tiers.some((n) => n < 3)) errors.push(`floor ${f}: tier buckets ${tiers.join('/')} (need >= 3 each)`);
    const totals = Templates.all.filter((t) => t.kind === 'normal' && t.floors.includes(f)).map((t) => enemyTotal(t));
    report.push(`floor ${f}: ${totals.length} normals, tiers ${tiers.join('/')}, enemies/room min ${Math.min(...totals)} avg ${(totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1)} max ${Math.max(...totals)}`);
  }
  for (const t of Templates.all) {
    const id = t.id;
    if (t.kind === 'normal') {
      if (t.floors.length !== 1) warns.push(`${id}: normal template shared by several floors (enemy ids are floor-specific)`);
      const digits = Object.keys(t.slots.waves).sort();
      if (digits.length < 1 || digits.length > 3) errors.push(`${id}: ${digits.length} waves (need 1..3)`);
      digits.forEach((d, i) => { if (+d !== i + 1) errors.push(`${id}: wave digits must be 1,2,3 without gaps (got ${digits.join('')})`); });
      for (const d of digits) {
        const slots = t.slots.waves[d].length;
        const list = t.waves[d] || [];
        const air = (t.air && t.air[d]) || [];
        const extra = d === '1' ? t.slots.E.length : 0;
        const n = slots + air.length + extra;
        if (n < 2 || n > 5) errors.push(`${id}: wave ${d} has ${n} enemies (need 2..5)`);
        if (list.length > slots) errors.push(`${id}: wave ${d} lists ${list.length} enemies for ${slots} slots`);
        if (list.length < slots) errors.push(`${id}: wave ${d} lists ${list.length} enemies for ${slots} slots (random fill not allowed)`);
        for (const eid of list) checkEnemy(id, eid, t.floors, errors);
        for (const [c, r, eid] of air) {
          checkEnemy(id, eid, t.floors, errors);
          if (!(ENEMY_META[eid] || {}).flying) errors.push(`${id}: air spawn '${eid}' is not a flyer`);
          if (c < 0 || r < 0 || c >= COLS || r >= ROWS) errors.push(`${id}: air spawn out of bounds`);
        }
      }
      if (enemyTotal(t) > 10) errors.push(`${id}: ${enemyTotal(t)} enemies in total (max 10)`);
      // spawn fairness: for every entry door there must be enough safe free tiles to relocate a whole wave
      const biggest = Math.max(0, ...digits.map((d) => t.slots.waves[d].length + ((t.air && t.air[d]) || []).length + (d === '1' ? t.slots.E.length : 0)));
      for (const dir of DIRS) {
        const e = DOORS[dir].entry;
        const safe = safeTiles(t, e);
        if (safe.length < biggest + TILE_SAFE_EXTRA) errors.push(`${id}: only ${safe.length} safe spawn tiles when entering via ${dir} (wave needs ${biggest})`);
      }
    } else if (t.kind === 'boss') {
      if (!BOSS_META[t.boss]) errors.push(`${id}: unknown boss '${t.boss}'`);
      // centre lane (cols 5..7, rows 2..4) must be free of obstacles so the boss and the dodge roll have room
      for (let r = 2; r <= 4; r++) for (let c = 5; c <= 7; c++) if (BLOCKING.has(t.grid[r][c]) || t.grid[r][c] === 'S') errors.push(`${id}: obstacle in the arena centre (${c},${r})`);
      if (t.slots.waves['1'].length !== 1) errors.push(`${id}: needs exactly one boss slot`);
    } else if (t.kind === 'treasure') {
      if (!t.pickOne && t.slots.I.length !== 1) errors.push(`${id}: single treasure needs exactly one I`);
      if (t.pickOne && t.slots.I.length !== 2) errors.push(`${id}: pickOne treasure needs two I`);
    } else if (t.kind === 'shop') {
      if (t.slots.H.length !== 3) errors.push(`${id}: shop needs exactly 3 H slots`);
      if (t.slots.K.length !== 1) errors.push(`${id}: shop needs one K`);
    } else if (t.kind === 'secret') {
      if (t.slots.C.length < 2) errors.push(`${id}: secret needs >= 2 C slots`);
      if (t.slots.I.length !== 1) errors.push(`${id}: secret needs one I slot`);
    }
    // markers must not sit next to doors
    for (const key of doorTiles) { const [c, r] = key.split(',').map(Number); if (/[1-9EIHKC]/.test(t.grid[r][c])) errors.push(`${id}: marker on door tile ${key}`); }
  }
  return { errors, warns, report };
}

function checkEnemy(id, eid, floors, errors) {
  const m = ENEMY_META[eid];
  if (!m) { errors.push(`${id}: unknown enemy '${eid}'`); return; }
  if (!floors.some((f) => m.floors.includes(f))) errors.push(`${id}: '${eid}' does not belong on floor ${floors.join(',')}`);
}

export function enemyTotal(t) {
  return Object.entries(t.slots.waves).reduce((a, [d, s]) => a + s.length + ((t.air && t.air[d]) || []).length, 0) + t.slots.E.length;
}

/** Walkable, non-hazard tiles >= SAFE_DIST from point `e` and not on/in front of a door (mirror of Room.safeSpawns candidates). */
export function safeTiles(t, e) {
  const door = new Set(DIRS.flatMap((d) => [DOORS[d].tile.join(','), DOORS[d].front.join(',')]));
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = t.grid[r][c];
    if (BLOCKING.has(ch) || ch === 'S' || door.has(`${c},${r}`)) continue;
    const p = tileToWorld(c, r);
    if (Math.hypot(p.x - e.x, p.y - e.y) >= SAFE_DIST) out.push({ c, r });
  }
  return out;
}

/** Share of wave-1 slots that are already >= SAFE_DIST from all four door entries (informational). */
export function naturalSafety(t) {
  const slots = t.slots.waves['1'] || [];
  if (!slots.length) return 1;
  let ok = 0;
  for (const s of slots) { const p = tileToWorld(s.c, s.r); if (DIRS.every((d) => Math.hypot(p.x - DOORS[d].entry.x, p.y - DOORS[d].entry.y) >= SAFE_DIST)) ok++; }
  return ok / slots.length;
}
