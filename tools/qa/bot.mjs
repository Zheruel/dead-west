// Autoplay bot runner (god mode OFF, fixed-step sim). Usage:
//   node tools/qa/bot.mjs [--seeds 1-8 | 3,5,9] [--aim free|4way] [--skill expert|competent|casual] [--tag name] [--items a,b] [--floor N] [--react 0.2] [--maxsim 3600] [--cfg '{"rollProb":0.5}'] [--quiet]
// Results are appended to art/qa/bot-<tag>.jsonl (one JSON line per run) and a summary table is printed at the end.
import { launch } from './harness.mjs';
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes('--' + k);
const seedArg = opt('seeds', '1-8');
const seeds = seedArg.includes('-') && !seedArg.includes(',') ? Array.from({ length: +seedArg.split('-')[1] - +seedArg.split('-')[0] + 1 }, (_, i) => +seedArg.split('-')[0] + i) : seedArg.split(',').map(Number);
const tag = opt('tag', 'run');
const items = (opt('items', '') || '').split(',').filter(Boolean);
const startFloor = +opt('floor', 1);
const cfg = { aim: opt('aim', 'free'), skill: opt('skill', 'expert'), ...(opt('react') ? { react: +opt('react') } : {}), ...(opt('maxsim') ? { maxSim: +opt('maxsim') } : {}), ...JSON.parse(opt('cfg', '{}')) };
const out = `art/qa/bot-${tag}.jsonl`;
fs.mkdirSync('art/qa', { recursive: true });
const src = fs.readFileSync(new URL('./bot-page.js', import.meta.url), 'utf8');

let g = null;
async function boot(seed) {
  const q = `?debug=1&seed=${seed}`;
  if (!g) {
    g = await launch({ query: q, name: 'bot', quiet: true });
    g.page.on('pageerror', () => {});
  } else {
    await g.page.goto(g.base + q, { waitUntil: 'domcontentloaded' });
    await g.page.waitForFunction(() => window.__game && window.__game.scene.isActive('Menu'), { timeout: 120000 });
  }
  g.errors.length = 0;
  await g.startRun();
  await g.page.waitForFunction(() => window.__dw && window.__dw.api, { timeout: 60000 });
  await g.eval((src, cfg, items, floor) => {
    window.__game.sound.mute = true;
    window.__t = window.__game.loop.now;
    (0, eval)(src);
    const a = window.__dw.api;
    if (floor > 1) a.setFloor(floor);
    for (const i of items) a.giveItem(i);
    a.heal();
    window.__botInstall(cfg);
  }, src, cfg, items, startFloor);
}

const results = [];
for (const seed of seeds) {
  const t0 = Date.now();
  let res = null;
  try {
    await boot(seed);
    let last = 0;
    for (;;) {
      const r = await g.eval(() => { window.__botRun(1800); const B = window.__bot; return B.result ? 'done' : 'go'; });
      if (r === 'done') break;
      if (Date.now() - t0 > 900000) { console.log('wall-clock abort'); break; }
    }
    res = await g.eval(() => {
      const B = window.__bot;
      const s = B.summary();
      return { ...s, rooms: B.rooms.map(({ rm, ...r }) => r), dmg: B.dmg, ev: B.ev.filter((e) => e.e !== 'unstick').concat(B.ev.filter((e) => e.e === 'unstick').slice(0, 30)), err: B.err || 0 };
    });
    res.errors = g.errors.slice(0, 8);
    res.wall = Math.round((Date.now() - t0) / 1000);
    fs.appendFileSync(out, JSON.stringify({ tag, cfg, ...res }) + '\n');
    results.push(res);
    const d = res.death;
    if (!has('quiet')) console.log(`seed ${seed}: ${res.result} F${res.floor} t=${res.simT}s hp=${res.hp}/${res.maxHp} items=${res.items.length} rooms=${res.roomsCleared} dmg=${res.dmgTaken}${d ? ` died: ${d.by} in ${d.room}${d.boss ? '/' + d.boss + ' hp' + d.bossHp : ''}` : ''}${res.softlock ? ' SOFTLOCK ' + JSON.stringify(res.softlock) : ''} errs=${res.errors.length} wall=${res.wall}s`);
    if (res.errors.length) console.log('  errors:', res.errors.slice(0, 3));
  } catch (e) {
    console.log(`seed ${seed}: RUNNER ERROR`, String(e).slice(0, 200));
    try { if (g) await g.close(); } catch (e2) { /* */ }
    g = null;
  }
}
if (g) await g.close();

// summary
const n = results.length;
const won = results.filter((r) => r.result === 'complete').length;
const reach = (f) => results.filter((r) => r.floor >= f || r.result === 'complete').length;
const surv = (f) => results.filter((r) => r.floor > f || r.result === 'complete').length;
console.log(`\n== ${tag}: ${n} runs, aim=${cfg.aim}  complete ${won}/${n}  (F1 cleared ${surv(1)}/${n}, F2 cleared ${surv(2)}/${n})  softlocks ${results.filter((r) => r.result === 'softlock').length}  crashes ${results.filter((r) => r.errors && r.errors.length).length}`);
