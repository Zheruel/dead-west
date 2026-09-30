// QA-3 v: bosses. node tools/qa/qa3v-bosses.mjs toro,engine,scratch   -> art/qa/v2/boss_<id>_*.png
import { boot, seq, track } from './qa3v-lib.mjs';
const ids = (process.argv[2] || 'toro,engine,scratch').split(',');
const FL = { cascabel: 1, grimm: 2, undertaker: 3, toro: 4, engine: 5, scratch: 6 };
const g = await boot('?debug=1&seed=33&unlockall=1');
await g.play();
for (const id of ids) {
  const f = FL[id];
  await g.api((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); a.heal(); }, f);
  await g.wait(4000);
  await g.api(() => window.__dw.api.bossRoom());
  await g.wait(1200);
  await g.S(`boss_${id}_0_intro1`);
  await g.wait(1500);
  await g.S(`boss_${id}_1_intro2`);
  await g.page.waitForFunction(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return b && b.active; }, { timeout: 30000 }).catch(() => {});
  await g.wait(3500);
  await g.api(() => { const p = window.__dw.player; p.teleport(500, 760); window.__dw.api.input({ move: { x: 0, y: 0 }, aim: { x: 1, y: -0.3 }, fire: true }); });
  await seq(g, `boss_${id}_2_fight_a`, 9, 1100, { cols: 3, w: 720 });
  await g.api(() => { const p = window.__dw.player; p.teleport(980, 800); });
  await seq(g, `boss_${id}_3_fight_b`, 9, 1100, { cols: 3, w: 720 });
  const st = await g.api(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return b ? { hp: b.hp, max: b.maxHp, state: b.state, phase: b.phase } : null; });
  console.log(id, JSON.stringify(st));
  console.log('errors', g.errors.slice(0, 5));
  await g.api(() => window.__dw.api.input(null));
  // phase 2/3: drop hp
  for (const frac of [0.6, 0.3]) {
    await g.api((frac) => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); if (b) b.hp = Math.max(1, b.maxHp * frac); window.__dw.api.input({ move: { x: 0, y: 0 }, aim: { x: 1, y: -0.3 }, fire: true }); }, frac);
    await g.wait(1500);
    await seq(g, `boss_${id}_4_p${frac}`, 6, 1100, { cols: 3, w: 720 });
  }
  await g.api(() => { window.__dw.api.input(null); window.__dw.api.killAll(); });
  await g.wait(1500); await g.S(`boss_${id}_5_death1`); await g.wait(3000); await g.S(`boss_${id}_6_death2`);
}
await g.close();
