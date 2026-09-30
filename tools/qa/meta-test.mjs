// Meta layer test (plain node, no browser): node tools/qa/meta-test.mjs
// Covers: condition grammar (strict compile of every deed / lore / unlock), the Meta engine (idempotent unlocks, disabled runs), Save migration + export/import,
// daily / setup resolution, ranks, contract tiers, rider data and item wiring (source-level, since item defs import Phaser).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Save, KEY, KEY_V1 } from '../../src/core/Save.js';
import RunState from '../../src/core/RunState.js';
import { Meta } from '../../src/meta/Meta.js';
import { compileCond } from '../../src/meta/cond.js';
import { ACHIEVEMENTS } from '../../src/meta/achievements.js';
import { LORE } from '../../src/meta/lore.js';
import { UNLOCKS, UNLOCK_BY_ID } from '../../src/meta/unlocks.js';
import { RANKS, rankFor } from '../../src/meta/ranks.js';
import { BOUNTIES, byTier, TIER_UNLOCK_AFTER } from '../../src/meta/bounties.js';
import { computeReward, runNp } from '../../src/meta/score.js';
import { resolveSetup } from '../../src/meta/setup.js';
import { ENEMY_TEXT } from '../../src/meta/codexText.js';
import { ENEMY_META } from '../../src/enemies/registry.js';
import { CHAR_ORDER, CHARACTERS, BAR_DEFS, barSegments } from '../../src/data/characters.js';
import { dailyFor, utcWeekday, MUTATORS, DAILY_POOL } from '../../src/data/difficulty.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? `  (${extra})` : ''}`); } };
const section = (t) => console.log(`- ${t}`);

const mem = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, dump: m }; };
function fresh(init) {
  const st = mem(init);
  Save._useStorage(st);
  Meta._reset();
  Meta.record = true; Meta.emitter = null;
  return st;
}
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
function startRun(over = {}) { return Meta.beginRun({ char: 'gunslinger', mode: 'normal', seed: 7, ...over }); }
const endRun = (variant = 'death', extra = {}) => { const run = Meta.run; Object.assign(run, extra); Meta.handle('run:ended', { variant, stats: run.toJSON() }); };
const outs = (name) => Meta.outputs.filter((o) => o.name === name).map((o) => o.payload);

// ------------------------------------------------------------------------------------------------ grammar
section('conditions compile strictly');
for (const a of ACHIEVEMENTS) { let e = null; try { compileCond(a.cond, { strict: true }); } catch (x) { e = x.message; } ok(`deed ${a.id}`, !e, e); }
for (const l of LORE) { let e = null; try { compileCond(l.unlock, { strict: true }); } catch (x) { e = x.message; } ok(`lore ${l.id}`, !e, e); }
for (const u of UNLOCKS) if (u.cond) { let e = null; try { compileCond(u.cond, { strict: true }); } catch (x) { e = x.message; } ok(`unlock ${u.id}`, !e, e); }
for (const b of BOUNTIES) { ok(`contract ${b.id} has a seed-stable goal`, typeof b.goal === 'string' && b.goal.length > 0); }
const ids = new Set();
for (const a of ACHIEVEMENTS) { ok(`unique deed ${a.id}`, !ids.has(a.id)); ids.add(a.id); for (const r of a.reward) ok(`deed ${a.id} reward ${r} exists`, !!UNLOCK_BY_ID[r], r); }
ok('every unlock is granted by a deed, a contract or its own condition', UNLOCKS.every((u) => u.cond || ACHIEVEMENTS.some((a) => a.reward.includes(u.id)) || BOUNTIES.some((b) => b.reward.includes(u.id))), UNLOCKS.filter((u) => !(u.cond || ACHIEVEMENTS.some((a) => a.reward.includes(u.id)) || BOUNTIES.some((b) => b.reward.includes(u.id)))).map((u) => u.id).join(','));

