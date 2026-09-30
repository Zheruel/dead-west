// Screenshots of each Toro attack at fixed sim times (fast-forward + one rendered frame): node tools/qa/boss-toro-shots.mjs [charge|breath|stomp|herd|leap|all]
// Output: art/qa/toro_<attack>_<t>.png. Needs a private Vite server (harness default).
import { boot, toBoss, hideCards } from './boss-toro-lib.mjs';
const only = process.argv[2] || 'all';
const g = await boot('?debug=1&seed=11', { god: true });
console.log(await toBoss(g));
await hideCards(g);
async function run(name, phase, fn, shots, px = 1100, py = 600) {
  await g.eval(([ph, px, py]) => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); const p = window.__dw.scene.player; b.resetState(); b.phase = ph; b.hp = b.maxHp; b.x = 720; b.y = 528; p.teleport(px, py); b.gen = null; b.idleT = 99; window.__dw.scene.bullets.enemy.clear(); }, [phase, px, py]);
  await g.eval((n) => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); b.interrupt(b[n]()); }, fn);
  let t = 0;
  for (const s of shots) {
    await g.eval((n) => window.__ff(n), Math.round((s - t) * 60)); t = s;
    await g.eval(() => window.__render());
    await g.shot(`toro_${name}_${s}`);
  }
  await g.eval(() => window.__ff(600, null, () => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return !b.gen; }));
}
const want = (n) => only === 'all' || only === n;
if (want('charge')) await run('charge', 0, 'atkCharge', [0.6, 1.1, 1.6]);
if (want('breath')) await run('breath', 0, 'atkFireBreath', [0.7, 1.2, 1.6]);
if (want('stomp')) await run('stomp', 0, 'atkStomp', [0.6, 1.2, 1.7]);
if (want('herd')) await run('herd', 1, 'atkHerd', [0.8, 2.0, 3.0]);
if (want('leap')) await run('leap', 2, 'atkLeap', [0.5, 1.4, 2.4, 3.0]);
console.log('errors', g.errors.slice(0, 8));
await g.close();
