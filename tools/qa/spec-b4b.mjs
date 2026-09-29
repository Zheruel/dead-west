import { boot } from './spec-lib.mjs';
const g = await boot('?debug=1&seed=11');
const wait = (ms) => g.wait(ms);
await g.eval(() => window.__dw.api.godMode(true));
await g.eval(() => window.__dw.api.bossRoom());
await wait(4000);
await g.eval(() => { const b = window.__dw.scene.room.boss; b.invulnerable = false; window.__b = b; b.hurt(b.maxHp + 1, {}); });
for (let i = 0; i < 8; i++) {
  await wait(1000);
  console.log(i, JSON.stringify(await g.eval(() => { const r = window.__dw.scene.room; return { trap: !!r.trapdoor, st: r.state.trapdoor, ped: r.pedestals.length, pick: r.pickups.length, cleared: r.state.cleared, dying: window.__b.dying, alive: window.__b.alive, ts: window.__dw.scene.timeScale }; })));
}
await g.shot('spec_b4b');
console.log('errors', g.errors);
await g.close();
