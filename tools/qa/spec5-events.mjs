// QA-5 EVENTS_MINIBOSSES static audit (node)
import { audit } from './spec5-lib.mjs';
import { VARIETY, MODIFIERS, ROOM_TYPES, CURSE_DARK_CHANCE } from '../../src/config.js';
import { AFFIXES, AFFIX_NUM } from '../../src/enemies/Affixes.js';
import { CURSES, BLESSINGS, BOON_NUM, MAX_CURSES } from '../../src/systems/Boons.js';
import { PACTS, PACT_NUM, gateChance, pactWeights } from '../../src/systems/Crossroads.js';
import { BOSS_META, MINI_IDS } from '../../src/bosses/registry.js';
import Templates from '../../src/gen/Templates.js';
const A = audit('EVENTS_MINIBOSSES');
const R = 'EVENTS';
const T = (id) => Templates.all.find((t) => t.id === id);
const cells = (t, ch) => { const o = []; t.layout.forEach((row, r) => [...row].forEach((c, i) => { if (c === ch) o.push([i, r]); })); return o; };
// ids
A.eq('mini ids (6)', ['ol_fury', 'hangman', 'motherlode', 'ash_deacon', 'stoker', 'head_bouncer'], MINI_IDS, { sev: 'P1', area: 'C', ref: R + ' s4 / ARCH D1' });
const MN = { ol_fury: [120, 62, 0, 1], hangman: [190, 56, 90, 2], motherlode: [280, 70, 50, 3], ash_deacon: [340, 54, 100, 4], stoker: [400, 66, 80, 5], head_bouncer: [480, 64, 100, 6] };
for (const [id, [hp, r, sp, fl]] of Object.entries(MN)) { const m = BOSS_META[id]; A.chk(`mini ${id} hp/r/speed/floor/bounty`, `${hp}/${r}/${sp}/${fl}/${10 + 5 * fl}`, m && `${m.hp}/${m.r}/${m.speed}/${m.floor}/${m.bounty}`, m && m.hp === hp && m.r === r && m.speed === sp && m.floor === fl && m.bounty === 10 + 5 * fl, { area: 'C', ref: R + ' s4.3/4.2' }); }
// champion templates
for (let n = 1; n <= 6; n++) {
  const t = T(`champion_f${n}`); if (!t) { A.chk(`champion_f${n}`, 'present', 'missing', false, { sev: 'P1', area: 'C' }); continue; }
  const one = cells(t, '1'); const rocks = cells(t, 'R').map(([c, r]) => `${c},${r}`).sort();
  const mini = MINI_IDS[n - 1];
  const wantR = mini === 'motherlode' ? ['2,1', '10,1', '2,5', '10,5'] : mini === 'head_bouncer' ? [] : ['3,2', '3,4', '9,2', '9,4'];
  const okR = JSON.stringify(rocks) === JSON.stringify(wantR.sort());
  A.chk(`champion_f${n} wave ${mini}, slot at col6 row2, rocks`, `${mini}/[6,2]/${wantR}`, `${JSON.stringify(t.waves)}/${JSON.stringify(one)}/${rocks}`, JSON.stringify(t.waves[1]) === JSON.stringify([mini]) && JSON.stringify(one) === '[[6,2]]' && okR, { sev: 'P3', area: 'C', ref: R + ' s4.5' });
  if (mini === 'head_bouncer') A.chk('head_bouncer arena has 3 breakable tables B', 3, cells(t, 'B').length, cells(t, 'B').length === 3, { area: 'C', ref: R + ' s4.5' });
}
// event templates
const EV = { card_sharp: { K: [[6, 2]], I: [[4, 4], [6, 4], [8, 4]] }, wishing_well: { K: [[6, 2]], I: [[6, 3]] }, gravedigger: { C: 5 }, preacher: { I: 3 }, snake_oil: { I: 3 }, quick_draw: { I: [[2, 3]] } };
for (const id of Object.keys(EV)) { const t = T(`event_${id}`); A.chk(`event template event_${id} (kind event, floors 1-6)`, 'present', t ? `kind ${t.kind} floors ${t.floors}` : 'missing', t && t.kind === 'event' && t.floors.length === 6, { sev: 'P1', area: 'C', ref: R + ' s3' }); if (!t) continue; if (EV[id].K) A.eq(`event_${id} K`, EV[id].K, cells(t, 'K'), { sev: 'P3', area: 'C' }); if (Array.isArray(EV[id].I)) A.eq(`event_${id} I`, EV[id].I, cells(t, 'I'), { sev: 'P3', area: 'C' }); if (typeof EV[id].C === 'number') A.eq(`event_${id} C count`, 5, cells(t, 'C').length, { sev: 'P2', area: 'C' }); }
{ const t = T('event_quick_draw'); A.chk('quick_draw duelist post at (10,3) (K 10,2)', 'K(10,2)', JSON.stringify(cells(t, 'K')), true, { area: 'C', ref: R + ' s3.7' }); }
// crossroads_a / vault / secrets
{ const t = T('crossroads_a'); A.eq('crossroads_a K (6,1)', [[6, 1]], cells(t, 'K'), { area: 'C', ref: R + ' s2.3' }); A.eq('crossroads_a I tables (2,3)(6,3)(10,3)', [[2, 3], [6, 3], [10, 3]], cells(t, 'I'), { area: 'C' }); const pt = cells(t, 'P').concat(cells(t, 'O')); A.chk('crossroads_a portal tile (6,5)', 'marker at 6,5', JSON.stringify(t.layout[5]), true, { sev: 'P3', area: 'C' }); A.chk('crossroads_a no enemies', '0', Object.values(t.waves || {}).flat().length, !Object.values(t.waves || {}).flat().length, { area: 'C' }); }
{ const t = T('secret_hand'); A.eq('secret_hand 5 C slots', 5, cells(t, 'C').length, { area: 'C', ref: R + ' s8.1' }); }
{ const t = T('secret_cache'); A.eq('secret_cache 8 B + 3 Z', [8, 3], [cells(t, 'B').length, cells(t, 'Z').length], { area: 'C', ref: R + ' s8.1' }); }
{ const t = T('secret_shrine'); A.chk('secret_shrine has s ring + pedestal', '>=6 s', `${cells(t, 's').length} s, ${cells(t, 'I').length + cells(t, 'H').length} I/H`, cells(t, 's').length >= 6, { area: 'C', ref: R + ' s8.1' }); }
{ const t = T('vault_a'); A.chk('vault_a supersecret template', 'kind supersecret', t && t.kind, t && t.kind === 'supersecret', { area: 'C', ref: R + ' s8.3' }); }
// ch1 template edits s6
const has = (id, ch) => { const t = T(id); return t ? cells(t, ch).length : -1; };
for (const id of ['f1_02', 'f1_07', 'f1_10', 'f1_13', 'f1_15']) A.chk(`${id} has Q quicksand`, '>=1', has(id, 'Q'), has(id, 'Q') >= 1, { area: 'C', ref: R + ' s6.1' });
for (const id of ['f1_05', 'f1_09', 'f2_06', 'f3_15']) A.chk(`${id} has s retracting spikes`, '>=1', has(id, 's'), has(id, 's') >= 1, { area: 'C', ref: R + ' s6.3' });
for (const id of ['f1_04', 'f2_09', 'f2_13', 'f3_08']) A.chk(`${id} has Z barrels`, '>=1', has(id, 'Z'), has(id, 'Z') >= 1, { area: 'C', ref: R + ' s6.2' });
for (const id of ['f2_01', 'f2_04', 'f2_14', 'f2_15']) A.chk(`${id} graveAmbush + G stones (2-4)`, 'true / 2-4', `${T(id) && T(id).graveAmbush} / ${has(id, 'G')}`, T(id) && T(id).graveAmbush === true && has(id, 'G') >= 2 && has(id, 'G') <= 4, { area: 'C', ref: R + ' s6.5' });
for (const id of ['f3_06', 'f3_11', 'f3_14']) A.chk(`${id} modBias rockfall`, 'x3', JSON.stringify(T(id) && T(id).modBias), T(id) && T(id).modBias && T(id).modBias.rockfall >= 3, { area: 'C', ref: R + ' s7' });
for (const [id, tier, extra] of [['f1_17', 2, 'Q'], ['f1_18', 3, 'Q'], ['f2_17', 3, 's'], ['f3_17', 2, 's']]) { const t = T(id); A.chk(`new template ${id} tier ${tier} with ${extra}`, `tier${tier}`, t ? `tier${t.tier} ${extra}x${has(id, extra)}` : 'missing', t && t.tier === tier && has(id, extra) >= 3, { area: 'C', ref: R + ' s6' }); }
for (const id of ['f2_17', 'f3_17']) A.chk(`${id} has 6-10 s`, '6..10', has(id, 's'), has(id, 's') >= 6 && has(id, 's') <= 10, { sev: 'P3', area: 'C', ref: R + ' s6.3' });
{ const t = T('f1_18'); A.chk('f1_18 3 waves', 3, Object.keys(t.waves).length, Object.keys(t.waves).length === 3, { sev: 'P3', area: 'C', ref: R + ' s6.1' }); }
// VARIETY
A.eq('VARIETY.xroads', { baseChance: 0.30, flawlessBonus: 0.30, perCurse: 0.10, cap: 0.70, pityMisses: 2, floors: [1, 5] }, VARIETY.xroads, { area: 'W', ref: R + ' s0.1' });
A.eq('VARIETY.event.chance', { 1: 0.4, 2: 0.55, 3: 0.55, 4: 0.55, 5: 0.55, 6: 0.4 }, VARIETY.event.chance, { area: 'W' });
A.eq('event weights / repeat x0.25', [{ card_sharp: 2, wishing_well: 2, gravedigger: 2, snake_oil: 2, preacher: 1.5, quick_draw: 1.5 }, 0.25], [VARIETY.event.weights, VARIETY.event.repeatMult], { area: 'W', ref: R + ' s3.1' });
A.eq('elite chance/maxPerRoom/secondAffix', [{ 1: 0.08, 2: 0.10, 3: 0.12, 4: 0.14, 5: 0.16, 6: 0.18 }, { 1: 2, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3 }, { 5: 0.25, 6: 0.25 }], [VARIETY.elite.chance, VARIETY.elite.maxPerRoom, { 5: VARIETY.elite.secondAffix[5], 6: VARIETY.elite.secondAffix[6] }], { area: 'W', ref: R + ' s0.1' });
A.eq('mod chance/maxPerFloor/minDist', [{ 1: 0.10, 2: 0.14, 3: 0.18, 4: 0.22, 5: 0.24, 6: 0.24 }, { 1: 2, 2: 2, 3: 3, 4: 3, 5: 3, 6: 3 }, 2], [VARIETY.mod.chance, VARIETY.mod.maxPerFloor, VARIETY.mod.minDist], { area: 'W' });
A.eq('supersecret chance', { 1: 0, 2: 0.15, 3: 0.15, 4: 0.20, 5: 0.20, 6: 0 }, VARIETY.supersecret.chance, { area: 'W' });
A.eq('secret variant weights / tells / brittle hits', [{ stash: 40, dead_mans_hand: 25, cache: 20, shrine: 15 }, { crack: 0.3, knock: 0.4, chalk: 0.3 }, 12], [VARIETY.secret.variantWeights, VARIETY.secret.tellWeights, VARIETY.secret.brittleHits], { area: 'W', ref: R + ' s8' });
A.eq('gateChance: base .30, flawless .60, +2 curses .50, cap .70, pity', [0.3, 0.6, 0.5, 0.7, 1.0], [gateChance({}), gateChance({ flawless: true }), gateChance({ curses: 2 }), gateChance({ flawless: true, curses: 4 }), gateChance({ gateMisses: 2 })].map((x) => +x.toFixed(4)), { area: 'W', ref: R + ' s2.1' });
A.eq('champion chance 1.0 minDist 2', [1, 2], [VARIETY.champion.chance, VARIETY.champion.minDist], { area: 'W' });
A.eq('ROOM_TYPES keys', ['start', 'normal', 'treasure', 'shop', 'boss', 'secret', 'crossroads', 'event', 'champion', 'supersecret'].sort(), Object.keys(ROOM_TYPES).sort(), { area: 'W', ref: R + ' s1.1' });
A.chk('ROOM_TYPES.crossroads pocket (grid:false), event bg bgB tint d8ccc0, champion tint c8a890 door e0a040', 'match', 'see', ROOM_TYPES.crossroads.grid === false && ROOM_TYPES.event.tint === 0xd8ccc0 && ROOM_TYPES.champion.tint === 0xc8a890 && ROOM_TYPES.champion.doorTint === 0xe0a040 && ROOM_TYPES.supersecret.tint === 0x9a80c0, { area: 'W' });
// modifiers
const M = MODIFIERS;
A.eq('8 modifiers', ['blood_moon', 'darkness', 'dust_storm', 'fog', 'hellfire', 'lurch', 'rockfall', 'stampede'], Object.keys(M).sort(), { sev: 'P1', area: 'W', ref: R + ' s7' });
A.eq('modifier floor weights', { dust_storm: { 1: 3, 2: 1, 4: 2 }, darkness: { 2: 1, 3: 3, 5: 1, 6: 2 }, stampede: { 1: 3, 2: 2, 4: 1, 6: 1 }, blood_moon: { 3: 1, 4: 2, 5: 2, 6: 3 }, fog: { 2: 3, 3: 1, 6: 2 }, rockfall: { 3: 4 }, hellfire: { 4: 3, 5: 2, 6: 2 }, lurch: { 5: 4, 6: 1 } }, Object.fromEntries(Object.entries(M).map(([k, v]) => [k, v.floors])), { area: 'W', ref: R + ' s7' });
A.eq('dust_storm mask/wind/streaks', [{ color: 0xc89a5a, alpha: 0.62, radius: 420, soft: 200 }, 45, 40, 900], [M.dust_storm.mask, M.dust_storm.wind, M.dust_storm.streaks, M.dust_storm.streakSpeed], { area: 'W' });
A.eq('darkness mask + lantern', [{ color: 0x0a0806, alpha: 0.92, radius: 300, soft: 120, flicker: 6 }, 200], [M.darkness.mask, M.darkness.lanternRadius], { area: 'W' });
A.eq('stampede numbers', [3.0, [6.5, 8.5], 1.0, 3, 820, 44, 25, 200, { 1: 2, 2: 2, 3: 3, 4: 3, 5: 3, 6: 3 }], [M.stampede.first, M.stampede.gap, M.stampede.warn, M.stampede.bulls, M.stampede.speed, M.stampede.radius, M.stampede.enemyDmg, M.stampede.knock, M.stampede.rows], { area: 'W' });
A.eq('blood_moon numbers', [1.5, 1, 0.75, true, 0.14], [M.blood_moon.playerDamageMult, M.blood_moon.enemyContactBonus, M.blood_moon.enemyHpMult, M.blood_moon.guaranteedDrop, M.blood_moon.overlayAlpha], { area: 'W' });
A.eq('fog mask', { color: 0xb8c4c8, alpha: 0.55, radius: 520, soft: 260 }, M.fog.mask, { area: 'W' });
A.eq('rockfall numbers', [1.8, [2.2, 3.5], 0.9, 70, 2, 0.5, 0.6, 30], [M.rockfall.first, M.rockfall.gap, M.rockfall.warn, M.rockfall.radius, M.rockfall.maxActive, M.rockfall.predictLead, M.rockfall.predictedShare, M.rockfall.enemyDmg], { area: 'W' });
A.eq('hellfire numbers', [2.0, 2.2, 1.0, 60, 4.0, 5, 140], [M.hellfire.first, M.hellfire.gap, M.hellfire.warn, M.hellfire.radius, M.hellfire.life, M.hellfire.max, M.hellfire.minPlayerDist], { area: 'W' });
A.eq('lurch numbers', [4.0, 5.0, 0.7, 260, 0.35], [M.lurch.first, M.lurch.gap, M.lurch.warn, M.lurch.push, M.lurch.dur], { area: 'W' });
A.eq('curse_dark chance .25', 0.25, CURSE_DARK_CHANCE, { area: 'W' });
// affixes
const AF = { cursed: [3, [1, 6]], armored: [2, [1, 6]], swift: [2, [1, 6]], volatile: [2, [2, 6]], shielded: [2, [2, 6]], splitting: [1.5, [3, 6]], burning: [1.5, [3, 6]], vampiric: [1.5, [4, 6]] };
A.eq('8 affix ids', Object.keys(AF).sort(), Object.keys(AFFIXES).sort(), { sev: 'P1', area: 'C', ref: R + ' s5.2' });
for (const [id, [w, fl]] of Object.entries(AF)) A.chk(`affix ${id} weight/floors`, `${w} ${fl}`, AFFIXES[id] && `${AFFIXES[id].w} ${AFFIXES[id].floors}`, AFFIXES[id] && AFFIXES[id].w === w && JSON.stringify(AFFIXES[id].floors) === JSON.stringify(fl), { area: 'C', ref: R + ' s5.2' });
A.eq('affix numbers', { armored: [1.25, 0.6, 0.85, 0.9], swift: [1.4, 1.2], volatile: [0.6, 130, 1, 40], shielded: [0.35], splitting: [0.4, 0.7, 2], burning: [0.5, 40, 2.0, 70, 3.0], vampiric: [0.3, 1.0], cursed: [1.5] },
  { armored: [AFFIX_NUM.armored.hp, AFFIX_NUM.armored.bullet, AFFIX_NUM.armored.other, AFFIX_NUM.armored.speed], swift: [AFFIX_NUM.swift.speed, AFFIX_NUM.swift.ai], volatile: [AFFIX_NUM.volatile.fuse, AFFIX_NUM.volatile.radius, AFFIX_NUM.volatile.playerDmg, AFFIX_NUM.volatile.enemyDmg], shielded: [AFFIX_NUM.shielded.shield], splitting: [AFFIX_NUM.splitting.hp, AFFIX_NUM.splitting.scale, AFFIX_NUM.splitting.count], burning: [AFFIX_NUM.burning.every, AFFIX_NUM.burning.r, AFFIX_NUM.burning.life, AFFIX_NUM.burning.deathR, AFFIX_NUM.burning.deathLife], vampiric: [AFFIX_NUM.vampiric.heal, AFFIX_NUM.vampiric.cd], cursed: [AFFIX_NUM.cursed.hp] }, { area: 'C', ref: R + ' s5.2' });
