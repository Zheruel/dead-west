// Round-2 items QA helpers: the expected-catalogue tables (ITEMS_V2 3.1 / 4.5, ARCH_V2 gate map), a node loader that registers every def without
// Phaser (runtime-only imports are stubbed by a loader hook), and the browser boot used by regress-items2 / per-item plugins.
import { register } from 'node:module';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** ITEMS 4.5: id, type (P passive / A active / D deal), tier, pools, weight, tags. */
const M = (s) => s.trim().split('\n').map((l) => {
  const [id, type, tier, pool, wt, tags] = l.trim().split(/\s*\|\s*/);
  return { id, type, tier: +tier, pool: pool.split(' '), weight: +wt, tags: tags.split(' ') };
});
export const NEW_ITEMS = M(`
forked_tongue | P | 2 | treasure boss | 1.0 | spread ammo
widows_bone | P | 2 | treasure boss | 0.8 | ammo pierce bounce
lightning_rod | P | 2 | treasure boss secret | 0.8 | shock
blast_caps | P | 1 | treasure shop | 1.0 | explosive ammo
wraith_rounds | P | 2 | treasure secret | 0.7 | ghost pierce
lodestone | P | 2 | treasure boss | 0.7 | ammo
blue_norther | P | 2 | treasure shop boss | 0.8 | frost
brand_iron | P | 2 | treasure boss | 0.8 | fire
gila_gland | P | 2 | treasure secret | 0.8 | poison
holy_water | P | 2 | treasure shop boss | 0.8 | holy undead_slayer
wanted_poster | P | 2 | treasure shop | 0.8 | gold crit
bronco_boots | P | 2 | treasure boss | 0.8 | roll speed
hand_mirror | P | 2 | treasure boss secret | 0.6 | roll armor
black_cat_bone | P | 3 | boss secret | 0.4 | luck
blood_bandana | P | 1 | treasure shop | 1.0 | blood speed rapid
banker_ledger | P | 1 | treasure shop | 1.0 | gold
hush_money | P | 2 | treasure shop secret | 0.6 | gold armor
rabbits_foot | P | 1 | treasure shop secret | 1.0 | luck crit
dowsing_rod | P | 1 | treasure shop | 1.0 | luck
bone_hound | P | 2 | treasure boss | 0.8 | familiar
tumbleweed_pal | P | 1 | treasure shop | 1.0 | familiar
little_coffin | P | 2 | treasure boss c2 | 0.7 | familiar
saints_halo | P | 3 | boss c2 | 0.4 | holy armor familiar
lit_cigar | P | 1 | treasure shop | 1.0 | dynamite explosive
nitro_jelly | P | 2 | treasure secret | 0.7 | explosive fire dynamite
short_cylinder | P | 2 | treasure boss | 0.8 | sixth
hellfire_round | P | 3 | boss secret c2 | 0.5 | sixth fire explosive
carousel_slug | P | 3 | treasure boss c2 | 0.5 | sixth ammo
widowmaker | P | 3 | boss c2 | 0.5 | sixth
ten_gauge_hammer | P | 2 | treasure boss | 0.7 | sixth spread
pawn_ticket | A | 1 | shop treasure | 0.8 | gold
dynamite_crate | A | 2 | treasure secret | 0.7 | dynamite explosive
gideons_bible | A | 3 | boss treasure c2 | 0.5 | holy undead_slayer
cylinder_spin | A | 2 | treasure boss | 0.7 | sixth
lasso_rope | A | 2 | treasure shop | 0.7 | hex
ouija_planchette | A | 3 | boss secret c2 | 0.5 | ghost
devils_own_colt | D | 3 | crossroads | 1 | curse ammo
cylinder_of_sin | D | 3 | crossroads | 1 | sixth curse
bloodletter | D | 3 | crossroads c2 | 1 | sixth blood curse
reapers_bargain | D | 3 | crossroads c2 | 1 | ghost pierce curse
gold_fever | D | 3 | crossroads | 1 | gold curse
brimstone_bandolier | D | 3 | crossroads c2 | 1 | dynamite explosive curse
lazarus_pact | D | 3 | crossroads c2 | 1 | heal curse
pact_of_ashes | D | 3 | crossroads | 1 | fire curse
devils_dice | D | 3 | crossroads | 1 | luck crit curse
leech_contract | D | 3 | crossroads | 1 | blood heal curse
`);

