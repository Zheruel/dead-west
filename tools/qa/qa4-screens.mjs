// QA-4: every screen and every floor under missing art.   node tools/qa/qa4-screens.mjs "noassets=1"   (or dropassets=40)
// Visits Menu(+options,+credits), CharSelect, Daily, Board, Codex (all tabs), Credits, each Cutscene id, Game floors 1-6 (every room, all enemy/boss ids), Pause, End (death/complete).
import { open, sleep } from './qa4-lib.mjs';
const flagQ = process.argv[2] || 'noassets=1';
const g = await open(`?seed=42&unlockall=1&char=gunslinger&debug=1&${flagQ}`, { name: 'qa4-screens' });
const issues = [];
const note = (s) => { issues.push(s); console.log('ISSUE', s); };
const check = async (label) => {
  const e = g.errors.filter((x) => !/favicon/.test(x));
  if (e.length) { note(`${label}: console errors ${JSON.stringify(e.slice(0, 3))}`); g.errors.length = 0; }
  const r = await g.rejections(); if (r.length) { note(`${label}: unhandled rejection ${r[0].slice(0, 300)}`); await g.eval(() => (window.__rej = [])); }
};
const go = async (scene, data) => {
  await g.eval((scene, data) => { const gm = window.__game; for (const s of gm.scene.getScenes(true)) gm.scene.stop(s.sys.settings.key); gm.scene.start(scene, data); }, scene, data);
  await sleep(1500);
};
const keys = async (list, ms = 150) => { for (const k of list) { await g.tap(k, 60); await sleep(ms); } };
console.log('booted; scene:', await g.eval(() => window.__game.scene.getScenes(true).map((s) => s.sys.settings.key)));
await check('boot');
// Menu: options + credits
await g.eval(() => window.__game.scene.getScene('Menu').openOptions()); await sleep(500); await keys(['ArrowDown', 'ArrowRight', 'ArrowDown', 'Enter', 'Escape']); await check('menu-options');
await g.eval(() => { const m = window.__game.scene.getScene('Menu'); if (m.modal) m.closeModal(); m.openCredits(); }); await sleep(500); await keys(['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Escape'], 300); await check('menu-credits');
for (const s of ['CharSelect', 'Daily', 'Board', 'Codex']) {
  await go(s);
  await keys(['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowDown', 'ArrowUp'], 200);
  if (s === 'Codex') { for (let i = 0; i < 8; i++) { await g.tap('ArrowRight', 60); await sleep(250); await g.tap('ArrowDown', 60); await sleep(100); await g.tap('Enter', 60); await sleep(100); } await keys(['Escape']); }
  await check(s);
}
await go('Credits', { ending: 'a', next: { scene: 'Menu' } }); await sleep(4000); await keys(['Enter', 'Enter', 'Space']); await check('Credits-a');
await go('Credits', { ending: 'true', next: { scene: 'Menu' } }); await sleep(3000); await keys(['Escape']); await check('Credits-true');
const ids = await g.eval(async () => (await import('/src/data/story/cutscenes.js')).CUTSCENE_IDS);
for (const id of ids) { await go('Cutscene', { id, ctx: { char: 'gunslinger', clean: true, hell: false }, next: { scene: 'Menu' } }); for (let i = 0; i < 40; i++) { await g.tap('Enter', 40); await sleep(100); if (await g.eval(() => window.__game.scene.isActive('Menu'))) break; } await check('cutscene-' + id); }
// End scenes (via real run + endRun)
for (const variant of ['death', 'complete', 'contract']) {
  await go('Menu'); await g.tap('Enter', 80); await g.page.waitForFunction(() => window.__game.scene.isActive('Game') && window.__dw && window.__dw.player, { timeout: 60000 }).catch(() => note('cannot start run ' + variant));
  await sleep(800);
  await g.eval((v) => { const s = window.__dw.scene; s.endRun(v); }, variant); await sleep(4500); await g.shot('qa4-end-' + variant); await keys(['Enter'], 400); await sleep(800);
  await check('end-' + variant);
}
// Game: each floor, every room, all enemies + bosses
await go('Menu'); await g.tap('Enter', 80); await g.page.waitForFunction(() => window.__game.scene.isActive('Game') && window.__dw && window.__dw.player, { timeout: 60000 });
await sleep(800);
const ids2 = await g.eval(async () => { const r = await import('/src/enemies/registry.js'); const b = await import('/src/bosses/registry.js'); return { e: Object.keys(r.ENEMY_META), b: Object.keys(b.BOSS_META) }; });
for (let f = 1; f <= 6; f++) {
  await g.eval((f) => { const a = window.__dw.api; a.godMode(true); a.setFloor(f); a.give(50); }, f);
  await sleep(1800); await check(`floor${f}-load`);
  const rooms = await g.eval(() => window.__dw.floor.rooms.map((r) => r.id + ':' + r.type));
  for (const r of rooms) {
    const [id, type] = r.split(':');
    try { await g.eval((id) => { window.__dw.api.godMode(true); window.__dw.api.teleport(id); }, id); } catch (e) { note(`floor${f} teleport ${r} threw ${e.message.slice(0, 200)}`); continue; }
    await sleep(700);
    // press a key to dismiss intro cards, walk a bit
    await g.eval(() => { const s = window.__dw && window.__dw.scene; if (s) s.gameInput.override = { move: { x: 1, y: 0.3 }, aim: { x: -1, y: 0 } }; });
    await sleep(600);
    await g.eval(() => { const s = window.__dw && window.__dw.scene; if (s) s.gameInput.override = null; });
    if (f === 4 && type === 'boss') await g.shot(`qa4-${flagQ.replace(/\W/g, '')}-f${f}-boss`);
    await check(`floor${f} room ${r}`);
  }
  if (await g.eval(() => !!window.__dw.floor.xroads)) { const ok = await g.eval(() => window.__dw.api.enterCrossroads()); await sleep(900); await check(`floor${f} xroads(${ok})`); await g.eval(() => window.__dw.scene.roomMgr.leavePocket && window.__dw.scene.roomMgr.leavePocket()); await sleep(600); }
}
// all enemies and bosses in F1..F6 rooms
for (const id of ids2.e) {
  await g.eval((id) => { const a = window.__dw.api; a.godMode(true); a.spawn(id, 700, 500); a.spawn(id, 500, 600); }, id); await sleep(500);
  await g.eval(() => { const s = window.__dw.scene; s.gameInput.override = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 } }; }); await sleep(600);
  await g.eval(() => { window.__dw.api.killAll(); window.__dw.scene.gameInput.override = null; });
  await check('enemy ' + id);
}
for (const id of ids2.b) {
  await g.eval((id) => { const a = window.__dw.api; a.godMode(true); a.heal(); a.spawnBoss(id, 900, 480); }, id).catch((e) => note(`spawnBoss ${id}: ${e.message.slice(0, 200)}`));
  await sleep(4200);
  await g.eval(() => { const s = window.__dw.scene; s.gameInput.override = { move: { x: 0.5, y: 0.5 }, aim: { x: 1, y: 0 } }; }); await sleep(2500);
  await g.eval(() => { window.__dw.scene.gameInput.override = null; window.__dw.api.killAll(); }); await sleep(2500);
  await check('boss ' + id);
  await g.eval(() => window.__dw && window.__dw.api.jump('start')).catch(() => {}); await sleep(600);
}
// pause + die
await g.eval(() => { window.__dw.scene.pauseGame && window.__dw.scene.pauseGame(); }); await sleep(800); await keys(['ArrowDown', 'ArrowUp', 'Escape'], 300); await check('pause');
await g.eval(() => { const a = window.__dw.api; a.godMode(false); a.die(); }); await sleep(6000); await check('die');
console.log('warns', [...new Set(g.warns)].slice(0, 30));
console.log(issues.length ? `\nQA4-SCREENS ${flagQ}: ${issues.length} issue(s)` : `\nQA4-SCREENS ${flagQ}: clean`);
await g.close();
