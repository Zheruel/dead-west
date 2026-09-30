// FE-T2 static acceptance (pure node, no browser): floor 6 set (14 normals, tiers 4/6/4, chandelier >= 6, roulette >= 4, never both below tier 3, threat budgets),
// f6_boss arena, champion_f1..f6, the six event templates and their slot contracts, crossroads_a, vault_a, secret variants, the four new chapter-1 rooms,
// start / treasure / shop / secret on floors 1-6, and (informational) the derived stand-ins staying out of floors that have real templates.
//   node tools/qa/templates-t2.mjs
import { Templates } from '../../src/gen/Templates.js';
import { BOSS_META } from '../../src/bosses/registry.js';
import { ENEMY_META } from '../../src/enemies/registry.js';
import { DOORS, DIRS } from '../../src/config.js';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const T = (id) => Templates.get(id);
const THREAT = { possessed: 2, skeleton: 1.5 };
const threat = (id) => (ENEMY_META[id] && ENEMY_META[id].threat) || THREAT[id] || 2;
const roomThreat = (t) => Object.values(t.waves).flat().reduce((a, id) => a + threat(id), 0) + Object.values(t.air || {}).flat().reduce((a, [, , id]) => a + threat(id), 0);
const BUDGET = { 1: [6, 8], 2: [9, 12], 3: [13, 17] };

// ---- floor 6
const f6 = Templates.all.filter((t) => t.kind === 'normal' && t.floors.includes(6));
ok(f6.length === 14, `F6 has 14 real normals (${f6.length})`);
ok(f6.every((t) => /^f6_n\d\d$/.test(t.id) && !t.derived), 'F6 ids f6_nNN, none derived');
const tiers = [1, 2, 3].map((k) => f6.filter((t) => t.tier === k).length);
ok(tiers.join('/') === '4/6/4', `F6 tiers 4/6/4 (${tiers.join('/')})`);
const chand = f6.filter((t) => t.chandelier), roul = f6.filter((t) => t.roulette);
ok(chand.length >= 6, `F6 chandelier rooms >= 6 (${chand.length})`);
ok(roul.length >= 4, `F6 roulette rooms >= 4 (${roul.length})`);
ok(f6.filter((t) => t.roulette && (t.counts.r || 0) + (t.counts.k || 0) === 0).length === 0, 'every roulette:true room has r/k tiles');
ok(f6.filter((t) => !t.roulette && ((t.counts.r || 0) + (t.counts.k || 0)) > 0).length === 0, 'no r/k tiles without roulette:true (normals)');
ok(f6.every((t) => !(t.roulette && t.chandelier) || t.tier === 3), 'roulette + chandelier only in tier 3: ' + f6.filter((t) => t.roulette && t.chandelier).map((t) => t.id).join(','));
for (const t of f6) {
  const th = roomThreat(t), [lo, hi] = BUDGET[t.tier], waves = Object.keys(t.slots.waves).length;
  ok(th >= lo && th <= hi && th <= 26, `${t.id} tier ${t.tier} threat ${th} in ${lo}-${hi}`);
  if (t.tier >= 2) ok(waves >= 2, `${t.id} has >= 2 waves (${waves})`);
  if (t.roulette) {
    // region = bounding box of r/k tiles: filled, 3..9 wide x 3 tall per patch, checkerboard
    const cells = [];
    t.grid.forEach((row, r) => row.forEach((ch, c) => { if (ch === 'r' || ch === 'k') cells.push([c, r, ch]); }));
    const alt = cells.every(([c, r, ch]) => { const nb = cells.filter(([c2, r2]) => Math.abs(c2 - c) + Math.abs(r2 - r) === 1); return nb.every(([, , ch2]) => ch2 !== ch); });
    ok(alt && cells.length >= 9, `${t.id} roulette tiles alternate red/black (${cells.length} tiles)`);
    ok(cells.every(([, r]) => r >= 2 && r <= 4), `${t.id} roulette confined to rows 2-4 (lanes 0-1 and 5-6 stay clear)`);
  }
}
const boss = T('f6_boss');
ok(boss && boss.boss === 'scratch' && !boss.roulette && !boss.chandelier, 'f6_boss: scratch arena, no auto hazards (the boss calls them)');
ok(boss && boss.counts.R === 4 && boss.counts.r + boss.counts.k >= 18 && boss.slots.waves[1].length === 1, 'f6_boss: 4 slot machines, wheel, one boss slot');
ok(boss && boss.grid.every((row, r) => row.every((ch, c) => (r >= 2 && r <= 4 && c >= 3 && c <= 9) || (ch !== 'r' && ch !== 'k'))), 'f6_boss: roulette only inside cols 3-9 x rows 2-4');

// ---- champions
for (let f = 1; f <= 6; f++) {
  const t = T(`champion_f${f}`), mini = Object.keys(BOSS_META).find((k) => BOSS_META[k].mini && BOSS_META[k].floor === f);
  ok(t && !t.fallback && t.kind === 'champion' && t.floors.join() === String(f) && t.waves[1][0] === mini && t.slots.waves[1].length === 1, `champion_f${f} -> ${mini}`);
  ok(t && t.slots.waves[1][0].c === 6 && t.slots.waves[1][0].r === 2, `champion_f${f} spawn slot at (6,2)`);
}
ok(T('champion_f6').counts.R == null && T('champion_f6').counts.B === 3, 'champion_f6: 3 tables, no rocks');
ok(T('champion_f3').counts.R === 4 && T('champion_f3').grid[3].every((c) => c === '.'), 'champion_f3: row 3 clear for the cart lane');

