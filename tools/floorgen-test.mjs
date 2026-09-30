// node tools/floorgen-test.mjs [seeds=200]
// Validates every room template and generates N seeds x 6 floors, asserting the structural rules from GAME_DESIGN.md / EVENTS 1.3
// (connectivity, boss dead end farthest, locked treasure door, secret adjacency, symmetric doors, determinism, key room,
// core room counts per floor (D11), exactly one champion, events <= 1, supersecret only next to the secret room, tells, modifiers,
// enemy/boss ids referenced by templates exist, walkable door tiles). Exits non-zero on any failure.
import { Templates } from '../src/gen/Templates.js';
import { generateFloor, validateFloor } from '../src/gen/FloorGen.js';
import { ENEMY_META } from '../src/enemies/registry.js';
import { BOSS_META } from '../src/bosses/registry.js';
import { FLOOR_GEN, MAX_FLOOR, CORE_TYPES, VARIETY } from '../src/config.js';

const N = +(process.argv[2] || 200);
const errors = [];
const warn = [];

// --- templates
const terr = Templates.validateAll();
errors.push(...terr);
for (const t of Templates.all) {
  for (const [w, ids] of Object.entries(t.waves || {})) for (const id of ids) {
    if (t.kind === 'champion') { if (!(BOSS_META[id] && BOSS_META[id].mini)) errors.push(`${t.id}: champion slot references unknown mini boss '${id}'`); } else if (!ENEMY_META[id]) errors.push(`${t.id}: wave ${w} references unknown enemy '${id}'`);
  }
  if (t.kind === 'boss' && !BOSS_META[t.boss]) errors.push(`${t.id}: unknown boss '${t.boss}'`);
  if (t.kind === 'normal') {
    const n = Object.values(t.slots.waves).reduce((a, b) => a + b.length, 0) + t.slots.E.length;
    if (n === 0) warn.push(`${t.id}: normal template has no enemy slots (auto-clears)`);
    for (const f of t.floors) {
      const short = Object.entries(t.waves || {}).flatMap(([w, ids]) => ids.filter((id) => !(ENEMY_META[id].floors || []).includes(f) && !ENEMY_META[id].tags?.includes('any')));
      if (short.length && f) warn.push(`${t.id}: floor ${f} uses off-floor enemies ${[...new Set(short)].join(',')}`);
    }
  }
}
for (let f = 1; f <= MAX_FLOOR; f++) {
  const normals = Templates.forFloor(f, 'normal').length;
  if (normals < 6) errors.push(`floor ${f}: only ${normals} normal templates (need >= 6)`);
  for (const k of ['boss', 'treasure', 'shop', 'secret', 'start', 'champion']) if (!Templates.forFloor(f, k).length) errors.push(`floor ${f}: no '${k}' template`);
}

// --- floors
const stats = { core: {}, shops: 0, floors: 0, events: 0, supers: 0, mods: 0 };
for (let seed = 1; seed <= N; seed++) {
  for (let floor = 1; floor <= MAX_FLOOR; floor++) {
    let f;
    try { f = generateFloor(floor, seed); } catch (e) { errors.push(`seed ${seed} floor ${floor}: ${e.message}`); continue; }
    stats.floors++;
    validateFloor(f).forEach((m) => errors.push(`seed ${seed} floor ${floor}: ${m}`));
    if (JSON.stringify(f) !== JSON.stringify(generateFloor(floor, seed))) errors.push(`seed ${seed} floor ${floor}: not deterministic`);
    const byId = Object.fromEntries(f.rooms.map((r) => [r.id, r]));
    const tr = byId[f.treasureId];
    const lockedIn = f.rooms.flatMap((r) => Object.values(r.doors).filter((d) => d.to === tr.id && d.locked));
    if (lockedIn.length !== 1) errors.push(`seed ${seed} floor ${floor}: treasure room needs exactly one locked door (has ${lockedIn.length})`);
    if (FLOOR_GEN[floor].shopChance >= 1 && !f.shopId) errors.push(`seed ${seed} floor ${floor}: guaranteed shop missing`);
    if (f.shopId) stats.shops++;
    const [lo, hi] = FLOOR_GEN[floor].core;
    const core = f.rooms.filter((r) => CORE_TYPES.includes(r.type)).length;
    if (core < lo || core > hi) errors.push(`seed ${seed} floor ${floor}: ${core} core rooms not in ${lo}..${hi}`);
    (stats.core[floor] ||= []).push(core);
    if (f.rooms.filter((r) => r.type === 'champion').length !== 1) errors.push(`seed ${seed} floor ${floor}: needs exactly one champion room`);
    const nEvents = f.rooms.filter((r) => r.type === 'event').length;
    if (nEvents > 1) errors.push(`seed ${seed} floor ${floor}: ${nEvents} event rooms`);
    stats.events += nEvents;
    const supers = f.rooms.filter((r) => r.type === 'supersecret');
    for (const ss of supers) {
      const touching = Object.values(ss.doors);
      if (touching.length !== 1 || touching[0].to !== f.secretId) errors.push(`seed ${seed} floor ${floor}: supersecret not only next to the secret room`);
    }
    if (supers.length && !VARIETY.supersecret.chance[floor]) errors.push(`seed ${seed} floor ${floor}: supersecret on a floor with chance 0`);
    stats.supers += supers.length;
    stats.mods += f.rooms.filter((r) => r.mod).length;
    if (!!f.xroads !== (floor <= 5)) errors.push(`seed ${seed} floor ${floor}: crossroads pocket ${f.xroads ? 'present' : 'missing'}`);
    for (const r of f.rooms) {
      const t = Templates.get(r.template);
      const kind = r.type === 'start' ? 'start' : r.type;
      if (!t || t.kind !== kind) errors.push(`seed ${seed} floor ${floor}: room ${r.id} (${r.type}) uses template ${r.template} of kind ${t && t.kind}`);
      // the doors this room has must lead onto walkable tiles (validateTemplate guarantees all 4 door tiles are walkable)
    }
  }
}

console.log(`templates: ${Templates.all.length} valid, ${terr.length} template errors`);
console.log(`floors generated: ${stats.floors} (${N} seeds x ${MAX_FLOOR}), shops ${stats.shops}, events ${stats.events}, supersecrets ${stats.supers}, modifiers ${stats.mods}`);
for (const [f, v] of Object.entries(stats.core)) console.log(`  floor ${f}: core rooms ${Math.min(...v)}..${Math.max(...v)} (want ${FLOOR_GEN[f].core.join('..')})`);
if (warn.length) console.log('warnings:\n  ' + [...new Set(warn)].slice(0, 20).join('\n  '));
if (errors.length) { console.error(`FAILED (${errors.length}):\n  ` + errors.slice(0, 30).join('\n  ')); process.exit(1); }
console.log('floorgen-test OK');
