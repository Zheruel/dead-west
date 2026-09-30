// Helpers for boss-scratch-bot.mjs: fast-forward stepping (game.step without rendering: window.__ff(n, cb, until)), floor-6 boss room setup (template `f6_boss`;
// Scratch draws his own roulette tiles when the template has none), attack forcing and a state snapshot.
import { launch } from './harness.mjs';

export async function boot(query, o) {
  for (let i = 0; ; i++) { try { return await boot1(query, o); } catch (e) { console.log('boot failed (chrome killed by another agent?)', String(e).slice(0, 80)); if (i >= 4) throw e; } }
}
async function boot1(query = '?debug=1&seed=11', { items = [], god = true, floor = 6 } = {}) {
  const g = await launch({ query, name: 'scr' });
  g.page.on('framenavigated', (f) => { if (f === g.page.mainFrame()) console.log('!! NAVIGATED', f.url()); });
  g.page.on('close', () => console.log('!! page closed'));
  g.page.on('error', (e) => console.log('!! page crash', e.message));
  await g.startRun();
  await g.page.waitForFunction(() => window.__dw && window.__dw.api, { timeout: 90000 });
  await g.eval(() => {
    window.__t = 100000;
    window.__ff = (n, cb, until) => {
      const game = window.__game;
      const scs = game.scene.getScenes(false);
      game.loop.sleep();
      const vis = scs.map((s) => s.sys.settings.visible);
      scs.forEach((s) => (s.sys.settings.visible = false));
      let i = 0;
      for (; i < n; i++) {
        const gs = window.__dw && window.__dw.scene;
        if (gs && gs.fx) gs.fx.hitStopUntil = 0;
        if (cb) cb();
        window.__t += 16.667; game.step(window.__t, 16.667);
        if (until && until()) { i++; break; }
      }
      scs.forEach((s, k) => (s.sys.settings.visible = vis[k]));
      return i;
    };
    window.__render = () => { window.__t += 16.667; window.__game.step(window.__t, 16.667); };
    window.__wake = () => window.__game.loop.wake();
  });
  await g.eval(([its, god, fl]) => { const a = window.__dw.api; a.setFloor(fl); a.godMode(god); a.heal(); for (const i of its) a.giveItem(i); a.heal(); }, [items, god, floor]);
  await g.wait(500);
  return g;
}
/** teleport to the boss room; fast-forward past the intro card so the boss is active */
export async function toBoss(g) {
  await g.eval(() => window.__dw.api.bossRoom());
  await g.wait(300);
  await g.eval(() => window.__ff(220, null, () => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return b && b.active; }));
  return g.eval(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return b && { hp: b.hp, active: b.active, id: b.id }; });
}
/** hide the boss / floor intro cards (their tweens run on wall time, fast-forward does not advance them) */
export async function hideCards(g) {
  await g.eval(() => { const h = window.__game.scene.getScene('HUD'); h.children.list.filter((o) => o.type === 'Container' && (o.depth === 90 || o.depth === 80)).forEach((o) => { h.tweens.killTweensOf(o); o.setAlpha(0).setVisible(false); }); });
}
/** Compact boss + player state (all plain values). */
export function snap(g) {
  return g.eval(() => {
    const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss), p = s.player;
    return { bhp: b ? Math.round(b.hp) : null, max: b && b.maxHp, ph: b && b.phase, form: b && b.formKey, atk: b && b.lastAttack, pose: b && b.pose, up: b && b.contractUp, stun: b && +b.stunned.toFixed(1), inv: b && b.invulnerable, seals: b && b.seals.length, dying: b && b.dying, x: b && Math.round(b.x), y: b && Math.round(b.y), php: `${p.hp}/${p.maxHp}`, dead: p.dead, bul: s.bullets.enemy.list.length, foes: s.enemies.length, ended: !!s.ended, ending: !!s.endingStarted };
  });
}
/** Force an attack now (Scratch.forceAttack) and fast-forward `frames` (or until the generator ends). Returns the frames spent. */
export function runAttack(g, name, frames = 600) {
  return g.eval(([n, f]) => {
    const b = window.__dw.scene.enemies.find((e) => e.isBoss);
    if (!b.forceAttack(n)) return -1;
    let i = 0;
    for (; i < f; i += 10) { window.__ff(10); if (!b.gen) break; }
    return i;
  }, [name, frames]);
}