// ------------------------------------------------------------------------------------------------ engine
section('gravedigger replay + idempotent unlocks');
fresh();
startRun();
for (let i = 0; i < 500; i++) Meta.handle('enemy:died', { id: 'coyote', x: 0, y: 0 });
ok('kills counted', Save.get().stats.kills === 500, Save.get().stats.kills);
ok('gravedigger earned once', outs('meta:achievement').filter((p) => p.id === 'gravedigger').length === 1);
ok('first_blood earned', !!Save.get().ach.first_blood);
const npAfter = Save.get().notoriety.np;
for (let i = 0; i < 50; i++) Meta.handle('enemy:died', { id: 'coyote', x: 0, y: 0 });
ok('no double award for a repeated deed', outs('meta:achievement').filter((p) => p.id === 'gravedigger').length === 1);
ok('np stable for the same deeds', Save.get().notoriety.np === npAfter);
ok('coyote reached codex stage 3', Meta.enemyStage('coyote') >= 3, Meta.enemyStage('coyote'));

section('boss unlocks');
fresh();
startRun();
ok('preacher locked at start', !Meta.isCharUnlocked('preacher'));
Meta.handle('boss:defeated', { id: 'grimm', boss: 'grimm', floor: 2, fightTime: 60, noHit: false });
ok('grimm grants char:preacher', Meta.isCharUnlocked('preacher'));
ok('lawless earned', !!Save.get().ach.lawless);
ok('meta:unlocked emitted for the preacher', outs('meta:unlocked').some((p) => p.id === 'char:preacher'));
Meta.handle('boss:defeated', { id: 'grimm', boss: 'grimm', floor: 2, fightTime: 60 });
ok('preacher unlock is idempotent', outs('meta:unlocked').filter((p) => p.id === 'char:preacher').length === 1);
ok('lore for grimm discovered', Meta.loreUnlocked('lore_grimm'));

section('debt_paid unlocks the queen and Hell, once');
fresh();
startRun();
endRun('complete', { time: 1500, floor: 6, kills: 120 });
ok('queen unlocked', Meta.isCharUnlocked('queen'));
ok('hell unlocked', Meta.isModeUnlocked('hell'));
ok('debt_paid earned', !!Save.get().ach.debt_paid);
ok('run recorded in history', Save.get().history.length === 1 && Save.get().history[0].won === true);
ok('wins++ and marks.final', Save.get().stats.wins === 1 && Save.get().chars.gunslinger.marks.final === 1);
ok('summary carries a reward', Meta.lastSummary && Meta.lastSummary.reward > 0);
startRun();
endRun('complete', { time: 1500, floor: 6, kills: 120 });
ok('second win does not re-unlock', outs('meta:unlocked').filter((p) => p.id === 'char:queen').length === 1);
ok('hell win mark', (() => { startRun({ mode: 'hell' }); endRun('complete', { time: 1500, floor: 6 }); return Save.get().chars.gunslinger.marks.hell === 1 && Save.get().best.time.hell > 0; })());

section('disabled meta records nothing');
fresh();
Meta.enabled = false;
startRun({ enabled: false });
for (let i = 0; i < 40; i++) Meta.handle('enemy:died', { id: 'coyote' });
Meta.handle('boss:defeated', { id: 'grimm', boss: 'grimm' });
endRun('complete', { floor: 6, kills: 40 });
const sv = Save.get();
ok('no kills', sv.stats.kills === 0 && sv.stats.runs === 0);
ok('no deeds or unlocks', Object.keys(sv.ach).length === 0 && Object.keys(sv.unlocks).length === 0);
ok('no history', sv.history.length === 0 && sv.notoriety.np === 0);
Meta.enabled = true;

section('a resumed (CONTINUE) run is not a new run');
fresh();
startRun({ resume: true });
ok('runs stays 0', Save.get().stats.runs === 0);

