// node src/gen/selftest.mjs  -> validates templates (structure + content checks) and 300 seeds x floors 1-6 of floor generation.
import { Templates, parseTemplate, validateTemplate } from './Templates.js';
import { runSelfTest } from './FloorGen.js';
import { checkTemplates, naturalSafety } from './templateCheck.mjs';
const { errors, warns, report } = checkTemplates();
if (errors.length) { console.error('TEMPLATE ERRORS:\n' + errors.join('\n')); process.exit(1); }
warns.forEach((w) => console.warn('warn: ' + w));
report.forEach((r) => console.log(r));
const nat = Templates.all.filter((t) => t.kind === 'normal').map(naturalSafety);
console.log(`templates OK (${Templates.all.length}); wave-1 slots already >=300px from all doors: ${(100 * nat.reduce((a, b) => a + b, 0) / nat.length).toFixed(0)}% (rest relocated at runtime)`);
// validator negative cases (CHAPTER2 s2 / EVENTS s6 rules must reject these)
const base = ['.............', '.............', '.............', '.............', '.............', '.............', '.............'];
const withTile = (r, c, ch) => base.map((row, i) => (i === r ? row.slice(0, c) + ch + row.slice(c + 1) : row));
const bad = {
  'vent next to a door': { layout: withTile(1, 5, 'V') },
  'pipe off the outer edge': { layout: withTile(2, 3, 'T') },
  'roulette in front of a door': { layout: withTile(5, 6, 'r') },
  'quicksand on a door tile': { layout: withTile(3, 0, 'Q') },
  'lava wall cutting the doors apart': { layout: base.map((row, i) => (i === 3 ? 'LLLLLL.LLLLLL'.replace('.', 'L') : row)) },
  'lane index out of range': { layout: base, lanes: [{ axis: 'h', index: 9, period: 4, offset: 0, dir: 1, kind: 'cart' }] },
  'unknown char': { layout: withTile(2, 2, '?') },
};
for (const [name, def] of Object.entries(bad)) {
  if (!validateTemplate(parseTemplate({ id: 'neg', kind: 'normal', ...def })).length) { console.error(`validator accepted: ${name}`); process.exit(1); }
}
console.log(`validator rejects ${Object.keys(bad).length} malformed hazard layouts`);
const res = runSelfTest(300);
console.log(res.ok ? `floorgen OK (${res.count} floors)` : 'floorgen FAILED:\n' + res.errors.slice(0, 10).join('\n'));
process.exit(res.ok ? 0 : 1);
