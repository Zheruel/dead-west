// STATIC (items round 2, node only): registry validity, the 46-item catalogue vs ITEMS 4.5, the 28 old items vs ITEMS 3.1, the 26 synergies, pools.
//   node tools/qa/items2-static.mjs            new items that no agent has landed yet are reported as PENDING (not failures)
//   ITEMS2_STRICT=1 node tools/qa/items2-static.mjs   pending items fail (use after all FE-I jobs merged)
import { PLAYER_BASE } from '../../src/config.js';
import { loadNodeRegistry, NEW_ITEMS, GATE_OF, OLD_ITEMS, reporter } from './items2-lib.mjs';
const { ok, warn, r } = reporter();
const strict = !!process.env.ITEMS2_STRICT;
const { registry, tags, synergies, baseStats, failed } = await loadNodeRegistry();
const { allItems, getItem, validateDef, GATES } = registry;
const defs = allItems();

ok('every def file imports in node', Object.keys(failed).length === 0, JSON.stringify(failed));
ok('registry non-empty', defs.length >= 28, `${defs.length} defs`);
const ids = defs.map((d) => d.id);
ok('ids unique', new Set(ids).size === ids.length);
for (const d of defs) {
  const p = validateDef(d);
  if (p.length) ok(`def ${d.id}`, false, p.join('; '));
  if (d.charOnly) continue; // character start items (FN-3) are tagged by their owner
  if (!d.lore) ok(`def ${d.id} has lore`, false);
  if (!d.tags || !d.tags.length) ok(`def ${d.id} has tags`, false);
}
ok('all defs valid (validateDef, name <= 22, desc <= 70, tags in TAGS, gates in GATES, hooks known)', defs.every((d) => validateDef(d).length === 0));
const iconKey = new Map();
for (const d of defs) { const k = `${d.icon.sheet}:${d.icon.name}`; if (iconKey.has(k)) ok(`icon unique ${k}`, false, `${iconKey.get(k)} & ${d.id}`); iconKey.set(k, d.id); }
ok('26 tags', tags.TAG_LIST.length === 26 && new Set(tags.TAG_IDS).size === 26);

// old 28: tags/tier per ITEMS 3.1, never gated
for (const [id, [tg, tier]] of Object.entries(OLD_ITEMS)) {
  const d = getItem(id);
  if (!d) { ok(`old item ${id} registered`, false); continue; }
  ok(`old ${id} tags/tier`, JSON.stringify([...d.tags].sort()) === JSON.stringify([...tg].sort()) && d.tier === tier, `${d.tags} T${d.tier}`);
  ok(`old ${id} ungated`, !d.gate);
}
const old = (id) => getItem(id);
ok('rebalance: snake_oil weight 0.8', old('snake_oil') && old('snake_oil').weight === 0.8);

// new 46 vs 4.5
let pending = 0, present = 0;
for (const m of NEW_ITEMS) {
  const d = getItem(m.id);
  if (!d) { pending++; if (strict) ok(`new ${m.id} registered`, false); continue; }
  present++;
  const type = d.type === 'active' ? 'A' : d.pool.includes('crossroads') ? 'D' : 'P';
  const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  ok(`new ${m.id} meta`, type === m.type && d.tier === m.tier && same(d.pool, m.pool) && Math.abs(d.weight - m.weight) < 1e-9 && same(d.tags, m.tags),
    `type ${type}/${m.type} tier ${d.tier}/${m.tier} pool ${d.pool}/${m.pool} wt ${d.weight}/${m.weight} tags ${d.tags}/${m.tags}`);
  ok(`new ${m.id} gate`, (d.gate || null) === (GATE_OF[m.id] || null), `${d.gate} vs ${GATE_OF[m.id] || null}`);
}
if (pending) warn(`${pending} of ${NEW_ITEMS.length} new items not registered yet`, `(${present} present)`);
const known = new Set([...NEW_ITEMS.map((m) => m.id), ...Object.keys(OLD_ITEMS)]);
const extras = ids.filter((i) => !known.has(i));
if (extras.length) warn('defs outside the 74-id catalogue (round-1 char items?)', extras.join(','));
ok('gate ids in GATES', Object.values(GATE_OF).every((g) => GATES.includes(g)));

// synergies
const { SYNERGIES, SYN_BY_ID, evaluateSynergies, reqMet } = synergies;
ok('26 synergies, unique ids', SYNERGIES.length === 26 && new Set(SYNERGIES.map((s) => s.id)).size === 26, `${SYNERGIES.length}`);
ok('kinds 10 pair / 8 tag / 8 capstone', ['pair', 'tag', 'capstone'].map((k) => SYNERGIES.filter((s) => s.kind === k).length).join() === '10,8,8');
for (const s of SYNERGIES) {
  const bad = [];
  if (!s.name || !s.desc || !s.cue) bad.push('name/desc/cue');
  if (typeof s.apply !== 'function') bad.push('apply');
  for (const id of (s.req.items || [])) if (!NEW_ITEMS.some((m) => m.id === id) && !OLD_ITEMS[id]) bad.push(`item ${id}`);
  for (const t of Object.keys(s.req.tags || {})) if (!tags.isTag(t)) bad.push(`tag ${t}`);
  for (const t of ((s.req.anyTags && s.req.anyTags.of) || [])) if (!tags.isTag(t)) bad.push(`tag ${t}`);
  for (const id of (s.req.syn || [])) if (!SYN_BY_ID[id] || SYNERGIES.indexOf(SYN_BY_ID[id]) >= SYNERGIES.indexOf(s)) bad.push(`syn ${id} not earlier`);
  if (bad.length) ok(`synergy ${s.id}`, false, bad.join(', '));
  // apply must be a pure stat mutation that never yields NaN on the base stats
  const st = { ...PLAYER_BASE, ...baseStats.ITEM_BASE_V2 }; try { s.apply(st, {}, { tags: {} }); } catch (e) { ok(`synergy ${s.id} apply`, false, e.message); }
  ok(`synergy ${s.id} stats finite`, Object.values(st).every((v) => typeof v !== 'number' || Number.isFinite(v)));
}
// each synergy whose ids all exist can be activated by giving its req exactly; and is NOT active on an empty build
ok('no synergy active on an empty build', evaluateSynergies([]).size === 0);
for (const s of SYNERGIES) {
  if (!s.req.items) continue;
  if (!s.req.items.every((i) => getItem(i))) continue;
  ok(`synergy ${s.id} activates from its pair`, evaluateSynergies(s.req.items).has(s.id));
  ok(`synergy ${s.id} needs both`, s.req.items.every((i) => !evaluateSynergies(s.req.items.filter((x) => x !== i)).has(s.id)));
}

// pools
for (const pool of registry.POOLS) {
  const n = defs.filter((d) => d.pool.includes(pool)).length;
  if (pool === 'crossroads' && !defs.some((d) => d.pool.includes('crossroads'))) { warn('crossroads pool empty (FE-I3 pending)'); continue; }
  ok(`pool ${pool} non-empty`, n > 0, `${n}`);
}
ok('crossroads defs carry a deal and only crossroads/c2 pools', defs.filter((d) => d.pool.includes('crossroads')).every((d) => d.deal && d.deal.pay && d.pool.every((x) => x === 'crossroads' || x === 'c2')));
ok('locked (gated) items are never in the start pool set as ungated old items', defs.filter((d) => OLD_ITEMS[d.id]).every((d) => !d.gate));
console.log(`\nitems2-static: ${r.pass} pass, ${r.fail} fail, ${r.warn} warn, ${pending} pending`);
process.exit(r.fail ? 1 : 0);
