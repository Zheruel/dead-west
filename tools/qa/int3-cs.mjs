// INT-3: CharSelect hell toggle emits title:hell and shows the mode hint. `node tools/qa/int3-cs.mjs`
import { launch } from './harness.mjs';
const g = await launch({ query: '?debug=1&seed=42&unlockall=1', name: 'int3cs' });
await g.wait(1500);
console.log('active', JSON.stringify(await g.eval(() => window.__game.scene.getScenes(true).map((s) => s.scene.key))));
await g.eval(async () => { const { bus } = await import('/src/core/events.js'); window.__hell = []; bus.on('title:hell', (p) => window.__hell.push(p.on)); });
await g.eval(() => window.__game.scene.getScene('Menu').scene.start('CharSelect'));
await g.wait(900);
await g.eval(() => window.__game.scene.getScene('CharSelect').setMode(1));
await g.wait(300);
await g.shot('int3cs-hell');
console.log('hell', JSON.stringify(await g.eval(() => window.__hell)), 'hint', await g.eval(() => window.__game.scene.getScene('CharSelect').modeHint.text));
console.log('errors', g.errors.length, g.errors.slice(0, 5));
await g.close();
