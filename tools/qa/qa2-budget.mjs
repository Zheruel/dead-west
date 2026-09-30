// QA-2: encounter budgets of F4-F6 normal templates vs CHAPTER2 s6 (threat costs, tier budgets per wave, waves per room, sum <= 26). Pure node.
import Templates from '../../src/gen/Templates.js';
const COST = { hellhound: 2, hellsteer: 3, cinder_skull: 1, magma_eel: 2, sulfur_preacher: 2, magma_golem: 4, handcar_bandit: 2, signalman: 2, steam_stoker: 3, crate_mimic: 2, rail_rat: 0.5, chain_gang: 4, card_shark: 2, loaded_die: 2, slot_fiend: 3, waiter_imp: 1.5, bouncer: 4, joker: 2 };
const BUD = { 1: [6, 8], 2: [9, 12], 3: [13, 17] };
const all = Templates.all;
let bad = 0;
for (const F of [4, 5, 6]) {
  const ts = all.filter((t) => t.kind === 'normal' && (t.floors || []).includes(F) && new RegExp(`^f${F}_n`).test(t.id));
  const tiers = { 1: 0, 2: 0, 3: 0 };
  console.log(`F${F}: ${ts.length} normal templates`);
  for (const t of ts) {
    tiers[t.tier]++;
    const ws = Object.entries(t.waves || {}).sort((a, b) => a[0] - b[0]);
    const sums = ws.map(([, l]) => l.reduce((a, id) => a + (COST[id] ?? (console.log('  unknown cost', t.id, id), 0)), 0));
    const tot = sums.reduce((a, b) => a + b, 0), [lo, hi] = BUD[t.tier] || [0, 99];
    const issues = [];
    sums.forEach((s, i) => { if (s < lo - 0.01 || s > hi + 0.01) issues.push(`wave${i + 1}=${s} outside ${lo}-${hi}`); });
    if (t.tier >= 2 && ws.length < 2) issues.push('tier2+ needs >=2 waves');
    if (ws.length > 3) issues.push('>3 waves');
    if (tot > 26) issues.push(`sum ${tot} > 26`);
    if (issues.length) { bad++; console.log(`  ${t.id} tier${t.tier} waves ${sums.join('/')}: ${issues.join('; ')}`); }
  }
  console.log(`  tiers ${JSON.stringify(tiers)}`);
}
console.log('templates out of budget:', bad);
