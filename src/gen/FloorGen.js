// Isaac-style floor generator on a 9x8 grid. Pure JS, deterministic from (seed, floor). Returns plain data.
//
// Floor = { floor, seed, cols, rows, rooms:[Room], startId, bossId, treasureId, shopId, secretId, championId, eventId|null, superSecretId|null,
//           keyRoomId, xroads: null | { def, opened }, byPos:{ 'x,y': id } }
// Room  = { id, gx, gy, type:'start'|'normal'|'treasure'|'shop'|'boss'|'secret'|'champion'|'event'|'supersecret', dist, template, bg:'a'|'b'|'c', seed,
//           doors: { up|right|down|left: { to:id, kind:'normal'|'treasure'|'boss'|'secret'|'champion', locked?, tell?, brittle?, super? } },
//           mod?: modifier id (normal rooms), event?: event id, variant?: secret variant, mini?: mini boss id }
// keyRoomId = normal room that always drops a key when cleared (treasure door is key-locked).
// Core rooms (start normal treasure shop boss) are counted against FLOOR_GEN[floor].core; champion / event / secret / supersecret are extras (Variety.js
// decides events, tells, secret variants and modifiers with streams that never touch the base RNG). The Crossroads pocket lives in `xroads`, not in `rooms`.
import { GRID, FLOOR_GEN, DIRS, DIR_VEC, OPPOSITE, CORE_TYPES, VARIETY, MODIFIERS, modMaxPerFloor, MAX_FLOOR } from '../config.js';
import { floorRng, hashStr, getSeed } from '../core/rng.js';
import Templates from './Templates.js';
import { eventFor, miniFor, secretVariant, secretTell, rollSuperSecret, assignModifiers, subSeed } from './Variety.js';

const HIDDEN = new Set(['secret', 'supersecret']);
const isHidden = (type) => HIDDEN.has(type);
const TELLS = new Set(Object.keys(VARIETY.secret.tellWeights));
const EXTRA_LEAF = new Set(['treasure', 'shop', 'champion', 'event']);

const key = (x, y) => `${x},${y}`;

