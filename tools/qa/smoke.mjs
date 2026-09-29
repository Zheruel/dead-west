// Smoke test: boot → start → wait → screenshot → errors. `node tools/qa/smoke.mjs [query]`
import { launch } from './harness.mjs';
const g = await launch({ query: process.argv[2] || '?debug=1&seed=42', name: 'smoke' });
await g.shot('smoke-menu');
await g.startRun();
await g.holdMany(['KeyD'], 600);
await g.hold('ArrowRight', 500);
const fps = await g.eval(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2000) res(n / 2); else requestAnimationFrame(f); }; f(); }));
await g.shot('smoke-game');
console.log('fps', fps, 'errors', g.errors.length, g.errors.slice(0, 5));
console.log('state', JSON.stringify(await g.dw()));
await g.close();
