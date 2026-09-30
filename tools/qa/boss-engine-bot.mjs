// QA for Engine No. 666 (floor 5, god mode OFF for fights), fast-forwarded (game.step without rendering).
//   node tools/qa/boss-engine-bot.mjs [--mode=fight|fuzz|soak|phases|all] [--skill=0.7] [--seeds=1..8 | --seed=11] [--max=240] [--items=hollow_point,speed_loader,snake_oil]
//                                     [--hp=6] [--start=0..2 (phase)] [--noassets] [--dropassets=40] [--quiet]
//   fight   bot fights the engine per seed: WIN/LOSS, fight time, hearts lost per attack; SUMMARY win rate + median win time (targets 60-80 %, 70-115 s).
//   fuzz    every attack x both phase thresholds x several offsets into the attack (soft = through takeHit, hard = hp write + onHit): the phase change must
//           cancel the attack cleanly (parked, no run / tell / lanes / coal markers, visible, hittable after the roar) and the engine keeps attacking.
//   phases  every phase reachable through the debug api (spawnBoss + hp write), each attack forced once per phase: attack list + telegraph >= 0.5 s check.
//   soak    120 s of the bot in real time (god mode): fps (headless software GL: informational unless --strict-fps), console errors, generator stalls.
import { boot, toBoss, hideCards } from './boss-engine-lib.mjs';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const mode = arg('mode', 'fight'), skill = +arg('skill', 0.7), maxSim = +arg('max', 240), quiet = process.argv.includes('--quiet');
const items = arg('items', 'hollow_point,speed_loader,snake_oil').split(',').filter(Boolean);
const hearts = +arg('hp', 0), startPhase = +arg('start', 0);
const seedArg = arg('seeds', arg('seed', '11'));
const seeds = /^(\d+)\.\.(\d+)$/.test(seedArg) ? Array.from({ length: +RegExp.$2 - +RegExp.$1 + 1 }, (_, i) => +RegExp.$1 + i) : seedArg.split(',').map(Number);
const query = (seed) => `?debug=1&seed=${seed}${process.argv.includes('--noassets') ? '&noassets=1' : ''}${arg('dropassets', '') ? `&dropassets=${arg('dropassets')}` : ''}`;
let failures = 0;
const fail = (m) => { failures++; console.log('FAIL', m); };

