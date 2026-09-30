// QA-4 save robustness (plain node): corrupt/garbage/hostile stored values, v1 fixtures, export/import round trip, storage failure modes.
import { Save, KEY, KEY_V1, repair, freshSave } from '../../src/core/Save.js';
import { migrateV1 } from '../../src/meta/migrate.js';
let fails = 0; const ok = (n, c, x = '') => { if (!c) { fails++; console.log('FAIL', n, x); } else console.log('pass', n); };
const mem = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, dump: m }; };
const use = (init) => { const s = mem(init); Save._useStorage(s); return s; };
const w = console.warn; console.warn = () => {};
const shape = (s) => s && s.v === 2 && typeof s.settings === 'object' && typeof s.stats.kills === 'number' && Array.isArray(s.history) && s.codex && s.codex.enemies && s.chars.gunslinger.unlocked === true;
// 1. garbage strings in the v2 key
for (const raw of ['', '{', 'null', '[]', '0', '"x"', '{"v":2}', '{"v":3}', '{"v":"2"}', '\u0000\u0001', 'undefined', '{"v":2,"stats":5,"codex":[],"chars":"x","settings":null,"history":{},"flags":[],"checkpoint":7}', '{"v":2,"stats":{"kills":"NaN","runs":-5,"playTime":1e999},"best":{"floor":"a"}}']) {
  let s; try { use({ [KEY]: raw }); s = Save.get(); } catch (e) { ok('garbage ' + raw.slice(0, 30), false, e.message); continue; }
  ok('garbage ' + JSON.stringify(raw).slice(0, 40), shape(s) && Number.isFinite(s.stats.playTime) && s.stats.runs >= 0);
}
// 2. hostile shapes
const hostile = JSON.parse('{"v":2,"__proto__":{"polluted":1},"codex":{"enemies":{"__proto__":{"x":1},"constructor":{"a":1},"ok":2}},"flags":{"__proto__":1},"ach":{"__proto__":5},"stats":{"k":{"__proto__":3}}}');
use({ [KEY]: JSON.stringify(hostile) }); const hs = Save.get();
ok('proto pollution', ({}).polluted === undefined && ({}).x === undefined);
ok('hostile save usable', shape(hs));
// 3. checkpoint junk survives repair unvalidated -> report shape
for (const cp of [{ v: 1, floor: 4, items: 'x', hp: 'a' }, { v: 1, floor: 99, seed: 'q' }, { v: 1, floor: 5, items: [{}, null, 5], active: 9, run: 7 }]) {
  use({ [KEY]: JSON.stringify({ v: 2, checkpoint: cp }) }); const c = Save.loadCheckpoint();
  console.log('INFO checkpoint junk passes repair:', JSON.stringify(cp).slice(0, 90), '->', !!c);
}
// 4. v1 fixtures
const v1s = { empty: {}, fresh: { runs: 0 }, mid: { runs: 12, deaths: 11, kills: 900, bestFloor: 2, bestTime: 300, bestKills: 80, itemsSeen: ['spurs', 'nope', 5], settings: { mute: true, volume: 0.3, shake: false } }, f3: { runs: 30, bestFloor: 3, wins: 0 }, won: { runs: 60, wins: 4, bestFloor: 3, kills: 99999, itemsSeen: [] }, junk: { runs: 'x', settings: [1], itemsSeen: 'str', kills: -1, bestFloor: NaN }, str: 'abc', arr: [1, 2] };
for (const [n, v] of Object.entries(v1s)) {
  const st = use({ [KEY_V1]: JSON.stringify(v) }); const s = Save.get();
  ok('v1 ' + n + ' migrates', shape(s) && st.dump[KEY_V1] === JSON.stringify(v) && !!st.dump[KEY]);
  if (n === 'mid') ok('v1 mid values', s.stats.runs === 12 && s.best.floor === 2 && s.settings.mute === true && s.settings.shakeAmt === 0 && s.codex.items.spurs === 2 && s.chars.gunslinger.unlocked);
  if (n === 'won') ok('v1 won credits', s.unlocks['char:preacher'] && s.unlocks['mode:daily'] && s.notoriety.np > 0);
}
// v1 + corrupt v2 -> falls to v1; v2 valid + v1 present -> v2 wins
{ const st = use({ [KEY]: '{bad', [KEY_V1]: JSON.stringify({ runs: 3 }) }); ok('corrupt v2 + v1 -> uses v1', Save.get().stats.runs === 3); }
{ const st = use({ [KEY]: JSON.stringify({ v: 2, stats: { runs: 9 } }), [KEY_V1]: JSON.stringify({ runs: 3 }) }); ok('v2 wins over v1', Save.get().stats.runs === 9); }
// 5. export / import
{ use({}); Save.stat('kills', 50); Save.grant('char:preacher'); Save.setFlag('introSeen', true); Save.codexSeen('events', 'preacher');
  const ex = Save.export(); ok('export is string', typeof ex === 'string' && ex.length > 50);
  use({}); ok('import roundtrip', Save.import(ex) && Save.get().stats.kills === 50 && Save.unlocked('char:preacher') && Save.flag('introSeen') === true);
  for (const bad of ['', 'abc', '!!!', ex.slice(0, 40), ex + 'A', btoa('{"v":1}'), btoa('[]'), btoa('null'), null, undefined, 5, {}, '  ' + ex + ' \n', btoa(unescape(encodeURIComponent('{"v":2,"stats":{"kills":-9}}')))]) {
    use({}); let r; try { r = Save.import(bad); } catch (e) { ok('import bad throws ' + String(bad).slice(0, 10), false, e.message); continue; }
    ok('import bad ' + JSON.stringify(String(bad)).slice(0, 24), shape(Save.get()));
    console.log('   ->', r);
  }
  // unicode in flags round trip
  use({}); Save.setFlag('lastEpitaph', 'Hier ruht é中💀'); const e2 = Save.export(); use({}); Save.import(e2); ok('unicode flag roundtrip', Save.flag('lastEpitaph') === 'Hier ruht é中💀', Save.flag('lastEpitaph'));
  // huge save export size
  use({}); const s = Save.get(); for (let i = 0; i < 5000; i++) s.codex.enemies['e' + i] = { seen: 1, kills: i }; const big = Save.export(); console.log('INFO export of 5000-entry codex', big.length, 'bytes'); use({}); ok('big import', Save.import(big));
}
// 6. storage failures
{ const boom = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); }, removeItem() { throw new Error('x'); } };
  Save._useStorage(boom); let s; try { s = Save.get(); Save.stat('kills', 3); Save.persist(); Save.grant('x'); Save.flush(); Save.resetProgress(); Save.export(); Save.import('zz'); Save.clearCheckpoint(); } catch (e) { ok('throwing storage', false, e.stack); }
  ok('throwing storage in-memory', shape(Save.get())); }
{ const full = mem(); full.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); }; Save._useStorage(full); Save.stat('kills', 5); Save.persist(); ok('full storage keeps memory', Save.get().stats.kills === 5); }
{ Save._useStorage({ getItem: () => 5, setItem() {}, removeItem() {} }); ok('non-string getItem', shape(Save.get())); }
{ Save._useStorage({ getItem: () => ({}), setItem() {}, removeItem() {} }); ok('object getItem', shape(Save.get())); }
// 7. resetProgress keeps settings, clears checkpoint
{ use({}); Save.setSetting('volume', 0.1); Save.grant('a'); Save.resetProgress(); ok('resetProgress', Save.settings().volume === 0.1 && !Save.unlocked('a')); }
// 8. large history / daily clamp
{ use({ [KEY]: JSON.stringify({ v: 2, history: Array.from({ length: 999 }, (_, i) => ({ i })), daily: { entries: Array.from({ length: 999 }, (_, i) => ({ i })) } }) }); ok('history clamp', Save.get().history.length === 25 && Save.get().daily.entries.length === 200); }
console.warn = w;
console.log(fails ? `\nQA4-SAVE ${fails} FAIL` : '\nQA4-SAVE all pass');