/** ARCH_V2 D5 gate map (items not listed are start-unlocked). */
export const GATE_OF = {
  dowsing_rod: 'gulch', hush_money: 'gulch', brand_iron: 'perdition', little_coffin: 'perdition', lodestone: 'mine', gila_gland: 'mine',
  saints_halo: 'c2', widowmaker: 'c2', hellfire_round: 'sixth', carousel_slug: 'sixth', dynamite_crate: 'pyro', nitro_jelly: 'pyro', blast_caps: 'pyro',
  gideons_bible: 'holy', wraith_rounds: 'sniper', devils_dice: 'gambler', ouija_planchette: 'occult', lasso_rope: 'occult',
  cylinder_of_sin: 'bloodpact', bloodletter: 'bloodpact', lazarus_pact: 'bloodpact', brimstone_bandolier: 'bloodpact', pact_of_ashes: 'chaos',
  reapers_bargain: 'ghost', hand_mirror: 'lawman', black_cat_bone: 'undead', tumbleweed_pal: 'beast', widows_bone: 'scrap',
};

/** ITEMS 3.1: tags and tier of the 28 round-1 items. */
export const OLD_ITEMS = {
  spurs: [['speed', 'roll'], 1], lucky_horseshoe: [['luck', 'crit'], 1], hollow_point: [['ammo'], 1], speed_loader: [['rapid'], 2], long_barrel: [['ammo'], 1],
  sawed_off: [['spread'], 2], ricochet: [['bounce'], 2], dead_eye: [['crit', 'luck'], 3], bandolier: [['dynamite', 'explosive'], 1], snake_oil: [['heal'], 1],
  tin_star: [['armor'], 1], liquid_courage: [['blood'], 2], cursed_coin: [['gold', 'luck'], 1], rattler_fang: [['poison'], 2],
  silver_bullets: [['undead_slayer', 'holy', 'ammo'], 2], dynamite_vest: [['dynamite', 'explosive', 'armor'], 3], spirit_lantern: [['ghost', 'fire', 'familiar'], 3],
  crow_companion: [['familiar'], 2], voodoo_doll: [['hex'], 2], duster_coat: [['armor'], 2], prospectors_pan: [['gold'], 1], hex_bag: [['fire', 'hex'], 2],
  fan_the_hammer: [['rapid', 'sixth'], 3], mezcal_worm: [['blood', 'speed'], 2], whiskey_bottle: [['heal'], 1], pocket_watch: [['speed'], 2],
  powder_keg: [['explosive', 'dynamite'], 3], lucky_deck: [['luck', 'gold'], 2],
};

/** Loader hook source: stub every runtime (Phaser-dependent) module a def imports, keep registry / tags / synergies real. */
const HOOK = `
const STUB = 'data:text/javascript,' + encodeURIComponent('const h = { get: (t, k) => (k === "then" ? undefined : new Proxy(function () {}, h)), apply: () => undefined, construct: () => ({}) };' +
  'const s = new Proxy(function () {}, h); export default s; export const Sfx = s, bus = s, rng = s, explode = s, startBulletTime = s, Assets = s, Save = s, nova = s, firePool = s, itemFx = s;');
export async function resolve(spec, ctx, next) {
  if (spec === 'phaser' || /(\\/|^)(core|systems|entities|scenes|ui)\\//.test(spec) || /familiars\\/|fx\\//.test(spec)) {
    if (/synergies|tags|registry|baseStats|hooks/.test(spec) && !/fx\\//.test(spec)) return next(spec, ctx);
    return { url: STUB, shortCircuit: true };
  }
  return next(spec, ctx);
}`;
let hooked = false;
/** Registers every src/items/defs/*.js in a plain node process. Returns {registry, tags, synergies, baseStats, files, failed:{file: message}}. */
export async function loadNodeRegistry() {
  if (!hooked) { register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url); hooked = true; }
  const src = (f) => pathToFileURL(path.join(ROOT, 'src/items', f)).href;
  const registry = await import(src('registry.js'));
  const tags = await import(src('tags.js'));
  const synergies = await import(src('synergies.js'));
  const baseStats = await import(src('baseStats.js'));
  const files = readdirSync(path.join(ROOT, 'src/items/defs')).filter((f) => f.endsWith('.js')).sort();
  const failed = {};
  for (const f of files) {
    try { await import(src(`defs/${f}`)); } catch (e) { failed[f] = String(e && e.message || e); }
  }
  return { registry, tags, synergies, baseStats, files, failed };
}

/** Browser boot: private isolated dev server, stop Menu, start Game, wait for the player. */
export async function boot(name, query = '?debug=1&seed=42') {
  const { boot: b } = await import('./items-lib.mjs');
  return b(name, query);
}

export function reporter() {
  const r = { pass: 0, fail: 0, warn: 0 };
  const ok = (n, c, extra = '') => { r[c ? 'pass' : 'fail']++; console.log(c ? 'PASS' : 'FAIL', n, extra); };
  const warn = (n, extra = '') => { r.warn++; console.log('WARN', n, extra); };
  return { r, ok, warn };
}
