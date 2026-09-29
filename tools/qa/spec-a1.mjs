import { boot } from './spec-lib.mjs';
const g = await boot('?debug=1&seed=42');
const out = await g.eval(async () => {
  const sc = window.__dw.scene, p = sc.player, api = window.__dw.api;
  const res = {};
  api.godMode(false);
  p.entryInv = 0; p.hurtT = 0;
  // ---- roll
  p.teleport(300, 528);
  sc.gameInput.override = { move: { x: 1, y: 0 }, aim: null, fire: false };
  sc.gameInput.press('roll');
  const x0 = p.x;
  let invT = 0, steps = 0, cdEnd = null;
  let t = 0;
  for (let i = 0; i < 100; i++) {
    window.__step(1, 10); t += 0.01;
    if (p.rolling) { steps++; if (p.invulnerable) invT += 0.01; }
    if (!p.rolling && cdEnd === null) cdEnd = { t, x: p.x, cd: p.rollCd };
  }
  res.roll = { dist: Math.round(cdEnd.x - x0), rollTime: +cdEnd.t.toFixed(2), rollCdAfter: +cdEnd.cd.toFixed(2), invulnWhileRolling: +invT.toFixed(2) };
  // cd
  p.hurtT = 0;
  return res;
});
console.log(JSON.stringify(out, null, 1));
console.log('errors', g.errors);
await g.close();
