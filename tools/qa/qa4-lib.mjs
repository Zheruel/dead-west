// QA-4 shared helpers (robustness). Wraps harness.launch: captures warnings/unhandled rejections, exposes leak metrics + fast-forward.
import { launch } from './harness.mjs';

export async function open(query, opts = {}) {
  const g = await launch({ query, quiet: true, name: opts.name || 'qa4', ...opts });
  g.warns = [];
  g.page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'warn') g.warns.push(m.text()); });
  await g.page.evaluate(() => {
    window.__rej = window.__rej || [];
    window.addEventListener('unhandledrejection', (e) => window.__rej.push(String(e.reason && (e.reason.stack || e.reason.message || e.reason))));
  });
  g.cdp = await g.page.createCDPSession();
  g.heap = async () => { await g.cdp.send('HeapProfiler.collectGarbage'); await g.cdp.send('HeapProfiler.collectGarbage'); const m = await g.page.metrics(); return m.JSHeapUsedSize; };
  g.rejections = () => g.page.evaluate(() => window.__rej || []).catch(() => []);
  g.installFF = () => g.eval(() => {
    const game = window.__game;
    window.__t = window.__t || 100000;
    window.__ff = (n, cb) => {
      const scs = game.scene.getScenes(false);
      game.loop.sleep();
      const vis = scs.map((s) => s.sys.settings.visible);
      scs.forEach((s) => (s.sys.settings.visible = false));
      for (let i = 0; i < n; i++) { const gs = window.__dw && window.__dw.scene; if (gs && gs.fx) gs.fx.hitStopUntil = 0; if (cb) cb(i); window.__t += 16.667; game.step(window.__t, 16.667); }
      scs.forEach((s, k) => (s.sys.settings.visible = vis[k]));
    };
    window.__wake = () => game.loop.wake();
  });
  return g;
}

// In-page leak probe (string-evaluated so it can be reused): counts of everything that could leak.
export const PROBE = async () => {
  const { bus } = await import('/src/core/events.js');
  const game = window.__game;
  const busCounts = {};
  let busTotal = 0;
  for (const n of bus.eventNames()) { const c = bus.listenerCount(n); busCounts[String(n)] = c; busTotal += c; }
  const sc = game.scene.getScenes(false);
  const scenes = {};
  for (const s of sc) {
    let ev = 0; for (const n of s.events.eventNames()) ev += s.events.listenerCount(n);
    scenes[s.sys.settings.key] = { ev, ch: s.children ? s.children.length : 0, tw: s.tweens ? s.tweens.getTweens().length : 0, timers: s.time ? s.time._active.length + s.time._pendingInsertion.length : 0 };
  }
  let gev = 0; for (const n of game.events.eventNames()) gev += game.events.listenerCount(n);
  const tex = game.textures.list ? Object.keys(game.textures.list).length : 0;
  let rt = 0; for (const k of Object.keys(game.textures.list)) { const t = game.textures.list[k]; if (t && t.source && t.source[0] && t.source[0].renderer && t.key && /^__|rt|snap|light|mask/i.test(t.key)) rt++; }
  const gs = window.__dw && window.__dw.scene;
  const pool = gs ? { enemies: gs.enemies.length, bulletsP: gs.bullets.player.list ? gs.bullets.player.list.length : 0, bulletsE: gs.bullets.enemy.list ? gs.bullets.enemy.list.length : 0, freeP: gs.bullets.player.free ? gs.bullets.player.free.length : 0, freeE: gs.bullets.enemy.free ? gs.bullets.enemy.free.length : 0 } : null;
  const kb = game.input && game.input.keyboard ? game.input.keyboard.listenerCount ? 0 : 0 : 0;
  let domL = 0; try { domL = (window.__domListeners || 0); } catch (e) { /* */ }
  return { busTotal, busCounts, scenes, gev, tex, rt, pool, active: sc.map((s) => s.sys.settings.key).join(','), kb, domL };
};

export const fmt = (n) => (n / 1048576).toFixed(2) + 'MB';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
