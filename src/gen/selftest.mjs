// node src/gen/selftest.mjs  -> validates templates (structure + content checks) and 300 seeds of floor generation.
import { Templates } from './Templates.js';
import { runSelfTest } from './FloorGen.js';
import { checkTemplates, naturalSafety } from './templateCheck.mjs';
const { errors, warns, report } = checkTemplates();
if (errors.length) { console.error('TEMPLATE ERRORS:\n' + errors.join('\n')); process.exit(1); }
warns.forEach((w) => console.warn('warn: ' + w));
report.forEach((r) => console.log(r));
const nat = Templates.all.filter((t) => t.kind === 'normal').map(naturalSafety);
console.log(`templates OK (${Templates.all.length}); wave-1 slots already >=300px from all doors: ${(100 * nat.reduce((a, b) => a + b, 0) / nat.length).toFixed(0)}% (rest relocated at runtime)`);
const res = runSelfTest(300);
console.log(res.ok ? `floorgen OK (${res.count} floors)` : 'floorgen FAILED:\n' + res.errors.slice(0, 10).join('\n'));
process.exit(res.ok ? 0 : 1);
