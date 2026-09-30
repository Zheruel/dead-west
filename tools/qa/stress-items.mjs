// STRESS (items): every item x3 at once + combat with 4 enemies, then boss room, then death -> restart. Expect zero console errors, no leaked familiars, clean restart.
//   node tools/qa/stress-items.mjs   (real time, ~40 s)
import { boot } from './items-lib.mjs';
const g = await boot('items-stress');
const ev = (fn, ...a) => g.eval(fn, ...a);
const ok = (n, c, extra = '') => console.log(c ? 'PASS' : 'FAIL', n, extra);
await ev(async () => {
  const dw = window.__dw, p = dw.player, m = await import('/src/items/index.js');
  dw.api.godMode(true);
  for (const d of m.allItems()) for (let i = 0; i < 3; i++) dw.scene.items.pickup(p, d.id, 'debug');
  p.hp = p.maxHp;
});
console.log('stats', JSON.stringify(await ev(() => { const s = window.__dw.player.stats; return { dmg: s.damage, fd: s.fireDelay, bc: s.bulletCount, hearts: s.maxHearts, luck: s.luck }; })));
await ev(() => { const a = window.__dw.api; for (const [id, x, y] of [['outlaw', 1000, 400], ['coyote', 1000, 650], ['skeleton', 900, 500], ['ghost', 1100, 500]]) { const e = a.spawn(id, x, y); e.spawnT = 0; } });
await ev(() => window.__dw.api.input({ move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: true }));
for (let i = 0; i < 6; i++) {
  await g.wait(1000);
  await ev((i) => { const p = window.__dw.player; p.active && (p.active.charge = p.active.max); if (i % 2 === 0) p.useActive(); }, i);
}
await g.shot('stress-items-combat');
await ev(() => window.__dw.api.input(null));
console.log('state', JSON.stringify(await ev(() => { const s = window.__dw.api.state(); return { enemies: s.enemies, bullets: s.bullets, fps: s.fps, fam: window.__dw.player.familiars.length }; })));
// boss room with everything
await ev(() => { window.__dw.api.killAll(); window.__dw.api.bossRoom(); });
await g.wait(4000);
await ev(() => window.__dw.api.input({ move: { x: 0, y: 0 }, aim: { x: 0, y: -1 }, fire: true }));
await g.wait(5000);
await g.shot('stress-items-boss');
await ev(() => window.__dw.api.input(null));
console.log('boss', JSON.stringify(await ev(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return b ? { hp: b.hp, max: b.maxHp, fear: !!b.status.fear, phase: b.phase } : null; })));
// death -> restart
const before = await ev(() => ({ fam: window.__dw.player.familiars.length, children: window.__dw.scene.children.list.length }));
await ev(() => { // strip everything that can stop a lethal hit (revives, halo, shields, dodge-style hurt cancels) so the death -> restart path is exercised for real
  const dw = window.__dw, p = dw.player, SAVERS = new Set(['duster_coat', 'black_cat_bone', 'lazarus_pact', 'saints_halo']);
  dw.api.godMode(false); p.items = p.items.filter((i) => !SAVERS.has(i)); p.reviveCharges = 0; p.haloLeft = 0; p.shieldLeft = 0; p.recomputeStats(); p.haloLeft = 0; p.shieldLeft = 0; p.hurtT = 0; p.entryInv = 0;
  dw.api.die();
  if (!p.dead) p.die({}); // a remaining `hurt` hook cancelled the hit: end the run directly
});
await g.wait(6000);
console.log('after death scene', JSON.stringify(await ev(() => window.__game.scene.scenes.map((s) => s.scene.key + ':' + s.scene.isActive()).join(' '))));
await g.tap('Enter', 80); await g.wait(800); await g.tap('KeyR', 80);
await g.page.waitForFunction(() => window.__dw && window.__dw.scene.scene.isActive() && window.__dw.player && !window.__dw.player.dead, { timeout: 60000 }).catch(() => {});
await g.wait(2000);
const after = await ev(() => window.__dw && ({ fam: window.__dw.player.familiars.length, items: window.__dw.player.items.length, children: window.__dw.scene.children.list.length, ets: window.__dw.scene.enemyTimeScale, bt: !!window.__dw.scene._bulletTime }));
console.log('before', JSON.stringify(before), 'after restart', JSON.stringify(after));
ok('restart clean', after && after.fam === 0 && after.items === 0 && after.ets === 1);
console.log('ERRORS', g.errors);
await g.close();
