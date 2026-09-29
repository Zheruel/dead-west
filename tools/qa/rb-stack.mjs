// Robustness QA: item stacking x5 (all passives) + hundreds of bullets + boss fight + familiars across restart. usage: node tools/qa/rb-stack.mjs [rounds=2]
import { launch } from './harness.mjs';
const R = +process.argv[2] || 2;
const g = await launch({ query: '?debug=1&seed=5', name: 'rb-stack', quiet: true });
await g.startRun();
for (let round = 0; round < R; round++) {
  const r = await g.eval(async () => {
    const a = window.__dw.api, p = window.__dw.player, s = window.__dw.scene;
    const { allItems } = await import('/src/items/index.js');
    a.godMode(true);
    for (let k = 0; k < 5; k++) for (const d of allItems()) { if (d.type === 'passive') { try { p.addItem(d.id); } catch (e) { window.__stackErr = (window.__stackErr || '') + d.id + ':' + e.message + ';'; } } }
    for (const d of allItems()) if (d.type === 'active') { try { p.addItem(d.id); } catch (e) {} }
    const out = { fam: p.familiars.length, items: p.items.length, hp: p.hp, maxHp: p.maxHp, stackErr: window.__stackErr || '' };
    // fight: many enemies + hold fire in circles
    let maxB = 0, maxDt = 0, frames = 0, nan = 0;
    const t0 = performance.now(); let last = t0;
    const iv = setInterval(() => { const n = performance.now(); maxDt = Math.max(maxDt, n - last); last = n; frames++; maxB = Math.max(maxB, s.bullets.count); if (![p.x, p.y].every(Number.isFinite)) nan++; }, 0);
    for (let i = 0; i < 3; i++) { for (const id of ['outlaw', 'coyote', 'skeleton', 'bat', 'ghost', 'crow']) { try { a.spawn(id, 400 + Math.random() * 600, 300 + Math.random() * 400); } catch (e) {} } }
    let ang = 0;
    const iv2 = setInterval(() => { ang += 0.25; a.input({ move: { x: Math.cos(ang * 0.3), y: Math.sin(ang * 0.3) }, aim: { x: Math.cos(ang), y: Math.sin(ang) }, fire: true }); }, 50);
    await new Promise((r) => setTimeout(r, 8000));
    a.bossRoom(); await new Promise((r) => setTimeout(r, 9000));
    clearInterval(iv); clearInterval(iv2); a.input(null);
    out.maxBullets = maxB; out.maxFrameGapMs = Math.round(maxDt); out.frames = frames; out.nan = nan;
    out.enemies = s.enemies.length; out.children = s.children.list.length; out.fam2 = p.familiars.length;
    return out;
  });
  console.log('round', round, JSON.stringify(r), 'errors', g.errors.length);
  await g.eval(() => { const a = window.__dw.api; a.godMode(false); window.__dw.player.shieldLeft = 0; a.die(); });
  await g.page.waitForFunction(() => window.__game.scene.isActive('End'), { timeout: 30000 }).catch(() => console.log('no End'));
  await g.wait(1500); await g.tap('KeyR', 80); await g.wait(2500);
  const st = await g.eval(() => { const s = window.__dw.scene, p = window.__dw.player; return { fam: p.familiars.length, items: p.items.length, bul: s.bullets.count, dyn: s.dynamites.length, ts: s.timeScale, ets: s.enemyTimeScale, children: s.children.list.length }; });
  console.log('  after restart', JSON.stringify(st));
}
console.log('ERRORS', g.errors.length, g.errors.slice(0, 8));
await g.close();
