// Bot fight vs Marshal Grimm (floor 2, god mode OFF), fast-forwarded. Prints boss/player hp every 5 sim-seconds, an attack/hurt log and a screenshot.
//   node tools/qa/boss-grimm-bot.mjs [skill 0..1=0.7] [maxSimSeconds=200] [seed=7] [aim accuracy=0.9] [align=1]
import { boot, BOT } from './boss-grimm-lib.mjs';
const skill = +(process.argv[2] ?? 0.7), maxSim = +process.argv[3] || 200;
const g = await boot(`?debug=1&seed=${process.argv[4] || 7}`);
await g.eval(() => { const a = window.__dw.api; a.setFloor(2); a.godMode(false); });
await g.wait(500);
await g.eval(() => window.__dw.api.bossRoom());
await g.wait(300);
await g.eval(BOT); await g.eval((s, a, al) => { window.__bot.skill = s; window.__bot.acc = a; window.__bot.align = al; }, skill, +(process.argv[5] ?? 0.9), +(process.argv[6] ?? 1));
const t0 = Date.now();
let simT = 0, res;
while (simT < maxSim) {
  res = await g.eval(() => { window.__ff(300, window.__botStep, () => { const s = window.__dw.scene; return s.player.dead; }); const s = window.__dw.scene; const b = s.enemies.find((e) => e.isBoss); const p = s.player; return { bhp: b ? Math.round(b.hp) : null, ph: b && b.phase, php: p.hp, dead: p.dead, gt: +p.time.toFixed(1), n: s.enemies.length, bul: s.bullets.enemy.list.length, state: s.room.state.cleared, td: !!s.room.trapdoor }; });
  simT += 5;
  console.log(JSON.stringify(res));
  if (res.dead || res.bhp == null || res.state) break;
}
console.log('real s', (Date.now() - t0) / 1000);
console.log(JSON.stringify(await g.eval(() => window.__log)));
await g.eval(() => { window.__wake(); });
await g.wait(500);
await g.shot('boss-grimm-end');
console.log('errors', g.errors);
await g.close();
