import { boot } from './spec-lib.mjs';
const g = await boot('?debug=1&seed=11');
const wait = (ms) => g.wait(ms);
await g.eval(() => { const a = window.__dw.api; a.godMode(true); a.setFloor(3); });
await wait(1500);
await g.eval(() => window.__dw.api.bossRoom());
await wait(3500);
await g.eval(() => { const b = window.__dw.scene.room.boss; b.invulnerable = false; window.__dw.player.teleport(300, 528); b.hurt(b.maxHp + 1, {}); });
await wait(3000); await g.shot('spec_b5_fin1');
await wait(3000); await g.shot('spec_b5_fin2');
for (let i = 0; i < 6; i++) { await wait(1500); const a = await g.eval(() => ['Game', 'End', 'Menu'].filter((k) => window.__game.scene.isActive(k))); console.log(i, a); if (a.includes('End')) break; }
await wait(4500);
await g.shot('spec_b5_end');
console.log(JSON.stringify(await g.eval(() => JSON.parse(localStorage.getItem('deadwest.save.v1')))));
console.log('errors', g.errors);
await g.close();
