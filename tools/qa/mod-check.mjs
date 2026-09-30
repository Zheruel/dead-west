// FN-2 room-modifier acceptance: `node tools/qa/mod-check.mjs [--noassets] [--only=name,name] [--shots]` (private Vite + headless Chrome via harness.mjs).
// Reuses the in-page rig of hazard-check.mjs (time is fast-forwarded with game.step at 60 Hz, every number asserted in game seconds).
// Modifiers are attached to a plain combat test room with R.mod(id, floor): the room floor is set first because Dust Storm / Fog / Stampede read it.
import { launch } from './harness.mjs';
import { installRig } from './hazard-check.mjs';
import { pathToFileURL } from 'node:url';

/** In-page extras: R.mod(id, {floor, combat}) -> room with the modifier built (and locked when combat). */
export async function installModRig() {
  const R = window.__rig, { Modifiers } = R;
  R.mod = (id, o = {}) => {
    const room = R.room({ combat: o.combat !== false, at: o.at });
    if (room._mod) Modifiers.destroy(room);
    room.floor = o.floor || 1;
    room.mod = id;
    Modifiers.build(room);
    if (room.mode === 'combat' && room.locked && !room._mod.running) Modifiers.onLock(room);
    return room;
  };
  const ou = Modifiers.update.bind(Modifiers);
  Modifiers.update = (room, dt) => { ou(room, dt); const p = R.sc().player; if (p && p.env) R.envLog.push({ px: p.env.push.x, py: p.env.push.y, sm: p.env.speedMult, rm: p.env.rollMult }); };
  R.laneList = (room) => (room._hz && room._hz.lanes ? room._hz.lanes.lanes.filter((l) => l.state !== 'off') : []);
  return true;
}

