// QA-5 CHAPTER2 static audit (node): enemy/boss meta, floors, gen params, template quotas/budgets, reward economy, ids.
import { audit } from './spec5-lib.mjs';
import { FLOORS, FLOOR_GEN, MAX_FLOOR, INTERLUDE_AFTER, CHAPTER_OF, ROOM_REWARD, rewardFor, PLAYER_BASE } from '../../src/config.js';
import { ENEMY_META, CHAPTER2_ENEMY_IDS } from '../../src/enemies/registry.js';
import { BOSS_META } from '../../src/bosses/registry.js';
import Templates from '../../src/gen/Templates.js';
const A = audit('CHAPTER2');
const REF = 'CHAPTER2';
// s3-s5 enemy tables: id [hp, r, speed, weight, tags, floors, frame]
const E = {
  hellhound: [14, 30, 250, 3, ['fire'], [4], 128], hellsteer: [26, 44, 90, 2, ['fire'], [4], 160], cinder_skull: [8, 24, 190, 3, ['fire', 'undead'], [4], 96],
  magma_eel: [22, 30, 200, 0, ['fire'], [4], 128], sulfur_preacher: [16, 28, 70, 1, [], [4], 128], magma_golem: [40, 48, 55, 1.5, ['fire'], [4], 160],
  handcar_bandit: [20, 34, 180, 2, [], [5], 160], signalman: [14, 26, 90, 2, ['undead'], [5], 128], steam_stoker: [34, 42, 65, 1.5, [], [5], 160],
  crate_mimic: [22, 34, 0, 1, [], [5], 128], rail_rat: [4, 16, 290, 3, [], [5], 64], chain_gang: [12, 26, 150, 1.5, ['undead'], [5], 128],
  card_shark: [18, 30, 100, 3, [], [6], 128], loaded_die: [22, 36, 240, 2, [], [6], 128], slot_fiend: [36, 44, 40, 1, [], [6], 160],
  waiter_imp: [10, 24, 150, 2.5, [], [6], 96], bouncer: [38, 46, 70, 1.5, [], [6], 160], joker: [16, 28, 120, 2, [], [6], 128],
};
const THREAT = { hellhound: 2, hellsteer: 3, cinder_skull: 1, magma_eel: 2, sulfur_preacher: 2, magma_golem: 4, handcar_bandit: 2, signalman: 2, steam_stoker: 3, crate_mimic: 2, rail_rat: 0.5, chain_gang: 4, card_shark: 2, loaded_die: 2, slot_fiend: 3, waiter_imp: 1.5, bouncer: 4, joker: 2 };
for (const [id, [hp, r, sp, w, tags, fl, fr]] of Object.entries(E)) {
  const m = ENEMY_META[id];
  if (!m) { A.chk(`enemy ${id} in ENEMY_META`, 'present', 'missing', false, { sev: 'P1', area: 'C', ref: REF + ' s3-5' }); continue; }
  const bad = [];
  if (m.hp !== hp) bad.push(`hp ${m.hp}/${hp}`); if (m.r !== r) bad.push(`r ${m.r}/${r}`); if (m.speed !== sp) bad.push(`speed ${m.speed}/${sp}`);
  if (m.weight !== w) bad.push(`weight ${m.weight}/${w}`); if (JSON.stringify([...(m.tags || [])].sort()) !== JSON.stringify([...tags].sort())) bad.push(`tags ${m.tags}/${tags}`);
  if (JSON.stringify(m.floors) !== JSON.stringify(fl)) bad.push(`floors ${m.floors}/${fl}`); if (m.frame !== fr) bad.push(`frame ${m.frame}/${fr}`);
  if (m.threat !== THREAT[id]) bad.push(`threat ${m.threat}/${THREAT[id]}`);
  A.chk(`enemy ${id} meta (hp r speed weight tags floors frame threat)`, `${hp}/${r}/${sp}/${w}/${tags}/${fl}/${fr}/${THREAT[id]}`, bad.length ? bad.join(', ') : 'match', !bad.length, { sev: 'P2', area: 'C', ref: REF + ' s3-6' });
}
A.eq('new enemy ids (18)', Object.keys(E).sort(), CHAPTER2_ENEMY_IDS.filter((i) => i !== 'duelist').sort(), { sev: 'P1', area: 'C', ref: REF + ' s15' });
A.eq('hellsteer charge 640', 640, ENEMY_META.hellsteer.charge, { area: 'C', ref: REF + ' s3 #2' });
A.eq('handcar laneSpeed 260', 260, ENEMY_META.handcar_bandit.laneSpeed, { area: 'C' });
A.eq('crate_mimic hop 400', 400, ENEMY_META.crate_mimic.hop, { area: 'C' });
A.eq('chain_gang charge 430', 430, ENEMY_META.chain_gang.charge, { area: 'C' });
A.eq('possessed floors incl 4,6 / skeleton 5,6 / ghost 5', [[2, 3, 4, 6], [2, 3, 5, 6], [2, 3, 5]], [ENEMY_META.possessed.floors, ENEMY_META.skeleton.floors, ENEMY_META.ghost.floors], { area: 'C', ref: REF + ' s3-5 returning' });
A.eq('signalman maxPerRoom 2', 2, ENEMY_META.signalman.maxPerRoom, { area: 'C', ref: REF + ' s4 #2' });
A.eq('contract_seal hp 60 noFloorScale', [60, true], [ENEMY_META.contract_seal.hp, ENEMY_META.contract_seal.noFloorScale], { area: 'C', ref: REF + ' s5 contract' });
// bosses
const B = { toro: [800, 92, 4, 'boss4'], engine: [980, 100, 5, 'boss5'], scratch: [1500, 62, 6, 'boss6'] };
for (const [id, [hp, r, fl, mus]] of Object.entries(B)) { const m = BOSS_META[id]; A.chk(`boss ${id} meta`, `hp${hp} r${r} f${fl} ${mus}`, m ? `hp${m.hp} r${m.r} f${m.floor} ${m.music}` : 'missing', m && m.hp === hp && m.r === r && m.floor === fl && m.music === mus, { area: 'C', ref: REF + ' s12' }); }
A.eq('engine stems', ['mus_boss5_a', 'mus_boss5_b', 'mus_boss5_c'], BOSS_META.engine.stems, { area: 'M', ref: REF + ' s4' });
A.eq('scratch stems', ['mus_boss6_a', 'mus_boss6_b', 'mus_boss6_c', 'mus_boss6_d'], BOSS_META.scratch.stems, { area: 'M', ref: REF + ' s5' });
A.eq('boss ids (3 ch1 + 3 ch2 + 6 minis = 12)', 12, Object.keys(BOSS_META).length, { area: 'C' });
// floors
const F = { 4: ['BRIMSTONE BLUFFS', "The Devil's front porch", 2.6, 0x7a2a1a, 'toro', 'mus_floor4', 'amb_lava'], 5: ['BLOOD RAIL', 'The midnight run never ends', 2.9, 0x2b3140, 'engine', 'mus_floor5', 'amb_rail'], 6: ['THE LAST CHANCE SALOON', 'The house always wins', 3.2, 0x5a1020, 'scratch', 'mus_floor6', 'amb_saloon'] };
for (const [n, v] of Object.entries(F)) { const f = FLOORS[n]; A.chk(`FLOORS[${n}]`, v.join('/'), f ? [f.name, f.subtitle, f.hpMult, f.tint, f.boss, f.music, f.ambience].join('/') : 'missing', f && [f.name, f.subtitle, f.hpMult, f.tint, f.boss, f.music, f.ambience].join('/') === v.join('/'), { area: 'W', ref: REF + ' s3-5' }); A.chk(`FLOORS[${n}] bg keys + obst + bgC`, `bg_f${n}_a/b/c/boss obst_f${n}`, [FLOORS[n].bgA, FLOORS[n].bgB, FLOORS[n].bgC, FLOORS[n].bgBoss, FLOORS[n].obst].join(','), [FLOORS[n].bgA, FLOORS[n].bgB, FLOORS[n].bgC, FLOORS[n].bgBoss, FLOORS[n].obst].join(',') === `bg_f${n}_a,bg_f${n}_b,bg_f${n}_c,bg_f${n}_boss,obst_f${n}`, { area: 'W' }); }
A.eq('MAX_FLOOR/INTERLUDE_AFTER/CHAPTER_OF(3,4)', [6, 3, 1, 2], [MAX_FLOOR, INTERLUDE_AFTER, CHAPTER_OF(3), CHAPTER_OF(4)], { area: 'W', ref: REF + ' s1' });
A.eq('FLOOR_GEN normals F4/F5/F6', [[7, 8], [8, 9], [9, 10]], [FLOOR_GEN[4].normals, FLOOR_GEN[5].normals, FLOOR_GEN[6].normals], { sev: 'P3', area: 'W', ref: REF + ' s2 (impl: F5 [9,9] core 11-12 per ARCH D11)' });
A.eq('FLOOR_GEN shopChance 1/.7/1 ; core 10-11/11-12/12-13', [[1, 0.7, 1], [[10, 11], [11, 12], [12, 13]]], [[4, 5, 6].map((n) => FLOOR_GEN[n].shopChance), [4, 5, 6].map((n) => FLOOR_GEN[n].core)], { area: 'W', ref: REF + ' s2/s13.1' });
// economy
const R = rewardFor(4);
A.eq('reward ch2: pityRooms 2, nickel .20, heart weights', [2, 0.2, { heart_half: 26, heart_full: 12, heart_tin: 10, coin: 30, coin_nickel: 12, key: 6, dynamite: 4 }], [R.pityRooms, R.enemyNickel, R.pickupWeights], { area: 'W', ref: REF + ' s7' });
A.eq('reward ch1 unchanged pity 3 nickel .15', [3, 0.15], [rewardFor(3).pityRooms, rewardFor(3).enemyNickel], { area: 'W', ref: REF + ' s7' });
A.eq('shop prices F4-6', { passive: [15, 20], active: [20, 25], heart_full: 4, heart_tin: 6, key: 6, dynamite: 6 }, R.shop, { area: 'W', ref: REF + ' s7' });
// templates
const thr = (id) => THREAT[id] ?? ({ skeleton: 1.5, ghost: 1.5, possessed: 1.5 }[id] ?? 99);
const TB = { 1: [6, 8], 2: [9, 12], 3: [13, 17] };
const all = Templates.all;
const normalsOf = (f) => all.filter((t) => t.kind === 'normal' && t.floors.includes(f) && t.id.startsWith(`f${f}_n`));
A.eq('validateAll errors', [], Templates.validateAll(), { sev: 'P1', area: 'C', ref: REF + ' s13.1' });
let totalNew = 0, budgetOff = [], sumOff = [], waveOff = [], perWaveOff = 0, perWaveTot = 0;
for (const f of [4, 5, 6]) {
  const norm = normalsOf(f), bosses = all.filter((t) => t.kind === 'boss' && t.floors.includes(f));
  totalNew += norm.length + bosses.length;
  A.eq(`F${f} normals 14, tiers 4/6/4, boss f${f}_boss`, [14, [4, 6, 4], [`f${f}_boss`]], [norm.length, [1, 2, 3].map((k) => norm.filter((t) => t.tier === k).length), bosses.map((b) => b.id)], { sev: 'P1', area: 'C', ref: REF + ' s6' });
  for (const t of norm) {
    const wk = Object.keys(t.waves).map(Number).sort();
    const per = wk.map((w) => t.waves[w].reduce((s, id) => s + thr(id), 0));
    const sum = per.reduce((a, b) => a + b, 0);
    if (wk.length < 1 || wk.length > 3 || (t.tier >= 2 && wk.length < 2)) waveOff.push(`${t.id}:${wk.length}w`);
    if (sum > 26) sumOff.push(`${t.id}:${sum}`);
    const b = TB[t.tier]; if (sum < b[0] - 0.01 || sum > b[1] + 0.01) budgetOff.push(`${t.id}(T${t.tier})=${sum}`);
    for (const p of per) { perWaveTot++; if (p < b[0] - 0.01 || p > b[1] + 0.01) perWaveOff++; }
  }
}
A.eq('45 new templates', 45, totalNew, { sev: 'P1', area: 'C', ref: REF + ' s6' });
A.chk('wave counts 1-3 (>=2 for tier2+)', 'none off', waveOff.join(','), !waveOff.length, { area: 'C', ref: REF + ' s6' });
A.chk('sum of threat across waves <= 26', 'all <=26', sumOff.join(','), !sumOff.length, { area: 'C', ref: REF + ' s6' });
A.chk('threat sum per template in tier budget (sum over waves)', 'all in range', budgetOff.join(', '), !budgetOff.length, { sev: 'P3', area: 'C', ref: REF + ' s6' });
A.chk('DOC-LITERAL budget is per wave: waves outside tier range', '0', `${perWaveOff}/${perWaveTot} waves`, perWaveOff === 0, { sev: 'P3', area: 'C', ref: REF + ' s6 ("Budget per wave sum"); impl+headers use sum over waves' });
// quotas
const q4 = { L: 0, V: 0, spit: 0, eel: 0 }, q5 = { lanes: 0, T: 0, hand: 0 }, q6 = { chand: 0, roul: 0, both_lt3: 0, roulSizes: [] };
for (const t of normalsOf(4)) { const en = Object.values(t.waves).flat(); if (t.counts.L) q4.L++; if (t.counts.V) q4.V++; if (t.lavaSpit) q4.spit++; if (en.includes('magma_eel')) q4.eel++; if (en.includes('magma_eel') && (t.counts.L || 0) < 3) A.chk(`${t.id} eel needs >=3 L`, '>=3', t.counts.L, false, { sev: 'P1', area: 'C' }); }
for (const t of normalsOf(5)) { const en = Object.values(t.waves).flat(); if (t.lanes && t.lanes.length) { q5.lanes++; if (en.includes('handcar_bandit')) q5.hand++; } if (t.counts.T) q5.T++; }
for (const t of normalsOf(6)) { if (t.chandelier) q6.chand++; if (t.roulette) { q6.roul++; let mn = 99, mx = -1, n = 0; t.grid.forEach((row) => row.forEach((ch, c) => { if (ch === 'r' || ch === 'k') { n++; mn = Math.min(mn, c); mx = Math.max(mx, c); } })); q6.roulSizes.push(`${t.id}:${mx - mn + 1}w`); } if (t.roulette && t.chandelier && t.tier < 3) q6.both_lt3++; }
A.chk('F4 quotas L>=8 V>=4 lavaSpit>=3 eel==3', '>=8/>=4/>=3/3', JSON.stringify(q4), q4.L >= 8 && q4.V >= 4 && q4.spit >= 3 && q4.eel >= 3, { area: 'C', ref: REF + ' s6' });
A.chk('F5 quotas lanes>=8 T>=3 lane-handcar>=3', '>=8/>=3/>=3', JSON.stringify(q5), q5.lanes >= 8 && q5.T >= 3 && q5.hand >= 3, { area: 'C', ref: REF + ' s6' });
A.chk('F6 quotas chandelier>=6 roulette>=4 no both below tier 3', '>=6/>=4/0', JSON.stringify({ ...q6, roulSizes: undefined }), q6.chand >= 6 && q6.roul >= 4 && q6.both_lt3 === 0, { area: 'C', ref: REF + ' s6' });
A.chk('F6 roulette region width 3..5 (doc text; doc example is 9 wide)', '3x3..5x3', q6.roulSizes.join(' '), q6.roulSizes.every((s) => parseInt(s.split(':')[1]) <= 5), { sev: 'P3', area: 'C', ref: REF + ' s6 (doc self-contradiction: sample f6_n09 is 9 wide)' });
// arenas
const arena = (id) => all.find((t) => t.id === id);
const a4 = arena('f4_boss'), a5 = arena('f5_boss'), a6 = arena('f6_boss');
const cells = (t, ch) => { const o = []; t.layout.forEach((row, r) => [...row].forEach((c, i) => { if (c === ch) o.push([i, r]); })); return o; };
if (a4) { A.eq('f4_boss pillars R (3,2)(9,2)(3,4)(9,4)', [[3, 2], [3, 4], [9, 2], [9, 4]], cells(a4, 'R').sort(), { area: 'C', ref: REF + ' s3 arena' }); A.eq('f4_boss vents (2,3),(10,3)', [[10, 3], [2, 3]], cells(a4, 'V').sort(), { area: 'C' }); A.eq('f4_boss lava corners', 4, cells(a4, 'L').length, { area: 'C' }); A.eq('f4_boss spawn 1 centre', [[6, 3]], cells(a4, '1'), { area: 'C' }); }
else A.chk('f4_boss present', 'yes', 'no', false, { sev: 'P1' });
if (a5) { A.eq('f5_boss rails rows 2,4,6', [2, 4, 6], a5.layout.map((r, i) => (r.includes('=') ? i : -1)).filter((i) => i >= 0), { area: 'C', ref: REF + ' s4 arena' }); A.eq('f5_boss blocks (2,3)(10,3)(2,5)(10,5)', [[10, 3], [10, 5], [2, 3], [2, 5]], cells(a5, 'R').sort(), { area: 'C' }); A.eq('f5_boss pipes T (0,1),(12,1)', [[0, 1], [12, 1]], cells(a5, 'T').sort(), { area: 'C' }); A.eq('f5_boss spawn digit (6,1)', [[6, 1]], cells(a5, '1'), { sev: 'P3', area: 'C' }); }
if (a6) { A.eq('f6_boss slot blocks R (1,1)(11,1)(1,5)(11,5)', [[1, 1], [1, 5], [11, 1], [11, 5]], cells(a6, 'R').sort(), { area: 'C', ref: REF + ' s5 arena' }); A.eq('f6_boss spawn digit (6,1)', [[6, 1]], cells(a6, '1'), { sev: 'P3', area: 'C' }); const rk = cells(a6, 'r').concat(cells(a6, 'k')); A.chk('f6_boss roulette region cols 3-9 rows 2-4', '21 cells', rk.length, rk.length >= 20 && rk.every(([c, r]) => c >= 3 && c <= 9 && r >= 2 && r <= 4), { area: 'C' }); }
A.chk('every referenced enemy id registered', 'all', 'check', all.every((t) => Object.values(t.waves || {}).flat().every((id) => ENEMY_META[id] || BOSS_META[id])), { sev: 'P1', area: 'C' });
A.flush('static (registries, floors, templates, economy)');
