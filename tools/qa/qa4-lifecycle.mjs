// QA-4 lifecycle: tab hide/resume (visibilitychange + blur), pause mid boss-intro / interlude / cutscene / trapdoor descent, resize (4:3, 16:10, portrait, tiny), rapid ESC spam.
import { open, sleep } from './qa4-lib.mjs';
const g = await open('?debug=1&seed=42&char=gunslinger&unlockall=1', { name: 'qa4-life' });
const issues = []; const note = (s) => { issues.push(s); console.log('ISSUE', s); };
const chk = async (label) => { const e = g.errors.filter((x) => !/favicon/.test(x)); if (e.length) { note(`${label}: console errors ${JSON.stringify(e.slice(0, 2)).slice(0, 300)}`); g.errors.length = 0; } const r = await g.rejections(); if (r.length) { note(`${label}: rejection ${r[0].slice(0, 200)}`); await g.eval(() => (window.__rej = [])); } };
const st = () => g.eval(() => { const s = window.__dw && window.__dw.scene; if (!s) return { none: true, act: window.__game.scene.getScenes(true).map((x) => x.sys.settings.key) }; const b = s.enemies.find((e) => e.isBoss); return { paused: s.paused, tr: s.transitioning, cut: !!s.cutscene, act: window.__game.scene.getScenes(true).map((x) => x.sys.settings.key).join(','), hp: s.player.hp, px: Math.round(s.player.x), py: Math.round(s.player.y), time: +(s.run.time || 0).toFixed(2), boss: b ? { hp: b.hp, active: b.active, ph: b.phase } : null, floor: s.floorNum, sleeping: s.sys.isSleeping(), loopSleep: window.__game.loop.running === false }; });
await g.startRun(); await g.installFF(); await chk('start');
// ---------- 1. tab hide / resume
const setVis = (hidden) => g.eval((hidden) => { Object.defineProperty(document, 'hidden', { value: hidden, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: hidden ? 'hidden' : 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event(hidden ? 'blur' : 'focus')); }, hidden);
await g.eval(() => { window.__dw.api.godMode(true); window.__dw.api.spawn('outlaw', 900, 500); window.__dw.api.spawn('bat', 700, 400); });
await sleep(500);
const s0 = await st();
await setVis(true); await sleep(6000); const s1 = await st();
console.log('hidden 6s:', JSON.stringify(s0), '->', JSON.stringify(s1));
if (s1.paused !== true && !s1.none) note('tab hide: game not auto-paused (autoPause default true) ' + JSON.stringify(s1));
if (Math.abs(s1.time - s0.time) > 1.5) note('tab hide: run timer advanced ' + (s1.time - s0.time) + ' during hidden');
await setVis(false); await sleep(1500); const s2 = await st(); console.log('visible again:', JSON.stringify(s2));
await chk('vis');
// resume via ESC
if (s2.paused) { await g.tap('Escape'); await sleep(800); const s3 = await st(); console.log('after ESC:', JSON.stringify(s3)); if (s3.paused) note('pause: ESC does not resume after tab return'); }
// long hidden with no autoPause: dt clamp - simulate a 30 s stall
await g.eval(() => { const s = window.__dw.scene; window.__stallAt = performance.now(); });
const before = await st();
await g.eval(() => { const g = window.__game; g.loop.sleep(); }); await sleep(3000); await g.eval(() => window.__game.loop.wake()); await sleep(1500);
const after = await st(); console.log('loop sleep/wake 3s:', JSON.stringify(before), '->', JSON.stringify(after));
if (after.hp < before.hp && !before.paused) note('loop stall: hp dropped ' + before.hp + '->' + after.hp + ' (god mode on, unexpected)');
await chk('stall');
// ---------- 2. pause mid boss intro
await g.eval(() => { window.__dw.api.godMode(true); window.__dw.api.setFloor(1); }); await sleep(1500);
await g.eval(() => window.__dw.api.bossRoom()); await sleep(700);
const bi = await st(); console.log('boss intro state', JSON.stringify(bi));
await g.tap('Escape'); await sleep(600); const bp = await st(); console.log('paused in intro', JSON.stringify(bp));
await sleep(3000); const bp2 = await st(); if (JSON.stringify(bp.boss) !== JSON.stringify(bp2.boss)) note('paused boss intro: boss state changed while paused ' + JSON.stringify([bp.boss, bp2.boss]));
await g.tap('Escape'); await sleep(800);
let ok = false; for (let i = 0; i < 20 && !ok; i++) { await sleep(1000); const s = await st(); ok = s.boss && s.boss.active && !s.cut; }
if (!ok) note('boss intro never finished after pause/resume ' + JSON.stringify(await st()));
await g.eval(() => window.__dw.api.killAll()); await sleep(2500);
// blur during boss intro
await g.eval(() => window.__dw.api.setFloor(2)); await sleep(1200); await g.eval(() => window.__dw.api.bossRoom()); await sleep(400);
await setVis(true); await sleep(1500); await setVis(false); await sleep(600); await g.tap('Escape'); await sleep(600);
ok = false; for (let i = 0; i < 20 && !ok; i++) { await sleep(1000); const s = await st(); ok = s.boss && s.boss.active && !s.cut && !s.paused; }
if (!ok) note('boss intro after blur+resume stuck ' + JSON.stringify(await st()));
await chk('boss-intro');
await g.eval(() => window.__dw.api.killAll()); await sleep(1500);
// ---------- 3. pause mid interlude / descent chain / overlay cutscene
for (const from of [3, 5, 1]) {
  await g.eval((f) => { const a = window.__dw.api; a.godMode(true); a.setFloor(f); }, from); await sleep(1500);
  await g.eval(() => { window.__dw.api.clearRoom(); }); await sleep(300);
  await g.eval(() => window.__dw.scene.roomMgr.descend()); await sleep(2200);
  const d0 = await st(); console.log(`descend from F${from} ->`, JSON.stringify(d0));
  await g.tap('Escape'); await sleep(1200); const d1 = await st(); console.log('  ESC ->', JSON.stringify(d1));
  await sleep(2500); await g.tap('Escape'); await sleep(800);
  let done = false; for (let i = 0; i < 40 && !done; i++) { await sleep(1000); const s = await st(); if (s.paused) { await g.tap('Escape'); await sleep(500); } done = s.floor === from + 1 && !s.tr && !s.cut && !s.paused && s.act.includes('Game') && !s.act.includes('Cutscene'); }
  const d2 = await st(); console.log('  end ->', JSON.stringify(d2)); if (!done) note(`descent F${from}->${from + 1} did not complete after pause mid-chain ` + JSON.stringify(d2));
  // movement works?
  await g.hold('ArrowRight', 400); const d3 = await st(); if (d3.px === d2.px && !d3.tr) note(`after descent F${from} player cannot move ` + JSON.stringify([d2, d3]));
  await chk('descend' + from);
}
// overlay cutscene, all ids, ESC + skip
const ids = await g.eval(async () => (await import('/src/data/story/cutscenes.js')).CUTSCENE_IDS);
for (const id of ids.slice(0, 20)) {
  await g.eval((id) => { const s = window.__dw.scene; s.run.mode = 'normal'; window.__cs = false; import('/src/scenes/flow.js').then((f) => f.playCutscene(s, id, f.cutsceneCtx(s), () => (window.__cs = true))); }, id);
  await sleep(1500); await g.tap('Escape'); await sleep(700); const c1 = await st();
  for (let i = 0; i < 30; i++) { const d = await g.eval(() => window.__cs); if (d) break; await g.tap('Enter', 40); await sleep(400); if (i === 15) await g.tap('Escape'); }
  const d = await g.eval(() => window.__cs); await sleep(600); const c2 = await st();
  if (!d) note(`cutscene ${id}: overlay never completed (state ${JSON.stringify(c2)})`);
  if (c2.paused || c2.act.includes('Pause') || c2.act.includes('Cutscene')) { note(`cutscene ${id}: pause/cutscene left active ${c2.act} paused=${c2.paused}`); await g.tap('Escape'); await sleep(500); }
  await chk('cutscene-' + id);
}
// ---------- 4. ESC spam / pause + quit
for (let i = 0; i < 30; i++) { await g.tap('Escape', 20); await sleep(40); } await sleep(800); const e1 = await st(); console.log('after 30 ESC:', JSON.stringify(e1));
if (e1.paused) { await g.tap('Escape'); await sleep(600); }
await chk('esc-spam');
// ---------- 5. resize
const sizes = [[1024, 768, '4:3'], [1440, 900, '16:10'], [1920, 1080, '16:9'], [800, 1200, 'portrait'], [320, 240, 'tiny'], [2560, 1080, 'ultrawide'], [1440, 960, 'native']];
for (const [w, h, label] of sizes) {
  await g.page.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await sleep(900);
  const m = await g.eval(() => { const c = window.__game.canvas, r = c.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top), iw: innerWidth, ih: innerHeight, gs: window.__game.scale.gameSize.width + 'x' + window.__game.scale.gameSize.height, ratio: +(r.width / r.height).toFixed(3) }; });
  const fits = m.w <= m.iw + 1 && m.h <= m.ih + 1; const centered = Math.abs((m.l + m.w / 2) - m.iw / 2) < 3 && Math.abs((m.t + m.h / 2) - m.ih / 2) < 3;
  console.log('resize', label, JSON.stringify(m), 'fits', fits, 'centered', centered);
  if (!fits || !centered || Math.abs(m.ratio - 1.5) > 0.02) note(`resize ${label}: canvas ${JSON.stringify(m)}`);
  // click aim mapping: click canvas centre-right, check aim vector
  const cx = m.l + m.w * 0.9, cy = m.t + m.h * 0.5;
  await g.page.mouse.move(cx, cy); await sleep(200);
  const aim = await g.eval(() => { const s = window.__dw.scene, p = s.pointer || s.input.activePointer; return { wx: Math.round(p.worldX), wy: Math.round(p.worldY) }; });
  if (Math.abs(aim.wx - 1440 * 0.9) > 20 || Math.abs(aim.wy - 480) > 20) note(`resize ${label}: pointer world ${JSON.stringify(aim)} expected ~(1296,480)`);
  if (label === '4:3' || label === '16:10' || label === 'portrait') await g.shot('qa4-resize-' + label.replace(':', 'x'));
  await chk('resize-' + label);
}
await g.page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });
// resize during pause + during menu
await g.tap('Escape'); await sleep(500); await g.page.setViewport({ width: 900, height: 700 }); await sleep(600); await g.page.setViewport({ width: 1440, height: 960 }); await sleep(600); await g.tap('Escape'); await sleep(500);
await chk('resize-paused');
console.log('warns', [...new Set(g.warns.filter((w) => !/GL Driver|GPU stall/.test(w)))].slice(0, 10));
console.log(issues.length ? `\nQA4-LIFECYCLE ${issues.length} issue(s)` : '\nQA4-LIFECYCLE clean');
await g.close();