// ------------------------------------------------------------------------------------------------ in-page bot
const BOT = () => {
  const log = (window.__log = { hurt: [], attacks: [], phases: [], t0: null, rolls: 0, shots: 0, byAtk: {}, stall: 0 });
  window.__bot = { skill: 0.7, acc: 0.92 };
  let lastAtk = '', lastPhase = 0, wrapped = null, wig = 0, wigT = 0, lastGenT = 0, lastState = '';
  const STRIPS = [528, 720, 336];
  const CAND = [];
  for (let ai = 0; ai < 16; ai++) for (const rr of [50, 110, 180, 260]) CAND.push([Math.cos((ai / 16) * Math.PI * 2) * rr, Math.sin((ai / 16) * Math.PI * 2) * rr, rr]);
  CAND.push([0, 0, 0]);
  window.__botStep = () => {
    const sc = window.__dw && window.__dw.scene; if (!sc) return;
    const p = sc.player; const b = sc.enemies.find((e) => e.isBoss);
    if (p !== wrapped) { wrapped = p; const od = p.damage.bind(p); p.damage = (u, src) => { const r = od(u, src); if (r) { const k = (src && (src.kind || src.enemyName)) || '?'; log.hurt.push([+(p.time - (log.t0 || 0)).toFixed(1), u, k, b ? b.lastAttack : '', Math.round(p.x), Math.round(p.y), b ? b.railState : '']); const a = b ? b.lastAttack : '?'; log.byAtk[a] = (log.byAtk[a] || 0) + u; } return r; }; }
    if (!p || p.dead || !b || !b.alive || !b.active || b.dying) { sc.gameInput.override = { move: { x: 0, y: 0 }, aim: null }; return; }
    if (log.t0 == null) log.t0 = p.time;
    const T = +(p.time - log.t0).toFixed(1);
    if (b.lastAttack !== lastAtk) { lastAtk = b.lastAttack; log.attacks.push([T, lastAtk, Math.round(b.hp)]); }
    if (b.phase !== lastPhase) { lastPhase = b.phase; log.phases.push([T, b.phase, Math.round(b.hp)]); }
    // generator stall watchdog: an attack that runs > 25 s means a deadlock
    const st = b.gen ? b.lastAttack + b.phase : ''; if (st !== lastState) { lastState = st; lastGenT = p.time; } else if (st && p.time - lastGenT > 25) { log.stall++; lastGenT = p.time; }
    const sk = window.__bot.skill;
    const react = 0.25 + (1 - sk) * 0.5; // seconds a human needs before a tell is acted on
    wigT -= 1 / 60;
    if (wigT <= 0) { wig = (Math.random() - 0.5) * 100; wigT = 1 + Math.random() * 1.5; }
    // ---- hazards the bot knows about
    const danger = []; // rail rows
    if (b.tell && b.tell.t > react) danger.push({ y: b.tell.y, rem: b.tell.dur - b.tell.t });
    if (b.run && b.run.dmg > 0) danger.push({ y: b.run.y, rem: 0, run: 1 });
    for (const r of b.ghostLanes) { const l = r.l; if (l && !r.d && l.state === 'tell' && l.t > react) danger.push({ y: l.center, rem: l.tell - l.t }); else if (l && !r.d && l.state === 'run') danger.push({ y: l.center, rem: 0, run: 1, x: l.pos }); }
    const circles = []; // coal markers about to land + fire patches
    for (const h of b.hz) { if (h.done) continue; const rem = h.tell - h.t; if (rem > 0.95 - 0.4 * sk || rem < -h.hold) continue; circles.push({ x: h.x, y: h.y, r: h.r + 22, rem }); }
    for (const f of (sc.room && sc.room._hz && sc.room._hz.fires && sc.room._hz.fires.order) || []) if (f.team !== 'player') circles.push({ x: f.x, y: f.y, r: f.r + 22, rem: -1 });
    const buls = [];
    for (const bl of sc.bullets.enemy.list) if (bl.active && Math.abs(bl.x - p.x) < 420 && Math.abs(bl.y - p.y) < 420) buls.push(bl);
    const adds = sc.enemies.filter((e) => e !== b && e.alive);
    const bodyR = b.contactDamage > 0 && b.railState === 'parked' ? b.radius * 0.85 + 46 : 0;
    // ---- where to stand
    let wx = 720 + wig, wy = 528;
    if (b.wreck) { wx = b.x < 720 ? b.x + 250 : b.x - 250; wy = b.y; }
    else {
      let best = 1e9;
      for (const sy of STRIPS) { if (danger.some((d) => Math.abs(sy - d.y) < 62)) continue; const c = Math.abs(sy - p.y) + (sy === 528 ? -60 : 0); if (c < best) { best = c; wy = sy; } }
    }
    // ---- planner: pick the cheapest reachable point (travel + distance to the stand point + hazard penalties)
    const pen = (x, y, atNow) => {
      let c = 0;
      for (const k of circles) if ((x - k.x) ** 2 + (y - k.y) ** 2 < k.r * k.r) c += k.rem < 0.35 ? 700 : 260;
      for (const bl of buls) { for (let t = 0.1; t <= 0.9; t += 0.16) { const dx = x - (bl.x + bl.vx * t), dy = y - (bl.y + bl.vy * t); if (dx * dx + dy * dy < (bl.r + 30) ** 2) { c += t < 0.3 && atNow ? 400 : 240; break; } } }
      if (bodyR && (x - b.x) ** 2 + (y - b.y) ** 2 < bodyR * bodyR) c += 900;
      for (const d of danger) if (Math.abs(y - d.y) < 60 && (d.run || d.rem < 1.2)) c += 700;
      for (const e of adds) if ((x - e.x) ** 2 + (y - e.y) ** 2 < 140 * 140) c += 180;
      return c;
    };
    const here = pen(p.x, p.y, true);
    let bx0 = p.x, by0 = p.y, bc = here + 0.35 * Math.hypot(p.x - wx, p.y - wy);
    for (let i = 0; i < CAND.length; i++) {
      const cx = p.x + CAND[i][0], cy = p.y + CAND[i][1];
      if (cx < 96 + 60 || cx > 1344 - 60 || cy < 192 + 60 || cy > 864 - 60) continue;
      const c = pen(cx, cy, false) + 0.45 * CAND[i][2] + 0.35 * Math.hypot(cx - wx, cy - wy);
      if (c < bc) { bc = c; bx0 = cx; by0 = cy; }
    }
    const sx = wx - p.x, sy = wy - p.y;
    let mx = 0, my = 0;
    if (bx0 === p.x && by0 === p.y) { // nothing better than staying: drift to the stand point
      if (Math.abs(sx) > 18) mx = Math.sign(sx) * Math.min(1, Math.abs(sx) / 80);
      if (Math.abs(sy) > 12) my = Math.sign(sy) * Math.min(1.4, Math.abs(sy) / 50);
      if (pen(p.x + Math.sign(mx) * 30, p.y + Math.sign(my) * 30, false) > here) { mx = 0; my = 0; }
    } else { const dl = Math.hypot(bx0 - p.x, by0 - p.y) || 1; mx = (bx0 - p.x) / dl * 2; my = (by0 - p.y) / dl * 2; }
    // roll when something is about to land on the bot
    let threat = here >= 400 ? 1 : 0;
    for (const d of danger) if (d.run && Math.abs(p.y - d.y) < 50 && (b.run ? Math.abs(p.x - b.x) < 340 : d.x != null && Math.abs(p.x - d.x) < 260)) threat = 1;
    // ---- shoot (4-way like the real game); adds first
    let tgt = b, nd = 1e9;
    for (const e of adds) { const ed = Math.hypot(p.x - e.x, p.y - e.y); if (ed < nd && ed < 480) { nd = ed; tgt = e; } if (ed < 110) threat = 1; }
    const tx = tgt.x - p.x, ty = tgt.y - p.y;
    let aim = null;
    const R = (tgt.hitRadius || 40) * 0.85;
    if (Math.abs(tx) > Math.abs(ty)) { if (Math.abs(ty) < R) aim = { x: Math.sign(tx), y: 0 }; }
    else if (Math.abs(tx) < R) aim = { x: 0, y: Math.sign(ty) };
    if (tgt === b && (b.invulnerable || !b.targetable)) aim = null;
    if (Math.random() > window.__bot.acc) aim = null;
    if (aim) log.shots++;
    const ml = Math.hypot(mx, my) || 1;
    sc.gameInput.override = { move: { x: mx / Math.max(1, ml), y: my / Math.max(1, ml) }, aim };
    if (threat && p.rollCd <= 0 && !p.rolling && Math.random() < sk * 0.7) { sc.gameInput.press('roll'); log.rolls++; }
  };
};

