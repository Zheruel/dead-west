// Aggregate bot jsonl results: node tools/qa/bot-report.mjs art/qa/bot-a.jsonl [more.jsonl ...]
import fs from 'node:fs';
const runs = [];
for (const f of process.argv.slice(2)) for (const l of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) runs.push(JSON.parse(l));
const n = runs.length;
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0) + '%';
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const f1 = (x) => Math.round(x * 10) / 10;
const won = runs.filter((r) => r.result === 'complete').length;
const cleared = (f) => runs.filter((r) => r.floor > f || r.result === 'complete').length;
const reached = (f) => runs.filter((r) => r.floor >= f || r.result === 'complete').length;
console.log(`runs ${n}: complete ${won} (${pct(won, n)}) | softlock ${runs.filter((r) => r.result === 'softlock').length} | timeout ${runs.filter((r) => r.result === 'timeout').length} | console errors ${runs.filter((r) => r.errors && r.errors.length).length}`);
console.log(`survived floor1 ${pct(cleared(1), n)} | floor2 ${pct(cleared(2), n)} (cumulative; conditional ${pct(cleared(2), cleared(1))}) | floor3+boss ${pct(won, n)} (conditional ${pct(won, cleared(2))})`);
const dead = runs.filter((r) => r.death);
const by = {};
for (const r of dead) { const k = `F${r.death.floor} ${r.death.boss ? 'BOSS ' + r.death.boss : r.death.room} by ${r.death.by}`; by[k] = (by[k] || 0) + 1; }
console.log('deaths:', Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}x ${k}`).join('; ') || 'none');
// per floor/type stats
const rows = {};
for (const r of runs) for (const x of r.rooms) {
  if (x.start == null) continue; // not a combat room
  const k = `F${x.floor} ${x.type}`;
  (rows[k] = rows[k] || { t: [], dmg: [], n: 0, cleared: 0 });
  rows[k].n++;
  if (x.clear != null) { rows[k].cleared++; rows[k].t.push(x.clear - x.start); }
  rows[k].dmg.push(x.dmg);
}
console.log('\nroom stats (encounter start -> clear; clear time only for cleared rooms):');
for (const k of Object.keys(rows).sort()) { const v = rows[k]; console.log(`  ${k.padEnd(12)} n=${String(v.n).padStart(3)} clear ${pct(v.cleared, v.n).padStart(4)}  time mean ${String(f1(mean(v.t))).padStart(5)}s med ${String(f1(med(v.t))).padStart(5)}s  dmg/room ${f1(mean(v.dmg))}`); }
// per template
const tp = {};
for (const r of runs) for (const x of r.rooms) { if (x.start == null || x.type !== 'normal') continue; const k = x.tpl; (tp[k] = tp[k] || { n: 0, dmg: 0, t: [] }); tp[k].n++; tp[k].dmg += x.dmg; if (x.clear != null) tp[k].t.push(x.clear - x.start); }
const tl = Object.entries(tp).filter(([, v]) => v.n >= 3).map(([k, v]) => [k, v.dmg / v.n, mean(v.t), v.n]).sort((a, b) => b[1] - a[1]);
console.log('\nhardest normal templates (dmg/visit, mean clear s, n):', tl.slice(0, 8).map(([k, d, t, c]) => `${k} ${f1(d)}/${f1(t)}s/${c}`).join(' | '));
console.log('easiest:', tl.slice(-4).map(([k, d, t, c]) => `${k} ${f1(d)}/${f1(t)}s/${c}`).join(' | '));
// damage by source
const src = {};
for (const r of runs) for (const d of r.dmg) { const k = d.boss ? `boss:${d.floor}` : d.src; src[k] = (src[k] || 0) + d.u; }
const tot = Object.values(src).reduce((a, b) => a + b, 0);
console.log('\ndamage by source (units, % of total):', Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${v} (${pct(v, tot)})`).join(', '));
// floor time & economy
for (const f of [1, 2, 3]) {
  const ts = runs.filter((r) => r.floorT && r.floorT[f] != null).map((r) => { const next = r.floorT[f + 1]; const end = next != null ? next : r.result === 'complete' || r.result === 'death' ? r.simT : null; return end != null ? end - r.floorT[f] : null; }).filter((x) => x != null);
  const pk = {}; let c = 0;
  for (const r of runs) if (r.pk && r.pk[f]) { c++; for (const [t, v] of Object.entries(r.pk[f])) pk[t] = (pk[t] || 0) + v; }
  console.log(`floor ${f}: mean time ${f1(mean(ts))}s | pickups/run ${Object.entries(pk).map(([t, v]) => `${t}:${f1(v / Math.max(1, c))}`).join(' ')}`);
}
console.log(`mean run time ${f1(mean(runs.filter((r) => r.result === 'complete').map((r) => r.simT)))}s (complete runs) | mean items at end ${f1(mean(runs.map((r) => r.items.length)))} | mean total dmg ${f1(mean(runs.map((r) => r.dmgTaken)))}`);
