// Isaac-style floor generator on a 9x8 grid. Pure JS, deterministic from (seed, floor). Returns plain data.
//
// Floor = { floor, seed, cols, rows, rooms:[Room], startId, bossId, treasureId, shopId, secretId, byPos:{ 'x,y': id } }
// Room  = { id, gx, gy, type:'start'|'normal'|'treasure'|'shop'|'boss'|'secret', dist, template, bg:'a'|'b', seed,
//           doors: { up|right|down|left: { to:id, kind:'normal'|'treasure'|'boss'|'secret', locked?:bool } } }
// keyRoomId = normal room that always drops a key when cleared (treasure door is key-locked).
import { GRID, FLOOR_GEN, DIRS, DIR_VEC, OPPOSITE } from '../config.js';
import { floorRng, hashStr, getSeed } from '../core/rng.js';
import Templates from './Templates.js';

const key = (x, y) => `${x},${y}`;

function tryGenerate(rng, floor) {
  const { cols, rows } = GRID;
  const cfg = FLOOR_GEN[floor] || FLOOR_GEN[1];
  const cells = new Map(); // key -> room
  const rooms = [];
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const neighbours = (x, y) => DIRS.map((d) => [x + DIR_VEC[d][0], y + DIR_VEC[d][1], d]).filter(([nx, ny]) => inBounds(nx, ny));
  const occNeighbours = (x, y, pred = () => true) => neighbours(x, y).map(([nx, ny, d]) => ({ room: cells.get(key(nx, ny)), d })).filter((o) => o.room && o.room.type !== 'secret' && pred(o.room));
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

  const place = (type, ctx) => {
    const cand = leafCandidates(true).filter((c) => c.dist <= boss.dist);
    if (!cand.length) return null;
    const c = rng.pick(cand);
    return add(c.x, c.y, type, c.dist);
  };
  const treasure = place('treasure');
  if (!treasure) return null;
  let shop = null;
  if (rng.chance(cfg.shopChance)) { shop = place('shop'); if (!shop) return null; }

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

  // Doors between all adjacent non-secret rooms; secret doors to its neighbours.
  for (const r of rooms) {
    for (const [nx, ny, d] of neighbours(r.gx, r.gy)) {
      const o = cells.get(key(nx, ny));
      if (!o) continue;
      if (r.type === 'secret' || o.type === 'secret') { r.doors[d] = { to: o.id, kind: 'secret' }; continue; }
      let kind = 'normal';
      let locked = false;
      if (o.type === 'boss' || r.type === 'boss') kind = 'boss';
      if (o.type === 'treasure') { kind = 'treasure'; locked = true; } // locked from the outside only
      else if (r.type === 'treasure') kind = 'treasure';
      r.doors[d] = locked ? { to: o.id, kind, locked } : { to: o.id, kind };
    }
  }
  // Templates / seeds
  const used = new Map();
  for (const r of rooms) {
    r.seed = hashStr(`room:${floor}:${r.id}:${rng.int(0, 1e9)}`);
    // difficulty ramps with distance from the start: near rooms pick tier-1 templates, rooms next to the boss tier-3
    const want = Math.min(3, Math.max(1, 1 + (2 * (r.dist - 1)) / Math.max(1, boss.dist - 2)));
    r.template = Templates.pick(floor, r.type === 'secret' ? 'secret' : r.type, rng, r.type === 'normal' ? { want, used } : {}).id;
    r.bg = rng.chance(0.5) ? 'a' : 'b';
  }
  // Guaranteed key: the treasure door is locked and keys are otherwise rare drops, so one normal room always drops one when cleared.
  const keyCands = rooms.filter((r) => r.type === 'normal' && r.dist <= boss.dist);
  const keyRoom = keyCands.length ? rng.pick(keyCands) : null;
  return { floor, cols, rows, rooms, keyRoomId: keyRoom ? keyRoom.id : null, startId: start.id, bossId: boss.id, treasureId: treasure.id, shopId: shop ? shop.id : null, secretId: secret.id, byPos: Object.fromEntries(rooms.map((r) => [key(r.gx, r.gy), r.id])) };
}

export function generateFloor(floor, seed = getSeed()) {
  const rng = floorRng(floor, seed);
  for (let attempt = 0; attempt < 500; attempt++) {
    const f = tryGenerate(rng, floor);
    if (f) { f.seed = seed; return f; }
  }
  throw new Error(`FloorGen: failed to generate floor ${floor} for seed ${seed}`);
}

/** Validate a floor; returns array of error strings. */
export function validateFloor(f) {
  const errs = [];
  const byId = Object.fromEntries(f.rooms.map((r) => [r.id, r]));
  const nonSecret = f.rooms.filter((r) => r.type !== 'secret');
  if (nonSecret.length < 8 || nonSecret.length > 11) errs.push(`room count ${nonSecret.length} not in 8..11`);
  // connectivity (non-secret doors), BFS distances
  const dist = { [f.startId]: 0 };
  const q = [f.startId];
  while (q.length) {
    const id = q.shift();
    for (const [d, dd] of Object.entries(byId[id].doors)) {
      if (dd.kind === 'secret' || dist[dd.to] != null) continue;
      dist[dd.to] = dist[id] + 1; q.push(dd.to);
    }
  }
  for (const r of nonSecret) if (dist[r.id] == null) errs.push(`room ${r.id} (${r.type}) unreachable`);
  for (const t of ['boss', 'treasure']) if (f.rooms.filter((r) => r.type === t).length !== 1) errs.push(`need exactly one ${t}`);
  if (f.rooms.filter((r) => r.type === 'shop').length > 1) errs.push('more than one shop');
  if (f.rooms.filter((r) => r.type === 'secret').length !== 1) errs.push('need exactly one secret');
  const deg = (r) => Object.values(r.doors).filter((d) => d.kind !== 'secret').length;
  const boss = byId[f.bossId];
  if (deg(boss) !== 1) errs.push('boss is not a dead end');
  for (const r of nonSecret) if (r.id !== f.startId && deg(r) === 1 && dist[r.id] > dist[boss.id]) errs.push(`dead end ${r.id} (${r.type}) farther than boss`);
  const sec = byId[f.secretId];
  if (Object.keys(sec.doors).length < 2) errs.push('secret adjacent to < 2 rooms');
  if (Object.values(sec.doors).some((d) => byId[d.to].type === 'boss')) errs.push('secret adjacent to boss');
  // symmetric doors
  for (const r of f.rooms) for (const [d, dd] of Object.entries(r.doors)) {
    const back = byId[dd.to].doors[OPPOSITE[d]];
    if (!back || back.to !== r.id) errs.push(`door ${r.id}.${d} not symmetric`);
  }
  if (!f.keyRoomId || byId[f.keyRoomId].type !== 'normal') errs.push('no guaranteed-key room');
  for (const r of f.rooms) if (!Templates.get(r.template)) errs.push(`room ${r.id} has unknown template ${r.template}`);
  return errs;
}

export function runSelfTest(n = 100) {
  const errors = [];
  let count = 0;
  for (let seed = 1; seed <= n; seed++) {
    for (const floor of [1, 2, 3]) {
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
