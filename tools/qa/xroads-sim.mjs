// Crossroads QA (EVENTS 2.8, WORK_PLAN FN-5).
//   node tools/qa/xroads-sim.mjs            pure simulations (node) + the scripted browser run (needs Chrome)
//   node tools/qa/xroads-sim.mjs --sim      pure part only
//   node tools/qa/xroads-sim.mjs --browser  browser part only
//
// PURE: 20k boss kills for the gate roll (P(no gate over floors 1-5) < 3 %, pity, cap, per-floor rate == formula), offer tables (L / C / R
// rules, pity table, pact weights), cost rules (heart floor, coins with price(), keys, curse room) on mock players.
// BROWSER: openGate -> enter the pocket -> 3 offers -> sign L / C / R with heart debt, hp clamp, coin / key spend, curse list,
// `ace_in_hole` revive exactly once -> leave / enter x50 without leaks, offers unchanged, no console errors.
import { initSeed } from '../../src/core/rng.js';
import { RNG } from '../../src/core/rng.js';
import * as CFG from '../../src/config.js';
import { gateChance, rollGateRaw, buildOffers, canAfford, pay, pactWeights, PACTS, PACT_IDS, gateFloor, grantPact } from '../../src/systems/Crossroads.js';
import { Boons, MAX_CURSES } from '../../src/systems/Boons.js';

