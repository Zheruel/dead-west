// QA-2: scene child-count growth under an enemy pack (fixed-step sim, god mode). node tools/qa/qa2-leak.mjs <floor> <ids,> [simSecs=90]
import { launch } from './harness.mjs';
const floor = +process.argv[2], ids = process.argv[3].split(','), secs = +(process.argv[4] || 90);
const g = await launch({ query: '?debug=1&seed=42', name: 'qa2-leak', width: 720, height: 480, quiet: true });
await g.startRun();
await g.eval(() => { window.__t = 100000; window.__ff = (n) => { const game = window.__game, scs = game.scene.getScenes(false); game.loop.sleep(); const vis = scs.map((s) => s.sys.settings.visible); scs.forEach((s) => (s.sys.settings.visible = false)); for (let i = 0; i < n; i++) { const gs = window.__dw.scene; if (gs && gs.fx) gs.fx.hitStopUntil = 0; window.__t += 16.667; game.step(window.__t, 16.667); } scs.forEach((s, k) => (s.sys.settings.visible = vis[k])); }; });
await g.eval((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); a.jump('start'); }, floor);
await g.wait(1500);
await g.page.waitForFunction(() => { const s = window.__dw.scene; return !s.cutscene && !s.transitioning; }, { timeout: 30000 }).catch(() => {});
await g.eval(() => window.__ff(420));
await g.eval((ids) => { const a = window.__dw.api; a.killAll(); ids.forEach((id, i) => a.spawn(id, 300 + i * 150, 300 + (i % 2) * 300)); }, ids);
const census = () => g.eval(() => { const s = window.__dw.scene; const c = {}; for (const o of s.children.list) { const k = o.type + ':' + (o.texture ? o.texture.key : '') + ':d' + Math.round(o.depth); c[k] = (c[k] || 0) + 1; } return { n: s.children.list.length, ne: s.enemies.length, b: s.bullets.count, top: Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6) }; });
for (let t = 0; t <= secs; t += 15) {
  if (t) { await g.page.waitForFunction(() => { const s = window.__dw.scene; return !s.cutscene && !s.paused; }, { timeout: 45000 }).catch(() => {}); await g.eval(() => { window.__dw.api.heal(); window.__ff(900); }); }
  const c = await census(); console.log(t, c.n, 'enemies', c.ne, 'bul', c.b, JSON.stringify(c.top));
}
console.log('errors', g.errors.slice(0, 5));
await g.close();
