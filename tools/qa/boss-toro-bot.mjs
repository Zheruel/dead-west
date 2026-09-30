// Bot fight vs El Toro Infernal (floor 4, god mode OFF), fast-forwarded (game.step without rendering). Prints boss/player hp every 10 sim-seconds,
// then a summary line per seed: result, fight time, hearts lost per attack. Win-rate / median-time targets: CHAPTER2 s13.4 (70-85 %, 55-95 s).
//   node tools/qa/boss-toro-bot.mjs [--skill=0.7] [--seeds=1..8 | --seed=11] [--max=240] [--items=hollow_point,speed_loader,snake_oil] [--hp=6] [--start=0..2 (phase)] [--quiet]
import { boot, toBoss, hideCards } from './boss-toro-lib.mjs';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const skill = +arg('skill', 0.7), maxSim = +arg('max', 240), quiet = process.argv.includes('--quiet');
const items = arg('items', 'hollow_point,speed_loader,snake_oil').split(',').filter(Boolean);
const hearts = +arg('hp', 0), startPhase = +arg('start', 0);
const seedArg = arg('seeds', arg('seed', '11'));
const seeds = /^(\d+)\.\.(\d+)$/.test(seedArg) ? Array.from({ length: +RegExp.$2 - +RegExp.$1 + 1 }, (_, i) => +RegExp.$1 + i) : seedArg.split(',').map(Number);

