// REGRESSION (items): PASS/FAIL behavioural checks. `node tools/qa/regress-items.mjs` (lantern contact+block, crow shots, silver bullets, statuses, dead eye, pan, pools, treasure/shop/boss pedestals).
import { boot } from './items-lib.mjs';
const g = await boot('items-logic');
const ev = (fn, ...a) => g.eval(fn, ...a);
await ev(() => { const a = window.__dw.api; a.godMode(true); a.give(50); });
const ok = (n, c, extra = '') => console.log(c ? 'PASS' : 'FAIL', n, extra);

// lantern
await ev(() => { const dw = window.__dw; dw.scene.items.pickup(dw.player, 'spirit_lantern', 'debug'); });
await g.wait(600);
let r = await ev(async () => {
  const dw = window.__dw, p = dw.player, f = p.familiars.find((x) => x.constructor.name === 'SpiritLantern');
  const e = dw.api.spawn('outlaw', f.x, f.y); e.contactDamage = 0; e.speed = 0; e.ai = () => {}; e.spawnT = 0;
  await new Promise((r) => setTimeout(r, 900));
  const hp = e.hp, max = e.maxHp; // round-2 difficulty scaling: a floor-1 outlaw has 24 hp, so compare to the enemy's own max
  const b = dw.scene.bullets.enemy.fire({ x: f.x + 10, y: f.y, angle: 0, speed: 10, damage: 1 });
  await new Promise((r) => setTimeout(r, 300));
  const blocked = !b.active;
  e.hp = 0; e.die({});
  return { hp, max, blocked };
});
ok('lantern damages enemy', r.hp < r.max, JSON.stringify(r)); ok('lantern blocks bullet', r.blocked);

// crow
await ev(() => { const dw = window.__dw; for (const f of [...dw.player.familiars]) f.destroy(); dw.scene.items.pickup(dw.player, 'crow_companion', 'debug'); const e = dw.api.spawn('outlaw', dw.player.x + 300, dw.player.y); e.contactDamage = 0; e.ai = () => {}; e.spawnT = 0; window.__crowTarget = e; });
for (let i = 0; i < 25; i++) { await g.wait(1000); if (await ev(() => window.__crowTarget.hp < window.__crowTarget.maxHp)) break; }
r = await ev(() => ({ hp: window.__crowTarget.hp, max: window.__crowTarget.maxHp, alive: window.__crowTarget.alive, fam: window.__dw.player.familiars.length }));
ok('crow damages enemy', r.hp < r.max, JSON.stringify(r));
await ev(() => { window.__dw.api.killAll(); for (const f of [...window.__dw.player.familiars]) f.destroy(); });

// silver bullets, statuses, dead eye
r = await ev(async () => {
  const dw = window.__dw, p = dw.player, out = {};
  const sk = dw.api.spawn('skeleton', 1000, 400), gh = dw.api.spawn('outlaw', 1000, 600);
  for (const e of [sk, gh]) { e.contactDamage = 0; e.ai = () => {}; e.spawnT = 0; }
  const dmg = (e) => { const h = e.hp; e.takeHit(2, {}); return h - e.hp; };
  out.skelBase = dmg(sk); out.outlawBase = dmg(gh);
  p.items.push('silver_bullets'); p.recomputeStats();
  out.skelSilver = dmg(sk); out.outlawSilver = dmg(gh);
  p.items.length = 0; p.recomputeStats();
  gh.takeHit(0.1, { poison: 2, burn: 1, fear: 1 });
  out.status = Object.keys(gh.status);
  out.poisonDps = gh.status.poison && gh.status.poison.dps;
  sk.hp = 0; sk.die({}); gh.hp = 0; gh.die({});
  // dead eye
  p.items.push('dead_eye'); p.recomputeStats(); p.lastShotAt = -99; p.fireCd = 0;
  p.fire({ x: 1, y: 0 });
  const b1 = dw.scene.bullets.player.list[dw.scene.bullets.player.list.length - 1];
  out.deadEyeMult = b1.mult; out.deadEyePierce = b1.pierce;
  p.fire({ x: 1, y: 0 });
  const b2 = dw.scene.bullets.player.list[dw.scene.bullets.player.list.length - 1];
  out.secondMult = b2.mult;
  p.items.length = 0; p.recomputeStats();
  return out;
});
console.log(JSON.stringify(r));
ok('silver x1.5 vs skeleton only (round 2: undeadDamageMult 1.5)', Math.abs(r.skelSilver - 1.5 * r.skelBase) < 1e-6 && r.outlawSilver === r.outlawBase);
ok('status poison/burn/fear', ['poison', 'burn', 'fear'].every((k) => r.status.includes(k)));
ok('dead eye x3 pierce then normal', r.deadEyeMult >= 3 && r.deadEyePierce >= 1 && r.secondMult < 3);

// prospector's pan on room clear
await ev(() => { const dw = window.__dw; dw.scene.items.pickup(dw.player, 'prospectors_pan', 'debug'); const fl = dw.floor; const id = fl.rooms.find((x) => x.type === 'normal').id; dw.api.teleport(id); });
await g.wait(1500);
const c0 = await ev(() => window.__dw.room.pickups.length);
await ev(() => window.__dw.api.clearRoom());
await g.wait(300);
r = await ev(() => ({ n: window.__dw.room.pickups.length, coins: window.__dw.room.pickups.filter((p) => p.type === 'coin').length }));
ok('pan drops >=3 coins', r.coins >= 3, JSON.stringify(r) + ' before ' + c0);
await ev(() => { const p = window.__dw.player; p.items.length = 0; p.recomputeStats(); });

// treasure / shop / secret / boss pipelines
for (const kind of ['treasure', 'shop', 'secret']) {
  const info = await ev((kind) => { const dw = window.__dw; const rm = dw.floor.rooms.find((x) => x.type === kind); if (!rm) return null; dw.api.teleport(rm.id); return rm.id; }, kind);
  await g.wait(1800);
  r = await ev(() => { const rm = window.__dw.room; return { type: rm.type, ped: rm.pedestals.map((p) => [p.rec.itemId, p.rec.price]), pk: rm.pickups.map((p) => [p.type, p.basePrice]) }; });
  console.log(kind, JSON.stringify(r));
  await g.shot('items-room-' + kind);
}
// boss reward
await ev(() => { const dw = window.__dw; dw.api.teleport(dw.floor.bossId); });
await g.wait(1200);
await ev(() => { const rm = window.__dw.room; rm.state.cleared = true; rm.onBossDefeated({ alive: false }); });
await g.wait(1500);
r = await ev(() => { const rm = window.__dw.room; return { ped: rm.pedestals.map((p) => [p.rec.itemId]), pk: rm.pickups.map((p) => p.type) }; });
console.log('boss', JSON.stringify(r)); ok('boss pedestal has item', r.ped.length === 1 && !!r.ped[0][0]);
await g.shot('items-room-boss');

// pool exhaustion / fallback
r = await ev(() => { const it = window.__dw.scene.items; const got = []; for (let i = 0; i < 40; i++) { const id = it.roll('shop'); if (!id) break; got.push(id); } return { n: got.length, uniq: new Set(got).size, next: it.roll('treasure'), rem: it.remaining() }; });
ok('pool fallback yields unique items until exhausted', r.n === r.uniq && r.next === null, JSON.stringify(r));

console.log('ERRORS', g.errors);
await g.close();
