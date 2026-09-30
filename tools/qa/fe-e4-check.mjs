// FE-E4 behaviour check (crate_mimic, rail_rat, chain_gang) in fast-forward (fixed 60 Hz steps, no rendering), so numbers are exact even on a slow headless GPU.
//   node tools/qa/fe-e4-check.mjs [--noassets] [--dropassets=40] [--shots]
// Asserts the CHAPTER2 s3 numbers: mimic disguise / wake rules / telegraph lengths / 2 nickels; rat separation, flee 0.8 s, spawn 0.3 s; chain: 4 bodies, spacing 70,
// 0.7 s windup with the line locked at 0.3 s, charge 430 px/s for 0.9 s, promotion (x1.3, no charge), head-only elites.
import { launch } from './harness.mjs';

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const query = `?debug=1&seed=42${flags.noassets ? '&noassets=1' : ''}${flags.dropassets ? `&dropassets=${flags.dropassets === true ? 40 : flags.dropassets}` : ''}`;
const g = await launch({ query, name: 'fe-e4', quiet: true });
await g.startRun();
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${info ? `  (${info})` : ''}`); };

await g.eval(() => {
  const game = window.__game;
  window.__t = 100000;
  window.__ff = (n, cb) => { // fixed-step fast-forward; cb(i) may return true to stop early
    const scs = game.scene.getScenes(false);
    game.loop.sleep();
    const vis = scs.map((s) => s.sys.settings.visible);
    scs.forEach((s) => (s.sys.settings.visible = false));
    let i = 0;
    for (; i < n; i++) {
      const gs = window.__dw && window.__dw.scene; if (gs && gs.fx) gs.fx.hitStopUntil = 0;
      if (cb && cb(i)) break;
      window.__t += 16.667; game.step(window.__t, 16.667);
    }
    scs.forEach((s, k) => (s.sys.settings.visible = vis[k]));
    return i;
  };
  window.__reset = () => {
    const a = window.__dw.api;
    a.setFloor(5); a.godMode(false); a.jump('start'); window.__ff(60);
    a.killAll(); window.__ff(5);
    const p = window.__dw.player; p.hp = p.maxHp; p.x = 200; p.y = 520; p.vx = p.vy = 0;
    window.__dw.scene.gameInput.override = { move: { x: 0, y: 0 }, aim: null };
  };
});

// ------------------------------------------------------------------------------------------------ crate_mimic
console.log('crate_mimic');
{
  await g.eval(() => window.__reset());
  // 1. disguised, far from the player, alone in the room: sprite hidden, crate image present, wakes after ~7 s of idle
  const r1 = await g.eval(() => {
    const w = window.__dw, sc = w.scene, p = w.player;
    p.x = 200; p.y = 520;
    const m = w.api.spawn('crate_mimic', 1100, 400);
    const out = { disguised: m.state === 'disguise', hidden: !m.sprite.visible, crate: !!m.crate, contact: m.contactDamage };
    let t = 0;
    window.__ff(600, (i) => { t = i / 60; return m.state !== 'disguise'; });
    out.wakeAt = t; out.state = m.state; out.hp = m.hp; out.maxHp = m.maxHp;
    window.__ff(45); // shake 0.5 s -> reveal
    out.afterShake = m.state; out.sprite = m.sprite.visible; out.crateGone = !m.crate;
    return out;
  });
  check('disguise: sprite hidden, crate shown, no contact damage', r1.disguised && r1.hidden && r1.crate && r1.contact === 0);
  check('idle wake at ~7 s', r1.wakeAt > 6.5 && r1.wakeAt < 7.6, `${r1.wakeAt.toFixed(2)}s`);
  check('reveal after the 0.5 s shake', r1.afterShake !== 'wake' && r1.afterShake !== 'disguise' && r1.sprite && r1.crateGone, r1.afterShake);

  // 2. shot wakes it: bullet spent, no damage
  await g.eval(() => window.__reset());
  const r2 = await g.eval(() => {
    const w = window.__dw, sc = w.scene, p = w.player;
    p.x = 200; p.y = 520;
    const m = w.api.spawn('crate_mimic', 800, 520);
    window.__ff(30);
    const hp0 = m.hp;
    sc.bullets.player.fire({ x: 700, y: 520, angle: 0, speed: 600, damage: 5, source: p });
    window.__ff(20);
    return { state: m.state, hp: m.hp === hp0, alive: m.alive, bullets: sc.bullets.player.list ? sc.bullets.player.list.length : -1 };
  });
  check('shot wakes it, no damage', r2.state === 'wake' && r2.hp, JSON.stringify(r2));

  // 3. proximity wake (240 px)
  await g.eval(() => window.__reset());
  const r3 = await g.eval(() => {
    const w = window.__dw, p = w.player;
    p.x = 200; p.y = 520;
    const others = [w.api.spawn('coyote', 1200, 300)]; others[0].speed = 0; others[0].contactDamage = 0; // keep the idle timer from running
    const m = w.api.spawn('crate_mimic', 900, 520);
    window.__ff(20);
    const far = m.state;
    p.x = 900 - 260; window.__ff(5); const at260 = m.state;
    p.x = 900 - 230; window.__ff(5); const at230 = m.state;
    return { far, at260, at230 };
  });
  check('proximity wake at < 240 px only', r3.far === 'disguise' && r3.at260 === 'disguise' && r3.at230 === 'wake', JSON.stringify(r3));

  // 4. combat: telegraphs, damage numbers, drops
  await g.eval(() => window.__reset());
  const r4 = await g.eval(() => {
    const w = window.__dw, sc = w.scene, p = w.player;
    p.godMode = false; p.x = 700; p.y = 520;
    const m = w.api.spawn('crate_mimic', 900, 520);
    const hurts = []; const off = window.__bus ? null : null;
    let last = p.hp; const log = [];
    let stateSince = 0, prev = m.state;
    const durations = {};
    window.__ff(60 * 14, (i) => {
      if (i % 20 === 0) { p.hp = p.maxHp; last = p.maxHp; }
      if (p.hp < last) { log.push({ t: +(i / 60).toFixed(2), dmg: last - p.hp, state: prev }); last = p.hp; p.hp = p.maxHp; last = p.maxHp; }
      if (m.state !== prev) { durations[prev] = Math.max(durations[prev] || 0, (i - stateSince) / 60); prev = m.state; stateSince = i; }
      if (i % 30 === 0) { // keep the player near so bites happen: stand still 130 px away then 60 px away alternately
        p.x = 900 - (Math.floor(i / 300) % 2 ? 60 : 200); p.y = 520;
      }
      return false;
    });
    return { durations, log };
  });
  const d = r4.durations;
  check('pounce crouch telegraph >= 0.3 s', d.crouch >= 0.3, `${(d.crouch || 0).toFixed(2)}s`);
  check('hop lasts 0.5 s', d.hop > 0.45 && d.hop < 0.6, `${(d.hop || 0).toFixed(2)}s`);
  check('bite windup >= 0.4 s', d.bitewind >= 0.39, `${(d.bitewind || 0).toFixed(2)}s`);
  const hopHits = r4.log.filter((h) => h.dmg === 1), biteHits = r4.log.filter((h) => h.dmg === 2);
  console.log('   damage log', JSON.stringify(r4.log.slice(0, 8)));
  check('landing shock deals 1 and/or bite deals 2 (both kinds seen)', hopHits.length > 0 && biteHits.length > 0, `${hopHits.length}x1, ${biteHits.length}x2`);

  const r5 = await g.eval(() => {
    const w = window.__dw, sc = w.scene;
    const m = sc.enemies.find((e) => e.id === 'crate_mimic');
    const before = sc.room.pickups ? sc.room.pickups.length : 0;
    m.hp = 0; m.die({});
    window.__ff(5);
    const list = sc.room.pickups || [];
    return { nick: list.filter((q) => q.type === 'coin_nickel').length, total: list.length - before, err: 0 };
  });
  check('death drops 2 nickels', r5.nick >= 2, JSON.stringify(r5));
}

// ------------------------------------------------------------------------------------------------ rail_rat
console.log('rail_rat');
{
  await g.eval(() => window.__reset());
  const r = await g.eval(() => {
    const w = window.__dw, sc = w.scene, p = w.player;
    p.x = 200; p.y = 520; p.hp = p.maxHp;
    const rats = [];
    for (let i = 0; i < 5; i++) rats.push(w.api.spawn('rail_rat', 1100 + (i % 2) * 20, 300 + i * 25, { instant: false }));
    const spawnT = rats[0].spawnDur;
    let minSep = 1e9, sepSum = 0, sepN = 0;
    let bites = 0, fleeTs = [], lastFlee = new Map();
    let last = p.hp;
    const speeds = [];
    window.__ff(60 * 10, (i) => {
      if (p.hp < last) { p.hp = p.maxHp; }
      last = p.hp;
      for (const e of rats) {
        if (!e.alive) continue;
        if (e.fleeT > 0 && !lastFlee.has(e)) { lastFlee.set(e, i); bites++; }
        if (e.fleeT <= 0 && lastFlee.has(e)) { fleeTs.push((i - lastFlee.get(e)) / 60); lastFlee.delete(e); }
      }
      if (i > 120 && i % 5 === 0) { // packmate spacing while chasing
        for (let a = 0; a < rats.length; a++) for (let b = a + 1; b < rats.length; b++) {
          const d = Math.hypot(rats[a].x - rats[b].x, rats[a].y - rats[b].y);
          if (d < minSep) minSep = d; sepSum += d; sepN++;
        }
      }
      if (i === 100) for (const e of rats) speeds.push(Math.hypot(e.vx, e.vy));
      return false;
    });
    return { spawnT, minSep, meanSep: sepSum / Math.max(1, sepN), bites, fleeTs, speeds, hp: rats.map((e) => e.maxHp) };
  });
  check('spawn puff 0.3 s', Math.abs(r.spawnT - 0.3) < 0.02, `${r.spawnT.toFixed(2)}s`);
  check('rats bite and flee 0.8 s', r.bites > 0 && r.fleeTs.length > 0 && r.fleeTs.every((t) => t > 0.75 && t < 0.9), `${r.bites} bites, flee ${r.fleeTs.map((t) => t.toFixed(2)).join(',')}`);
  check('pack keeps separation (mean spacing >= 25 px)', r.meanSep >= 25, `mean ${r.meanSep.toFixed(0)} min ${r.minSep.toFixed(0)}`);
  check('speed jitter within 290 +-25 %', r.speeds.every((s) => s === 0 || (s >= 290 * 0.72 && s <= 290 * 1.28)), r.speeds.map((s) => s.toFixed(0)).join(','));
}

// ------------------------------------------------------------------------------------------------ chain_gang
console.log('chain_gang');
{
  await g.eval(() => window.__reset());
  const r = await g.eval(() => {
    const w = window.__dw, sc = w.scene, p = w.player;
    p.godMode = true; p.x = 200; p.y = 520;
    const head = w.api.spawn('chain_gang', 1000, 500);
    window.__ff(40);
    const bodies = sc.enemies.filter((e) => e.id === 'chain_gang');
    const out = { n: bodies.length, hpHead: head.maxHp, hpLink: bodies[1] ? bodies[1].maxHp : 0, isHead: head.isHead };
    // spacing while walking
    window.__ff(120);
    const sp = [];
    for (let i = 1; i < head.chain.members.length; i++) { const a = head.chain.members[i - 1], b = head.chain.members[i]; sp.push(Math.hypot(a.x - b.x, a.y - b.y)); }
    out.spacing = sp;
    // windup / charge
    p.x = 200; p.y = 520;
    let wind0 = -1, wind1 = -1, ch0 = -1, ch1 = -1, lockAng = null, aimAtLock = null, maxSp = 0, angAt = [];
    window.__ff(60 * 12, (i) => {
      if (head.state === 'wind' && wind0 < 0) wind0 = i;
      if (head.state === 'wind' && wind0 >= 0) { if (i - wind0 === 12) aimAtLock = head.aimAng; if (i - wind0 === 30) lockAng = head.aimAng; if (i - wind0 === 5) p.y += 60; if (i - wind0 === 25) p.y -= 60; }
      if (head.state === 'charge' && ch0 < 0) { wind1 = i; ch0 = i; }
      if (head.state === 'charge') maxSp = Math.max(maxSp, Math.hypot(head.vx, head.vy));
      if (head.state !== 'charge' && ch0 >= 0 && ch1 < 0) { ch1 = i; return true; }
      return false;
    });
    out.wind = (wind1 - wind0) / 60; out.charge = (ch1 - ch0) / 60; out.maxSp = maxSp; out.lockDelta = Math.abs(lockAng - aimAtLock);
    out.chargeBy = head.state;
    return out;
  });
  check('4 bodies from one slot; head hp 12x, links 10x', r.n === 4 && r.hpLink > 0 && Math.abs(r.hpHead / r.hpLink - 1.2) < 0.01, `${r.n} bodies hp ${r.hpHead.toFixed(1)}/${r.hpLink.toFixed(1)}`);
  check('links ~70 px apart', r.spacing.length === 3 && r.spacing.every((s) => s > 55 && s < 85), r.spacing.map((s) => s.toFixed(0)).join(','));
  check('windup 0.7 s', Math.abs(r.wind - 0.7) < 0.06, `${r.wind.toFixed(2)}s`);
  check('charge 430 px/s for <= 0.9 s', r.maxSp > 420 && r.maxSp < 440 && r.charge <= 0.95 && r.charge > 0.2, `${r.maxSp.toFixed(0)} px/s ${r.charge.toFixed(2)}s`);
  check('aim locked after 0.3 s (player moved back at 0.42 s, aim did not follow)', r.lockDelta < 1e-3, `delta ${r.lockDelta.toFixed(3)} rad between 0.2 s and 0.5 s (player moved 60 px)`);

  await g.eval(() => window.__reset());
  const r2 = await g.eval(() => {
    const w = window.__dw, sc = w.scene, p = w.player;
    p.godMode = true; p.x = 200; p.y = 520;
    const head = w.api.spawn('chain_gang', 1000, 500);
    window.__ff(30);
    const gang = head.chain.members.slice();
    const speed0 = head.speed;
    head.hp = 0; head.die({});
    window.__ff(10);
    const nh = gang[1];
    const out = { newHead: nh.isHead, promoted: nh.promoted, alive: gang.filter((e) => e.alive).length, headOfChain: head.chain.members[0] === nh };
    // no charges for 12 s and speed x1.3
    let charged = false, maxV = 0;
    window.__ff(60 * 12, () => { if (nh.state === 'wind' || nh.state === 'charge') charged = true; maxV = Math.max(maxV, Math.hypot(nh.vx, nh.vy)); return false; });
    out.charged = charged; out.maxV = maxV; out.expect = speed0 * 1.3;
    // kill a middle link: chain closes up
    const mid = head.chain.members[1];
    mid.hp = 0; mid.die({});
    window.__ff(90);
    out.members = head.chain.members.length;
    out.spacing = head.chain.members.length > 1 ? Math.hypot(head.chain.members[0].x - head.chain.members[1].x, head.chain.members[0].y - head.chain.members[1].y) : 0;
    w.api.killAll(); window.__ff(5);
    out.left = sc.enemies.filter((e) => e.id === 'chain_gang').length;
    return out;
  });
  check('head dies -> next link becomes head (x1.3, no charge)', r2.newHead && r2.promoted && r2.headOfChain && !r2.charged && r2.maxV > r2.expect * 0.9 && r2.maxV < r2.expect * 1.1, JSON.stringify(r2));
  check('middle link death closes the chain; killAll leaves none', r2.members === 2 && Math.abs(r2.spacing - 70) < 8 && r2.left === 0, `members ${r2.members} spacing ${r2.spacing.toFixed(0)} left ${r2.left}`);

  // elites: head only
  await g.eval(() => window.__reset());
  const r3 = await g.eval(() => {
    const w = window.__dw, sc = w.scene;
    const head = w.api.spawn('chain_gang', 1000, 500, { affixes: ['armored'] });
    window.__ff(10);
    const bodies = sc.enemies.filter((e) => e.id === 'chain_gang');
    return { elite: bodies.filter((e) => e.affixes.length).length, headElite: head.affixes.length === 1 };
  });
  check('elite affix on the head only', r3.elite === 1 && r3.headElite, JSON.stringify(r3));
}

// ------------------------------------------------------------------------------------------------ elite mimic hides its ring
console.log('elite mimic');
{
  await g.eval(() => window.__reset());
  const r = await g.eval(() => {
    const w = window.__dw;
    const m = w.api.spawn('crate_mimic', 1000, 500, { affixes: ['cursed'] });
    window.__ff(10);
    const hidden = m._affix.rings.every((x) => !x.visible);
    m.wake(); window.__ff(40);
    const shown = m._affix.rings.every((x) => x.visible);
    return { hidden, shown };
  });
  check('elite ring hidden while disguised, shown after reveal', r.hidden && r.shown, JSON.stringify(r));
}

if (flags.shots) {
  await g.eval(() => window.__reset());
  await g.eval(() => { const a = window.__dw.api; const p = window.__dw.player; p.godMode = true; p.x = 300; p.y = 520; a.spawn('crate_mimic', 700, 420); a.spawn('crate_mimic', 900, 620).wake(); a.spawn('chain_gang', 1000, 380); for (let i = 0; i < 5; i++) a.spawn('rail_rat', 500 + i * 30, 700); window.__ff(90); window.__game.loop.wake(); });
  await g.wait(6000);
  await g.eval(() => { const gs = window.__dw.scene; gs.enemies.forEach((e) => { if (e.id === 'crate_mimic') e.hp = e.hp; }); });
  await g.shot('fe-e4-overview');
}

await g.close();
const bad = results.filter((r) => !r.ok);
if (g.errors.length) console.error('console errors:', g.errors.slice(0, 5));
console.log(bad.length || g.errors.length ? `\nFAILED: ${bad.map((b) => b.name).join('; ')}` : `\nfe-e4-check OK (${results.length} checks)`);
process.exit(bad.length || g.errors.length ? 1 : 0);
