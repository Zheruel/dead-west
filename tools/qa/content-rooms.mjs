// Screenshot tour of the content rooms with the REAL art (INT-4): per floor the event room, the champion room (mini-boss), the secret variants, the vault and
// the Crossroads pocket. Writes art/qa/int4/rooms_<floor>_<what>.png and prints the room ids + any console errors.
//   node tools/qa/content-rooms.mjs [--floors=1,2,3,4,5,6] [--seed=42] [--noassets] [--dropassets=40]
import fs from 'node:fs';
import { launch } from './harness.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const floors = String(flags.floors || '1,2,3,4,5,6').split(',').map(Number);
const SEED = +(flags.seed || 42);
fs.mkdirSync('art/qa/int4', { recursive: true });
const query = `?debug=1&seed=${SEED}${flags.noassets ? '&noassets=1' : ''}${flags.dropassets ? `&dropassets=${flags.dropassets === true ? 40 : flags.dropassets}` : ''}`;
const g = await launch({ query, name: 'content-rooms', quiet: true });
await g.startRun();
await g.eval(() => {
  window.__t = 100000;
  window.__ff = (n) => { const game = window.__game, scs = game.scene.getScenes(false); game.loop.sleep(); const vis = scs.map((s) => s.sys.settings.visible); scs.forEach((s) => (s.sys.settings.visible = false)); for (let i = 0; i < n; i++) { const gs = window.__dw && window.__dw.scene; if (gs && gs.fx) gs.fx.hitStopUntil = 0; window.__t += 16.667; game.step(window.__t, 16.667); } scs.forEach((s, k) => (s.sys.settings.visible = vis[k])); };
});
const shot = async (name) => { await g.eval(() => { window.__ff(20); window.__game.loop.wake(); }); await g.wait(500); const f = `art/qa/int4/rooms_${name}.png`; await g.page.screenshot({ path: f }); console.log('shot', f); };
for (const fl of floors) {
  await g.eval((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); a.openAll(); }, fl);
  await g.wait(800);
  await g.page.waitForFunction(() => { const s = window.__dw.scene; return !s.cutscene && !s.transitioning; }, { timeout: 30000 }).catch(() => {});
  await g.eval(() => window.__ff(420));
  const info = await g.eval(() => { const f = window.__dw.floor; const o = {}; for (const r of f.rooms) (o[r.type] = o[r.type] || []).push(r.id + (r.event ? ':' + r.event : '') + (r.variant ? ':' + r.variant : '') + (r.mini ? ':' + r.mini : '')); return { rooms: o, xroads: !!f.xroads }; });
  console.log(`floor ${fl}`, JSON.stringify(info.rooms), 'xroads', info.xroads);
  for (const type of ['event', 'champion', 'secret', 'supersecret', 'treasure']) {
    const ids = info.rooms[type] || [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i].split(':')[0];
      await g.eval((id) => { const a = window.__dw.api; a.godMode(true); a.jump(id); }, id);
      await g.eval(() => window.__ff(200));
      await shot(`${fl}_${type}${ids.length > 1 ? i : ''}_${ids[i].split(':').slice(1).join('_')}`);
      if (type === 'champion') { await g.eval(() => window.__ff(300)); await shot(`${fl}_${type}_fight`); }
    }
  }
  if (info.xroads) {
    await g.eval(() => { window.__dw.api.godMode(true); window.__dw.api.enterCrossroads(); });
    await g.wait(1200);
    await g.eval(() => window.__ff(400));
    await shot(`${fl}_xroads`);
  }
}
console.log('errors:', g.errors.length, g.errors.slice(0, 5));
await g.close();
