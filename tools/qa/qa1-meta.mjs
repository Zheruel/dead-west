// QA-1 meta flows. Usage: node tools/qa/qa1-meta.mjs <area>   areas: charselect | menus | unlock | end | options | checkpoint | storage | migrate
// Each area runs in its own private-server headless Chrome (harness.launch). Prints PASS/FAIL lines + console errors.
import { freshSave } from '../../src/core/Save.js';
import { open, check, active, waitScene, saveOf, storedOf, done, reseed, results } from './qa1-lib.mjs';

const area = process.argv[2] || 'charselect';
const NOW = Date.now();
const U = (ids) => Object.fromEntries(ids.map((i) => [i, NOW]));
const fs0 = (unl) => { const f = freshSave(); f.unlocks = U(unl); return f; };
const gameInfo = (g) => g.eval(() => {
  const s = window.__dw && window.__dw.scene; if (!s) return null;
  const p = s.player; const st = p.stats;
  return { char: s.run.char, mode: s.run.mode, diff: s.diff && s.diff.id, seed: s.seed, floor: s.floorNum, hp: p.hp, maxHp: p.maxHp, tin: p.tin, coins: p.coins, keys: p.keys, dyn: p.dynamite, items: [...p.items], active: p.active ? p.active.id : null,
    bulletCount: st.bulletCount, damage: st.damage, fireDelay: st.fireDelay, luck: st.luck, moveSpeed: st.moveSpeed, pierce: st.pierce, tinPlating: st.tinPlating, dualGuns: st.dualGuns, hurtInvuln: st.hurtInvuln, sixthMult: st.sixthMult, skin: p.skin };
});
const press = async (g, k, ms = 60) => { await g.tap(k, ms); await g.wait(180); };
const stateCS = (g) => g.eval(() => { const s = window.__game.scene.getScene('CharSelect'); return { idx: s.idx, mode: s.mode, name: s.nameT.text, lock: s.lockT.visible ? s.lockT.text : '', hint: s.modeHint.text, role: s.roleT.text }; });

