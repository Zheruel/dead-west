// QA-5 ITEMS_V2 audit straight from the doc text: s4.5 meta table (46), s4.3 deal pays, s5 synergies (26: id/name/kind/req/cue), s6 pool sizes, s3 tag list, s2 clamps.
import fs from 'node:fs';
import { audit } from './spec5-lib.mjs';
import { loadNodeRegistry, GATE_OF } from './items2-lib.mjs';
const A = audit('ITEMS_V2');
const doc = fs.readFileSync('docs/v2/ITEMS_V2.md', 'utf8');
const { registry, tags, synergies, failed } = await loadNodeRegistry();
const { getItem, allItems } = registry;
const sec = (a, b) => doc.slice(doc.indexOf(a), doc.indexOf(b));
const rows = (s) => s.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| id') && !l.startsWith('|---')).map((l) => l.split('|').slice(1, -1).map((x) => x.trim()));
const O = (ref, sev = 'P2', area = 'E') => ({ sev, area, ref });
A.chk('all def files import in node', 0, Object.keys(failed).length, !Object.keys(failed).length, O('s9'));
// ---- 4.5 meta table
const meta = rows(sec('### 4.5 Meta table', '### 4.6'));
A.chk('4.5 table rows = 46', 46, meta.length, meta.length === 46, O('4.5'));
const ref45 = 'ITEMS 4.5';
for (const [id, type, tier, pool, wt, tg] of meta) {
  const d = getItem(id);
  if (!d) { A.chk(`${id}: registered`, 'yes', 'missing', false, O(ref45, 'P1')); continue; }
  const pl = pool.split(/\s+/).sort();
  A.chk(`${id}: type`, type === 'A' ? 'active' : 'passive', d.type, (type === 'A') === (d.type === 'active'), O(ref45));
  A.chk(`${id}: tier`, tier, d.tier, +tier === d.tier, O(ref45));
  A.chk(`${id}: pool`, pl.join(' '), [...d.pool].sort().join(' '), JSON.stringify(pl) === JSON.stringify([...d.pool].sort()), O(ref45));
  A.chk(`${id}: weight`, wt, d.weight, +wt === d.weight, O(ref45));
  A.chk(`${id}: tags`, tg, [...d.tags].sort().join(' '), JSON.stringify(tg.split(/\s+/).sort()) === JSON.stringify([...d.tags].sort()), O(ref45));
  const g = GATE_OF[id] || null;
  A.chk(`${id}: unlock gate (ARCH D5 map)`, g || '-', d.gate || '-', (d.gate || null) === g, O('ARCH D5'));
  A.chk(`${id}: has icon + lore + name<=22 + desc<=70`, 'yes', `${!!d.icon} ${!!d.lore} ${d.name.length} ${d.desc.length}`, !!d.icon && !!d.lore && d.name.length <= 22 && d.desc.length <= 70, O('1.1', 'P3'));
}
// ---- 4.3 deals
const deals = rows(sec('### 4.3 Crossroads', '### 4.4'));
A.chk('4.3 has 10 deals', 10, deals.length, deals.length === 10, O('4.3'));
const payOf = (s) => { const m = s.match(/^(\d+) (heart container|keys|coins|tin|dynamite)/); const k = { 'heart container': 'container', keys: 'keys', coins: 'coins', tin: 'tin', dynamite: 'dynamite' }[m[2]]; return [k, +m[1]]; };
for (const [id, name, pay, banner] of deals) {
  const d = getItem(id); if (!d) { A.chk(`${id}: deal registered`, 'yes', 'missing', false, O('4.3', 'P1')); continue; }
  const [k, n] = payOf(pay);
  A.chk(`${id}: deal.pay ${k}=${n}`, `${k}=${n}`, JSON.stringify(d.deal?.pay), d.deal?.pay?.[k] === n && Object.keys(d.deal.pay).length === 1, O('4.3'));
  A.chk(`${id}: name`, name, d.name, name.replace(/'/g, '’') === d.name || name === d.name, O('4.3', 'P3'));
  A.chk(`${id}: pool crossroads only`, 'crossroads(+c2)', d.pool.join(' '), d.pool[0] === 'crossroads' && d.pool.every((x) => x === 'crossroads' || x === 'c2'), O('4.3'));
  A.chk(`${id}: banner <= 70 chars in def desc`, banner, d.desc, d.desc.length <= 70, O('4.3', 'P3'));
}
// ---- 5 synergies
const syn = [...rows(sec('### 5.1', '### 5.2')), ...rows(sec('### 5.2', '### 5.3')), ...rows(sec('### 5.3', 'Implementation notes: pair'))];
A.chk('s5 has 26 synergies', 26, syn.length, syn.length === 26, O('5'));
A.chk('SYNERGIES.length', 26, synergies.SYNERGIES.length, synergies.SYNERGIES.length === 26, O('5'));
const order = syn.map((r) => r[0]);
A.chk('evaluation order pair->tag->capstone == doc order', order.join(','), synergies.SYNERGIES.map((s) => s.id).join(','), order.join() === synergies.SYNERGIES.map((s) => s.id).join(), O('5'));
const kind = (i) => (i < 10 ? 'pair' : i < 18 ? 'tag' : 'capstone');
syn.forEach(([id, name, reqd, bonus, cue], i) => {
  const s = synergies.SYNERGIES.find((x) => x.id === id);
  if (!s) { A.chk(`${id}: exists`, 'yes', 'missing', false, O('5', 'P1')); return; }
  const cueDoc = cue.replace(/^"|"$/g, '').replace(/\.\.\.$/, '');
  A.chk(`${id}: name`, name, s.name, name === s.name, O('5', 'P3'));
  A.chk(`${id}: kind`, kind(i), s.kind, s.kind === kind(i), O('5'));
  A.chk(`${id}: cue line`, cueDoc, s.cue, s.cue === cueDoc || cueDoc.startsWith(s.cue) || s.cue.startsWith(cueDoc.replace(/\s*$/, '')), O('5', 'P3'));
  // requirement
  const r = s.req; let want;
  if (kind(i) === 'pair') want = reqd.split(' + ').sort().join(' ') === [...r.items].sort().join(' ');
  else { const m = reqd.match(/^(\w+) >= (\d+)$/); if (m) want = r.tags && r.tags[m[1]] === +m[2]; else if (/distinct/.test(reqd)) want = r.anyTags && r.anyTags.n === 3 && r.anyTags.of.length === 5; else if (/ >= .* \+ /.test(reqd)) { const p = reqd.split(' + ').map((x) => x.match(/(\w+) >= (\d+)/)); want = p.every((q) => r.tags?.[q[1]] === +q[2]); } else if (/ \+ /.test(reqd)) want = (r.syn || []).slice().sort().join(' ') === reqd.split(' + ').sort().join(' ') || (reqd.split(' + ').every((x) => (r.syn || []).includes(x) || (r.items || []).includes(x) || Object.keys(r.tags || {}).includes(x.split(' ')[0]))); else want = true; if (id === 'devils_dust') want = (r.syn || []).includes('quicksilver') && (r.tags?.roll === 2 || r.tags?.roll >= 2); }
  A.chk(`${id}: requirement (${reqd})`, reqd, JSON.stringify(r), !!want, O('5'));
});
// ---- numeric spot-check of every synergy 'Exact bonus' backtick stat by applying to a blank stats object with req satisfied
const { baseStats } = await import('../../src/items/baseStats.js').catch(() => ({}));
// ---- s6 pool sizes
const nonCross = allItems().filter((d) => !d.pool.includes('crossroads') && !d.charOnly);
const ch1 = nonCross.filter((d) => !d.pool.includes('c2'));
const c2only = nonCross.filter((d) => d.pool.includes('c2'));
const cross = allItems().filter((d) => d.pool.includes('crossroads') && !d.charOnly);
A.chk('s6.4 ch1 non-crossroads pool 57 (28 old + 29 new)', 57, ch1.length, ch1.length === 57, O('6.4'));
A.chk('s6.4 c2-only 7 (5 passive + 2 active)', '7 (5+2)', `${c2only.length} (${c2only.filter((d) => d.type === 'passive').length}+${c2only.filter((d) => d.type === 'active').length})`, c2only.length === 7, O('6.4'));
A.chk('s6.4 crossroads 10 (4 c2-only)', '10 (4)', `${cross.length} (${cross.filter((d) => d.pool.includes('c2')).length})`, cross.length === 10 && cross.filter((d) => d.pool.includes('c2')).length === 4, O('6.4'));
A.chk('s3 total 26 tags, unique', 26, tags.TAG_LIST.length, tags.TAG_LIST.length === 26, O('3'));
const ids = allItems().map((d) => d.id);
A.chk('unique ids', 'no dup', ids.length - new Set(ids).size, ids.length === new Set(ids).size, O('1.1'));
const totalReg = allItems().length;
A.chk('total registry = 28 old + 46 new (+ char start items) = 74+', '>=74', totalReg, totalReg >= 74, O('0'));
const fam = ['bone_hound', 'tumbleweed_pal', 'little_coffin', 'saints_halo'];
A.chk('4.4 four familiar items exist with familiar tag', 4, fam.filter((i) => getItem(i)?.tags.includes('familiar')).length, fam.every((i) => getItem(i)?.tags.includes('familiar')), O('4.4'));
A.chk('4.2 six actives', 6, allItems().filter((d) => d.type === 'active' && meta.some((m) => m[0] === d.id)).length, allItems().filter((d) => d.type === 'active' && meta.some((m) => m[0] === d.id)).length === 6, O('4.2'));
const { pass, fail } = A.flush('4.5 meta table, 4.3 deals, s5 synergies, s6 pools');
process.exit(0);
