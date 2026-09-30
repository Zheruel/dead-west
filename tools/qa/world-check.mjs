// INT-2 world/flow check: boss intro duration + skip, contract run end, F4 trapdoor tint, minimap reveal, boss phase pacing, Debug extras.
// node tools/qa/world-check.mjs [query]
import { launch } from './harness.mjs';
const g = await launch({ query: process.argv[2] || '?debug=1&seed=91', name: 'world', quiet: true });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
await g.startRun();
await g.eval(() => { window.__dw.api.godMode(true); });
await g.wait(600);

// FIX-1 regressions -------------------------------------------------------------------------------------------------------------------
// V-028: first-visit controls hint sits in the bottom-left corner (not on the spawn point) and fades on the first input
const h = await g.eval(() => {
  const r = window.__dw.scene.room, gi = window.__dw.scene.gameInput;
  r.state.hinted = false; r.hintText();
  const list = r._hint || [];
  const info = { n: list.length, xs: list.map((t) => Math.round(t.x)), ys: list.map((t) => Math.round(t.y)) };
  gi.override = { move: { x: 0, y: 0 }, aim: null }; r.updateHint(); info.idle = !!r._hint;
  gi.override = { move: { x: 1, y: 0 }, aim: null }; r.updateHint(); info.after = !!r._hint;
  gi.override = null;
  return info;
});
ok(h.n === 4 && h.xs.every((x) => x < 400) && h.ys.every((y) => y > 700) && h.idle && !h.after, `controls hint bottom-left, fades on first input ${JSON.stringify(h)}`);
// V-005: a big enemy is never left against a door
const sp = await g.eval(async () => {
  const { DOORS, tileToWorld } = await import('/src/config.js');
  const r = window.__dw.scene.room; const p = tileToWorld(5, 0);
  const out = r.safeSpawns([{ id: 'magma_golem', x: p.x, y: p.y }, { id: 'outlaw', x: tileToWorld(7, 0).x, y: tileToWorld(7, 0).y }]);
  const doors = Object.keys(r.doors).map((d) => tileToWorld(DOORS[d].tile[0], DOORS[d].tile[1]));
  return out.map((o, i) => ({ id: o.id, d: Math.min(...doors.map((c) => Math.hypot(c.x - o.x, c.y - o.y))) }));
});
ok(sp[0].d >= 48 + 90 && sp[1].d >= 30 + 90, `door spawn margin ${JSON.stringify(sp)}`);
// Q1-01: the checkpoint is (re)written AFTER Hell's Welcome; CONTINUE gives the welcome once when the saved run lacks it
const hw = await g.eval(async () => {
  const flow = await import('/src/scenes/flow.js'); const { Save } = await import('/src/core/Save.js');
  const s = window.__dw.scene, p = s.player; const calls = [];
  const orig = Save.saveCheckpoint, origLoad = Save.loadCheckpoint;
  Save.saveCheckpoint = (run, pl) => { calls.push({ hp: pl.hp, dyn: pl.dynamite, hw: !!run.hellsWelcome }); return true; };
  p.hp = 1; p.dynamite = 3; s.run.hellsWelcome = false;
  s.roomMgr.loadFloor(4); flow.afterFloorIntro(s, { from: 3, floor: 4 });
  for (let i = 0; i < 120 && calls.length < 2; i++) await new Promise((r) => setTimeout(r, 500)); // chapter card is game-clock time (slow on a loaded box)
  const desc = { calls: [...calls], hp: p.hp, dyn: p.dynamite };
  calls.length = 0; p.hp = 1; p.dynamite = 3; s.run.hellsWelcome = false;
  s.startData = { continue: true, floor: 4 }; Save.loadCheckpoint = () => ({ v: 1, floor: 4, run: {} });
  flow.afterFloorIntro(s, { from: 0, floor: 4 });
  await new Promise((r) => setTimeout(r, 800));
  const cont = { calls: [...calls], hp: p.hp, dyn: p.dynamite, hw: s.run.hellsWelcome };
  Save.loadCheckpoint = () => ({ v: 1, floor: 4, run: { hellsWelcome: true } }); p.hp = 1; p.dynamite = 3; s.run.hellsWelcome = false; calls.length = 0;
  flow.afterFloorIntro(s, { from: 0, floor: 4 });
  await new Promise((r) => setTimeout(r, 800));
  const cont2 = { hp: p.hp, dyn: p.dynamite, hw: s.run.hellsWelcome, calls: calls.length };
  Save.saveCheckpoint = orig; Save.loadCheckpoint = origLoad; s.startData = {};
  return { desc, cont, cont2 };
});
ok(hw.desc.calls.length === 2 && hw.desc.calls[0].dyn === 3 && hw.desc.calls[1].hw && hw.desc.calls[1].dyn === 5 && hw.desc.calls[1].hp > 1, `checkpoint re-saved after the welcome ${JSON.stringify(hw.desc)}`);
ok(hw.cont.hw && hw.cont.dyn === 5 && hw.cont.hp > 1 && hw.cont2.dyn === 3 && hw.cont2.hp === 1 && hw.cont2.hw, `CONTINUE: welcome once, not when saved ${JSON.stringify([hw.cont, hw.cont2])}`);
// Q1-08: story overlays never outlive the run
const ov = await g.eval(async () => {
  const s = window.__dw.scene; const mgr = s.scene.manager;
  s.scene.launch('Cutscene', { id: 'intro_hell', ctx: { char: 'gunslinger', hell: true, clean: true }, overlay: true, next: { callback() {} } });
  await new Promise((r) => setTimeout(r, 400));
  const was = mgr.isActive('Cutscene'); s.stopOverlays();
  await new Promise((r) => setTimeout(r, 600));
  return { was, now: mgr.isActive('Cutscene') };
});
ok(!ov.now, `stopOverlays stops a live Cutscene overlay ${JSON.stringify(ov)}`);
// V-033: event decor is one themed prop kind, vaults / secret rooms stay clean
await g.eval(() => window.__dw.api.setFloor(2));
await g.wait(1200);
const dc = await g.eval(() => {
  const m = window.__dw.scene.roomMgr, out = {};
  const defs = m.floor.rooms.filter((r) => (r._orig || r.type) === 'normal' && r.dist >= 2);
  const mk = (type, extra, k) => { const def = defs[k % defs.length]; def._orig = def._orig || 'normal'; for (const key of ['template', 'mini', 'event', 'variant', 'pocket']) delete def[key]; Object.assign(def, { type, ...extra }); delete m.states[def.id]; m.jump(def.id, null); return m.room; };
  const kinds = (room) => [...new Set(room.tiles.flat().filter((t) => t.ch === 'd').map((t) => (t.type === 'decor' ? t.decorName : 'none')))];
  out.card = kinds(mk('event', { event: 'card_sharp', template: 'event_card_sharp' }, 0));
  out.grave = kinds(mk('event', { event: 'gravedigger', template: 'event_gravedigger' }, 1));
  out.vault = kinds(mk('supersecret', { template: 'vault_a' }, 2));
  return out;
});
ok(dc.card.join() === 'decor_b' && dc.grave.join() === 'decor_a' && dc.vault.every((k) => k === 'none'), `themed decor ${JSON.stringify(dc)}`);
await g.eval(() => window.__dw.api.setFloor(1));
await g.wait(800);