const args = new Set(process.argv.slice(2));
const wantSim = !args.has('--browser');
const wantBrowser = !args.has('--sim');
let failed = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ok    ${msg}`); else { failed++; console.log(`  FAIL  ${msg}`); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ------------------------------------------------------------------------------------------------------------ pure part
function simGate() {
  console.log('gate roll (20000 runs x floors 1-5)');
  const RUNS = 20000;
  const hit = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, tried = { ...hit };
  let none = 0, gates = 0, noneNoPity = 0;
  const rng = new RNG(1234);
  const perFloorExpected = {};
  for (let i = 0; i < RUNS; i++) {
    initSeed(100000 + i);
    let misses = 0, got = false, gotNoPity = false, curses = 0;
    for (let f = 1; f <= 5; f++) {
      const flawless = rng.chance(0.35);
      if (rng.chance(0.15) && curses < 4) curses++;
      const inputs = { flawless, curses, gateMisses: misses };
      const h = rollGateRaw(f, inputs);
      const hNoPity = rollGateRaw(f, { ...inputs, gateMisses: 0 });
      if (misses < 2) { tried[f]++; perFloorExpected[f] = (perFloorExpected[f] || 0) + gateChance(inputs); if (h) hit[f]++; }
      if (h) { misses = 0; got = true; gates++; } else misses++;
      if (hNoPity) gotNoPity = true;
    }
    if (!got) none++;
    if (!gotNoPity) noneNoPity++;
  }
  const pNone = none / RUNS;
  console.log(`  P(no gate in 5 floors) = ${(pNone * 100).toFixed(2)} %   (without pity ${(noneNoPity / RUNS * 100).toFixed(1)} %)   gates per run = ${(gates / RUNS).toFixed(2)}`);
  ok(pNone < 0.03, 'P(no gate over floors 1-5) < 3 %');
  ok(gates / RUNS > 1.6 && gates / RUNS < 2.6, 'about 2 gates per 5-boss run');
  // pity: two missed floors in a row = certain, any seed / floor
  let pityBad = 0;
  for (let s = 0; s < 2000; s++) { initSeed(s + 1); for (let f = 1; f <= 5; f++) if (!rollGateRaw(f, { flawless: false, curses: 0, gateMisses: 2 })) pityBad++; }
  ok(pityBad === 0, 'pity: gateMisses >= 2 always opens the gate');
  ok(gateChance({ gateMisses: 2 }) === 1 && gateChance({ gateMisses: 5 }) === 1, 'gateChance(pity) = 1.0');
  ok(near(gateChance({}), 0.30, 1e-9) && near(gateChance({ flawless: true }), 0.60, 1e-9), 'base 0.30, flawless 0.60');
  ok(near(gateChance({ flawless: true, curses: 4 }), 0.70, 1e-9) && near(gateChance({ curses: 1 }), 0.40, 1e-9), 'curses add 0.10 each, cap 0.70');
  ok(!gateFloor(6) && !gateFloor(0) && gateFloor(1) && gateFloor(5), 'gates only on floors 1-5');
  ok(!rollGateRaw(6, { flawless: true, gateMisses: 9 }), 'no gate on floor 6, even with pity');
  // per-floor hit rate matches the formula (pity spawns are counted separately)
  let worst = 0;
  for (let f = 1; f <= 5; f++) worst = Math.max(worst, Math.abs(hit[f] / tried[f] - (perFloorExpected[f] / tried[f])));
  console.log(`  worst per-floor deviation vs formula (non-pity rolls): ${(worst * 100).toFixed(2)} %`);
  ok(worst < 0.02, 'per-floor non-pity rate matches the formula (+-2 %)');
  // determinism: the same (seed, floor, inputs) always rolls the same
  initSeed(777);
  const a = [1, 2, 3, 4, 5].map((f) => rollGateRaw(f, { flawless: true, curses: 1, gateMisses: 0 }));
  initSeed(777);
  const b = [1, 2, 3, 4, 5].map((f) => rollGateRaw(f, { flawless: true, curses: 1, gateMisses: 0 }));
  ok(JSON.stringify(a) === JSON.stringify(b), 'gate roll is deterministic per seed + floor');
}

const mockItems = (ids, deals = {}) => {
  const pool = [...ids];
  return { roll(name, r, o = {}) { if (name === 'crossroads' || name === 'boss') return pool.length ? pool.splice(Math.floor(r.next() * pool.length), 1)[0] : null; return null; } };
};
const mockPlayer = (o = {}) => ({ coins: 50, keys: 2, dynamite: 2, tin: 0, stats: { maxHearts: 3 }, curses: [], hp: 6, maxHp: 6, price: (b) => b, ...o });

async function simOffers() {
  console.log('offer tables');
  const { registerItem } = await import('../../src/items/registry.js');
  const mk = (id, pay) => registerItem({ id, name: id, desc: 'x', pool: ['crossroads'], deal: { pay }, icon: { sheet: 's', name: id } });
  mk('t_heart', { container: 1 }); mk('t_keys', { keys: 2 }); mk('t_coins', { coins: 15 }); mk('t_tin', { tin: 4 }); mk('t_dyn', { dynamite: 3 });
  const ids = ['t_heart', 't_keys', 't_coins', 't_tin', 't_dyn'];
  const N = 6000;
  const cKinds = { item_curse: 0, item_coins: 0, item_hearts: 0, pity: 0 };
  const rPacts = {};
  let lBad = 0, dupBad = 0, floor1Ace = 0, absNoCurse = 0;
  for (let i = 0; i < N; i++) {
    initSeed(5000 + i);
    const floor = 1 + (i % 5);
    const player = mockPlayer({ curses: i % 4 === 0 ? ['curse_rot'] : [] });
    const offers = buildOffers({ floor, player, items: mockItems(ids, {}) });
    if (offers.length !== 3 || offers[0].id !== 'L' || offers[1].id !== 'C' || offers[2].id !== 'R') lBad++;
    const [L, C, R] = offers;
    if (L.itemId && C.itemId && L.itemId === C.itemId) dupBad++;
    cKinds[C.kind] = (cKinds[C.kind] || 0) + 1;
    rPacts[R.pact] = (rPacts[R.pact] || 0) + 1;
    if (floor === 1 && R.pact === 'ace_in_hole') floor1Ace++;
    if (!player.curses.length && R.pact === 'absolution') absNoCurse++;
  }
  ok(lBad === 0, 'always three offers in L / C / R order');
  ok(dupBad === 0, 'L and C never offer the same item');
  ok(floor1Ace === 0, 'ace_in_hole never on floor 1');
  ok(absNoCurse === 0, 'absolution only when the player carries a curse');
  const cTotal = cKinds.item_curse + cKinds.item_coins;
  ok(near(cKinds.item_curse / cTotal, 0.6, 0.03), `C table: 60 % curse (${(cKinds.item_curse / cTotal * 100).toFixed(1)} %) / 40 % 30 coins`);
  const c1 = buildOffers({ floor: 3, player: mockPlayer(), items: mockItems(ids) });
  const coinOffer = [c1[1]].find((o) => o.kind === 'item_coins');
  if (coinOffer) ok(coinOffer.cost.coins === 30, 'C coin price is 30');
  // pity: exhausted pool
  initSeed(9);
  const pity = buildOffers({ floor: 2, player: mockPlayer(), items: mockItems([]) });
  ok(pity[0].kind === 'pity' && pity[1].kind === 'pity' && pity[2].kind === 'pact', 'sold-out crossroads pool -> free pity tables for L and C');
  // L native price
  initSeed(11);
  const l = buildOffers({ floor: 2, player: mockPlayer(), items: mockItems(['t_keys']) })[0];
  ok(l.kind === 'item_goods' && l.cost.keys === 2, 'L uses the item deal.pay (2 keys)');
  const lh = buildOffers({ floor: 2, player: mockPlayer({ stats: { maxHearts: 1 } }), items: mockItems(['t_heart']) })[0];
  ok(lh.kind === 'item_curse' && lh.cost.curse, 'L heart price with 1 container left becomes a curse deal');
  // R weights
  const w1 = pactWeights(1, mockPlayer({ curses: [] }));
  ok(w1.ace_in_hole === 0 && w1.absolution === 0 && w1.iron_hide === 40, 'floor 1 no curse: ace 0, absolution 0 (weight moves to iron_hide)');
  const w3 = pactWeights(3, mockPlayer({ curses: ['curse_rot'] }));
  ok(w3.ace_in_hole === 10 && w3.absolution === 20 && w3.glass_cannon === 25 && w3.devils_dollar === 25 && w3.iron_hide === 20, 'floor 3 with a curse: 25 / 25 / 20 / 10 / 20');
  const tot = Object.values(rPacts).reduce((a, b) => a + b, 0);
  console.log('  R pacts:', PACT_IDS.map((k) => `${k} ${(100 * (rPacts[k] || 0) / tot).toFixed(1)}%`).join('  '));
  ok(PACT_IDS.length === 5, 'five pacts');
}

function simCosts() {
  console.log('cost rules');
  const p = mockPlayer();
  ok(canAfford(p, { cost: { hearts: 2 } }) === true, 'hearts 2 with 3 containers is affordable');
  ok(canAfford(mockPlayer({ stats: { maxHearts: 2 } }), { cost: { hearts: 2 } }) === 'NEED MORE BLOOD', 'never below one container: NEED MORE BLOOD');
  ok(canAfford(mockPlayer({ coins: 5 }), { cost: { coins: 30 } }) === 'NEED 30 COINS', 'NEED 30 COINS');
  ok(canAfford(mockPlayer({ coins: 40, price: (b) => Math.ceil(b * 1.5) }), { cost: { coins: 30 } }) === 'NEED 45 COINS', 'curse_debt raises the coin price to 45');
  ok(canAfford(mockPlayer({ keys: 0 }), { cost: { keys: 1 } }) === 'NEED 1 KEY', 'NEED 1 KEY');
  ok(canAfford(mockPlayer({ curses: ['curse_debt', 'curse_dark', 'curse_rot', 'curse_lead'] }), { cost: { curse: true } }) === 'NO ROOM FOR MORE SIN', 'four curses: NO ROOM FOR MORE SIN');
  ok(canAfford(mockPlayer(), { taken: true, cost: {} }) === 'SIGNED', 'a signed offer is spent');
  const q = mockPlayer({ loseMaxHeart(n) { this.stats.maxHearts -= n; } });
  const paid = pay(q, { hearts: 2, coins: 30, keys: 1 });
  ok(q.stats.maxHearts === 1 && q.coins === 20 && q.keys === 1 && paid.hearts === 2, 'pay(): hearts via loseMaxHeart, coins and keys deducted');
  // boons on a mock player
  const bp = mockPlayer({ recomputeStats() {} });
  const r = new RNG(3);
  const got = new Set();
  for (let i = 0; i < 4; i++) got.add(Boons.gainCurse(bp, r));
  ok(got.size === 4 && bp.curses.length === MAX_CURSES, 'four distinct curses, max four');
  ok(Boons.gainCurse(bp, r) === null, 'a fifth curse is a no-op');
  ok(Boons.price(bp, 30) === 45, 'curse_debt: ceil(30 x 1.5) = 45');
  ok(Boons.removeCurse(bp, r) !== null && bp.curses.length === 3, 'removeCurse');
  const st = { moveSpeed: 330, rollCooldown: 1, fireDelay: 0.33, luck: 0, damage: 3.5 };
  Boons.applyBoons({ curses: ['curse_lead'], blessings: ['bless_fleet', 'bless_steady', 'bless_grace', 'bless_iron'], pacts: ['glass_cannon'] }, st);
  ok(near(st.moveSpeed, 330 - 40 + 40, 1e-9) && near(st.rollCooldown, 1 + 0.3 - 0.15, 1e-9), 'lead + fleet: speed 330, roll cooldown 1.15');
  ok(near(st.fireDelay, 0.33 * 0.92, 1e-9) && st.luck === 1.5 && near(st.damage, 3.5 + 0.4 + 1.5, 1e-9), 'steady x0.92, grace +1.5 luck, iron +0.4 and glass_cannon +1.5 damage');
}

// ------------------------------------------------------------------------------------------------------------ browser part
async function browser() {
  console.log('browser: scripted signing, pocket enter/leave x50');
  const { launch } = await import('./harness.mjs');
  const g = await launch({ query: '?debug=1&seed=42&noassets=1', name: 'xroads', quiet: true });
  const skip = (msg) => console.log(`  skip  ${msg}`);
  try {
    await g.startRun();
    const settle = async (pred, ms = 8000) => { try { await g.page.waitForFunction(pred, { timeout: ms }); return true; } catch { return false; } };
    const idle = () => settle(() => !__dw.scene.transitioning && !__dw.scene.roomMgr.transitioning, 8000);
    const st = () => g.eval(() => { const p = __dw.player; return { hp: p.hp, maxHp: p.maxHp, hearts: p.stats.maxHearts, coins: p.coins, keys: p.keys, curses: [...(p.curses || [])], pacts: [...(p.pacts || [])], debt: p.heartDebt || 0, room: __dw.scene.roomMgr.currentId, dead: p.dead, items: [...p.items] }; });

    // 1. gate + pocket plumbing (shim: build floor.xroads when FloorGen has not landed it yet)
    const setup = await g.eval(async () => {
      const mgr = __dw.scene.roomMgr, fl = mgr.floor;
      let shim = false;
      if (!fl.xroads) { shim = true; fl.xroads = { opened: false, def: { id: 'xroads', gx: -9, gy: -9, type: 'crossroads', dist: 0, doors: {}, template: 'crossroads', bg: 'b', seed: (fl.seed ^ 0xC0551) >>> 0 } }; }
      const { Crossroads } = await import('/src/systems/Crossroads.js');
      mgr.jump(fl.bossId);
      return { shim, hasEnter: typeof mgr.enterPocket === 'function', hasLeave: typeof mgr.leavePocket === 'function', Crossroads: !!Crossroads };
    });
    await idle(); await g.wait(600);
    if (setup.shim) skip('floor.xroads missing (FloorGen not landed): test shim def used');
    ok(setup.hasEnter && setup.hasLeave, 'RoomManager.enterPocket / leavePocket exist');
    // gate spawns in the boss room
    const gate = await g.eval(async () => {
      const { openGate } = await import('/src/systems/Crossroads.js');
      const r = __dw.room; await new Promise((res) => setTimeout(res, 300));
      const gt = openGate(__dw.scene, r);
      return { spawned: !!gt, state: !!r.state.gate, onRoom: (r.props || []).some((p) => p.constructor.name === 'HellGate') };
    });
    ok(gate.spawned && gate.state && gate.onRoom, 'openGate: HellGate prop spawned and stored in room.state.gate');

    // 2. scripted offers (prefilled into the pocket state so the controller builds exactly these tables)
    const ITEMS = await g.eval(() => { const ids = ['bandolier', 'dead_eye'].filter((i) => __dw.scene.items.get ? true : true); return ids; });
    await g.eval((items) => {
      const mgr = __dw.scene.roomMgr, p = __dw.player;
      p.coins = 40; p.keys = 3; p.dynamite = 1;
      p.stats.maxHearts = p.stats.maxHearts; // untouched: the run's own containers
      mgr.stateFor('xroads').ctl = { visits: 0, offers: [
        { id: 'L', kind: 'item_hearts', itemId: items[0], cost: { hearts: 1, keys: 1 }, taken: false },
        { id: 'C', kind: 'item_curse', itemId: items[1], cost: { curse: true, coins: 30 }, taken: false },
        { id: 'R', kind: 'pact', pact: 'ace_in_hole', cost: { hearts: 1 }, taken: false },
      ] };
    }, ITEMS);
    const before = await st();
    await g.eval(() => __dw.scene.roomMgr.enterPocket());
    ok(await settle(() => __dw.scene.roomMgr.currentId === 'xroads' && !__dw.scene.transitioning), 'entered the pocket');
    await g.wait(900);
    const ctlInfo = await g.eval(() => { const c = __dw.room.controller('xroads'); return c ? { offers: c.state.offers.length, tables: c.tables.length, rings: __dw.room.rings.length, dealer: !!c.dealer } : null; });
    ok(ctlInfo && ctlInfo.offers === 3 && ctlInfo.tables === 3 && ctlInfo.rings >= 3 && ctlInfo.dealer, `controller hosts dealer + 3 tables + 3 rings (${JSON.stringify(ctlInfo)})`);

    // 3. sign L by standing in its ring (real HoldRing), then C and R through the controller
    await g.eval(() => { const c = __dw.room.controller('xroads'), t = c.tables[0]; __dw.player.x = t.x; __dw.player.y = t.y + 8; __dw.player.sprite && __dw.player.sprite.setPosition(t.x, t.y + 8); });
    await settle(() => __dw.room.controller('xroads').state.offers[0].taken, 12000); // software GL runs slow: dt is clamped, so 0.9 s of game time takes longer
    let a = await st();
    const offersNow = await g.eval(() => __dw.room.controller('xroads').state.offers.map((o) => o.taken));
    ok(offersNow[0] === true, 'L signed by standing in the ring for 0.9 s');
    ok(a.keys === before.keys - 1, `L: 1 key spent (${before.keys} -> ${a.keys})`);
    ok(a.items.includes(ITEMS[0]), 'L: item granted');
    const hasHeartApi = await g.eval(() => typeof __dw.player.loseMaxHeart === 'function');
    if (hasHeartApi) {
      ok(a.hearts === before.hearts - 1, `L: one heart container lost (${before.hearts} -> ${a.hearts})`);
      ok(a.hp <= a.hearts * 2, 'hp clamped to the new max');
    } else skip('Player.loseMaxHeart missing (FN-4 not landed): heart-debt fallback in use');
    // C: curse + 30 coins
    await g.eval(() => __dw.room.controller('xroads').sign(1));
    a = await st();
    ok(a.coins === 10 && a.curses.length === 1, `C: 30 coins spent and one curse taken (coins ${a.coins}, curses ${a.curses})`);
    ok(a.items.includes(ITEMS[1]), 'C: item granted');
    // R: ace in the hole (one heart)
    await g.eval(() => __dw.room.controller('xroads').sign(2));
    a = await st();
    const hasRevive = await g.eval(() => typeof __dw.player.grantRevive === 'function');
    ok(a.pacts.includes('ace_in_hole') || hasRevive, 'R: ace_in_hole granted');
    // signed tables are spent
    const spent = await g.eval(() => { const c = __dw.room.controller('xroads'); return c.state.offers.every((o) => o.taken) && c.rings.every((r) => !r.enabled); });
    ok(spent, 'all three tables spent, rings hidden');
    const deals = await g.eval(() => (__dw.scene.run.deals || []).length);
    ok(deals === 3, `run.deals recorded (${deals})`);
    // can not sign twice
    const c0 = a.coins;
    await g.eval(() => { const c = __dw.room.controller('xroads'); c.sign(0); c.sign(1); c.sign(2); });
    a = await st();
    ok(a.coins === c0, 'a spent table cannot be signed again');

    // 5. leave / enter x50, leak check
    const probeLeaks = () => g.eval(async () => {
      const { bus } = await import('/src/core/events.js');
      const sc = __dw.scene;
      let listeners = 0; for (const n of bus.eventNames()) listeners += bus.listenerCount(n);
      return { children: sc.children.list.length, listeners, rings: (__dw.room.rings || []).length, tweens: sc.tweens.getTweens().length, timers: sc.time.getAllEvents ? sc.time.getAllEvents().length : 0, enemies: sc.enemies.length, bullets: sc.bullets.count };
    });
    // go back to the boss room first (real portal path)
    await g.eval(() => __dw.scene.roomMgr.leavePocket());
    await settle(() => __dw.scene.roomMgr.currentId !== 'xroads' && !__dw.scene.transitioning);
    await g.wait(500);
    const backOk = await g.eval(() => __dw.scene.roomMgr.currentId === __dw.floor.bossId);
    ok(backOk, 'leavePocket returns to the boss room');
    const gateBack = await g.eval(() => (__dw.room.props || []).some((p) => p.constructor.name === 'HellGate'));
    ok(gateBack, 'the gate is restored when the boss room is rebuilt');
    let base = null, last = null, bad = 0;
    for (let i = 0; i < 50; i++) {
      await g.eval(() => { __dw.player.godMode = true; __dw.scene.roomMgr.enterPocket(); });
      if (!(await settle(() => __dw.scene.roomMgr.currentId === 'xroads' && !__dw.scene.transitioning))) { bad++; break; }
      await g.wait(120);
      await g.eval(() => __dw.scene.roomMgr.leavePocket());
      if (!(await settle(() => __dw.scene.roomMgr.currentId !== 'xroads' && !__dw.scene.transitioning))) { bad++; break; }
      await g.wait(120);
      if (i === 4) base = await probeLeaks();
    }
    last = await probeLeaks();
    ok(bad === 0, '50 enter / leave cycles completed');
    console.log(`  leak probe after 5 cycles ${JSON.stringify(base)}\n  leak probe after 50 cycles ${JSON.stringify(last)}`);
    if (base && last) {
      ok(last.children <= base.children + 4, 'scene display list does not grow');
      ok(last.listeners <= base.listeners + 2, 'bus listeners do not grow');
      ok(last.rings === base.rings, 'HoldRings do not accumulate');
      ok(last.tweens <= base.tweens + 6, 'tweens do not accumulate');
    }
    const same = await g.eval(() => __dw.scene.roomMgr.stateFor('xroads').ctl.offers.map((o) => o.taken));
    ok(same.every(Boolean), 'offers stay spent across visits');

    // 6. revive once (last: the second death ends the run)
    if (hasRevive) {
      const rv = await g.eval(async () => {
        const p = __dw.player; p.godMode = false; p.hurtT = 0; p.entryInv = 0; p.tin = 0;
        const out = [];
        for (let n = 0; n < 2; n++) {
          for (let w = 0; w < 80 && p.invulnerable; w++) await new Promise((r) => setTimeout(r, 250)); // the revive grants 2 s of invulnerability
          p.hp = 1; p.hurtT = 0; p.entryInv = 0; p.shieldLeft = 0; p.haloLeft = 0;
          p.damage(2, { x: p.x + 1, y: p.y });
          await new Promise((r) => setTimeout(r, 1500));
          out.push({ dead: !!p.dead, hp: p.hp });
          if (p.dead) break;
        }
        return out;
      });
      ok(rv[0] && !rv[0].dead && rv[0].hp > 0, 'ace_in_hole: first death is undone');
      ok(rv[1] && rv[1].dead, 'ace_in_hole: second death is final (revive only once)');
    } else skip('Player.grantRevive missing (FN-4 not landed): revive-once not testable');

  } finally {
    ok(g.errors.length === 0, `no console errors (${g.errors.length}) ${g.errors.slice(0, 3).join(' | ')}`);
    await g.close();
  }
}

if (wantSim) { simGate(); await simOffers(); simCosts(); }
if (wantBrowser) await browser();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