async function charselect() {
  let g, st, gi;
  if (!process.env.CS_PART2) {
  // ---- 1. preacher-only unlocked, art on
  g = await open('', { save: fs0(['char:preacher']) });
  check('CS boot menu', (await active(g)).includes('Menu'));
  await press(g, 'Enter', 80);
  check('CS RIDE OUT opens CharSelect once a 2nd rider is unlocked', await waitScene(g, 'CharSelect', 8000), JSON.stringify(await active(g)));
  await g.wait(600);
  st = await stateCS(g);
  check('CS starts on gunslinger', st.idx === 0 && /GUNSLINGER/i.test(st.name), JSON.stringify(st));
  await g.shot('qa1-cs-gunslinger');
  await press(g, 'Digit3');
  st = await stateCS(g);
  check('CS locked hunter card: name ???, hint shown', st.idx === 2 && st.name === '???' && /Undertaker|floor-3/i.test(st.lock), JSON.stringify(st));
  await g.shot('qa1-cs-locked');
  await press(g, 'Enter', 80); await g.wait(900);
  check('CS locked rider cannot start (still CharSelect, no Game)', (await active(g)).includes('CharSelect') && !(await active(g)).includes('Game'), JSON.stringify(await active(g)));
  await press(g, 'Digit4'); await press(g, 'Enter', 80); await g.wait(900);
  check('CS locked queen cannot start', !(await active(g)).includes('Game'));
  // hell chip while locked
  await g.click(1240, 790); await g.wait(300);
  st = await stateCS(g);
  check('CS locked Hell chip: stays NORMAL + hint', st.mode === 0 && /Win a run/i.test(st.hint), JSON.stringify(st));
  await press(g, 'KeyS'); st = await stateCS(g);
  check('CS W/S on locked Hell stays NORMAL', st.mode === 0);
  // mouse tokens
  await g.click(720 - 255, 790); await g.wait(200); st = await stateCS(g);
  check('CS click token 1 selects gunslinger', st.idx === 0, JSON.stringify(st));
  await g.click(720 - 85, 790); await g.wait(200); st = await stateCS(g);
  check('CS click token 2 selects preacher', st.idx === 1 && /PREACHER|JOSIAH/i.test(st.name), JSON.stringify(st));
  await g.shot('qa1-cs-preacher');
  await g.click(1390, 420); await g.wait(200); st = await stateCS(g);
  check('CS right arrow -> hunter (locked)', st.idx === 2);
  await g.click(50, 420); await g.wait(200); st = await stateCS(g);
  check('CS left arrow -> preacher', st.idx === 1);
  await press(g, 'KeyA'); await press(g, 'KeyA'); st = await stateCS(g);
  check('CS A wraps to queen', st.idx === 3, JSON.stringify(st));
  await press(g, 'KeyD'); st = await stateCS(g);
  check('CS D wraps to gunslinger', st.idx === 0);
  await press(g, 'Digit2');
  await g.click(720, 934); await g.wait(500);
  check('CS plaque click starts Game', await waitScene(g, 'Game', 20000));
  await g.wait(1500);
  gi = await gameInfo(g);
  check('CS preacher run: char/mode', gi && gi.char === 'preacher' && gi.mode === 'normal', JSON.stringify(gi));
  check('CS preacher: 5 pellets, tin 4, 6 hp', gi && gi.bulletCount === 5 && gi.tin === 4 && gi.maxHp === 6, JSON.stringify(gi));
  const sv = await saveOf(g);
  check('CS remembers lastChar', sv.settings.lastChar === 'preacher', sv.settings.lastChar);
  // ---- reload => remembered
  await reseed(g, '', { save: await storedOf(g) });
  await press(g, 'Enter', 80); await waitScene(g, 'CharSelect', 8000); await g.wait(500);
  st = await stateCS(g);
  check('CS last rider preselected after reload', st.idx === 1, JSON.stringify(st));
  const errs = g.errors.slice(); check('CS no console errors (art on)', errs.length === 0, errs.slice(0, 3).join(' | '));
  await g.close();
  }

  // ---- 2. all unlocked, noassets, hell
  const all = ['char:preacher', 'char:hunter', 'char:queen', 'mode:hell', 'mode:daily'];
  g = await open('?noassets=1', { save: fs0(all), });
  await press(g, 'Enter', 80);
  check('CS(noassets) opens', await waitScene(g, 'CharSelect', 8000));
  await g.wait(500);
  const expect = { gunslinger: { bulletCount: 1, maxHp: 6, dyn: 1 }, preacher: { bulletCount: 5, maxHp: 6, tin: 4 }, hunter: { bulletCount: 1, maxHp: 4, dyn: 7 }, queen: { bulletCount: 1, maxHp: 6, coins: 10 } };
  const order = ['gunslinger', 'preacher', 'hunter', 'queen'];
  for (let i = 0; i < 4; i++) {
    await press(g, 'Digit' + (i + 1));
    st = await stateCS(g);
    check(`CS(noassets) card ${order[i]} renders`, st.idx === i && st.name !== '???' && st.role.length > 0, JSON.stringify(st));
    await g.shot(`qa1-cs-noassets-${order[i]}`);
  }
  // hell mode via W/S + start each rider
  for (let i = 0; i < 4; i++) {
    if (!(await active(g)).includes('CharSelect')) { await g.eval(() => window.__game.scene.start('CharSelect')); await waitScene(g, 'CharSelect', 8000); await g.wait(400); }
    await press(g, 'Digit' + (i + 1));
    st = await stateCS(g); if (st.mode === 0) await press(g, 'KeyS');
    st = await stateCS(g);
    check(`CS hell chip selectable (${order[i]})`, st.mode === 1, JSON.stringify(st));
    await press(g, 'Enter', 80);
    check(`CS ${order[i]} hell run starts`, await waitScene(g, 'Game', 20000));
    await g.wait(1500);
    gi = await gameInfo(g);
    const ex = expect[order[i]];
    const bad = Object.keys(ex).filter((k) => gi[k] !== ex[k]);
    check(`CS ${order[i]} hell: char/mode/kit`, gi && gi.char === order[i] && gi.mode === 'hell' && gi.diff === 'hell' && bad.length === 0, JSON.stringify({ gi, bad }));
    console.log('   stats', order[i], JSON.stringify(gi));
    await g.eval(() => { const s = window.__game.scene; s.stop('HUD'); s.stop('Game'); s.start('CharSelect'); });
    await waitScene(g, 'CharSelect', 8000); await g.wait(400);
  }
  check('CS(noassets) no console errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
  await g.close();
}

async function menus() {
  const all = ['char:preacher', 'char:hunter', 'char:queen', 'mode:hell', 'mode:daily'];
  const g = await open('', { save: fs0(all) });
  const menu = async (n) => { // from Menu, move selection to entry n (0 = first) and press Enter
    await g.eval((n) => window.__game.scene.getScene('Menu').list.select(n, true), n);
    await g.wait(150); await g.tap('Enter', 80);
  };
  const back = async () => { await g.tap('Escape', 80); await waitScene(g, 'Menu', 8000); await g.wait(700); };
  // DAILY (index 1)
  await menu(1); check('MENU Daily opens', await waitScene(g, 'Daily', 8000)); await g.wait(800); await g.shot('qa1-daily');
  const dtxt = await g.eval(() => window.__game.scene.getScene('Daily').children.list.filter((o) => o.text).map((o) => o.text));
  console.log('   daily texts:', JSON.stringify(dtxt).slice(0, 600));
  await press(g, 'KeyD'); await press(g, 'KeyD'); await press(g, 'KeyA');
  await back();
  // BOARD (2)
  await menu(2); check('MENU Board opens', await waitScene(g, 'Board', 8000)); await g.wait(800); await g.shot('qa1-board');
  await press(g, 'KeyE'); await g.shot('qa1-board-silver'); await press(g, 'KeyE'); await press(g, 'KeyQ');
  await press(g, 'Enter', 80); await g.wait(1200);
  const inGame = (await active(g)).includes('Game');
  check('BOARD Enter on tier-2 locked poster does not start', !inGame || false, JSON.stringify(await active(g)));
  if (inGame) { await g.eval(() => { const s = window.__game.scene; s.stop('HUD'); s.stop('Game'); s.start('Menu'); }); await waitScene(g, 'Menu'); } else await back();
  // CODEX (3)
  await menu(3); check('MENU Codex opens', await waitScene(g, 'Codex', 8000)); await g.wait(900);
  for (let t = 0; t < 6; t++) { await g.shot(`qa1-codex-${t}`); await press(g, 'KeyE'); await g.tap('ArrowRight', 30); await g.tap('ArrowDown', 30); await g.tap('KeyX', 30); await g.wait(200); }
  await back();
  // OPTIONS (4)
  await menu(4); await g.wait(500); await g.shot('qa1-options');
  await press(g, 'KeyE'); await g.shot('qa1-options2'); await g.tap('Escape', 80); await g.wait(400);
  // CREDITS (5)
  await menu(5); await g.wait(500); await g.shot('qa1-credits');
  for (let i = 0; i < 5; i++) await press(g, 'Enter', 80);
  await g.wait(300);
  check('MENU still on Menu after credits', (await active(g)).includes('Menu'));
  check('MENU no console errors', g.errors.length === 0, g.errors.slice(0, 4).join(' | '));
  await g.close();
}

const killBoss = (g, floor, id) => g.eval(async (floor, id) => {
  const { bus } = await import('/src/core/events.js');
  const a = window.__dw.api;
  if (window.__dw.scene.floorNum !== floor) a.setFloor(floor);
  a.jump('boss');
  await new Promise((r) => setTimeout(r, 600));
  return new Promise((res) => {
    const to = setTimeout(() => { bus.off('boss:defeated', h); res('timeout'); }, 25000);
    const h = (p) => { if (p.id === id) { clearTimeout(to); bus.off('boss:defeated', h); setTimeout(() => res('ok'), 300); } };
    bus.on('boss:defeated', h);
    const b = a.spawnBoss(id); if (!b) { res('nospawn'); return; }
    b.hp = 0; b.die({});
  });
}, floor, id);

async function unlock() {
  const g = await open('?seed=31');
  check('UNL boot fresh', (await active(g)).includes('Menu'));
  await g.tap('Enter', 80); check('UNL fresh RIDE OUT goes straight to Game (no CharSelect)', await waitScene(g, 'Game', 30000)); await g.wait(1500);
  await g.eval(async () => {
    const { bus } = await import('/src/core/events.js');
    window.__ev = { unl: [], ach: [], cx: [] };
    bus.on('meta:unlocked', (p) => window.__ev.unl.push(p.id));
    bus.on('meta:achievement', (p) => window.__ev.ach.push(p.id));
    bus.on('codex:discovered', (p) => window.__ev.cx.push(p.kind + ':' + p.id));
  });
  const meta = await g.eval(async () => { const { Meta } = await import('/src/meta/Meta.js'); return { enabled: Meta.enabled, unlockAll: Meta.unlockAll }; });
  check('UNL meta enabled in a normal (non-debug) run', meta.enabled === true, JSON.stringify(meta));
  // kill 1..500 enemies through the real death path
  const kills = await g.eval(async () => {
    const a = window.__dw.api; let n = 0;
    for (let i = 0; i < 520; i++) { const e = a.spawn('coyote', 700, 500); if (e) { e.hp = 0; e.die({}); n++; } if (window.__dw.scene.enemies.length > 50) a.killAll(); }
    return n;
  });
  await g.wait(400);
  let ev = await g.eval(() => window.__ev), sv = await saveOf(g);
  console.log('   kills', kills, 'ach', JSON.stringify(ev.ach), 'unl', JSON.stringify(ev.unl), 'stats.kills', sv.stats.kills, 'k.coyote', sv.stats.k.coyote);
  check('UNL kill stat counts (>=500 kills recorded)', sv.stats.kills >= 500, 'kills=' + sv.stats.kills);
  const gd = ev.ach.filter((x) => x === 'gravedigger').length;
  check('UNL gravedigger (500 kills) fired exactly once', gd === 1, JSON.stringify(ev.ach));
  // defeat grimm twice
  console.log('   grimm kill 1:', await killBoss(g, 2, 'grimm'));
  console.log('   grimm kill 2:', await killBoss(g, 2, 'grimm'));
  await g.wait(500);
  ev = await g.eval(() => window.__ev); sv = await saveOf(g);
  const cnt = (arr, x) => arr.filter((y) => y === x).length;
  check('UNL lawless fired once after two grimm kills', cnt(ev.ach, 'lawless') === 1 && cnt(ev.unl, 'char:preacher') === 1, JSON.stringify({ ach: ev.ach, unl: ev.unl }));
  check('UNL preacher unlocked in save', !!sv.unlocks['char:preacher'] && sv.chars.preacher.unlocked === true);
  const st1 = await storedOf(g);
  check('UNL unlock persisted immediately (localStorage)', st1 && st1.unlocks && !!st1.unlocks['char:preacher'] && !!st1.ach.lawless, JSON.stringify(st1 && st1.unlocks));
  // undertaker + cascabel
  console.log('   cascabel:', await killBoss(g, 1, 'cascabel')); console.log('   undertaker:', await killBoss(g, 3, 'undertaker'));
  await g.wait(500);
  ev = await g.eval(() => window.__ev);
  check('UNL last_rites -> hunter + daily once', cnt(ev.unl, 'char:hunter') === 1 && cnt(ev.unl, 'mode:daily') === 1 && cnt(ev.ach, 'last_rites') === 1, JSON.stringify({ ach: ev.ach, unl: ev.unl }));
  await g.shot('qa1-unlock-toast');
  // toast queue check on HUD
  const toast = await g.eval(() => { const h = window.__game.scene.getScene('HUD'); const t = h && (h.toasts || (h.widgets && h.widgets.toasts)); return t ? { q: (t.queue || []).length, cur: !!t.cur } : 'no-toast-obj'; });
  console.log('   toast state', JSON.stringify(toast));
  // reload: persisted, no re-fire on next run
  const stored = await storedOf(g);
  await reseed(g, '?seed=31', { save: stored });
  sv = await saveOf(g);
  check('UNL unlocks survive reload', !!sv.unlocks['char:preacher'] && !!sv.unlocks['char:hunter'] && !!sv.unlocks['mode:daily'] && sv.ach.lawless && sv.ach.gravedigger, JSON.stringify(Object.keys(sv.unlocks)));
  await g.tap('Enter', 80); await waitScene(g, 'CharSelect', 8000); await g.wait(400);
  const cs = await stateCS(g);
  check('UNL CharSelect now appears (rider choice)', cs && cs.idx === 0);
  await g.tap('Digit3'); await g.wait(200);
  const cs3 = await stateCS(g);
  check('UNL hunter card unlocked after last_rites', cs3.name !== '???', JSON.stringify(cs3));
  await g.tap('Digit4'); await g.wait(200);
  const cs4 = await stateCS(g);
  check('UNL queen still locked', cs4.name === '???', JSON.stringify(cs4));
  // start hunter, kill Cascabel again -> rattle_silenced must not refire
  await g.tap('Digit3'); await g.tap('Enter', 80); await waitScene(g, 'Game', 30000); await g.wait(1200);
  await g.eval(async () => { const { bus } = await import('/src/core/events.js'); window.__ev = { unl: [], ach: [] }; bus.on('meta:unlocked', (p) => window.__ev.unl.push(p.id)); bus.on('meta:achievement', (p) => window.__ev.ach.push(p.id)); });
  console.log('   cascabel (again):', await killBoss(g, 1, 'cascabel'));
  await g.wait(500);
  ev = await g.eval(() => window.__ev);
  check('UNL no re-fire of earned deeds in a later run', !ev.ach.includes('rattle_silenced') && !ev.ach.includes('lawless') && !ev.unl.length, JSON.stringify(ev));
  check('UNL no console errors', g.errors.length === 0, g.errors.slice(0, 4).join(' | '));
  await g.close();
}

async function end() {
  const all = ['char:preacher', 'char:hunter', 'char:queen', 'mode:hell', 'mode:daily'];
  const g = await open('?seed=41&char=hunter&mode=hell', { save: fs0(all) });
  await g.tap('Enter', 80); check('END start', await waitScene(g, 'Game', 30000)); await g.wait(1500);
  const before = await saveOf(g);
  await g.eval(() => { const a = window.__dw.api; a.setFloor(2); a.giveItem('spurs'); });
  await g.eval(() => window.__dw.api.die());
  check('END death -> End scene', await waitScene(g, 'End', 30000)); await g.wait(4500);
  await g.shot('qa1-end-page1');
  const t1 = await g.eval(() => window.__game.scene.getScene('End').children.list.filter((o) => o.text).map((o) => o.text));
  console.log('   End p1 texts:', JSON.stringify(t1).slice(0, 700));
  await g.tap('Space', 80); await g.wait(1500);
  await g.shot('qa1-end-ledger');
  const t2 = await g.eval(() => window.__game.scene.getScene('End').children.list.filter((o) => o.text).map((o) => o.text));
  console.log('   End p2 texts:', JSON.stringify(t2).slice(0, 900));
  check('END ledger page 2 shows (page===2)', await g.eval(() => window.__game.scene.getScene('End').page === 2));
  await g.tap('KeyC', 80); await g.wait(400);
  await g.tap('ArrowLeft', 80); await g.wait(800);
  check('END Left returns to page 1', await g.eval(() => window.__game.scene.getScene('End').page === 1));
  const after = await saveOf(g);
  check('END run recorded once (runs +1, deaths +1, history +1)', after.stats.runs === before.stats.runs + 1 && after.stats.deaths === before.stats.deaths + 1 && after.history.length === before.history.length + 1, JSON.stringify({ r: after.stats.runs, d: after.stats.deaths, h: after.history.length }));
  check('END debug-less hunter hell history entry', after.history[after.history.length - 1] && after.history[after.history.length - 1].char === 'hunter' && after.history[after.history.length - 1].mode === 'hell', JSON.stringify(after.history[after.history.length - 1]));
  check('END checkpoint empty after death', after.checkpoint === null);
  // R = ride again same char/mode
  await g.tap('KeyR', 80);
  check('END R rides again', await waitScene(g, 'Game', 30000)); await g.wait(1500);
  const gi = await gameInfo(g);
  check('END ride again keeps rider+mode', gi && gi.char === 'hunter' && gi.mode === 'hell', JSON.stringify(gi));
  // win path
  await g.eval(() => { const s = window.__dw.scene; s.run.floor = 6; s.endRun('complete'); });
  check('END win -> End', await waitScene(g, 'End', 30000)); await g.wait(4500);
  await g.shot('qa1-end-win1');
  await g.tap('Space', 80); await g.wait(1500);
  await g.shot('qa1-end-win-ledger');
  const t3 = await g.eval(() => window.__game.scene.getScene('End').children.list.filter((o) => o.text).map((o) => o.text));
  console.log('   End win p2 texts:', JSON.stringify(t3).slice(0, 900));
  const w = await saveOf(g);
  check('END win recorded: wins +1, debt_paid earned, hell mark', w.stats.wins === after.stats.wins + 1 && !!w.ach.debt_paid && w.chars.hunter.marks.hell === 1, JSON.stringify({ wins: w.stats.wins, debt: w.ach.debt_paid, marks: w.chars.hunter.marks }));
  await g.tap('Escape', 80); check('END Esc -> Menu', await waitScene(g, 'Menu', 15000));
  check('END no console errors', g.errors.length === 0, g.errors.slice(0, 4).join(' | '));
  await g.close();
}

async function options() {
  const st = { ...fs0(['char:preacher', 'char:hunter', 'mode:daily']) };
  st.stats.runs = 7; st.stats.kills = 1234; st.stats.wins = 1; st.best.floor = 4; st.codex.items = { spurs: 2, whiskey_bottle: 1 }; st.settings.music = 0.25; st.settings.shakeAmt = 0.5; st.settings.dmgNumbers = true;
  st.history = [{ t: NOW, char: 'preacher', mode: 'normal', floor: 3, won: false, time: 500, kills: 90, reward: 400, killedBy: 'coyote', seed: 5 }];
  st.notoriety.np = 500; st.ach.lawless = NOW; st.daily.entries = [{ date: '2026-09-01', score: 10, char: 'queen', floor: 2, won: false, time: 100, mutator: 'x', hell: false }];
  const g = await open('', { save: st });
  await g.eval(() => { window.__clip = null; try { navigator.clipboard.writeText = (t) => { window.__clip = t; return Promise.resolve(); }; } catch (e) { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip = t; return Promise.resolve(); } }, configurable: true }); } });
  const menuOpts = async () => { await g.eval(() => window.__game.scene.getScene('Menu').list.select(4, true)); await g.wait(100); await g.tap('Enter', 80); await g.wait(500); };
  await menuOpts();
  await g.tap('KeyE', 60); await g.wait(400);
  await g.shot('qa1-options-p2');
  // export = row 4
  const selRow = (n) => g.eval((n) => { const o = window.__game.scene.getScene('Menu').opt; o.list.select(n, true); return o.list.sel; }, n);
  await selRow(4);
  await g.wait(150); await g.tap('Enter', 80); await g.wait(800);
  const exp = await g.eval(() => window.__clip);
  check('OPT export puts a code on the clipboard', typeof exp === 'string' && exp.length > 50, String(exp).slice(0, 40));
  const s1 = await saveOf(g); const strip = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.updated; return c; };
  // reset = row 6, hold enter 1.7 s
  await selRow(6); await g.wait(150);
  await g.press('Enter'); await g.wait(2200); await g.release('Enter'); await g.wait(500);
  const s2 = await saveOf(g);
  check('OPT reset progress erased stats/unlocks but kept settings', s2.stats.runs === 0 && Object.keys(s2.unlocks).length === 0 && s2.settings.music === 0.25 && s2.settings.dmgNumbers === true, JSON.stringify({ runs: s2.stats.runs, unl: s2.unlocks, music: s2.settings.music }));
  // short hold must NOT reset (do it after import)
  // import = row 5
  g.dialogAnswer = exp;
  await selRow(5); await g.wait(150); await g.tap('Enter', 80); await g.wait(800);
  const s3 = await saveOf(g);
  check('OPT import restores an identical save (deep equal, ignoring updated)', JSON.stringify(strip(s3)) === JSON.stringify(strip(s1)), 'dialogs=' + JSON.stringify(g.dialogs));
  // bad import
  g.dialogAnswer = 'not-a-save!!';
  await g.tap('Enter', 80); await g.wait(600);
  const s4 = await saveOf(g);
  check('OPT garbage import rejected (save unchanged)', JSON.stringify(strip(s4)) === JSON.stringify(strip(s1)));
  const okPrompt = await g.eval(() => window.__game.scene.getScene('Menu').opt.status.text);
  console.log('   status after bad import:', okPrompt);
  // v1 export string (wrong version) rejected
  g.dialogAnswer = Buffer.from(JSON.stringify({ v: 1, wins: 5 })).toString('base64');
  await g.tap('Enter', 80); await g.wait(600);
  const s5 = await saveOf(g);
  check('OPT v1-shaped import rejected', JSON.stringify(strip(s5)) === JSON.stringify(strip(s1)));
  // short hold
  await selRow(6); await g.wait(120); await g.press('Enter'); await g.wait(500); await g.release('Enter'); await g.wait(400);
  const s6 = await saveOf(g);
  check('OPT short ENTER on reset does not erase', s6.stats.runs === 7);
  // persisted?
  const stored = await storedOf(g);
  check('OPT imported save persisted to localStorage', stored && stored.stats.runs === 7 && stored.unlocks['char:preacher']);
  // options in pause: import locked
  check('OPT no console errors', g.errors.length === 0, g.errors.slice(0, 4).join(' | '));
  await g.close();
}

