// QA-2: do enemy drops land on lava tiles (magma_eel dies in lava)? Spawns/kills N eels on lava tiles in an F4 lava room, reports pickups on lava.
import { launch } from './harness.mjs';
const g = await launch({ query: '?debug=1&seed=12', name: 'qa2-eel', quiet: true });
await g.startRun();
await g.eval(() => { window.__t = 100000; window.__ff = (n) => { const game = window.__game, scs = game.scene.getScenes(false); game.loop.sleep(); const vis = scs.map((s) => s.sys.settings.visible); scs.forEach((s) => (s.sys.settings.visible = false)); for (let i = 0; i < n; i++) { const gs = window.__dw.scene; if (gs && gs.fx) gs.fx.hitStopUntil = 0; window.__t += 16.667; game.step(window.__t, 16.667); } scs.forEach((s, k) => (s.sys.settings.visible = vis[k])); }; window.__dw.api.setFloor(4); window.__dw.api.godMode(true); });
await g.wait(1500); await g.eval(() => window.__ff(420));
const rooms = await g.eval(() => window.__dw.scene.roomMgr.floor.rooms.map((r) => [r.id, r.template || (r.def && r.def.template) || r.tpl]));
console.log('rooms', JSON.stringify(rooms).slice(0, 400));
let found = null;
for (const [id] of rooms) {
  await g.eval((id) => { window.__dw.api.jump(id); }, id); await g.wait(300); await g.eval(() => window.__ff(300));
  const n = await g.eval(() => { const r = window.__dw.scene.room; let n = 0; for (const row of r.tiles) for (const t of row) if (t && t.type === 'lava') n++; return n; });
  if (n) { found = id; console.log('lava room', id, 'lava tiles', n); break; }
}
if (!found) { console.log('no lava room'); await g.close(); process.exit(0); }
const res = await g.eval(() => {
  const s = window.__dw.scene, r = s.room, a = window.__dw.api; a.killAll(); r.clearRoom && 0;
  const lava = []; for (const row of r.tiles) for (const t of row) if (t && t.type === 'lava') lava.push(t);
  const stat = { kills: 0, dropsOnLava: 0, drops: 0, ex: [] };
  s.player.stats.luck = 50; // force drops
  for (let i = 0; i < 60; i++) {
    const t = lava[i % lava.length];
    const e = a.spawn('magma_eel', t.x, t.y); if (!e) continue;
    e.x = t.x; e.y = t.y; e.hp = 0; e.die({}); stat.kills++;
  }
  window.__ff(60);
  const pk = (r.pickups || s.pickups || []);
  for (const p of pk) { if (!p || p.alive === false) continue; stat.drops++; const c = Math.floor((p.x - 96) / 96), rr = Math.floor((p.y - 192) / 96); const t = r.tiles[rr] && r.tiles[rr][c]; if (t && t.type === 'lava') { stat.dropsOnLava++; if (stat.ex.length < 4) stat.ex.push([p.type, Math.round(p.x), Math.round(p.y)]); } }
  return stat;
});
console.log(JSON.stringify(res));
console.log('errors', g.errors.slice(0, 3));
await g.close();
