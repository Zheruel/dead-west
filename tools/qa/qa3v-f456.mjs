// QA-3 v: rooms per floor 4-6. node tools/qa/qa3v-f456.mjs [floor]
import { boot } from './qa3v-lib.mjs';
const fl = process.argv[2] ? [+process.argv[2]] : [4, 5, 6];
const g = await boot('?debug=1&seed=11&unlockall=1');
await g.play();
await g.api(() => { window.__dw.api.godMode(true); });
for (const f of fl) {
  await g.api((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); a.give(20); }, f);
  await g.wait(4500);
  const rooms = await g.api(() => window.__dw.floor.rooms.map((r) => ({ id: r.id, type: r.type, tpl: r.def && r.def.tpl || r.def && r.def.template || null, dist: r.dist })));
  console.log('F' + f, JSON.stringify(rooms));
  let n = 0;
  for (const r of rooms.filter((r) => r.type === 'normal').slice(0, 5)) {
    await g.api((id) => { window.__dw.api.godMode(true); window.__dw.api.teleport(id); }, r.id);
    await g.wait(3000);
    await g.api(() => window.__dw.api.input({ move: { x: 0, y: 0 }, aim: { x: 1, y: 0.2 }, fire: true }));
    await g.wait(700);
    await g.S(`f${f}_room${++n}_${r.id}`);
    await g.api(() => { window.__dw.api.input(null); window.__dw.api.killAll(); });
    await g.wait(300);
  }
  console.log('errors', g.errors.slice(0, 5));
}
await g.close();