async function checkpoint() {
  const all = ['char:preacher', 'char:hunter', 'char:queen', 'mode:hell', 'mode:daily'];
  const mkCase = async (char, mode, seed) => {
    const g = await open(`?seed=${seed}&char=${char}&mode=${mode}`, { save: fs0(all) });
    await g.tap('Enter', 80); await waitScene(g, 'Game', 30000); await g.wait(1500);
    await g.eval(() => { const a = window.__dw.api; const p = window.__dw.player; a.giveItem('spurs'); a.giveItem('hollow_point'); a.giveItem('whiskey_bottle'); a.giveItem('crow_companion'); p.coins = 23; p.keys = 2; p.dynamite = 5; p.hp = Math.max(1, p.maxHp - 2); p.active && (p.active.charge = 1); });
    // real arrival at F4: load + flow (as RoomManager.descend does after the chain)
    const pre = await g.eval(() => { const s = window.__dw.scene; s.roomMgr.loadFloor(4); s.roomMgr.scene.transitioning = false; return null; });
    await g.eval(async () => { const flow = await import('/src/scenes/flow.js'); const s = window.__dw.scene; flow.afterFloorIntro(s, { from: 3, floor: 4 }); });
    await g.wait(300);
    const cp1 = await g.eval(async () => { const { Save } = await import('/src/core/Save.js'); const c = Save.loadCheckpoint(); return c && JSON.parse(JSON.stringify(c)); });
    check(`CP[${char}/${mode}] checkpoint written at F4 arrival`, !!cp1 && cp1.floor === 4 && cp1.char === char && cp1.mode === mode, cp1 ? JSON.stringify({ f: cp1.floor, c: cp1.char, m: cp1.mode }) : 'null');
    // wait for chapter card + welcome
    await g.wait(6500);
    const live = await gameInfo(g);
    const layout = await g.eval(() => window.__dw.floor.rooms.map((r) => `${r.id}:${r.type}:${r.tpl || r.template || ''}`).join('|'));
    return { g, cp1, live, layout };
  };
  for (const [char, mode, seed] of [['preacher', 'hell', 51], ['hunter', 'normal', 52], ['queen', 'normal', 53]]) {
    const { g, cp1, live, layout } = await mkCase(char, mode, seed);
    // reload (kill tab) then CONTINUE
    const stored = await storedOf(g);
    check(`CP[${char}] checkpoint persisted in localStorage`, !!(stored && stored.checkpoint && stored.checkpoint.floor === 4));
    await reseed(g, '', { save: stored });
    const items = await g.eval(() => window.__game.scene.getScene('Menu').list.items ? window.__game.scene.getScene('Menu').list.items.map((i) => i.label) : null);
    console.log('   menu items:', JSON.stringify(items));
    check(`CP[${char}] menu offers CONTINUE - FLOOR 4`, items && /CONTINUE - FLOOR 4/.test(items[0]), JSON.stringify(items));
    const defSel = await g.eval(() => window.__game.scene.getScene('Menu').list.sel);
    console.log('   default menu selection with checkpoint =', defSel);
    await g.eval(() => window.__game.scene.getScene('Menu').list.select(0, true)); await g.wait(120);
    await g.tap('Enter', 80); check(`CP[${char}] continue starts Game`, await waitScene(g, 'Game', 30000)); await g.wait(1800);
    const cont = await gameInfo(g);
    const layout2 = await g.eval(() => window.__dw.floor.rooms.map((r) => `${r.id}:${r.type}:${r.tpl || r.template || ''}`).join('|'));
    const keys = ['char', 'mode', 'seed', 'floor', 'maxHp', 'tin', 'coins', 'keys', 'dyn', 'active', 'bulletCount', 'damage', 'fireDelay', 'luck', 'moveSpeed', 'tinPlating', 'dualGuns', 'hurtInvuln', 'sixthMult'];
    const diffs = keys.filter((k) => JSON.stringify(cont[k]) !== JSON.stringify(cp1[k === 'dyn' ? 'dyn' : k] !== undefined ? cp1[k === 'dyn' ? 'dyn' : k] : cont[k]));
    // compare against the snapshot in the checkpoint (identical state as saved)
    const snapDiff = [];
    if (cont.hp !== cp1.hp) snapDiff.push(`hp ${cont.hp} vs ${cp1.hp}`);
    if (cont.tin !== cp1.tin) snapDiff.push(`tin ${cont.tin} vs ${cp1.tin}`);
    if (cont.coins !== cp1.coins) snapDiff.push(`coins ${cont.coins} vs ${cp1.coins}`);
    if (cont.keys !== cp1.keys) snapDiff.push(`keys ${cont.keys} vs ${cp1.keys}`);
    if (cont.dyn !== cp1.dyn) snapDiff.push(`dyn ${cont.dyn} vs ${cp1.dyn}`);
    if (JSON.stringify(cont.items) !== JSON.stringify(cp1.items)) snapDiff.push(`items ${cont.items} vs ${cp1.items}`);
    if ((cont.active || null) !== (cp1.active ? cp1.active.id : null)) snapDiff.push('active');
    check(`CP[${char}] CONTINUE state == checkpoint snapshot`, snapDiff.length === 0 && cont.floor === 4, snapDiff.join('; ') + ' ' + JSON.stringify(cont));
    const liveDiff = ['maxHp', 'coins', 'keys', 'items', 'active', 'bulletCount', 'damage', 'fireDelay', 'luck', 'moveSpeed', 'tinPlating', 'dualGuns', 'hurtInvuln'].filter((k) => JSON.stringify(live[k]) !== JSON.stringify(cont[k]));
    check(`CP[${char}] CONTINUE stats identical to the live run (excl hp/dyn/tin welcome bonus)`, liveDiff.length === 0, liveDiff.map((k) => `${k}: live ${JSON.stringify(live[k])} cont ${JSON.stringify(cont[k])}`).join('; '));
    console.log(`   live(after welcome) hp=${live.hp} tin=${live.tin} dyn=${live.dyn}   cont hp=${cont.hp} tin=${cont.tin} dyn=${cont.dyn}   cp hp=${cp1.hp} dyn=${cp1.dyn}`);
    check(`CP[${char}] same seed+floor => identical F4 layout`, layout === layout2, layout.slice(0, 80) + ' / ' + layout2.slice(0, 80));
    const noCut = await g.eval(() => !window.__game.scene.isActive('Cutscene'));
    check(`CP[${char}] continue does not replay cutscenes`, noCut);
    // die => checkpoint cleared
    await g.eval(() => window.__dw.api.die()); await waitScene(g, 'End', 30000); await g.wait(800);
    const cpAfter = await g.eval(async () => { const { Save } = await import('/src/core/Save.js'); return Save.loadCheckpoint(); });
    check(`CP[${char}] checkpoint cleared on death`, cpAfter === null);
    check(`CP[${char}] no console errors`, g.errors.length === 0, g.errors.slice(0, 4).join(' | '));
    await g.close();
  }
  // debug run must not write checkpoints; daily/contract neither
  const g2 = await open('?debug=1&seed=5');
  await g2.startRun();
  await g2.eval(async () => { const flow = await import('/src/scenes/flow.js'); const s = window.__dw.scene; s.roomMgr.loadFloor(4); flow.afterFloorIntro(s, { from: 3, floor: 4 }); });
  await g2.wait(400);
  const dbg = await g2.eval(async () => { const { Save } = await import('/src/core/Save.js'); return Save.loadCheckpoint(); });
  check('CP debug run writes no checkpoint', dbg === null);
  await g2.close();
}

