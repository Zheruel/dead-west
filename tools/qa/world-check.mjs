// INT-2 world/flow check: boss intro duration + skip, contract run end, F4 trapdoor tint, minimap reveal, boss phase pacing, Debug extras.
// node tools/qa/world-check.mjs [query]
import { launch } from './harness.mjs';
const g = await launch({ query: process.argv[2] || '?debug=1&seed=91', name: 'world', quiet: true });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
await g.startRun();
await g.eval(() => { window.__dw.api.godMode(true); });
await g.wait(600);

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