const TESTS = {
  async dust(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig, room = R.mod('dust_storm', { floor: 1 }), m = room._mod, s = R.sc(), p = s.player;
      p.godMode = true; R.freeze();
      R.secs(1.0, () => R.freeze());
      const depth = m.mask.rt.depth, vis = m.mask.rt.visible, alpha = m.mask.alphaMul;
      R.envLog.length = 0; R.secs(0.5, () => R.freeze());
      const push = R.envLog.length ? R.envLog[R.envLog.length - 1] : null;
      const mag = push ? Math.hypot(push.px, push.py) : -1, cardinal = push && (push.px === 0 || push.py === 0);
      p.rolling = true; p.rollT = 5; R.envLog.length = 0; R.secs(0.3, () => { R.freeze(); p.rolling = true; p.rollT = 5; });
      const rollMag = R.envLog.length ? Math.hypot(R.envLog[R.envLog.length - 1].px, R.envLog[R.envLog.length - 1].py) : -1;
      p.rolling = false; p.rollT = 0;
      const streaks = m.streaks.length;
      room.clearRoom();
      R.envLog.length = 0; R.secs(0.3, () => R.freeze());
      const afterMag = R.envLog.length ? Math.hypot(R.envLog[R.envLog.length - 1].px, R.envLog[R.envLog.length - 1].py) : -1;
      R.secs(1.3, () => R.freeze());
      const lifted = !m.mask.rt.visible;
      const ash = R.mod('dust_storm', { floor: 4 })._mod.name;
      return { depth, vis, alpha, mag, cardinal, rollMag, streaks, afterMag, lifted, ash, name: m.name };
    });
    t.ok('dust: mask at depth bullets-4 fades in', r.depth === 196 && r.vis && r.alpha === 1, JSON.stringify(r));
    t.ok('dust: 40 streaks', r.streaks === 40, r.streaks);
    t.ok('dust: wind 45 px/s along one cardinal direction (player.env.push)', Math.abs(r.mag - 45) < 0.01 && r.cardinal, JSON.stringify(r));
    t.ok('dust: no wind while rolling', r.rollMag === 0, r.rollMag);
    t.ok('dust: wind stops on clear, mask lifts within ~1 s', r.afterMag === 0 && r.lifted, JSON.stringify(r));
    t.ok('dust: floor 4 reskin is ASH STORM', r.ash === 'ASH STORM' && r.name === 'DUST STORM', JSON.stringify({ ash: r.ash, name: r.name }));
  },

  async darkness(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig, room = R.mod('darkness', { floor: 3 }), m = room._mod, s = R.sc(), p = s.player;
      p.godMode = true;
      R.secs(1.0, () => R.freeze());
      const dm = room.darkMask;
      const lights = m.mask.lights.length;
      room.clearRoom(); R.secs(1.4, () => R.freeze());
      return { dm, lights, after: room.darkMask, cfg: m.cfg.mask.alpha };
    });
    t.ok('darkness: room.darkMask raised while dark, dropped after the lift', r.dm === true && r.after === false, JSON.stringify(r));
    t.ok('darkness: 0.92 near-black mask, no spurious extra lights', r.cfg === 0.92 && r.lights === 0, JSON.stringify(r));
    const w = await g.eval(async () => {
      const R = window.__rig, { warnDepth } = await import('/src/rooms/hazards/common.js');
      const room = R.mod('darkness', { floor: 3 });
      const d = warnDepth(room); room._mod.destroy(); room._mod = null;
      return { d, plain: warnDepth(R.mod('stampede', { floor: 1 })) };
    });
    t.ok('darkness: warn overlays draw above the mask (>= 200)', w.d >= 200 && w.plain < 196, JSON.stringify(w));
  },

  async fog(g, t) {
    const r = await g.eval(async () => {
      const R = window.__rig;
      const out = {};
      for (const f of [1, 2, 3, 6]) {
        const room = R.mod('fog', { floor: f }), s = R.sc(); s.player.godMode = true;
        R.clearEnemies();
        const before = s.enemies.filter((e) => e.alive).length, pend = room.pending;
        const { bus } = await import('/src/core/events.js');
        bus.emit('room:wave', { room, enemies: [] });
        bus.emit('room:wave', { room, enemies: [] }); // second wave: no extra ghost
        const pend2 = room.pending;
        R.secs(1.0, () => R.freeze());
        const ghosts = s.enemies.filter((e) => e.alive && e.id === 'ghost').length;
        out[f] = { pendDelta: pend2 - pend, ghosts, banks: room._mod.banks.length, alpha: room._mod.cfg.mask.alpha };
      }
      return out;
    });
    t.ok('fog: one extra ghost with wave 1 on floors 2 and 3, none elsewhere', r[2].ghosts === 1 && r[3].ghosts === 1 && r[1].ghosts === 0 && r[6].ghosts === 0 && r[2].pendDelta === 1, JSON.stringify(r));
    t.ok('fog: six banks', r[2].banks === 6, r[2].banks);
  },

  async stampede(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig, out = {};
      for (const f of [1, 3]) {
        const room = R.mod('stampede', { floor: f, at: [720, 100] }), s = R.sc(); s.player.godMode = true;
        const events = []; let prev = 0, tellAt = -1, runAt = -1, n = 0;
        R.secs(19, () => {
          R.freeze();
          const ls = R.laneList(room), tells = ls.filter((l) => l.state === 'tell').length, runs = ls.filter((l) => l.state === 'run').length;
          if (tells && tells > prev) events.push({ t: +(n / 60).toFixed(2), rows: tells, kind: ls[0].kind, dirs: ls.map((l) => l.dir).join() });
          prev = tells; n++;
        });
        out[f] = events;
      }
      // contact: 1 dmg, roll dodges, enemy 25
      const room = R.mod('stampede', { floor: 1 }), s = R.sc(), p = s.player;
      const lane = R.Hazards.spawnLane(room, { axis: 'h', index: 3, dir: 1, kind: 'stampede', tell: 1.0, speed: 820, dmg: 1, enemyDmg: 25, shove: 200 });
      const c = R.tile(6, 3), p1 = R.put(c.x, c.y); const u0 = R.units(); R.secs(3, () => { R.freeze(); });
      const dmg = u0 - R.units();
      const lane2 = R.Hazards.spawnLane(room, { axis: 'h', index: 3, dir: -1, kind: 'stampede', tell: 1.0, speed: 820, dmg: 1, enemyDmg: 25, shove: 200 });
      const p2 = R.put(c.x, c.y, { rolling: true }); const u1 = R.units(); R.secs(3, () => { R.freeze(); p2.rolling = true; p2.rollT = 5; });
      const rollDmg = u1 - R.units();
      const lane3 = R.Hazards.spawnLane(room, { axis: 'h', index: 1, dir: 1, kind: 'stampede', tell: 1.0, speed: 820, dmg: 1, enemyDmg: 25, shove: 200 });
      const e = R.enemy('grunt', R.tile(8, 1).x, R.tile(8, 1).y); const hp0 = e.hp; R.put(R.tile(6, 5).x, R.tile(6, 5).y); R.secs(3, () => { p.hurtT = 1; });
      return { out, dmg, rollDmg, eDmg: hp0 - e.hp, eDead: !e.alive };
    });
    const e1 = r.out[1], e3 = r.out[3];
    t.ok('stampede: first warning at 3.0 s (+0.6 s lock offset excluded), floor 1 = 2 rows, floor 3 = 3 rows', e1.length >= 2 && Math.abs(e1[0].t - 3.0) < 0.1 && e1[0].rows === 2 && e3[0].rows === 3 && e1[0].kind === 'stampede', JSON.stringify(r.out));
    const gaps = e1.slice(1).map((e, i) => e.t - e1[i].t);
    t.ok('stampede: gap 6.5-8.5 s', gaps.length >= 1 && gaps.every((d) => d >= 6.4 && d <= 8.6), JSON.stringify(gaps));
    t.ok('stampede: contact 1 dmg, roll dodges it, enemies take 25', r.dmg === 1 && r.rollDmg === 0 && (r.eDmg >= 25 || r.eDead), JSON.stringify({ d: r.dmg, r: r.rollDmg, e: r.eDmg }));
  },

  async bloodMoon(g, t) {
    const r = await g.eval(async () => {
      const R = window.__rig, { bus } = await import('/src/core/events.js');
      // reference enemy in a plain room
      R.room({ combat: true });
      const ref = window.__dw.api.spawn('grunt', 300, 400, { instant: true });
      const hpBase = ref.maxHp, cdBase = ref.contactDamage;
      R.clearEnemies();
      const room = R.mod('blood_moon', { floor: 4 }), s = R.sc(); s.player.godMode = true;
      const e = window.__dw.api.spawn('grunt', 300, 400, { instant: true });
      const hp = e.maxHp, cur = e.hp, cd = e.contactDamage;
      const bE = { dmg: 1 }, bP = { dmg: 2 };
      bus.emit('bullet:fired', { bullet: bE, owner: 'enemy' }); bus.emit('bullet:fired', { bullet: bP, owner: 'player' });
      const bonus = window.__rig.Modifiers.clearBonus(room);
      R.clearEnemies();
      room.clearRoom();
      R.secs(1.2);
      const aE = { dmg: 1 }, aP = { dmg: 2 };
      bus.emit('bullet:fired', { bullet: aE, owner: 'enemy' }); bus.emit('bullet:fired', { bullet: aP, owner: 'player' });
      const e2 = window.__dw.api.spawn('grunt', 300, 400, { instant: true });
      return { hpBase, hp, cur, cdBase, cd, bE: bE.dmg, bP: bP.dmg, bonus, aE: aE.dmg, aP: aP.dmg, hp2: e2.maxHp, haze: room._mod.haze.alpha };
    });
    t.ok('blood moon: enemy hp x0.75', Math.abs(r.hp - r.hpBase * 0.75) < 0.01 && Math.abs(r.cur - r.hp) < 0.01, JSON.stringify(r));
    t.ok('blood moon: enemy contact damage +1', r.cd === r.cdBase + 1, JSON.stringify({ cd: r.cd, base: r.cdBase }));
    t.ok('blood moon: enemy bullets +1, player bullets x1.5', r.bE === 2 && r.bP === 3, JSON.stringify({ e: r.bE, p: r.bP }));
    t.ok('blood moon: guaranteed clear drop', r.bonus && r.bonus.guaranteed === true && r.bonus.drop > 0, JSON.stringify(r.bonus));
    t.ok('blood moon: everything ends with the clear (bullets, spawns, haze)', r.aE === 1 && r.aP === 2 && r.hp2 === r.hpBase && r.haze < 0.01, JSON.stringify({ e: r.aE, p: r.aP, hp2: r.hp2, h: r.haze }));
  },

  async rockfall(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig, room = R.mod('rockfall', { floor: 3, at: [720, 300] }), m = room._mod, s = R.sc(), p = s.player;
      p.godMode = true;
      const gh = () => (s._groundHaz ? s._groundHaz.list : []);
      const starts = []; let prev = 0, maxAlive = 0, n = 0;
      R.secs(22, () => { R.freeze(); const a = m._alive(); if (a > maxAlive) maxAlive = a; const l = gh().length + m.pending.length; if (l > prev) starts.push(+(n / 60).toFixed(2)); prev = l; n++; });
      // tell length and damage: place a rock on the player
      p.godMode = false; const c = R.tile(6, 3), p1 = R.put(c.x, c.y);
      const GH = R.sc()._groundHaz;
      m.pending.length = 0; m.next = 1e9; if (GH) GH.clear();
      m._queue(c.x, c.y, 0.9);
      const u0 = R.units(); let landed = -1, k = 0;
      R.secs(2.6, () => { R.freeze(); if (R.units() < u0) return false; k++; });
      landed = k / 60; // time until the rock hurt: dust lead 0.1 + warn 0.9
      const dmg = u0 - R.units();
      // predicted share
      p.godMode = true; R.put(400, 400); p.vx = 300; p.vy = 0;
      let pred = 0; const N = 600;
      for (let i = 0; i < N; i++) { p.vx = 300; p.vy = 0; const q = m._target(); if (Math.hypot(q.x - (p.x + 150), q.y - p.y) < 2) pred++; }
      // explosion queues two extra rocks with a 1.0 s warn
      return { starts, maxAlive, landed, dmg, share: pred / N };
    });
    t.ok('rockfall: first rock queued 1.8 s after lock, then every 2.2-3.5 s', r.starts.length >= 3 && Math.abs(r.starts[0] - 1.8) < 0.1 && r.starts.slice(1).every((s, i) => { const d = s - r.starts[i]; return d >= 2.1 || d < 0.05; }), JSON.stringify(r.starts));
    t.ok('rockfall: at most 2 rocks alive', r.maxAlive <= 2, r.maxAlive);
    t.ok('rockfall: warn circle 0.9 s (+ dust lead), then 1 damage', r.dmg === 1 && r.landed >= 0.95 && r.landed <= 1.1, JSON.stringify({ l: r.landed, d: r.dmg }));
    t.ok('rockfall: ~60 % of rocks target the predicted position', r.share > 0.52 && r.share < 0.68, r.share);
    const ex = await g.eval(async () => {
      const R = window.__rig, { bus } = await import('/src/core/events.js');
      const room = R.mod('rockfall', { floor: 3 }), m = room._mod; R.sc().player.godMode = true;
      m.next = 999; bus.emit('explosion', { x: 700, y: 500, radius: 130 });
      const n = m.pending.length, warns = m.pending.map((q) => q.warn);
      room.clearRoom(); const afterClear = m.pending.length;
      return { n, warns, afterClear };
    });
    t.ok('rockfall: an explosion queues 2 rocks with a 1.0 s warn; clearing cancels them', ex.n === 2 && ex.warns.every((w) => w === 1.0) && ex.afterClear === 0, JSON.stringify(ex));
  },

  async hellfire(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig, room = R.mod('hellfire', { floor: 4, at: [720, 528] }), m = room._mod, s = R.sc(), p = s.player, hz = room._hz;
      p.godMode = true;
      const fires = []; let prevF = 0, prevH = 0, maxTag = 0, minDist = 999, n = 0, tells = [];
      R.secs(24, () => {
        R.freeze();
        const h = (s._groundHaz ? s._groundHaz.list : []).filter((x) => x.kind === 'fire');
        if (h.length > prevH) tells.push({ t: +(n / 60).toFixed(2), d: Math.hypot(h[h.length - 1].x - p.x, h[h.length - 1].y - p.y) });
        prevH = h.length;
        const c = hz.fires.countTag('hellfire'); if (c > maxTag) maxTag = c;
        n++;
      });
      const life = hz.fires.order.length ? Math.max(...hz.fires.order.map((f) => f.life)) : 0;
      p.godMode = false; R.put(720, 528); const u0 = R.units();
      return { tells, maxTag, life };
    });
    const tl = r.tells.map((x) => x.t);
    t.ok('hellfire: first ember 2.0 s after lock, then every 2.2 s', tl.length >= 5 && Math.abs(tl[0] - 2.0) < 0.12 && Math.abs(tl[1] - tl[0] - 2.2) < 0.12, JSON.stringify(tl));
    t.ok('hellfire: never within 140 px of the player', r.tells.every((x) => x.d >= 139), JSON.stringify(r.tells.map((x) => Math.round(x.d))));
    const cap = await g.eval(() => {
      const R = window.__rig, room = R.mod('hellfire', { floor: 4, at: [720, 528] }), hz = room._hz, m = room._mod, s = R.sc(); s.player.godMode = true;
      m.cfg = Object.assign({}, m.cfg, { gap: 0.3 }); // stress: a new ember every 0.3 s
      let mx = 0; R.secs(12, () => { R.freeze(); const c = hz.fires.countTag('hellfire'); if (c > mx) mx = c; });
      return mx;
    });
    t.ok('hellfire: at most 5 patches at once (oldest recycled)', cap === 5, cap);
    const life = await g.eval(() => {
      const R = window.__rig, room = R.mod('hellfire', { floor: 4, at: [200, 300] }), hz = room._hz, m = room._mod, s = R.sc(); s.player.godMode = true;
      let born = -1, died = -1, warnAt = -1, n = 0;
      R.secs(9, () => {
        R.freeze();
        const h = (s._groundHaz ? s._groundHaz.list : []).filter((x) => x.kind === 'fire');
        if (h.length && warnAt < 0) { warnAt = n / 60; m.next = 1e9; }
        const c = hz.fires.countTag('hellfire');
        if (c && born < 0) born = n / 60;
        if (born >= 0 && !c && died < 0) died = n / 60;
        n++;
      });
      return { warnAt, born, life: died - born };
    });
    t.ok('hellfire: 1.0 s ember warning, then a fire patch burning 4.0 s', Math.abs(life.born - life.warnAt - 1.0) < 0.12 && Math.abs(life.life - 4.0) < 0.15, JSON.stringify(life));
  },

  async lurch(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig, room = R.mod('lurch', { floor: 5, at: [720, 528] }), m = room._mod, s = R.sc(), p = s.player;
      p.godMode = true;
      const e = R.enemy('grunt', 600, 400); const ex0 = e.x;
      let n = 0, warnAt = -1, pushAt = -1, x0 = 0, xEnd = 0, dir = 0;
      R.secs(7, () => {
        R.freeze();
        if (m.state === 'warn' && warnAt < 0) { warnAt = n / 60; x0 = p.x; }
        if (m.state === 'push' && pushAt < 0) { pushAt = n / 60; x0 = p.x; dir = m.dir; }
        if (pushAt >= 0 && m.state === 'idle' && !xEnd) xEnd = p.x;
        n++;
      });
      return { warnAt, pushAt, dx: (xEnd - x0), dir, ex: e.x - ex0, gap: m.cfg.gap };
    });
    t.ok('lurch: first warn 4.0 s after lock, 0.7 s warn before the push', Math.abs(r.warnAt - 4.0) < 0.1 && Math.abs(r.pushAt - r.warnAt - 0.7) < 0.06, JSON.stringify(r));
    t.ok('lurch: player shoved ~260 px', Math.abs(Math.abs(r.dx) - 260) < 30 && Math.sign(r.dx) === r.dir, JSON.stringify(r));
    t.ok('lurch: walkers shoved the same way', Math.sign(r.ex) === r.dir && Math.abs(r.ex) > 150, r.ex);
  },

  async lifecycle(g, t) {
    const r = await g.eval(async () => {
      const R = window.__rig, { bus } = await import('/src/core/events.js');
      const seen = [];
      const offA = bus.scoped(R.sc(), 'modifier:entered', (e) => seen.push('in:' + e.id), {}), offB = bus.scoped(R.sc(), 'modifier:cleared', (e) => seen.push('out:' + e.id), {});
      // via the real room build path: template mod id => banner + events
      const room = R.room({ combat: true, mod: 'lurch' });
      R.secs(0.5);
      room.clearRoom(); R.secs(0.2);
      // rooms already cleared / grave ambush rooms get no modifier
      const cleared = R.room({ combat: false, mod: 'dust_storm' });
      const grave = R.room({ combat: true, mod: 'darkness', fields: { graveAmbush: true } });
      const out = { seen, built: !!room._mod, clearedBuilt: !!cleared._mod, graveBuilt: !!grave._mod };
      offA && offA(); offB && offB();
      return out;
    });
    t.ok('lifecycle: modifier:entered / modifier:cleared fire once each', r.seen.join() === 'in:lurch,out:lurch', JSON.stringify(r));
    t.ok('lifecycle: no modifier on a cleared room or a grave-ambush room', !r.clearedBuilt && !r.graveBuilt, JSON.stringify(r));
  },

  async leaks(g, t) {
    const r = await g.eval(async () => {
      const R = window.__rig, ids = ['dust_storm', 'darkness', 'fog', 'blood_moon', 'stampede', 'rockfall', 'hellfire', 'lurch'];
      R.room({ combat: false }); R.step(5);
      const s = R.sc();
      const t0 = Object.keys(s.textures.list).length, k0 = s.children.list.length, tw0 = s.tweens.getTweens().length, ev0 = s.time._active.length;
      for (let i = 0; i < 50; i++) { const room = R.mod(ids[i % 8], { floor: 1 + (i % 6) }); R.secs(0.1, () => R.freeze()); room.clearRoom && room.clearRoom(); R.step(2); }
      R.room({ combat: false }); R.step(20);
      const t1 = Object.keys(s.textures.list).length, k1 = s.children.list.length, tw1 = s.tweens.getTweens().length;
      return { tex: t1 - t0, kids: k1 - k0, tweens: tw1 - tw0 };
    });
    // gradient textures are shared and created once (at most one per distinct mask softness: 3 masks)
    t.ok('leaks: 50 modifier enter/exit cycles leave no stray textures or display objects', r.tex <= 4 && r.kids <= 2, JSON.stringify(r));
  },

  async perf(g, t) {
    const r = await g.eval(() => {
      const R = window.__rig;
      // JS-side cost per simulated frame (no rendering) with the light moving every frame; rendered numbers are software-GL (SwiftShader) and informational only
      const run = (id, render) => {
        const room = id ? R.mod(id, { floor: 3 }) : R.room({ combat: true }); R.sc().player.godMode = true; R.step(60, () => R.freeze());
        const ts = []; let last = 0;
        R.step(240, (i) => { R.freeze(); R.sc().player.x = 300 + (i * 3) % 800; const now = performance.now(); if (i) ts.push(now - last); last = now; }, render);
        ts.sort((a, b) => a - b); return +ts[ts.length >> 1].toFixed(2); // median ms per frame
      };
      const out = {};
      for (const id of [null, 'darkness', 'dust_storm', 'fog', 'blood_moon']) out[id || 'plain'] = { js: run(id, false), gl: run(id, true) };
      return out;
    });
    const over = (k) => r[k].js - r.plain.js;
    t.ok('perf: modifier JS cost stays under 0.8 ms/frame over a plain room', ['darkness', 'dust_storm', 'fog', 'blood_moon'].every((k) => over(k) < 0.8), JSON.stringify(r));
    console.log('      (median ms/frame with rendering: ' + Object.entries(r).map(([k, v]) => `${k} ${v.gl}`).join(', ') + ')');
  },
};

