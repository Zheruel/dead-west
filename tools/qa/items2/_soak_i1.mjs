// FE-I1 soak: all 15 batch-1 passives (x1 and x3) against 6 live enemies, fixed-step 60 game seconds each, godMode.
//   node tools/qa/items2/_soak_i1.mjs [?query]    reports ms of CPU per simulated frame (headless real-time fps is unusable on a busy machine;
//   budget: < 12 ms/frame average = comfortably 60 fps on a normal machine) and the peak of live bullets / display objects.
import { boot, reporter } from '../items2-lib.mjs';
import { install } from './_i1.mjs';

const query = process.argv.find((a) => a.startsWith('?')) || '?debug=1&seed=42';
const { ok, r } = reporter();
const g = await boot('items-soak-i1', query);
const ev = (fn, ...a) => g.eval(fn, ...a);
await install(ev);
const IDS = ['forked_tongue', 'widows_bone', 'lightning_rod', 'blast_caps', 'wraith_rounds', 'lodestone', 'blue_norther', 'brand_iron', 'gila_gland', 'holy_water', 'wanted_poster', 'bronco_boots', 'hand_mirror', 'black_cat_bone', 'blood_bandana'];
for (const copies of [0, 1, 3]) {
  const out = await ev((ids, copies) => {
    const I = window.__fei1, dw = window.__dw, p = dw.player, sc = dw.scene;
    p.restore({ items: [], hp: 99, tin: 0, coins: 0, keys: 0, dyn: 3 });
    for (let c = 0; c < copies; c++) for (const id of ids) sc.items.pickup(p, id, 'debug');
    I.ff(120); I.prep({ god: true }); p.hp = 4; p.recomputeStats();
    const spawn = () => { for (const [id, x, y] of [['outlaw', 500, -100], ['coyote', 560, 60], ['skeleton', 380, -20], ['ghost', 600, 120], ['outlaw', 420, 140], ['coyote', 450, -150]]) { const e = dw.api.spawn(id, p.x + x - 500 + 300, p.y + y); e.contactDamage = 0; } };
    spawn();
    const t0 = performance.now(); let peakB = 0, peakObj = 0, frames = 0;
    dw.api.input({ move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, fire: true });
    for (let s = 0; s < 60; s++) {
      if (sc.enemies.filter((e) => e.alive).length < 4) spawn();
      if (s % 5 === 0) { p.startRoll({ x: 0, y: s % 10 ? 1 : -1 }, { x: 1, y: 0 }); }
      I.ff(60);
      frames += 60;
      peakB = Math.max(peakB, sc.bullets.player.list.length);
      peakObj = Math.max(peakObj, sc.children.length);
    }
    dw.api.input(null);
    const ms = performance.now() - t0;
    return { ms: ms / frames, peakB, peakObj, hp: p.hp, alive: !p.dead, items: p.items.length, finite: Object.values(p.stats).every((v) => typeof v !== 'number' || Number.isFinite(v)) };
  }, IDS, copies);
  console.log(`copies ${copies}:`, JSON.stringify(out));
  ok(`x${copies}: < 12 ms per simulated frame`, out.ms < 12, out.ms.toFixed(2));
  ok(`x${copies}: bullets bounded (< 400) and stats finite`, out.peakB < 400 && out.finite);
}
const leak = await ev(() => { const sc = window.__dw.scene; return sc.children.length; });
ok('display list is finite', leak < 4000, `${leak}`);
const real = g.errors.filter((e) => !/favicon|Failed to load resource|noassets/i.test(e));
ok('no console errors', real.length === 0, real.slice(0, 2).join(' | ').slice(0, 300));
console.log(`\nsoak-i1: ${r.pass} pass, ${r.fail} fail`);
await g.close();
process.exit(r.fail ? 1 : 0);
