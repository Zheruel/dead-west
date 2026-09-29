// Shared helpers for boss-grimm-bot.mjs: fast-forward stepping (game.step without rendering: window.__ff(n, cb, until)) + the in-page BOT.
// harness.launch() starts its own private, no-HMR Vite server, so nothing else needs to be running.
import { launch } from './harness.mjs';

export async function boot(query = '?debug=1&seed=7') {
  const g = await launch({ query, name: 'grimm' });
  g.page.on('framenavigated', (f) => { if (f === g.page.mainFrame()) console.log('NAVIGATED', f.url()); });
  g.page.on('crash', () => console.log('PAGE CRASH'));
  await g.startRun();
  await g.page.waitForFunction(() => window.__dw && window.__dw.api, { timeout: 60000 });
  await g.eval(() => {
    window.__ffInstall = () => {
      const game = window.__game;
      window.__t = window.__t || game.loop.now;
      window.__ff = (n, cb, until) => {
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
        if (window.__hideHud) game.scene.getScene('HUD').sys.settings.visible = false;
        return i;
      };
      window.__render = () => { window.__t += 16.667; game.step(window.__t, 16.667); };
      window.__wake = () => game.loop.wake();
    };
    window.__ffInstall();
  });
  return g;
}

// in-page bot (source string so it can be re-installed after floor loads)
export const BOT = () => {
  const log = (window.__log = window.__log || { hurt: [], attacks: [], phases: [], t0: null, rolls: 0 });
  window.__bot = { skill: 0.7, aimAtBoss: true, roll: true };
  let lastAtk = '', lastPhase = 0, wrapped = null;
  window.__botStep = () => {
    const sc = window.__dw && window.__dw.scene; if (!sc) return;
    const p = sc.player; const b = sc.enemies.find((e) => e.isBoss);
    if (p !== wrapped) { wrapped = p; const od = p.damage.bind(p); p.damage = (u, src) => { const r = od(u, src); if (r) log.hurt.push([+(p.time - (log.t0 || 0)).toFixed(1), u, (src && (src.kind || src.enemyName)) || '?']); return r; }; }
    if (!p || p.dead || !b || !b.alive || !b.active) { return; }
    if (log.t0 == null) log.t0 = p.time;
    const T = +(p.time - log.t0).toFixed(1);
    if (b.lastAttack !== lastAtk) { window.__bot.sg = Math.random() < 0.5 ? 1 : -1; lastAtk = b.lastAttack; log.attacks.push([T, lastAtk, Math.round(b.hp)]); }
    if (b.phase !== lastPhase) { lastPhase = b.phase; log.phases.push([T, b.phase, Math.round(b.hp)]); }
    const sk = window.__bot.skill;
    // target: nearest ghost if very close, else boss
    let tgt = b;
    for (const e of sc.enemies) if (e.id === 'ghost' && e.alive && !e.invulnerable && Math.hypot(e.x - p.x, e.y - p.y) < 230) tgt = e;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
    let mx = 0, my = 0;
    const want = 360;
    if (d > want + 60) { mx += dx / d; my += dy / d; } else if (d < want - 60) { mx -= dx / d; my -= dy / d; }
    const dir = Math.floor(p.time / 2.5) % 2 ? 1 : -1;
    mx += -dy / d * 0.7 * dir; my += dx / d * 0.7 * dir;
    if (p.x < 96 + 120) mx += 1.6; if (p.x > 1344 - 120) mx -= 1.6; if (p.y < 192 + 110) my += 1.6; if (p.y > 864 - 110) my -= 1.6;
    let threat = 0;
    for (const bl of sc.bullets.enemy.list) {
      if (!bl.active) continue;
      const rx = p.x - bl.x, ry = p.y - bl.y;
      if (Math.abs(rx) > 260 || Math.abs(ry) > 260) continue;
      const sp = Math.hypot(bl.vx, bl.vy) || 1;
      const along = (rx * bl.vx + ry * bl.vy) / sp;
      if (along < 0 || along > 260) continue;
      const perp = (rx * bl.vy - ry * bl.vx) / sp;
      if (Math.abs(perp) < 64) {
        const sgn = perp >= 0 ? 1 : -1;
        mx += (bl.vy / sp) * sgn * 3 * sk; my += (-bl.vx / sp) * sgn * 3 * sk;
        if (along < 110 && Math.abs(perp) < 42) threat = 1;
      }
    }
    for (const dyn of sc.dynamites) { const ddx = p.x - dyn.x, ddy = p.y - dyn.y, dd = Math.hypot(ddx, ddy); if (dd < 220) { mx += ddx / (dd || 1) * 3.5 * sk; my += ddy / (dd || 1) * 3.5 * sk; } }
    if (b.gen && b.warn && b.warn.commandBuffer.length && (b.lastAttack === 'lasso' || b.lastAttack === 'quickDraw')) {
      // telegraph line visible: sidestep perpendicular to boss->player, hard
      const a = Math.atan2(p.y - b.y, p.x - b.x); if (window.__bot.sgFor !== T + b.lastAttack && !(b.gen && window.__bot.sgAtk === b.lastAttack && window.__bot.sgBusy)) { } window.__bot.sg = window.__bot.sg || 1; const sg = window.__bot.sg;
      mx += -Math.sin(a) * 4 * sk * sg; my += Math.cos(a) * 4 * sk * sg;
    }
    if (b.lastAttack === 'lasso' && d < 200 && b.gen) { mx -= dx / d * 5 * sk; my -= dy / d * 5 * sk; } // pulled in: leave the slam ring
    // 4-way aiming like the real game: shoot along the axis where the target is best aligned, and drift to align
    const tx = tgt.x - p.x, ty = tgt.y - p.y;
    let aim = null;
    const align = window.__bot.align ?? 1;
    if (Math.abs(tx) > Math.abs(ty)) { // horizontal shot, perpendicular error = ty
      if (Math.abs(ty) < (tgt.hitRadius || 60) * 0.85) aim = { x: Math.sign(tx), y: 0 };
      my += Math.sign(ty) * 0.9 * align;
    } else {
      if (Math.abs(tx) < (tgt.hitRadius || 60) * 0.85) aim = { x: 0, y: Math.sign(ty) };
      mx += Math.sign(tx) * 0.9 * align;
    }
    if (Math.random() > (window.__bot.acc ?? 0.9)) aim = null;
    const ml = Math.hypot(mx, my) || 1;
    sc.gameInput.override = { move: { x: mx / ml, y: my / ml }, aim };
    if (window.__bot.roll && threat && p.rollCd <= 0 && !p.rolling && Math.random() < sk * 0.6) { sc.gameInput.press('roll'); log.rolls++; }
  };
};