// ---- events, crossroads, vault, secrets
const EV = { card_sharp: { I: 3 }, wishing_well: { I: 1 }, gravedigger: { I: 1, C: 5 }, preacher: { I: 3 }, snake_oil: { I: 3 }, quick_draw: { I: 1 } };
for (const [id, want] of Object.entries(EV)) {
  const t = T(`event_${id}`);
  ok(t && !t.fallback && t.kind === 'event' && t.floors.length === 6 && t.slots.K.length === 1, `event_${id}: real, floors 1-6, one K`);
  ok(Object.entries(want).every(([ch, n]) => t.slots[ch].length === n), `event_${id}: slots ${JSON.stringify(want)}`);
  const I = t.slots.I;
  const spread = I.every((a, i) => I.every((b, j) => i >= j || Math.hypot(a.c - b.c, a.r - b.r) * 96 >= 180));
  ok(spread, `event_${id}: interaction spots >= 180 px apart`);
  ok(!/B/.test(t.layout.join('')), `event_${id}: no breakable crates`);
}
const cr = T('crossroads_a');
ok(cr && !cr.fallback && cr.slots.K.length === 1 && cr.slots.I.length === 3 && cr.slots.K[0].c === 6 && cr.slots.K[0].r === 1 && cr.slots.I.map((s) => `${s.c},${s.r}`).join(' ') === '2,3 6,3 10,3', 'crossroads_a: K (6,1), I (2,3) (6,3) (10,3), real');
const va = T('vault_a');
ok(va && !va.fallback && va.slots.I.length === 2 && va.kind === 'supersecret', 'vault_a: two pedestals, real');
for (const [id, v] of [['secret_hand', 'dead_mans_hand'], ['secret_cache', 'cache'], ['secret_shrine', 'shrine']]) {
  const t = T(id);
  ok(t && !t.fallback && t.variant === v && t.floors.length === 6, `${id}: real ${v}, floors 1-6`);
}
ok(T('secret_hand').slots.C.length === 5, 'hand: 5 C');
ok(T('secret_cache').counts.B === 8 && T('secret_cache').counts.Z === 3, 'cache: 8 B + 3 Z');
{ // one blast chains everything: every B within r130 + half a tile of some Z, and the Z's form one chain (radius check as Room.explodeAt)
  const t = T('secret_cache'), pts = (ch) => t.grid.flatMap((row, r) => row.map((c, cc) => (c === ch ? [cc * 96, r * 96] : null)).filter(Boolean));
  const Z = pts('Z'), B = pts('B'), reach = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 130 + 48;
  ok(B.every((b) => Z.some((z) => reach(z, b))), 'cache: every crate is inside a barrel blast');
  const seen = new Set([0]); for (let k = 0; k < 3; k++) Z.forEach((z, i) => { if (seen.has(i)) Z.forEach((z2, j) => { if (reach(z, z2)) seen.add(j); }); });
  ok(seen.size === Z.length, 'cache: the three barrels chain');
}
ok(T('secret_shrine').counts.s === 8 && T('secret_shrine').slots.I.length === 1, 'shrine: pedestal ringed by 8 spikes');

// ---- chapter 1 additions
for (const [id, floor, tier] of [['f1_17', 1, 2], ['f1_18', 1, 3], ['f2_17', 2, 3], ['f3_17', 3, 2]]) {
  const t = T(id), hz = id.startsWith('f1') ? 'Q' : 's';
  ok(t && t.kind === 'normal' && t.floors.join() === String(floor) && t.tier === tier, `${id}: floor ${floor} tier ${tier}`);
  ok((t.counts[hz] || 0) >= 6 && (t.counts[hz] || 0) <= (hz === 'Q' ? 30 : 10), `${id}: ${t.counts[hz]} '${hz}' tiles`);
  // informational: slots that touch the hazard (walkers there just start slowed / next to the spikes; the safe-spawn check covers fairness)
  let near = 0;
  for (const [d, list] of Object.entries(t.slots.waves)) for (const s of list) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const ch = (t.grid[s.r + dr] || [])[s.c + dc]; if (ch === hz) near++; }
  console.log(`info ${id}: ${near} slot/hazard neighbour pairs`);
}
ok(Object.values(T('f1_17').waves).flat().length === 6 && Object.keys(T('f1_18').slots.waves).length === 3, 'f1_17 / f1_18 wave counts');

// ---- floors 1-6 coverage of the shared kinds
for (let f = 1; f <= 6; f++) {
  const real = (k) => Templates.all.filter((t) => t.kind === k && t.floors.includes(f) && !t.fallback);
  ok(real('start').length >= 3 && real('treasure').length >= 4 && real('shop').length >= 3 && real('secret').length >= 6, `floor ${f}: start ${real('start').length} treasure ${real('treasure').length} shop ${real('shop').length} secret ${real('secret').length}`);
  ok(real('champion').length === 1 && real('boss').length >= 1, `floor ${f}: one real champion + a boss template`);
}
// door fronts of every template i own stay clear (validator already enforces; summary)
const mine = Templates.all.filter((t) => /^(f6_|champion_|event_|f1_1[78]|f2_17|f3_17|secret_(hand|cache|shrine)|vault_a)/.test(t.id));
ok(mine.every((t) => DIRS.every((d) => !/[^.dX]/.test(t.grid[DOORS[d].tile[1]][DOORS[d].tile[0]] + t.grid[DOORS[d].front[1]][DOORS[d].front[0]]))), `${mine.length} templates keep every door tile + front tile plain`);
console.log(fails ? `\n${fails} FAILED` : '\nall FE-T2 static checks passed');
process.exit(fails ? 1 : 0);
