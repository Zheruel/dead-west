// Toro soak: god mode, 3 phases x ~40 sim-seconds each, measures game.step cost (ms/frame, p95, max) and console errors.
//   node tools/qa/boss-toro-soak.mjs [--query=?debug=1&seed=11&noassets=1]   (also try &dropassets=40)
import { boot, toBoss, hideCards } from './boss-toro-lib.mjs';
const query = (process.argv.find((a) => a.startsWith('--query=')) || '').slice(8) || '?debug=1&seed=11';
const g = await boot(query, { items: [], god: true });
let bad = 0;
try {
  const b0 = await toBoss(g);
  console.log('boss', JSON.stringify(b0));
  await hideCards(g);
  for (const ph of [0, 1, 2]) {
    const r = await g.eval(([p]) => {
      const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss);
      if (p > 0) { b.hp = b.maxHp * (p === 1 ? 0.6 : 0.3); b.onHit(1); }
      const pl = s.player, ts = [], atks = new Set();
      let a = 0;
      for (let i = 0; i < 2400; i++) {
        // wander the player in a circle so the attacks have something to chase; refill the boss so the phase holds
        a += 0.02; s.gameInput.override = { move: { x: Math.cos(a), y: Math.sin(a * 0.7) }, aim: null };
        b.hp = Math.max(b.hp, b.maxHp * (p === 0 ? 0.8 : p === 1 ? 0.5 : 0.2));
        const t0 = performance.now(); window.__ff(1); ts.push(performance.now() - t0);
        atks.add(b.lastAttack);
      }
      s.gameInput.override = null;
      ts.sort((x, y) => x - y);
      return { avg: ts.reduce((x, y) => x + y, 0) / ts.length, p95: ts[Math.floor(ts.length * 0.95)], max: ts[ts.length - 1], atks: [...atks], phase: b.phase, bullets: s.bullets.enemy.list.length, enemies: s.enemies.length };
    }, [ph]);
    console.log(`phase ${ph}: step avg ${r.avg.toFixed(2)} ms  p95 ${r.p95.toFixed(2)}  max ${r.max.toFixed(1)}  attacks ${r.atks.join(',')}  phaseNow ${r.phase} enemies ${r.enemies}`);
    if (r.avg > 8) bad++;
  }
  console.log('errors', JSON.stringify(g.errors.slice(0, 8)));
  if (g.errors.length) bad++;
} finally { await g.close(); }
console.log(bad ? 'SOAK FAIL' : 'SOAK OK');
process.exit(bad ? 1 : 0);
