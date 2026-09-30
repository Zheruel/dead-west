// FE-M1 mini-boss QA: fight bot (god OFF, free aim, base stats + roll) and telegraph audit for the 6 champion-room mini-bosses.
//   node tools/qa/mini-bot.mjs [id|all=all] [--skill=0.8] [--seed=11] [--max=110] [--noassets] [--dropassets=40] [--fight-only] [--audit-only] [--fuzz] [--fuzz-only]
// Fight: boots the mini's floor, jumps to the champion room, fights with a dodging bot (bullets, GroundHaz discs, fire, sweepers, warn lines, cones), fast-forwarded.
//   PASS = boss dead in <= 70 s of fight time, phase change fired exactly once, `mini:defeated {id, flawless, time}` seen, gold chest + bonus present, no console errors.
// Audit (default on): forces every attack in phase 1 and phase 2 with the player standing still at several spots; the first frame that damages the player
//   must be >= 0.4 s after the attack was picked (telegraph starts at 0). Contact hits from wandering are not counted (player is placed >= 200 px away).
// Fuzz: forces each attack, changes phase at a random point in it, checks it fires once and leaves no marks/sweeps/bullets behind.
import { launch } from './harness.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find((x) => x === `--${n}` || x.startsWith(`--${n}=`)); return a == null ? d : a.includes('=') ? a.split('=')[1] : true; };
const ids = ['ol_fury', 'hangman', 'motherlode', 'ash_deacon', 'stoker', 'head_bouncer'];
const which = args.find((a) => !a.startsWith('--')) || 'all';
const SKILL = +flag('skill', 0.8), SEED = +flag('seed', 11), MAX = +flag('max', 110);
const NOASSETS = !!flag('noassets', false), DROP = flag('dropassets', null);
const FUZZ_ONLY = !!flag('fuzz-only', false);
const FIGHT_ONLY = !!flag('fight-only', false), AUDIT_ONLY = !!flag('audit-only', false) || FUZZ_ONLY, FUZZ = !!flag('fuzz', false) || FUZZ_ONLY;
const FLOOR = { ol_fury: 1, hangman: 2, motherlode: 3, ash_deacon: 4, stoker: 5, head_bouncer: 6 };
const LIMIT = 70;
const realErrors = (g) => g.errors.filter((e) => !/fonts\.g(static|oogleapis)|ERR_CONNECTION_CLOSED|ERR_INTERNET|ERR_NETWORK/.test(e)); // external Google Fonts flakes are not ours
const query = `?debug=1&seed=${SEED}${NOASSETS ? '&noassets=1' : ''}${DROP ? `&dropassets=${DROP}` : ''}`;

async function boot(id) {
  for (let i = 0; ; i++) {
    try {
      const g = await launch({ query, name: 'minibot', quiet: true });
      await g.startRun();
      await g.page.waitForFunction(() => window.__dw && window.__dw.api, { timeout: 90000 });
      await g.eval(() => {
        window.__t = 100000;
        window.__ff = (n, cb, until) => {
          const game = window.__game, scs = game.scene.getScenes(false);
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
      });
      await g.eval((fl) => { const a = window.__dw.api; a.setFloor(fl); a.godMode(true); a.heal(); a.openAll(); a.jump('champion'); }, FLOOR[id]);
      await g.wait(300);
      await g.eval(() => window.__ff(400, null, () => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return b && b.active; }));
      return g;
    } catch (e) { console.log('boot failed', String(e).slice(0, 100)); if (i >= 3) throw e; }
  }
}

