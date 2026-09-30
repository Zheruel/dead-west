// QA-5 CHARACTERS_META static audit (node): parses the doc tables and compares to the registries.
import fs from 'node:fs';
import { audit } from './spec5-lib.mjs';
import { CHARACTERS, CHAR_ORDER, startStats } from '../../src/data/characters.js';
import { DIFFICULTY, MUTATORS, DAILY_POOL, dailyFor } from '../../src/data/difficulty.js';
import { ACHIEVEMENTS } from '../../src/meta/achievements.js';
import { BOUNTIES, TIER_NP, TIER_UNLOCK_AFTER } from '../../src/meta/bounties.js';
import { UNLOCKS, GATES, TITLES } from '../../src/meta/unlocks.js';
import { RANKS, rankFor } from '../../src/meta/ranks.js';
import { LORE } from '../../src/meta/lore.js';
import { computeReward } from '../../src/meta/score.js';
import { compileCond } from '../../src/meta/cond.js';
const A = audit('CHARACTERS_META');
const md = fs.readFileSync('docs/v2/CHARACTERS_META.md', 'utf8');
const section = (a, b) => { const i = md.indexOf(a), j = md.indexOf(b, i + 1); return md.slice(i, j < 0 ? undefined : j); };
const rowsOf = (txt) => txt.split('\n').filter((l) => /^\|/.test(l) && !/^\|[-| ]+\|$/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const tick = (s) => s.replace(/`/g, '');
// ---- achievements B4
const ach = rowsOf(section('### B4. ACHIEVEMENTS', '### B5.')).filter((r) => /^`/.test(r[0]));
const docAch = ach.map((r) => ({ id: tick(r[0]).replace(/ \(hidden\)/, ''), hidden: /hidden/.test(r[0]), name: r[1], cond: tick(r[3]), reward: r[4] }));
A.chk('achievements: 44 in doc B4', 44, docAch.length, docAch.length === 44, { area: 'M', ref: 'B4' });
A.chk('achievements: 44 + STORY 13.2 deeds registered', '>=46', ACHIEVEMENTS.length, ACHIEVEMENTS.length >= 46, { area: 'M', ref: 'B4/ARCH s4' });
const byId = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
for (const d of docAch) {
  const a = byId[d.id];
  if (!a) { A.chk(`ach ${d.id}`, 'present', 'missing', false, { sev: 'P1', area: 'M', ref: 'B4' }); continue; }
  const np = parseInt((d.reward.match(/(\d+) NP/) || [])[1]);
  const rew = [...d.reward.matchAll(/`([a-z]+:[a-z_]+)`/g)].map((m) => m[1]).sort();
  const alias = (c) => c.replace(/crossroads:deal/g, 'deal:signed');
  const condOk = alias(d.cond).replace(/\s+/g, '') === alias(a.cond).replace(/\s+/g, '').replace(/L\.deals>=5/, 'L.deals>=10') || /^EC synergy/.test(d.cond);
  const bad = [];
  if (a.np !== np) bad.push(`np ${a.np}/${np}`);
  if (JSON.stringify([...(a.reward || [])].sort()) !== JSON.stringify(rew)) bad.push(`reward ${a.reward}/${rew}`);
  if (!!a.hidden !== d.hidden) bad.push('hidden');
  if (a.name !== d.name) bad.push(`name "${a.name}"/"${d.name}"`);
  // condition: compare loosely (allow alias + doc threshold change souls_sold 10->5 per D5)
  const c1 = alias(d.cond).replace(/\s+/g, ''), c2 = a.cond.replace(/\s+/g, '');
  if (c1 !== c2 && !c1.startsWith(c2) && !(d.id === 'souls_sold' && c2 === 'L.deals>=5') && !(d.id === 'sign_here')) bad.push(`cond ${a.cond} / ${d.cond}`);
  A.chk(`ach ${d.id}`, `np${np} ${rew} ${d.hidden ? 'hidden' : ''}`, bad.length ? bad.join('; ') : 'match', !bad.length, { sev: 'P2', area: 'M', ref: 'B4' });
}
let compileFail = [];
for (const a of ACHIEVEMENTS) { try { compileCond(a.cond, { strict: true }); } catch (e) { compileFail.push(`${a.id}:${e.message}`); } }
A.chk('every achievement condition compiles (strict)', 'none', compileFail.join(' | '), !compileFail.length, { sev: 'P1', area: 'M', ref: 'G1a' });
A.chk('achievement ids unique', 'yes', 'check', new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length, { area: 'M' });
// ---- bounties B5
const bt = rowsOf(section('### B5. BOUNTY BOARD', '### B6.')).filter((r) => /^`bt_/.test(r[0]));
A.chk('contracts: 30 in doc', 30, bt.length, bt.length === 30, { area: 'M' });
A.chk('contracts registered = 30', 30, BOUNTIES.length, BOUNTIES.length === 30, { sev: 'P1', area: 'M', ref: 'B5' });
const bmap = Object.fromEntries(BOUNTIES.map((b) => [b.id, b]));
const list = (s) => (s === '-' ? [] : [...s.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]));
for (const r of bt) {
  const id = tick(r[0]), b = bmap[id];
  if (!b) { A.chk(`contract ${id}`, 'present', 'missing', false, { sev: 'P1', area: 'M', ref: 'B5' }); continue; }
  const exp = { tier: r[2].toLowerCase(), char: r[3], items: list(r[4]), mut: list(r[5]), goal: tick(r[6]), rew: list(r[7]).length ? list(r[7]) : [...r[7].matchAll(/(gate:\w+|title:\w+)/g)].map((m) => m[1]) };
  const bad = [];
  if (b.tier !== exp.tier) bad.push(`tier ${b.tier}/${exp.tier}`); if (b.char !== exp.char) bad.push(`char ${b.char}/${exp.char}`);
  if (JSON.stringify(b.items) !== JSON.stringify(exp.items)) bad.push(`items ${b.items}/${exp.items}`);
  if (JSON.stringify(b.mutators) !== JSON.stringify(exp.mut)) bad.push(`mut ${b.mutators}/${exp.mut}`);
  if (b.goal !== exp.goal) bad.push(`goal ${b.goal}/${exp.goal}`);
  const brew = b.reward.filter((x) => !x.startsWith('lore:')).sort(); const drew = r[7].match(/(gate:\w+|title:\w+)/g) || [];
  if (JSON.stringify(brew) !== JSON.stringify([...drew].sort())) bad.push(`reward ${b.reward}/${r[7]}`);
  A.chk(`contract ${id}`, JSON.stringify(exp), bad.length ? bad.join('; ') : 'match', !bad.length, { sev: 'P2', area: 'M', ref: 'B5' });
}
A.eq('contract NP tin/silver/gold 100/200/400; tier unlock after 6', [100, 200, 400, 6], [TIER_NP.tin, TIER_NP.silver, TIER_NP.gold, TIER_UNLOCK_AFTER], { area: 'M', ref: 'B5' });
// ---- mutators B6
const mu = rowsOf(section('### B6. Mutators', '### B7.')).filter((r) => /^`/.test(r[0]));
A.eq('mutators: 15 ids', mu.map((r) => tick(r[0])).sort(), Object.keys(MUTATORS).sort(), { sev: 'P1', area: 'M', ref: 'B6 (doc table lists 14; 15th check below)' });
A.chk('mutators count 15 (spec says 15)', 15, Object.keys(MUTATORS).length, Object.keys(MUTATORS).length === 15, { sev: 'P1', area: 'M', ref: 'ARCH s13/WORK_PLAN' });
A.chk('DAILY_POOL = all except hobbled,last_breath', 'n-2, none of those', DAILY_POOL.length, DAILY_POOL.length === Object.keys(MUTATORS).length - 2 && !DAILY_POOL.includes('hobbled') && !DAILY_POOL.includes('last_breath'), { area: 'M', ref: 'B6' });
// numeric spot checks of stat-applying mutators
const base = () => ({ bulletDamageMult: 1, damage: 3.5, fireDelay: 0.33, pierce: 0, moveSpeed: 330, ricochet: 0, sixthEvery: 6, dynamiteRadius: 1, bulletSize: 1, shotSpeed: 780, maxHearts: 3, damageTakenMin: 0, killHeal: 0 });
const ap = (id) => { const s = base(); MUTATORS[id].apply && MUTATORS[id].apply(s); return s; };
let s;
s = ap('glass_jaw'); A.eq('glass_jaw dmg x1.5, min 2', [1.5, 2], [s.bulletDamageMult, s.damageTakenMin], { area: 'M', ref: 'B6' });
s = ap('rusty_iron'); A.near('rusty_iron fireDelay x1.4', 0.462, s.fireDelay, 1e-3, { area: 'M' }); A.eq('rusty_iron dmg x1.5 pierce+1', [5.25, 1], [s.damage, s.pierce], { area: 'M' });
s = ap('hell_for_leather'); A.eq('hfl move x1.15 fireDelay x0.85', [379.5, 0.2805], [+s.moveSpeed.toFixed(1), +s.fireDelay.toFixed(4)], { area: 'M', ref: 'B6' });
s = ap('hobbled'); A.eq('hobbled move +45, noRoll flag', [375, true], [s.moveSpeed, MUTATORS.hobbled.flags.noRoll], { area: 'M' });
s = ap('bank_shot'); A.eq('bank_shot ricochet +2 dmg x0.8', [2, 2.8], [s.ricochet, +s.damage.toFixed(4)], { area: 'M' });
s = ap('chambered_three'); A.eq('chambered_three sixthEvery 3 dmg x0.75', [3, 2.625], [s.sixthEvery, s.damage], { area: 'M' });
s = ap('big_iron'); A.eq('big_iron size x1.8, fireDelay x1.3, shotSpeed x0.8, dmg x1.2', [1.8, 0.429, 624, 4.2], [s.bulletSize, +s.fireDelay.toFixed(3), s.shotSpeed, s.damage], { area: 'M' });
s = ap('last_breath'); A.eq('last_breath maxHearts 1, dmg x1.4, start tin 4 units (2 hearts)', [1, 4.9, { maxHearts: 1, tin: 4 }], [s.maxHearts, +s.damage.toFixed(4), MUTATORS.last_breath.flags.startHearts], { area: 'M' });
s = ap('powder_party'); A.eq('powder_party radius x1.5, fireDelay x1.3', [1.5, 0.429], [s.dynamiteRadius, +s.fireDelay.toFixed(3)], { area: 'M' });
A.eq('powder_party start dynamite 9', 9, MUTATORS.powder_party.flags.startDynamite, { area: 'M' });
A.eq('lights_out alpha .72 r 340', { alpha: 0.72, radius: 340 }, MUTATORS.lights_out.flags.lightsOut, { area: 'M' });
A.eq('whiskey_legs friction .3 accel .6', { friction: 0.3, accel: 0.6 }, MUTATORS.whiskey_legs.flags.slippery, { area: 'M' });
A.eq('stampede speed 1.3 hp .8', [1.3, 0.8], [MUTATORS.stampede.flags.enemySpeed, MUTATORS.stampede.flags.enemyHp], { area: 'M' });
A.eq('hell_for_leather enemy speed/bullet 1.25', [1.25, 1.25], [MUTATORS.hell_for_leather.flags.enemySpeed, MUTATORS.hell_for_leather.flags.enemyBulletSpeed], { area: 'M' });
A.eq('dry_town shop x0.5 no coin drops', [0.5, true], [MUTATORS.dry_town.flags.shopMult, MUTATORS.dry_town.flags.noCoinDrops], { area: 'M' });
A.eq('pale_horse killHeal 15 + noHearts', [15, true], [ap('pale_horse').killHeal, MUTATORS.pale_horse.flags.noHearts], { area: 'M' });
// ---- difficulty C1
const N = DIFFICULTY.normal, H = DIFFICULTY.hell;
A.eq('difficulty HELL numbers', { enemyHp: 1.3, bossHp: 1.25, bulletSpeed: 1.12, cooldown: 0.88, extraEnemy: 0.35, eliteMult: 1.6, dropChance: 0.32, pityRooms: 5, heartDowngrade: 0.5, shopHeartPlus: 1, hurtInvuln: 0.85, roomEntryInvuln: 0.4, rewardMult: 1.5 },
  Object.fromEntries(['enemyHp', 'bossHp', 'bulletSpeed', 'cooldown', 'extraEnemy', 'eliteMult', 'dropChance', 'pityRooms', 'heartDowngrade', 'shopHeartPlus', 'hurtInvuln', 'roomEntryInvuln', 'rewardMult'].map((k) => [k, H[k]])), { area: 'M', ref: 'C1/ARCH s13' });
A.eq('difficulty NORMAL numbers', { enemyHp: 1, bossHp: 1, bulletSpeed: 1, cooldown: 1, extraEnemy: 0, eliteMult: 1, dropChance: 0.4, pityRooms: 3, heartDowngrade: 0, shopHeartPlus: 0, hurtInvuln: 1, roomEntryInvuln: 0.5, rewardMult: 1 },
  Object.fromEntries(['enemyHp', 'bossHp', 'bulletSpeed', 'cooldown', 'extraEnemy', 'eliteMult', 'dropChance', 'pityRooms', 'heartDowngrade', 'shopHeartPlus', 'hurtInvuln', 'roomEntryInvuln', 'rewardMult'].map((k) => [k, N[k]])), { area: 'M', ref: 'C1' });
// daily
const d1 = dailyFor('2026-09-29'), d2 = dailyFor('2026-09-29');
A.eq('dailyFor stable', d1, d2, { area: 'M', ref: 'C2/G1e' });
A.chk('dailyFor(Sunday 2026-10-04).hell true, Monday false', 'true/false', `${dailyFor('2026-10-04').hell}/${dailyFor('2026-09-29').hell}`, dailyFor('2026-10-04').hell === true && dailyFor('2026-09-29').hell === false, { area: 'M', ref: 'C2' });
A.eq('daily code', 'DW-20260929', d1.code, { area: 'M', ref: 'C2' });
// ---- ranks B9
A.eq('ranks (11)', [[1, 'Greenhorn', 0], [2, 'Drifter', 100], [3, 'Hired Gun', 300], [4, 'Gunfighter', 600], [5, 'Desperado', 1000], [6, 'Outlaw', 1600], [7, 'Wanted Man', 2400], [8, 'Scourge of Perdition', 3400], [9, "Devil's Rival", 4600], [10, 'Dead Man Walking', 6000], [11, 'Living Legend', 8000]], RANKS.map((r) => [r.rank, r.title, r.np]), { area: 'M', ref: 'B9' });
A.eq('rank boundaries 99/100, 7999/8000', [1, 2, 10, 11], [rankFor(99).rank, rankFor(100).rank, rankFor(7999).rank, rankFor(8000).rank], { area: 'M', ref: 'G1f' });
const run = { kills: 100, bosses: 2, floor: 3, minibosses: 1, elites: 2, time: 1000, damageTaken: 5 };
try { const r1 = computeReward({ kills: 100, bossesKilled: 2, floor: 3, minibosses: 1, elites: 2, time: 1000, damageTaken: 5 }, { won: true }); const exp = 100 * 25 + 2 * 500 + (3 - 1) * 250 + 1 * 200 + 2 * 40 + 3000 + Math.max(0, 2400 - 1000) * 2 - 5 * 10; A.eq('score formula (won)', exp, r1, { area: 'M', ref: 'B9' }); } catch (e) { A.chk('score formula runs', 'ok', e.message, false, { area: 'M' }); }
// ---- gates / titles
A.eq('17 gates', 17, GATES.length, { sev: 'P1', area: 'M', ref: 'ARCH s10.7' });
A.eq('gate names', ['pyro', 'holy', 'sniper', 'gambler', 'occult', 'bloodpact', 'chaos', 'lawman', 'undead', 'beast', 'scrap', 'ghost', 'gulch', 'perdition', 'mine', 'c2', 'sixth'].sort(), [...GATES].sort(), { sev: 'P1', area: 'M' });
A.chk('titles: doc lists 9 (+ closer from STORY)', '>=9', TITLES.length, TITLES.length >= 9, { area: 'M', ref: 'B4 titles' });
A.eq('9 doc titles present', ['gravedigger', 'ghost_rider', 'quickdraw', 'hellraiser', 'curator', 'legend', 'marshal', 'last_breath', 'devils_due'].sort(), TITLES.map((t) => t.id).filter((t) => t !== 'closer').sort(), { area: 'M' });
for (const u of UNLOCKS.filter((x) => x.type === 'gate' && x.source)) { if (!u.cond && !ACHIEVEMENTS.some((a) => a.id === u.source) && !BOUNTIES.some((b) => b.id === u.source)) A.chk(`gate ${u.id} source exists`, 'ach or contract', u.source, false, { sev: 'P1', area: 'M' }); }
// ---- lore D6
const lore = rowsOf(section('### D6. Lore entries', '## E. ART')).filter((r) => /^`lore_/.test(r[0]));
const lmap = Object.fromEntries(LORE.map((l) => [l.id, l]));
for (const r of lore) { const id = tick(r[0]), l = lmap[id]; A.chk(`lore ${id}`, r[1], l ? l.title : 'missing', l && l.title === r[1] && (l.text || '').trim() === r[3].trim(), { sev: 'P2', area: 'M', ref: 'D6' }); }
A.chk('lore count >= 19 (doc) + STORY additions', '>=19', LORE.length, LORE.length >= 19, { area: 'M' });
// ---- characters A1
const DOC = {
  gunslinger: { maxHearts: 3, damage: 3.5, fireDelay: 0.33, range: 0.55, shotSpeed: 780, moveSpeed: 330, luck: 0, rollDistance: 240, rollCooldown: 1.0, sixthMult: 2, sixthPierce: 1, bulletCount: 1, dynamiteDamage: 60, dynamiteFuse: 1.4 },
  preacher: { maxHearts: 3, damage: 2.4, bulletCount: 5, spreadDeg: 9, inaccuracy: 2, fireDelay: 0.66, range: 0.3, shotSpeed: 900, bulletSize: 1.1, moveSpeed: 290, rollDistance: 200, rollCooldown: 1.3, sixthMult: 1.5, sixthPierce: 2, dynamiteDamage: 60, dynamiteFuse: 1.4 },
  hunter: { maxHearts: 2, damage: 7.5, fireDelay: 0.62, range: 0.8, shotSpeed: 1150, bulletSize: 0.8, pierce: 1, moveSpeed: 385, rollDistance: 290, rollCooldown: 0.8, sixthMult: 2.2, sixthPierce: 2, dynamiteDamage: 80, dynamiteFuse: 1.0 },
  queen: { maxHearts: 3, damage: 2.0, fireDelay: 0.19, range: 0.5, shotSpeed: 850, bulletSize: 0.85, inaccuracy: 2.5, moveSpeed: 350, luck: 1, rollDistance: 260, rollCooldown: 0.9 },
};
const START = { gunslinger: [0, 0, 1, 0], preacher: [0, 0, 1, 4], hunter: [0, 0, 3, 0], queen: [10, 0, 1, 0] };
A.eq('CHAR_ORDER', ['gunslinger', 'preacher', 'hunter', 'queen'], CHAR_ORDER, { area: 'M', ref: 'A1' });
for (const id of CHAR_ORDER) {
  const st = startStats(id).stats || startStats(id);
  const bad = [];
  for (const [k, v] of Object.entries(DOC[id])) { if (st[k] === undefined || Math.abs(st[k] - v) > 1e-6) bad.push(`${k} ${st[k]}/${v}`); }
  A.chk(`character ${id} stats`, JSON.stringify(DOC[id]), bad.length ? bad.join(', ') : 'match', !bad.length, { sev: 'P2', area: 'M', ref: 'A1' });
  const c = CHARACTERS[id]; A.eq(`character ${id} start coins/keys/dyn/tin`, START[id], [c.start.coins, c.start.keys, c.start.dynamite, c.start.tin], { area: 'M', ref: 'A1' });
}
A.eq('start items', { gunslinger: [], preacher: ['sermon_bible', 'whiskey_bottle'], hunter: ['hunters_ledger', 'bandolier'], queen: ['gilded_pair', 'cursed_coin'] }, Object.fromEntries(CHAR_ORDER.map((i) => [i, CHARACTERS[i].start.items])), { area: 'M', ref: 'A1' });
A.eq('flatDmgScale preacher .65 others 1', [1, 0.65, 1, 1], CHAR_ORDER.map((i) => CHARACTERS[i].flatDmgScale), { area: 'M', ref: 'A1' });
A.eq('unlockConds', [null, 'E boss:defeated{boss=grimm}', 'E boss:defeated{boss=undertaker}', 'E run:ended{variant=complete}'], CHAR_ORDER.map((i) => CHARACTERS[i].unlockCond), { area: 'M', ref: 'A1' });
A.flush('static (achievements, contracts, mutators, difficulty, ranks, gates, lore, riders)');
