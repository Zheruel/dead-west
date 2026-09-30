// QA-5 CH2 audit: floors 4-6 template quotas / budgets vs CHAPTER2 s6. Node only.
import Templates from '../../src/gen/Templates.js';
import { ENEMY_META } from '../../src/enemies/registry.js';
const out = [];
const log = (s) => { out.push(s); console.log(s); };
const fl = { 4: 'f4', 5: 'f5', 6: 'f6' };
const TIER_BUDGET = { 1: [6, 8], 2: [9, 12], 3: [13, 17] };
const threat = (id) => (id === 'possessed' ? 1.5 : (ENEMY_META[id]?.threat ?? null));
let total = 0;
for (const f of [4, 5, 6]) {
  const all = Templates.all.filter((t) => t.floors.includes(f));
  const norm = all.filter((t) => t.kind === 'normal');
  const bosses = all.filter((t) => t.kind === 'boss');
  total += norm.length + bosses.length;
  const ids = norm.map((t) => t.id).sort();
  const want = Array.from({ length: 14 }, (_, i) => `${fl[f]}_n${String(i + 1).padStart(2, '0')}`);
  log(`F${f}: normals=${norm.length} idsOK=${JSON.stringify(ids) === JSON.stringify(want)} boss=${bosses.map((b) => b.id)} onlyThisFloor=${norm.every((t) => t.floors.length === 1 && t.floors[0] === f)}`);
  const tiers = { 1: 0, 2: 0, 3: 0 }; norm.forEach((t) => tiers[t.tier]++);
  log(`  tiers ${JSON.stringify(tiers)} (want 4/6/4)`);
  const q = { L: 0, V: 0, lavaSpit: 0, eel: 0, lanes: 0, T: 0, handLane: 0, chand: 0, roul: 0, both_lt3: 0, cartLanes: 0, ghostLanes: 0 };
  for (const t of norm) {
    if (t.counts.L) q.L++; if (t.counts.V) q.V++; if (t.lavaSpit) q.lavaSpit++;
    const en = Object.values(t.waves).flat();
    if (en.includes('magma_eel')) q.eel++;
    if (t.lanes && t.lanes.length) { q.lanes++; if (en.includes('handcar_bandit')) q.handLane++; }
    if (t.counts.T) q.T++;
    if (t.chandelier) q.chand++;
    if (t.roulette) { q.roul++; }
    if (t.roulette && t.chandelier && t.tier < 3) q.both_lt3++;
    // lane rows painted with rails
    for (const ln of t.lanes || []) {
      const line = ln.axis === 'h' ? t.grid[ln.index] : t.grid.map((r) => r[ln.index]);
      const railCh = ln.axis === 'h' ? '=' : '|';
      const painted = line.every((c) => c === railCh || c === '|' || c === '=' || /[1-9RPdB]/.test(c) || c === '.');
      const railN = line.filter((c) => c === '=' || c === '|').length;
      if (railN < 10) log(`  WARN ${t.id} lane ${ln.axis}@${ln.index} rail-painted tiles=${railN}/${line.length}`);
      if (ln.period < 5.5 || ln.period > 8) log(`  NOTE ${t.id} lane period ${ln.period} outside 5.5-8.0`);
      if (ln.offset < 2.0 && ln.kind === 'cart') log(`  NOTE ${t.id} lane offset ${ln.offset} < 2.0`);
    }
    // lane offset >=1.5 apart, adjacent rows not together
    const L = t.lanes || [];
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      if (Math.abs(L[i].offset - L[j].offset) < 1.5) log(`  NOTE ${t.id} lanes ${i},${j} offsets <1.5 apart`);
    }
    // roulette region size
    if (t.roulette) {
      let minc = 99, maxc = -1, minr = 99, maxr = -1, n = 0;
      t.grid.forEach((row, r) => row.forEach((ch, c) => { if (ch === 'r' || ch === 'k') { n++; minc = Math.min(minc, c); maxc = Math.max(maxc, c); minr = Math.min(minr, r); maxr = Math.max(maxr, r); } }));
      log(`  ${t.id} roulette region ${maxc - minc + 1}x${maxr - minr + 1} tiles=${n} (want 3x3..5x3)`);
    }
    // waves / budget
    const wk = Object.keys(t.waves).map(Number).sort();
    const perWave = wk.map((w) => t.waves[w].reduce((s, id) => s + (id === 'chain_gang' ? 4 : threat(id) ?? 99), 0));
    // rail_rat pack: a pack counts by number of rats (0.5 each)
    const sum = perWave.reduce((a, b) => a + b, 0);
    const b = TIER_BUDGET[t.tier];
    const bad = perWave.map((p, i) => (i === 0 ? (p >= b[0] && p <= b[1]) : true)); // check total-per-wave-range below
    log(`  ${t.id} tier${t.tier} waves=${wk.length} perWave=${perWave.join('/')} sum=${sum}  n=${t.waves && wk.map((w) => t.waves[w].length).join('/')} slots=${wk.map((w) => (t.slots.waves[w] || []).length).join('/')}`);
    if (wk.length < 1 || wk.length > 3) log(`  FAIL ${t.id} waves count ${wk.length}`);
    if (t.tier >= 2 && wk.length < 2) log(`  FAIL ${t.id} tier2+ needs >=2 waves`);
    if (sum > 26) log(`  FAIL ${t.id} sum ${sum} > 26`);
    for (const w of wk) { const pw = perWave[wk.indexOf(w)]; if (pw < b[0] - 0.01 || pw > b[1] + 0.01) log(`  NOTE ${t.id} wave ${w} threat ${pw} outside tier budget ${b}`); }
    for (const w of wk) if ((t.slots.waves[w] || []).length !== t.waves[w].length) log(`  NOTE ${t.id} wave ${w}: ${t.waves[w].length} enemies vs ${(t.slots.waves[w] || []).length} slots`);
  }
  log(`  QUOTAS ${JSON.stringify(q)}`);
  for (const b of bosses) log(`  BOSS ${b.id}\n    ` + b.layout.join('\n    '));
}
log(`TOTAL new templates f4-6 (normal+boss): ${total} (want 45)`);
log(`Total templates ${Templates.all.length}; validateAll errors: ${Templates.validateAll().length}`);