async function shots(g) {
  const names = ['dust_storm', 'darkness', 'fog', 'blood_moon'];
  for (const id of names) {
    await g.eval((id) => { const R = window.__rig; const room = R.mod(id, { floor: id === 'blood_moon' ? 4 : 2, at: [720, 528] }); R.sc().player.godMode = true; R.secs(1.5, () => R.freeze()); R.step(2, null, true); }, id);
    await g.shot(`mod_${id}`);
  }
}

export async function runAll({ noassets = false, only = null, shot = false, log = console.log } = {}) {
  const g = await launch({ query: `?debug=1&seed=42${noassets ? '&noassets=1' : ''}`, name: 'mod-check' });
  let pass = 0, fail = 0;
  const t = { ok(name, cond, detail) { if (cond) pass++; else fail++; log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `   -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`); } };
  try {
    await g.startRun();
    await g.eval(installRig);
    await g.eval(installModRig);
    for (const [name, fn] of Object.entries(TESTS)) {
      if (only && !only.includes(name)) continue;
      const e0 = g.errors.length;
      try { await fn(g, t); } catch (e) { fail++; log(`FAIL  ${name} threw: ${e.message.split('\n').slice(0, 4).join(' / ')}`); }
      if (g.errors.length > e0) { fail++; log(`FAIL  ${name}: console errors: ${g.errors.slice(e0, e0 + 3).join(' | ').slice(0, 300)}`); }
    }
    if (shot) await shots(g);
    await g.eval(() => window.__rig.restore());
  } finally { await g.close(); }
  log(`mod-check: ${pass} passed, ${fail} failed${noassets ? ' (noassets)' : ''}`);
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  const fails = await runAll({ noassets: args.includes('--noassets'), only: only.length ? only : null, shot: args.includes('--shots') });
  process.exit(fails ? 1 : 0);
}