// boss intro: cutscene holds ~2.9 s, then the fight starts
await g.eval(() => window.__dw.api.bossRoom(1));
await g.wait(900);
const a = await g.eval(() => ({ cs: window.__dw.scene.cutscene, boss: !!window.__dw.scene.room.boss }));
ok(a.boss && a.cs, `boss intro holds the world at 0.9 s ${JSON.stringify(a)}`);
await g.wait(5500);
const b = await g.eval(() => ({ cs: window.__dw.scene.cutscene, active: window.__dw.scene.room.boss && window.__dw.scene.room.boss.active }));
ok(!b.cs && b.active, `boss intro released after the card, boss active ${JSON.stringify(b)}`);

// skip event releases early
await g.eval(() => window.__dw.api.setFloor(2));
await g.wait(1200);
await g.eval(() => window.__dw.api.bossRoom(2));
await g.wait(700);
const c = await g.eval(async () => {
  const sc = window.__dw.scene; const before = sc.cutscene;
  sc._introRelease && sc._introRelease();
  return { before, after: sc.cutscene };
});
ok(c.before && !c.after, `intro release hook frees the scene early ${JSON.stringify(c)}`);

// boss phases: one phase per hit gap, boss:defeated payload
const p = await g.eval(async () => {
  const r = window.__dw.scene.room, bo = r.boss; const out = { phases: 0, def: null };
  const { bus } = await import('/src/core/events.js');
  bus.on('boss:phase', () => out.phases++);
  bus.on('boss:defeated', (d) => { out.def = { id: d.id, floor: d.floor, ft: typeof d.fightTime, nh: d.noHit }; });
  window.__probe = out;
  bo.hp = 1; bo.hurt(9999, {});
  return { hpNow: bo.hp };
});
await g.wait(4500);
const q = await g.eval(() => window.__probe);
ok(q.def && q.def.floor === 2 && q.def.ft === 'number', `boss:defeated payload ${JSON.stringify(q.def)}`);

// F4 trapdoor tint
await g.eval(() => window.__dw.api.setFloor(4));
await g.wait(1500);
await g.eval(() => window.__dw.api.bossRoom(4));
await g.wait(3600);
await g.eval(() => { const b = window.__dw.scene.room.boss; b.hp = 1; b.hurt(9999, {}); });
await g.wait(5000);
const t = await g.eval(() => { const r = window.__dw.scene.room; const td = r.trapdoor; return td && { tint: td.sprite.tintTopLeft, glow: !!td.glow }; });
ok(t && t.tint === 0xff6a48 && t.glow, `F4 trapdoor red tint + glow ${JSON.stringify(t)}`);

// reveal + minimap
const rv = await g.eval(() => { const m = window.__dw.scene.roomMgr; const n = m.revealKinds(['boss', 'shop', 'treasure']); const d = [...m.discoveredRooms().values()]; return { n, dowsed: d.filter((x) => x.dowsed).length }; });
ok(rv.n >= 1 && rv.dowsed >= 1, `roomMgr.revealKinds marks dowsed rooms ${JSON.stringify(rv)}`);

// contract end
const cr = await g.eval(async () => {
  const sc = window.__dw.scene; sc.run.mode = 'contract'; sc.run.maxFloor = sc.floorNum;
  const { bus } = await import('/src/core/events.js');
  window.__ended = null; bus.on('run:ended', (d) => { window.__ended = { variant: d.variant, won: d.won, goal: sc.run.goalReached }; });
  return window.__dw.api.finishContract();
});
ok(cr === true, 'finishContract accepted on a contract run at the goal floor');
await g.wait(5500);
const en = await g.eval(() => ({ ended: window.__ended, goal: window.__ended && window.__ended.goal }));
ok(en.ended && en.ended.variant === 'contract' && en.ended.won && en.goal === true, `run:ended variant 'contract' ${JSON.stringify(en)}`);

ok(g.errors.length === 0, `no console errors (${g.errors.length}) ${JSON.stringify(g.errors.slice(0, 3))}`);
await g.close();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
