// INT-3: a normal (non-debug) run plays the intro overlay via ending.js run:started. `node tools/qa/int3-intro.mjs`
import { launch } from './harness.mjs';
const g = await launch({ query: '?seed=42', name: 'int3i' });
await g.wait(1500);
await g.tap('Enter', 80);
await g.wait(6000);
console.log('active', JSON.stringify(await g.eval(() => window.__game.scene.getScenes(true).map((s) => s.scene.key))));
await g.shot('int3i');
console.log('errors', g.errors.length, g.errors.slice(0, 5));
await g.close();
