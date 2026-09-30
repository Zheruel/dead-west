// Runs the FE-I3 per-item plugins (6 actives + 10 deals) plus the Crossroads / revive-order validation on one private dev server:
//   node tools/qa/items2/_run_i3.mjs [item_id | xroads | revive ...] [?query]
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { boot, reporter } from '../items2-lib.mjs';
import { install } from './_i3.mjs';

const IDS = ['pawn_ticket', 'dynamite_crate', 'gideons_bible', 'cylinder_spin', 'lasso_rope', 'ouija_planchette',
  'devils_own_colt', 'cylinder_of_sin', 'bloodletter', 'reapers_bargain', 'gold_fever', 'brimstone_bandolier', 'lazarus_pact', 'pact_of_ashes', 'devils_dice', 'leech_contract',
  '_xroads_i3', '_revive_i3'];
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('?')).map((a) => (a === 'xroads' ? '_xroads_i3' : a === 'revive' ? '_revive_i3' : a));
const query = args.find((a) => a.startsWith('?')) || '?debug=1&seed=42';
const { ok, warn, r } = reporter();
const g = await boot('items-i3', query);
const ev = (fn, ...a) => g.eval(fn, ...a);
const reset = () => ev(() => {
  const dw = window.__dw, p = dw.player;
  if (dw.scene.roomMgr.inPocket) dw.scene.roomMgr.leavePocket();
  dw.api.killAll(); for (const f of [...p.familiars]) f.destroy();
  p.restore({ items: [], active: null, hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 });
  p.heartDebt = 0; p.reviveCharges = 0; p.recomputeStats();
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
console.log(`\nitems-i3: ${r.pass} pass, ${r.fail} fail, ${r.warn} warn`);
await g.close();
process.exit(r.fail ? 1 : 0);
