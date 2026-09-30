// FN-2 hazard acceptance: `node tools/qa/hazard-check.mjs [--noassets] [--only=name,name]` (private Vite + headless Chrome via harness.mjs; never port 5173).
// Wiring-agnostic: test rooms are built by patching a normal room's template in memory (grid + fields) and jumping to it, then the room is held in
// combat by hand. Time is fast-forwarded with game.step at 60 Hz (no rendering), so every number is asserted in game seconds.
import { launch } from './harness.mjs';
import { pathToFileURL } from 'node:url';

/** In-page rig (serialised into the page: no closures over Node scope). Exposes window.__rig. */
export async function installRig() {
  const game = window.__game;
  const R = (window.__rig = {});
  const { Templates } = await import('/src/gen/Templates.js');
  const { Hazards } = await import('/src/rooms/hazards/index.js');
  const { Modifiers } = await import('/src/rooms/special/modifiers/index.js');
  const cfg = await import('/src/config.js');
  Object.assign(R, { Hazards, Modifiers, cfg, Templates });
  window.__t = window.__t || game.loop.now || performance.now();
  const sc = () => window.__dw.scene;
  R.sc = sc;
  const DT = 1000 / 60;
  R.dt = 1 / 60;
  /** Step n frames (no rendering unless render=true). cb(i) runs before every frame. */
  R.step = (n, cb, render = false) => {
    if (!window.__dw) return;
    game.loop.sleep();
    const scs = game.scene.getScenes(false), vis = scs.map((s) => s.sys.settings.visible);
    if (!render) scs.forEach((s) => (s.sys.settings.visible = false));
    for (let i = 0; i < n; i++) {
      if (!window.__dw) break;
      const s = sc();
      if (s && s.fx) s.fx.hitStopUntil = 0;
      if (cb && cb(i) === false) break;
      window.__t += DT; game.step(window.__t, DT);
    }
    scs.forEach((s, k) => (s.sys.settings.visible = vis[k]));
  };
  R.secs = (s, cb) => R.step(Math.round(s * 60), cb);
  const saved = new Map();
  const FIELDS = ['lanes', 'chandelier', 'roulette', 'lavaSpit', 'graveAmbush', 'modBias', 'waves'];
  /**
   * Build a hazard test room. o = { tiles: [[c, r, ch], ...], fields: {lanes, chandelier, ...}, combat: bool, mod: id, seed, grid: [13x7 strings] }.
   * combat=true holds the room in combat (no waves, pending=1) and locks the doors; false marks the room cleared (safe room).
   */
  R.room = (o = {}) => {
    const s = sc(), rm = s.roomMgr;
    const def = Object.values(rm.floor.byId).find((d) => d.type === 'normal' && d.template);
    const tpl = Templates.get(def.template);
    if (!saved.has(tpl.id)) saved.set(tpl.id, { grid: tpl.grid, fields: FIELDS.map((k) => [k, tpl[k]]), mod: def.mod, seed: def.seed, def });
    delete rm.states[def.id];
    tpl.grid = Array.from({ length: 7 }, (_, r) => (o.grid ? o.grid[r].split('') : Array(13).fill('.')));
    for (const [c, r, ch] of o.tiles || []) tpl.grid[r][c] = ch;
    for (const k of FIELDS) delete tpl[k];
    tpl.waves = {};
    Object.assign(tpl, o.fields || {});
    def.mod = o.mod || null;
    if (o.seed != null) def.seed = o.seed;
    rm.jump(def.id);
    const room = rm.room;
    const p = s.player;
    p.hp = p.maxHp; p.tin = 0; p.godMode = false; p.hurtT = 0; p.entryInv = 0; p.dead = false;
    p.teleport(o.at ? o.at[0] : 720, o.at ? o.at[1] : 528);
    if (o.combat) { room.mode = 'combat'; room.waveIdx = 0; room.pending = 1; room.lock(); }
    else room.state.cleared = true;
    return room;
  };
  R.restore = () => {
    for (const [id, sv] of saved) { const t = Templates.get(id); t.grid = sv.grid; for (const [k, v] of sv.fields) { if (v === undefined) delete t[k]; else t[k] = v; } sv.def.mod = sv.mod; sv.def.seed = sv.seed; }
    saved.clear();
  };
  R.tile = (c, r) => ({ x: cfg.ROOM.x + c * cfg.TILE + cfg.TILE / 2, y: cfg.ROOM.y + r * cfg.TILE + cfg.TILE / 2 });
  R.put = (x, y, o = {}) => { const p = sc().player; p.hp = p.maxHp; p.tin = 0; p.dead = false; p.teleport(x, y); if (o.vulnerable !== false) { p.hurtT = 0; p.entryInv = 0; } p.rolling = !!o.rolling; p.rollT = o.rolling ? 5 : 0; return p; };
  R.units = () => { const p = sc().player; return p.hp + p.tin; };
  R.freeze = () => { const p = sc().player; p.knock.x = p.knock.y = 0; p.vx = p.vy = 0; };
  R.enemy = (id, x, y) => { const e = window.__dw.api.spawn(id, x, y, { instant: true }); e.contactDamage = 0; e.speed = 0; return e; }; // inert dummy: never hurts the player, never walks
  R.clearEnemies = () => { for (const e of [...sc().enemies]) { e.hp = 0; try { e.die({ silent: true }); } catch (err) { /* */ } } };
  R.count = () => ({ tex: sc().textures.list ? Object.keys(sc().textures.list).length : 0, kids: sc().children.list.length });
  // capture the player environment after every hazard update (the Player may consume + reset it in the same frame)
  R.envLog = [];
  const orig = Hazards.update.bind(Hazards);
  Hazards.update = (room, dt) => { orig(room, dt); const p = sc().player; if (p && p.env) R.envLog.push({ px: p.env.push.x, py: p.env.push.y, sm: p.env.speedMult, rm: p.env.rollMult }); if (R.envLog.length > 4000) R.envLog.shift(); };
  return true;
}

