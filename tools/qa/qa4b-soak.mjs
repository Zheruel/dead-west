// QA-4b soak: node tools/qa/qa4b-soak.mjs [simMinutes=10] [fuzzSeed=1] [char=gunslinger] [mode=normal]
// Fast-forward random play on floors 4-6 (cycles floors, tours rooms, spawns enemies/bosses, clears rooms), god mode ~90% of the time, deaths -> R retry.
// Samples JS heap (forced GC) + object counts every sim-minute/2; reports growth vs first steady sample (t=1 min) and errors.
import { open, PROBE, fmt, sleep } from './qa4-lib.mjs';
const simMin = +(process.argv[2] || 10), fseed = +(process.argv[3] || 1), char = process.argv[4] || 'gunslinger', mode = process.argv[5] || 'normal';
const g = await open(`?debug=1&seed=${40 + fseed}&char=${char}&mode=${mode}`, { name: 'qa4b-soak' });
await g.startRun(); await g.installFF();
await g.eval((fseed) => {
  let a = fseed >>> 0; window.__rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__ev = { teleport: 0, spawn: 0, boss: 0, floor: 0, item: 0, clear: 0, die: 0, other: 0, pocket: 0 };
  window.__step = (i) => {
    const w = window.__dw; if (!w) return; const R = window.__rnd, sc = w.scene, p = sc.player; if (!p || p.dead) return;
    if (i % 12 === 0) {
      const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]]; const m = dirs[Math.floor(R() * dirs.length)];
      const aims = [null, null, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
      sc.gameInput.override = { move: { x: m[0], y: m[1] }, aim: aims[Math.floor(R() * aims.length)] };
      if (R() < 0.12) sc.gameInput.press('roll'); if (R() < 0.05) sc.gameInput.press('dyn'); if (R() < 0.08) sc.gameInput.press('active');
    }
  };
  window.__event = async () => {
    const w = window.__dw; if (!w) return; const R = window.__rnd, api = w.api, sc = w.scene, p = sc.player, E = window.__ev;
    if (!p || p.dead || sc.transitioning || sc.cutscene) return;
    const reg = await import('/src/enemies/registry.js'), items = await import('/src/items/index.js');
    const r = R(); api.godMode(R() < 0.9); if (R() < 0.3) { api.heal(); api.give(30); }
    if (r < 0.32) { const rooms = sc.roomMgr.floor.rooms; api.teleport(rooms[Math.floor(R() * rooms.length)].id); E.teleport++; }
    else if (r < 0.5) { const ids = Object.keys(reg.ENEMY_META); for (let k = 0, n = 1 + Math.floor(R() * 3); k < n; k++) api.spawn(ids[Math.floor(R() * ids.length)], 200 + R() * 1000, 260 + R() * 560); E.spawn++; }
    else if (r < 0.56) { api.bossRoom(); E.boss++; }
    else if (r < 0.62) { api.setFloor(4 + Math.floor(R() * 3)); E.floor++; }
    else if (r < 0.68) { if (p.items.length < 25) { const all = items.allItems(); api.giveItem(all[Math.floor(R() * all.length)].id); } E.item++; }
    else if (r < 0.8) { api.clearRoom(); E.clear++; }
    else if (r < 0.82) { api.godMode(false); api.die(); E.die++; }
    else if (r < 0.86 && sc.roomMgr.floor.xroads && !sc.roomMgr.inPocket) { api.bossRoom(); api.openGate(); api.enterCrossroads(); E.pocket++; }
    else { if (R() < 0.5) api.killAll(); else api.openAll(); E.other++; }
  };
});
await g.eval(() => window.__dw.api.setFloor(4)); await sleep(1500);
const errs = () => g.errors.filter((e) => !/favicon/.test(e));
const rows = []; let simT = 0, fail = null, deaths = 0, maxCh = 0, nextSample = 30;
const EXT = () => { const r = window.__game.renderer; const c = (o) => (o ? (Array.isArray(o) ? o.length : o.size != null ? o.size : Object.keys(o).length) : -1); return { glTex: c(r.glTextureWrappers), glFb: c(r.glFramebufferWrappers), glBuf: c(r.glBufferWrappers) }; };
const sample = async (label) => {
  const heap = await g.heap(); const p = await g.eval(PROBE), e = await g.eval(EXT);
  const row = { label, heap: heap, busTotal: p.busTotal, gev: p.gev, tex: p.tex, ...e, ch: Object.values(p.scenes).reduce((s, v) => s + v.ch, 0), tw: Object.values(p.scenes).reduce((s, v) => s + v.tw, 0) };
  rows.push(row); console.log(label, fmt(heap), JSON.stringify({ ...row, heap: undefined, label: undefined }), 'sim', simT); return { row, p };
};
await sample('t0');
while (simT < simMin * 60 && !fail) {
  const ended = await g.eval(() => window.__game.scene.isActive('End'));
  if (ended) {
    deaths++; await g.eval(() => window.__wake()); await sleep(2500); await g.tap('KeyR', 80);
    await g.page.waitForFunction(() => window.__game.scene.isActive('Game') && window.__dw && window.__dw.player && !window.__dw.player.dead, { timeout: 30000 }).catch(() => { fail = 'restart after death failed'; });
    await sleep(800); await g.eval(() => window.__ff && window.__ff(1)); await g.eval(() => window.__dw && window.__dw.api.setFloor(4 + Math.floor(window.__rnd() * 3))).catch(() => {}); await sleep(1200); continue;
  }
  try { await g.eval(async () => { await window.__event(); window.__ff(150, (i) => window.__step(i)); }); } catch (e) { fail = 'eval threw: ' + String(e.message).slice(0, 200); break; }
  simT += 2.5;
  const st = await g.eval(() => { if (!window.__dw) return null; const s = window.__dw.scene, p = s.player; return { x: p.x, y: p.y, hp: p.hp, ne: s.enemies.length, nb: s.bullets.count, ch: s.children.list.length, floor: s.floorNum, tr: s.transitioning, cut: !!s.cutscene }; });
  if (!st) continue;
  for (let k = 0; k < 45 && (st.tr || st.cut) && !fail; k++) { await g.eval(() => window.__wake()); await sleep(700); Object.assign(st, await g.eval(() => { if (!window.__dw) return { tr: false, cut: false }; const s = window.__dw.scene; return { tr: s.transitioning, cut: !!s.cutscene }; })); if (k === 44 && (st.tr || st.cut)) fail = 'transition/cutscene never finished ' + JSON.stringify(st); }
  maxCh = Math.max(maxCh, st.ch);
  if (![st.x, st.y, st.hp].every(Number.isFinite)) fail = 'NaN player ' + JSON.stringify(st);
  else if (st.ne > 80) fail = 'runaway enemies ' + st.ne; else if (st.nb > 1500) fail = 'runaway bullets ' + st.nb; else if (st.ch > 4000) fail = 'runaway objects ' + st.ch;
  else if (errs().length) fail = 'console errors: ' + JSON.stringify(errs().slice(0, 3));
  if (simT >= nextSample) { nextSample += 30; await g.eval(() => window.__wake()); await sleep(300); await sample('t' + simT); await g.eval(() => window.__ff(1)); }
}
await g.eval(() => window.__wake()); await sleep(1500);
const last = await sample('final');
const base = rows.find((r) => r.label === 't60') || rows[1] || rows[0];
const pct = (a, b) => +(((b - a) / a) * 100).toFixed(1);
console.log('GROWTH t60->final', JSON.stringify({ heapPct: pct(base.heap, last.row.heap), heapMB: +((last.row.heap - base.heap) / 1048576).toFixed(2), bus: last.row.busTotal - base.busTotal, gev: last.row.gev - base.gev, tex: last.row.tex - base.tex, glTex: last.row.glTex - base.glTex, glFb: last.row.glFb - base.glFb, glBuf: last.row.glBuf - base.glBuf }));
console.log('GROWTH t0->final heapPct', pct(rows[0].heap, last.row.heap));
console.log('events', JSON.stringify(await g.eval(() => window.__ev).catch(() => null)), 'deaths', deaths, 'maxDisplayObjects', maxCh);
console.log('errors', errs().slice(0, 5), 'rej', (await g.rejections()).slice(0, 3), 'warns', [...new Set(g.warns.filter((w) => !/GL Driver|GPU stall/.test(w)))].slice(0, 8));
console.log(fail ? 'SOAK FAIL: ' + fail : `soak OK (${simT} sim-seconds)`);
await g.close(); process.exit(fail ? 1 : 0);
