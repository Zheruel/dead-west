// Robustness QA: failure modes. usage: node tools/qa/rb-flags.mjs  (noassets, dropassets=50/90, localStorage throwing, localStorage getter throwing)
import { launch } from './harness.mjs';
const CASES = [
  { n: 'noassets', q: '?debug=1&noassets=1&seed=3' },
  { n: 'drop50', q: '?debug=1&dropassets=50&seed=3' },
  { n: 'drop90', q: '?debug=1&dropassets=90&seed=4' },
  { n: 'ls-throw', q: '?debug=1&seed=3', ls: 'throw' },
  { n: 'ls-getter', q: '?debug=1&seed=3', ls: 'getter' },
  { n: 'ls-quota', q: '?debug=1&seed=3', ls: 'quota' },
  { n: 'ls-garbage', q: '?debug=1&seed=3', ls: 'garbage' },
];
const only = process.argv[2];
for (const c of CASES) {
  if (only && !c.n.startsWith(only)) continue;
  const g = await launch({ query: c.q, name: 'rb-flags', quiet: true });
  try {
    if (c.ls) {
      await g.page.evaluateOnNewDocument((mode) => {
        if (mode === 'getter') { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }); return; }
        if (mode === 'garbage') { const orig = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { const v = orig.call(this, k); return v == null ? v : '{"bad":' + v.slice(0, 5); }; return; }
        Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); };
        if (mode === 'throw') { Storage.prototype.getItem = function () { throw new Error('nope'); }; Storage.prototype.removeItem = function () { throw new Error('nope'); }; }
      }, c.ls);
      await g.page.reload({ waitUntil: 'domcontentloaded' });
      await g.page.waitForFunction(() => window.__game && window.__game.scene.isActive('Menu'), { timeout: 120000 }).catch(() => {});
    }
    const menu = await g.eval(() => !!(window.__game && window.__game.scene.isActive('Menu')));
    await g.startRun().catch((e) => console.log(c.n, 'startRun failed', e.message));
    let info = {};
    for (const f of [1, 2, 3]) {
      info = await g.eval(async (f) => {
        const a = window.__dw.api; a.godMode(true); a.setFloor(f); await new Promise((r) => setTimeout(r, 900));
        a.give(5); a.spawn('outlaw'); a.spawn('coyote'); a.input({ move: { x: 1, y: 0.3 }, aim: { x: 1, y: 0 }, fire: true });
        await new Promise((r) => setTimeout(r, 1200));
        a.bossRoom(); await new Promise((r) => setTimeout(r, 4000));
        a.killAll(); a.input(null);
        await new Promise((r) => setTimeout(r, 2500));
        return { floor: window.__dw.scene.floorNum, room: window.__dw.scene.room && window.__dw.scene.room.type };
      }, f).catch((e) => ({ err: e.message }));
    }
    await g.eval(() => { const a = window.__dw.api; a.godMode(false); a.die(); }).catch(() => {});
    await g.page.waitForFunction(() => window.__game.scene.isActive('End'), { timeout: 20000 }).then(() => (info.end = true)).catch(() => (info.end = false));
    await g.wait(1200);
    await g.tap('KeyR', 80); await g.wait(2500);
    info.restarted = await g.eval(() => window.__game.scene.isActive('Game'));
    console.log(c.n, 'menu', menu, JSON.stringify(info), 'errors', g.errors.length);
    for (const e of g.errors.slice(0, 6)) console.log('   ', e.slice(0, 300));
  } catch (e) { console.log(c.n, 'HARNESS FAIL', e.message); }
  await g.close();
}