const done = (r) => r.dead || r.bhp == null || r.dying;
const stepRes = () => { window.__ff(600, window.__botStep, () => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return window.__dw.scene.player.dead || !b || b.dying; }); const s = window.__dw.scene; const b = s.enemies.find((e) => e.isBoss); const p = s.player; return { bhp: b ? Math.round(b.hp) : null, ph: b && b.phase, php: p.hp + '/' + p.maxHp, dead: p.dead, gt: +(p.time - (window.__log.t0 || 0)).toFixed(1), n: s.enemies.length, bul: s.bullets.enemy.list.length, dying: b && b.dying, rs: b && b.railState }; };

// ------------------------------------------------------------------------------------------------ fight
async function fight() {
  const results = [];
  for (const seed of seeds) {
    const g = await boot(query(seed), { items, god: false });
    try {
      await toBoss(g); await hideCards(g);
      await g.eval(([sp, hp]) => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); if (sp > 0) { b.hp = b.maxHp * (sp === 1 ? 0.65 : 0.32); b.onHit(0); } if (hp) { s.player.stats.maxHearts = hp; s.player.hp = hp * 2; } }, [startPhase, hearts]);
      await g.eval(BOT); await g.eval((s) => { window.__bot.skill = s; }, skill);
      const t0 = Date.now();
      let simT = 0, res;
      while (simT < maxSim) {
        res = await g.eval(stepRes);
        simT += 10;
        if (!quiet) console.log(seed, JSON.stringify(res));
        if (done(res)) break;
      }
      const log = await g.eval(() => window.__log);
      const win = !res.dead && (res.bhp == null || res.dying);
      results.push({ seed, win, time: res.gt, php: res.php });
      console.log(`seed ${seed}: ${win ? 'WIN' : 'LOSS'} t=${res.gt}s hp=${res.php} boss=${res.bhp} phase=${res.ph} rolls=${log.rolls} shots=${log.shots} stalls=${log.stall} real=${((Date.now() - t0) / 1000) | 0}s dmgByAttack=${JSON.stringify(log.byAtk)}`);
      if (!quiet && !win) console.log(JSON.stringify(log.hurt));
      if (log.stall) fail(`seed ${seed}: generator stall`);
      if (g.errors.length) { console.log('ERRORS', g.errors.slice(0, 5)); fail(`seed ${seed}: console errors`); }
    } finally { await g.close(); }
  }
  const w = results.filter((r) => r.win), ts = w.map((r) => r.time).sort((a, b) => a - b);
  const rate = Math.round((100 * w.length) / Math.max(1, results.length)), med = ts.length ? (ts.length % 2 ? ts[ts.length >> 1] : (ts[ts.length / 2 - 1] + ts[ts.length / 2]) / 2) : NaN;
  console.log(`SUMMARY skill=${skill} win ${w.length}/${results.length} (${rate} %) median win time ${Number.isNaN(med) ? '-' : med} s  targets: win 60-80 %, median 70-115 s`);
  if (seeds.length >= 8 && (rate < 60 || rate > 80)) fail(`win rate ${rate} % outside 60-80 %`);
  if (ts.length && (med < 70 || med > 115)) fail(`median win time ${med} s outside 70-115 s`);
}