function tryGenerate(rng, floor, seed, eventId) {
  const { cols, rows } = GRID;
  const cfg = FLOOR_GEN[floor] || FLOOR_GEN[1];
  const cells = new Map(); // key -> room
  const rooms = [];
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const neighbours = (x, y) => DIRS.map((d) => [x + DIR_VEC[d][0], y + DIR_VEC[d][1], d]).filter(([nx, ny]) => inBounds(nx, ny));
  const occNeighbours = (x, y, pred = () => true) => neighbours(x, y).map(([nx, ny, d]) => ({ room: cells.get(key(nx, ny)), d })).filter((o) => o.room && !isHidden(o.room.type) && pred(o.room));
  const add = (x, y, type, dist) => {
    const r = { id: `r${rooms.length}`, gx: x, gy: y, type, dist, doors: {}, template: null, bg: 'a', seed: 0 };
    rooms.push(r); cells.set(key(x, y), r); return r;
  };

  const start = add(4, 3, 'start', 0);
  const target = rng.int(cfg.normals[0], cfg.normals[1]);
  let guard = 0;
  while (rooms.length < target && guard++ < 600) {
    const base = rng.pick(rooms);
    const [nx, ny] = (() => { const d = rng.pick(DIRS); return [base.gx + DIR_VEC[d][0], base.gy + DIR_VEC[d][1]]; })();
    if (!inBounds(nx, ny) || cells.has(key(nx, ny))) continue;
    if (occNeighbours(nx, ny).length !== 1) continue; // tree: no loops
    if (rng.chance(0.25)) continue;
    add(nx, ny, 'normal', base.dist + 1);
  }
  if (rooms.length < target) return null;

  // Leaf candidates for special rooms: empty cell with exactly one (non-special, non-start optional) neighbour.
  const leafCandidates = (allowStart) => {
    const out = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (cells.has(key(x, y))) continue;
      const occ = occNeighbours(x, y);
      if (occ.length !== 1) continue;
      const p = occ[0].room;
      if (p.type !== 'normal' && !(allowStart && p.type === 'start')) continue;
      out.push({ x, y, parent: p, dist: p.dist + 1 });
    }
    return out;
  };

  // Boss: farthest leaf.
  const bc = leafCandidates(false);
  if (!bc.length) return null;
  const maxD = Math.max(...bc.map((c) => c.dist));
  const bpick = rng.pick(bc.filter((c) => c.dist === maxD));
  const boss = add(bpick.x, bpick.y, 'boss', bpick.dist);

  const place = (type, r = rng, { allowStart = true, minDist = 0 } = {}) => {
    const cand = leafCandidates(allowStart).filter((c) => c.dist <= boss.dist && c.dist >= minDist);
    if (!cand.length) return null;
    const c = r.pick(cand);
    return add(c.x, c.y, type, c.dist);
  };
  const treasure = place('treasure');
  if (!treasure) return null;
  let shop = null;
  if (rng.chance(cfg.shopChance)) { shop = place('shop'); if (!shop) return null; }

  // Variety (EVENTS 1.3): a forked stream, so the base stream continues exactly as it would without these rooms.
  const vr = rng.fork('variety');
  const champion = place('champion', vr, { allowStart: false, minDist: VARIETY.champion.minDist });
  if (!champion) return null;
  champion.mini = miniFor(floor);
  let event = null;
  if (eventId) { event = place('event', vr, { allowStart: false }); if (event) event.event = eventId; } // no free leaf: the floor simply has no event

  // Secret: empty cell with >= 2 neighbouring rooms, not next to the boss.
  let best = [], bestN = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (cells.has(key(x, y))) continue;
    const occ = occNeighbours(x, y);
    if (occ.length < 2 || occ.some((o) => o.room.type === 'boss')) continue;
    if (occ.length > bestN) { bestN = occ.length; best = []; }
    if (occ.length === bestN) best.push({ x, y, occ });
  }
  if (!best.length) return null;
  const sp = rng.pick(best);
  const secret = add(sp.x, sp.y, 'secret', Math.min(...sp.occ.map((o) => o.room.dist)) + 1);
  secret.variant = secretVariant(seed, floor);

  // Super-secret: an empty cell whose ONLY occupied neighbour is the secret room.
  let superSecret = null;
  if (rollSuperSecret(vr, floor)) {
    const spots = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (cells.has(key(x, y))) continue;
      const occ = neighbours(x, y).map(([nx, ny]) => cells.get(key(nx, ny))).filter(Boolean);
      if (occ.length === 1 && occ[0] === secret) spots.push({ x, y });
    }
    if (spots.length) { const c = vr.pick(spots); superSecret = add(c.x, c.y, 'supersecret', secret.dist + 1); }
  }

  // Doors between all adjacent rooms; secret doors carry a tell (crack = brittle, knock, chalk); the super-secret door is chalk and never brittle.
  for (const r of rooms) {
    for (const [nx, ny, d] of neighbours(r.gx, r.gy)) {
      const o = cells.get(key(nx, ny));
      if (!o) continue;
      if (isHidden(r.type) || isHidden(o.type)) {
        const sup = r.type === 'supersecret' || o.type === 'supersecret';
        const { tell, brittle } = secretTell(seed, floor, [r.id, o.id].sort().join('-'), sup);
        r.doors[d] = { to: o.id, kind: 'secret', tell, ...(brittle ? { brittle: true } : {}), ...(sup ? { super: true } : {}) };
        continue;
      }
      let kind = 'normal';
      let locked = false;
      if (o.type === 'boss' || r.type === 'boss') kind = 'boss';
      else if (o.type === 'champion' || r.type === 'champion') kind = 'champion';
      if (o.type === 'treasure') { kind = 'treasure'; locked = true; } // locked from the outside only
      else if (r.type === 'treasure') kind = 'treasure';
      r.doors[d] = locked ? { to: o.id, kind, locked } : { to: o.id, kind };
    }
  }
  // Templates / seeds (variety rooms draw from the forked stream so the legacy rooms keep their rolls)
  const used = new Map();
  for (const r of rooms) {
    const varied = r.type === 'champion' || r.type === 'event' || r.type === 'supersecret' || r.type === 'secret';
    const R = varied ? vr : rng;
    r.seed = hashStr(`room:${floor}:${r.id}:${R.int(0, 1e9)}`);
    // difficulty ramps with distance from the start: near rooms pick tier-1 templates, rooms next to the boss tier-3
    const want = Math.min(3, Math.max(1, 1 + (2 * (r.dist - 1)) / Math.max(1, boss.dist - 2)));
    if (r.type === 'event') r.template = (Templates.get(`event_${r.event}`) || Templates.pick(floor, 'event', vr)).id;
    else r.template = Templates.pick(floor, r.type, R, r.type === 'normal' ? { want, used } : r.type === 'secret' ? { variant: r.variant } : {}).id;
    r.bg = floor >= 4 ? R.pick(['a', 'b', 'c']) : R.chance(0.5) ? 'a' : 'b';
  }
  // Modifiers (EVENTS 1.3 step 4)
  assignModifiers(rooms, floor, vr, (room) => Templates.get(room.template));
  // Guaranteed key: the treasure door is locked and keys are otherwise rare drops, so one normal room always drops one when cleared.
  const keyCands = rooms.filter((r) => r.type === 'normal' && r.dist <= boss.dist && r.mod !== 'darkness');
  const keyRoom = keyCands.length ? rng.pick(keyCands) : null;
  const xr = VARIETY.xroads.floors;
  const xroads = floor >= xr[0] && floor <= xr[1]
    ? { def: { id: 'xroads', type: 'crossroads', floor, template: 'crossroads_a', seed: subSeed(seed, 'xroads', floor), doors: {}, pocket: true, returnId: boss.id, gx: -1, gy: -1, dist: 0, bg: 'a' }, opened: true }
    : null;
  return {
    floor, cols, rows, rooms, keyRoomId: keyRoom ? keyRoom.id : null, startId: start.id, bossId: boss.id, treasureId: treasure.id, shopId: shop ? shop.id : null,
    secretId: secret.id, championId: champion.id, eventId: event ? event.id : null, superSecretId: superSecret ? superSecret.id : null, xroads,
    byPos: Object.fromEntries(rooms.map((r) => [key(r.gx, r.gy), r.id])),
  };
}