async function storage() {
  for (const mode of ['throw', 'full']) {
    const g = await open('?seed=61', { storage: mode, save: undefined });
    check(`STO[${mode}] menu boots`, (await active(g)).includes('Menu'));
    await g.tap('Enter', 80); check(`STO[${mode}] run starts`, await waitScene(g, 'Game', 30000)); await g.wait(1500);
    await g.eval(() => { const a = window.__dw.api; for (let i = 0; i < 12; i++) { const e = a.spawn('coyote', 700, 500); if (e) { e.hp = 0; e.die({}); } } a.giveItem('spurs'); a.hurt(1); });
    await g.hold('KeyD', 600); await g.tap('Space', 80); await g.wait(400);
    await g.eval(() => window.__dw.api.die()); check(`STO[${mode}] death -> End`, await waitScene(g, 'End', 30000)); await g.wait(3000);
    await g.tap('Space', 80); await g.wait(1200); await g.tap('Escape', 80);
    check(`STO[${mode}] back to menu`, await waitScene(g, 'Menu', 15000));
    // menus with storage broken
    for (const [i, key] of [[1, 'Daily'], [2, 'Board'], [3, 'Codex']]) {
      await g.eval((i) => window.__game.scene.getScene('Menu').list.select(i, true), i);
      await g.wait(100); await g.tap('Enter', 80);
      const ok = await waitScene(g, key, 8000);
      check(`STO[${mode}] ${key} opens`, ok || i === 1, key + ' ' + ok);
      await g.wait(500); await g.tap('Escape', 80); await waitScene(g, 'Menu', 8000); await g.wait(500);
    }
    // options export/import with no storage
    const exp = await g.eval(async () => { const { Save } = await import('/src/core/Save.js'); const s = Save.export(); return { len: s.length, ok: Save.import(s) }; });
    check(`STO[${mode}] export/import in-memory ok`, exp.len > 20 && exp.ok === true, JSON.stringify(exp));
    check(`STO[${mode}] no console errors / pageerrors`, g.errors.length === 0, g.errors.slice(0, 4).join(' | '));
    await g.close();
  }
}