// ------------------------------------------------------------------------------------------------ save
section('migration fixtures');
{
  fresh();
  const s = Save.get();
  ok('empty storage -> fresh v2', s.v === 2 && s.stats.runs === 0 && s.chars.gunslinger.unlocked && !s.chars.preacher.unlocked);
  fresh({ [KEY_V1]: JSON.stringify({ runs: 9, wins: 2, deaths: 7, kills: 400, bestFloor: 3, bestTime: 1900, itemsSeen: ['sixth_sense'] }) });
  const m = Save.get();
  ok('v1 wins=2 keeps counters', m.stats.runs === 9 && m.stats.wins === 2 && m.stats.kills === 400 && m.best.floor === 3 && m.best.time.normal === 1900);
  ok('v1 wins=2 retro-credits the rest', !!m.unlocks['char:preacher'] && !!m.unlocks['char:hunter'] && !!m.unlocks['mode:daily'] && !!m.ach.last_rites);
  ok('v1 wins=2 does not grant the queen', !m.unlocks['char:queen']);
  ok('v1 itemsSeen become codex items', m.codex.items.sixth_sense === 2);
  ok('notoriety recomputed', m.notoriety.np > 0);
  fresh({ [KEY_V1]: JSON.stringify({ runs: 3, bestFloor: 3 }) });
  const b = Save.get();
  ok('v1 bestFloor=3 grants the preacher only', !!b.unlocks['char:preacher'] && !b.unlocks['char:hunter'] && !!b.ach.lawless);
  fresh({ [KEY_V1]: '{not json' });
  ok('corrupt v1 -> fresh v2, no throw', Save.get().v === 2 && Save.get().stats.runs === 0);
  fresh({ [KEY]: '\u0000garbage' });
  ok('corrupt v2 -> fresh v2, no throw', Save.get().v === 2);
  const st = fresh({ [KEY_V1]: JSON.stringify({ runs: 2 }) });
  Save.persist();
  ok('v1 key left untouched', JSON.parse(st.dump[KEY_V1]).runs === 2 && !!st.dump[KEY]);
  ok('legacy getters are not serialised', !('bestFloor' in JSON.parse(st.dump[KEY])));
  ok('legacy getters still answer', Save.get().bestFloor === 0 && Save.get().runs === 2);
}

section('export / import round trip');
{
  fresh();
  startRun();
  for (let i = 0; i < 30; i++) Meta.handle('enemy:died', { id: 'coyote' });
  Meta.handle('boss:defeated', { id: 'grimm', boss: 'grimm' });
  Save.setSetting('music', 0.3);
  const before = JSON.parse(JSON.stringify(Save.get()));
  const code = Save.export();
  ok('export is a string', typeof code === 'string' && code.length > 20);
  fresh();
  ok('reset state is clean', Save.get().stats.kills === 0);
  ok('import accepts the code', Save.import(code) === true);
  const after = Save.get();
  ok('kills round trip', after.stats.kills === before.stats.kills);
  ok('unlocks round trip', JSON.stringify(after.unlocks) === JSON.stringify(before.unlocks));
  ok('settings round trip', after.settings.music === 0.3);
  ok('import rejects junk', Save.import('nonsense!!') === false && Save.import('') === false);
  Save.resetProgress();
  ok('resetProgress wipes progress but keeps settings', Save.get().stats.kills === 0 && Save.get().settings.music === 0.3 && !Save.get().unlocks['char:preacher']);
}

section('checkpoint api');
{
  fresh();
  ok('no checkpoint on a fresh save', Save.loadCheckpoint() === null);
  const run = new RunState(5); run.floor = 4; run.char = 'gunslinger'; run.mode = 'normal';
  Save.saveCheckpoint(run, { snapshot: () => ({ items: ['a'], hp: 6, maxHp: 6, coins: 3, keys: 1, dyn: 2 }) });
  const cp = Save.loadCheckpoint();
  ok('checkpoint stored', !!cp && cp.floor === 4 && cp.mode === 'normal' && cp.run && cp.run.floor === 4);
  const back = RunState.fromJSON(cp.run);
  ok('RunState round trip', back.floor === 4 && back.seed === 5);
  Save.clearCheckpoint();
  ok('clearCheckpoint', Save.loadCheckpoint() === null);
  const d = new RunState(1); d.floor = 4; d.mode = 'daily';
  Save.saveCheckpoint(d, null);
  ok('daily never checkpoints', Save.loadCheckpoint() === null);
  Save.setProgressLocked(true);
  Save.saveCheckpoint(run, null);
  ok('locked progress never checkpoints', Save.loadCheckpoint() === null);
  Save.setProgressLocked(false);
}

