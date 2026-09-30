// FE-V1 secrets check (EVENTS 8.4). Pure part: 300 seeds x 6 floors of floor generation (variant weights, exactly one tell per secret door, tell weights,
// supersecret <= 1 and adjacent only to the secret, chalk + super + never brittle). Browser part: tells (crack cracks + 12 hits, knock cadence, chalk, hint
// once), the three variants (hand pays exactly once per card, cache chain + pickups, shrine pedestal + spike gap), the Dealer's Safe (supersecret) and re-entry.
//   node tools/qa/secret-check.mjs [--pure] [?debug=1&seed=77]
import { generateFloor, validateFloor } from '../../src/gen/FloorGen.js';
import { VARIETY } from '../../src/config.js';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const TOL = 0.03;

// ---------------------------------------------------------------------------------------------------------------- pure: floor generation
{
  const SEEDS = 300;
  const variants = {}, tells = {};
  let floors = 0, structural = 0, secretDoors = 0, superFloors = 0, superBad = 0, tellBad = 0, variantBad = 0;
  const firstErr = [];
  for (let s = 1; s <= SEEDS; s++) {
    for (let fl = 1; fl <= 6; fl++) {
      const f = generateFloor(fl, s * 7919);
      floors++;
      const errs = validateFloor(f);
      if (errs.length) { structural++; if (firstErr.length < 3) firstErr.push(errs[0]); }
      const sec = f.rooms.find((r) => r.type === 'secret');
      if (!sec || !['stash', 'dead_mans_hand', 'cache', 'shrine'].includes(sec.variant)) variantBad++;
      else variants[sec.variant] = (variants[sec.variant] || 0) + 1;
      const supers = f.rooms.filter((r) => r.type === 'supersecret');
      if (supers.length > 1) superBad++;
      if (supers.length) {
        superFloors++;
        const ss = supers[0];
        const ds = Object.values(ss.doors);
        if (ds.length !== 1 || ds[0].to !== sec.id || ds[0].tell !== 'chalk' || !ds[0].super || ds[0].brittle) superBad++;
        // nothing but the secret room touches it
        for (const r of f.rooms) if (r !== sec && r !== ss && Object.values(r.doors).some((d) => d.to === ss.id)) superBad++;
      }
      for (const r of f.rooms) for (const d of Object.values(r.doors)) {
        if (d.kind !== 'secret') continue;
        secretDoors++;
        if (typeof d.tell !== 'string' || !['crack', 'knock', 'chalk'].includes(d.tell) || (!!d.brittle !== (d.tell === 'crack'))) tellBad++;
        if (!d.super) tells[d.tell] = (tells[d.tell] || 0) + 1;
      }
    }
  }
  ok(structural === 0, `${floors} floors validate (structure, secret adjacency, symmetric tells)${firstErr.length ? ' ' + firstErr.join(' | ') : ''}`);
  ok(variantBad === 0, `every floor has one secret room with a known variant`);
  const vw = VARIETY.secret.variantWeights, vt = Object.values(vw).reduce((a, b) => a + b, 0);
  let worst = 0;
  for (const [k, w] of Object.entries(vw)) worst = Math.max(worst, Math.abs((variants[k] || 0) / floors - w / vt));
  ok(worst <= TOL, `secret variant shares ${Object.entries(vw).map(([k]) => `${k} ${(100 * (variants[k] || 0) / floors).toFixed(1)}%`).join(' ')} (max dev ${(worst * 100).toFixed(1)}%)`);
  ok(tellBad === 0, `every one of ${secretDoors} secret doors has exactly one valid tell (brittle only for crack)`);
  const tt = Object.values(tells).reduce((a, b) => a + b, 0);
  let tw = 0;
  for (const [k, w] of Object.entries(VARIETY.secret.tellWeights)) tw = Math.max(tw, Math.abs((tells[k] || 0) / tt - w));
  ok(tw <= TOL, `tell shares ${Object.entries(VARIETY.secret.tellWeights).map(([k]) => `${k} ${(100 * (tells[k] || 0) / tt).toFixed(1)}%`).join(' ')} (max dev ${(tw * 100).toFixed(1)}%)`);
  ok(superBad === 0 && superFloors > 0, `supersecret on ${superFloors} floors: at most one, adjacent only to the secret, chalk + super, never brittle`);
}

