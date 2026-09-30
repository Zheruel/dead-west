// QA for Ol' Scratch (floor 6, god mode OFF for fights), fast-forwarded (game.step without rendering).
//   node tools/qa/boss-scratch-bot.mjs [--mode=fight|fuzz|phases|soak|all] [--skill=0.7] [--acc=0.86 (share of frames the bot fires when lined up)] [--seeds=1..8 | --seed=11] [--max=520] [--items=hollow_point,speed_loader,snake_oil]
//                                      [--hp=6] [--start=0..3 (phase)] [--noassets] [--dropassets=40] [--quiet] [--strict-fps]
//   fight   bot fights Scratch per seed: WIN/LOSS, fight time, hearts lost per attack; SUMMARY win rate + median win time (targets 40-60 %, 150-260 s).
//   fuzz    every attack x every phase threshold x several offsets into the attack (soft = through takeHit, hard = hp write + onHit): the phase change must
//           cancel the attack cleanly (no beams / roulette / markers / spiral, form + seals right, hittable) and he keeps attacking; a skipped-phase jump; the
//           seal -> tear -> stun -> re-raise loop; a lethal hit during every attack reaches the ending with nothing left behind.
//   phases  every phase reachable (hp write + onHit), each attack of the phase forced once: telegraph >= 0.5 s check, the forced attack ends (no deadlock).
//   soak    120 s of the bot in real time (god mode): fps (headless software GL: informational unless --strict-fps), console errors, generator stalls.
import { boot, toBoss, hideCards } from './boss-scratch-lib.mjs';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const mode = arg('mode', 'fight'), skill = +arg('skill', 0.7), acc = +arg('acc', 0.86), maxSim = +arg('max', 520), quiet = process.argv.includes('--quiet');
const items = arg('items', 'hollow_point,speed_loader,snake_oil').split(',').filter(Boolean);
const hearts = +arg('hp', 0), startPhase = +arg('start', 0);
const seedArg = arg('seeds', arg('seed', '11'));
const seeds = /^(\d+)\.\.(\d+)$/.test(seedArg) ? Array.from({ length: +RegExp.$2 - +RegExp.$1 + 1 }, (_, i) => +RegExp.$1 + i) : seedArg.split(',').map(Number);
const query = (seed) => `?debug=1&seed=${seed}${process.argv.includes('--noassets') ? '&noassets=1' : ''}${arg('dropassets', '') ? `&dropassets=${arg('dropassets')}` : ''}`;
let failures = 0;
const fail = (m) => { failures++; console.log('FAIL', m); };

