// Elite affix QA (EVENTS 5 / ARCH D3, WORK_PLAN FN-5).
//   node tools/qa/elite-telegraph.mjs            pure roll checks + browser checks (needs Chrome)
//   node tools/qa/elite-telegraph.mjs --sim      pure part only
//   node tools/qa/elite-telegraph.mjs --browser  browser part only
// PURE: 200 rooms per floor (x5 seeds for a tight estimate) through Affixes.rollWave: elite rate within +-2 % of the D3 formula
// (base x diff.eliteMult x curse_rot x (1 + 1.5 curseHunted), capped), <= maxPerRoom, one plain enemy always left, ban / forbidden pairs,
// second affix only on floors 5-6, allCursed forces cursed, deterministic per seed, ineligible ids never roll.
// BROWSER: splitting never chains (clones are plain, noLoot, noSplit), volatile blast hurts the player once, swift keeps every windup pose
// >= min(0.4 s, plain windup) (measured in enemy time), cursed hp x1.5 exactly once, shielded absorbs, no console errors.
import { RNG } from '../../src/core/rng.js';
import * as CFG from '../../src/config.js';
import { AFFIXES, AFFIX_IDS, AFFIX_NUM, roll, rollWave, chance, eligible } from '../../src/enemies/Affixes.js';

