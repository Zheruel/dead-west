// QA-3 v: mini-bosses (champion rooms) F1-F6: door/room shot, card, fight sequence. node tools/qa/qa3v-minis.mjs [floors e.g. 4,5]
import { boot, seq, track } from './qa3v-lib.mjs';
const fl = (process.argv[2] || '1,2,3,4,5,6').split(',').map(Number);
const g = await boot('?debug=1&seed=21&unlockall=1');
await g.play();
for (const f of fl) {
  await g.api((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); a.give(20); a.reveal(['champion']); }, f);
  await g.wait(4500);
  // champion door from an adjacent room
  const info = await g.api(() => { const fl = window.__dw.floor; const c = fl.rooms.find((r) => r.type === 'champion'); const nb = Object.values(c.doors).map((d) => d.to)[0]; return { c: c.id, nb, mini: c.mini }; });
  console.log('F' + f, JSON.stringify(info));
  await g.api((nb) => { window.__dw.api.godMode(true); window.__dw.api.teleport(nb); window.__dw.api.killAll(); }, info.nb);
  await g.wait(2500);
  await g.api(() => { window.__dw.api.killAll(); const r = window.__dw.scene.room; if (r && r.clearRoom) r.clearRoom(); });
  await g.wait(600);
  await g.S(`mini_f${f}_0_adjacent_room`);
  await g.api((c) => { window.__dw.api.godMode(true); window.__dw.api.teleport(c); }, info.c);
  await g.wait(700);
  await g.S(`mini_f${f}_1_card`);
  await g.wait(3500);
  await g.api(() => window.__dw.api.input({ move: { x: 0, y: 0 }, aim: { x: 0, y: -1 }, fire: false }));
  const log = await track(g, `mini_f${f}_2_track`, 12, 500, 300, 'window.__dw.scene.enemies.find(e=>e.isBoss)||window.__dw.scene.enemies[0]');
  console.log(log.join(' '));
  await seq(g, `mini_f${f}_3_room`, 6, 900, { cols: 3, w: 720 });
  await g.api(() => { window.__dw.api.input(null); window.__dw.api.killAll(); });
  await g.wait(3000);
  await g.S(`mini_f${f}_4_death`);
  console.log('errors', g.errors.slice(0, 5));
}
await g.close();