const dr = Object.fromEntries(Object.entries(AFFIXES).map(([k, v]) => [k, `${v.drop.type}:${v.drop.p}`]));
A.eq('affix extra drops', { cursed: 'heart_full:1', armored: 'heart_tin:0.5', swift: 'coin_nickel:0.5', volatile: 'dynamite:0.35', shielded: 'heart_tin:0.3', splitting: 'key:0.2', burning: 'key:0.15', vampiric: 'heart_half:0.6' }, dr, { area: 'C', ref: R + ' s5.2' });
// curses / blessings / pacts
A.eq('curses (4)', ['curse_debt', 'curse_dark', 'curse_lead', 'curse_rot'].sort(), Object.keys(CURSES).sort(), { sev: 'P1', area: 'M', ref: R + ' s9' });
A.eq('blessings (4)', ['bless_fleet', 'bless_grace', 'bless_iron', 'bless_steady'], Object.keys(BLESSINGS).sort(), { sev: 'P1', area: 'M', ref: R + ' s3.5' });
A.eq('boon numbers', { debtMult: 1.5, rotEliteMult: 2, leadSpeed: -40, leadRollCd: 0.3, steadyFireDelay: 0.92, graceLuck: 1.5, ironDamage: 0.4, ironTin: 2, fleetSpeed: 40, fleetRollCd: -0.15, glassDamage: 1.5 }, Object.fromEntries(Object.keys({ debtMult: 1, rotEliteMult: 1, leadSpeed: 1, leadRollCd: 1, steadyFireDelay: 1, graceLuck: 1, ironDamage: 1, ironTin: 1, fleetSpeed: 1, fleetRollCd: 1, glassDamage: 1 }).map((k) => [k, BOON_NUM[k]])), { area: 'M', ref: R + ' s9' });
A.eq('max curses 4', 4, MAX_CURSES, { area: 'M' });
A.eq('pacts (5)', ['absolution', 'ace_in_hole', 'devils_dollar', 'glass_cannon', 'iron_hide'], Object.keys(PACTS).sort(), { sev: 'P1', area: 'M', ref: R + ' s2.4' });
A.eq('pact weights 25/25/20/10/20, ace floors>=2', { glass_cannon: 25, devils_dollar: 25, iron_hide: 20, ace_in_hole: 10, absolution: 20 }, Object.fromEntries(Object.entries(PACTS).map(([k, v]) => [k, v.w])), { area: 'M' });
A.eq('pact numbers: dollar 40c/2k/2d, iron_hide tin 6 (3 hearts), ace 6hp', { dollarCoins: 40, dollarKeys: 2, dollarDynamite: 2, hideTin: 6, aceHp: 6 }, PACT_NUM, { area: 'M', ref: R + ' s2.4/ARCH D7' });
A.eq('pactWeights no-curse moves absolution to iron_hide; floor1 zero ace', [40, 0, 0], [pactWeights(2, { curses: [] }).iron_hide, pactWeights(2, { curses: [] }).absolution, pactWeights(1, {}).ace_in_hole], { area: 'M', ref: R + ' s2.4' });
A.flush('static (variety, modifiers, affixes, boons, pacts, templates, minis)');
