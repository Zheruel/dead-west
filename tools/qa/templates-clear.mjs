// FE-T2 soft-lock check: builds template rooms in the live game and lets the autoplay bot (tools/qa/bot-page.js, fixed-step sim, god mode OFF) clear them.
//   node tools/qa/templates-clear.mjs [--ids=f6_n01,f1_17] [--per=3 (random templates per floor, seeded)] [--floors=1,2,3,6] [--seed=N] [--skill=expert|competent]
//                                    [--all] [--cap=150 (game seconds per room)] [--god]
// Default set: f1_17 f1_18 f2_17 f3_17 + `--per` random F6 normals; `--all` = every F6 normal + the four chapter-1 rooms.
// Passes when every room clears (or the bot dies to real damage, reported separately) with no soft-lock, no console error and no bot crash.
import { launch } from './harness.mjs';
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const has = (k) => args.includes(`--${k}`);
const seed = +opt('seed', 11), cap = +opt('cap', 150), per = +opt('per', 3), skill = opt('skill', 'expert');
const f6 = Array.from({ length: 14 }, (_, i) => `f6_n${String(i + 1).padStart(2, '0')}`);
const ch1 = ['f1_17', 'f1_18', 'f2_17', 'f3_17'];
let rs = seed >>> 0; const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
const pick = (a, n) => { const c = [...a], out = []; while (out.length < n && c.length) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return out; };
let ids = (opt('ids', '') || '').split(',').filter(Boolean);
if (!ids.length) ids = has('all') ? [...ch1, ...f6] : [...ch1, ...pick(f6, per)];
const floorOf = (id) => +id[1];
const src = fs.readFileSync(new URL('./bot-page.js', import.meta.url), 'utf8');
let g = null, floor = 1;
const boot = async () => {
  if (g) { errs.push(...g.errors); await g.close(); }
  g = await launch({ query: `?debug=1&seed=${seed}`, name: 't2-clear', quiet: true });
  g.page.on('pageerror', () => {});
  await g.startRun();
  await g.page.waitForFunction(() => window.__dw && window.__dw.api, { timeout: 60000 });
  await g.eval((src, cfg) => {
    window.__game.sound.mute = true;
    window.__t = window.__game.loop.now;
    (0, eval)(src);
    window.__botInstall(cfg);
  }, src, { skill, aim: 'free', maxSim: 1e9, stall: 60 });
  await g.eval(() => { window.__dw.api.heal(); });
  floor = 1;
};
const errs = [];
await boot();
let fails = 0;
const rows = []; let needBoot = false;
for (const id of ids) {
  const f = floorOf(id);
  if (needBoot) { await boot(); needBoot = false; }
  if (f !== floor) { await g.eval((f) => { window.__dw.api.setFloor(f); }, f); floor = f; await g.eval(() => window.__botRun(600)); }
  const r = await g.eval((id, god) => {
    const B = window.__bot, sc = window.__dw.scene, m = sc.roomMgr, p = sc.player;
    const def = m.floor.rooms.find((x) => x.type === 'normal' && x.dist >= 2);
    def.template = id; delete def.mod; delete m.states[def.id];
    p.godMode = !!god; p.dead = false; p.hp = p.maxHp; p.tin = 0;
    B.result = null; B.deadAt = 0; B.softlock = null; B.death = null; B.lastProgT = B.simT; B.stuck = { x: 0, y: 0, t: B.simT };
    B.dmg.length = 0;
    m.jump(def.id, null);
    B.t0 = B.simT; B.rid = def.id;
    return { rid: def.id, tpl: sc.room && sc.room.def.template };
  }, id, has('god'));
  let out = null;
  for (;;) {
    out = await g.eval(() => {
      window.__botRun(120);
      const B = window.__bot, sc = window.__dw.scene, rm = sc.room, p = sc.player;
      const cleared = !!(rm && rm.def.id === B.rid && rm.state.cleared && rm.mode !== 'combat');
      return { cleared, res: B.result, dead: p.dead, t: +(B.simT - B.t0).toFixed(1), softlock: B.softlock && { goal: B.softlock.goal, pos: B.softlock.pos, enemies: B.softlock.enemies, mode: B.softlock.mode, pending: B.softlock.pending, wave: B.softlock.wave }, dmg: B.dmg.map((d) => `${d.u}:${d.src}`), en: sc.enemies.length, err: B.err || 0, roomId: rm && rm.def.id };
    });
    if (out.cleared || out.res || out.dead || out.t > cap) break;
  }
  const verdict = out.cleared ? 'cleared' : out.dead ? 'died' : out.softlock || out.res === 'softlock' ? 'SOFTLOCK' : out.t > cap ? 'TIMEOUT' : out.res;
  const bad = (out.res === 'death' && out.t < 2) || verdict === 'SOFTLOCK' || verdict === 'TIMEOUT' || out.err > 0;
  if (bad) fails++;
  const byKind = {}; for (const d of out.dmg) { const [u, k] = d.split(':'); byKind[k] = (byKind[k] || 0) + +u; }
  console.log(`${bad ? 'FAIL' : 'ok  '} ${id.padEnd(8)} ${verdict.padEnd(9)} ${String(out.t).padStart(6)}s dmg ${out.dmg.length ? JSON.stringify(byKind) : 'none'} ${out.softlock ? JSON.stringify(out.softlock) : ''}`);
  if (out.dead || verdict === 'died') needBoot = true; // a dead run ends the game: relaunch for the next room
  rows.push({ id, verdict, t: out.t });
  await g.eval(() => window.__botRun(60)); // let the room settle / drop pickups
}
errs.push(...g.errors);
console.log('console errors:', errs.length, errs.slice(0, 4));
fails += errs.length;
await g.close();
console.log(fails ? `${fails} problem(s)` : `all ${ids.length} rooms cleared without a soft-lock`);
process.exit(fails ? 1 : 0);