// ------------------------------------------------------------------------------------------------ fuzz: phase change mid-attack
const ATTACKS = ['coal_barrage', 'steam_rings', 'lane_charge', 'phantom_express', 'derail_run'];
const CHECK = () => {
  const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss), bad = [];
  if (!b) return ['no boss'];
  if (b.railState !== 'parked') bad.push('railState ' + b.railState);
  if (b.run) bad.push('run alive');
  if (b.tell) bad.push('tell alive');
  if (b.wreck) bad.push('wreck flag');
  if (b.stunned > 0) bad.push('stunned');
  if (b.ghostLanes.length) bad.push('ghost lanes ' + b.ghostLanes.length);
  if (b.hz.some((h) => !h.done)) bad.push('coal markers alive');
  if (!b.sprite.visible) bad.push('sprite hidden');
  if (b.sprite.texture.key !== 'boss_engine_idle') bad.push('texture ' + b.sprite.texture.key);
  if (b.sprite.flipX) bad.push('flipX');
  if (Math.hypot(b.x - 720, b.y - 380) > 2) bad.push('not at park spot ' + Math.round(b.x) + ',' + Math.round(b.y));
  if (b.alphaOverride !== undefined) bad.push('alphaOverride ' + b.alphaOverride);
  if (!b.targetable) bad.push('untargetable');
  if (b.contactDamage !== 1) bad.push('contact ' + b.contactDamage);
  return bad;
};
async function fuzz() {
  const g = await boot(query(seeds[0]), { items, god: true });
  try {
    await toBoss(g); await hideCards(g);
    let n = 0;
    for (const hard of [false, true]) for (const [th, minPh] of [[0.66, 0], [0.33, 1]]) for (const atk of ATTACKS) {
      if (atk === 'phantom_express' && th === 0.66) continue; // phantom only exists from phase 1 on
      if (atk === 'derail_run' && th <= 0.66 && minPh < 1) continue; // derail only from phase 2 on
      for (const off of [0.3, 0.9, 1.5, 2.2, 3.2, 4.4, 6.0]) {
        await g.eval(([a, th, minPh]) => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); b.hp = b.maxHp; b.phase = minPh; b.invulnerable = false; s.player.hp = s.player.maxHp; s.player.teleport(720, 528); s.bullets.enemy.clear(); b.forceAttack(a); }, [atk, th, minPh]);
        await g.eval((o) => window.__ff(Math.round(o * 60)), off);
        const st = await g.eval(([th, hard]) => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); const rs = b.railState; b.hp = b.maxHp * th + (hard ? -1 : 1); if (hard) b.onHit(0); else { const r = b.takeHit(2, {}); if (r === 'ignore') { return { ignored: rs }; } } return { phase: b.phase, rs, gen: !!b.gen }; }, [th, hard]);
        if (st.ignored) { // gone / invulnerable at that instant: the engine cannot be hit -> hp write + onHit instead so the threshold still crosses
          await g.eval((th) => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); b.hp = b.maxHp * th - 1; b.onHit(0); }, th);
        }
        await g.eval(() => window.__ff(130)); // roar (1.3 s) + settle
        const bad = await g.eval(CHECK);
        const ph = await g.eval(() => window.__dw.scene.enemies.find((e) => e.isBoss).phase);
        const roaring = await g.eval(() => window.__dw.scene.enemies.find((e) => e.isBoss).invulnerable);
        if (ph < minPh + 1) bad.push('phase did not advance ' + ph);
        if (roaring) bad.push('still invulnerable after roar');
        n++;
        if (bad.length) fail(`${hard ? 'hard' : 'soft'} ${atk} @${off}s thr ${th}: ${bad.join(', ')}`);
        // keeps fighting: new attack within 8 s sim, then it must finish cleanly
        const cont = await g.eval(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); const a0 = b.lastAttack; let ok = false; window.__ff(60 * 8, null, () => (ok = !!b.gen && b.lastAttack !== a0 && b.lastAttack)); return ok; });
        if (!cont) fail(`${hard ? 'hard' : 'soft'} ${atk} @${off}s thr ${th}: no new attack within 8 s`);
      }
    }
    console.log(`fuzz: ${n} phase-change cases`);
    if (g.errors.length) { console.log('ERRORS', g.errors.slice(0, 5)); fail('console errors'); }
  } finally { try { await g.close(); } catch (e) { /* closed */ } }
}
/** lethal hit during each attack (fresh game each): all leftovers gone, reward flow reached */
async function lethal() {
  for (const atk of ATTACKS) {
    const g = await boot(query(seeds[0]), { items, god: true });
    try {
      await toBoss(g); await hideCards(g);
      await g.eval((a) => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); b.hp = b.maxHp; b.phase = 2; b.forceAttack(a); }, atk);
      await g.eval(() => window.__ff(150));
      await g.eval(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); b.invulnerable = false; b.targetable = true; b.hurt(99999, {}); });
      await g.eval(() => window.__ff(60 * 10, null, () => window.__dw.scene.room.state.cleared));
      await g.eval(() => window.__ff(30));
      const r = await g.eval(() => { const s = window.__dw.scene; const hz = s.room && s.room.hazards; return { boss: !!s.enemies.find((e) => e.isBoss), bul: s.bullets.enemy.list.filter((x) => x.active).length, lanes: hz && hz.lanes ? hz.lanes.busy : 0, groundHaz: s._groundHaz ? s._groundHaz.count : 0, ped: s.room.state.pedestals ? s.room.state.pedestals.length : 0, trap: !!s.room.state.trapdoor, cleared: !!s.room.state.cleared, heart: JSON.stringify(s.room.state.pickups || []).includes('heart_full') || (s.room.pickups || []).some((k) => /heart_full/.test(k.kind || k.id || k.key || '')) }; });
      console.log('lethal during', atk, JSON.stringify(r));
      if (r.boss) fail(`lethal during ${atk}: boss still present`);
      if (r.lanes) fail(`lethal during ${atk}: ${r.lanes} lanes alive`);
      if (r.ped !== 2 || !r.trap || !r.cleared) fail(`lethal during ${atk}: reward flow incomplete ${JSON.stringify(r)}`);
      if (r.groundHaz > 2) fail(`lethal during ${atk}: ${r.groundHaz} ground hazards alive`);
      if (g.errors.length) { console.log('ERRORS', g.errors.slice(0, 5)); fail(`lethal ${atk}: console errors`); }
    } finally { await g.close(); }
  }
}