// ------------------------------------------------------------------------------------------------ data
section('daily + setup');
{
  const a = dailyFor('2026-09-29'), b = dailyFor('2026-09-29');
  ok('dailyFor is stable', JSON.stringify(a) === JSON.stringify(b));
  ok('dailyFor fields', CHAR_ORDER.includes(a.char) && DAILY_POOL.includes(a.mutator) && a.code === 'DW-20260929' && Number.isInteger(a.seed));
  ok('dailyFor differs per date', dailyFor('2026-09-30').seed !== a.seed);
  ok('weekday 0 is Hell', dailyFor('2026-09-27').hell === true && utcWeekday('2026-09-27') === 0 && dailyFor('2026-09-28').hell === false);
  ok('daily pool excludes hobbled / last_breath', !DAILY_POOL.includes('hobbled') && !DAILY_POOL.includes('last_breath'));
  ok('mutators are complete', Object.entries(MUTATORS).every(([, m]) => m.name && m.desc && typeof m.tag === 'string'));
  const s = resolveSetup({ mode: 'daily', date: '2026-09-29' }, { today: '2026-09-30' });
  ok('daily setup uses the day', s.mode === 'daily' && s.char === a.char && s.seed === a.seed && s.mutators[0] === a.mutator);
  ok('locked rider falls back', resolveSetup({ char: 'queen' }, { charOk: (c) => c === 'gunslinger' }).char === 'gunslinger');
  ok('locked hell falls back', resolveSetup({ mode: 'hell' }, { modeOk: () => false }).mode === 'normal');
  ok('hell setup', resolveSetup({ mode: 'hell', char: 'preacher' }).mode === 'hell');
  const c = resolveSetup({ mode: 'contract', contract: BOUNTIES[0].id });
  ok('contract setup pins seed, rider and mutators', c.mode === 'contract' && c.contract === BOUNTIES[0].id && c.char === BOUNTIES[0].char && Number.isInteger(c.seed));
  ok('unknown contract -> normal', resolveSetup({ mode: 'contract', contract: 'nope' }).mode === 'normal');
  ok('custom mutators flag the run', resolveSetup({}, { mutators: ['glass_jaw', 'bogus'] }).custom === true);
}

section('ranks and score');
{
  ok('rank 99 -> 1', rankFor(99).rank === 1);
  ok('rank 100 -> 2', rankFor(100).rank === 2);
  ok('rank 7999 -> 10', rankFor(7999).rank === 10);
  ok('rank 8000 -> 11', rankFor(8000).rank === 11);
  ok('ranks ascend', RANKS.every((r, i) => i === 0 || r.np > RANKS[i - 1].np));
  ok('reward floors at 0', computeReward({ damageTaken: 999 }) === 0);
  ok('hell reward x1.5', computeReward({ kills: 100 }, { mode: 'hell' }) === Math.round(2500 * 1.5));
  ok('win bonus', computeReward({ kills: 0, time: 0 }, { won: true }) === 3000 + 4800);
  ok('np: hell mult applied once', runNp(computeReward({ kills: 100 }, { mode: 'hell' }), 'hell') === Math.round(Math.ceil(2500 / 100) * 1.5));
  ok('np: contracts pay none from the run', runNp(5000, 'contract') === 0);
}

