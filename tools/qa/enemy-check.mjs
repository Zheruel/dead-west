// Generic enemy spawn + soak check (Foundation stub-first, reused by every chapter-2 enemy job).
//   node tools/qa/enemy-check.mjs <id> [<id>...] [--secs=20] [--count=3] [--elite] [--affix=<id>|all] [--noassets] [--dropassets=40] [--strict-fps] [--seed=42] [--realtime]
// The soak steps the simulation with a fixed 1/60 s dt (game.step, rendering off), so --secs is SIMULATED seconds whatever the headless fps is (--realtime = wall clock).
// --affix=all runs every enemy with every affix its affixBan allows (one copy each, 6 simulated seconds, then kills it and checks that no display object leaked).
//   ids may also be comma separated ("hellhound,hellsteer"). `all` = every chapter-2 enemy, `every` = all enemies with a floor (chapter 1 + 2).
// For every id: load the enemy's first floor, stand in a cleared room with god mode, spawn `count` copies around the player (optionally elite:
// an affix from `affixes` when the enemy allows it), let them fight for `secs` and sample every 0.5 s: alive copies, enemy bullets, mean distance
// to the player, fps. Then kill them all and make sure nothing is left behind.
// Fails (exit 1) on: unknown id, no copy spawned, a copy that never moved and never fired (frozen AI), NaN positions, copies left after
// killAll, any console / page error. FPS is reported and only fails with --strict-fps (headless software GL is far slower than a real GPU).
import { launch } from './harness.mjs';
import { ENEMY_META, CHAPTER2_ENEMY_IDS, isImplemented } from '../../src/enemies/registry.js';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
let ids = args.filter((a) => !a.startsWith('--')).flatMap((a) => a.split(',')).filter(Boolean);
if (ids.includes('all')) ids = [...CHAPTER2_ENEMY_IDS];
if (ids.includes('every')) ids = Object.keys(ENEMY_META).filter((k) => (ENEMY_META[k].floors || []).length || CHAPTER2_ENEMY_IDS.includes(k)); // + chapter 1
if (!ids.length) { console.error('usage: node tools/qa/enemy-check.mjs <id>[,<id>...] [--secs=20] [--count=3] [--elite] [--noassets] [--dropassets=40] [--strict-fps]'); process.exit(2); }
const SECS = +(flags.secs || 20);
const COUNT = +(flags.count || 3);
const SEED = +(flags.seed || 42);
const failures = [];
const fail = (id, msg) => { failures.push(`${id}: ${msg}`); console.log(`  FAIL ${msg}`); };

const unknown = ids.filter((id) => !ENEMY_META[id]);
for (const id of unknown) fail(id, 'not in ENEMY_META');
ids = ids.filter((id) => ENEMY_META[id]);

const AFFIX = flags.affix || null;
const REALTIME = !!flags.realtime;
const query = `?debug=1&seed=${SEED}${flags.noassets ? '&noassets=1' : ''}${flags.dropassets ? `&dropassets=${flags.dropassets === true ? 40 : flags.dropassets}` : ''}`;
const g = await launch({ query, name: 'enemy-check', quiet: true });
await g.startRun();
await g.eval(() => {
  window.__t = 100000;
  window.__ff = (n) => {
    const game = window.__game, scs = game.scene.getScenes(false);
    game.loop.sleep();
    const vis = scs.map((s) => s.sys.settings.visible);
    scs.forEach((s) => (s.sys.settings.visible = false));
    for (let i = 0; i < n; i++) { const gs = window.__dw && window.__dw.scene; if (gs && gs.fx) gs.fx.hitStopUntil = 0; window.__t += 16.667; game.step(window.__t, 16.667); }
    scs.forEach((s, k) => (s.sys.settings.visible = vis[k]));
    return n;
  };
});

const ALL_AFFIX = ['cursed', 'armored', 'swift', 'volatile', 'shielded', 'splitting', 'burning', 'vampiric'];
let curFloor = -1;

