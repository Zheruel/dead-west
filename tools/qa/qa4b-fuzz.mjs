// FUZZ: seeded random play in fast-forward (no rendering) -- random movement/aim/roll/dynamite/active use, plus random "events" every few seconds:
// teleport to random rooms, spawn random enemies (all registry ids), boss rooms, floor jumps, random items, kill-all, room clear, occasional death + restart.
// Fails on any console/page error or broken invariant (NaN player, runaway enemy/bullet/display-object counts).
//   node tools/qa/fuzz-run.mjs [simSeconds=600] [fuzzSeed=1] [gameSeed=42]
import { launch } from './harness.mjs';
import fs from 'node:fs';
const simSec = +(process.argv[2] || 600), fseed = +(process.argv[3] || 1), gseed = +(process.argv[4] || 42);
const g = await launch({ query: `?debug=1&seed=${gseed}&char=${process.env.FUZZ_CHAR||'gunslinger'}&mode=${process.env.FUZZ_MODE||'normal'}`, name: 'fuzz', quiet: true });
g.page.on('pageerror', () => {});
await g.startRun();
const HOOK = () => { const s = window.__dw && window.__dw.scene; if (!s || s.__hooked) return; s.__hooked = true; window.__clog = window.__clog || []; let v = s.cutscene;
  Object.defineProperty(s, 'cutscene', { get() { return v; }, set(x) { window.__clog.push({ t: Math.round(s.time.now), set: x, f: s.floorNum, st: new Error().stack.split('\n').slice(2, 4).map((l) => l.trim().replace(/^at /, '').replace(/\(?http:\/\/[^/]+/, '(').replace(/\?t=\d+/g, '')).join(' | ') }); if (window.__clog.length > 60) window.__clog.shift(); v = x; }, configurable: true }); };
g.hook = () => g.eval(HOOK).catch(() => {});
await g.hook();
await g.eval((fseed) => {
  const game = window.__game;
  window.__t = 100000;
  window.__ff = (n, cb) => {
    const scs = game.scene.getScenes(false);
    game.loop.sleep();
    const vis = scs.map((s) => s.sys.settings.visible);
    scs.forEach((s) => (s.sys.settings.visible = false));
    for (let i = 0; i < n; i++) { const gs = window.__dw && window.__dw.scene; if (gs && gs.fx) gs.fx.hitStopUntil = 0; if (cb) cb(i); window.__t += 16.667; game.step(window.__t, 16.667); }
    scs.forEach((s, k) => (s.sys.settings.visible = vis[k]));
  };
  window.__wake = () => game.loop.wake();
  let a = fseed >>> 0; window.__rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__ev = { teleport: 0, spawn: 0, boss: 0, floor: 0, item: 0, clear: 0, die: 0, other: 0 };
  window.__step = (i) => {
    const w = window.__dw; if (!w) return;
    const R = window.__rnd, sc = w.scene, p = sc.player;
    if (!p || p.dead) return;
    if (i % 12 === 0) { // new input
      const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]];
      const m = dirs[Math.floor(R() * dirs.length)];
      const aims = [null, null, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
      sc.gameInput.override = { move: { x: m[0], y: m[1] }, aim: aims[Math.floor(R() * aims.length)] };
      if (R() < 0.12) sc.gameInput.press('roll');
      if (R() < 0.05) sc.gameInput.press('dyn');
      if (R() < 0.08) sc.gameInput.press('active');
    }
  };
  window.__event = async () => {
    const w = window.__dw; if (!w) return;
    const R = window.__rnd, api = w.api, sc = w.scene, p = sc.player, E = window.__ev;
    if (!p || p.dead || sc.transitioning || sc.cutscene) return;
    const reg = await import('/src/enemies/registry.js'), items = await import('/src/items/index.js');
    const r = R();
    api.godMode(R() < 0.9); if (R() < 0.3) { api.heal(); api.give(30); }
    if (r < 0.25) { const rooms = sc.roomMgr.floor.rooms; api.teleport(rooms[Math.floor(R() * rooms.length)].id); E.teleport++; }
    else if (r < 0.5) { const ids = Object.keys(reg.ENEMY_META); for (let k = 0, n = 1 + Math.floor(R() * 3); k < n; k++) api.spawn(ids[Math.floor(R() * ids.length)], 200 + R() * 1000, 260 + R() * 560); E.spawn++; }
    else if (r < 0.58) { api.bossRoom(); E.boss++; }
    else if (r < 0.63) { api.setFloor(1 + Math.floor(R() * 3)); E.floor++; }
    else if (r < 0.75) { const all = items.allItems(); api.giveItem(all[Math.floor(R() * all.length)].id); E.item++; }
    else if (r < 0.85) { api.clearRoom(); E.clear++; }
    else if (r < 0.87) { api.godMode(false); api.die(); E.die++; }
    else { if (R() < 0.5) api.killAll(); else api.openAll(); E.other++; }
  };
}, fseed);

