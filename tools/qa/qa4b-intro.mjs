// QA-4b: repro for stuck scene.cutscene after boss intro (fuzz). Real-time (no ff).
import { open, sleep } from './qa4-lib.mjs';
const g = await open('?debug=1&seed=79&char=gunslinger', { name: 'qa4b-intro' });
await g.startRun();
const st = () => g.eval(() => { const s = window.__dw.scene; const b = s.enemies.find((e) => e.isBoss); const hud = window.__game.scene.getScene('HUD'); const c = hud && (hud.cards || hud.cardsUI || Object.values(hud).find((v) => v && v.holdUntil !== undefined)); return { cut: s.cutscene, room: s.roomMgr.currentId, boss: b && b.id, bossActive: b && b.active, intro: !!s._introRelease, hold: c ? { u: c.holdUntil, f: c.holdFrom, s: c.holdSet, now: hud.time.now } : 'nocards', tr: s.transitioning }; });
const run = async (label, fn) => { await g.eval(() => { const a = window.__dw.api; a.godMode(true); a.setFloor(1); }); await sleep(1500); await fn(); for (let i = 0; i < 4; i++) { await sleep(2500); } console.log(label, JSON.stringify(await st())); };
await run('A bossRoom, wait 10s', async () => { await g.eval(() => window.__dw.api.bossRoom()); });
await run('B bossRoom then jump away at 1s', async () => { await g.eval(() => window.__dw.api.bossRoom()); await sleep(1000); await g.eval(() => window.__dw.api.teleport('r0')); });
await run('C bossRoom x2 at 1s', async () => { await g.eval(() => window.__dw.api.bossRoom()); await sleep(1000); await g.eval(() => { window.__dw.api.teleport('r0'); window.__dw.api.bossRoom(); }); });
await run('D bossRoom, +spawn boss at 1s', async () => { await g.eval(() => window.__dw.api.bossRoom()); await sleep(1000); await g.eval(() => window.__dw.api.spawn('cascabel')); });
await run('E bossRoom, clearRoom at 1s', async () => { await g.eval(() => window.__dw.api.bossRoom()); await sleep(1000); await g.eval(() => window.__dw.api.clearRoom()); });
await run('F bossRoom, killAll at 4s', async () => { await g.eval(() => window.__dw.api.bossRoom()); await sleep(4000); await g.eval(() => window.__dw.api.killAll()); });
console.log('errors', g.errors.filter((e) => !/favicon/.test(e)).slice(0, 5));
await g.close();
