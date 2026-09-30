// Sixth Bullet: every 6th shot x2 damage (mult) and pierce +1, via cyl.pos (spec-a3 still pokes the retired p.shotCount)
import { boot } from './spec-lib.mjs';
import { check } from './qa1-lib.mjs';
const g = await boot('?debug=1&seed=42');
await g.wait(500);
const r = await g.eval(() => {
  const p = window.__dw.player, sc = window.__dw.scene; window.__dw.api.godMode(true);
  const log = [];
  const B = sc.bullets.player, orig = B.fire.bind(B);
  B.fire = (o) => { const b = orig(o); log.push({ sixth: !!b.sixth, mult: +b.mult.toFixed(3), pierce: b.pierce }); return b; };
  p.cyl.pos = 0;
  for (let i = 0; i < 12; i++) p.fire({ x: 1, y: 0 });
  B.fire = orig;
  return { log, every: p.stats.sixthEvery, sixthMult: p.stats.sixthMult, sixthPierce: p.stats.sixthPierce };
});
const six = r.log.filter((l) => l.sixth), norm = r.log.filter((l) => !l.sixth);
check('SIXTH 2 sixths in 12 shots at shots 6 and 12', six.length === 2 && r.log[5].sixth && r.log[11].sixth, JSON.stringify(r.log.map((l) => +l.sixth)));
check('SIXTH x2 damage and pierce +1 vs normal', six.every((l) => l.mult === 2 * norm[0].mult && l.pierce === norm[0].pierce + 1), JSON.stringify([six[0], norm[0]]));
console.log(JSON.stringify(r));
await g.close(); process.exit(0);
