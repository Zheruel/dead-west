// Bot fight vs The Undertaker (floor 3, god mode OFF), fast-forwarded. Prints boss/player hp every 5 sim-seconds + attack/hurt log.
//   node tools/qa/boss-undertaker-bot.mjs [skill 0..1=0.7] [maxSimSeconds=240] [seed=11] [items,comma,list=hollow_point,speed_loader,snake_oil]
import { boot, toBoss } from './boss-undertaker-lib.mjs';
const skill = +(process.argv[2] ?? 0.7), maxSim = +process.argv[3] || 240, seed = process.argv[4] || 11;
const items = (process.argv[5] ?? 'hollow_point,speed_loader,snake_oil').split(',').filter(Boolean);
const g = await boot(`?debug=1&seed=${seed}`, { items, god: false });
const BOT = () => {
  const log = (window.__log = { hurt: [], attacks: [], phases: [], t0: null, rolls: 0, blocked: 0, shots: 0 });
  window.__bot = { skill: 0.7, acc: 0.92 };
  let lastAtk = '', lastPhase = 0, wrapped = null, dirT = 0, dir = 1;
  window.__botStep = () => {
    const sc = window.__dw && window.__dw.scene; if (!sc) return;
    const p = sc.player; const b = sc.enemies.find((e) => e.isBoss);
    if (p !== wrapped) { wrapped = p; const od = p.damage.bind(p); p.damage = (u, src) => { const r = od(u, src); if (r) log.hurt.push([+(p.time - (log.t0 || 0)).toFixed(1), u, (src && (src.kind || src.enemyName)) || '?', b ? b.lastAttack : '']); return r; }; }
    if (!p || p.dead || !b || !b.alive || !b.active || b.dying) { sc.gameInput.override = { move: { x: 0, y: 0 }, aim: null }; return; }
    if (log.t0 == null) log.t0 = p.time;
    const T = +(p.time - log.t0).toFixed(1);
    if (b.lastAttack !== lastAtk) { lastAtk = b.lastAttack; log.attacks.push([T, lastAtk, Math.round(b.hp)]); }
    if (b.phase !== lastPhase) { lastPhase = b.phase; log.phases.push([T, b.phase, Math.round(b.hp)]); }
    const sk = window.__bot.skill;
    let mx = 0, my = 0;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
    // preferred orbit: side/back of a raised lid in phase 3
    dirT -= 1 / 60;
    const rel = Math.atan2(p.y - b.y, p.x - b.x) - b.faceAngle;
    const relN = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (b.shield && !b.lockFace) dir = relN >= 0 ? 1 : -1; else if (dirT <= 0) { dir = Math.random() < 0.5 ? -1 : 1; dirT = 2 + Math.random() * 2; }
    const want = b.phase >= 2 ? 300 : 340;
    if (d > want + 50) { mx += dx / d; my += dy / d; } else if (d < want - 50) { mx -= dx / d; my -= dy / d; }
    mx += (-dy / d) * 0.8 * dir; my += (dx / d) * 0.8 * dir;
    if (p.x < 96 + 130) mx += 1.6; if (p.x > 1344 - 130) mx -= 1.6; if (p.y < 192 + 110) my += 1.6; if (p.y > 864 - 110) my -= 1.6;
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
    // ground hazards (rocks / spikes / eruption ring): leave circles (telegraph gives the bot ~its full warn time)
    for (const h of b.haz) {
      const rem = h.warn - h.t;
      if (h.fired && h.t - h.warn > h.active) continue;
      const hx = p.x - h.x, hy = p.y - h.y, hd = Math.hypot(hx, hy) || 1;
      if (hd < h.r + 45) {
        const k = rem < 0.45 ? 4 : 2.2; // a human reacts in ~0.3 s: the bot only starts fleeing late-ish
        if (rem < 0.9 - 0.5 * sk) { mx += (hx / hd) * k * sk; my += (hy / hd) * k * sk; if (rem < 0.25 && hd < h.r + 20) threat = 1; }
      }
    }
    for (const w of b.waves) {
      const c = Math.cos(w.a), s = Math.sin(w.a);
      const px = p.x - w.x, py = p.y - w.y, along = px * c + py * s, perp = -px * s + py * c;
      if (Math.abs(perp) < w.w / 2 + 60 && along > w.dist - 300 && along < w.dist + 120) { const sg = perp >= 0 ? 1 : -1; mx += -s * sg * 5; my += c * sg * 5; threat = 1; }
    }
    // telegraph lines: slam line / charge lane -> sidestep
    if ((b.lastAttack === 'charge' && b.lockFace) || (b.lastAttack === 'slam' && b.lockFace)) {
      const a = b.faceAngle, c = Math.cos(a), s = Math.sin(a);
      const px = p.x - b.x, py = p.y - b.y, along = px * c + py * s, perp = -px * s + py * c;
      const halfW = b.lastAttack === 'charge' ? 62 + 60 : 50 + 60;
      if (along > -40 && Math.abs(perp) < halfW) { const sg = perp >= 0 ? 1 : -1; mx += -s * sg * 4 * sk; my += c * sg * 4 * sk; if (b.charging && along < 200) threat = 1; }
    }
    if (b.lastAttack === 'nails' && b.pose === 'atk0') { const a = b.faceAngle, c = Math.cos(a), s = Math.sin(a); const px = p.x - b.x, py = p.y - b.y; const perp = -px * s + py * c, along = px * c + py * s; if (along > 0 && Math.abs(perp) < 170) { const sg = perp >= 0 ? 1 : -1; mx += -s * sg * 4 * sk; my += c * sg * 4 * sk; } }
    // adds: keep away from them, shoot the closest one first
    let tgt = b, nd = 1e9;
    for (const e of sc.enemies) {
      if (e === b || !e.alive) continue;
      const ex = p.x - e.x, ey = p.y - e.y, ed = Math.hypot(ex, ey) || 1;
      if (ed < 230) { mx += (ex / ed) * 2.2 * sk; my += (ey / ed) * 2.2 * sk; if (ed < 110) threat = 1; }
      if (ed < nd && ed < 480) { nd = ed; tgt = e; }
    }
    // shoot (4-way like the real game)
    const tx = tgt.x - p.x, ty = tgt.y - p.y;
    let aim = null;
    const R = (tgt.hitRadius || 40) * 0.85;
    if (Math.abs(tx) > Math.abs(ty)) { if (Math.abs(ty) < R) aim = { x: Math.sign(tx), y: 0 }; my += Math.sign(ty) * 0.9; }
    else { if (Math.abs(tx) < R) aim = { x: 0, y: Math.sign(ty) }; mx += Math.sign(tx) * 0.9; }
    if (tgt === b && (b.invulnerable || b.burrowed)) aim = null;
    if (tgt === b && b.shield && Math.abs(Math.atan2(Math.sin(Math.atan2(p.y - b.y, p.x - b.x) - b.faceAngle), Math.cos(Math.atan2(p.y - b.y, p.x - b.x) - b.faceAngle))) < 1.12) { aim = null; log.blocked++; }
    if (Math.random() > window.__bot.acc) aim = null;
    if (aim) log.shots++;
    const ml = Math.hypot(mx, my) || 1;
    sc.gameInput.override = { move: { x: mx / ml, y: my / ml }, aim };
    if (threat && p.rollCd <= 0 && !p.rolling && Math.random() < sk * 0.7) { sc.gameInput.press('roll'); log.rolls++; }
  };
};
try {
  console.log(JSON.stringify(await toBoss(g)));
  await g.eval(BOT); await g.eval((s) => { window.__bot.skill = s; }, skill);
  const t0 = Date.now();
  let simT = 0, res;
  while (simT < maxSim) {
    res = await g.eval(() => { window.__ff(300, window.__botStep, () => window.__dw.scene.player.dead || (window.__dw.scene.enemies.find((e) => e.isBoss) || {}).dying); const s = window.__dw.scene; const b = s.enemies.find((e) => e.isBoss); const p = s.player; return { bhp: b ? Math.round(b.hp) : null, ph: b && b.phase, php: p.hp + '/' + p.maxHp, dead: p.dead, gt: +p.time.toFixed(1), n: s.enemies.length, bul: s.bullets.enemy.list.length, dying: b && b.dying, ended: s.ended }; });
    simT += 5;
    console.log(JSON.stringify(res));
    if (res.dead || res.bhp == null || res.dying) break;
  }
  console.log('real s', (Date.now() - t0) / 1000);
  console.log(JSON.stringify(await g.eval(() => window.__log)));
  console.log('errors', g.errors);
} finally { await g.close(); }
