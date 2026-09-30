// FE-I1 shared page-side helpers for the batch-1 item plugins (files starting with `_` are not run by regress-items2).
//   await install(ev)   once per page; installs window.__fei1 = { ff, sim, prep, dummy, shoot, give, lost, liveBullets, pickups }
// Everything runs in the page in FIXED-STEP simulation (I.sim(seconds, until)); headless real-time frame rate is unusable when the machine is busy.
export async function install(ev) {
  await ev(() => {
    if (window.__fei1) return;
    const dw = () => window.__dw;
    window.__t = 100000;
    const I = {
      /** Fixed-step fast-forward (no rendering, 60 Hz): n frames or until `until()`; returns frames run. The loop stays asleep between calls. */
      ff(n, until) {
        const game = window.__game, scs = game.scene.getScenes(false);
        game.loop.sleep();
        const vis = scs.map((s) => s.sys.settings.visible);
        scs.forEach((s) => (s.sys.settings.visible = false));
        let i = 0;
        for (; i < n; i++) {
          const gs = dw() && dw().scene; if (gs && gs.fx) gs.fx.hitStopUntil = 0;
          window.__t += 16.667; game.loop.frame++; game.step(window.__t, 16.667);
          if (until && until()) { i++; break; }
        }
        scs.forEach((s, k) => (s.sys.settings.visible = vis[k]));
        return i;
      },
      /** Simulate `sec` game seconds (or until `until()`); returns true when `until` was met (or always true without one). */
      sim(sec, until) { const n = Math.round(sec * 60); const i = I.ff(n, until); return until ? !!until() : i === n; },
      /** Empty room, player parked at (500,528) facing right, no bullets, full health, not in god mode unless asked. */
      prep(o = {}) {
        const d = dw(), p = d.player, sc = d.scene;
        d.api.killAll(); sc.bullets.player.clear(); sc.bullets.enemy.clear();
        p.x = 500; p.y = 528; p.vx = p.vy = 0; p.rolling = false; p.hurtT = 0; p.entryInv = 0; p.spiritT = 0;
        if (sc._itemFx) sc._itemFx.clear(); sc.timeScale = 1; p.godMode = !!o.god; p.hp = p.maxHp; p.fireCd = 0; p.lastShotAt = -99; p._boomN = 0; p.cyl.pos = 0; p.forceSixth = 0;
        for (const pk of [...sc.room.pickups]) { pk.destroy && pk.destroy(); sc.room.removePickup(pk); }
        return true;
      },
      /** Stationary, harmless, near-immortal target `dx,dy` from the player. */
      dummy(dx = 300, dy = 0, o = {}) {
        const d = dw(), p = d.player;
        const e = d.api.spawn(o.id || 'outlaw', p.x + dx, p.y + dy);
        e.contactDamage = 0; e.speed = 0; e.ai = () => {}; e.spawnT = 0; e.hp = e.maxHp = o.hp || 100000; e.knockback = 0;
        return e;
      },
      shoot(ax = 1, ay = 0) { const p = dw().player; p.fireCd = 0; p.lastShotAt = -99; p.fire({ x: ax, y: ay }); },
      give(id, n = 1) { for (let i = 0; i < n; i++) dw().scene.items.pickup(dw().player, id, 'debug'); return dw().player.stats; },
      lost: (e) => e.maxHp - e.hp,
      liveBullets: () => dw().scene.bullets.player.list.filter((b) => b.active).length,
      pickups: (type) => dw().scene.room.pickups.filter((k) => !type || k.type === type).length,
    };
    window.__fei1 = I;
  });
}