const errs = () => g.errors.filter((e) => !/favicon/.test(e));
let simT = 0, fail = null, deaths = 0, maxCh = 0, last = null, still = 0;
while (simT < simSec && !fail) {
  const ended = await g.eval(() => window.__game.scene.isActive('End'));
  if (ended) { // death poster -> restart with R (needs the loop awake + real keyboard)
    deaths++;
    await g.eval(() => window.__wake());
    await g.wait(2500); await g.tap('KeyR', 80);
    await g.page.waitForFunction(() => window.__game.scene.isActive('Game') && window.__dw && window.__dw.player && !window.__dw.player.dead, { timeout: 60000 }).catch(async () => {
      const diag = await g.eval(() => { const gm = window.__game; const e = gm.scene.getScene('End'); return { active: gm.scene.getScenes(true).map((x) => x.sys.settings.key), endReady: e && e.ready, endLeaving: e && e.leaving, endPage: e && e.page, dwScene: window.__dw && window.__dw.scene.sys.settings.key, gameActive: gm.scene.isActive('Game'), pdead: window.__dw && window.__dw.player && window.__dw.player.dead, loopRunning: gm.loop.running, hidden: document.hidden, ended: window.__dw && window.__dw.scene.ended, floor: window.__dw && window.__dw.scene.floorNum, mode: window.__dw && window.__dw.scene.run && window.__dw.scene.run.mode, seed: window.__dw && window.__dw.scene.seed }; });
      console.log('RESTART-DIAG', JSON.stringify(diag));
      await g.shot('qa4b-restart-fail');
      await g.tap('KeyR', 80); await g.wait(3000);
      const d2 = await g.eval(() => ({ active: window.__game.scene.getScenes(true).map((x) => x.sys.settings.key), pdead: window.__dw && window.__dw.player && window.__dw.player.dead }));
      console.log('RESTART-DIAG after 2nd R', JSON.stringify(d2));
      fail = 'restart after death failed ' + JSON.stringify(diag);
    });
    await g.wait(800);
    continue;
  }
  try {
    await g.eval(async () => { await window.__event(); window.__ff(150, (i) => window.__step(i)); });
  } catch (e) { fail = 'eval threw: ' + String(e.message).slice(0, 200); break; }
  simT += 2.5;
  await g.hook(); const st = await g.eval(() => { if (!window.__dw) return null; const s = window.__dw.scene, p = s.player; return { x: p.x, y: p.y, hp: p.hp, ne: s.enemies.length, nb: s.bullets.count, ch: s.children.list.length, floor: s.floorNum, room: s.roomMgr.currentId, tr: s.transitioning, cut: !!s.cutscene, mode: s.room && s.room.mode, locked: s.room && s.room.locked, plock: !!p.locked, ended: !!s.ended, sleeping: s.sys.isSleeping() }; });
  if (!st) continue; // run ended (GameScene shut down): loop top handles the death poster + restart
  // Phaser tweens run on wall-clock time, not on game.step deltas: door slides / cutscenes only finish while the loop is awake.
  for (let k = 0; k < 8 && (st.tr || st.cut) && !fail; k++) {
    await g.eval(() => window.__wake()); await g.wait(700);
    Object.assign(st, await g.eval(() => { if (!window.__dw) return { tr: false, cut: false }; const s = window.__dw.scene; return { tr: s.transitioning, cut: !!s.cutscene, x: s.player.x, y: s.player.y, room: s.roomMgr.currentId }; }));
    if (k === 7 && (st.tr || st.cut)) {
      for (let j = 0; j < 45 && (st.tr || st.cut); j++) { await g.eval(() => window.__wake()); await g.wait(1000); Object.assign(st, await g.eval(() => { const s = window.__dw.scene; return { tr: s.transitioning, cut: !!s.cutscene }; })); }
      const diag = await g.eval(() => { const s = window.__dw.scene, gm = window.__game; const b = s.enemies.find((e) => e.isBoss); const hud = gm.scene.getScene('HUD'); const cards = hud && hud.widgets.find((w) => w.holdUntil !== undefined); return { active: gm.scene.getScenes(true).map((x) => x.sys.settings.key), sleeping: gm.loop.running === false, boss: b ? { id: b.id, hp: b.hp, active: b.active, alive: b.alive, dying: b.dying, fightStarted: b.fightStarted, phase: b.phase } : null, introRelease: !!s._introRelease, holdUntil: cards && cards.holdUntil, holdFrom: cards && cards.holdFrom, holdSet: cards && cards.holdSet, hudNow: hud && hud.time.now, gameNow: s.time.now, paused: s.paused, room: s.roomMgr.currentId, type: s.room && s.room.type, pocket: s.roomMgr.inPocket, story: window.__game.__cutscene ? window.__game.__cutscene.state() : null, tim: s.time._active.length, fps: Math.round(gm.loop.actualFps), bossLive: cards && cards.bossLive, ended: s.ended, endingStarted: s.endingStarted, dead: s.player.dead, room2: s.room && { mode: s.room.mode, locked: s.room.locked, boss: !!s.room.boss, cleared: s.room.state.cleared } }; });
      console.log('STUCK-DIAG', JSON.stringify(diag)); console.log('CUTSCENE-SET-LOG', JSON.stringify(await g.eval(() => (window.__clog || []).slice(-14)), null, 0));
      if (st.tr || st.cut) fail = 'transition/cutscene never finished (5.6 s + 45 s real time) ' + JSON.stringify(st) + ' diag ' + JSON.stringify(diag);
    }
  }
  maxCh = Math.max(maxCh, st.ch);
  if (last && Math.hypot(st.x - last.x, st.y - last.y) < 0.5 && st.room === last.room) still++; else still = 0;
  last = st;
  if (still >= 6) fail = 'player did not move for ' + still * 2.5 + ' sim-seconds ' + JSON.stringify(st);
  if (![st.x, st.y, st.hp].every(Number.isFinite)) fail = 'NaN player state ' + JSON.stringify(st);
  else if (st.ne > 80) fail = 'runaway enemies ' + st.ne;
  else if (st.nb > 1500) fail = 'runaway bullets ' + st.nb;
  else if (st.ch > 4000) fail = 'runaway display objects ' + st.ch;
  else if (errs().length) fail = 'console errors: ' + JSON.stringify(errs().slice(0, 3));
  if (simT % 60 === 0 || simT === 2.5) console.log(`t=${simT}s`, JSON.stringify(st), 'deaths', deaths);
}
console.log('events', JSON.stringify(await g.eval(() => window.__ev).catch(() => null)), 'deaths', deaths, 'maxDisplayObjects', maxCh);
console.log(fail ? 'FUZZ FAIL: ' + fail : `fuzz OK (${simT} sim-seconds, seed ${fseed})`);
await g.close();
process.exit(fail ? 1 : 0);
