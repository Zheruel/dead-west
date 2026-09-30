// QA-2: end-to-end flow F3 boss -> interlude -> F4 -> F5 -> F6 -> Scratch death -> ending (real time; cutscenes skipped with story.skip()).
//   node tools/qa/qa2-flow.mjs [--mode=normal|hell] [--seed=21] [--noskip]   (Hell + no deals => Sixth Bullet true ending)
import { launch } from './harness.mjs';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const MODE = arg('mode', 'normal'), SEED = arg('seed', '21'), NOSKIP = process.argv.includes('--noskip');
const g = await launch({ query: `?debug=1&seed=${SEED}&mode=${MODE}&char=gunslinger`, name: 'qa2-flow', quiet: true });
const T0 = Date.now(); const T = () => ((Date.now() - T0) / 1000).toFixed(0) + 's';
const fails = []; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails.push(m); };
await g.startRun();
await g.eval(async () => {
  const { bus } = await import('/src/core/events.js');
  window.__ev = [];
  for (const e of ['game:ending', 'floor:changed', 'run:ended', 'boss:defeated', 'story:trueFinale', 'story:cutscene', 'trapdoor:descend', 'boss:spawned', 'floor:intro'])
    bus.on(e, (p) => window.__ev.push([+(performance.now() / 1000).toFixed(1), e, e === 'game:ending' ? { ending: p && p.ending } : e === 'floor:changed' || e === 'boss:spawned' || e === 'floor:intro' ? (p && (p.floor ?? p.id ?? null)) : e === 'run:ended' ? { result: p && p.result, won: p && p.won } : e === 'story:cutscene' ? (p && p.id) : null]));
  window.__dw.api.godMode(true);
});
const st = () => g.eval(() => { const s = window.__dw && window.__dw.scene; const G = window.__game; return { floor: s && s.floorNum, room: s && s.room && s.room.type, trans: s && s.transitioning, cut: s && s.cutscene, ended: s && s.ended, scenes: ['Game', 'End', 'Cutscene', 'Credits', 'Menu'].filter((k) => G.scene.isActive(k)), boss: s && (s.enemies.find((e) => e.isBoss) || {}).id, bossHp: s && Math.round((s.enemies.find((e) => e.isBoss) || {}).hp || 0), tr: !!(s && s.room && s.room.trapdoor), ped: s && s.room && (s.room.pedestals || []).length }; });
const skipAll = () => g.eval(() => { try { return window.__game.story && window.__game.story.skip(); } catch (e) { return false; } });
async function waitFor(fn, label, ms = 90000, skip = true) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await st().catch(() => null);
    if (s && fn(s)) return s;
    if (skip && !NOSKIP) await skipAll().catch(() => {});
    await g.wait(400);
  }
  console.log('TIMEOUT waiting for', label, JSON.stringify(await st().catch(() => null)));
  return null;
}
async function killBoss(floor) {
  await g.eval((f) => { const a = window.__dw.api; a.godMode(true); a.bossRoom(f); }, floor);
  const s = await waitFor((s) => s.floor === floor && s.boss, `boss F${floor} spawn`, 60000);
  if (!s) return false;
  await waitFor(() => true, 'x', 1, false);
  // let the intro card finish (boss.active)
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) { const a = await g.eval(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return b && b.active; }); if (a) break; await skipAll().catch(() => {}); await g.wait(400); }
  await g.eval(() => { const s = window.__dw.scene; const b = s.enemies.find((e) => e.isBoss); s.player.godMode = true; b.hp = Math.min(b.hp, 1); b.hurt ? b.hurt(99999, {}) : b.takeHit && b.takeHit(99999, {}); });
  return true;
}
async function descend(from) {
  const s = await waitFor((s) => s.tr, `trapdoor F${from}`, 60000, false);
  console.log(T(), `F${from} boss dead: ${JSON.stringify(s)}`);
  if (!s) return false;
  ok(s.ped >= 1, `F${from} reward pedestal(s) present (${s.ped})`);
  await g.eval(() => { const s = window.__dw.scene, tr = s.room.trapdoor, p = s.player; p.x = tr.x - 260; p.y = tr.y - 40; });
  for (let i = 0; i < 80; i++) { if (await g.eval(() => !!window.__dw.scene.room.trapdoor.armed)) break; await g.wait(500); }
  console.log(T(), 'trap armed?', JSON.stringify(await g.eval(() => { const s = window.__dw.scene, tr = s.room.trapdoor; return { age: tr.age, armed: tr.armed, d: Math.hypot(s.player.x - tr.x, s.player.y - tr.y), trans: s.transitioning, dead: s.player.dead, fps: Math.round(s.game.loop.actualFps) }; })));
  await g.eval(() => { const s = window.__dw.scene, tr = s.room.trapdoor, p = s.player; p.x = tr.x; p.y = tr.y; });
  return true;
}
const t = {};
const ONLY6 = process.argv.includes('--only6'), DEAL = process.argv.includes('--deal'), VISIT = process.argv.includes('--visit');
if (DEAL) await g.eval(() => { const r = window.__dw.scene.run; r.dealsMade = 1; });
if (VISIT) { const r = await g.eval(() => { const a = window.__dw.api; const ok = a.enterCrossroads(); return !!ok; }); console.log('visited crossroads', r); await g.wait(2500); await g.eval(() => window.__dw.api.setFloor(3)); await g.wait(1500); }
let s;
if (!ONLY6) {
// ---- F3 boss -> interlude -> F4
await g.eval(() => window.__dw.api.setFloor(3));
await g.wait(1500);
ok(await killBoss(3), 'F3 boss killed');
ok(await descend(3), 'F3 trapdoor');
s = await waitFor((s) => s.floor === 4 && !s.trans && !s.cut, 'F4 loaded', 120000);
console.log(T(), 'F4', JSON.stringify(s));
ok(!!s, 'F3 boss -> trapdoor -> (interlude) -> F4 reached');
const cp = await g.eval(async () => { const { Save } = await import('/src/core/Save.js'); const d = Save.data || Save.get && Save.get(); return d && (d.checkpoint || (d.run && d.run.checkpoint)) ? JSON.stringify(d.checkpoint || d.run.checkpoint).slice(0, 200) : null; });
console.log('checkpoint after F4 arrival:', cp);
// ---- F4 boss -> F5
ok(await killBoss(4), 'F4 boss killed'); ok(await descend(4), 'F4 trapdoor');
s = await waitFor((s) => s.floor === 5 && !s.trans && !s.cut, 'F5 loaded', 120000); ok(!!s, 'F4 -> F5');
ok(await killBoss(5), 'F5 boss killed'); ok(await descend(5), 'F5 trapdoor');
s = await waitFor((s) => s.floor === 6 && !s.trans && !s.cut, 'F6 loaded (saloon_arrival)', 120000); ok(!!s, 'F5 -> F6');
}
if (ONLY6) { await g.eval(() => window.__dw.api.setFloor(6)); await g.wait(2500); }
// ---- F6 boss -> ending
ok(await killBoss(6), 'F6 boss killed (Scratch)');
const tEnd = Date.now();
s = await waitFor((s) => s.scenes.includes('End'), 'End scene (credits skipped)', 300000);
console.log(T(), 'ending reached', JSON.stringify(s), 'after', Math.round((Date.now() - tEnd) / 1000), 's');
ok(!!s, 'Scratch death -> ending -> End scene');
await g.wait(4000); console.log('4 s after End: active scenes', JSON.stringify((await st()).scenes));
const ev = await g.eval(() => window.__ev);
console.log('events', JSON.stringify(ev));
const cnt = (e) => ev.filter((x) => x[1] === e).length;
ok(cnt('game:ending') === 1, `game:ending fired exactly once (${cnt('game:ending')})`);
ok(cnt('run:ended') >= 1 && ev.filter((x) => x[1] === 'run:ended').every((x) => x[2] && x[2].result !== 'death'), 'run:ended is a completion, not a death');
if (MODE === 'hell' && !DEAL) ok(cnt('story:trueFinale') === 1, `Hell + no deals: true finale fired (${cnt('story:trueFinale')})`);
else ok(cnt('story:trueFinale') === 0, 'normal mode / deal signed: no true finale');
const endInfo = await g.eval(() => { const s = window.__game.scene.getScene('End'); const run = window.__dw && window.__dw.scene && window.__dw.scene.run; return { ending: run && run.ending, won: run && run.won, ch2: run && run.completedChapter2, endKeys: s ? Object.keys(s.data ? s.data.getAll() : {}) : null }; });
console.log('run', JSON.stringify(endInfo));
ok(endInfo.won === true || endInfo.won === null, 'run.won');
console.log('console errors', JSON.stringify(g.errors.slice(0, 6)));
await g.shot(`qa2-flow-${MODE}-end`);
await g.close();
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'FLOW OK', T());
