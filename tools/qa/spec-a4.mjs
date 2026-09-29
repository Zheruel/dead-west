import { boot } from './spec-lib.mjs';
const g = await boot('?debug=1&seed=42');
const r = await g.eval(async () => {
  const sc = window.__dw.scene, p = sc.player, api = window.__dw.api, m = sc.roomMgr;
  const res = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const f = m.floor;
  const sec = f.rooms.find((r) => r.type === 'secret');
  res.secretDoors = Object.entries(sec.doors).map(([d, x]) => `${d}->${x.to}(${f.byId[x.to].type})`);
  // go to a neighbour of secret
  const [dirBack, dd] = Object.entries(sec.doors)[0];
  const nb = f.byId[dd.to];
  const opp = { up: 'down', down: 'up', left: 'right', right: 'left' }[dirBack];
  m.jump(nb.id, null);
  await wait(800);
  api.godMode(false); p.entryInv = 0; p.hurtT = 0;
  // mark cleared to avoid combat
  sc.room.state.cleared = true; sc.room.mode = 'done'; api.killAll(); sc.room.unlock();
  const door = sc.room.doors[opp];
  res.doorState0 = door.state;
  // stand near the door 
  const g0 = door.geom;
  p.teleport(g0.x - g0.dx * 150 + (opp === 'up' || opp === 'down' ? 0 : 0), g0.y - g0.dy * 150);
  // wait for room entry invuln
  await wait(1200);
  p.entryInv = 0; p.hurtT = 0; p.hp = 6;
  const before = p.dynamite;
  p.placeDynamite();
  res.dynAfterPlace = p.dynamite - before;
  res.fuse = sc.dynamites[0] && sc.dynamites[0].fuse;
  let t = 0;
  while (sc.dynamites.length && t < 3) { window.__step(1, 10); t += 0.01; }
  res.fuseTime = +t.toFixed(2);
  res.hpAfter = p.hp;
  res.doorState1 = door.state;
  res.secretRevealedOther = sec.doors[dirBack].revealed;
  res.tot = m.discoveredRooms().has(sec.id);
  return res;
});
console.log(JSON.stringify(r, null, 1));
console.log('errors', g.errors);
await g.close();
