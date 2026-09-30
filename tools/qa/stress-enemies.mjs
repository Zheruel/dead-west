// STRESS (enemies): spawn a pack of enemies on a floor in god mode and watch entity/bullet counts, heap and fps for 60 s (leaks, crashes).
//   node tools/qa/stress-enemies.mjs [floor=2] [id,id,...]   e.g.  stress-enemies.mjs 3 miner,bat,bat,mole,coffin,coffin
import { launch } from './harness.mjs';
const floor = +(process.argv[2] || 2);
const DEFAULT = { 1: 'coyote,coyote,rattlesnake,tumbleweed,outlaw,buzzard', 2: 'ghost,ghost,skeleton,skeleton,possessed,possessed', 3: 'miner,bat,bat,mole,coffin,coffin',
  4: 'hellhound,hellsteer,cinder_skull,magma_eel,sulfur_preacher,magma_golem', 5: 'handcar_bandit,signalman,steam_stoker,crate_mimic,rail_rat,chain_gang', 6: 'card_shark,loaded_die,slot_fiend,waiter_imp,bouncer,joker' }; // QA-2: F4-F6 packs
const ids = (process.argv[3] || DEFAULT[floor]).split(',');
const g = await launch({ query: '?debug=1&seed=42', name: 'stress-enemies', width: 720, height: 480, quiet: true });
await g.startRun();
await g.eval((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); }, floor);
await g.wait(800);
await g.eval((ids) => { const a = window.__dw.api; ids.forEach((id, i) => a.spawn(id, 300 + i * 150, 300 + (i % 2) * 300)); }, ids);
let crashed = false;
for (let i = 0; i < 60; i++) {
  await g.wait(1000);
  try {
    const st = await g.eval(() => { const s = window.__dw.scene; return { n: s.enemies.length, b: s.bullets.count, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0, fps: Math.round(s.game.loop.actualFps), ch: s.children.length }; });
    if (i % 5 === 0) console.log(i, JSON.stringify(st));
  } catch (e) { console.log('CRASH at', i, e.message.slice(0, 80)); crashed = true; break; }
}
console.log('errors', g.errors.slice(0, 5));
await g.close().catch(() => {});
process.exit(crashed || g.errors.length ? 1 : 0);
