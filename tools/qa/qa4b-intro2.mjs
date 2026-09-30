import { open, sleep } from './qa4-lib.mjs';
const g = await open('?debug=1&seed=79&char=gunslinger', { name: 'qa4b-intro2' });
await g.startRun();
const st = () => g.eval(() => { const s = window.__dw.scene; const hud = window.__game.scene.getScene('HUD'); const c = hud.widgets.find((w) => w.holdUntil !== undefined); return { cut: s.cutscene, room: s.roomMgr.currentId, intro: !!s._introRelease, hold: c ? { u: Math.round(c.holdUntil), f: Math.round(c.holdFrom), s: c.holdSet, now: Math.round(hud.time.now), live: c.bossLive } : 'nocards' }; });
const T = +(process.argv[2] || 3);
for (const t of [1.5, 2.5, 3.2, 3.6, 4.0, 4.4, 5.0]) {
  await g.eval(() => { const a = window.__dw.api; a.godMode(true); a.setFloor(1); }); await sleep(1500);
  await g.eval(() => window.__dw.api.bossRoom()); await sleep(t * 1000);
  const mid = await st();
  await g.eval(() => { window.__dw.api.teleport('r0'); }); await sleep(200);
  await g.eval(() => { window.__dw.api.bossRoom(); }); await sleep(9000);
  console.log('t=' + t, 'mid', JSON.stringify(mid), 'end', JSON.stringify(await st()));
}
console.log('errors', g.errors.filter((e) => !/favicon/.test(e)).slice(0, 5));
await g.close();
