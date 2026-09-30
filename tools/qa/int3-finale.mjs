// INT-3: Sixth Bullet finale runs to the End scene without errors. `node tools/qa/int3-finale.mjs`
import { launch } from './harness.mjs';
const g = await launch({ query: '?debug=1&seed=42&mode=hell', name: 'int3f' });
await g.startRun();
const started = await g.eval(() => { const gs = window.__game.scene.getScene('Game'); return window.__game.story.trueFinale ? window.__game.story.trueFinale() : null; });
console.log('started', started);
await g.wait(6000);
await g.shot('int3f-a');
console.log('texts', JSON.stringify(await g.eval(() => window.__game.scene.getScene('Game').children.list.filter((o) => o.type === 'Text' && o.text).map((o) => o.text).slice(-6))));
await g.wait(40000);
await g.shot('int3f-b');
console.log('active', JSON.stringify(await g.eval(() => window.__game.scene.getScenes(true).map((s) => s.scene.key))));
console.log('errors', g.errors.length, g.errors.slice(0, 5));
await g.close();