// ---------------------------------------------------------------------------------------------------- in-page: probes + bot
const INSTALL = async () => {
  const { bus } = await import('/src/core/events.js');
  const { GroundHaz } = await import('/src/systems/GroundHaz.js');
  const sc0 = window.__dw.scene;
  const L = (window.__mb = { events: [], hurt: [], warns: [], rolls: 0, shots: 0, roars: 0, t0: null, dmgLog: null, fps: [], GH: GroundHaz });
  bus.on('mini:defeated', (e) => L.events.push(e));
  const fx = sc0.fx, ol = fx.warnLine.bind(fx);
  fx.warnLine = (x1, y1, x2, y2, w = 40, time = 0.6, color) => { L.warns.push({ x1, y1, x2, y2, w, t0: sc0.player.time, t1: sc0.player.time + time }); if (L.warns.length > 24) L.warns.shift(); return ol(x1, y1, x2, y2, w, time, color); };
  const p = sc0.player, od = p.damage.bind(p);
  p.damage = (u, src) => {
    const b = sc0.enemies.find((e) => e.isBoss);
    const r = od(u, src);
    if (r) { L.hurt.push([b ? +b.fightTime.toFixed(1) : 0, u, (src && (src.kind || src.enemyName)) || '?', b ? b.lastAttack : '']); if (L.dmgLog && L.dmgLog.first == null && b && b.lastAttack === L.dmgLog.name && !(src && src.enemyName && src.enemyName !== b.id)) L.dmgLog.first = { age: b.atkAge, kind: (src && (src.kind || src.enemyName)) || '?' }; }
    return r;
  };
  const wrapRoar = (b) => { if (b && !b.__roarWrapped) { b.__roarWrapped = true; const o = b.roar.bind(b); b.roar = () => { L.roars++; return o(); }; } };
  L.wrapRoar = wrapRoar;
  wrapRoar(sc0.enemies.find((e) => e.isBoss));
  // ---- the bot
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  window.__botStep = () => {
    const sc = window.__dw.scene, p = sc.player, b = sc.enemies.find((e) => e.isBoss);
    if (!p || p.dead || !b || !b.alive || !b.active || b.dying) { sc.gameInput.override = { move: { x: 0, y: 0 }, aim: null }; return; }
    const sk = L.skill, T = p.time;
    let mx = 0, my = 0, threat = 0;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (L.t0 == null) L.t0 = T;
    L.dirT = (L.dirT || 0) - 1 / 60;
    if (L.dirT <= 0) { L.dir = Math.random() < 0.5 ? -1 : 1; L.dirT = 1.5 + Math.random() * 2; }
    const dir = L.dir || 1;
    const want = b.speed === 0 ? 300 : 340;
    if (d > want + 60) { mx += dx / d; my += dy / d; } else if (d < want - 60) { mx -= dx / d; my -= dy / d; }
    mx += (-dy / d) * 0.7 * dir; my += (dx / d) * 0.7 * dir;
    // armoured front cone (motherlode phase 2): circle round to its back
    if (b.cone && b.p2 && b.face != null) {
      const rel = Math.atan2(p.y - b.y, p.x - b.x) - b.face, rn = Math.atan2(Math.sin(rel), Math.cos(rel));
      if (Math.abs(rn) < 1.5) { const sg = rn >= 0 ? 1 : -1; mx += (-dy / d) * -1.6 * sg; my += (dx / d) * -1.6 * sg; }
    }
    if (p.x < 96 + 140) mx += 1.6; if (p.x > 1344 - 140) mx -= 1.6; if (p.y < 192 + 120) my += 1.6; if (p.y > 864 - 120) my -= 1.6;
    // enemy bullets
    for (const bl of sc.bullets.enemy.list) {
      if (!bl.active) continue;
      const rx = p.x - bl.x, ry = p.y - bl.y;
      if (Math.abs(rx) > 260 || Math.abs(ry) > 260) continue;
      const sp = Math.hypot(bl.vx, bl.vy) || 1, along = (rx * bl.vx + ry * bl.vy) / sp;
      if (along < 0 || along > 260) continue;
      const perp = (rx * bl.vy - ry * bl.vx) / sp;
      if (Math.abs(perp) < 60) { const sgn = perp >= 0 ? 1 : -1; mx += (bl.vy / sp) * sgn * 3 * sk; my += (-bl.vx / sp) * sgn * 3 * sk; if (along < 110 && Math.abs(perp) < 40) threat = 1; }
    }
    // ground discs (tell + active)
    for (const h of L.GH.of(sc).list) {
      if (h.done || h.shape !== 'circle') continue;
      const rem = h.tell - h.t;
      if (rem < -h.active) continue;
      const hx = p.x - h.x, hy = p.y - h.y, hd = Math.hypot(hx, hy) || 1;
      if (hd < h.r + 50 && rem < 0.95 - 0.4 * sk) { const k = rem < 0.4 ? 4.5 : 2.4; mx += (hx / hd) * k * sk; my += (hy / hd) * k * sk; if (rem < 0.2 && hd < h.r + 22) threat = 1; }
    }
    // fire patches
    const fp = sc.room && sc.room._hz && sc.room._hz.fires && sc.room._hz.fires.order;
    if (fp) for (const f of fp) { const hx = p.x - f.x, hy = p.y - f.y, hd = Math.hypot(hx, hy) || 1; if (hd < f.r + 55) { mx += (hx / hd) * 3 * sk; my += (hy / hd) * 3 * sk; } }
    // row sweepers
    if (b.sweeps) for (const w of b.sweeps) {
      if (w.state === 'done') continue;
      const off = p.y - w.y;
      if (Math.abs(off) < w.w / 2 + 70) {
        const rem = w.tell - w.t;
        if (w.state === 'run' || rem < 0.65) { my += (off >= 0 ? 1 : -1) * 5 * sk; if (w.state === 'run' && Math.abs(off) < w.w / 2 + 30 && Math.abs(p.x - w.x) < 200) threat = 1; }
      }
    }
    // locked lanes / recorded warn lines (also cover the dash that follows the band)
    for (const w of L.warns) {
      if (T > w.t1 + 0.75) continue;
      const ex = w.x2 - w.x1, ey = w.y2 - w.y1, len = Math.hypot(ex, ey) || 1, c = ex / len, s = ey / len;
      if (w.y1 === w.y2 && w.x1 !== w.x2 && len > 1000) continue; // row bands are handled by the sweeper block
      const px = p.x - w.x1, py = p.y - w.y1, along = px * c + py * s, perp = -px * s + py * c;
      if (along > -60 && along < len + 60 && Math.abs(perp) < w.w / 2 + 60 && (T > w.t1 - 0.5 || T < w.t1)) { const sg = perp >= 0 ? 1 : -1; mx += -s * sg * 4.5 * sk; my += c * sg * 4.5 * sk; if (T > w.t1 - 0.25) threat = 1; }
    }
    // tracking line / steam cone
    if (b.cone) { const c = b.cone, rel = Math.atan2(p.y - c.y, p.x - c.x) - c.a, rn = Math.atan2(Math.sin(rel), Math.cos(rel)); const dd = Math.hypot(p.x - c.x, p.y - c.y); if (c.color !== 0xc8c8d0 && b.lastAttack === 'steam_vent' && Math.abs(rn) < c.half + 0.25 && dd < c.len + 60) { const sg = rn >= 0 ? 1 : -1; mx += Math.cos(c.a + Math.PI / 2) * sg * 4; my += Math.sin(c.a + Math.PI / 2) * sg * 4; } }
    if (b.lock) { const l = b.lock, px = p.x - l.x, py = p.y - l.y, c = Math.cos(l.a), s = Math.sin(l.a), along = px * c + py * s, perp = -px * s + py * c; if (along > -60 && along < l.len + 60 && Math.abs(perp) < l.w / 2 + 50) { const sg = perp >= 0 ? 1 : -1; mx += -s * sg * 3 * sk; my += c * sg * 3 * sk; } }
    // dashing boss: get off its line
    if (b.contactDamage >= 2 || (b.moveSpeedNow && b.moveSpeedNow > 300)) { if (d < 260) { mx -= (dx / d) * 2; my -= (dy / d) * 2; if (d < 170) threat = 1; } }
    // adds: keep away, shoot the nearest first
    let tgt = b, nd = 1e9;
    for (const e of sc.enemies) {
      if (e === b || !e.alive) continue;
      const ex = p.x - e.x, ey = p.y - e.y, ed = Math.hypot(ex, ey) || 1;
      if (ed < 200) { mx += (ex / ed) * 2 * sk; my += (ey / ed) * 2 * sk; if (ed < 100) threat = 1; }
      if (ed < nd && ed < 420 && ed < d) { nd = ed; tgt = e; }
    }
    // free aim (small error), hold fire only when a shot can land
    let aim = { x: tgt.x - p.x, y: tgt.y - p.y };
    const al = Math.hypot(aim.x, aim.y) || 1, jit = (Math.random() - 0.5) * 0.08;
    aim = { x: (aim.x / al) * Math.cos(jit) - (aim.y / al) * Math.sin(jit), y: (aim.x / al) * Math.sin(jit) + (aim.y / al) * Math.cos(jit) };
    if (tgt === b && (b.invulnerable || b.targetable === false || b.alphaOverride === 0)) aim = null;
    if (aim && Math.random() > 0.94) aim = null;
    if (aim) L.shots++;
    const ml = Math.hypot(mx, my) || 1;
    sc.gameInput.override = { move: { x: mx / ml, y: my / ml }, aim };
    if (threat && p.rollCd <= 0 && !p.rolling && Math.random() < 0.55 + 0.4 * sk) { sc.gameInput.press('roll'); L.rolls++; }
  };
};

