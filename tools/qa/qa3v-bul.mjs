// QA-3 v: enemy bullet kinds (static, 15 kinds) over F1/F4/F5/F6 backgrounds + returning enemies. shots bul_f<N>.png
import { boot } from './qa3v-lib.mjs';
const g = await boot('?debug=1&seed=31&unlockall=1');
await g.play('gunslinger');
await g.eval(() => { window.__dw.api.godMode(true); });
const kinds = ['enemy', 'venom', 'nail', 'ghostfire', 'rock', 'stick', 'ember', 'coal', 'steam', 'card', 'chip', 'shard', 'spade', 'spike'];
for (const f of [1, 4, 5, 6]) {
  await g.eval((f) => { const a = window.__dw.api; if (window.__dw.scene.floorNum !== f) a.setFloor(f); }, f);
  await g.wait(2000); await g.settle();
  await g.eval(() => { const s = window.__dw.scene, m = s.roomMgr, d = m.floor.rooms.find((r) => r.type === 'normal' && r.dist >= 2); m.jump(d.id, null); });
  await g.wait(2500);
  await g.eval((kinds) => {
    const s = window.__dw.scene, a = window.__dw.api; a.killAll();
    const p = window.__dw.player; p.teleport(720, 640);
    kinds.forEach((k, i) => { const x = 240 + (i % 7) * 160, y = 330 + Math.floor(i / 7) * 110; s.bullets.enemy.fire({ x, y, angle: 0, speed: 0, damage: 0, kind: k, life: 60 }); });
    const ids = { 1: ['coyote'], 4: ['possessed', 'skeleton'], 5: ['skeleton', 'ghost'], 6: ['possessed', 'skeleton'] }[s.floorNum] || [];
    ids.forEach((id, i) => { const e = a.spawn(id, 560 + i * 200, 500); if (e) { e.speed = 0; e.contactDamage = 0; } });
  }, kinds);
  await g.wait(1200);
  const info = await g.eval(() => ({ f: window.__dw.scene.floorNum, b: window.__dw.scene.bullets.count, n: window.__dw.scene.enemies.map((e) => e.id) }));
  console.log(JSON.stringify(info));
  await g.S(`bul_f${f}`);
  await g.S(`bul_f${f}_crop`, { x: 160, y: 250, width: 1150, height: 380 });
}
console.log('errors', JSON.stringify(g.errors.slice(0, 5)));
await g.close();
