// In-page fuzz / traversal engine for robustness QA (injected by rb-fuzz.mjs / rb-trav.mjs). Steps the Phaser game manually (game.loop stopped),
// so minutes of game time run in seconds. Rendering only every few steps. Records every exception (with a stack signature) and invariant violation.
(() => {
  if (window.__rb) return;
  const game = window.__game;
  const rb = (window.__rb = { errs: new Map(), viol: new Map(), nerr: 0, steps: 0, t: performance.now(), mode: 'fuzz', stats: {}, seed: 1 });
  const stat = (k, n = 1) => { rb.stats[k] = (rb.stats[k] || 0) + n; };
  const sig = (e) => (e && e.stack ? String(e.stack).split('\n').slice(0, 5).map((s) => s.trim().replace(/\?t=\d+/g, '').replace(/http:\/\/[^/]+/g, '')).join(' | ') : String(e));
  const recErr = (where, e) => { const k = where + ' :: ' + sig(e); rb.errs.set(k, (rb.errs.get(k) || 0) + 1); rb.nerr++; };
  const recViol = (k, extra) => { const e = rb.viol.get(k); if (e) e.n++; else rb.viol.set(k, { n: 1, extra }); };
  window.addEventListener('error', (e) => recErr('window.error', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => recErr('unhandledrejection', e.reason));
  const ce = console.error;
  console.error = (...a) => { recErr('console.error', a.map((x) => (x && x.stack) || String(x)).join(' ')); ce.apply(console, a); };

  // deterministic PRNG for the agent
  let S = 12345;
  const R = () => { S = (S + 0x6d2b79f5) | 0; let t = Math.imul(S ^ (S >>> 15), 1 | S); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  rb.seed = (n) => { S = n | 0; };
  const pick = (a) => a[Math.floor(R() * a.length)];
  const KC = { Space: 32, KeyE: 69, KeyQ: 81, Escape: 27, KeyP: 80, Enter: 13, KeyR: 82, KeyS: 83, KeyW: 87, Tab: 9, KeyA: 65, KeyD: 68, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, F1: 112, F2: 113, F3: 114, F4: 115, F5: 116, F6: 117, F7: 118 };
  const kev = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, keyCode: KC[code], which: KC[code], bubbles: true, cancelable: true }));
  const tap = (code) => { kev('keydown', code); kev('keyup', code); };
  rb.tap = tap; rb.kev = kev;

  // ---------------------------------------------------------------- manual stepping
  game.loop.stop();
  // Phaser's TweenManager measures Date.now() (wall clock), not the step delta -> drive a synthetic clock so tweens stay in sync with the manual steps
  let fakeNow = Date.now();
  Date.now = () => fakeNow;
  rb.step1 = (dt, render) => {
    const s = window.__dw && window.__dw.scene;
    if (s && s.fx) s.fx.hitStopUntil = 0;
    rb.t += dt;
    fakeNow += dt;
    rb.steps++;
    try {
      if (render) game.step(rb.t, dt);
      else {
        const ev = game.events;
        ev.emit('prestep', rb.t, dt); ev.emit('step', rb.t, dt);
        game.scene.update(rb.t, dt);
        ev.emit('poststep', rb.t, dt);
      }
    } catch (e) { recErr('step', e); }
  };

  const gs = () => window.__dw && window.__dw.scene;
  const activeKeys = () => game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key);
  const inGame = () => { const s = gs(); return s && game.scene.isActive('Game') && !s.paused && s.player && !s.ended; };

  // ---------------------------------------------------------------- floor graph helpers
  const DIRS = ['up', 'right', 'down', 'left'];
  const DOORP = { up: { x: 720, y: 172, dx: 0, dy: -1, tile: [6, 0], front: [6, 1] }, down: { x: 720, y: 884, dx: 0, dy: 1, tile: [6, 6], front: [6, 5] }, left: { x: 68, y: 528, dx: -1, dy: 0, tile: [0, 3], front: [1, 3] }, right: { x: 1372, y: 528, dx: 1, dy: 0, tile: [12, 3], front: [11, 3] } };
  const t2w = (c, r) => ({ x: 96 + c * 96 + 48, y: 192 + r * 96 + 48 });
  const w2t = (x, y) => ({ c: Math.floor((x - 96) / 96), r: Math.floor((y - 192) / 96) });
  function graphDir(s) { // next door dir on the shortest path from the current room to the boss room (BFS over the floor graph)
    const f = s.roomMgr.floor, cur = s.roomMgr.currentId;
    const q = [[cur, null]], seen = new Set([cur]);
    while (q.length) {
      const [id, first] = q.shift();
      if (id === f.bossId) return first;
      const rm = f.byId[id];
      for (const d of DIRS) { const dd = rm.doors[d]; if (!dd || seen.has(dd.to)) continue; if (dd.kind === 'secret' && !dd.revealed) continue; if (dd.kind === 'treasure') continue; seen.add(dd.to); q.push([dd.to, first || d]); }
    }
    return null;
  }
  function tilePath(room, from, to) { // 4-neighbour BFS over non-solid tiles; returns next tile or null
    const key = (c, r) => r * 13 + c;
    const prev = new Map([[key(from.c, from.r), null]]);
    const q = [from];
    while (q.length) {
      const n = q.shift();
      if (n.c === to.c && n.r === to.r) { let cur = n, p; while ((p = prev.get(key(cur.c, cur.r)))) { if (p.c === from.c && p.r === from.r) return cur; cur = p; } return cur; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = n.c + dx, r = n.r + dy;
        if (c < 0 || r < 0 || c >= 13 || r >= 7 || prev.has(key(c, r))) continue;
        const t = room.tiles[r][c];
        if (t.solid || t.type === 'spikes') continue;
        prev.set(key(c, r), n); q.push({ c, r });
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- agent
  const ENEMIES = ['coyote', 'rattlesnake', 'tumbleweed', 'outlaw', 'buzzard', 'possessed', 'skeleton', 'dynamiter', 'ghost', 'scarecrow', 'crow', 'miner', 'bat', 'mole', 'coffin', 'tumbleweed_mini', 'nope'];
  let moveT = 0, aimT = 0, mv = { x: 0, y: 0 }, am = null, pauseDwell = 0, pauseKind = '', stuckT = 0, lastPos = null, roomAge = 0, lastRoom = null, bossT = 0;
  rb.trail = [];
  rb.cfg = { keys: 1, api: 0.02, pause: 1, mortal: 0.15, goal: 0, noise: 0.3 };
  let mortalUntil = 0;

  function randInput(s) {
    moveT--; aimT--;
    if (moveT <= 0) { moveT = 10 + R() * 30; const a = R() * 6.283; mv = R() < 0.15 ? { x: 0, y: 0 } : { x: Math.cos(a), y: Math.sin(a) }; }
    if (aimT <= 0) { aimT = 15 + R() * 40; const a = pick([0, 1, 2, 3]) * 1.5708; am = R() < 0.3 ? null : { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) }; }
    return { move: mv, aim: am };
  }
  function goalInput(s) { // traverse: kill things in the room, then walk to the next door on the way to the boss, then fight boss, then the trapdoor
    const p = s.player, room = s.room;
    const noise = R() < rb.cfg.noise;
    if (!room) return randInput(s);
    const foes = s.enemies.filter((e) => e.alive && !e.noClear);
    const boss = s.enemies.find((e) => e.isBoss && e.alive);
    let aim = null;
    const tgt = foes.filter((e) => e.targetable !== false).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (tgt) { const dx = tgt.x - p.x, dy = tgt.y - p.y, l = Math.hypot(dx, dy) || 1; aim = { x: dx / l, y: dy / l }; }
    let move = { x: 0, y: 0 };
    const combat = room.mode === 'combat' || (boss && boss.active) || foes.length > 0;
    if (combat) {
      // orbit / dodge around the nearest enemy
      if (tgt) { const dx = tgt.x - p.x, dy = tgt.y - p.y, l = Math.hypot(dx, dy) || 1; const k = l < 260 ? -1 : l > 420 ? 1 : 0; const sgn = (Math.floor(s.run.time / 1.3) % 2) ? 1 : -1; move = { x: (dx / l) * k + (-dy / l) * sgn * 0.8, y: (dy / l) * k + (dx / l) * sgn * 0.8 }; const ml = Math.hypot(move.x, move.y) || 1; move = { x: move.x / ml, y: move.y / ml }; }
      roomAge += 1 / 60;
      if (roomAge > 45 && foes.length && !boss) { window.__dw.api.killAll(); stat('killAllTimeout'); }
    } else if (room.type === 'boss' && room.state.cleared && room.trapdoor) {
      const t = room.trapdoor; const dx = t.x - p.x, dy = t.y - p.y, l = Math.hypot(dx, dy) || 1; move = { x: dx / l, y: dy / l };
    } else {
      const dir = graphDir(s);
      if (dir) {
        const D = DOORP[dir], pt = w2t(p.x, p.y);
        const dt = w2t(D.x, D.y);
        const inside = pt.c >= 0 && pt.c < 13 && pt.r >= 0 && pt.r < 7;
        if (!inside) move = { x: D.dx, y: D.dy };
        else {
          const goal = { c: D.tile[0], r: D.tile[1] };
          const nx = tilePath(room, pt, goal);
          if (nx) { const w = (nx.c === goal.c && nx.r === goal.r) ? { x: D.x + D.dx * 40, y: D.y + D.dy * 40 } : t2w(nx.c, nx.r); const dx = w.x - p.x, dy = w.y - p.y, l = Math.hypot(dx, dy) || 1; move = { x: dx / l, y: dy / l }; }
          else move = { x: D.dx, y: D.dy };
        }
      }
    }
    if (noise) { const r = randInput(s); if (R() < 0.5) move = r.move; if (R() < 0.5) aim = r.aim; }
    // stuck detector (obstacle wedging etc.)
    if (lastPos && Math.hypot(p.x - lastPos.x, p.y - lastPos.y) < 0.4 && (move.x || move.y)) stuckT++; else stuckT = 0;
    lastPos = { x: p.x, y: p.y };
    if (stuckT > 240) { stuckT = 0; stat('stuck'); recViol('stuck>4s room=' + s.room.type + ' floor=' + s.floorNum + ' mode=' + s.room.mode, { x: p.x, y: p.y, en: s.enemies.length }); p.teleport(720, 528); }
    return { move, aim };
  }

  const api = () => window.__dw.api;
  const ABUSE = [
    () => api().spawn(pick(ENEMIES), 150 + R() * 1140, 230 + R() * 600),
    () => api().spawn(pick(ENEMIES), 96 + 48, 192 + 48),
    () => api().spawn(pick(ENEMIES), 1344 - 10, 864 - 10), // hugging the wall corner
    () => { const s = gs(); const l = s.room ? s.room.tiles.flat().filter((t) => t.solid) : []; const t = l.length ? pick(l) : { x: 720, y: 528 }; api().spawn(pick(ENEMIES), t.x, t.y); }, // inside an obstacle
    () => { const s = gs(); const ids = s.roomMgr.floor.rooms.map((r) => r.id); api().teleport(pick(ids)); },
    () => api().bossRoom(),
    () => api().setFloor(1 + Math.floor(R() * 3)),
    () => api().nextFloor(),
    () => api().killAll(),
    () => api().clearRoom(),
    () => api().giveItem(pick(rb.itemIds)),
    () => api().randomPassive(),
    () => api().heal(),
    () => api().hurt(1 + Math.floor(R() * 3)),
    () => api().give(99),
    () => api().openAll(),
    () => api().revealMap(),
    () => api().state(),
    () => { const s = gs(); const p = s.player; p.placeDynamite(); },
    () => { const s = gs(); const p = s.player; if (p.active) { p.active.charge = p.active.max; p.useActive(); } },
    () => { const s = gs(); s.slowMo(R() * 0.5 + 0.1, 1 + R()); },
    () => { const s = gs(); const r = s.room; if (r) { const d = pick(Object.keys(r.doors)); s.roomMgr.transition(d); } },
    () => { const s = gs(); s.roomMgr.descend(); },
    () => { const s = gs(); s.player.teleport(96 + R() * 1248, 192 + R() * 672); },
    () => { const s = gs(); s.player.teleport(pick([70, 1370, 720]), pick([172, 884, 528])); }, // doorways
    () => { const s = gs(); const b = s.enemies.find((e) => e.isBoss); if (b) b.hurt(b.maxHp * (0.1 + R() * 0.3), {}); },
    () => { const s = gs(); const b = s.enemies.find((e) => e.isBoss); if (b && R() < 0.15) b.hurt(1e9, {}); },
    () => { const s = gs(); const e = pick(s.enemies.length ? s.enemies : [null]); if (e) e.die({}); },
    () => { const s = gs(); const e = pick(s.enemies.length ? s.enemies : [null]); if (e) e.applyStatus(pick(['fear', 'stun', 'burn', 'poison', 'slow']), { t: 2, dps: 3 }); },
    () => { const s = gs(); s.player.addBuff('x' + Math.floor(R() * 5), (st) => { st.damage += 1; }, 3); },
    () => { const s = gs(); s.room && s.room.explodeAt(720, 528, 900); },
    () => { const s = gs(); s.bullets.enemy.ring({ x: 720, y: 400, speed: 300, damage: 1 }, 30); },
    () => { const s = gs(); for (let i = 0; i < 40; i++) s.bullets.player.fire({ x: s.player.x, y: s.player.y, angle: R() * 6.28, speed: 700, damage: 1, ricochet: 3, pierce: 3, homing: 1 }); },
  ];

  rb.agent = () => {
    const s = gs(); const act = activeKeys();
    if (act.includes('Boot')) return;
    if (act.includes('Menu')) { if (R() < 0.05) tap('Enter'); return; }
    if (act.includes('End')) { if (R() < 0.05) tap(R() < 0.9 ? 'KeyR' : 'Enter'); return; }
    if (act.includes('Pause')) {
      if (pauseDwell === 0) { pauseDwell = 5 + Math.floor(R() * 50); pauseKind = R() < 0.1 ? 'quit' : R() < 0.3 ? 'p' : 'esc'; }
      pauseDwell--;
      if (pauseDwell === 0) {
        if (pauseKind === 'quit') { tap('KeyS'); tap('KeyS'); tap('Enter'); tap('Enter'); stat('quitToMenu'); }
        else if (R() < 0.2 && s) { game.events.emit('focus'); tap(pauseKind === 'p' ? 'KeyP' : 'Escape'); } else tap(pauseKind === 'p' ? 'KeyP' : 'Escape');
        stat('unpause');
      }
      return;
    }
    if (!s || !s.player || !game.scene.isActive('Game')) return;
    pauseDwell = 0;
    const p = s.player;
    if (s.roomMgr.currentId !== lastRoom) { lastRoom = s.roomMgr.currentId; roomAge = 0; }
    // god mode schedule: mostly immortal, sometimes mortal windows
    if (rb.steps > mortalUntil) { const mortal = R() < rb.cfg.mortal; mortalUntil = rb.steps + (mortal ? 60 * (5 + R() * 20) : 60 * (20 + R() * 40)); p.godMode = !mortal; }
    const inp = rb.cfg.goal ? goalInput(s) : randInput(s);
    s.gameInput.override = inp;
    if (rb.cfg.keys) {
      if (R() < 0.03) tap('Space');
      if (R() < 0.012) tap('KeyE');
      if (R() < 0.012) tap('KeyQ');
      if (R() < 0.004) { kev('keydown', 'Space'); kev('keydown', 'KeyE'); kev('keydown', 'KeyQ'); kev('keyup', 'Space'); kev('keyup', 'KeyE'); kev('keyup', 'KeyQ'); stat('mash'); }
      if (R() < 0.001) { tap('Tab'); }
    }
    if (rb.cfg.pause) {
      const pr = R();
      if (pr < 0.0014) { tap(R() < 0.5 ? 'Escape' : 'KeyP'); stat('pauseKey'); rb.trail.push(rb.steps + ':pause'); }
      else if (pr < 0.002) { game.events.emit('blur'); stat('blur'); }
    }
    if (rb.cfg.api && R() < rb.cfg.api) { const fi = Math.floor(R() * ABUSE.length); const f = ABUSE[fi]; rb.trail.push(rb.steps + ':a' + fi); if (rb.trail.length > 40) rb.trail.shift(); try { f(); } catch (e) { recErr('api:' + f.toString().slice(0, 70), e); } }
  };

  // ---------------------------------------------------------------- invariants
  const finite = (v) => typeof v === 'number' && Number.isFinite(v);
  rb.check = () => {
    const s = gs();
    if (!s || !game.scene.isActive('Game') || !s.player) return;
    const p = s.player;
    if (![p.x, p.y, p.vx, p.vy, p.hp].every(finite)) recViol('player NaN', { x: p.x, y: p.y, hp: p.hp });
    if (!s.transitioning && (p.x < -50 || p.x > 1490 || p.y < 100 || p.y > 990)) recViol('player far outside', { x: p.x, y: p.y });
    for (const e of s.enemies) {
      if (!e.alive) { recViol('dead enemy in scene.enemies ' + e.id); continue; }
      if (!e.sprite) recViol('alive enemy w/o sprite ' + e.id);
      if (![e.x, e.y].every(finite)) { recViol('enemy NaN ' + e.id); continue; }
      if (!s.transitioning && (e.x < 40 || e.x > 1400 || e.y < 140 || e.y > 920)) recViol('enemy outside room ' + e.id, { x: Math.round(e.x), y: Math.round(e.y), state: e.state });
      const room = s.room;
      if (room && !e.flying && !e.ghost && e.spawnT <= 0 && !s.transitioning && !e.isBoss) {
        const t = w2t(e.x, e.y);
        const T = room.tiles[t.r] && room.tiles[t.r][t.c];
        if (T && T.solid && room.age > 1) recViol('walker inside solid tile ' + e.id + ' ' + T.type, { x: Math.round(e.x), y: Math.round(e.y) });
      }
    }
    const room = s.room;
    if (room) for (const pk of room.pickups) {
      if (!pk.alive) continue;
      if (![pk.x, pk.y].every(finite) || pk.x < 96 - 30 || pk.x > 1344 + 30 || pk.y < 192 - 30 || pk.y > 864 + 30) recViol('pickup outside room ' + pk.type, { x: Math.round(pk.x), y: Math.round(pk.y) });
      else if (pk.settled && pk.basePrice == null) { let best = 1e9; for (const row of room.tiles) for (const T of row) { if (T.solid) continue; const dx = Math.max(Math.abs(pk.x - T.x) - 48, 0), dy = Math.max(Math.abs(pk.y - T.y) - 48, 0); best = Math.min(best, Math.hypot(dx, dy)); } if (best > 24) recViol('pickup unreachable (dist to walkable ' + Math.round(best) + ') ' + pk.type, { x: Math.round(pk.x), y: Math.round(pk.y) }); }
    }
    const ch = s.children.list.length;
    rb.maxChildren = Math.max(rb.maxChildren || 0, ch);
    if (ch > 2500) recViol('children>2500', { ch });
    if (s.bullets.count > 3000) recViol('bullets>3000', { n: s.bullets.count });
    if (s.dynamites.length > 40) recViol('dynamites>40', { n: s.dynamites.length });
    if (!(s.timeScale > 0) || !(s.enemyTimeScale > 0)) recViol('timescale', { ts: s.timeScale, ets: s.enemyTimeScale });
    if (s.transitioning && !rb.transSince) rb.transSince = rb.steps; else if (!s.transitioning) rb.transSince = 0;
    if (rb.transSince && rb.steps - rb.transSince > 60 * 6) { recViol('transitioning stuck >6s', { paused: s.paused, act: activeKeys().join(','), tw: s.tweens.getTweens().length, tm: s.time._active.length, fade: s.cameras.main.fadeEffect && s.cameras.main.fadeEffect.isRunning, lock: s.player.locked, dead: s.player.dead, ended: s.ended, trail: rb.trail.slice(-14).join(' ') }); rb.transSince = 0; }
    if (s.cutscene && !rb.cutSince) rb.cutSince = rb.steps; else if (!s.cutscene) rb.cutSince = 0;
    if (rb.cutSince && rb.steps - rb.cutSince > 60 * 12) { recViol('cutscene stuck >12s'); rb.cutSince = 0; }
  };

  rb.run = (n, { render = 8, dt = 1000 / 60, checkEvery = 20 } = {}) => {
    for (let i = 0; i < n; i++) {
      try { rb.agent(); } catch (e) { recErr('agent', e); }
      rb.step1(dt, i % render === 0);
      if (i % checkEvery === 0) { try { rb.check(); } catch (e) { recErr('check', e); } }
    }
    const s = gs();
    return { steps: rb.steps, nerr: rb.nerr, act: activeKeys().join(','), floor: s && s.floorNum, room: s && s.room && s.room.type, run: s && s.run && Math.round(s.run.time), dead: s && s.player && s.player.dead };
  };
  rb.report = () => ({ errs: [...rb.errs.entries()], viol: [...rb.viol.entries()], stats: rb.stats, nerr: rb.nerr, maxChildren: rb.maxChildren });
  rb.itemIds = [];
  import('/src/items/index.js').then((m) => { rb.itemIds = m.allItems().map((d) => d.id); });
  return rb;
})();