// ---------------------------------------------------------------------------------------------------- fight
async function fight(id) {
  const g = await boot(id);
  const out = { id, errors: [] };
  try {
    await g.eval(INSTALL);
    const info = await g.eval((sk) => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss), p = s.player; window.__mb.skill = sk; window.__dw.api.godMode(false); p.hp = p.maxHp; return { hp: b.maxHp, atk: b.attacks.map((a) => a.name), php: p.hp + '/' + p.maxHp, dps: null }; }, SKILL);
    out.hp = info.hp; out.attacks = info.atk;
    let res, guard = 0;
    while (guard++ < 40) {
      res = await g.eval(() => {
        window.__ff(300, window.__botStep, () => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); return s.player.dead || !b || b.dying; });
        const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss), p = s.player;
        return { bhp: b ? Math.round(b.hp) : null, ft: b ? +b.fightTime.toFixed(1) : null, ph: b && b.phase, php: p.hp + '/' + p.maxHp, dead: p.dead, dying: b && b.dying, fps: +(window.__game.loop.actualFps || 0).toFixed(0) };
      });
      if (res.dead || res.bhp == null || res.dying) break;
      if (res.ft > MAX) break;
    }
    const last = res;
    // finish death + reward
    await g.eval(() => window.__ff(240));
    const fin = await g.eval(() => {
      const s = window.__dw.scene, L = window.__mb, r = s.room, st = (r && r.state) || {};
      const ch = (st.chests || []).filter((c) => c.type === 'chest_gold');
      return { events: L.events, roars: L.roars, hurt: L.hurt.length, rolls: L.rolls, shots: L.shots, miniDone: !!st.miniDone, goldChests: ch.length, freeChest: ch.some((c) => c.free), pedestals: (st.pedestals || []).length, hits: L.hurt.slice(0, 40) };
    });
    Object.assign(out, fin, { fightTime: last.ft, dead: last.dead, phase: last.ph });
    const ev = fin.events[0];
    out.pass = !last.dead && !!ev && ev.id === id && ev.time <= LIMIT && fin.roars === 1 && fin.miniDone && fin.freeChest;
    out.time = ev ? +ev.time.toFixed(1) : null;
    out.flawless = ev ? ev.flawless : null;
  } catch (e) { out.crash = String(e).slice(0, 300); out.pass = false; }
  out.errors = realErrors(g).slice(0, 6);
  if (out.errors.length) out.pass = false;
  await g.close();
  return out;
}