export function generateFloor(floor, seed = getSeed()) {
  const rng = floorRng(floor, seed);
  const eventId = eventFor(seed, floor);
  for (let attempt = 0; attempt < 500; attempt++) {
    const f = tryGenerate(rng, floor, seed, eventId);
    if (f) { f.seed = seed; return f; }
  }
  throw new Error(`FloorGen: failed to generate floor ${floor} for seed ${seed}`);
}

/** Validate a floor; returns array of error strings. */
export function validateFloor(f) {
  const errs = [];
  const byId = Object.fromEntries(f.rooms.map((r) => [r.id, r]));
  const visible = f.rooms.filter((r) => !isHidden(r.type));
  const core = f.rooms.filter((r) => CORE_TYPES.includes(r.type));
  const [lo, hi] = (FLOOR_GEN[f.floor] || FLOOR_GEN[1]).core;
  if (core.length < lo || core.length > hi) errs.push(`core room count ${core.length} not in ${lo}..${hi}`);
  // connectivity (non-secret doors), BFS distances
  const dist = { [f.startId]: 0 };
  const q = [f.startId];
  while (q.length) {
    const id = q.shift();
    for (const dd of Object.values(byId[id].doors)) {
      if (dd.kind === 'secret' || dist[dd.to] != null) continue;
      dist[dd.to] = dist[id] + 1; q.push(dd.to);
    }
  }
  for (const r of visible) if (dist[r.id] == null) errs.push(`room ${r.id} (${r.type}) unreachable`);
  const count = (t) => f.rooms.filter((r) => r.type === t).length;
  for (const t of ['boss', 'treasure', 'secret', 'champion']) if (count(t) !== 1) errs.push(`need exactly one ${t} (has ${count(t)})`);
  if (count('shop') > 1) errs.push('more than one shop');
  if (count('event') > 1) errs.push('more than one event');
  if (count('supersecret') > 1) errs.push('more than one supersecret');
  const deg = (r) => Object.values(r.doors).filter((d) => d.kind !== 'secret').length;
  const boss = byId[f.bossId];
  if (deg(boss) !== 1) errs.push('boss is not a dead end');
  for (const r of visible) if (r.id !== f.startId && deg(r) === 1 && dist[r.id] > dist[boss.id]) errs.push(`dead end ${r.id} (${r.type}) farther than boss`);
  for (const r of visible) if (EXTRA_LEAF.has(r.type) && dist[r.id] > dist[boss.id]) errs.push(`${r.type} ${r.id} farther than boss`);
  const sec = byId[f.secretId];
  if (Object.keys(sec.doors).length < 2) errs.push('secret adjacent to < 2 rooms');
  if (Object.values(sec.doors).some((d) => byId[d.to].type === 'boss')) errs.push('secret adjacent to boss');
  // champion / event: dead-end leaves off a normal room
  for (const t of ['champion', 'event']) {
    const r = f.rooms.find((x) => x.type === t);
    if (!r) continue;
    const ds = Object.values(r.doors).filter((d) => d.kind !== 'secret');
    if (ds.length !== 1 || byId[ds[0].to].type !== 'normal') errs.push(`${t} ${r.id} must be a dead end whose parent is a normal room`);
    if (t === 'champion' && (dist[r.id] < VARIETY.champion.minDist || ds[0].kind !== 'champion' || ds[0].locked)) errs.push(`champion ${r.id}: door kind/locked/distance wrong`);
    if (t === 'event' && (ds[0].kind !== 'normal' || ds[0].locked)) errs.push(`event ${r.id}: door must be a normal, unlocked door`);
  }
  const champion = f.rooms.find((r) => r.type === 'champion');
  if (champion && (champion.mini !== miniFor(f.floor) || f.championId !== champion.id)) errs.push('champion room mini / championId mismatch');
  const event = f.rooms.find((r) => r.type === 'event');
  if (event && (!VARIETY.event.weights[event.event] || f.eventId !== event.id)) errs.push('event room event id / eventId mismatch');
  if (!event && f.eventId) errs.push('eventId without an event room');
  // supersecret: exactly one door, of kind secret+super, to the secret room; no other room touches it
  const ss = f.rooms.find((r) => r.type === 'supersecret');
  if (ss) {
    const ds = Object.values(ss.doors);
    if (ds.length !== 1 || ds[0].to !== f.secretId || ds[0].kind !== 'secret' || !ds[0].super || ds[0].brittle || ds[0].tell !== 'chalk') errs.push('supersecret must have exactly one super chalk door to the secret room');
    if (f.superSecretId !== ss.id) errs.push('superSecretId mismatch');
  } else if (f.superSecretId) errs.push('superSecretId without a room');
  // every secret door: one known tell, brittle only for cracks, symmetric tells
  for (const r of f.rooms) for (const [d, dd] of Object.entries(r.doors)) {
    if (dd.kind !== 'secret') continue;
    if (!TELLS.has(dd.tell)) errs.push(`secret door ${r.id}.${d} has tell '${dd.tell}'`);
    if (!!dd.brittle !== (dd.tell === 'crack')) errs.push(`secret door ${r.id}.${d}: brittle flag does not match tell`);
    const back = byId[dd.to].doors[OPPOSITE[d]];
    if (back && (back.tell !== dd.tell || !!back.super !== !!dd.super)) errs.push(`secret door ${r.id}.${d}: tell differs on the far side`);
  }
  // modifiers: normal rooms only, within the floor cap, never on the guaranteed-key room when dark
  const modded = f.rooms.filter((r) => r.mod);
  if (modded.length > modMaxPerFloor(f.floor)) errs.push(`${modded.length} modifiers (max ${modMaxPerFloor(f.floor)})`);
  for (const r of modded) {
    if (r.type !== 'normal') errs.push(`modifier on ${r.type} room ${r.id}`);
    if (!MODIFIERS[r.mod] || !(MODIFIERS[r.mod].floors[f.floor] > 0)) errs.push(`modifier '${r.mod}' not allowed on floor ${f.floor}`);
  }
  // symmetric doors
  for (const r of f.rooms) for (const [d, dd] of Object.entries(r.doors)) {
    const back = byId[dd.to].doors[OPPOSITE[d]];
    if (!back || back.to !== r.id) errs.push(`door ${r.id}.${d} not symmetric`);
  }
  if (!f.keyRoomId || byId[f.keyRoomId].type !== 'normal') errs.push('no guaranteed-key room');
  else if (byId[f.keyRoomId].mod === 'darkness') errs.push('key room has the darkness modifier');
  for (const r of f.rooms) {
    const t = Templates.get(r.template);
    if (!t) errs.push(`room ${r.id} has unknown template ${r.template}`);
    else if (t.kind !== r.type) errs.push(`room ${r.id} (${r.type}) uses ${r.template} of kind ${t.kind}`);
    else if (r.type === 'secret' && (t.variant || 'stash') !== r.variant) errs.push(`secret room variant ${r.variant} uses template ${r.template}`);
    else if (r.type === 'boss' && f.floor <= MAX_FLOOR && t.boss !== undefined && !t.boss) errs.push(`boss room without a boss`);
  }
  const xr = VARIETY.xroads.floors;
  const wantX = f.floor >= xr[0] && f.floor <= xr[1];
  if (wantX !== !!f.xroads) errs.push(`xroads pocket ${f.xroads ? 'present' : 'missing'} on floor ${f.floor}`);
  if (f.xroads && (f.xroads.def.returnId !== f.bossId || !Templates.get(f.xroads.def.template))) errs.push('xroads pocket def is wrong');
  return errs;
}

export function runSelfTest(n = 100) {
  const errors = [];
  let count = 0;
  for (let seed = 1; seed <= n; seed++) {
    for (let floor = 1; floor <= MAX_FLOOR; floor++) {
      try {
        const f = generateFloor(floor, seed);
        // determinism
        const g = generateFloor(floor, seed);
        if (JSON.stringify(f) !== JSON.stringify(g)) errors.push(`seed ${seed} floor ${floor}: not deterministic`);
        const e = validateFloor(f);
        e.forEach((m) => errors.push(`seed ${seed} floor ${floor}: ${m}`));
        count++;
      } catch (err) { errors.push(`seed ${seed} floor ${floor}: ${err.message}`); }
    }
  }
  return { ok: errors.length === 0, errors, count };
}
