// Generic enemy spawn + soak check (Foundation stub-first, reused by every chapter-2 enemy job).
//   node tools/qa/enemy-check.mjs <id> [<id>...] [--secs=20] [--count=3] [--elite] [--noassets] [--dropassets=40] [--strict-fps] [--seed=42]
//   ids may also be comma separated ("hellhound,hellsteer"). `all` = every chapter-2 enemy.
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
if (!ids.length) { console.error('usage: node tools/qa/enemy-check.mjs <id>[,<id>...] [--secs=20] [--count=3] [--elite] [--noassets] [--dropassets=40] [--strict-fps]'); process.exit(2); }
const SECS = +(flags.secs || 20);
const COUNT = +(flags.count || 3);
const SEED = +(flags.seed || 42);
const failures = [];
const fail = (id, msg) => { failures.push(`${id}: ${msg}`); console.log(`  FAIL ${msg}`); };

const unknown = ids.filter((id) => !ENEMY_META[id]);
for (const id of unknown) fail(id, 'not in ENEMY_META');
ids = ids.filter((id) => ENEMY_META[id]);

const query = `?debug=1&seed=${SEED}${flags.noassets ? '&noassets=1' : ''}${flags.dropassets ? `&dropassets=${flags.dropassets === true ? 40 : flags.dropassets}` : ''}`;
const g = await launch({ query, name: 'enemy-check', quiet: true });
await g.startRun();

for (const id of ids) {
  const meta = ENEMY_META[id];
  const floor = (meta.floors && meta.floors[0]) || 1;
  console.log(`${id}  floor ${floor}  ${isImplemented(id) ? 'implemented' : 'stub/placeholder'}  hp ${meta.hp} r ${meta.r} speed ${meta.speed}${meta.flying ? ' flying' : ''}`);
  const errBefore = g.errors.length;
  await g.eval((f) => { const a = window.__dw.api; a.setFloor(f); a.godMode(true); a.jump('start'); }, floor);
  await g.wait(1200);
  await g.eval(() => { window.__dw.api.killAll(); window.__dw.api.heal(); });
  const affixes = flags.elite && !meta.noElite && !(meta.affixBan || []).includes('armored') ? ['armored'] : [];
  const spawned = await g.eval((id, n, affixes) => {
    const a = window.__dw.api, p = window.__dw.player;
    let ok = 0;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + 0.4;
      const e = a.spawn(id, p.x + Math.cos(ang) * 340, p.y + Math.sin(ang) * 240, affixes.length ? { affixes } : {});
      if (e) ok++;
    }
    return ok;
  }, id, COUNT, affixes);
  if (spawned !== COUNT) fail(id, `spawned ${spawned}/${COUNT}`);
  // soak
  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < SECS * 1000) {
    await g.wait(500);
    samples.push(await g.eval((id) => {
      const s = window.__dw.scene, p = s.player;
      const list = s.enemies.filter((e) => e.id === id && e.alive);
      return {
        alive: list.length, bullets: s.bullets.count, fps: Math.round(s.game.loop.actualFps),
        dist: list.length ? list.reduce((a, e) => a + Math.hypot(e.x - p.x, e.y - p.y), 0) / list.length : 0,
        pos: list.map((e) => [Math.round(e.x), Math.round(e.y)]), nan: list.some((e) => !Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp)),
      };
    }, id));
    // keep the player alive and the cleared room from re-locking: refill
    await g.eval(() => window.__dw.api.heal());
  }
  const alive = samples.filter((s) => s.alive > 0);
  if (!alive.length) fail(id, 'no copy alive during the soak');
  if (samples.some((s) => s.nan)) fail(id, 'NaN position / hp');
  const moved = alive.length > 1 && alive.some((s, i) => i && JSON.stringify(s.pos) !== JSON.stringify(alive[0].pos));
  const fired = samples.some((s) => s.bullets > 0);
  if (SECS >= 8 && alive.length && !moved && !fired && meta.speed > 0) fail(id, 'frozen: never moved and never fired'); // too short a soak proves nothing (sim runs slower than wall time headless)
  const fps = samples.map((s) => s.fps).filter((v) => v > 0);
  const minFps = fps.length ? Math.min(...fps.slice(2)) : 0, avgFps = fps.length ? fps.reduce((a, b) => a + b, 0) / fps.length : 0;
  console.log(`  soak ${SECS}s: alive ${alive.length}/${samples.length} samples, moved ${moved}, bullets seen ${fired}, mean dist ${Math.round(alive.reduce((a, s) => a + s.dist, 0) / Math.max(1, alive.length))}, fps min ${minFps} avg ${avgFps.toFixed(0)}`);
  if (minFps < 55) { console.log(`  note: fps below 55 (headless software rendering; run on a GPU machine or use --strict-fps to enforce)`); if (flags['strict-fps']) fail(id, `fps ${minFps} < 55`); }
  // kill + cleanup
  await g.eval(() => window.__dw.api.killAll());
  await g.wait(800);
  const left = await g.eval((id) => window.__dw.scene.enemies.filter((e) => e.id === id && e.alive).length, id);
  if (left) fail(id, `${left} copies alive after killAll`);
  const errs = g.errors.slice(errBefore);
  if (errs.length) fail(id, `${errs.length} console error(s): ${errs[0].slice(0, 200)}`);
  else console.log('  ok: no console errors');
}
await g.close();
if (failures.length) { console.error(`\nFAILED (${failures.length}):\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log(`\nenemy-check OK (${ids.length} enemies)`);