// ---------------------------------------------------------------------------------------------------- audit
// player offsets from the boss (all >= 200 px away so idle body contact never counts)
const SPOTS = [[260, 0], [-260, 0], [0, 250], [0, -200], [400, 140], [-400, -120], [150, -230]];
async function audit(id) {
  const g = await boot(id);
  const out = { id, rows: [], errors: [] };
  try {
    await g.eval(INSTALL);
    const names = await g.eval(() => window.__dw.scene.enemies.find((e) => e.isBoss).attacks.map((a) => a.name));
    for (const ph of [0, 1]) {
      if (ph === 1) {
        await g.eval(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); b.cancelAttack(); window.__dw.api.godMode(true); b.hp = b.maxHp * 0.49; b.hurt(1, { x: b.x, y: b.y - 200 }); });
        await g.eval(() => window.__ff(200, null, () => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return b.phase >= 1 && !b.gen && b.idleT > 0; }));
        out.roarsAfterP2 = await g.eval(() => window.__mb.roars);
      }
      for (const nm of names) {
        let min = null, kinds = [], per = [];
        for (const [sx, sy] of SPOTS) {
          const r = await g.eval(([name, sx, sy]) => {
            const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss), p = s.player, L = window.__mb;
            window.__dw.api.godMode(false);
            for (const e of [...s.enemies]) if (e !== b && e.alive) { e.hp = 0; e.die({ silent: true }); } // phase-2 adds are not the boss's attack
            b.cancelAttack(); s.bullets.enemy.clear(); L.GH.of(s).clear(); if (s.room && s.room._hz && s.room._hz.fires) s.room._hz.fires.clear && s.room._hz.fires.clear();
            b.x = 720; b.y = 470; p.x = 720 + sx; p.y = 470 + sy; p.hp = p.maxHp = 60; p.hurtT = 0; p.entryInv = 0;
            b.hp = Math.max(b.hp, b.maxHp * (b.phase >= 1 ? 0.45 : 0.9)); b.invulnerable = false;
            L.dmgLog = { first: null, name }; L.warns.length = 0;
            s.gameInput.override = { move: { x: 0, y: 0 }, aim: null };
            b.forceAttack(name);
            window.__ff(330, null, () => L.dmgLog.first != null);
            const f = L.dmgLog.first; L.dmgLog = null;
            return f;
          }, [nm, sx, sy]);
          per.push(r ? +r.age.toFixed(2) + ':' + r.kind : '-');
          if (r) { kinds.push(r.kind); if (min == null || r.age < min) min = r.age; }
        }
        out.rows.push({ phase: ph, attack: nm, firstHit: min == null ? null : +min.toFixed(2), kinds: [...new Set(kinds)], per, ok: min == null || min >= 0.4 });
      }
    }
  } catch (e) { out.crash = String(e).slice(0, 300); }
  out.errors = realErrors(g).slice(0, 6);
  out.pass = !out.crash && out.rows.every((r) => r.ok) && !out.errors.length;
  await g.close();
  return out;
}