// ------------------------------------------------------------------------------------------------ in-page bot
// Each frame: score 17 candidate moves (stay + 16 headings, 0.3 s of walking) against every live hazard (ground circles, fire, beams, roulette tiles,
// Hold 'Em markers, bullets projected 0.1 / 0.2 / 0.3 s ahead) and walk to the cheapest; stand on a firing line below the current target; roll when hit is imminent.
const BOT = () => {
  const log = (window.__log = { hurt: [], attacks: [], phases: [], t0: null, rolls: 0, shots: 0, byAtk: {}, stall: 0 });
  window.__bot = { skill: 0.7, acc: 0.92, seed: 1 };
  let rs = 0;
  const rnd = () => { rs = (rs + 0x6d2b79f5) | 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // seeded: a run is reproducible
  let lastAtk = '', lastPhase = -1, wrapped = null, lastGenT = 0, lastState = '', wig = 0, wigT = 0;
  window.__botSeed = (v) => { rs = v * 7919; };
  const ROULETTE_TELL = 1.0;
  const DIRS = [];
  for (let i = 0; i < 16; i++) DIRS.push([Math.cos((i / 16) * Math.PI * 2), Math.sin((i / 16) * Math.PI * 2)]);
  const distSeg = (px, py, ox, oy, a, hw) => {
    const c = Math.cos(a), s = Math.sin(a), dx = px - ox, dy = py - oy, t = dx * c + dy * s;
    if (t < -hw) return 1e9;
    return Math.abs(-dx * s + dy * c);
  };
  window.__botStep = () => {
    const sc = window.__dw && window.__dw.scene; if (!sc) return;
    const p = sc.player; const b = sc.enemies.find((e) => e.isBoss);
    if (p !== wrapped) { wrapped = p; const od = p.damage.bind(p); p.damage = (u, src) => { const r = od(u, src); if (r) { const k = (src && (src.kind || src.enemyName)) || '?'; const who = src && (src.enemyName || (src.owner && src.owner.id) || src.id); log.hurt.push([+(p.time - (log.t0 || 0)).toFixed(1), u, k + (who ? '/' + who : ''), b ? b.lastAttack : '', Math.round(p.x) + ',' + Math.round(p.y), b ? Math.round(b.x) + ',' + Math.round(b.y) : '']); const a = b ? b.lastAttack : '?'; log.byAtk[a] = (log.byAtk[a] || 0) + u; } return r; }; }
    if (!p || p.dead || !b || !b.alive || !b.active || b.dying) { sc.gameInput.override = { move: { x: 0, y: 0 }, aim: null }; return; }
    if (log.t0 == null) log.t0 = p.time;
    const T = +(p.time - log.t0).toFixed(1);
    if (b.lastAttack !== lastAtk) { lastAtk = b.lastAttack; log.attacks.push([T, lastAtk, Math.round(b.hp)]); }
    if (b.phase !== lastPhase) { lastPhase = b.phase; log.phases.push([T, b.phase, Math.round(b.hp)]); }
    const st = b.gen ? b.lastAttack + b.phase : ''; if (st !== lastState) { lastState = st; lastGenT = p.time; } else if (st && p.time - lastGenT > 30) { log.stall++; lastGenT = p.time; }
    const sk = window.__bot.skill;
    const react = 0.2 + (1 - sk) * 0.5;
    wigT -= 1 / 60; if (wigT <= 0) { wig = (rnd() - 0.5) * 140; wigT = 1 + rnd() * 1.5; }

    // ---- hazard snapshot
    const circles = []; // {x,y,r}
    const gh = sc._groundHaz;
    if (gh) for (const h of gh.list) { if (h.done || h.shape !== 'circle' || h.t < Math.min(react, h.tell * 0.6)) continue; circles.push({ x: h.x, y: h.y, r: h.r + 28, arm: Math.max(0, h.tell - h.t) }); }
    const fires = sc.room && sc.room._hz && sc.room._hz.fires && sc.room._hz.fires.order;
    if (fires) for (const f of fires) if (f.team !== 'player' && f.active !== false) circles.push({ x: f.x, y: f.y, r: f.r + 24, arm: 0 });
    if (b.holdem) for (const m of b.holdem.m) if (m.on) circles.push({ x: m.x, y: m.y, r: 96, arm: 0 });
    const beams = [];
    for (const set of [b.beams, ...(b.holdem ? b.holdem.sets : [])]) {
      if (!set || set.state === 'off' || (set.state === 'tell' && set.t < react)) continue;
      for (let i = 0; i < set.n; i++) beams.push({ ox: set.ox, oy: set.oy, a: set.ang[i], rate: set.rate[i], rem: set.state === 'tell' ? set.tell - set.t : 0, hw: set.w / 2 + 16 });
    }
    const rz = b.roulette, roul = rz && rz.state !== 'idle' && (rz.state === 'zap' || rz.t > react * 0.5) ? rz : null;
    const bl = [];
    for (const q of sc.bullets.enemy.list) if (q.active) bl.push(q);
    const adds = [];
    for (const e of sc.enemies) if (e !== b && e.alive && e.id !== 'contract_seal') adds.push(e);

    const danger = (x, y, t, hot) => {
      let d = 0;
      for (const c of circles) { if (hot && t < c.arm - 0.03) continue; const dx = x - c.x, dy = y - c.y; if (dx * dx + dy * dy < c.r * c.r) d += 1; }
      for (const s of beams) { if (hot && t < s.rem - 0.03) continue; const a = s.a + s.rate * Math.max(0, t - s.rem); if (distSeg(x, y, s.ox, s.oy, a, s.hw) < s.hw) d += 1; }
      if (roul && (!hot || roul.state === 'zap' || t >= ROULETTE_TELL - roul.t - 0.03) && roul.onTile(x, y, 14)) d += 1;
      for (const q of bl) {
        const bx = q.x + q.vx * t, by = q.y + q.vy * t, rr = (q.radius || 12) + 24, dx = x - bx, dy = y - by;
        if (dx * dx + dy * dy < rr * rr) d += 0.8;
      }
      return d;
    };
    const TS = [0.08, 0.16, 0.24, 0.32, 0.42, 0.55];
    // cost of walking along (dx,dy) at `spd` px per 0.3 s: sample the path over time
    const pathCost = (dx, dy) => {
      let d = 0;
      for (let i = 0; i < TS.length; i++) {
        const t = TS[i], k = Math.min(1, t / 0.3);
        d += 3 * danger(p.x + dx * k, p.y + dy * k, t) * (1 - i * 0.1);
      }
      const qx = p.x + dx, qy = p.y + dy;
      if (beams.length) { const r = Math.hypot(qx - beams[0].ox, qy - beams[0].oy); if (r > 330) d += (r - 330) / 60; else if (r < 250) d += (250 - r) / 60; } // gaps sweep faster than a walk far out, and close up near the hub
      for (const e of adds) { const ex = qx - e.x, ey = qy - e.y; if (ex * ex + ey * ey < 140 * 140) d += 0.5 * sk; }
      if (b.contactDamage > 0 && !b.dying) { const ex = qx - b.x, ey = qy - b.y, rr = b.hitRadius + 70; if (ex * ex + ey * ey < rr * rr) d += 1.2; }
      return d;
    };

    // ---- target + firing line
    let tgt = null, nd = 1e9;
    if (b.contractUp) { for (const e of b.seals) if (e.alive) { const dd = Math.hypot(e.x - p.x, e.y - p.y); if (dd < nd) { nd = dd; tgt = e; } } }
    else { for (const e of adds) { const dd = Math.hypot(e.x - p.x, e.y - p.y); if (dd < nd && dd < 460) { nd = dd; tgt = e; } } }
    if (!tgt) tgt = b;
    let gx, gy;
    if (tgt.y + 340 <= 820) { gx = tgt.x + wig * 0.3; gy = tgt.y + 340; } else { gx = tgt.x + (p.x < tgt.x ? -260 : 260); gy = tgt.y; }
    gx = Math.max(200, Math.min(1240, gx)); gy = Math.max(280, Math.min(800, gy));

    // ---- pick a move
    const spd = 0.3 * (p.stats && p.stats.moveSpeed ? p.stats.moveSpeed : 320);
    const W = 0.0004 * 60;
    let best = null, pc0 = pathCost(0, 0), bc = pc0 + W * Math.hypot(gx - p.x, gy - p.y), bpc = pc0;
    let bx = 0, by = 0;
    for (const d of DIRS) {
      const qx = p.x + d[0] * spd, qy = p.y + d[1] * spd;
      if (qx < 96 + 50 || qx > 1344 - 50 || qy < 192 + 50 || qy > 864 - 50) continue;
      const pc = pathCost(d[0] * spd, d[1] * spd), c = pc + W * Math.hypot(gx - qx, gy - qy);
      if (c < bc) { bc = c; bpc = pc; best = d; }
    }
    if (best) { bx = best[0]; by = best[1]; }
    const imminent = danger(p.x, p.y, 0.06, true) + danger(p.x, p.y, 0.14, true) * 0.7;
    // ---- shoot (4-way like the real game)
    const tx = tgt.x - p.x, ty = tgt.y - p.y;
    let aim = null;
    const R = (tgt.hitRadius || 40) * 0.85;
    if (Math.abs(tx) > Math.abs(ty)) { if (Math.abs(ty) < R) aim = { x: Math.sign(tx), y: 0 }; }
    else if (Math.abs(tx) < R) aim = { x: 0, y: Math.sign(ty) };
    if (tgt === b && (b.invulnerable || !b.targetable || b.alphaOverride > 0.4)) aim = null;
    if (rnd() > window.__bot.acc) aim = null;
    if (aim) log.shots++;
    sc.gameInput.override = { move: { x: bx, y: by }, aim };
    if (imminent > 0.6 && bpc > 1.5 && p.rollCd <= 0 && !p.rolling && rnd() < sk * 0.8) { sc.gameInput.press('roll'); log.rolls++; }
  };
};

const done = (r) => r.dead || r.bhp == null || r.dying || r.ending;
const stepRes = () => {
  window.__ff(600, window.__botStep, () => { const s = window.__dw.scene; return s.player.dead || s.endingStarted || (s.enemies.find((e) => e.isBoss) || {}).dying; });
  const s = window.__dw.scene; const b = s.enemies.find((e) => e.isBoss); const p = s.player;
  return { bhp: b ? Math.round(b.hp) : null, ph: b && b.phase, php: p.hp + '/' + p.maxHp, dead: p.dead, gt: +(p.time - (window.__log.t0 || 0)).toFixed(1), n: s.enemies.length, bul: s.bullets.enemy.list.length, dying: b && b.dying, ending: !!s.endingStarted, up: b && b.contractUp };
};

// ------------------------------------------------------------------------------------------------ fight
async function fight() {
  const results = [];
  for (const seed of seeds) {
    const g = await boot(query(seed), { items, god: false });
    try {
      await toBoss(g); await hideCards(g);
      await g.eval(([sp, hp]) => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); if (sp > 0) { b.hp = b.maxHp * [1, 0.69, 0.39, 0.14][sp]; b.onHit(0); } if (hp) { s.player.stats.maxHearts = hp; s.player.hp = hp * 2; } }, [startPhase, hearts]);
      await g.eval(BOT); await g.eval(([s, sd, ac]) => { window.__bot.skill = s; window.__bot.acc = ac; window.__botSeed(sd); }, [skill, seed, acc]);
      const t0 = Date.now();
      let simT = 0, res;
      while (simT < maxSim) {
        res = await g.eval(stepRes);
        simT += 10;
        if (!quiet) console.log(seed, JSON.stringify(res));
        if (done(res)) break;
      }
      const log = await g.eval(() => window.__log);
      const win = !res.dead && (res.bhp == null || res.dying || res.ending);
      results.push({ seed, win, time: res.gt, php: res.php });
      console.log(`seed ${seed}: ${win ? 'WIN' : 'LOSS'} t=${res.gt}s hp=${res.php} boss=${res.bhp} phase=${res.ph} rolls=${log.rolls} shots=${log.shots} stalls=${log.stall} real=${((Date.now() - t0) / 1000) | 0}s dmgByAttack=${JSON.stringify(log.byAtk)} bySrc=${JSON.stringify(log.hurt.reduce((o, h) => { o[h[2]] = (o[h[2]] || 0) + h[1]; return o; }, {}))}`);
      if (!quiet) console.log('phases', JSON.stringify(log.phases));
      if (!quiet && !win) console.log(JSON.stringify(log.hurt.slice(-8)));
      if (log.stall) fail(`seed ${seed}: generator stall`);
      if (g.errors.length) { console.log('ERRORS', g.errors.slice(0, 5)); fail(`seed ${seed}: console errors`); }
    } finally { await g.close(); }
  }
  const w = results.filter((r) => r.win), ts = w.map((r) => r.time).sort((a, b) => a - b);
  const rate = Math.round((100 * w.length) / Math.max(1, results.length)), med = ts.length ? (ts.length % 2 ? ts[ts.length >> 1] : (ts[ts.length / 2 - 1] + ts[ts.length / 2]) / 2) : NaN;
  console.log(`SUMMARY skill=${skill} win ${w.length}/${results.length} (${rate} %) median win time ${Number.isNaN(med) ? '-' : med} s  targets: win 40-60 %, median 150-260 s`);
  if (seeds.length >= 8 && (rate < 40 || rate > 60)) fail(`win rate ${rate} % outside 40-60 %`);
  if (ts.length && (med < 150 || med > 260)) fail(`median win time ${med} s outside 150-260 s`);
}

