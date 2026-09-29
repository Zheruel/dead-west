import { boot } from './spec-lib.mjs';
const g = await boot('?debug=1&seed=5');
const wait = (ms) => g.wait(ms);
await g.eval(() => { const a = window.__dw.api, p = window.__dw.player; a.godMode(true); p.tin = 3; p.hp = 1; a.give(5); a.giveItem('whiskey_bottle'); });
await wait(300);
await g.eval(() => { const a = window.__dw.api; const e = a.spawn('outlaw', 1000, 450, { cursed: true }); a.spawn('skeleton', 900, 700); a.spawn('rattlesnake', 400, 400); });
await wait(1600);
await g.eval(() => { const sc = window.__dw.scene; for (let i = 0; i < 20; i++) window.__step(1, 33.3); });
await g.shot('spec_d1_lowhp');
// explosion
await g.eval(() => { const p = window.__dw.player; p.hp = 6; p.teleport(500, 600); window.__dw.api.godMode(false); p.hurtT = 0; p.entryInv = 0; p.placeDynamite(); for (let i = 0; i < 40; i++) window.__step(1, 33.3); });
await g.shot('spec_d1_boom');
console.log('errors', g.errors);
await g.close();
