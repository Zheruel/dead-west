// Hell's Welcome vs checkpoint ordering probe.
import { freshSave } from '../../src/core/Save.js';
import { open, waitScene, reseed, storedOf } from './qa1-lib.mjs';
const f = freshSave(); f.unlocks = { 'char:hunter': 1, 'char:preacher': 1 };
const g = await open('?seed=52&char=hunter', { save: f });
await g.tap('Enter', 80); await waitScene(g, 'Game', 30000); await g.wait(1500);
await g.eval(() => { const p = window.__dw.player; p.hp = 1; p.dynamite = 3; });
await g.eval(async () => { const flow = await import('/src/scenes/flow.js'); const s = window.__dw.scene; s.roomMgr.loadFloor(4); flow.afterFloorIntro(s, { from: 3, floor: 4 }); });
const snap = () => g.eval(() => { const s = window.__dw.scene, p = s.player; return { hp: p.hp, dyn: p.dynamite, hw: s.run.hellsWelcome, cs: s.run.checkpointSaved, cutscene: s.cutscene, t: Math.round(s.time.now) }; });
console.log('t0', await snap());
for (let i = 0; i < 8; i++) { await g.wait(2500); console.log('t+', (i + 1) * 2.5, await snap()); }
const cp = await g.eval(async () => { const { Save } = await import('/src/core/Save.js'); const c = Save.loadCheckpoint(); return c && { hp: c.hp, dyn: c.dyn, hw: c.run.hellsWelcome }; });
console.log('checkpoint', cp);
const stored = await storedOf(g);
await reseed(g, '', { save: stored });
await g.eval(() => window.__game.scene.getScene('Menu').list.select(0, true)); await g.wait(100); await g.tap('Enter', 80); await waitScene(g, 'Game', 30000); await g.wait(9000);
console.log('after CONTINUE (9 s)', await snap());
console.log(g.errors);
await g.close();
