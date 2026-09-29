import { boot } from './spec-lib.mjs';
const g = await boot('?debug=1&seed=11');
const wait = (ms) => g.wait(ms);
for (const f of [1, 2, 3]) {
  await g.eval((f) => { const a = window.__dw.api; a.godMode(true); if (f > 1) a.setFloor(f); }, f);
  await wait(1500);
  await g.eval(() => window.__dw.api.bossRoom());
  await wait(1200);
  const info = await g.eval(() => { const sc = window.__dw.scene, b = sc.room.boss; return b && { name: b.name, hp: b.maxHp, phases: b.phases.map((p) => p.at), cutscene: sc.cutscene, floor: sc.floorNum, locked: sc.room.locked }; });
  console.log('floor', f, JSON.stringify(info));
  await g.shot(`spec_b4_intro${f}`);
  await wait(1500);
  console.log(' cutscene after', await g.eval(() => window.__dw.scene.cutscene));
  await g.shot(`spec_b4_fight${f}`);
  // kill boss
  await g.eval(() => { const b = window.__dw.scene.room.boss; b.invulnerable = false; window.__dw.player.teleport(300, 528); b.hurt(b.maxHp + 1, {}); });
  await wait(f === 3 ? 500 : 4500);
  if (f < 3) {
    console.log(' after kill', JSON.stringify(await g.eval(() => { const r = window.__dw.scene.room; return { trap: !!r.trapdoor, ped: r.pedestals.map((p) => p.rec.itemId), pick: r.pickups.map((p) => p.type), cleared: r.state.cleared, locked: r.locked, bosses: window.__dw.scene.run.bossesKilled }; })));
    await g.shot(`spec_b4_reward${f}`);
    // step on trapdoor
    await g.eval(() => { const r = window.__dw.scene.room; window.__dw.player.teleport(r.trapdoor.x, r.trapdoor.y); }); await wait(300); await g.eval(() => { const r = window.__dw.scene.room; window.__dw.player.teleport(r.trapdoor.x, r.trapdoor.y+ 10); });
    await wait(3000);
    console.log(' floor now', await g.eval(() => window.__dw.scene.floorNum));
  } else {
    await wait(6000);
    console.log(' scene active', await g.eval(() => ['Game', 'End', 'Menu'].filter((k) => window.__game.scene.isActive(k))));
    await g.shot('spec_b4_complete');
  }
}
console.log('errors', g.errors);
await g.close();