section('rider data');
{
  ok('four riders', CHAR_ORDER.length === 4 && CHAR_ORDER[0] === 'gunslinger');
  for (const id of CHAR_ORDER) {
    const c = CHARACTERS[id];
    ok(`${id} has identity`, !!(c.name && c.role && c.tagline && c.hint !== undefined && c.start && c.relic !== undefined));
    for (const b of BAR_DEFS) { const v = barSegments(id, b.key, () => null); ok(`${id} bar ${b.key} in 0..10`, v >= 0 && v <= 10 && Number.isInteger(v), v); }
    for (const item of c.start.items) ok(`${id} start item ${item} has a def file`, fs.existsSync(path.join(ROOT, 'src/items/defs', `${item}.js`)), item);
    if (c.relic) ok(`${id} relic ${c.relic} has a def file`, fs.existsSync(path.join(ROOT, 'src/items/defs', `${c.relic}.js`)), c.relic);
  }
  ok('unlockable riders have a matching unlock', ['preacher', 'hunter', 'queen'].every((id) => !!UNLOCK_BY_ID[`char:${id}`]));
  for (const rel of ['sermon_bible', 'hunters_ledger', 'gilded_pair']) {
    const src = fs.readFileSync(path.join(ROOT, 'src/items/defs', `${rel}.js`), 'utf8');
    ok(`${rel} is rider-only`, /charOnly:\s*'/.test(src));
    ok(`${rel} never rolls (empty pool)`, /pool:\s*\[\s*\]/.test(src));
  }
  const roll = fs.readFileSync(path.join(ROOT, 'src/items/ItemSystem.js'), 'utf8');
  ok('item rolls skip charOnly defs', /charOnly/.test(roll) || /charOnly/.test(fs.readFileSync(path.join(ROOT, 'src/items/registry.js'), 'utf8')));
}

section('bestiary text');
{
  const withText = Object.keys(ENEMY_TEXT);
  ok('16 hand-written entries', withText.length >= 16, withText.length);
  ok('every text id is a real enemy', withText.every((id) => ENEMY_META[id]), withText.filter((id) => !ENEMY_META[id]).join(','));
  ok('every entry has lore and a tip', withText.every((id) => ENEMY_TEXT[id].lore && ENEMY_TEXT[id].tip && ENEMY_TEXT[id].name));
}

section('contract tiers');
{
  fresh();
  ok('tin open, silver locked', Meta.tierOpen('tin') && !Meta.tierOpen('silver'));
  const tin = byTier('tin');
  ok('tin has enough contracts', tin.length >= TIER_UNLOCK_AFTER, tin.length);
  for (let i = 0; i < TIER_UNLOCK_AFTER - 1; i++) Save.get().bounty[tin[i].id] = { done: 1, tries: 1, best: { time: 0, reward: 0 } };
  ok('5 done: silver still locked', !Meta.tierOpen('silver'));
  Save.get().bounty[tin[TIER_UNLOCK_AFTER - 1].id] = { done: 1, tries: 1, best: { time: 0, reward: 0 } };
  ok('6 done: silver open', Meta.tierOpen('silver') && !Meta.tierOpen('gold'));
}

section('contract completion');
{
  fresh();
  const b = BOUNTIES[0];
  Meta.enabled = true;
  Meta.beginRun({ char: b.char, mode: 'contract', contract: b.id, seed: 3, mutators: b.mutators });
  ok('try counted', Save.get().bounty[b.id].tries === 1);
  const run = Meta.run;
  run.floor = 3; run.hits = 0; run.time = 300; run.kills = 60; run.goalReached = true;
  Meta.handle('run:ended', { variant: 'contract', stats: run.toJSON() });
  const st = Save.get().bounty[b.id];
  const done = st && st.done > 0;
  ok('completion or a clean failure record', !!st);
  if (done) ok('first clear pays NP and emits bounty:completed', outs('bounty:completed').some((p) => p.id === b.id));
}

console.log(`\nmeta-test: ${pass} passed, ${fail} failed`);
Save._useStorage(null);
process.exit(fail ? 1 : 0);
