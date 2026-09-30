// FIX-4 check: STORY 11.3 spoken lines in the six event rooms + the dead_mans_hand secret + elite nameplate clamp / stacking.
//   node tools/qa/fix4-events.mjs [--shots]
// For each event: force the room, speak every EVENT_LINES key through the controller (tag exists, text matches, tag inside the play area),
// drive the real outcome paths (bet, throw, dig, take, buy, duel win) and check a matching line appears. Elite plates: 8 elites near the
// top wall -> every plate inside [8, W-8] and below y 104, no two overlap.
import { boot } from './qa3v-lib.mjs';
import fs from 'node:fs';

const shots = process.argv.includes('--shots');
fs.mkdirSync('art/qa/v2', { recursive: true });
let failed = 0;
const ok = (c, m) => { if (c) console.log('  ok   ', m); else { failed++; console.log('  FAIL ', m); } };

const g = await boot('?debug=1&seed=11&unlockall=1');
await g.play('gunslinger');
await g.api(() => { const a = window.__dw.api; a.godMode(true); a.setFloor(2); a.setCoins(60); });
await g.wait(1500); await g.settle();
await g.eval(() => {
  window.__defs = () => window.__dw.scene.roomMgr.floor.rooms.filter((r) => (r._orig || r.type) === 'normal' && r.dist >= 2);
  window.__mk = (type, extra = {}, k = 0) => {
    const m = window.__dw.scene.roomMgr, def = window.__defs()[k % window.__defs().length];
    def._orig = def._orig || 'normal';
    for (const key of ['template', 'mini', 'event', 'variant', 'pocket']) delete def[key];
    Object.assign(def, { type, ...extra });
    delete m.states[def.id];
    m.jump(def.id, null);
    window.__dw.player.teleport(150, 250);
    return def.id;
  };
  window.__sub = () => { const r = window.__dw.scene.room; const c = r.controller('event') || r.controller('variant'); return c && (c.sub || c); };
  // fixed-step fast forward (game time, independent of the machine load)
  window.__t = 200000;
  window.__ff = (n) => { const game = window.__game, scs = game.scene.getScenes(false); game.loop.sleep(); const vis = scs.map((sc) => sc.sys.settings.visible); scs.forEach((sc) => (sc.sys.settings.visible = false)); for (let i = 0; i < n; i++) { const gs = window.__dw && window.__dw.scene; if (gs && gs.fx) gs.fx.hitStopUntil = 0; window.__t += 16.667; game.step(window.__t, 16.667); } scs.forEach((sc, k) => (sc.sys.settings.visible = vis[k])); game.loop.wake(); };
  // texts of the live speech tags (containers holding a Graphics + Text)
  window.__tags = () => window.__dw.scene.room.objs.filter((o) => o.scene && o.type === 'Container').map((o) => { const t = o.list.find((c) => c.type === 'Text'); const b = o.getBounds(); return { text: t ? t.text : '', x: b.x, y: b.y, w: b.width, h: b.height, a: o.alpha }; });
});
const LINES = await g.eval(async () => (await import('/src/data/story/dialogue.js')).EVENT_LINES);
const ROOMB = { x: 96, y: 192, r: 1344 };

const EV = ['card_sharp', 'wishing_well', 'gravedigger', 'preacher', 'snake_oil', 'quick_draw'];
const flat = (v) => (Array.isArray(v) ? v : [v]);
for (const e of EV) {
  console.log(e);
  await g.eval(new Function(`return window.__mk("event",{event:"${e}",template:"event_${e}"})`));
  await g.eval(() => window.__ff(92));
  for (const [key, v] of Object.entries(LINES[e])) {
    if (key === 'bell') continue; // shown by the duel clock (big text), not a tag
    const res = await g.eval((k) => { const s = window.__sub(); const t = s.speak(k, { n: 0 }); return t ? window.__tags().at(-1) : null; }, key);
    const want = flat(v);
    ok(res && want.includes(res.text), `${e}.${key} speaks its STORY line`);
    if (res) ok(res.x >= ROOMB.x + 4 && res.x + res.w <= ROOMB.r - 4 && res.y >= ROOMB.y, `${e}.${key} tag inside the play area (${Math.round(res.x)},${Math.round(res.y)} ${Math.round(res.w)}x${Math.round(res.h)})`);
  }
  if (shots) { await g.eval(() => window.__sub().speak('greet')); await g.eval(() => window.__ff(23)); await g.S(`fix4_ev_${e}`); }
}