async function run(id, affixes, count, secs, label) {
  const meta = ENEMY_META[id];
  const floor = (meta.floors && meta.floors[0]) || 1;
  console.log(`${id}${label}  floor ${floor}  hp ${meta.hp} r ${meta.r} speed ${meta.speed}${meta.flying ? ' flying' : ''}`);
  const errBefore = g.errors.length;
  if (curFloor !== floor) {
    curFloor = floor;
    await g.eval((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); a.jump('start'); }, floor);
    await g.wait(1200);
    await g.page.waitForFunction(() => { const s = window.__dw.scene; return !s.cutscene && !s.transitioning; }, { timeout: 30000 }).catch(() => {});
    await g.page.waitForFunction(() => { const s = window.__dw.scene; return !s.cutscene && !s.transitioning; }, { timeout: 30000 }).catch(() => {});
    await g.eval(() => window.__ff(360)); // let the floor intro / chapter cards finish (they freeze the world)
  }
  await g.eval(() => { const a = window.__dw.api; a.godMode(true); a.killAll(); a.heal(); window.__ff(20); });
  const spawned = await g.eval((id, n, affixes) => {
    const a = window.__dw.api, p = window.__dw.player;
    let ok = 0;
    window.__affRefs = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + 0.4;
      const e = a.spawn(id, p.x + Math.cos(ang) * 340, p.y + Math.sin(ang) * 240, affixes.length ? { affixes: [...affixes] } : {});
      if (e) { ok++; if (e.id === 'duelist') e.draw(); if (affixes.length && !e._affix) window.__affMissing = true; }
      if (e && e._affix) window.__affRefs.push(e._affix);
    }
    return ok;
  }, id, count, affixes);
  if (spawned !== count) fail(id + label, `spawned ${spawned}/${count}`);
  // soak: fixed-step simulation, sampled every 0.5 simulated seconds
  const samples = [];
  const t0 = Date.now();
  for (let k = 0; REALTIME ? Date.now() - t0 < secs * 1000 : k < secs * 2; k++) {
    if (REALTIME) await g.wait(500);
    else {
      // a floor intro / checkpoint card can start late (sim timer) and freezes the world: wait it out in real time, uncounted
      await g.page.waitForFunction(() => { const s = window.__dw.scene; return !s.cutscene && !s.paused; }, { timeout: 45000 }).catch(() => {});
      await g.eval(() => window.__ff(30));
    }
    samples.push(await g.eval((id) => {
      const s = window.__dw.scene, p = s.player;
      const list = s.enemies.filter((e) => e.id === id && e.alive);
      window.__dw.api.heal();
      return {
        alive: list.length, cs: !!s.cutscene || !!s.paused, bullets: s.bullets.count, fps: Math.round(s.game.loop.actualFps),
        dist: list.length ? list.reduce((a, e) => a + Math.hypot(e.x - p.x, e.y - p.y), 0) / list.length : 0,
        pos: list.map((e) => [Math.round(e.x), Math.round(e.y)]), nan: list.some((e) => !Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp)),
      };
    }, id));
  }
  const alive = samples.filter((s) => s.alive > 0);
  if (!alive.length) fail(id + label, 'no copy alive during the soak');
  if (samples.some((s) => s.nan)) fail(id + label, 'NaN position / hp');
  const moved = alive.length > 1 && alive.some((s, i) => i && JSON.stringify(s.pos) !== JSON.stringify(alive[0].pos));
  const fired = samples.some((s) => s.bullets > 0);
  if (secs >= 8 && alive.length && !moved && !fired && meta.speed > 0) fail(id + label, `frozen: never moved and never fired (cutscene/paused in ${samples.filter((q) => q.cs).length}/${samples.length} samples)`);
  const fps = samples.map((s) => s.fps).filter((v) => v > 0);
  const minFps = fps.length ? Math.min(...fps.slice(2)) : 0, avgFps = fps.length ? fps.reduce((a, b) => a + b, 0) / fps.length : 0;
  console.log(`  soak ${secs}s: alive ${alive.length}/${samples.length} samples, moved ${moved}, bullets seen ${fired}, mean dist ${Math.round(alive.reduce((a, s) => a + s.dist, 0) / Math.max(1, alive.length))}${REALTIME ? `, fps min ${minFps} avg ${avgFps.toFixed(0)}` : ''}`);
  if (REALTIME && minFps < 55) { console.log(`  note: fps below 55 (headless software rendering; run on a GPU machine or use --strict-fps to enforce)`); if (flags['strict-fps']) fail(id + label, `fps ${minFps} < 55`); }
  // kill + cleanup (elite clones from splitting die too)
  await g.eval(() => { window.__dw.api.killAll(); window.__ff(90); window.__dw.api.killAll(); window.__ff(30); });
  const left = await g.eval((id) => window.__dw.scene.enemies.filter((e) => e.id === id && e.alive).length, id);
  if (left) fail(id + label, `${left} copies alive after killAll`);
  if (affixes.length) {
    const leak = await g.eval(() => {
      const bad = [];
      for (const st of window.__affRefs || []) {
        if (!st.dead) bad.push('cleanup not run');
        else if (st.rings.length || st.glyphs.length || st.aura || st.plate || st.bubble || st.trail) bad.push('display objects kept');
      }
      const missing = !!window.__affMissing; window.__affMissing = false;
      return { bad, missing };
    });
    if (leak.bad.length) fail(id + label, `affix leak: ${leak.bad[0]}`);
    if (leak.missing) fail(id + label, `affixes ${affixes} were not applied`);
  }
  const errs = g.errors.slice(errBefore);
  if (errs.length) fail(id + label, `${errs.length} console error(s): ${errs[0].slice(0, 200)}`);
  else console.log('  ok: no console errors');
}

for (const id of ids) {
  const meta = ENEMY_META[id];
  const ban = Array.isArray(meta.affixBan) ? meta.affixBan : [];
  if (AFFIX === 'all') {
    if (meta.noElite || meta.affixBan === true) { console.log(`${id}: never elite, skipped`); continue; }
    for (const a of ALL_AFFIX.filter((x) => !ban.includes(x))) await run(id, [a], 1, +(flags.secs || 6), ` +${a}`);
  } else if (AFFIX) await run(id, [AFFIX], COUNT, SECS, ` +${AFFIX}`);
  else {
    const affixes = flags.elite && !meta.noElite && !ban.includes('armored') ? ['armored'] : [];
    await run(id, affixes, COUNT, SECS, affixes.length ? ' +armored' : '');
  }
}
await g.close();
if (failures.length) { console.error(`\nFAILED (${failures.length}):\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log(`\nenemy-check OK (${ids.length} enemies)`);
