// Robustness QA: boss dies, player dies within 1.4 s -> music must be the death track, not the floor bed.
import { launch } from './harness.mjs';
const g = await launch({ query: '?debug=1&seed=6', name: 'rb-music', quiet: true });
await g.startRun();
const r = await g.eval(async () => {
  const a = window.__dw.api, s = window.__dw.scene, p = s.player;
  const { Music } = await import('/src/core/Audio.js');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  a.godMode(true); a.bossRoom(); await sleep(4500);
  const boss = s.enemies.find((e) => e.isBoss);
  const { bus } = await import('/src/core/events.js');
  bus.once('boss:defeated', () => setTimeout(() => { p.shieldLeft = 0; a.godMode(false); a.die(); }, 300));
  boss.hp = 1; boss.damage ? boss.damage(999, {}) : boss.die({});
  await sleep(2600); // boss.finishDeath at 1700 ms
  const before = Music.current();
  await sleep(200);
  const dying = Music.current();
  await sleep(2000);
  return { before, dying, after: Music.current(), ended: s.ended, dead: p.dead };
});
console.log(JSON.stringify(r), 'errors', g.errors.length);
await g.close();
