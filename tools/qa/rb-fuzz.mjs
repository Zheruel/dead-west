// Robustness fuzz: random inputs + abused __dw.api hooks + pause/blur mashing, stepped manually (fast). usage: node tools/qa/rb-fuzz.mjs [chunks=20] [stepsPerChunk=6000] [seed=1] [mode=fuzz|goal] [query]
import fs from 'node:fs';
import { launch } from './harness.mjs';
const CH = +process.argv[2] || 20, N = +process.argv[3] || 6000, SEED = +process.argv[4] || 1, MODE = process.argv[5] || 'fuzz';
const q = process.argv[6] || `?debug=1&seed=${SEED}`;
const g = await launch({ query: q, name: 'rb-fuzz', quiet: true });
await g.startRun();
await g.page.evaluate(fs.readFileSync(new URL('./rb-engine.js', import.meta.url), 'utf8'));
await g.eval((seed, mode) => { window.__rb.seed(seed); window.__rb.cfg.goal = mode === 'goal' ? 1 : 0; if (mode === 'goal') window.__rb.cfg.api = 0.004; }, SEED, MODE);
const t0 = Date.now();
for (let c = 0; c < CH; c++) {
  const r = await g.eval((n) => window.__rb.run(n), N);
  console.log(`chunk ${c} ${JSON.stringify(r)} t=${Math.round((Date.now() - t0) / 1000)}s`);
}
const rep = await g.eval(() => window.__rb.report());
console.log('STATS', JSON.stringify(rep.stats), 'maxChildren', rep.maxChildren);
console.log('EXCEPTIONS', rep.errs.length);
for (const [k, n] of rep.errs) console.log(`  x${n} ${k.slice(0, 700)}`);
console.log('VIOLATIONS', rep.viol.length);
for (const [k, v] of rep.viol) console.log(`  x${v.n} ${k} ${JSON.stringify(v.extra || '')}`);
console.log('harness errors', g.errors.length, g.errors.slice(0, 5));
await g.close();
