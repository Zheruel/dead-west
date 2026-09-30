// QA-2: aggregate qa2-bot jsonl for Chapter 2: node tools/qa/qa2-report.mjs art/qa/qa2bot-*.jsonl
import fs from 'node:fs';
const runs = process.argv.slice(2).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f1 = (x) => Math.round(x * 10) / 10;
console.log('runs', runs.length, 'complete', runs.filter((r) => r.result === 'complete').length, 'softlock', runs.filter((r) => r.result === 'softlock').length, 'botcrash', runs.filter((r) => r.result === 'botcrash').length);
for (const F of [4, 5, 6]) {
  const rs = runs.filter((r) => r.floorT && r.floorT[F] != null);
  const dur = rs.map((r) => (r.floorT[F + 1] != null ? r.floorT[F + 1] : (r.result === 'complete' ? r.simT : null)) - r.floorT[F]).filter((x) => x != null && x > 0 && !isNaN(x));
  const pk = rs.map((r) => r.pk && r.pk[F] || {});
  const sum = (k) => pk.map((p) => p[k] || 0);
  const full = runs.filter((r) => r.floorT && r.floorT[F] != null && (r.floorT[F + 1] != null || (F === 6 && r.result === 'complete')));
  const fpk = full.map((r) => r.pk && r.pk[F] || {});
  const coinVal = fpk.map((p) => (p.coin || 0) + 5 * (p.coin_nickel || 0));
  console.log(`  FULL-FLOOR runs n=${full.length}: coin value/floor mean ${f1(mean(coinVal))} med ${f1(med(coinVal))}; hearts (half+full*2, tin excl) ${f1(mean(fpk.map((p) => (p.heart_half || 0) + 2 * (p.heart_full || 0))))} half-hearts; keys ${f1(mean(fpk.map((p) => p.key || 0)))}`);
  const rooms = runs.flatMap((r) => r.rooms).filter((x) => x.floor === F && x.start != null);
  const byType = {};
  for (const x of rooms) { const k = x.type; (byType[k] = byType[k] || []).push(x); }
  console.log(`\nF${F}: reached by ${rs.length}, floor time median ${f1(med(dur))}s mean ${f1(mean(dur))}s (n=${dur.length})`);
  const kinds = [...new Set(pk.flatMap((p) => Object.keys(p)))];
  console.log('  pickups/run:', kinds.map((k) => `${k} ${f1(mean(sum(k)))}`).join(' | '));
  const inflow = rs.map((r) => r.floorIn && r.floorIn[F]).filter(Boolean);
  console.log('  arrival hp/maxHp mean', f1(mean(inflow.map((x) => x.hp))), '/', f1(mean(inflow.map((x) => x.maxHp))), 'coins', f1(mean(inflow.map((x) => x.coins))), 'items', f1(mean(inflow.map((x) => x.items))));
  for (const [t, a] of Object.entries(byType)) { const c = a.filter((x) => x.clear != null); console.log(`  ${t}: n=${a.length} cleared ${Math.round(100 * c.length / a.length)}% clear time med ${f1(med(c.map((x) => x.clear - x.start)))}s dmg/room ${f1(mean(a.map((x) => x.dmg || 0)))}`); }
}
const evs = {}; for (const r of runs) for (const e of r.ev || []) evs[e.e] = (evs[e.e] || 0) + 1; console.log('\nevents', JSON.stringify(evs));
const cs = runs.flatMap((r) => (r.ev || []).filter((e) => e.e === 'item' && e.floor >= 4)); const bySrc = {}; for (const e of cs) bySrc[e.source] = (bySrc[e.source] || 0) + 1; console.log('items picked F4+ by source', JSON.stringify(bySrc));