// ------------------------------------------------------------------------------------------------ phases via api + attack list
async function phases() {
  const g = await boot(query(seeds[0]), { items, god: true });
  try {
    await toBoss(g); await hideCards(g);
    for (let ph = 0; ph < 3; ph++) {
      const info = await g.eval((ph) => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); b.hp = b.maxHp * [1, 0.65, 0.32][ph]; b.onHit(0); return { phase: b.phase, name: b.phase ? b.phases[b.phase - 1].name : 'Midnight Express', list: b.attacks.filter((a) => a.minPhase <= b.phase && a.maxPhase >= b.phase).map((a) => a.name) }; }, ph);
      console.log('phase', ph, JSON.stringify(info));
      if (info.phase !== ph) fail(`phase ${ph} not reached via api (got ${info.phase})`);
      await g.eval(() => window.__ff(130));
      for (const atk of info.list) {
        // telegraph audit: the player stands still (god mode off, on the rail row for lane attacks); no damage before 0.9 s (spec: >= 0.5 s)
        const r = await g.eval((a) => {
          const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss), p = s.player;
          const lane = /lane|phantom|derail/.test(a);
          for (const e of [...s.enemies]) if (e !== b && e.alive) e.die({ silent: true });
          p.teleport(720, lane ? 624 : 528); b.resetState(); b.gen = null; b.idleT = 99; s.bullets.enemy.clear(); window.__ff(260); // let fire patches / lanes of the previous attack burn out
          p.godMode = false; p.hp = p.maxHp; p.hurtT = 0; p.entryInv = 0; p.rolling = false;
          let t = 0; const hurt = [];
          const od = p.damage; p.damage = function (u, src) { hurt.push(+t.toFixed(2)); return false; };
          b.forceAttack(a);
          const bad = [];
          for (let i = 0; i < 60 * 14 && (b.gen || i < 5); i++) { window.__ff(1); t += 1 / 60; }
          p.damage = od; p.godMode = true;
          if (hurt.length && hurt[0] < 0.9) bad.push('damage at ' + hurt[0]);
          return { end: +t.toFixed(1), firstHurt: hurt[0] ?? null, hits: hurt.length, bad };
        }, atk);
        console.log('  ', atk, JSON.stringify(r));
        if (r.bad.length) fail(`${atk}: ${r.bad.join(', ')}`);
      }
    }
  } finally { await g.close(); }
}