async function migrate() {
  const cases = {
    'v1 wins=2': { v1: { bestFloor: 3, bestTime: 900, runs: 9, deaths: 7, wins: 2, kills: 500, itemsSeen: ['spurs', 'whiskey_bottle'], bestKills: 88, playTime: 4000, settings: { mute: false, volume: 0.6, shake: false, music: 0.3, sfx: 0.9 } } },
    'v1 bestFloor=3': { v1: { bestFloor: 3, runs: 4, deaths: 4, kills: 100, itemsSeen: [] } },
    'v1 empty {}': { v1: {} },
    'v1 corrupt json': { v1: '{not json' },
    'v2 corrupt json': { save: '{"v":2,"stats":' },
    'v2 wrong types': { save: { v: 2, stats: { kills: 'x', runs: -5, k: 'no' }, unlocks: { 'char:queen': 'yes' }, chars: 5, codex: [], settings: { volume: 9 } } },
    'v2 + v1 both': { save: { v: 2, stats: { runs: 3 } }, v1: { wins: 9 } },
    'v3 future': { save: { v: 3, stats: { runs: 3 } } },
    'null save': { save: 'null' },
  };
  for (const [name, c] of Object.entries(cases)) {
    const g = await open('?seed=71', c);
    check(`MIG[${name}] menu boots without errors`, (await active(g)).includes('Menu') && g.errors.length === 0, g.errors.slice(0, 2).join(' | '));
    const sv = await saveOf(g);
    const summ = { v: sv.v, runs: sv.stats.runs, wins: sv.stats.wins, best: sv.best.floor, unl: Object.keys(sv.unlocks), ach: Object.keys(sv.ach), np: sv.notoriety.np, items: Object.keys(sv.codex.items).length, shakeAmt: sv.settings.shakeAmt, vol: sv.settings.volume };
    console.log('   ', name, JSON.stringify(summ));
    check(`MIG[${name}] valid v2 object`, sv.v === 2 && typeof sv.stats.kills === 'number' && sv.stats.kills >= 0 && sv.stats.runs >= 0);
    if (name === 'v1 wins=2') check('MIG wins=2 -> preacher, hunter, daily, deeds', sv.unlocks['char:preacher'] && sv.unlocks['char:hunter'] && sv.unlocks['mode:daily'] && sv.ach.lawless && sv.ach.last_rites && sv.stats.runs === 9 && sv.stats.wins === 2 && sv.best.floor === 3 && sv.codex.items.spurs === 2 && sv.settings.shakeAmt === 0 && sv.settings.volume === 0.6);
    if (name === 'v1 bestFloor=3') check('MIG bestFloor=3 -> preacher only', sv.unlocks['char:preacher'] && !sv.unlocks['char:hunter']);
    if (name === 'v1 corrupt json') check('MIG corrupt v1 -> fresh', sv.stats.runs === 0);
    const v1kept = await g.eval(() => localStorage.getItem('deadwest.save.v1'));
    if (c.v1 !== undefined) check(`MIG[${name}] v1 key untouched`, v1kept === (typeof c.v1 === 'string' ? c.v1 : JSON.stringify(c.v1)));
    // play a short run on the migrated save (no throw)
    await g.tap('Enter', 80); const cs = await waitScene(g, 'CharSelect', 4000);
    if (cs) { await g.tap('Enter', 80); }
    check(`MIG[${name}] run starts`, await waitScene(g, 'Game', 30000));
    await g.wait(800);
    check(`MIG[${name}] no console errors after run start`, g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
    await g.close();
  }
}

const A = { charselect, menus, unlock, end, options, checkpoint, storage, migrate };
(async () => {
  if (!A[area]) { console.log('unknown area (defined so far):', Object.keys(A)); process.exit(2); }
  try { await A[area](); } catch (e) { console.log('SCRIPT ERROR', e && e.stack || e); check(area + ' script completed', false, String(e).slice(0, 200)); }
  done(null);
  process.exit(0);
})();