// ------------------------------------------------------------------------------------------------ fuzz: phase change mid-attack
const ATTACKS = ['deal_fan', 'card_ring', 'chip_toss', 'roulette_call', 'chandelier_rain', 'royal_flush', 'hold_em', 'hellfire_spiral', 'brimstone_grid'];
const THR = [0.7, 0.4, 0.15];
/** Full stage reset for a fuzz case: phase `ti` as if reached normally (form, corner fires, seals, paper), no attack running. */
const STAGE = (ti) => {
  const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss);
  b.resetState();
  for (const sl of b.seals) if (sl && sl.alive) { sl.alive = false; sl.destroy(); }
  b.seals.length = 0; b.contractUp = false; if (b.paper) b.paper.hide();
  b.hp = b.maxHp; b.phase = ti; b.cornersOn = ti >= 2; b.swapForm(ti >= 2);
  const hz = s.room && s.room._hz; if (hz && hz.fires) hz.fires.clear();
  s.player.hp = s.player.maxHp; s.player.teleport(720, 700); s.bullets.enemy.clear();
};
/** Right after a phase interrupt: nothing of the old attack may still be running. */
const CLEAN = () => {
  const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss), bad = [];
  if (!b.beams.done) bad.push('beams alive');
  if (!b.roulette.done) bad.push('roulette alive');
  if (!b.holdem.done) bad.push('hold em markers alive');
  if (b.spiral.on) bad.push('spiral running');
  if (b.haz.some((h) => h && !h.done)) bad.push('hazards alive');
  if (b.lines.some((l) => l && l.active)) bad.push('telegraph lines alive');
  if (b.stunned > 0) bad.push('stunned');
  if (b.fade.dir || b.fade.k) bad.push('fading');
  return bad;
};
/** Once a phase's intro is over: the state it must be in. */
const CHECK = (ph) => {
  const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss), bad = [];
  if (!b) return ['no boss'];
  if (b.phase !== ph) bad.push('phase ' + b.phase + ' want ' + ph);
  if (b.lastAttack !== 'vanish') {
    if (b.alphaOverride !== undefined) bad.push('alphaOverride ' + b.alphaOverride);
    if (!b.targetable) bad.push('untargetable');
    if (b.invulnerable) bad.push('invulnerable');
  }
  if (!b.sprite.visible) bad.push('sprite hidden');
  const devil = ph >= 2;
  if ((b.formKey === 'scratch_true') !== devil) bad.push('form ' + b.formKey);
  if (b.contractUp !== (ph === 3)) bad.push('contractUp ' + b.contractUp);
  if (b.seals.length !== (ph === 3 ? 3 : 0)) bad.push('seals ' + b.seals.length);
  if (ph >= 2 && !b.cornersOn) bad.push('no corner fires');
  if (ph < 2 && b.cornersOn) bad.push('corner fires early');
  if (ph < 3 && b.paper.visible) bad.push('paper visible');
  return bad;
};
async function fuzz() {
  const g = await boot(query(seeds[0]), { items, god: true });
  try {
    await toBoss(g); await hideCards(g);
    let n = 0;
    for (const hard of [false, true]) for (let ti = 0; ti < 3; ti++) for (const atk of ATTACKS) {
      const th = THR[ti];
      const ok = await g.eval(([a, ti]) => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); const w = b.attacks.find((x) => x.name === a); return w.minPhase <= ti && w.maxPhase >= ti; }, [atk, ti]);
      if (!ok) continue;
      for (const off of [0.2, 0.7, 1.4, 2.2, 3.4, 5.0]) {
        if (hard === false && ti === 2) continue; // phase 3: the contract reflects hits (soft hits cannot cross the threshold there: 3 -> covered by hard)
        await g.eval(STAGE, ti);
        await g.eval((a) => window.__dw.scene.enemies.find((e) => e.isBoss).forceAttack(a), atk);
        await g.eval((o) => window.__ff(Math.round(o * 60)), off);
        await g.eval(([th, hard]) => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); b.hp = b.maxHp * th + 1; if (hard) { b.hp = b.maxHp * th - 1; b.onHit(0); } else if (b.takeHit(2, {}) === 'ignore') { b.hp = b.maxHp * th - 1; b.onHit(0); } }, [th, hard]);
        const dirty = await g.eval(CLEAN);
        await g.eval(() => window.__ff(60 * 6)); // roar / transform / seals raise + settle
        const bad = dirty.concat(await g.eval(CHECK, ti + 1));
        n++;
        if (bad.length) fail(`${hard ? 'hard' : 'soft'} ${atk} @${off}s thr ${th}: ${bad.join(', ')}`);
        const cont = await g.eval(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); const a0 = b.lastAttack; let ok = false; window.__ff(60 * 10, null, () => (ok = !!b.gen && b.lastAttack !== a0 && !!b.lastAttack)); return ok; });
        if (!cont) fail(`${hard ? 'hard' : 'soft'} ${atk} @${off}s thr ${th}: no new attack within 10 s`);
      }
    }
    console.log(`fuzz: ${n} phase-change cases`);

    // skipped phases: one huge hit from full hp lands in the last phase cleanly
    for (const [from, hp] of [[0, 0.1], [0, 0.3], [1, 0.1], [0, 0.5]]) {
      await g.eval(STAGE, 0);
      await g.eval(([from, hp]) => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); b.forceAttack('deal_fan'); if (from) { b.hp = b.maxHp * 0.6; b.onHit(0); window.__ff(60 * 6); } window.__ff(30); b.hp = b.maxHp * hp; b.onHit(0); }, [from, hp]);
      await g.eval(() => window.__ff(60 * 7));
      const want = hp < 0.15 ? 3 : hp < 0.4 ? 2 : 1;
      const bad = await g.eval(CHECK, want);
      console.log(`skip from ${from} to hp ${hp}: ${bad.length ? bad.join(', ') : 'ok'}`);
      if (bad.length) fail(`skip to hp ${hp}: ${bad.join(', ')}`);
    }

    // seals: tear -> stun 7 s (x1.5 damage) -> re-raise with 45 hp seals, repeatedly
    await g.eval(STAGE, 2);
    await g.eval(() => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); b.hp = b.maxHp * 0.12; b.onHit(0); window.__ff(60 * 5); });
    for (let cycle = 0; cycle < 3; cycle++) {
      const r = await g.eval(() => {
        const b = window.__dw.scene.enemies.find((e) => e.isBoss); const o = { up: b.contractUp, seals: b.seals.length, hp: b.seals.map((x) => x.maxHp) };
        const hp0 = b.hp; b.hit = 0; b.takeHit(50, {}); o.reflected = b.hp === hp0; // contract up: hits bounce
        while (b.seals.length) b.seals[0].die();
        window.__ff(60);
        o.stun = +b.stunned.toFixed(1); o.mult = b.damageMultiplier();
        const h1 = b.hp; b.takeHit(10, { x: b.x, y: b.y }); o.dmg = +(h1 - b.hp).toFixed(1);
        window.__ff(60 * 9);
        o.upAgain = b.contractUp; o.sealsAgain = b.seals.length; o.hpAgain = b.seals.map((x) => x.maxHp);
        return o;
      });
      console.log('seal cycle', cycle, JSON.stringify(r));
      if (!r.up || r.seals !== 3) fail(`seal cycle ${cycle}: contract not up with 3 seals (${r.up}, ${r.seals})`);
      if (!r.reflected) fail(`seal cycle ${cycle}: hit was not reflected`);
      if (r.stun < 5) fail(`seal cycle ${cycle}: stun ${r.stun}`);
      if (r.mult !== 1.5) fail(`seal cycle ${cycle}: damage multiplier ${r.mult}`);
      if (!r.upAgain || r.sealsAgain !== 3 || r.hpAgain.some((h) => h !== 45)) fail(`seal cycle ${cycle}: re-raise wrong ${JSON.stringify(r)}`);
    }
    if (g.errors.length) { console.log('ERRORS', g.errors.slice(0, 5)); fail('console errors'); }
  } finally { try { await g.close(); } catch (e) { /* closed */ } }
}

