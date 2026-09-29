// Real-time bot fight vs El Cascabel (floor 1, god mode OFF) with an in-page dodging bot (~65-85 s, 1-4 hits expected).
//   node tools/qa/boss-cascabel-bot.mjs [seed=42] [skill=1]
import { launch } from './harness.mjs';
const seed = process.argv[2] || 42, skill = +(process.argv[3] || 1);
const g = await launch({ query: `?debug=1&seed=${seed}`, name: 'cf' });
g.page.on('framenavigated', (f) => { if (f === g.page.mainFrame()) console.log('!! page navigated/reloaded'); });
await g.startRun();
await g.eval(() => { const a = window.__dw.api; a.bossRoom(); });
await g.page.waitForFunction(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return b && b.active; }, { timeout: 30000 });
await g.eval((skill) => {
  const s = window.__dw.scene, P = window.__dw.player;
  const L = window.__L = { t0: s.time.now, hits: [], phaseT: null, dead: false, rolls: 0, gameT: 0, atk: [] };
  const bus = window.__game.registry; // unused
  const orig = P.damage.bind(P);
  P.damage = function (u, src) { const r = orig(u, src); if (r !== false) L.hits.push([+L.gameT.toFixed(1), u, (src && (src.kind || src.enemyName)) || '?', this.hp]); return r; };
  s.events.on('update', (t, dtms) => {
    const dt = Math.min(dtms, 50) / 1000 * (s.timeScale ?? 1); L.gameT += dt;
    const boss = s.enemies.find((e) => e.isBoss);
    if (!boss || boss.dying) { window.__dw.api.input({ move: { x: 0, y: 0 }, aim: null }); return; }
    if (boss.phase >= 1 && L.phaseT == null) L.phaseT = +L.gameT.toFixed(1);
    if (boss.lastAttack !== L.last) { L.last = boss.lastAttack; L.atk.push([+L.gameT.toFixed(1), boss.lastAttack]); }
    // aim: boss if visible/vulnerable, else nearest add
    let tgt = boss; if (boss.invulnerable) { tgt = s.enemies.filter((e) => !e.isBoss).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0] || boss; }
    const near = s.enemies.filter((e) => !e.isBoss && e.alive).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
    if (near && Math.hypot(near.x - P.x, near.y - P.y) < 260 && !boss.invulnerable) tgt = near;
    let ax = tgt.x - P.x, ay = tgt.y - P.y, ad = Math.hypot(ax, ay) || 1;
    // movement: desired ring distance 380 from boss, strafe
    let mx = 0, my = 0;
    const bx = P.x - boss.x, by = P.y - boss.y, bd = Math.hypot(bx, by) || 1;
    const want = boss.invulnerable ? 300 : 360;
    mx += (bx / bd) * Math.max(-1, Math.min(1, (want - bd) / 120)); my += (by / bd) * Math.max(-1, Math.min(1, (want - bd) / 120));
    const dir = (Math.floor(L.gameT / 3) % 2) ? 1 : -1;
    mx += -by / bd * 0.5 * dir; my += bx / bd * 0.5 * dir;
    // avoid enemies (adds)
    for (const e of s.enemies) { if (e.isBoss) continue; const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy); if (d < 220) { mx += dx / d * (220 - d) / 110; my += dy / d * (220 - d) / 110; } }
    // avoid dive marker
    if (boss.burrow && boss.burrow.mode === 'lock') { const dx = P.x - boss.burrow.tx, dy = P.y - boss.burrow.ty, d = Math.hypot(dx, dy) || 1; if (d < 260) { mx += dx / d * 3; my += dy / d * 3; } }
    // bullets
    let danger = null, dmin = 1e9;
    for (const b of s.bullets.enemy.list) {
      if (!b.active) continue;
      const vx = b.vx, vy = b.vy, sp = Math.hypot(vx, vy) || 1;
      const rx = P.x - b.x, ry = P.y - b.y;
      const along = (rx * vx + ry * vy) / sp; if (along < -20 || along > 320) continue;
      const perp = (rx * -vy + ry * vx) / sp; // signed lateral distance
      if (Math.abs(perp) > 70) continue;
      const push = (70 - Math.abs(perp)) / 70 * (1 - along / 320) * 3;
      const sgn = perp >= 0 ? 1 : -1; // move away lateral: direction (-vy,vx)/sp * -sgn
      mx += (vy / sp) * sgn * push; my += (-vx / sp) * sgn * push;
      const tt = along / sp; if (Math.abs(perp) < 34 && tt < 0.22 && tt < dmin) { dmin = tt; danger = b; }
    }
    // walls
    const K = 140; if (P.x < 96 + K) mx += 1; if (P.x > 1344 - K) mx -= 1; if (P.y < 192 + K) my += 1; if (P.y > 864 - K) my -= 1;
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    // aim lag depending on skill
    window.__dw.api.input({ move: { x: mx, y: my }, aim: { x: ax / ad, y: ay / ad } });
    if (danger && P.rollCd <= 0 && !P.rolling && Math.random() < skill) { L.rolls++; const gi = s.gameInput; gi.press('roll'); }
  });
}, skill);
let last = 0;
for (let i = 0; i < 400; i++) {
  await g.wait(500);
  const s = await g.eval(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); const st = window.__dw.api.state(); return { boss: b ? Math.round(b.hp) : null, ph: b && b.phase, hp: st.hp, tin: st.tin, dead: st.dead, gameT: +window.__L.gameT.toFixed(1), locked: st.locked, cleared: st.cleared, fl: st.floor }; });
  if (i % 10 === 0) console.log(JSON.stringify(s));
  if (s.dead) { console.log('PLAYER DIED', JSON.stringify(s)); break; }
  if (s.boss == null || s.cleared) { console.log('boss gone', JSON.stringify(s)); break; }
}
await g.wait(400); await g.shot('cf-dying');
const L = await g.eval(() => window.__L);
console.log('GAME TIME', L.gameT, 'phase2 at', L.phaseT, 'rolls', L.rolls);
console.log('HITS', JSON.stringify(L.hits));
console.log('ATK', JSON.stringify(L.atk));
// aftermath
await g.wait(4500);
console.log('after', JSON.stringify(await g.eval(() => { const s = window.__dw.scene, r = s.room; return { st: window.__dw.api.state(), trap: !!r.trapdoor, ped: (r.state.pedestals || []).length, pick: (r.state.pickups || []).length, locked: r.locked, enemies: s.enemies.length, bullets: s.bullets.count }; })));
await g.shot('cf-after');
if (process.argv[4] === 'descend') {
  await g.eval(() => { const s = window.__dw.scene; const t = s.room.trapdoor; window.__dw.api.godMode(true); window.__dw.player.teleport(t.x, t.y - 60); });
  await g.eval(() => window.__dw.api.input({ move: { x: 0, y: 1 }, aim: null }));
  await g.wait(3500);
  console.log('descend', JSON.stringify(await g.eval(() => { const st = window.__dw.api.state(); return { floor: st.floor, room: st.roomType, hp: st.hp }; })));
  await g.shot('cf-floor2');
}
console.log('errors', g.errors.filter((e) => !/Failed to process file/.test(e)));
await g.close();