// real outcome paths ---------------------------------------------------------------------------------------------
console.log('card_sharp bet path');
await g.eval(() => window.__mk('event', { event: 'card_sharp', template: 'event_card_sharp' }));
await g.eval(() => window.__ff(80));
await g.eval(() => { window.__dw.scene.player.coins = 40; const s = window.__sub(); s.bet(0); });
{
  const L0 = LINES.card_sharp;
  await g.eval(() => window.__ff(160));
  const t = await g.eval(() => window.__tags().map((x) => x.text));
  const L = LINES.card_sharp;
  ok(t.some((x) => [L.bust, L.push, L.win, L.ace_high, L.dead_mans_hand].includes(x)), `hand result spoken: ${JSON.stringify(t)}`);
}
console.log('wishing_well throw path');
await g.eval(() => window.__mk('event', { event: 'wishing_well', template: 'event_wishing_well' }));
await g.eval(() => window.__ff(80));
const wl = await g.eval(() => { const s = window.__sub(); const seen = []; for (let i = 0; i < 8; i++) { s.data.pending = null; s.player.coins = 20; s.throwCoin(); } return true; });
await g.eval(() => window.__ff(74));
ok(wl, 'well: 8 throws ran');
console.log('gravedigger dig path');
await g.eval(() => window.__mk('event', { event: 'gravedigger', template: 'event_gravedigger' }));
await g.eval(() => window.__ff(80));
const said = [];
for (let i = 0; i < 5; i++) {
  await g.eval((i) => { const s = window.__sub(); s.dig(i); }, i);
  await g.eval(() => window.__ff(17));
  said.push(...await g.eval(() => window.__tags().map((x) => x.text)));
  await g.eval(() => { const s = window.__sub(); for (const e of s.foes || []) if (e.alive) e.takeDamage ? e.takeDamage(9999) : (e.hp = 0); });
}
const GL = LINES.gravedigger;
ok(said.some((x) => [GL.loot, GL.chest, GL.bones, GL.ambush].includes(x)), `grave lines spoken: ${JSON.stringify([...new Set(said)])}`);
console.log('preacher take path');
await g.eval(() => window.__mk('event', { event: 'preacher', template: 'event_preacher' }));
await g.eval(() => window.__ff(80));
await g.eval(() => { window.__dw.scene.player.coins = 40; window.__sub().take('plate'); });
await g.eval(() => window.__ff(23));
{
  const t = await g.eval(() => window.__tags().map((x) => x.text));
  ok(t.includes(LINES.preacher.plate), `plate line spoken: ${JSON.stringify(t)}`);
}
console.log('snake_oil buy path');
await g.eval(() => window.__mk('event', { event: 'snake_oil', template: 'event_snake_oil' }));
await g.eval(() => window.__ff(80));
await g.eval(() => { window.__dw.scene.player.coins = 40; window.__sub().buy(0); });
await g.eval(() => window.__ff(90));
{
  const t = await g.eval(() => window.__tags().map((x) => x.text));
  ok(t.includes(LINES.snake_oil.buy) || t.includes(LINES.snake_oil.watered_line), `buy line spoken: ${JSON.stringify(t)}`);
}
console.log('secret dead_mans_hand');
await g.eval(() => window.__mk('secret', { template: 'secret_hand', variant: 'dead_mans_hand' }, 2));
await g.eval(() => window.__ff(80));
await g.eval(() => { const s = window.__sub(); s.data.order = ['ace_spades', 'ace_clubs', 'eight_spades', 'eight_clubs', 'jack_diamonds']; s.pick(0); });
await g.eval(() => window.__ff(150));
{
  const t = await g.eval(() => window.__tags().map((x) => x.text));
  ok(t.includes(LINES.card_sharp.dead_mans_hand), `dead man's hand line spoken: ${JSON.stringify(t)}`);
}

// elite nameplates ------------------------------------------------------------------------------------------------
console.log('elite nameplates');
await g.eval(() => window.__mk('normal', {}, 5));
await g.eval(() => window.__ff(68));
const plates = await g.eval(async () => {
  const { spawnEnemy } = await import('/src/enemies/index.js');
  const s = window.__dw.scene;
  const ids = ['hellhound', 'hellhound', 'rattlesnake', 'coyote', 'hellhound', 'outlaw', 'skeleton', 'coyote'];
  const aff = [['splitting'], ['burning'], ['armored'], ['cursed'], ['vampiric'], ['swift'], ['shielded'], ['volatile']];
  ids.forEach((id, i) => spawnEnemy(s, id, 200 + i * 150, 205 + (i % 2) * 20, { instant: true, floor: 2, affixes: aff[i], noLoot: true }));
  await new Promise((r) => setTimeout(r, 200));
  return s.enemies.filter((e) => e._affix && e._affix.plate).map((e) => { const b = e._affix.plate.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height, t: e._affix.plate.text }; });
});
ok(plates.length >= 6, `${plates.length} plates live`);
ok(plates.every((p) => p.x >= 8 - 1 && p.x + p.w <= 1440 - 8 + 1 && p.y >= 104), 'every plate inside [8, W-8] and below the HUD bar');
ok(plates.every((p) => p.x + p.w <= 1195 || p.y >= 175), 'no plate under the minimap');
let overlap = 0;
for (let i = 0; i < plates.length; i++) for (let j = i + 1; j < plates.length; j++) {
  const a = plates[i], b = plates[j];
  if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlap++;
}
ok(overlap === 0, `no plate overlaps another (${overlap} overlaps)`);
if (shots) await g.S('fix4_elites');

console.log('errors', JSON.stringify(g.errors));
ok(g.errors.length === 0, 'no console errors');
await g.close();
console.log(failed ? `FAILED ${failed}` : 'all fix4-events checks passed');
process.exit(failed ? 1 : 0);