const BOT = () => {
  const log = (window.__log = { hurt: [], attacks: [], phases: [], t0: null, rolls: 0, shots: 0, byAtk: {} });
  window.__bot = { skill: 0.7, acc: 0.92 };
  let lastAtk = '', lastPhase = 0, wrapped = null, dirT = 0, dir = 1;
  const rowOf = (y) => Math.floor((y - 192) / 96);
  window.__botStep = () => {
    const sc = window.__dw && window.__dw.scene; if (!sc) return;
    const p = sc.player; const b = sc.enemies.find((e) => e.isBoss);
    if (p !== wrapped) { wrapped = p; const od = p.damage.bind(p); p.damage = (u, src) => { const r = od(u, src); if (r) { const k = (src && (src.kind || src.enemyName)) || '?'; log.hurt.push([+(p.time - (log.t0 || 0)).toFixed(1), u, k, b ? b.lastAttack : '']); const a = b ? b.lastAttack : '?'; log.byAtk[a] = (log.byAtk[a] || 0) + u; } return r; }; }
    if (!p || p.dead || !b || !b.alive || !b.active || b.dying) { sc.gameInput.override = { move: { x: 0, y: 0 }, aim: null }; return; }
    if (log.t0 == null) log.t0 = p.time;
    const T = +(p.time - log.t0).toFixed(1);
    if (b.lastAttack !== lastAtk) { lastAtk = b.lastAttack; log.attacks.push([T, lastAtk, Math.round(b.hp)]); }
    if (b.phase !== lastPhase) { lastPhase = b.phase; log.phases.push([T, b.phase, Math.round(b.hp)]); }
    const sk = window.__bot.skill;
    let mx = 0, my = 0, threat = 0;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
    dirT -= 1 / 60;
    if (dirT <= 0) { dir = Math.random() < 0.5 ? -1 : 1; dirT = 2 + Math.random() * 2; }
    const want = b.stunned > 0 ? 300 : 380;
    if (d > want + 60) { mx += dx / d; my += dy / d; } else if (d < want - 60) { mx -= dx / d; my -= dy / d; }
    mx += (-dy / d) * 0.7 * dir; my += (dx / d) * 0.7 * dir;
    if (p.x < 96 + 140) mx += 1.6; if (p.x > 1344 - 140) mx -= 1.6; if (p.y < 192 + 120) my += 1.6; if (p.y > 864 - 120) my -= 1.6;
    // lava corners
    for (const [cx, cy] of [[144, 240], [1296, 240], [144, 816], [1296, 816]]) { const lx = p.x - cx, ly = p.y - cy, ld = Math.hypot(lx, ly); if (ld < 150) { mx += lx / ld * 2; my += ly / ld * 2; } }
    // vent tiles (2,3) and (10,3): they erupt on a timer, keep well clear
    for (const vx of [336, 1104]) { const ax = p.x - vx, ay = p.y - 528, ad = Math.hypot(ax, ay) || 1; if (ad < 170) { const k = (170 - ad) / 170 * 5 * (0.4 + sk); mx += ax / ad * k; my += ay / ad * k; } }
    // enemy bullets
    for (const bl of sc.bullets.enemy.list) {
      if (!bl.active) continue;
      const rx = p.x - bl.x, ry = p.y - bl.y;
      if (Math.abs(rx) > 260 || Math.abs(ry) > 260) continue;
      const sp = Math.hypot(bl.vx, bl.vy) || 1;
      const along = (rx * bl.vx + ry * bl.vy) / sp;
      if (along < 0 || along > 260) continue;
      const perp = (rx * bl.vy - ry * bl.vx) / sp;
      if (Math.abs(perp) < 64) { const sgn = perp >= 0 ? 1 : -1; mx += (bl.vy / sp) * sgn * 3 * sk; my += (-bl.vx / sp) * sgn * 3 * sk; if (along < 110 && Math.abs(perp) < 42) threat = 1; }
    }
    // ground hazards (GroundHaz circles: stomp disc, eruptions, leap landing): leave them once the remaining telegraph is short
    const gh = sc._groundHaz;
    if (gh) for (const h of gh.list) {
      if (h.done || h.shape !== 'circle') continue;
      const rem = h.tell - h.t;
      if (rem < -h.active) continue;
      const hx = p.x - h.x, hy = p.y - h.y, hd = Math.hypot(hx, hy) || 1;
      if (hd < h.r + 50) { const k = rem < 0.45 ? 4 : 2.2; if (rem < 0.9 - 0.5 * sk) { mx += (hx / hd) * k * sk; my += (hy / hd) * k * sk; if (rem < 0.25 && hd < h.r + 20) threat = 1; } }
    }
    // fire patches
    const hz = sc.room && sc.room._hz;
    if (hz && hz.fires) for (const f of hz.fires.order) { const fx = p.x - f.x, fy = p.y - f.y, fd = Math.hypot(fx, fy) || 1; if (fd < f.r + 50) { mx += (fx / fd) * 2.5; my += (fy / fd) * 2.5; if (fd < f.r + 22) threat = 1; } }
    // herd lanes: get off any row that is telegraphing / running
    if (hz && hz.lanes) {
      const bad = new Set();
      for (const l of hz.lanes.lanes) if (l.state !== 'off' && l.axis === 'h') bad.add(l.index);
      if (bad.size && bad.has(rowOf(p.y))) {
        let best = null;
        for (let r = 0; r < 7; r++) if (!bad.has(r) && (best == null || Math.abs(r - rowOf(p.y)) < Math.abs(best - rowOf(p.y)))) best = r;
        if (best != null) { const ty = 192 + best * 96 + 48; my += Math.sign(ty - p.y) * 5 * Math.min(1, sk + 0.3); mx *= 0.3; }
        for (const l of hz.lanes.lanes) if (l.state === 'run' && l.axis === 'h' && l.index === rowOf(p.y) && Math.abs(l.pos - p.x) < 260) threat = 1;
      }
    }
    // charge lane / breath cone
    const L = b.tel && b.tel.line.on ? b.tel.line : null, Wd = b.tel && b.tel.wedge.on ? b.tel.wedge : null;
    if (L || b.charging) {
      const a = b.faceAngle, c = Math.cos(a), s = Math.sin(a);
      const px = p.x - b.x, py = p.y - b.y, along = px * c + py * s, perp = -px * s + py * c;
      if (along > -60 && Math.abs(perp) < 100 + 50) { const sg = perp >= 0 ? 1 : -1; mx += -s * sg * 4.5 * sk; my += c * sg * 4.5 * sk; if (b.charging && along < 260) threat = 1; }
    }
    if (Wd) {
      const a = Wd.a, ang = Math.atan2(p.y - Wd.y, p.x - Wd.x), da = Math.atan2(Math.sin(ang - a), Math.cos(ang - a));
      if (Math.abs(da) < Wd.half + 0.25) { const sg = da >= 0 ? 1 : -1; mx += -Math.sin(a) * sg * 4; my += Math.cos(a) * sg * 4; }
    }
    // adds: keep away, shoot the nearest first
    let tgt = b, nd = 1e9;
    for (const e of sc.enemies) {
      if (e === b || !e.alive) continue;
      const ex = p.x - e.x, ey = p.y - e.y, ed = Math.hypot(ex, ey) || 1;
      if (ed < 230) { mx += (ex / ed) * 2.2 * sk; my += (ey / ed) * 2.2 * sk; if (ed < 110) threat = 1; }
      if (ed < nd && ed < 480) { nd = ed; tgt = e; }
    }
    const tx = tgt.x - p.x, ty = tgt.y - p.y;
    let aim = null;
    const R = (tgt.hitRadius || 40) * 0.85;
    if (Math.abs(tx) > Math.abs(ty)) { if (Math.abs(ty) < R) aim = { x: Math.sign(tx), y: 0 }; my += Math.sign(ty) * 0.9; }
    else { if (Math.abs(tx) < R) aim = { x: 0, y: Math.sign(ty) }; mx += Math.sign(tx) * 0.9; }
    if (tgt === b && (b.invulnerable || b.airborne)) aim = null;
    if (Math.random() > window.__bot.acc) aim = null;
    if (aim) log.shots++;
    const ml = Math.hypot(mx, my) || 1;
    sc.gameInput.override = { move: { x: mx / ml, y: my / ml }, aim };
    if (threat && p.rollCd <= 0 && !p.rolling && Math.random() < sk * 0.7) { sc.gameInput.press('roll'); log.rolls++; }
  };
};