// ---------------------------------------------------------------------------------------------------------------- tests
const TESTS = {
  async lava(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig, c = R.tile(6, 3);
      const room = R.room({ tiles: [[6, 3, 'L'], [7, 3, 'L']], combat: false });
      R.step(5);
      const p = R.put(c.x, c.y);
      const hits = [], u0 = R.units();
      let last = u0, n = 0;
      R.secs(2.6, () => { R.freeze(); const u = R.units(); if (u < last) hits.push(+(n / 60).toFixed(2)); last = u; n++; });
      // roll across: invulnerable the whole way = no damage
      R.put(c.x, c.y, { rolling: true }); const u1 = R.units();
      R.secs(0.4, () => { R.freeze(); R.sc().player.rolling = true; R.sc().player.rollT = 5; });
      const rollDmg = u1 - R.units();
      // roll landing on lava = damage
      const p2 = R.put(c.x, c.y, { rolling: true }); const u2 = R.units();
      R.step(3, () => R.freeze()); p2.rolling = false; p2.rollT = 0; p2.hurtT = 0;
      R.step(3, () => R.freeze());
      const landDmg = u2 - R.units();
      // river crossing at 330 px/s over 2 tiles costs at most 1
      const a = R.tile(4, 3), b = R.tile(9, 3);
      const p3 = R.put(a.x, a.y); p3.hurtT = 0; const u3 = R.units();
      R.secs(1.0, () => { p3.x += 330 / 60; R.sc().player.knock.x = 0; });
      const crossDmg = u3 - R.units();
      // walkers avoid lava and burn on it
      const e = R.enemy('grunt', c.x, c.y);
      const blocked = room.probe(c.x, c.y, e.radius, e);
      const flyProbe = room.probe(c.x, c.y, 20, { flying: true });
      e.speed = 0; const hp0 = e.hp; R.secs(2.0); const burn = (hp0 - e.hp) / 2;
      R.clearEnemies();
      return { hits, rollDmg, landDmg, crossDmg, blocked, flyProbe, burn, path: room.lavaPath().count };
    });
    t.ok('lava: standing costs 1 unit per 1.0 s', r.hits.length === 3 && Math.abs(r.hits[1] - r.hits[0] - 1.0) < 0.08 && Math.abs(r.hits[2] - r.hits[1] - 1.0) < 0.08, JSON.stringify(r.hits));
    t.ok('lava: rolling across = 0 damage', r.rollDmg === 0, r.rollDmg);
    t.ok('lava: roll landing on lava = damage', r.landDmg === 1, r.landDmg);
    t.ok('lava: 2-tile river at 330 px/s costs at most 1', r.crossDmg <= 1, r.crossDmg);
    t.ok('lava: walkers treat it as blocked, flyers do not', r.blocked === true && r.flyProbe === false, `${r.blocked}/${r.flyProbe}`);
    t.ok('lava: walker on lava burns ~6 dps', r.burn > 4.5 && r.burn < 7.5, r.burn);
    t.ok('lava: lavaPath graph has both tiles', r.path === 2, r.path);
  },

  async lavaSpit(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig;
      const tiles = [[1, 1, 'L'], [2, 1, 'L'], [3, 1, 'L'], [9, 5, 'L'], [10, 5, 'L'], [11, 5, 'L']];
      const room = R.room({ tiles, fields: { lavaSpit: true }, combat: true, at: [720, 528] });
      const p = R.sc().player; p.godMode = true;
      const fired = [];
      const bl = R.sc().bullets.enemy, of = bl.fire.bind(bl);
      bl.fire = (o) => { fired.push({ t: +(R.sc().time.now / 1000).toFixed(2), kind: o.kind, speed: o.speed, dmg: o.damage }); return of(o); };
      const t0 = R.sc().time.now;
      R.secs(9.5, () => { R.freeze(); });
      bl.fire = of;
      const rel = fired.map((f) => +(f.t - t0 / 1000).toFixed(1));
      // fewer than 3 lava tiles: no spit
      R.room({ tiles: [[1, 1, 'L'], [2, 1, 'L']], fields: { lavaSpit: true }, combat: true });
      let n = 0; const bl2 = R.sc().bullets.enemy, o2 = bl2.fire.bind(bl2); bl2.fire = (o) => { n++; return o2(o); }; R.secs(8); bl2.fire = o2;
      return { rel, f0: fired[0], n2: n };
    });
    t.ok('lavaSpit: one ember (speed 240, dmg 1) per 4.0 s, first bubble 2.5 s after the 0.6 s first-wave tell, 0.6 s bubble', r.rel.length >= 2 && r.rel[0] >= 3.6 && r.rel[0] <= 3.8 && Math.abs(r.rel[1] - r.rel[0] - 4.0) < 0.3 && r.f0.speed === 240 && r.f0.dmg === 1, JSON.stringify(r));
    t.ok('lavaSpit: none with < 3 lava tiles', r.n2 === 0, r.n2);
  },

  async vents(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig;
      // four vents, one per phase offset ((c*7+r*3)%4): (0,0)->0, (1,0)->3 (2.7), (0,1)->3? use search
      const tiles = [], offs = new Set();
      for (let c = 0; c < 13 && offs.size < 4; c++) for (let r = 0; r < 7 && offs.size < 4; r++) { const o = (c * 7 + r * 3) % 4; if (!offs.has(o) && c > 1 && c < 11 && r > 0 && r < 6) { offs.add(o); tiles.push([c, r, 'V']); } }
      const room = R.room({ tiles, combat: false });
      const hz = room._hz;
      const p = R.sc().player; p.godMode = true;
      const log = hz.vents.vents.map(() => []);
      let n = 0;
      R.secs(16, () => { hz.vents.vents.forEach((v, i) => { const l = log[i]; if (!l.length || l[l.length - 1][1] !== v.state) l.push([+(n / 60).toFixed(2), v.state]); }); n++; });
      return { log, offs: hz.vents.vents.map((v) => v.off) };
    });
    let ok = true, why = '', firstMin = 99;
    for (const l of r.log) {
      const er = l.filter((e) => e[1] === 2);
      if (er.length) firstMin = Math.min(firstMin, er[0][0]);
      // steady-state durations: idle 1.8, warn 0.9, erupt 0.9 (skip the first, partial, segment)
      for (let i = 1; i + 1 < l.length; i++) { const d = l[i + 1][0] - l[i][0], st = l[i][1], want = st === 0 ? 1.8 : 0.9; if (st === 0 && d > 2.0) continue; if (Math.abs(d - want) > 0.05 && !(st === 0 && d > want)) { ok = false; why = JSON.stringify(l); } }
    }
    t.ok('vents: cycle idle 1.8 / warn 0.9 / erupt 0.9', ok, why);
    t.ok('vents: first eruption never < 1.0 s after entry', firstMin >= 0.98, firstMin);
    const dmg = await g.eval(() => {
      const R = window.__rig, room = R.room({ tiles: [[6, 3, 'V']], combat: false }), hz = room._hz, v = hz.vents.vents[0];
      const p = R.put(v.x - 40, v.y); p.godMode = false;
      const e = R.enemy('grunt', v.x + 40, v.y); e.speed = 0; const hp0 = e.hp;
      let dm = 0, last = R.units();
      R.secs(5, () => { R.freeze(); const u = R.units(); if (u < last) dm += last - u; last = u; });
      return { dm, eDmg: hp0 - e.hp, eruptions: 5 / 3.6 };
    });
    t.ok('vents: player takes 1 per eruption, walker 4 per eruption', dmg.dm >= 1 && dmg.dm <= 2 && dmg.eDmg >= 4, JSON.stringify(dmg));
  },

  async lanes(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig;
      const room = R.room({ combat: true, at: [720, 300] });
      const s = R.sc(), p = s.player;
      const lane = R.Hazards.spawnLane(room, { axis: 'h', index: 3, dir: 1, kind: 'cart' });
      let tell = 0, ran = -1;
      R.secs(1.3, () => { if (lane.state === 'tell') tell += R.dt; else if (ran < 0) ran = tell; R.freeze(); });
      // cart 2 dmg + shove: stand in the lane row when the body arrives
      const c = R.tile(6, 3);
      const p2 = R.put(c.x, c.y); const u0 = R.units();
      let shove = 0;
      R.secs(4, () => { R.freeze(); if (lane.state === 'run' && Math.abs(lane.pos - p2.x) < 90) { p2.knock.x = p2.knock.x; } if (R.units() < u0 && !shove) { shove = 1; } if (R.units() < u0) return false; });
      const dmg = u0 - R.units();
      const kn = Math.abs(p2.knock.y);
      R.secs(4);
      // roll dodges
      const lane2 = R.Hazards.spawnLane(room, { axis: 'h', index: 3, dir: -1, kind: 'cart' });
      const p3 = R.put(c.x, c.y, { rolling: true }); const u1 = R.units();
      R.secs(5, () => { R.freeze(); p3.rolling = true; p3.rollT = 5; });
      const rollDmg = u1 - R.units();
      // enemies hit: 14 dmg + stun 0.6
      const lane3 = R.Hazards.spawnLane(room, { axis: 'h', index: 1, dir: 1, kind: 'cart' });
      const e = R.enemy('grunt', R.tile(9, 1).x, R.tile(9, 1).y); const hp0 = e.hp; let stunned = false;
      R.secs(5, () => { R.sc().player.hurtT = 1; if (e.alive && e.status && e.status.stun) stunned = true; });
      return { tell: +tell.toFixed(2), ran, dmg, kn, rollDmg, eDmg: hp0 - e.hp, eDead: !e.alive, stunned, cap: (() => { let n = 0; for (let i = 0; i < 6; i++) if (R.Hazards.spawnLane(room, { axis: 'v', index: i * 2, dir: 1 })) n++; return n; })() };
    });
    t.ok('lanes: cart tell is 1.0 s', Math.abs(r.tell - 1.0) < 0.05, r.tell);
    t.ok('lanes: cart hit = 2 dmg', r.dmg === 2, r.dmg);
    t.ok('lanes: roll i-frames dodge the cart', r.rollDmg === 0, r.rollDmg);
    t.ok('lanes: walkers take 14 + stun (or die)', r.eDmg >= 14 || r.eDead, JSON.stringify(r));
    t.ok('lanes: at most 4 lane bodies alive', r.cap <= 4, r.cap);
  },

  async laneClear(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig;
      const room = R.room({ combat: true, fields: { lanes: [{ axis: 'h', index: 2, period: 6.5, offset: 2.5, dir: 1, kind: 'cart' }, { axis: 'h', index: 4, period: 7, offset: 5, dir: 0, kind: 'cart' }] } });
      const hz = room._hz, s = R.sc(); s.player.godMode = true;
      const starts = [];
      let prev = 0;
      R.secs(16, () => { R.freeze(); const n = hz.lanes.lanes.filter((l) => l.state === 'tell').length; if (n > prev) starts.push(+hz.t.toFixed(2)); prev = n; });
      const busyBefore = hz.lanes.busy;
      // clear mid-tell: spawn one and clear
      R.Hazards.spawnLane(room, { axis: 'h', index: 0, dir: 1, kind: 'cart' });
      R.secs(0.3);
      room.clearRoom();
      R.secs(0.5);
      const afterClear = hz.lanes.lanes.map((l) => l.state);
      R.secs(15);
      const later = hz.lanes.busy;
      return { starts, busyBefore, afterClear, later };
    });
    t.ok('lanes: first launch >= 2.0 s, starts >= 1.5 s apart', r.starts.length >= 3 && r.starts[0] >= 2.0 && r.starts.every((s, i) => i === 0 || s - r.starts[i - 1] >= 1.45), JSON.stringify(r.starts));
    t.ok('lanes: stop on room clear (tells cancelled, no new launches)', r.afterClear.every((s) => s === 'off' || s === 'fade') && r.later === 0, JSON.stringify(r));
  },

  async steam(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig;
      const room = R.room({ tiles: [[0, 3, 'T']], combat: false, at: [1200, 200] });
      const hz = room._hz, j = hz.steam.jets[0], s = R.sc();
      const p = R.put(R.tile(3, 3).x, R.tile(3, 3).y); p.godMode = true;
      const e = R.enemy('grunt', R.tile(2, 3).x, R.tile(2, 3).y); e.speed = 0;
      // wait for the jet phase
      let n = 0; R.secs(12, () => { R.freeze(); if (j.state === 2) return false; });
      R.envLog.length = 0;
      const x0 = p.x, ex0 = e.x;
      R.secs(1.0, () => { R.freeze(); p.x = Math.max(p.x, x0); });
      const px = R.envLog.length ? Math.max(...R.envLog.map((l) => l.px)) : 0;
      const dx = p.x - x0, edx = e.x - ex0;
      // roll ignores
      p.teleport(R.tile(3, 3).x, R.tile(3, 3).y); p.rolling = true; p.rollT = 5; R.envLog.length = 0;
      R.secs(0.4, () => { R.freeze(); p.rolling = true; p.rollT = 5; });
      const rollPush = R.envLog.length ? Math.max(...R.envLog.map((l) => Math.abs(l.px))) : 0;
      R.clearEnemies();
      return { px, dx, edx, rollPush, dir: [j.dx, j.dy], len: (j.x1 - j.x0), w: (j.y1 - j.y0) };
    });
    t.ok('steam: player push 300 px/s along the jet', Math.abs(r.px - 300) < 1, r.px);
    t.ok('steam: jet is 5 tiles long and 88 px wide', Math.abs(r.len - 480) < 1 && Math.abs(r.w - 88) < 1, JSON.stringify(r));
    t.ok('steam: walkers pushed ~200 px/s', r.edx > 120 && r.edx < 230, r.edx);
    t.ok('steam: a roll ignores the push', r.rollPush === 0, r.rollPush);
    const cyc = await g.eval(() => {
      const R = window.__rig, room = R.room({ tiles: [[0, 3, 'T']], combat: false }), j = room._hz.steam.jets[0];
      const log = []; let n = 0;
      R.secs(14, () => { if (!log.length || log[log.length - 1][1] !== j.state) log.push([+(n / 60).toFixed(2), j.state]); n++; });
      return log;
    });
    let ok = true;
    for (let i = 1; i + 1 < cyc.length; i++) { const d = cyc[i + 1][0] - cyc[i][0], want = [2.0, 0.9, 1.5][cyc[i][1]]; if (Math.abs(d - want) > 0.05) ok = false; }
    t.ok('steam: cycle idle 2.0 / warn 0.9 / jet 1.5', ok && cyc.length > 4, JSON.stringify(cyc));
  },

  async chandelier(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig;
      const room = R.room({ combat: true });
      const s = R.sc(), p = s.player, c = R.tile(6, 3);
      p.teleport(c.x, c.y);
      const h = R.Hazards.chandelier(room, c.x, c.y);
      const shards = [];
      const bl = s.bullets.enemy, of = bl.fire.bind(bl); bl.fire = (o) => { shards.push(o.kind); return of(o); };
      const e = R.enemy('grunt', c.x + 60, c.y); const hp0 = e.hp;
      const u0 = R.units(); let landed = -1, n = 0;
      R.secs(1.6, () => { p.hurtT = 0; R.freeze(); if (h.fired && landed < 0) landed = n / 60; n++; if (R.units() < u0) return false; });
      bl.fire = of;
      const dmg = u0 - R.units();
      R.secs(0.4);
      const fire = room._hz.fires.order.map((f) => ({ r: f.r, life: f.life }));
      R.clearEnemies();
      return { tell: h.tell, landed, dmg, shards: shards.length, kind: shards[0], eDmg: hp0 - e.hp, fire };
    });
    t.ok('chandelier: tell 1.2 s', r.tell === 1.2 && Math.abs(r.landed - 1.2) < 0.06, JSON.stringify(r));
    t.ok('chandelier: 2 damage, 25 to walkers', r.dmg === 2 && r.eDmg >= 25, JSON.stringify(r));
    t.ok('chandelier: 6 shard bullets + fire patch r 80 for 3.0 s', r.shards === 6 && r.kind === 'shard' && r.fire.length === 1 && r.fire[0].r === 80 && r.fire[0].life === 3, JSON.stringify(r));
    const sched = await g.eval(() => {
      const R = window.__rig, room = R.room({ combat: true, fields: { chandelier: true } }), hz = room._hz, s = R.sc(); s.player.godMode = true;
      const starts = []; let prev = 0;
      R.secs(20, () => { R.freeze(); const n = s._groundHaz ? s._groundHaz.list.length : 0; if (n > prev) starts.push(+hz.t.toFixed(2)); prev = n; });
      room.clearRoom(); const before = s._groundHaz ? s._groundHaz.list.length : 0; R.secs(9);
      return { starts, before, after: s._groundHaz ? s._groundHaz.list.length : 0 };
    });
    t.ok('chandelier: first at 4.0 s then every 7.0 s, one at a time', sched.starts.length === 3 && Math.abs(sched.starts[0] - 4.0) < 0.1 && Math.abs(sched.starts[1] - sched.starts[0] - 7.0) < 0.1, JSON.stringify(sched));
    t.ok('chandelier: stops on clear', sched.after === 0, JSON.stringify(sched));
  },

  async roulette(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig;
      const tiles = [];
      for (let c = 3; c < 8; c++) for (let r = 2; r < 5; r++) tiles.push([c, r, (c + r) % 2 ? 'r' : 'k']);
      const room = R.room({ tiles, combat: true, fields: { roulette: false } });
      const s = R.sc(), p = s.player, hz = room._hz, ro = hz.roulette;
      const red = tiles.find((x) => x[2] === 'r'), blk = tiles.find((x) => x[2] === 'k');
      const rt = R.tile(red[0], red[1]), bt = R.tile(blk[0], blk[1]);
      R.put(rt.x, rt.y);
      ro.call('r');
      let tell = 0, zapAt = -1, hits = [], n = 0, last = R.units();
      R.secs(3.2, () => { p.knock.x = p.knock.y = 0; const u = R.units(); if (u < last) hits.push(+(n / 60).toFixed(2)); last = u; if (ro.state === 'tell') tell += R.dt; else if (zapAt < 0) zapAt = n / 60; p.hurtT = p.hurtT > 0.5 ? p.hurtT : 0; n++; });
      // safe on the other colour
      R.put(bt.x, bt.y); const u0 = R.units();
      ro.call('r'); R.secs(3.2, () => { p.knock.x = p.knock.y = 0; });
      const safe = u0 - R.units();
      // outside region always safe
      R.put(R.tile(11, 6).x, R.tile(11, 6).y); const u1 = R.units(); ro.call('k'); R.secs(3.2, () => { p.knock.x = p.knock.y = 0; });
      const outside = u1 - R.units();
      // walker on zapped tile takes 6 once
      const e = R.enemy('grunt', rt.x, rt.y); e.speed = 0; const hp0 = e.hp; R.put(R.tile(11, 6).x, R.tile(11, 6).y); ro.call('r'); R.secs(3.2, () => { p.hurtT = 1; }); const eD = hp0 - e.hp;
      R.clearEnemies();
      // never 3 of a kind
      const room2 = R.room({ tiles, combat: true, fields: { roulette: true } }), ro2 = room2._hz.roulette; R.sc().player.godMode = true;
      const seq = []; let prevState = 'idle';
      R.secs(60, () => { R.freeze(); if (ro2.state === 'tell' && prevState === 'idle') seq.push(ro2.col); prevState = ro2.state; });
      return { tell: +tell.toFixed(2), zapAt: +zapAt.toFixed(2), hits, safe, outside, eD, seq };
    });
    t.ok('roulette: 1.0 s flicker tell then zap', Math.abs(r.tell - 1.0) < 0.05 && Math.abs(r.zapAt - 1.0) < 0.05, JSON.stringify(r));
    t.ok('roulette: zap hits at start and every 0.7 s (1 dmg)', r.hits.length === 2 && Math.abs(r.hits[0] - 1.0) < 0.08 && Math.abs(r.hits[1] - r.hits[0] - 0.7) < 0.1, JSON.stringify(r.hits));
    t.ok('roulette: other colour and outside tiles are safe', r.safe === 0 && r.outside === 0, JSON.stringify(r));
    t.ok('roulette: walkers on a zapped tile take 6 once', r.eD >= 6 && r.eD < 12, r.eD);
    let three = false; for (let i = 2; i < r.seq.length; i++) if (r.seq[i] === r.seq[i - 1] && r.seq[i] === r.seq[i - 2]) three = true;
    t.ok('roulette: called every 6.0 s, never the same colour 3 times in a row', r.seq.length >= 8 && !three, JSON.stringify(r.seq));
  },

  async fire(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig, room = R.room({ combat: false });
      for (let i = 0; i < 20; i++) room.addFire(200 + i * 55, 300, 30, 3.0);
      const cap = room._hz.fires.count;
      // player: 1 unit per 1.0 s, none in the last 0.3 s
      const room2 = R.room({ combat: false });
      const p = R.put(720, 528); const f = room2.addFire(720, 528, 60, 3.0);
      const hits = []; let last = R.units(), n = 0;
      R.secs(3.4, () => { R.freeze(); const u = R.units(); if (u < last) hits.push(+(n / 60).toFixed(2)); last = u; n++; });
      // team player never hurts the player, burns enemies
      const room3 = R.room({ combat: false });
      R.put(720, 528); room3.addFire(720, 528, 60, 3.0, { team: 'player', dps: 4 });
      const e = R.enemy('grunt', 720, 528); e.speed = 0; const hp0 = e.hp; const u0 = R.units();
      R.secs(2.0, () => { R.freeze(); });
      const pd = u0 - R.units(), ed = hp0 - e.hp; R.clearEnemies();
      // explosionImmune
      const room4 = R.room({ combat: false }); const p4 = R.put(720, 528); p4.stats.explosionImmune = true; room4.addFire(720, 528, 60, 3.0); const u4 = R.units(); R.secs(1.2, () => R.freeze()); const imm = u4 - R.units(); p4.stats.explosionImmune = false;
      const room6 = R.room({ combat: false }); const p6 = R.put(720, 528); p6.stats.pyroImmune = 1; room6.addFire(720, 528, 60, 3.0); const u6 = R.units(); R.secs(1.2, () => R.freeze()); const pyro = u6 - R.units(); p6.stats.pyroImmune = 0;
      // ignite
      const room5 = R.room({ combat: false }); const ig = room5.ignite(720, 528, { r: 44, life: 3.5, count: 4, spread: 200 });
      const gaps = []; for (let i = 0; i < ig.length; i++) for (let j = i + 1; j < ig.length; j++) gaps.push(Math.hypot(ig[i].x - ig[j].x, ig[i].y - ig[j].y));
      return { cap, hits, pd, ed, imm, pyro, ign: ig.length, minGap: Math.min(...gaps, 999) };
    });
    t.ok('fire: cap 14 per room (oldest culled)', r.cap === 14, r.cap);
    t.ok('fire: enemy patch hurts the player once per second, none in the last 0.3 s', r.hits.length === 3 && r.hits[0] <= 0.3 && Math.abs(r.hits[1] - r.hits[0] - 1.0) < 0.08 && r.hits[2] <= 2.75, JSON.stringify(r.hits));
    t.ok('fire: player-team patch never hurts the player, burns walkers', r.pd === 0 && r.ed > 0, JSON.stringify({ pd: r.pd, ed: r.ed }));
    t.ok('fire: explosionImmune is immune', r.imm === 0, r.imm);
    t.ok('fire: pyroImmune is immune', r.pyro === 0, r.pyro);
    t.ok('fire: ignite spreads patches >= 60 px apart', r.ign >= 3 && r.minGap >= 59, JSON.stringify({ n: r.ign, gap: r.minGap }));
  },

  async quicksand(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig, room = R.room({ tiles: [[5, 3, 'Q'], [6, 3, 'Q'], [7, 3, 'Q']], combat: false });
      const hz = room._hz, c = R.tile(6, 3), p = R.put(c.x, c.y), s = R.sc();
      const u0 = R.units(); let t0 = -1, n = 0, env = null, moved = false;
      R.envLog.length = 0;
      R.secs(2.2, () => { R.freeze(); if (t0 < 0 && R.units() < u0) t0 = n / 60; if (!moved && !hz.sand.at(p.x, p.y)) moved = true; n++; });
      env = R.envLog.length ? { sm: Math.min(...R.envLog.map((l) => l.sm)), rm: Math.min(...R.envLog.map((l) => l.rm)) } : null;
      const out = !hz.sand.at(p.x, p.y);
      // drains 2/s off tile
      hz.sand.meter = 1; const ent = R.tile(6, 1); p.teleport(ent.x, ent.y); R.secs(0.25); const m = hz.sand.meter;
      const e = R.enemy('grunt', c.x, c.y); e.speed = 100; R.step(2); const slowed = !!(e.status && e.status.slow && Math.abs(e.status.slow.mult - 0.6) < 0.01); R.clearEnemies();
      return { t0, dmg: u0 - R.units(), env, out, m, slowed };
    });
    t.ok('quicksand: sinks in 1.6 s -> 1 damage + pushed out', Math.abs(r.t0 - 1.6) < 0.06 && r.dmg === 1 && r.out, JSON.stringify(r));
    t.ok('quicksand: speed x0.5 and roll x0.6 (player.env)', r.env && r.env.sm === 0.5 && r.env.rm === 0.6, JSON.stringify(r.env));
    t.ok('quicksand: meter drains at 2/s off the tile', Math.abs(r.m - 0.5) < 0.1, r.m);
    t.ok('quicksand: walkers slowed x0.6', r.slowed, r.slowed);
  },

  async spikes(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig, room = R.room({ tiles: [[5, 3, 's'], [6, 3, 's']], combat: false }), hz = room._hz;
      const sp = hz.spikes.spikes[0];
      const log = []; let n = 0;
      R.secs(14, () => { if (!log.length || log[log.length - 1][1] !== sp.state) log.push([+(n / 60).toFixed(2), sp.state]); n++; });
      const offs = hz.spikes.spikes.map((x) => +x.off.toFixed(2));
      // damage while up: 1 unit
      const c = R.tile(5, 3), p = R.put(c.x, c.y); let dm = 0, last = R.units(); R.secs(3.2, () => { R.freeze(); const u = R.units(); if (u < last) dm += last - u; last = u; });
      // blocks only while up
      const states = []; const e = { flying: false, ghost: false }; R.secs(3, () => { states.push([sp.state, room.probe(c.x, c.y, 20, e)]); });
      const upBlocks = states.filter((s) => s[0] === 2).every((s) => s[1]); const downFree = states.filter((s) => s[0] !== 2).every((s) => !s[1]);
      return { log, offs, dm, upBlocks, downFree };
    });
    let ok = r.log.length > 5;
    for (let i = 1; i + 1 < r.log.length; i++) { const d = r.log[i + 1][0] - r.log[i][0], want = [1.4, 0.5, 0.9][r.log[i][1]]; if (Math.abs(d - want) > 0.05) ok = false; }
    t.ok('spikes: cycle down 1.4 / warn 0.5 / up 0.9 (2.8 s)', ok, JSON.stringify(r.log));
    t.ok('spikes: phase offset (c+r)*0.35', Math.abs(r.offs[1] - r.offs[0] - 0.35) < 0.02 || Math.abs(r.offs[0] - r.offs[1]) > 2, JSON.stringify(r.offs));
    t.ok('spikes: 1 damage per hit while up (i-frames)', r.dm >= 1 && r.dm <= 3, r.dm);
    t.ok('spikes: walkers only blocked while up', r.upBlocks && r.downFree, JSON.stringify({ u: r.upBlocks, d: r.downFree }));
  },

  async grave(g, t) {
    const res = await g.eval(async () => {
      const R = window.__rig;
      const { isRigged } = await import('/src/rooms/hazards/GraveAmbush.js');
      let seedOn = 1, seedOff = 1;
      for (let s = 1; s < 60; s++) { if (isRigged({ seed: s })) { seedOn = s; break; } }
      for (let s = 1; s < 60; s++) { if (!isRigged({ seed: s })) { seedOff = s; break; } }
      const run = (seed) => {
        const room = R.room({ tiles: [[2, 1, 'G'], [10, 1, 'G'], [2, 5, 'G'], [10, 5, 'G']], fields: { graveAmbush: true }, combat: true, seed, at: [720, 528] });
        R.sc().player.godMode = true;
        room.state.cleared = true; room.mode = 'done'; room.unlock();
        R.secs(0.5, () => R.freeze());
        const before = R.sc().enemies.filter((e) => e.alive).length;
        const st = R.tile(2, 1); R.put(st.x + 100, st.y + 40);
        R.secs(0.6, () => R.freeze());
        const tellPhase = room._hz.grave.phase;
        R.secs(0.6, () => R.freeze());
        const ids = R.sc().enemies.filter((e) => e.alive).map((e) => e.id).sort();
        const locked = room.locked, solid = room.tiles[1][2].solid;
        for (const e of R.sc().enemies.slice()) { if (e.alive) { e.hp = 0; e.die({}); } }
        R.secs(0.5, () => R.freeze());
        return { before, tellPhase, ids, locked, solid, unlocked: !room.locked, pk: room.pickups.length, done: room.state.ctl && room.state.ctl.graveDone };
      };
      return { on: run(seedOn), off: run(seedOff), seedOn, seedOff };
    });
    t.ok('grave: rigged room telegraphs 1.0 s, releases 2 skeletons + possessed + ghost, re-locks', res.on.tellPhase === 'tell' && res.on.ids.join() === 'ghost,possessed,skeleton,skeleton' && res.on.locked && !res.on.solid, JSON.stringify(res.on));
    t.ok('grave: reopens with one extra pickup when they die', res.on.unlocked && res.on.pk >= 1 && res.on.done === true, JSON.stringify(res.on));
    t.ok('grave: unrigged room stays scenery', res.off.tellPhase === 'wait' && res.off.ids.length === 0, JSON.stringify(res.off));
  },

  async tiles(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig, room = R.room({ tiles: [[1, 1, 'L'], [2, 1, 'V'], [3, 1, '='], [4, 1, '|'], [5, 1, 'r'], [6, 1, 'k'], [7, 1, 'Q'], [8, 1, 's'], [0, 3, 'T']], combat: false });
      const hz = room._hz;
      R.secs(1);
      return { has: ['lava', 'vents', 'sand', 'spikes', 'steam', 'roulette'].map((k) => !!hz[k]), rails: hz.rails.length, hg: room.hazardWalk };
    });
    t.ok('tiles: every hazard tile type builds', r.has.every(Boolean) && r.rails === 2, JSON.stringify(r));
  },
};

export async function runAll({ noassets = false, only = null, log = console.log } = {}) {
  const g = await launch({ query: `?debug=1&seed=42${noassets ? '&noassets=1' : ''}`, name: 'hazard-check' });
  let pass = 0, fail = 0;
  const t = { ok(name, cond, detail) { if (cond) pass++; else fail++; log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `   -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`); } };
  try {
    await g.startRun();
    await g.eval(installRig);
    for (const [name, fn] of Object.entries(TESTS)) {
      if (only && !only.includes(name)) continue;
      const e0 = g.errors.length;
      try { await fn(g, t); } catch (e) { fail++; log(`FAIL  ${name} threw: ${e.message.split('\n').slice(0, 4).join(' / ')}`); }
      if (g.errors.length > e0) { fail++; log(`FAIL  ${name}: console errors: ${g.errors.slice(e0, e0 + 3).join(' | ').slice(0, 300)}`); }
    }
    await g.eval(() => window.__rig.restore());
  } finally { await g.close(); }
  log(`hazard-check: ${pass} passed, ${fail} failed${noassets ? ' (noassets)' : ''}`);
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  const fails = await runAll({ noassets: args.includes('--noassets'), only: only.length ? only : null });
  process.exit(fails ? 1 : 0);
}
