import { boot } from './spec-lib.mjs';
const g = await boot('?debug=1&seed=11');
const wait = (ms) => g.wait(ms);
const j = async (type) => {
  await g.eval((type) => { const sc = window.__dw.scene, m = sc.roomMgr; const r = m.floor.rooms.find((x) => x.type === type); if (r) { window.__dw.api.teleport(r.id); } }, type);
  await wait(900);
};
console.log(JSON.stringify(await g.eval(() => { const f = window.__dw.scene.roomMgr.floor; return { n: f.rooms.length, types: f.rooms.map((r) => r.type + ':' + r.template).join(' '), key: f.keyRoomId }; })));
// treasure
await j('treasure');
console.log('treasure', JSON.stringify(await g.eval(() => { const r = window.__dw.scene.room; return { ped: r.pedestals.map((p) => [p.rec.itemId, p.rec.price]), pick: r.pickups.map((p) => p.type), cleared: r.state.cleared }; })));
await g.shot('spec_b3_treasure');
// shop
await j('shop');
console.log('shop', JSON.stringify(await g.eval(() => { const r = window.__dw.scene.room; return { ped: r.pedestals.map((p) => [p.rec.itemId, p.rec.price]), pick: r.pickups.map((p) => [p.type, p.price]), peddler: !!r.peddler }; })));
await g.shot('spec_b3_shop');
// secret
await j('secret');
console.log('secret', JSON.stringify(await g.eval(() => { const r = window.__dw.scene.room; return { ped: r.pedestals.map((p) => [p.rec.itemId, p.rec.price]), pick: r.pickups.map((p) => [p.type, p.price]), tpl: r.def.template }; })));
await g.shot('spec_b3_secret');
// locked door test: from a neighbour of treasure
const tinfo = await g.eval(() => { const f = window.__dw.scene.roomMgr.floor; const t = f.rooms.find((r) => r.type === 'treasure'); const [d, dd] = Object.entries(t.doors)[0]; const opp = { up: 'down', down: 'up', left: 'right', right: 'left' }[d]; return { nb: dd.to, dir: opp, locked: f.byId[dd.to].doors[opp].locked, toDoor: t.doors[d] }; });
console.log('treasure door', JSON.stringify(tinfo));
await g.eval((t) => { const sc = window.__dw.scene; window.__dw.api.teleport(t.nb); }, tinfo);
await wait(900);
await g.eval((t) => { const sc = window.__dw.scene; sc.room.state.cleared = true; sc.room.mode = 'done'; sc.room.unlock(); window.__dw.api.killAll(); const p = window.__dw.player; p.keys = 0; const D = { up: [720, 230], down: [720, 830], left: [170, 528], right: [1270, 528] }[t.dir]; p.teleport(...D); sc.gameInput.override = { move: { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[t.dir], aim: null }; }, tinfo);
await wait(1200);
console.log('no key', JSON.stringify(await g.eval(() => { const r = window.__dw.scene.room; return Object.fromEntries(Object.entries(r.doors).map(([k, d]) => [k, d.state])); })), await g.eval(() => window.__dw.scene.roomMgr.currentId));
await g.shot('spec_b3_locked');
await g.eval(() => { window.__dw.player.keys = 1; });
await wait(1500);
console.log('with key', JSON.stringify(await g.eval(() => { const r = window.__dw.scene.room; return { doors: Object.fromEntries(Object.entries(r.doors).map(([k, d]) => [k, d.state])), keys: window.__dw.player.keys, room: window.__dw.scene.roomMgr.currentId }; })));
await g.eval(() => { window.__dw.scene.gameInput.override = null; });
console.log('errors', g.errors);
await g.close();