const results = [];
for (const seed of seeds) {
  const g = await boot(`?debug=1&seed=${seed}`, { items, god: false });
  try {
    await toBoss(g);
    await hideCards(g);
    await g.eval(([sp, hp]) => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); if (sp > 0) { b.hp = b.maxHp * (sp === 1 ? 0.65 : 0.32); b.onHit(0); } if (hp) { s.player.stats.maxHearts = hp; s.player.hp = hp * 2; } }, [startPhase, hearts]);
    await g.eval(BOT); await g.eval((s) => { window.__bot.skill = s; }, skill);
    const t0 = Date.now();
    let simT = 0, res;
    while (simT < maxSim) {
      res = await g.eval(() => { window.__ff(600, window.__botStep, () => window.__dw.scene.player.dead || !window.__dw.scene.enemies.find((e) => e.isBoss) || window.__dw.scene.enemies.find((e) => e.isBoss).dying); const s = window.__dw.scene; const b = s.enemies.find((e) => e.isBoss); const p = s.player; return { bhp: b ? Math.round(b.hp) : null, ph: b && b.phase, php: p.hp + '/' + p.maxHp, dead: p.dead, gt: +(p.time - (window.__log.t0 || 0)).toFixed(1), n: s.enemies.length, bul: s.bullets.enemy.list.length, dying: b && b.dying }; });
      simT += 10;
      if (!quiet) console.log(seed, JSON.stringify(res));
      if (res.dead || res.bhp == null || res.dying) break;
    }
    const log = await g.eval(() => window.__log);
    const win = !res.dead && (res.bhp == null || res.dying);
    results.push({ seed, win, time: res.gt, php: res.php });
    console.log(`seed ${seed}: ${win ? 'WIN' : 'LOSS'} t=${res.gt}s hp=${res.php} boss=${res.bhp} phase=${res.ph} rolls=${log.rolls} shots=${log.shots} real=${((Date.now() - t0) / 1000) | 0}s dmgByAttack=${JSON.stringify(log.byAtk)}`);
    if (!quiet && !win) console.log(JSON.stringify(log.hurt.slice(-8)));
    if (g.errors.length) console.log('ERRORS', g.errors.slice(0, 5));
  } finally { await g.close(); }
}
const w = results.filter((r) => r.win), ts = w.map((r) => r.time).sort((a, b) => a - b);
console.log(`SUMMARY skill=${skill} win ${w.length}/${results.length} (${Math.round(100 * w.length / Math.max(1, results.length))} %) median win time ${ts.length ? ts[ts.length >> 1] : '-'} s`);
