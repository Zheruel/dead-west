// Runs the FE-I1 per-item plugins (15 items) on one private dev server:  node tools/qa/items2/_run_i1.mjs [item_id ...] [?query]
import { readdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { boot, reporter } from '../items2-lib.mjs';
import { install } from './_i1.mjs';

const IDS = ['forked_tongue', 'widows_bone', 'lightning_rod', 'blast_caps', 'wraith_rounds', 'lodestone', 'blue_norther', 'brand_iron', 'gila_gland', 'holy_water', 'wanted_poster', 'bronco_boots', 'hand_mirror', 'black_cat_bone', 'blood_bandana'];
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('?'));
const query = args.find((a) => a.startsWith('?')) || '?debug=1&seed=42';
const { ok, warn, r } = reporter();
const g = await boot('items-i1', query);
const ev = (fn, ...a) => g.eval(fn, ...a);
const reset = () => ev(() => {
  const dw = window.__dw, p = dw.player;
  dw.api.killAll(); for (const f of [...p.familiars]) f.destroy();
  p.restore({ items: [], active: null, hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 });
  p.godMode = true; p.hurtT = 0; p.entryInv = 0;
  return p.stats.maxHearts;
});
await install(ev);
const dir = path.dirname(fileURLToPath(import.meta.url));
for (const id of IDS) {
  if (only.length && !only.includes(id)) continue;
  const f = path.join(dir, `${id}.mjs`);
  let mod;
  try { mod = (await import(pathToFileURL(f).href)).default; } catch (e) { ok(`${id}: plugin file`, false, e.message); continue; }
  const e0 = g.errors.length;
  try { await reset(); await mod.run({ g, ev, ok: (n, c, x) => ok(`${id}: ${n}`, c, x), reset, warn }); } catch (e) { ok(`${id}: plugin`, false, e.message); }
  const errs = g.errors.slice(e0).filter((e) => !/favicon|Failed to load resource|noassets/i.test(e));
  ok(`${id}: no console errors`, errs.length === 0, errs.slice(0, 2).join(' | ').slice(0, 240));
}
console.log(`\nitems-i1: ${r.pass} pass, ${r.fail} fail, ${r.warn} warn`);
await g.close();
process.exit(r.fail ? 1 : 0);
