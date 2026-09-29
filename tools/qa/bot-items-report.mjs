// Aggregate art/qa/bot-item-*.jsonl: per-item completion, damage taken, floor reached, run time vs the item-less baseline.
import fs from 'node:fs';
const dir = 'art/qa';
const rows = [];
for (const f of fs.readdirSync(dir).filter((f) => /^bot-item-.*\.jsonl$/.test(f))) {
  const id = f.replace(/^bot-item-|\.jsonl$/g, '');
  const rs = fs.readFileSync(`${dir}/${f}`, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const n = rs.length, won = rs.filter((r) => r.result === 'complete').length;
  const avg = (fn) => rs.reduce((a, r) => a + fn(r), 0) / n;
  rows.push({ id, n, won: Math.round((won / n) * 100), flr: +avg((r) => (r.result === 'complete' ? 4 : r.floor)).toFixed(2), dmg: +avg((r) => r.dmgTaken).toFixed(1), t: Math.round(avg((r) => r.simT)), sl: rs.filter((r) => r.result === 'softlock').length, err: rs.filter((r) => r.errors && r.errors.length).length });
}
rows.sort((a, b) => b.flr - a.flr || a.dmg - b.dmg);
console.log('item                 n  win%  avgFloor  dmg   simT  softlock err');
for (const r of rows) console.log(`${r.id.padEnd(20)} ${String(r.n).padStart(2)} ${String(r.won).padStart(5)} ${String(r.flr).padStart(8)} ${String(r.dmg).padStart(6)} ${String(r.t).padStart(6)} ${String(r.sl).padStart(6)} ${String(r.err).padStart(4)}`);