// ------------------------------------------------------------------------------------------------ soak
async function soak() {
  const g = await boot(query(seeds[0]), { items, god: true });
  try {
    await toBoss(g); await hideCards(g);
    await g.eval(BOT); await g.eval((s, d) => { window.__bot.skill = s; window.__dump = d; }, skill, process.argv.includes('--dump'));
    await g.eval(() => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); b.hp = b.maxHp = 1e9; });
    // logic soak: fast-forward steps interleaved with wall-clock waits (tweens / timers of the effects run on wall time): ms per step, then a settle
    // period after which every transient effect must be gone (leak check = children / tweens back near the baseline; decals are capped by Fx)
    const cnt = () => g.eval(() => { const s = window.__dw.scene; return { ch: s.children.list.length, tw: s.tweens.getTweens().length }; });
    await g.eval(() => window.__ff(60 * 10, window.__botStep)); await g.wait(1500);
    const base = await cnt(); let stepMs = 0, steps = 0, peak = base;
    const rounds = +arg('rounds', 30);
    for (let k = 0; k < rounds; k++) {
      stepMs += await g.eval(() => { const t = performance.now(); window.__ff(120, window.__botStep); return performance.now() - t; }); steps += 120;
      await g.wait(2000);
      const c = await cnt(); if (c.ch > peak.ch) peak = c;
    }
    await g.eval(() => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); b.resetState(); b.gen = null; b.idleT = 1e9; s.bullets.enemy.clear(); s.gameInput.override = { move: { x: 0, y: 0 }, aim: null }; window.__ff(60 * 6); });
    await g.wait(6000);
    const end = await cnt();
    console.log('logic soak:', JSON.stringify({ msPerStep: +(stepMs / steps).toFixed(3), simSeconds: steps / 60, base, peak, end }));
    if (end.ch > base.ch + 80 || end.tw > base.tw + 25) fail('object growth (leak?) ' + JSON.stringify([base, end]));
    await g.eval(() => { window.__game.loop.wake(); window.__soakId = setInterval(() => window.__botStep(), 16); });
    const fps = [];
    const secs = +arg('secs', 120);
    for (let i = 0; i < secs / 2; i++) { await g.wait(2000); fps.push(await g.eval(() => Math.round(window.__game.loop.actualFps))); }
    const r = await g.eval(() => { clearInterval(window.__soakId); const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); return { stall: window.__log.stall, attacks: new Set(window.__log.attacks.map((a) => a[1])).size, boss: !!b, bul: s.bullets.enemy.list.length }; });
    const f = fps.slice(2).filter((v) => v > 0);
    console.log(`soak ${secs}s: fps min ${Math.min(...f)} avg ${Math.round(f.reduce((a, c) => a + c, 0) / Math.max(1, f.length))} stalls ${r.stall} attack kinds ${r.attacks}`);
    if (Math.min(...f) < 55) console.log('note: fps below 55 (headless software GL); use --strict-fps to enforce');
    if (process.argv.includes('--strict-fps') && Math.min(...f) < 55) fail('fps < 55');
    if (r.stall) fail('generator stall');
    if (g.errors.length) { console.log('ERRORS', g.errors.slice(0, 5)); fail('console errors'); }
  } finally { await g.close(); }
}

if (mode === 'fight' || mode === 'all') await fight();
if (mode === 'fuzz' || mode === 'all') { await fuzz(); await lethal(); }
if (mode === 'phases' || mode === 'all') await phases();
if (mode === 'soak' || mode === 'all') await soak();
console.log(failures ? `FAILED (${failures})` : 'OK');
process.exit(failures ? 1 : 0);