/** lethal hit during each attack (fresh game each; both modes for one): all leftovers gone, ending reached */
async function lethal() {
  for (const [atk, hell] of [...ATTACKS.map((a) => [a, false]), ['hellfire_spiral', true]]) {
    const g = await boot(query(seeds[0]) + (hell ? '&mode=hell' : ''), { items, god: true });
    try {
      await toBoss(g); await hideCards(g);
      await g.eval((a) => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); b.hp = b.maxHp * 0.1; b.phase = 2; b.onHit(0); window.__ff(60 * 5); b.contractUp || 0; b.forceAttack(a); window.__ff(100); }, atk);
      await g.eval(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); while (b.seals.length) b.seals[0].die(); window.__ff(90); b.forceAttack('hellfire_spiral'); window.__ff(60); b.hp = 5; b.invulnerable = false; b.targetable = true; b.takeHit(99999, { x: b.x, y: b.y }); });
      await g.eval(() => window.__ff(60 * 10, null, () => window.__dw.scene.endingStarted));
      await g.eval(() => window.__ff(20));
      const r = await g.eval(() => { const s = window.__dw.scene; const b = s.enemies.find((e) => e.isBoss); return { boss: !!b, ending: !!s.endingStarted, trueFinale: !!s.trueFinaleStarted, kneel: !!(b && b.alive && b.sprite && b.kneel), bul: s.bullets.enemy.list.filter((x) => x.active).length, gh: s._groundHaz ? s._groundHaz.list.filter((h) => !h.done).length : 0, foes: s.enemies.length, page: !!s.contractPage }; });
      console.log('lethal during', atk, hell ? '(hell)' : '', JSON.stringify(r));
      if (!r.ending) fail(`lethal during ${atk}: ending not reached`);
      if (r.boss !== hell) fail(`lethal during ${atk}: boss ${r.boss ? 'still' : 'not'} in the enemy list (hell keeps the kneeling boss for the finale)`);
      if (hell && !r.kneel) fail('hell lethal: boss is not kneeling alive with his sprite');
      if (r.gh) fail(`lethal during ${atk}: ${r.gh} ground hazards alive`);
      if (r.foes !== (hell ? 1 : 0)) fail(`lethal during ${atk}: ${r.foes} enemies left`);
      if (hell !== r.trueFinale) fail(`lethal ${atk}: trueFinaleStarted ${r.trueFinale}`);
      if (g.errors.length) { console.log('ERRORS', g.errors.slice(0, 5)); fail(`lethal ${atk}: console errors`); }
    } finally { await g.close(); }
  }
}

