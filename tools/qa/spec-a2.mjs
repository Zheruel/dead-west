import { boot } from './spec-lib.mjs';
const g = await boot('?debug=1&seed=42');
const aim = () => g.eval(() => { const sc = window.__dw.scene; const a = sc.gameInput.aim(sc.player); return a && [a.x, a.y]; });
console.log('none', await aim());
await g.press('ArrowLeft'); await g.wait(50); console.log('L', await aim());
await g.press('ArrowUp'); await g.wait(50); console.log('L+U (expect up)', await aim());
await g.press('ArrowRight'); await g.wait(50); console.log('+R (expect right)', await aim());
await g.release('ArrowRight'); await g.wait(50); console.log('-R (expect up)', await aim());
await g.release('ArrowUp'); await g.wait(50); console.log('-U (expect left)', await aim());
await g.release('ArrowLeft'); await g.wait(50); console.log('-L (expect null)', await aim());
// mouse
await g.page.mouse.move(1000, 300); await g.page.mouse.down(); await g.wait(80);
console.log('mouse', await aim());
await g.page.mouse.up(); await g.wait(50); console.log('mouse up', await aim());
// sixth bullet: fire 12 shots via fixed step
const r = await g.eval(() => {
  const sc = window.__dw.scene, p = sc.player, api = window.__dw.api;
  api.godMode(true);
  p.teleport(300, 528);
  sc.gameInput.override = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: true };
  const log = [];
  for (let i = 0; i < 40; i++) {
    const before = sc.bullets.player.list.length;
    window.__step(1, 33.3);
    for (const b of sc.bullets.player.list) if (b.age < 0.05 && !b.__seen) { b.__seen = 1; log.push({ sixth: b.sixth, mult: b.mult, pierce: b.pierce, r: b.r, dmg: b.dmg, loaded: p.cylinder.loaded }); }
    if (log.length >= 13) break;
  }
  sc.gameInput.override = null;
  return log;
});
console.log(r.map((x) => JSON.stringify(x)).join('\n'));
console.log('errors', g.errors);
await g.close();
