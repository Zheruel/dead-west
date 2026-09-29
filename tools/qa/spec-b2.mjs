import { boot } from './spec-lib.mjs';
const g = await boot('?debug=1&seed=7');
const S = () => g.eval(() => { const s = window.__dw.api.state(); const r = window.__dw.scene.room; return { room: s.roomType, locked: s.locked, cleared: s.cleared, mode: s.mode, enemies: s.enemies.length, wave: r.waveIdx, waves: r.waves.length, pending: r.pending, pick: r.pickups.map((p) => p.type), charge: window.__dw.player.active && window.__dw.player.active.charge, doors: s.doors }; });
await g.eval(() => { const a = window.__dw.api, p = window.__dw.player; a.godMode(true); a.giveItem('whiskey_bottle'); });
// go to a normal room adjacent to start with real transition
const info = await g.eval(() => { const m = window.__dw.scene.roomMgr; const f = m.floor; const st = f.byId[f.startId]; return Object.entries(st.doors).map(([d, x]) => [d, x.to, f.byId[x.to].type, f.byId[x.to].template]); });
console.log('start doors', JSON.stringify(info));
const nd = info.find((x) => x[2] === 'normal');
console.log('normal via', nd);
// walk through door
await g.eval((d) => { const p = window.__dw.player; const pos = { up: [720, 250], down: [720, 800], left: [190, 528], right: [1250, 528] }[d]; p.teleport(...pos); window.__dw.scene.gameInput.override = { move: { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[d], aim: null, fire: false }; }, nd[0]);
await g.wait(2500);
await g.eval(() => { window.__dw.scene.gameInput.override = { move: { x: 0, y: 0 }, aim: null, fire: false }; });
console.log('after entering', JSON.stringify(await S()));
// try to leave: doors closed?
await g.wait(1500);
console.log('t+1.5', JSON.stringify(await S()));
await g.shot('spec_b2_room');
// kill wave by wave with telegraph timing
for (let i = 0; i < 5; i++) {
  await g.eval(() => window.__dw.api.killAll());
  await g.wait(200);
  const s1 = await S();
  await g.wait(700);
  const s2 = await S();
  console.log(`kill ${i}`, JSON.stringify(s1), '->', JSON.stringify(s2));
  if (s2.cleared) break;
}
await g.wait(500);
console.log('final', JSON.stringify(await S()));
await g.shot('spec_b2_clear');
console.log('errors', g.errors);
await g.close();