// ---------------------------------------------------------------------------------------------------- fuzz: phase change mid-attack
async function fuzz(id) {
  const out = { id, rows: [], errors: [] };
  const g0 = await boot(id);
  const names = await g0.eval(() => window.__dw.scene.enemies.find((e) => e.isBoss).attacks.map((a) => a.name));
  await g0.close();
  for (const nm of names) {
    for (const at of [0.35, 1.0, 1.7]) {
      const g = await boot(id);
      try {
        await g.eval(INSTALL);
        const r = await g.eval(([name, at]) => {
          const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss), p = s.player, L = window.__mb;
          L.wrapRoar(b);
          p.x = 720 + 300; p.y = 528; b.forceAttack(name);
          window.__ff(Math.round(at * 60));
          b.hp = b.maxHp * 0.5 + 3; b.hurt(6, { x: b.x, y: b.y - 200 });
          window.__ff(20);
          const mid = { sweeps: b.sweeps.length, lock: !!b.lock, marks: b.marks.length, alpha: b.sprite ? b.sprite.alpha : 1, contact: b.contactDamage };
          window.__ff(240);
          for (let i = 0; i < 6; i++) { b.hp = Math.max(b.hp, b.maxHp * 0.3); window.__ff(60); b.hurt(2, { x: b.x, y: b.y - 200 }); }
          return { name, at, roars: L.roars, phase: b.phase, mid, invuln: b.invulnerable, stunT: b.stunT, sweeps: b.sweeps.length, lock: !!b.lock, contact: b.contactDamage, base: b.baseContact };
        }, [nm, at]);
        r.ok = r.roars === 1 && r.mid.sweeps === 0 && !r.mid.lock && !r.invuln && r.contact === r.base;
        out.rows.push(r);
      } catch (e) { out.rows.push({ name: nm, at, crash: String(e).slice(0, 160), ok: false }); }
      out.errors.push(...realErrors(g).slice(0, 3));
      await g.close();
    }
  }
  out.pass = out.rows.every((r) => r.ok) && !out.errors.length;
  return out;
}

const run = which === 'all' ? ids : [which];
let allPass = true;
for (const id of run) {
  if (!AUDIT_ONLY) {
    const f = await fight(id);
    console.log(`FIGHT ${id}: ${f.pass ? 'PASS' : 'FAIL'}`, JSON.stringify(f));
    allPass &&= f.pass;
  }
  if (!FIGHT_ONLY && !FUZZ_ONLY) {
    const a = await audit(id);
    console.log(`AUDIT ${id}: ${a.pass ? 'PASS' : 'FAIL'}`, JSON.stringify(a));
    allPass &&= a.pass;
  }
  if (FUZZ) {
    const z = await fuzz(id);
    console.log(`FUZZ ${id}: ${z.pass ? 'PASS' : 'FAIL'}`, JSON.stringify(z));
    allPass &&= z.pass;
  }
}
console.log(allPass ? 'ALL PASS' : 'SOME FAILED');
process.exit(allPass ? 0 : 1);