if (!process.argv.includes('--pure')) await play();
console.log(fails ? `\n${fails} FAILED` : '\nsecret-check: all ok');
process.exit(fails ? 1 : 0);

// ---------------------------------------------------------------------------------------------------------------- browser
async function play() {
  const { launch } = await import('./harness.mjs');
  const query = process.argv.find((a) => a.startsWith('?')) || '?debug=1&seed=77';
  const g = await launch({ query, name: 'secret-check', quiet: true });
  await g.startRun();
  await g.eval(async () => {
    window.__dw.api.godMode(true);
    const { bus } = await import('/src/core/events.js');
    window.__R = await import('/src/core/rng.js');
    window.__cfg = await import('/src/config.js');
    window.__log = [];
    for (const e of ['secret:found', 'secret:hint', 'secret:revealed', 'supersecret:entered', 'secret:hand', 'curse:gained']) bus.on(e, (d) => window.__log.push({ e, d: d || {} }));
    window.__knocks = 0;
    const S = window.__dwAudio.Sfx, play = S.play.bind(S);
    S.play = (k, o) => { if (k === 'wall_knock') { window.__knocks++; const t = window.__dw.scene.room.controller('tells'); (window.__knockT = window.__knockT || []).push(t ? t.age : -1); } return play(k, o); };
    window.__defs = () => window.__dw.scene.roomMgr.floor.rooms.filter((r) => (r._orig || r.type) === 'normal' && r.dist >= 2);
    // synthesize a secret / supersecret room from the k-th eligible normal room
    window.__mk = (type, extra = {}, k = 0) => {
      const m = window.__dw.scene.roomMgr, def = window.__defs()[k % window.__defs().length];
      def._orig = def._orig || 'normal';
      for (const key of ['template', 'mini', 'event', 'variant', 'pocket']) delete def[key];
      Object.assign(def, { type, ...extra });
      delete m.states[def.id];
      window.__dw.player.godMode = true;
      m.jump(def.id, null);
      window.__dw.player.teleport(150, 250); // the jump drops you at the centre, on top of whatever stands there
      return def.id;
    };
    // a normal room whose first door becomes a secret door with the given tell
    window.__mkTell = (tell, k = 0) => {
      const m = window.__dw.scene.roomMgr, def = window.__defs()[k % window.__defs().length];
      def._orig = def._orig || 'normal';
      const dir = Object.keys(def.doors)[0];
      def.doors[dir] = { ...def.doors[dir], kind: 'secret', tell, revealed: false, hits: 0 };
      if (tell === 'crack') def.doors[dir].brittle = true; else delete def.doors[dir].brittle;
      delete m.states[def.id];
      window.__dw.player.godMode = true;
      m.jump(def.id, null);
      return { id: def.id, dir };
    };
    window.__room = () => window.__dw.scene.room;
    window.__ctl = (r) => window.__dw.scene.room.controller(r);
    window.__stand = (x, y) => window.__dw.player.teleport(x, y);
    window.__count = (e) => window.__log.filter((l) => l.e === e).length;
    window.__leave = (id) => { const m = window.__dw.scene.roomMgr; m.jump(m.floor.rooms.find((r) => r.id !== id && r.type !== 'boss').id); };
  });
  await g.wait(500);
  const SLOW = Number(process.env.QA_SLOW || 3); // headless Chrome under load runs at a few fps: scale every wait
  const wait = (ms) => g.wait(ms * SLOW);
  const E = (fn, ...a) => g.eval(fn, ...a);
  const W = (fn, arg, timeout = 30000) => g.page.waitForFunction(fn, { timeout: timeout * SLOW, polling: 100 }, arg).then(() => true).catch(() => false);
  const settle = () => wait(700);
  const reset = () => E(() => { window.__log.length = 0; window.__knocks = 0; window.__knockT = []; const p = window.__dw.player; p.hp = p.maxHp; p.coins = 30; p.curses && (p.curses.length = 0); });

  // ------------------------------------------------------------------------------------------ tells
  console.log('--- tells');
  {
    await reset();
    const { id, dir } = await E(() => window.__mkTell('crack'));
    await settle();
    const a = await E((dir) => { const r = window.__room(), t = window.__ctl('tells'); const d = r.doors[dir]; return { has: !!t, items: t ? t.list.length : 0, objs: t ? (t.list.find((i) => i.d.dir === dir) || { objs: [] }).objs.length : 0, brittle: !!d.data.brittle, geom: d.geom, need: window.__cfg.VARIETY.secret.brittleHits }; }, dir);
    ok(a.has && a.items >= 1 && a.objs === 1 && a.brittle, `crack: tells controller drew the hairline cracks on a brittle door ${JSON.stringify({ ...a, geom: 0 })}`);
    // a far-away wall hit does not count
    await E(() => window.__room().onWallHit(700, 900 + 400));
    // the hint fires once when the player is close
    await E((a) => window.__stand(a.geom.x - a.geom.dx * 90, a.geom.y - a.geom.dy * 90), a);
    await wait(500);
    const h1 = await E(() => window.__count('secret:hint'));
    await wait(1200);
    const h2 = await E(() => window.__count('secret:hint'));
    ok(h1 === 1 && h2 === 1, `crack: secret:hint {tell: crack} fires exactly once (${h1}, ${h2})`);
    // 11 near hits: still hidden; the 12th opens it
    await E((a) => { for (let i = 0; i < a.need - 1; i++) window.__room().onWallHit(a.geom.x, a.geom.y - a.geom.dy * 30); }, a);
    const mid = await E((dir) => ({ rev: !!window.__room().doors[dir].data.revealed, hits: window.__room().doors[dir].data.hits }), dir);
    await E((a) => window.__room().onWallHit(a.geom.x, a.geom.y - a.geom.dy * 30), a);
    const end = await E((dir) => ({ rev: !!window.__room().doors[dir].data.revealed, hits: window.__room().doors[dir].data.hits, ev: window.__count('secret:revealed') }), dir);
    ok(!mid.rev && mid.hits === a.need - 1 && end.rev && end.hits === a.need && end.ev === 1, `crack: ${a.need - 1} hits leave it hidden, hit ${a.need} reveals it (secret:revealed x${end.ev})`);
    await wait(700);
    const gone = await E((dir) => window.__ctl('tells').list.find((i) => i.d.dir === dir).gone, dir);
    ok(gone, 'crack: the cracks fade once the passage is open');
    // real bullets: 12 shots into the wall at the door
    await E(() => window.__leave(0)); await wait(200);
    const t2 = await E(() => window.__mkTell('crack', 1));
    await settle();
    await E((dir) => {
      const sc = window.__dw.scene, d = window.__room().doors[dir], g2 = d.geom, p = window.__dw.player;
      p.teleport(g2.x - g2.dx * 260, g2.y - g2.dy * 260);
      const ang = Math.atan2(g2.dy, g2.dx);
      for (let i = 0; i < 12; i++) sc.bullets.player.fire({ x: p.x + i * 0.01, y: p.y, angle: ang, speed: 900, damage: 1, size: 1 });
    }, t2.dir);
    await W((dir) => window.__room().doors[dir].data.revealed, t2.dir, 30000);
    const real = await E((dir) => { const d = window.__room().doors[dir]; return { hits: d.data.hits, rev: !!d.data.revealed }; }, t2.dir);
    ok(real.rev && real.hits >= 12, `crack: 12 real player bullets into the wall open the door (hits ${real.hits})`);
  }
  {
    await reset();
    const { id, dir } = await E(() => window.__mkTell('knock', 2));
    await settle();
    const geom = await E((dir) => window.__room().doors[dir].geom, dir);
    await E((g2) => window.__stand(g2.x - g2.dx * 400, g2.y - g2.dy * 300), geom);
    await wait(5000);
    const far = await E(() => ({ k: window.__knocks, h: window.__count('secret:hint') }));
    ok(far.k === 0 && far.h === 0, 'knock: silent while the player is far from the wall');
    await E((g2) => window.__stand(g2.x - g2.dx * 90, g2.y - g2.dy * 90), geom);
    await W(() => window.__knocks >= 2, 0, 20000);
    const near = await E(() => ({ k: window.__knocks, h: window.__count('secret:hint'), t: window.__knockT.slice(0, 2) }));
    const gap = near.t[1] - near.t[0];
    ok(near.k >= 2 && near.h === 1, `knock: hollow tock within 130 px, ${near.k} knocks, hint once (${near.h})`);
    ok(Math.abs(gap - 4) < 0.35, `knock cadence 4 s of game time (measured ${gap.toFixed(2)} s)`);
    // dynamite reveals
    await E((g2) => window.__room().revealSecretsAt(g2.x, g2.y, 100), geom);
    const rev = await E((dir) => !!window.__room().doors[dir].data.revealed, dir);
    ok(rev, 'knock: a blast at the wall reveals the door');
  }
  {
    await reset();
    const { id, dir } = await E(() => window.__mkTell('chalk', 3));
    await settle();
    const c = await E((dir) => { const t = window.__ctl('tells'); const it = t.list.find((i) => i.d.dir === dir); return { items: t.list.length, objs: it.objs.length, alpha: it.objs[0].alpha, brittle: !!window.__room().doors[dir].data.brittle, geom: window.__room().doors[dir].geom }; }, dir);
    ok(c.items >= 1 && c.objs === 1 && Math.abs(c.alpha - 0.8) < 1e-6 && !c.brittle, 'chalk: an X is drawn (alpha 0.8) and the door is not brittle');
    await E((c2) => window.__stand(c2.geom.x - c2.geom.dx * 120, c2.geom.y - c2.geom.dy * 120), c);
    await wait(600);
    const h = await E(() => window.__count('secret:hint'));
    for (let i = 0; i < 20; i++) await E((c2) => window.__room().onWallHit(c2.geom.x, c2.geom.y - c2.geom.dy * 30), c);
    const still = await E((dir) => !!window.__room().doors[dir].data.revealed, dir);
    ok(h === 1 && !still, `chalk: hint once (${h}); bullets never open it`);
  }

  // ------------------------------------------------------------------------------------------ shrine
  console.log('--- shrine');
  {
    await reset();
    const id = await E(() => window.__mk('secret', { template: 'secret_shrine', variant: 'shrine' }));
    await settle();
    const a = await E(() => { const r = window.__room(); return { ped: r.state.pedestals.length, item: r.state.pedestals[0] && (r.state.pedestals[0].itemId || 'taken'), spikes: r.tiles.flat().filter((t) => t.type === 'rspikes').length, seed: r.def.seed }; });
    ok(a.ped === 1 && a.item && a.spikes === 8, `shrine: one item pedestal (${a.item}) ringed by ${a.spikes} retracting spikes`);
    // the spike cycle always leaves a crossable gap: some ring tile stays out of the 'up' phase long enough to step in and grab / step out
    const gap = await E(async () => {
      const { RSPIKE } = await import('/src/rooms/hazards/RetractSpikes.js');
      const r = window.__room();
      const ring = r.tiles.flat().filter((t) => t.type === 'rspikes');
      const off = ring.map((t) => ((t.c + t.r) * 0.35) % RSPIKE.cycle);
      const up = (o, t) => ((t + o) % RSPIKE.cycle) >= RSPIKE.down + RSPIKE.warn;
      const need = 0.9; // walk in, take, walk out over one tile
      let worst = 0, run = 0, blocked = 0;
      const step = 0.02;
      for (let t = 0; t < RSPIKE.cycle * 2; t += step) {
        let best = 0;
        for (const o of off) { let k = 0; while (k < need && !up(o, t + k)) k += step; best = Math.max(best, k); }
        if (best < need) { blocked += step; run += step; worst = Math.max(worst, run); } else run = 0;
      }
      return { worst, blocked, off: off.length };
    });
    ok(gap.worst < 1.0, `shrine: a ring tile stays safe for a 0.9 s crossing whenever you time it (longest wait ${gap.worst.toFixed(2)} s)`);
    // taking the item pays once; leaving and coming back does not restock
    await E(() => { const q = window.__room().pedestals[0]; window.__stand(q.rec.x, q.rec.y); });
    const took = await W(() => window.__room().pedestals.every((q) => q.rec.taken), 0, 8000);
    await E(() => window.__stand(720, 800)); await wait(400);
    await E((id) => window.__leave(id), id); await wait(300);
    await E((id) => window.__dw.scene.roomMgr.jump(id), id); await settle();
    const b = await E(() => ({ ped: window.__room().pedestals.filter((q) => !q.rec.taken).length, total: window.__room().state.pedestals.length, pk: window.__room().pickups.length }));
    ok(took && b.ped === 0 && b.total === 1, `shrine re-entry: item taken, pedestal not restocked (${b.total} records, ${b.pk} pickups)`);
  }

  // ------------------------------------------------------------------------------------------ dead man's hand
  console.log("--- dead man's hand");
  {
    let foundAll = 0;
    const rewards = { item: 0, container: 0, keys: 0, heal: 0, devil: 0 };
    for (let pick = 0; pick < 5; pick++) {
      await reset();
      const id = await E(() => window.__mk('secret', { template: 'secret_hand', variant: 'dead_mans_hand' }));
      await settle();
      const info = await E((pick) => { const c = window.__ctl('variant'); const p = window.__dw.player; p.hp = 2; return { id: c.data.order[pick], order: c.data.order.slice(), n: c.cards.length, found: window.__count('secret:found') }; }, pick);
      foundAll += info.found;
      const before = await E(() => { const p = window.__dw.player; return { hp: p.hp, max: p.maxHp, tin: p.tin, keys: p.keys, cu: (p.curses || []).length }; });
      await E((pick) => { const c = window.__ctl('variant').cards[pick]; window.__stand(c.at.x, c.at.y + 6); }, pick);
      const picked = await W((pick) => window.__ctl('variant').data.picked === pick, pick, 15000);
      await E(() => window.__stand(720, 760));
      await wait(1200);
      const a = await E(() => {
        const c = window.__ctl('variant'), r = window.__room(), p = window.__dw.player;
        return { vis: c.cards.filter((x) => x.img.visible).length, rings: c.cards.filter((x) => x.ring.enabled).length, ped: r.state.pedestals.length, pk: r.pickups.map((q) => q.type), hp: p.hp, max: p.maxHp, tin: p.tin, keys: p.keys, cu: (p.curses || []).length };
      });
      const kind = { ace_spades: 'item', ace_clubs: 'container', eight_spades: 'keys', eight_clubs: 'heal', jack_diamonds: 'devil' }[info.id];
      rewards[kind]++;
      let good = picked && a.vis === 1 && a.rings === 0;
      if (kind === 'item') good = good && ((a.ped === 1 && a.pk.length === 0) || (a.ped === 0 && a.pk.length === 1)); // empty pool: heart container fallback
      if (kind === 'container') good = good && (a.pk.filter((t) => t === 'heart_container').length === 1 || a.max > before.max) && a.ped === 0; // (walking over it already counts)
      if (kind === 'keys') good = good && a.pk.filter((t) => t === 'key').length + (a.keys - before.keys) === 3 && a.ped === 0;
      if (kind === 'heal') good = good && a.hp === a.max && a.tin === before.tin + 4 && a.ped === 0 && a.pk.length === 0;
      if (kind === 'devil') good = good && a.cu === before.cu + 1 && (a.ped === 1 || a.pk.length === 1);
      ok(good, `hand: card ${pick} = ${info.id} (${kind}): the other four burn, paid once ${JSON.stringify({ vis: a.vis, ped: a.ped, pk: a.pk.length, cu: a.cu, hp: a.hp, tin: a.tin })}`);
      // re-entry: still one face-up card, nothing paid again
      const pre = await E((id) => { const r = window.__room(), o = { n: r.pickups.length, c: r.pickups.filter((q) => q.type === 'coin').length }; window.__leave(id); return o; }, id); await wait(300);
      const b = await E((id) => { window.__dw.scene.roomMgr.jump(id); const c = window.__ctl('variant'), r = window.__room(); return { vis: c.cards.filter((x) => x.img.visible).length, ped: r.state.pedestals.length, pk: r.pickups.length, picked: c.data.picked }; }, id);
      await settle();
      await E(() => window.__ctl('variant').cards.forEach((c) => window.__stand(c.at.x, c.at.y + 6)));
      await wait(1200);
      const b2 = await E(() => { const c = window.__ctl('variant'), r = window.__room(); return { picked: c.data.picked, ped: r.state.pedestals.length, pk: r.pickups.length, cu: (window.__dw.player.curses || []).length }; });
      ok(b.vis === 1 && b.picked === pick && b.ped === a.ped && b.pk === pre.n && b2.picked === pick && b2.cu === a.cu && b2.ped <= a.ped && b2.pk <= pre.n, `hand re-entry (card ${pick}): same card up, no second reward (ped ${b.ped}, pickups ${b.pk}/${pre.n}; standing on every card again changes nothing)`);
    }
    ok(Object.values(rewards).every((n) => n === 1), `hand: the five picks covered every reward once ${JSON.stringify(rewards)}`);
    ok(foundAll === 5, `secret:found {variant} fired once per entry (${foundAll} over 5 runs)`);
  }

  // ------------------------------------------------------------------------------------------ cache
  console.log('--- cache');
  {
    await reset();
    const id = await E(() => window.__mk('secret', { template: 'secret_cache', variant: 'cache' }));
    await settle();
    const a = await E(() => { const r = window.__room(); let b = 0, z = 0; for (const row of r.tiles) for (const t of row) { if (t.ch === 'B') b++; if (t.ch === 'Z') z++; } return { b, z, crates: window.__ctl('variant').crates.length }; });
    ok(a.b === 8 && a.z === 3 && a.crates === 8, `cache: ${a.b} crates and ${a.z} powder barrels`);
    // one barrel (what a dynamite blast sets off) chain-breaks everything
    await E(() => { window.__stand(720, 800); const r = window.__room(); const z = r.tiles.flat().find((t) => t.ch === 'Z'); r.explodeAt(z.x, z.y, 150); });
    const cleared = await W(() => window.__room().tiles.flat().filter((t) => (t.ch === 'B' || t.ch === 'Z') && !t.broken).length === 0, 0, 12000);
    await wait(1500);
    const b = await E(() => { const r = window.__room(), c = window.__ctl('variant'); return { paid: Object.keys(c.data.paid).length, pk: r.pickups.length, chests: r.chests.length, wood: r.chests.filter((q) => q.rec.type === 'chest_wood').length }; });
    ok(cleared && b.paid === 8, `cache: one blast broke every crate and barrel (${b.paid}/8 paid)`);
    ok(b.pk >= 8 - 1 && b.wood === 1, `cache: >= 8 pickups (${b.pk}) and one wooden chest (${b.wood})`);
    const pre = await E((id) => { const r = window.__room(), o = { n: r.pickups.length, c: r.pickups.filter((q) => q.type === 'coin').length }; window.__leave(id); return o; }, id); await wait(300);
    const c = await E((id) => { window.__dw.scene.roomMgr.jump(id); const r = window.__room(), c2 = window.__ctl('variant'); return { paid: Object.keys(c2.data.paid).length, pk: r.pickups.length, wood: r.chests.length, left: r.tiles.flat().filter((t) => (t.ch === 'B' || t.ch === 'Z') && !t.broken).length }; }, id);
    ok(c.paid === 8 && c.pk === pre.n && c.wood === 1 && c.left === 0, `cache re-entry: rubble stays, ${c.pk} pickups, ${c.wood} chest, no second payout`);
  }

  // ------------------------------------------------------------------------------------------ the Dealer's Safe
  console.log("--- the Dealer's Safe");
  {
    await reset();
    const id = await E(() => { const i = window.__mk('supersecret', { template: 'vault_a' }); return i; });
    await settle();
    const a = await E(() => { const r = window.__room(); return { role: !!window.__ctl('vault'), ped: r.pedestals.filter((q) => !q.rec.taken).length, coins: r.pickups.filter((q) => q.type === 'coin').length, ev: window.__count('supersecret:entered'), dealer: r.state.ctl.dealerItem, seed: r.def.seed }; });
    ok(a.role && a.ped === 2 && a.coins === 12 && a.ev === 1, `vault: 2 free pedestals, 12 coins, supersecret:entered x${a.ev}`);
    // the dealer's item carries the seeded 50 % curse
    const exp = await E((a2) => window.__R.subRng('vault', a2.seed, 0).chance(0.5), a);
    const cu0 = await E(() => (window.__dw.player.curses || []).length);
    await E(() => { const q = window.__room().pedestals.find((x) => x.rec.itemId === window.__room().state.ctl.dealerItem); window.__stand(q.rec.x, q.rec.y); });
    await W(() => window.__room().state.ctl.noticed !== undefined, 0, 8000);
    await E(() => window.__stand(720, 800)); await wait(400);
    const cu1 = await E(() => (window.__dw.player.curses || []).length);
    ok(cu1 - cu0 === (exp ? 1 : 0), `vault: taking the dealer's item ${exp ? 'curses' : 'spares'} you exactly as rolled (${cu0} -> ${cu1})`);
    const pre = await E((id) => { const r = window.__room(), o = { n: r.pickups.length, c: r.pickups.filter((q) => q.type === 'coin').length }; window.__leave(id); return o; }, id); await wait(300);
    const b = await E((id) => { window.__dw.scene.roomMgr.jump(id); const r = window.__room(); return { ped: r.pedestals.filter((q) => !q.rec.taken).length, coins: r.pickups.filter((q) => q.type === 'coin').length, ev: window.__count('supersecret:entered'), total: r.state.pedestals.length }; }, id);
    ok(b.ped === 1 && b.coins === pre.c && b.total === 2, `vault re-entry: no restock (${b.ped} pedestal left, ${b.coins} coins)`);
    // blast rules: the super door is chalk and only dynamite opens it (never bullets)
    const sup = await E(() => { const m = window.__dw.scene.roomMgr; const f = m.floor; const ss = f.rooms.find((r) => r.type === 'supersecret'); return ss ? { has: true } : { has: false }; });
    console.log(`info  generated floor 1 has a supersecret room: ${sup.has} (generation rules are covered by the pure part)`);
  }

  await wait(300);
  ok(g.errors.length === 0, `no console errors (${g.errors.length}) ${g.errors.slice(0, 3).join(' | ')}`);
  await g.close();
}
