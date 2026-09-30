// Robustness QA: boss dies, player dies within 1.4 s -> music must be the death track, not the floor bed.
// Condition-based waits (not fixed sleeps) so it also holds on a machine that runs the game at a few fps.
import { launch } from './harness.mjs';
const g = await launch({ query: '?debug=1&seed=6', name: 'rb-music', quiet: true });
await g.startRun();
const r = await g.eval(async () => {
  const a = window.__dw.api, s = window.__dw.scene, p = s.player;
  const { Music } = await import('/src/core/Audio.js');
  const { bus } = await import('/src/core/events.js');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 90000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(100); } return false; };
  a.godMode(true); a.bossRoom();
  await until(() => s.enemies.find((e) => e.isBoss && e.active));
  const boss = s.enemies.find((e) => e.isBoss);
  let defeated = false;
  bus.once('boss:defeated', () => { defeated = true; setTimeout(() => { p.shieldLeft = 0; a.godMode(false); a.die(); }, 300); });
  boss.hp = 1; boss.damage ? boss.damage(999, {}) : boss.die({});
  await until(() => defeated);
  const before = Music.current();
  await until(() => p.dead || s.ended, 30000);
  await sleep(2500); // past the director's 1.4 s floor-track restore: it must have been suppressed
  const after = Music.current();
  return { before, after, ended: s.ended, dead: p.dead, ok: p.dead && after === 'mus_death' };
});
console.log(JSON.stringify(r), 'errors', g.errors.length);
await g.close();
process.exit(r.ok && g.errors.length === 0 ? 0 : 1);
