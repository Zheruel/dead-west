// FE-I3 shared page-side helpers for the batch-3 item plugins (files starting with `_` are not run by regress-items2).
//   await install(ev)   idempotent; installs window.__i3 = { ff, sim, prep, dummy, shoot, give, lost, pickups, use }
// Everything runs in FIXED-STEP simulation (I.sim(seconds, until)): headless real-time frame rate is unusable when the machine is busy.
export async function install(ev) {
  await ev(() => {
    if (window.__i3) return;
    const dw = () => window.__dw;
    window.__t3 = 200000;
    const I = {
      /** Fixed-step fast-forward (no rendering, 60 Hz): n frames or until `until()`; returns frames run. */
      ff(n, until) {
        const game = window.__game, scs = game.scene.getScenes(false);
        game.loop.sleep();
        const vis = scs.map((s) => s.sys.settings.visible);
        scs.forEach((s) => (s.sys.settings.visible = false));
        let i = 0;
        for (; i < n; i++) {
          const gs = dw() && dw().scene; if (gs && gs.fx) gs.fx.hitStopUntil = 0;
          window.__t3 += 16.667; game.step(window.__t3, 16.667);
          if (until && until()) { i++; break; }
        }
        scs.forEach((s, k) => (s.sys.settings.visible = vis[k]));
        return i;
      },
      /** Simulate `sec` game seconds (or until `until()`); returns true when `until` was met (always true without one). */
      sim(sec, until) { const n = Math.round(sec * 60); const i = I.ff(n, until); return until ? !!until() : i === n; },
      /** Empty room, player parked at (500,528), no bullets / dynamite / pickups, full health, not in god mode unless asked. */
      prep(o = {}) {
        const d = dw(), p = d.player, sc = d.scene;
        d.api.killAll(); sc.bullets.player.clear(); sc.bullets.enemy.clear();
        for (const dy of [...sc.dynamites]) dy.destroy(); sc.dynamites.length = 0;
        p.x = 500; p.y = 528; p.vx = p.vy = 0; p.rolling = false; p.hurtT = 0; p.entryInv = 0; p.spiritT = 0;
        sc.timeScale = 1; p.godMode = !!o.god; p.hp = p.maxHp; p.fireCd = 0; p.lastShotAt = -99; p._boomN = 0; p.cyl.pos = 0; p.forceSixth = 0;
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
      /** Fully charge the active and press it. Returns the useActive() result. */
      use() { const p = dw().player; if (p.active) p.active.charge = p.active.max; return p.useActive(); },
      /** Sign a deal the way the Crossroads room does: canPay -> payDeal -> pickup. Returns {can, paid, ok}. */
      async deal(id) {
        const { canPay, payDeal } = await import('/src/items/ItemSystem.js');
        const { getItem } = await import('/src/items/registry.js');
        const p = dw().player, def = getItem(id);
        const can = canPay(p, def);
        const paid = can === true ? payDeal(p, def) : null;
        if (paid) I.give(id);
        return { can, paid, ok: !!paid };
      },
      lost: (e) => e.maxHp - e.hp,
      pickups: (type) => dw().scene.room.pickups.filter((k) => !type || k.type === type).length,
    };
    window.__i3 = I;
  });
}
