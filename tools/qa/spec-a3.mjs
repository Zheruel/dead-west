import { boot } from './spec-lib.mjs';
const g = await boot('?debug=1&seed=42');
const r = await g.eval(() => {
  const sc = window.__dw.scene, p = sc.player, api = window.__dw.api;
  api.godMode(true);
  p.teleport(300, 528);
  const log = [];
  const fn = (e) => log.push({ sixth: e.sixth, loaded: e.count });
  const B = sc.bullets.player;
  const orig = B.fire.bind(B);
  B.fire = (o) => { const b = orig(o); log.push({ sixth: b.sixth, mult: b.mult, pierce: b.pierce, r: b.r, sprite: b.sprite.scale.toFixed(2), kind: b.kind }); return b; };
  sc.gameInput.override = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: true };
  // spawn a wall of enemies to test pierce and kill hit-stop
  for (let i = 0; i < 100; i++) window.__step(1, 33.3);
  sc.gameInput.override = null;
  return { shots: p.shotCount, log: log.slice(0, 13) };
});
console.log(JSON.stringify(r, null, 0));
// pierce + hit-stop test
const r2 = await g.eval(() => {
  const sc = window.__dw.scene, p = sc.player, api = window.__dw.api;
  api.killAll();
  p.teleport(200, 528); p.shotCount = 5; // next shot is sixth
  const e1 = api.spawn('outlaw', 500, 528), e2 = api.spawn('outlaw', 620, 528), e3 = api.spawn('outlaw', 740, 528);
  for (const e of [e1, e2, e3]) { e.spawnT = 0; e.maxHp = e.hp = 100; e.ai = () => {}; e.contactDamage = 0; }
  sc.gameInput.override = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: true };
  window.__step(1, 33.3);
  sc.gameInput.override = { move: { x: 0, y: 0 }, aim: null, fire: false };
  for (let i = 0; i < 30; i++) window.__step(1, 33.3);
  return [e1, e2, e3].map((e) => 100 - e.hp);
});
console.log('sixth dmg to 3 in a row (expect 7,7,0):', r2);
console.log('errors', g.errors);
await g.close();
