// QA-4 storage scenarios in a real browser: localStorage blocked / null / quota / corrupt / v1 fixtures / junk checkpoint / huge value / import-export via Options.
import { open, sleep } from './qa4-lib.mjs';
const only = process.argv[2];
const CP = (o) => JSON.stringify({ v: 2, checkpoint: { v: 1, seed: 7, floor: 4, char: 'gunslinger', mode: 'normal', items: ['spurs'], hp: 6, maxHp: 6, tin: 0, coins: 5, keys: 0, dyn: 1, time: 100, kills: 5, run: {}, ...o } });
const SCEN = {
  'ls-throws': { pre: `Object.defineProperty(window,'localStorage',{get(){throw new DOMException('denied','SecurityError')},configurable:true});` },
  'ls-undefined': { pre: `Object.defineProperty(window,'localStorage',{get(){return undefined},configurable:true});` },
  'quota-full': { pre: `Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')};` },
  'getItem-throws': { pre: `Storage.prototype.getItem=function(){throw new Error('boom')};` },
  'corrupt-json': { ls: { 'deadwest.save.v2': '{"v":2,"stats":{"kills":' } },
  'corrupt-types': { ls: { 'deadwest.save.v2': JSON.stringify({ v: 2, stats: 'x', codex: [], chars: { gunslinger: 5 }, settings: { volume: 'loud' }, history: {}, flags: [], daily: 7, checkpoint: 3, unlocks: { 'char:preacher': 'yes' } }) } },
  'v2-wrong-version': { ls: { 'deadwest.save.v2': JSON.stringify({ v: 9, stats: { runs: 5 } }) } },
  'v1-fixture': { ls: { 'deadwest.save.v1': JSON.stringify({ runs: 40, deaths: 39, wins: 1, kills: 5000, bestFloor: 3, bestTime: 812, bestKills: 210, itemsSeen: ['spurs', 'hollow_point', 'bogus'], settings: { mute: false, volume: 0.6, shake: true } }) } },
  'v1-garbage': { ls: { 'deadwest.save.v1': '[1,2,{' } },
  'huge-value': { ls: { 'deadwest.save.v2': JSON.stringify({ v: 2, history: Array.from({ length: 30000 }, (_, i) => ({ i, pad: 'x'.repeat(60) })), flags: Object.fromEntries(Array.from({ length: 20000 }, (_, i) => ['f' + i, 'y'.repeat(30)])) }) } },
  'cp-valid': { ls: { 'deadwest.save.v2': CP({}) }, cont: true },
  'cp-junk-items': { ls: { 'deadwest.save.v2': CP({ items: 'spurs', active: 5, curses: 'x', blessings: [1, 2], itemState: 'zz', hp: 'many', coins: 'lots', run: 12 }) }, cont: true },
  'cp-floor-huge': { ls: { 'deadwest.save.v2': CP({ floor: 99, seed: 'abc' }) }, cont: true },
  'cp-floor-neg': { ls: { 'deadwest.save.v2': CP({ floor: -3, seed: -5 }) }, cont: true },
  'cp-bad-char': { ls: { 'deadwest.save.v2': CP({ char: 'nobody', mode: 'godmode', items: ['nonexistent_item'], itemState: { spurs: { x: 1 } } }) }, cont: true },
};
const out = [];
for (const [name, sc] of Object.entries(SCEN)) {
  if (only && !name.includes(only)) continue;
  const g = await open('?seed=42', { name: 'qa4-storage' });
  const dialogs = []; g.page.on('dialog', async (d) => { dialogs.push(d.type() + ':' + d.message().slice(0, 40)); if (d.type() === 'prompt') await d.accept(g._promptAnswer || ''); else await d.dismiss(); });
  await g.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  const script = (sc.pre || '') + (sc.ls ? `try{ ${Object.entries(sc.ls).map(([k, v]) => `if(!sessionStorage.getItem('__seeded')) localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)});`).join('')} sessionStorage.setItem('__seeded','1'); }catch(e){}` : '');
  await g.page.evaluateOnNewDocument(script);
  await g.page.reload({ waitUntil: 'domcontentloaded' });
  const menu = await g.page.waitForFunction(() => window.__game && window.__game.scene.isActive('Menu'), { timeout: 60000 }).then(() => true).catch(() => false);
  await sleep(1200);
  console.log('scenario', name, 'menu', menu); const res = { name, menu, notes: [] };
  const step = (s) => console.log('  step', s);
  const chk = async (label) => { const e = g.errors.filter((x) => !/favicon/.test(x)); if (e.length) { res.notes.push(`${label}: errors ${JSON.stringify(e.slice(0, 2)).slice(0, 300)}`); g.errors.length = 0; } const r = await g.rejections(); if (r.length) { res.notes.push(`${label}: rejection ${r[0].slice(0, 200)}`); await g.eval(() => (window.__rej = [])); } };
  await chk('menu');
  if (menu) {
    res.items = await g.eval(() => window.__game.scene.getScene('Menu').list && window.__game.scene.getScene('Menu').list.items ? window.__game.scene.getScene('Menu').list.items.map((i) => i.label) : null).catch(() => null);
    // options: change settings
    step('items'); await g.eval(() => window.__game.scene.getScene('Menu').openOptions()); await sleep(400); step('options');
    for (const k of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'Enter']) { await g.tap(k, 60); await sleep(120); }
    // export + import rows (index 5-8?): drive through OptionsPanel API
    res.exportImport = await g.eval(() => { const o = window.__game.scene.getScene('Menu').opt; try { o.exportSave(); } catch (e) { return 'export threw ' + e.message; } return 'ok'; });
    step('exported'); await sleep(300);
    await g.tap('Escape', 60); await sleep(400); await chk('options');
    if (sc.cont) {
      await g.eval(() => { const m = window.__game.scene.getScene('Menu'); const cp = m.checkpoint(); window.__cpseen = !!cp; if (cp) m.go('Game', { continue: true, floor: cp.floor }); else m.go('Game', { char: 'gunslinger', mode: 'normal' }); });
    } else await g.eval(() => window.__game.scene.getScene('Menu').go('Game', { char: 'gunslinger', mode: 'normal' }));
    const gm = await g.page.waitForFunction(() => window.__game.scene.isActive('Game') && window.__dw && window.__dw.player, { timeout: 30000 }).then(() => true).catch(() => false);
    res.game = gm; await sleep(1500); await chk('game-start');
    if (gm) {
      res.state = await g.eval(() => { const s = window.__dw.api.state(); return { floor: s.floor, hp: s.hp, items: s.items, coins: s.coins, seed: s.seed }; });
      res.cpseen = await g.eval(() => window.__cpseen);
      await g.eval(() => { window.__dw.api.godMode(true); window.__dw.api.clearRoom(); }); await sleep(800);
      await g.eval(() => { const a = window.__dw.api; a.godMode(false); a.die(); }); await g.page.waitForFunction(() => window.__game.scene.isActive('End'), { timeout: 30000 }).then(() => (res.end = true)).catch(() => (res.end = false));
      await sleep(1500); await chk('end');
      await g.tap('KeyR', 80); await g.page.waitForFunction(() => window.__game.scene.isActive('Game'), { timeout: 20000 }).then(() => (res.retry = true)).catch(() => (res.retry = false)); await sleep(800); await chk('retry');
    }
  }
  res.dialogs = dialogs; res.warns = [...new Set(g.warns.filter((w) => !/GL Driver|GPU stall/.test(w)))].slice(0, 3);
  res.ls = await g.eval(() => { try { const s = localStorage.getItem('deadwest.save.v2'); return s ? s.length : null; } catch (e) { return 'ERR ' + e.name; } });
  console.log(JSON.stringify(res)); out.push(res);
  await g.close();
}
console.log('\nSTORAGE SCENARIOS', out.length, 'with-notes', out.filter((r) => r.notes.length || !r.menu || r.game === false).map((r) => r.name));
