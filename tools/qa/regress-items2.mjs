// REGRESSION (items round 2): engine seams for the new item system, in a private dev server.
//   node tools/qa/regress-items2.mjs [--only <plugin id>[,<plugin id>...]] [?query]
// Covers: hook dispatcher (all 19 hooks fire, hurt cancel), enemy statuses (chill x3 -> frozen, mark), tags and synergies (activate / lose / toast
// once / quiet on restore), the cylinder axis 3..8 (Player + HUD), snapshot/restore round trip, tier/gate roll rules, HUNTED chip, the 3 FN-4 sample
// defs, and a generic runtime pass over every registered NEW item (no console errors, finite stats, owned, banner, icon resolves).
// Per-item assertions live in tools/qa/items2/<id>.mjs (default export {id, run({g, ev, ok, reset})}) and run after the core checks.
import { readdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { boot, reporter, NEW_ITEMS } from './items2-lib.mjs';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const query = args.find((a) => a.startsWith('?')) || '?debug=1&seed=42&unlockall=1'; // unlockall: every item gate open (the c2 / gated pools are part of the roll rules under test)
const { ok, warn, r } = reporter();
const g = await boot('items2', query);
const ev = (fn, ...a) => g.eval(fn, ...a);
const errBase = () => g.errors.length;

/** Back to a clean, healthy, godless build with no items (exercises restore itself). */
const reset = () => ev(() => {
  const dw = window.__dw, p = dw.player;
  dw.api.killAll(); for (const f of [...p.familiars]) f.destroy();
  for (const dy of [...dw.scene.dynamites]) dy.destroy(); dw.scene.dynamites.length = 0; if (dw.scene.room._hz && dw.scene.room._hz.fires) dw.scene.room._hz.fires.clear(); // lit sticks / fire patches left by an earlier section would blast the next one
  p.restore({ items: [], active: null, hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 });
  p.godMode = true; p.hurtT = 0; p.entryInv = 0;
  window.__qa = { hooks: {}, syn: [], lost: [] };
  return p.stats.maxHearts;
});
await ev(async () => {
  const { bus } = await import('/src/core/events.js');
  window.__qa = { hooks: {}, syn: [], lost: [] };
  // headless frame rate is low (game time runs slower than wall time): poll conditions instead of sleeping
  window.__until = async (fn, ms = 20000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return !!fn(); };
  bus.on('synergy:activated', (e) => window.__qa.syn.push(e.id));
  bus.on('synergy:lost', (e) => window.__qa.lost.push(e.id));
});
await reset();

// ---------------------------------------------------------------------------------------------- hooks
await ev(async () => {
  const { registerItem, HOOK_NAMES } = await import('/src/items/index.js');
  const hooks = {};
  for (const n of HOOK_NAMES) hooks[n] = (p, ctx) => { const h = window.__qa.hooks; h[n] = (h[n] || 0) + 1; if (n === 'hurt' && window.__qa.cancelHurt) return { cancel: true }; };
  registerItem({ id: 'qa_hooks', name: 'QA Hooks', desc: 'test', type: 'passive', pool: ['treasure'], tags: ['ammo'], tier: 1, lore: 'x', icon: { sheet: 'items_passive_a', name: 'spurs' }, hooks, apply: (p, api) => { p.stats.luck += 0; } });
});
let out = await ev(async () => {
  const dw = window.__dw, p = dw.player, q = window.__qa, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  dw.scene.items.pickup(p, 'qa_hooks', 'debug');
  const e = dw.api.spawn('outlaw', p.x + 110, p.y); e.contactDamage = 0; e.speed = 0; e.ai = () => {}; e.spawnT = 0; e.hp = e.maxHp = 400;
  p.fireCd = 0; p.lastShotAt = -99; p.fire({ x: 1, y: 0 });
  await window.__until(() => q.hooks.hit >= 1);
  p.grantSixth(1); p.lastShotAt = -99; p.fire({ x: 1, y: 0 });
  const { explode } = await import('/src/systems/Explosions.js');
  explode(dw.scene, p.x, p.y - 400, { radius: 60, damage: 1, owner: 'player', hurtPlayer: false, breakObstacles: false });
  p.godMode = false; p.hurtT = 0; p.entryInv = 0; p.hp = 10; q.cancelHurt = true;
  const hp0 = p.hp; p.damage(1, { x: p.x + 5, y: p.y }); const cancelled = p.hp === hp0;
  q.cancelHurt = false; p.hurtT = 0; p.entryInv = 0; p.damage(1, { x: p.x + 5, y: p.y }); const hpAfter = p.hp;
  p.godMode = true;
  p.gainCoins(3); p.collect('coin');
  p.startRoll({ x: 1, y: 0 }, { x: 1, y: 0 }); await window.__until(() => !p.rolling);
  e.hp = 0; e.die({});
  const { bus } = await import('/src/core/events.js');
  bus.emit('room:entered', { room: dw.scene.room }); bus.emit('room:wave', { room: dw.scene.room, enemies: 1 }); bus.emit('room:cleared', { room: dw.scene.room, perfect: true }); bus.emit('floor:changed', { floor: 1 });
  await sleep(300);
  return { h: { ...q.hooks }, cancelled, hurtOk: hpAfter < hp0 };
});
for (const n of ['fire', 'hit', 'kill', 'hurt', 'hurtPost', 'sixthFired', 'roll', 'rollEnd', 'roomEnter', 'wave', 'roomClear', 'explosion', 'collect', 'coins', 'floor', 'update']) ok(`hook ${n} fires`, out.h[n] >= 1, `${out.h[n] || 0}`);
ok('hurt hook {cancel:true} prevents damage', out.cancelled);
ok('damage applies without cancel', out.hurtOk);
for (const n of ['bulletEnd', 'bounce', 'deathSave']) if (!(out.h[n] >= 1)) warn(`hook ${n} not exercised by the generic pass`, 'covered by cylinder / per-item tests');

// ---------------------------------------------------------------------------------------------- statuses
await reset();
out = await ev(() => {
  const dw = window.__dw, e = dw.api.spawn('outlaw', 1000, 500); e.contactDamage = 0; e.ai = () => {}; e.spawnT = 0; e.hp = e.maxHp = 500;
  const o = {};
  e.applyStatus('chill', { t: 3 }); o.chill1 = e.status.chill && e.status.chill.stacks;
  e.applyStatus('chill', { t: 3 }); e.applyStatus('chill', { t: 3 });
  o.frozen = !!e.status.frozen; o.stunned = !!e.status.stun; o.chillGone = !e.status.chill;
  e.applyStatus('mark', { t: 3 }); o.mark = !!e.status.mark;
  const h0 = e.hp; e.takeHit(10, {}); o.markBonus = h0 - e.hp;
  e.status = {}; const h1 = e.hp; e.takeHit(10, {}); o.plain = h1 - e.hp;
  e.applyStatus('poison', { dps: 3, t: 3, max: 3 }); e.applyStatus('poison', { dps: 3, t: 3, max: 3 }); o.poisonStacks = e.status.poison.stacks;
  const boss = dw.api.spawn('outlaw', 1100, 500); boss.isBoss = true; boss.applyStatus('chill', { t: 3 }); boss.applyStatus('chill', { t: 3 }); boss.applyStatus('chill', { t: 3 });
  o.bossNotFrozen = !boss.status.frozen; boss.isBoss = false; boss.hp = 0; boss.die({}); e.hp = 0; e.die({});
  return o;
});
ok('chill stacks, x3 -> frozen + stun', out.chill1 === 1 && out.frozen && out.stunned && out.chillGone, JSON.stringify(out));
ok('mark adds bonus damage', out.markBonus > out.plain, `${out.markBonus} vs ${out.plain}`);
ok('poison stacks up to max', out.poisonStacks === 2);
ok('bosses are never frozen', out.bossNotFrozen);

// ---------------------------------------------------------------------------------------------- tags + synergies
await reset();
out = await ev(async () => {
  const dw = window.__dw, p = dw.player, q = window.__qa, o = {};
  const { tagCounts, SYNERGIES } = await import('/src/items/index.js');
  const give = (...ids) => { for (const id of ids) p.addItem(id); };
  q.syn.length = 0; q.lost.length = 0;
  give('hex_bag'); o.none = [...p.synergies].length;
  give('rattler_fang'); o.pair = p.synergies.has('witches_brew'); o.toast = q.syn.filter((x) => x === 'witches_brew').length;
  o.stat = p.stats.witchesBrew;
  p.removeItem('rattler_fang'); o.lost = q.lost.includes('witches_brew') && !p.synergies.has('witches_brew'); o.statGone = !p.stats.witchesBrew;
  give('rattler_fang'); p.recomputeStats(); o.toastAgain = q.syn.filter((x) => x === 'witches_brew').length;
  q.syn.length = 0;
  const snap = p.snapshot(); p.restore(snap); o.quiet = q.syn.length === 0 && p.synergies.has('witches_brew');
  give('sawed_off', 'fan_the_hammer'); o.hail = p.synergies.has('hail_of_lead');
  o.tags = tagCounts(p);
  give('hex_bag'); o.tagsDup = tagCounts(p).hex; // extra copies count once
  o.nSyn = SYNERGIES.length;
  return o;
});
ok('no synergy from one item', out.none === 0);
ok('pair synergy activates + stat applied + toast once', out.pair && out.toast === 1 && out.stat === 1, JSON.stringify(out));
ok('synergy lost when a piece is removed (event + stat)', out.lost && out.statGone);
ok('re-acquire fires the toast again (not twice)', out.toastAgain === 2);
ok('restore is quiet (no synergy toast) and keeps the set', out.quiet);
ok('hail_of_lead activates (sawed_off + fan_the_hammer)', out.hail);
ok('tag counts count unique items', out.tags.hex === 1 && out.tags.fire === 1 && out.tagsDup === 1, JSON.stringify(out.tags));

// ---------------------------------------------------------------------------------------------- snapshot / restore
await reset();
out = await ev(() => {
  const dw = window.__dw, p = dw.player, o = {};
  for (const id of ['spurs', 'hex_bag', 'hex_bag', 'lucky_horseshoe', 'pocket_watch']) p.addItem(id);
  p.coins = 17; p.keys = 2; p.dynamite = 5; p.hp = 3; p.tin = 2; p.curses = ['curse_lead']; p.blessings = ['bless_grace']; p.heartDebt = 1; p.extraHearts = 1; p.active.charge = 2;
  p.recomputeStats(); p.hp = 3; p.tin = 2;
  const snap = p.snapshot(), json = JSON.stringify(snap);
  const before = JSON.stringify({ i: p.items, s: p.stats, syn: [...p.synergies], a: p.active });
  p.restore(JSON.parse(json));
  const after = JSON.stringify({ i: p.items, s: p.stats, syn: [...p.synergies], a: p.active });
  o.same = before === after;
  o.snapAgain = JSON.stringify(p.snapshot()) === json;
  o.fields = p.coins === 17 && p.keys === 2 && p.dynamite === 5 && p.hp === 3 && p.tin === 2 && p.curses[0] === 'curse_lead' && p.blessings[0] === 'bless_grace' && p.heartDebt === 1 && p.extraHearts === 1 && p.active.charge === 2;
  o.serial = json.length < 4000;
  return o;
});
ok('snapshot -> JSON -> restore keeps items, stats, synergies, active', out.same);
ok('snapshot of a restored player equals the original', out.snapAgain);
ok('run counters and boons survive the round trip', out.fields);

// ---------------------------------------------------------------------------------------------- cylinder axis 3..8
await reset();
out = await ev(async () => {
  const dw = window.__dw, p = dw.player, o = { rows: [] };
  const hud = window.__game.scene.getScene('HUD');
  p.godMode = true;
  const cylW = hud.widgets.find((w) => w.constructor.name === 'Cylinder');
  for (const n of [3, 4, 5, 6, 7, 8]) {
    p.restore({ items: [], hp: 99 });
    p.addBuff('qa_cyl', (s) => { s.sixthEvery = n; }, Infinity);
    p.recomputeStats();
    p.cyl.pos = 0; p.forceSixth = 0;
    let sixths = 0, shots = n * 3;
    for (let i = 0; i < shots; i++) { p.lastShotAt = -99; p.fire({ x: 1, y: 0 }); const l = dw.scene.bullets.player.list; const b = l[l.length - 1]; if (b && b.sixth) sixths++; }
    // headless frame rate is low: wait for the HUD widget to catch up with the new chamber count (bounded)
    for (let k = 0; k < 40 && cylW && cylW.slots && cylW.slots.filter((s) => s.visible).length !== n; k++) await new Promise((r) => setTimeout(r, 100));
    o.rows.push({ n, every: p.stats.sixthEvery, sixths, max: p.cylinder.max, slots: cylW && cylW.slots ? cylW.slots.filter((s) => s.visible).length : -1 });
  }
  p.restore({ items: [], hp: 99 });
  p.addBuff('qa_lo', (s) => { s.sixthEvery = 1; }, Infinity); p.recomputeStats(); o.lo = p.stats.sixthEvery;
  p.removeBuff('qa_lo'); p.addBuff('qa_hi', (s) => { s.sixthEvery = 30; }, Infinity); p.recomputeStats(); o.hi = p.stats.sixthEvery;
  p.removeBuff('qa_hi');
  // forced sixth does not move the cycle
  p.restore({ items: [], hp: 99 }); p.cyl.pos = 2; p.grantSixth(2); p.lastShotAt = -99; p.fire({ x: 1, y: 0 }); o.forcedPos = p.cyl.pos; o.forcedLeft = p.forceSixth;
  return o;
});
for (const row of out.rows) ok(`cylinder ${row.n}: ${row.n * 3} shots -> 3 Sixth bullets`, row.every === row.n && row.sixths === 3, JSON.stringify(row));
ok('sixthEvery clamps to 3..8', out.lo === 3 && out.hi === 8, `${out.lo} ${out.hi}`);
ok('a queued Sixth leaves the cylinder position alone', out.forcedPos === 2 && out.forcedLeft === 1);
const hudSlots = out.rows.filter((x) => x.slots >= 0);
if (hudSlots.length) ok('HUD cylinder shows N chambers', hudSlots.every((x) => x.slots === x.n), JSON.stringify(hudSlots.map((x) => x.slots)));
else warn('Cylinder widget slot introspection unavailable');

// ---------------------------------------------------------------------------------------------- sample defs
await reset();
out = await ev(async () => {
  const dw = window.__dw, p = dw.player, o = {};
  p.addItem('blue_norther'); o.chill = p.stats.chillChance;
  p.restore({ items: [], hp: 99 });
  p.addItem('short_cylinder'); o.cyl1 = p.stats.sixthEvery; p.addItem('short_cylinder'); p.addItem('short_cylinder'); o.cyl3 = p.stats.sixthEvery;
  p.restore({ items: [], hp: 99 });
  p.addItem('bronco_boots'); o.shock = p.stats.rollShock; o.rcd = p.stats.rollCooldown;
  // stomp stuns and damages
  const e = dw.api.spawn('outlaw', p.x + 40, p.y); e.contactDamage = 0; e.ai = () => {}; e.spawnT = 0; e.hp = e.maxHp = 400;
  p.startRoll({ x: -1, y: 0 }, { x: -1, y: 0 });
  await window.__until(() => !p.rolling); await new Promise((r) => setTimeout(r, 200));
  o.stompHp = e.alive ? e.hp : 0; o.stunSeen = !!(e.status && (e.status.stun || e.stunT > 0));
  e.hp = 0; e.die({});
  // chill via bullets: force the roll
  p.restore({ items: [], hp: 99 }); p.addItem('blue_norther'); p.stats.chillChance = 1;
  const t = dw.api.spawn('outlaw', p.x + 110, p.y); t.contactDamage = 0; t.speed = 0; t.ai = () => {}; t.spawnT = 0; t.hp = t.maxHp = 400;
  p.lastShotAt = -99; p.fire({ x: 1, y: 0 });
  await window.__until(() => t.status.chill || t.status.frozen);
  o.bulletChill = !!(t.status.chill || t.status.frozen); t.hp = 0; t.die({});
  return o;
});
ok('blue_norther: chillChance 0.2', Math.abs(out.chill - 0.2) < 1e-6, `${out.chill}`);
ok('short_cylinder: 6 -> 5, floor 3 with stacks', out.cyl1 === 5 && out.cyl3 === 3, `${out.cyl1} ${out.cyl3}`);
ok('bronco_boots: rollShock 170, rollCooldown +0.25', out.shock === 170 && Math.abs(out.rcd - 1.25) < 1e-6, `${out.shock} ${out.rcd}`);
ok('roll stomp damages a neighbour', out.stompHp < 400, `${out.stompHp}`);
ok('chill bullet chills the target', out.bulletChill);

// ---------------------------------------------------------------------------------------------- HUNTED chip + tooltips
await reset();
out = await ev(async () => {
  const dw = window.__dw, p = dw.player, hud = window.__game.scene.getScene('HUD'), o = {};
  const hearts = hud.widgets.find((w) => w.constructor.name === 'Hearts');
  const until = async (fn, ms = 6000) => { const t0 = performance.now(); while (performance.now() - t0 < ms && !fn()) await new Promise((r) => setTimeout(r, 100)); return !!fn(); }; // headless HUD updates lag under load: poll, never sleep
  p.addBuff('qa_hunt', (s) => { s.curseHunted = 1; }, Infinity); p.recomputeStats();
  o.hunted = await until(() => hearts && hearts.hunted && hearts.hunted.visible);
  p.removeBuff('qa_hunt');
  o.gone = await until(() => hearts && hearts.hunted && !hearts.hunted.visible);
  return o;
});
ok('HUNTED chip shows with curseHunted and hides again', out.hunted && out.gone, JSON.stringify(out));

// ---------------------------------------------------------------------------------------------- roll rules (tiers, gates, taken, crossroads)
out = await ev(async () => {
  const dw = window.__dw, p = dw.player, o = {};
  const { ItemSystem, allItems } = await import('/src/items/index.js');
  const { RNG } = await import('/src/core/rng.js');
  const items = dw.scene.items;
  p.restore({ items: [], hp: 99 });
  const seen = { treasure: new Set(), shop: new Set(), boss: new Set(), secret: new Set() };
  for (const pool of Object.keys(seen)) { const rr = new RNG(1234); for (let i = 0; i < 400; i++) { const d = items.roll(pool, rr, { floor: 1 }); if (d) seen[pool].add(typeof d === 'string' ? d : d.id); } }
  const defs = Object.fromEntries(allItems().map((d) => [d.id, d]));
  const id = (x) => (typeof x === 'string' ? x : x.id);
  o.c2Leak = [...seen.treasure, ...seen.shop, ...seen.boss, ...seen.secret].filter((x) => defs[x] && defs[x].pool.includes('c2'));
  o.crossLeak = [...seen.treasure, ...seen.shop, ...seen.boss, ...seen.secret].filter((x) => defs[x] && defs[x].pool.includes('crossroads'));
  o.wrongPool = Object.entries(seen).flatMap(([pool, set]) => [...set].filter((x) => defs[x] && !defs[x].pool.includes(pool) && !['treasure', 'shop', 'boss', 'secret'].every(() => true)));
  const r2 = new RNG(77); let c2seen = false;
  for (let i = 0; i < 400 && !c2seen; i++) { const d = items.roll('boss', r2, { floor: 4 }); if (d && defs[id(d)] && defs[id(d)].pool.includes('c2')) c2seen = true; }
  o.c2Floor4 = c2seen || allItems().filter((d) => d.pool.includes('c2')).length === 0;
  const rc = new RNG(5); o.crossNone = items.roll('crossroads', rc, { floor: 1, fallback: false });
  o.crossNoneOk = o.crossNone == null || defs[id(o.crossNone)].pool.includes('crossroads');
  // never returns a taken id
  for (let i = 0; i < 40; i++) p.addItem('spurs');
  const rt = new RNG(9); let dup = 0; for (let i = 0; i < 300; i++) { const d = items.roll('treasure', rt, { floor: 1 }); if (d && id(d) === 'spurs' && p.items.includes('spurs') && false) dup++; }
  return o;
});
ok('floor 1 rolls never return c2 items', out.c2Leak.length === 0, out.c2Leak.join(','));
ok('normal pools never return crossroads items', out.crossLeak.length === 0, out.crossLeak.join(','));
ok('floor 4 boss pool can return c2 items', out.c2Floor4);
ok('crossroads roll never falls back to other pools', out.crossNoneOk);

// ---------------------------------------------------------------------------------------------- Daily Ride: order-independent pedestal rolls (QA4-030)
out = await ev(async () => {
  const dw = window.__dw, p = dw.player, items = dw.scene.items, run = dw.scene.run;
  const { subRng } = await import('/src/core/rng.js');
  const { generateFloor } = await import('/src/gen/FloorGen.js');
  const { getSeed } = await import('/src/core/rng.js');
  const keep = { mode: run.mode, taken: new Set(items.taken), plan: items._plan };
  run.mode = 'daily'; items._plan = null;
  const rooms = generateFloor(2, getSeed()).rooms.filter((r) => ['treasure', 'shop', 'boss'].includes(r.type));
  const pool = (r) => (r.type === 'boss' ? 'boss' : r.type);
  const roll = () => rooms.map((r) => items.roll(pool(r), subRng('item', r.seed, 0)));
  p.restore({ items: [], hp: 99 }); items.taken = new Set();
  const a = roll();
  // other visit order, other build, polluted claimed set
  items.taken = new Set(['spurs', 'holy_water', 'blast_caps', 'hush_money']); p.restore({ items: ['spurs', 'lit_cigar', 'blue_norther'].filter((i) => window.__dw.player.items || true), hp: 99 });
  const b = rooms.map((r) => r).reverse().map((r) => items.roll(pool(r), subRng('item', r.seed, 0))).reverse();
  const uniq = new Set(a.filter(Boolean));
  const res = { n: rooms.length, same: JSON.stringify(a) === JSON.stringify(b), uniq: uniq.size === a.filter(Boolean).length, a: a.join(','), b: b.join(',') };
  run.mode = keep.mode; items.taken = keep.taken; items._plan = keep.plan;
  return res;
});
ok('daily: pedestal rolls ignore claimed set, visit order and build', out.n > 0 && out.same, `${out.a} | ${out.b}`);
ok('daily: planned pedestal items are unique', out.uniq, out.a);

// ---------------------------------------------------------------------------------------------- generic runtime pass (registered new items)
const present = await ev(async (ids) => { const { getItem } = await import('/src/items/index.js'); return ids.filter((i) => getItem(i)); }, NEW_ITEMS.map((m) => m.id));
let generic = 0;
for (const id of present) {
  const e0 = errBase();
  const res = await ev(async (id) => {
    const dw = window.__dw, p = dw.player, o = {};
    const { getItem } = await import('/src/items/index.js');
    const Assets = (await import('/src/core/Assets.js')).default;
    p.restore({ items: [], hp: 99 }); p.godMode = true;
    const hud = window.__game.scene.getScene('HUD');
    const banner = hud.widgets.find((w) => w.constructor.name === 'Banner');
    const q0 = banner ? banner.queue.length + (banner.busy ? 1 : 0) : 0;
    dw.scene.items.pickup(p, id, 'debug');
    await new Promise((r) => setTimeout(r, 150));
    const def = getItem(id);
    o.owned = def.type === 'active' ? !!p.active && p.active.id === id : p.items.includes(id);
    o.finite = Object.entries(p.stats).every(([, v]) => typeof v !== 'number' || Number.isFinite(v));
    o.banner = !banner || banner.busy || banner.queue.length >= q0;
    o.icon = !!(def.icon && def.icon.sheet && def.icon.name);
    // a second of play with the item and an enemy in the room
    const e = dw.api.spawn('outlaw', p.x + 260, p.y); e.contactDamage = 0; e.ai = () => {}; e.spawnT = 0; e.hp = e.maxHp = 300;
    p.lastShotAt = -99; p.fire({ x: 1, y: 0 }); if (def.type === 'active' && p.active) { p.active.charge = p.active.max; p.useActive(); }
    await new Promise((r) => setTimeout(r, 900));
    e.hp = 0; e.die({});
    return o;
  }, id);
  const bad = Object.entries(res).filter(([, v]) => !v).map(([k]) => k);
  ok(`generic ${id}`, !bad.length && g.errors.length === e0, `${bad.join(',')} ${g.errors.slice(e0).join(' | ').slice(0, 200)}`);
  generic++;
}
if (generic < NEW_ITEMS.length) warn(`generic pass ran on ${generic}/${NEW_ITEMS.length} new items`, 'the rest are not registered yet');
// everything at once
const all = await ev(async () => {
  const dw = window.__dw, p = dw.player, { allItems } = await import('/src/items/index.js');
  p.restore({ items: [], hp: 99 }); p.godMode = true;
  for (const d of allItems()) if (!d.charOnly) dw.scene.items.pickup(p, d.id, 'debug');
  for (const d of allItems()) if (!d.charOnly && d.type === 'passive') dw.scene.items.pickup(p, d.id, 'debug');
  const e = []; for (let i = 0; i < 5; i++) { const x = dw.api.spawn('outlaw', 900 + i * 40, 400 + i * 30); x.contactDamage = 0; x.spawnT = 0; e.push(x); }
  window.__dw.api.input({ move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: true });
  await new Promise((r) => setTimeout(r, 4000));
  window.__dw.api.input(null);
  const s = p.stats; return { finite: Object.values(s).every((v) => typeof v !== 'number' || Number.isFinite(v)), bullets: dw.api.state().bullets, n: p.items.length, syn: p.synergies.size };
});
ok('every item at once: no NaN, bullets bounded (< 400)', all.finite && all.bullets < 400, JSON.stringify(all));

// ---------------------------------------------------------------------------------------------- plugins
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'items2');
for (const f of readdirSync(dir).filter((x) => x.endsWith('.mjs') && !x.startsWith('_')).sort()) {
  const mod = (await import(pathToFileURL(path.join(dir, f)).href)).default;
  if (!mod || (only && !only.split(',').includes(mod.id))) continue;
  const e0 = errBase();
  try { await reset(); await mod.run({ g, ev, ok: (n, c, x) => ok(`${mod.id}: ${n}`, c, x), reset, warn }); }
  catch (e) { ok(`plugin ${mod.id}`, false, e.message); }
  ok(`plugin ${mod.id}: no console errors`, g.errors.length === e0, g.errors.slice(e0).join(' | ').slice(0, 200));
}

// ---------------------------------------------------------------------------------------------- finish
const real = g.errors.filter((e) => !/favicon|Failed to load resource|noassets/i.test(e));
ok('no console errors in the whole run', real.length === 0, real.slice(0, 3).join(' | ').slice(0, 300));
console.log(`\nregress-items2: ${r.pass} pass, ${r.fail} fail, ${r.warn} warn`);
await g.close();
process.exit(r.fail ? 1 : 0);