// ------------------------------------------------------------------------------------------------ phases + attack list + telegraph audit
async function phases() {
  const g = await boot(query(seeds[0]), { items, god: true });
  try {
    await toBoss(g); await hideCards(g);
    for (let ph = 0; ph < 4; ph++) {
      const info = await g.eval((ph) => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); b.resetState(); b.hp = b.maxHp * [1, 0.69, 0.39, 0.14][ph]; if (ph) b.onHit(0); return { phase: b.phase, list: b.attacks.filter((a) => a.minPhase <= b.phase && a.maxPhase >= b.phase).map((a) => a.name) }; }, ph);
      console.log('phase', ph, JSON.stringify(info));
      if (info.phase !== ph) fail(`phase ${ph} not reached (got ${info.phase})`);
      await g.eval(() => window.__ff(60 * 6));
      for (const atk of info.list) {
        const r = await g.eval((a) => {
          const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss), p = s.player;
          const hurt = [], who1 = []; const od = p.damage; let t = 0; p.godMode = false; p.damage = function (u, src) { hurt.push(+t.toFixed(2)); who1.push((src && (src.kind || '?')) + '/' + (src && src.enemyName)); return false; };
          b.resetState(); for (const e of [...s.enemies]) if (e !== b && e.id === 'card_shark') { e.alive = false; e.destroy(); } // the shark adds are not part of the audit
          s.bullets.enemy.clear(); if (s._groundHaz) s._groundHaz.clear(); const hz = s.room && s.room._hz; if (hz && hz.fires) { hz.fires.clear(); if (b.cornersOn) b.cornerT = 0; } // leftovers of the previous attack
          window.__ff(30); p.teleport(720, 720); b.forceAttack(a);
          const bad = [];
          let i = 0;
          for (; i < 60 * 30 && (b.gen || i < 5); i++) { window.__ff(1); t += 1 / 60; if (t < 0.5 && hurt.length) { bad.push('damage at ' + t.toFixed(2)); break; } }
          p.damage = od; p.godMode = true;
          if (i >= 60 * 30) bad.push('did not end in 30 s');
          return { end: +t.toFixed(1), firstHurt: hurt[0] ?? null, by: who1[0], bad };
        }, atk);
        console.log('  ', atk, JSON.stringify(r));
        if (r.bad.length) fail(`phase ${ph} ${atk}: ${r.bad.join(', ')}`);
      }
    }
    if (g.errors.length) { console.log('ERRORS', g.errors.slice(0, 5)); fail('console errors'); }
  } finally { await g.close(); }
}

// ------------------------------------------------------------------------------------------------ soak
async function soak() {
  const g = await boot(query(seeds[0]), { items, god: true });
  try {
    await toBoss(g); await hideCards(g);
    await g.eval(BOT); await g.eval((s) => { window.__bot.skill = s; }, skill);
    await g.eval(() => { const s = window.__dw.scene, b = s.enemies.find((e) => e.isBoss); b.hp = b.maxHp = 1e9; window.__game.loop.wake(); window.__soakId = setInterval(() => window.__botStep(), 16); });
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