const args = new Set(process.argv.slice(2));
const wantSim = !args.has('--browser');
const wantBrowser = !args.has('--sim');
let failed = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ok    ${msg}`); else { failed++; console.log(`  FAIL  ${msg}`); } };
const skip = (msg) => console.log(`  skip  ${msg}`);

const POOL = ['outlaw', 'coyote', 'skeleton', 'rattlesnake', 'dynamiter', 'bat', 'mole', 'hellhound', 'ghost', 'miner'];

function sim() {
  console.log('elite roll (200 rooms per floor, 5 seeds)');
  for (let floor = 1; floor <= 6; floor++) {
    const formula = chance({ floor });
    const maxN = CFG.eliteMaxPerRoom(floor);
    let elites = 0, total = 0, over = 0, allElite = 0, twoAffix = 0, badPair = 0, banBroke = 0, rooms = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const rng = new RNG(seed * 7919 + floor);
      for (let r = 0; r < 200; r++) {
        const n = 4 + Math.floor(rng.next() * 6);
        const recs = Array.from({ length: n }, (_, i) => ({ id: POOL[Math.floor(rng.next() * POOL.length)], x: 0, y: 0 }));
        const c = rollWave(rng, recs, { floor });
        rooms++;
        elites += c; total += n;
        if (c > maxN) over++;
        if (c >= n) allElite++;
        for (const rec of recs) {
          if (rec.affixes.length > 1) {
            twoAffix++;
            const [a, b] = rec.affixes;
            if (a === b || (AFFIXES[a].hpMult && AFFIXES[b].hpMult) || AFFIX_NUM.secondAffixPairs.some(([x, y]) => (a === x && b === y) || (a === y && b === x))) badPair++;
          }
          for (const a of rec.affixes) if (floor < AFFIXES[a].floors[0] || floor > AFFIXES[a].floors[1]) banBroke++;
        }
      }
    }
    const rate = elites / total;
    // the caps (max per room, one plain enemy) can only lower the measured rate a little below the raw formula
    console.log(`  floor ${floor}: rate ${(rate * 100).toFixed(2)} % vs formula ${(formula * 100).toFixed(1)} %  (${rooms} rooms, ${total} enemies, two-affix ${twoAffix})`);
    ok(Math.abs(rate - formula) <= 0.02, `floor ${floor}: rate within +-2 % of the formula`);
    ok(over === 0, `floor ${floor}: never more than maxPerRoom (${maxN}) elites`);
    ok(allElite === 0, `floor ${floor}: at least one plain enemy per room`);
    ok(badPair === 0 && banBroke === 0, `floor ${floor}: forbidden pairs and floor gates respected`);
    if (floor < 5) ok(twoAffix === 0, `floor ${floor}: no second affix before floor 5`);
    else ok(twoAffix > 0, `floor ${floor}: second affixes occur`);
  }
  // modifiers of the formula
  ok(Math.abs(chance({ floor: 3, curses: ['curse_rot'] }) - CFG.eliteChance(3) * 2) < 1e-9, 'curse_rot doubles the chance');
  ok(Math.abs(chance({ floor: 3, curseHunted: 1 }) - CFG.eliteChance(3) * 2.5) < 1e-9, 'curseHunted 1 -> x2.5');
  ok(chance({ floor: 6, curses: ['curse_rot'], curseHunted: 3, diff: { eliteMult: 3 } }) === CFG.VARIETY.elite.cap, 'cap holds');
  ok(Math.abs(chance({ floor: 2, diff: { eliteMult: 1.5 } }) - CFG.eliteChance(2) * 1.5) < 1e-9, 'diff.eliteMult scales the chance');
  // ineligible / bans
  ok(!eligible('crow') && !eligible('duelist') && !eligible('tumbleweed_mini') && !eligible('contract_seal'), 'crow / duelist / mini tumbleweed / seals never elite');
  const rn = new RNG(5);
  let bad = 0;
  for (let i = 0; i < 2000; i++) if (roll(rn, { floor: 6, enemyId: 'crow', allCursed: true }).length) bad++;
  ok(bad === 0, 'ineligible ids never roll, even with allCursed');
  const cursed = rollWave(new RNG(1), Array.from({ length: 5 }, () => ({ id: 'outlaw' })), { floor: 2, allCursed: true });
  ok(cursed === 5, 'allCursed makes every eligible enemy cursed');
  // same seed -> same elites
  const mk = () => Array.from({ length: 8 }, (_, i) => ({ id: POOL[i % POOL.length] }));
  const a = mk(), b = mk();
  rollWave(new RNG(99), a, { floor: 4 }); rollWave(new RNG(99), b, { floor: 4 });
  ok(JSON.stringify(a) === JSON.stringify(b), 'deterministic per seed');
  console.log('  affix ids:', AFFIX_IDS.join(' '));
  ok(AFFIX_IDS.length === 8, 'eight affixes');
}

async function browser() {
  console.log('browser: splitting, volatile, swift telegraphs, cursed hp');
  const { launch } = await import('./harness.mjs');
  const g = await launch({ query: '?debug=1&seed=42&noassets=1', name: 'elite', quiet: true });
  try {
    await g.startRun();
    const settle = async (pred, ms = 8000) => { try { await g.page.waitForFunction(pred, { timeout: ms }); return true; } catch { return false; } };
    await g.eval(() => { __dw.api.godMode(true); __dw.api.killAll(); });
    await g.wait(300);

    // ---------------------------------------------------------------- splitting never chains
    const split = await g.eval(async () => {
      const api = __dw.api, sc = __dw.scene, p = __dw.player;
      const out = { deaths: 0, afterFirst: 0, cloneAffixes: [], cloneFlags: [], final: 0 };
      const onDied = () => { out.deaths++; };
      const { bus } = await import('/src/core/events.js');
      bus.on('enemy:died', onDied);
      const e = api.spawn('outlaw', p.x + 220, p.y, { affixes: ['splitting'] });
      await new Promise((r) => setTimeout(r, 600));
      e.hp = 0; e.die({});
      await new Promise((r) => setTimeout(r, 900));
      const kids = sc.enemies.filter((x) => x.alive);
      out.afterFirst = kids.length;
      for (const k of kids) { out.cloneAffixes.push((k.affixes || []).length); out.cloneFlags.push(!!k.noSplit && !!k.noLoot); }
      for (const k of kids) { k.hp = 0; k.die({}); }
      await new Promise((r) => setTimeout(r, 1200));
      out.final = sc.enemies.filter((x) => x.alive).length;
      bus.off('enemy:died', onDied);
      return out;
    });
    ok(split.afterFirst === AFFIX_NUM.splitting.count, `splitting: ${AFFIX_NUM.splitting.count} clones spawn (${split.afterFirst})`);
    ok(split.cloneAffixes.every((n) => n === 0) && split.cloneFlags.every(Boolean), 'splitting: clones are plain, noSplit and noLoot');
    ok(split.final === 0 && split.deaths === 1 + AFFIX_NUM.splitting.count, `splitting never chains (${split.deaths} deaths, ${split.final} left alive)`);

    // ---------------------------------------------------------------- volatile hurts once
    const vol = await g.eval(async () => {
      const api = __dw.api, sc = __dw.scene, p = __dw.player;
      api.godMode(false); p.tin = 0; p.hp = p.maxHp; p.hurtT = 0; p.entryInv = 0;
      let calls = 0; const orig = p.damage.bind(p);
      p.damage = (...a) => { calls++; return orig(...a); };
      const e = api.spawn('outlaw', p.x + 40, p.y, { affixes: ['volatile'] });
      await new Promise((r) => setTimeout(r, 600));
      e.hp = 0; e.die({});
      await new Promise((r) => setTimeout(r, 2500));
      p.damage = orig; api.godMode(true);
      return { calls, hp: p.hp, max: p.maxHp };
    });
    ok(vol.calls === 1, `volatile: the blast hurts the player exactly once (${vol.calls} hits)`);

    // ---------------------------------------------------------------- cursed hp x1.5 once
    const cur = await g.eval(async () => {
      const api = __dw.api, p = __dw.player;
      const a = api.spawn('outlaw', p.x + 260, p.y, {});
      const b = api.spawn('outlaw', p.x + 260, p.y + 60, { affixes: ['cursed'] });
      const out = { plain: a.maxHp, cursed: b.maxHp, cursedFlag: b.cursed };
      a.hp = 0; a.die({ silent: true }); b.hp = 0; b.die({ silent: true });
      return out;
    });
    ok(Math.abs(cur.cursed / cur.plain - AFFIX_NUM.cursed.hp) < 0.02 && cur.cursedFlag, `cursed: hp x${(cur.cursed / cur.plain).toFixed(2)} (expect ${AFFIX_NUM.cursed.hp})`);

    // ---------------------------------------------------------------- shielded absorbs
    const sh = await g.eval(async () => {
      const api = __dw.api, p = __dw.player;
      const e = api.spawn('outlaw', p.x + 260, p.y, { affixes: ['shielded'] });
      await new Promise((r) => setTimeout(r, 400));
      const hp0 = e.hp;
      e.hurt(1, { kind: 'bullet' });
      const after = e.hp;
      e.hp = 0; e.die({ silent: true });
      return { hp0, after };
    });
    ok(sh.after === sh.hp0, 'shielded: the first hit is absorbed by the bubble');

    // ---------------------------------------------------------------- swift keeps telegraphs
    const IDS = ['outlaw', 'coyote', 'skeleton', 'rattlesnake', 'dynamiter', 'bouncer', 'miner'];
    await g.eval(() => { __dw.api.killAll(); __dw.api.godMode(true); });
    const res = await g.eval(async (ids) => {
      const api = __dw.api, sc = __dw.scene, p = __dw.player;
      const rec = {}; // key -> {windups: number[], t, open, id, swift}
      const tracked = [];
      const spawn = (id, swift, k) => {
        const ang = (k / (ids.length * 2)) * Math.PI * 2;
        const e = api.spawn(id, p.x + Math.cos(ang) * 300, p.y + Math.sin(ang) * 220, swift ? { affixes: ['swift'] } : {});
        if (!e) return;
        const key = `${id}:${swift ? 'swift' : 'plain'}`;
        const r = rec[key] || (rec[key] = { windups: [], cur: 0, open: false, aiScale: 0 });
        const orig = e.update.bind(e);
        e.update = (dt) => {
          orig(dt);
          if (e.aiScale > r.aiScale) r.aiScale = e.aiScale;
          const w = e.pose === 'windup' || e.pulseT > 0;
          if (w) { r.cur += dt; r.open = true; }
          else if (r.open) { if (r.cur > 0.02) r.windups.push(r.cur); r.cur = 0; r.open = false; }
        };
        e.hp = e.maxHp = 9999;
        tracked.push(e);
      };
      ids.forEach((id, i) => { spawn(id, false, i * 2); spawn(id, true, i * 2 + 1); });
      let game = 0; const off = () => {};
      const t0 = performance.now();
      await new Promise((resolve) => {
        const tick = () => {
          if (performance.now() - t0 > 40000) return resolve();
          if (Object.values(rec).every((r) => r.windups.length >= 3)) return resolve();
          setTimeout(tick, 250);
        };
        tick();
      });
      for (const e of tracked) { e.hp = 0; e.die({ silent: true }); }
      const out = {};
      for (const [k, r] of Object.entries(rec)) out[k] = { n: r.windups.length, min: r.windups.length ? Math.min(...r.windups) : null, aiScale: r.aiScale };
      return out;
    }, IDS);
    let anyMeasured = 0;
    for (const id of IDS) {
      const pl = res[`${id}:plain`], sw = res[`${id}:swift`];
      if (!pl || !sw) continue;
      console.log(`  ${id}: plain windups ${pl.n} (min ${pl.min && pl.min.toFixed(2)} s)  swift windups ${sw.n} (min ${sw.min && sw.min.toFixed(2)} s)  swift aiScale peak ${sw.aiScale}`);
      if (sw.n === 0) { skip(`${id}: swift enemy never wound up in the window`); continue; }
      anyMeasured++;
      const floorT = Math.min(0.4, (pl.min ?? 0.4) * 0.9);
      ok(sw.min >= floorT - 0.03, `${id}: swift telegraph min ${sw.min.toFixed(2)} s >= ${floorT.toFixed(2)} s`);
      ok(sw.aiScale >= 1.19, `${id}: swift ai speed-up active (${sw.aiScale})`);
    }
    ok(anyMeasured >= 2, `swift windups measured on ${anyMeasured} enemy types`);
  } finally {
    ok(g.errors.length === 0, `no console errors (${g.errors.length}) ${g.errors.slice(0, 3).join(' | ')}`);
    await g.close();
  }
}

if (wantSim) sim();
if (wantBrowser) await browser();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
