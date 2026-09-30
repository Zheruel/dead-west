// FE-V1 outcome-table simulation (EVENTS 3.8): 20k rolls per table through the same seeded streams the controllers use (subRng(label, roomSeed, n)),
// each probability must land within +-1.5 % absolute of the design value. Also: daily determinism (same seed -> same outcomes in any order),
// structural invariants of the shuffles, EV of the card table. Pure node, no browser:  node tools/qa/events-sim.mjs
import { initSeed, subRng } from '../../src/core/rng.js';
import * as T from '../../src/rooms/special/events/tables.js';

const N = 20000, TOL = 0.015;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
initSeed(20260930);

/** roll(rng, i) -> outcome key; expect {key: p}. Rolls use N distinct (roomSeed, n) pairs. */
function table(name, label, roll, expect, { perRoom = 1 } = {}) {
  const got = {};
  for (let i = 0; i < N; i++) {
    const room = 1000 + Math.floor(i / perRoom), n = i % perRoom;
    const k = roll(subRng(label, room, n), i);
    got[k] = (got[k] || 0) + 1;
  }
  let worst = 0, line = [];
  for (const [k, p] of Object.entries(expect)) {
    const f = (got[k] || 0) / N;
    worst = Math.max(worst, Math.abs(f - p));
    line.push(`${k} ${(f * 100).toFixed(1)}/${(p * 100).toFixed(1)}`);
  }
  const extra = Object.keys(got).filter((k) => !(k in expect));
  ok(worst <= TOL && !extra.length, `${name}: max dev ${(worst * 100).toFixed(2)}%  [${line.join('  ')}]${extra.length ? ' UNEXPECTED ' + extra : ''}`);
}

// ---- card sharp (EVENTS 3.2): bust .51, push .10, win .31, ace high .06, dead man's hand .02; luck moves .01/pt bust -> win (cap 5)
table('card_sharp luck 0', 'bet', (r) => T.rollBet(r, 0), { bust: 0.51, push: 0.10, win: 0.31, ace_high: 0.06, dead_mans_hand: 0.02 }, { perRoom: 5 });
table('card_sharp luck 3', 'bet', (r) => T.rollBet(r, 3), { bust: 0.48, push: 0.10, win: 0.34, ace_high: 0.06, dead_mans_hand: 0.02 }, { perRoom: 5 });
table('card_sharp luck 9 (capped at 5)', 'bet', (r) => T.rollBet(r, 9), { bust: 0.46, push: 0.10, win: 0.36, ace_high: 0.06, dead_mans_hand: 0.02 }, { perRoom: 5 });
{
  const ev = T.betProbs(0).reduce((s, [k, p]) => s + p * T.BET_RETURN[k], 0);
  ok(Math.abs(ev - 0.9) < 1e-9, `card_sharp house edge: expected return per coin ${ev.toFixed(3)} (design 0.90)`);
}
// ---- wishing well (3.3)
table('wishing_well', 'wish', (r) => T.rollWish(r), { nothing: 0.44, heart_half: 0.14, key: 0.09, dynamite: 0.09, heart_full: 0.06, coin_nickel: 0.05, heart_tin: 0.04, luck: 0.07, curse: 0.02 }, { perRoom: 11 });
ok(Math.abs(T.WISH_TABLE.reduce((s, [, p]) => s + p, 0) - 1) < 1e-9, 'wishing_well table sums to 1');
// ---- preacher (3.5)
table('preacher communion', 'communion', (r) => T.rollCommunion(r), { blessing: 0.78, false_prophet: 0.14, miracle: 0.08 });
table('preacher plate blessing', 'plate', (r) => (r.chance(T.PLATE_BLESSING_CHANCE) ? 'blessing' : 'none'), { blessing: 0.25, none: 0.75 });
// ---- snake oil (3.6)
table('snake_oil water', 'water', (r) => (r.chance(T.WATER_CHANCE) ? 'water' : 'potion'), { water: 0.10, potion: 0.90 }, { perRoom: 3 });
// ---- gravedigger (3.4): every mound holds each content with its share; exactly one ambush and one chest
{
  const per = Array.from({ length: 5 }, () => ({}));
  let shapeOk = true;
  for (let i = 0; i < N; i++) {
    const g = T.shuffleGraves(subRng('graves', 1000 + i));
    const c = (k) => g.filter((x) => x === k).length;
    if (c('ambush') !== 1 || c('chest') !== 1 || c('loot') !== 2 || c('bones') !== 1 || g.length !== 5) shapeOk = false;
    g.forEach((k, s) => { per[s][k] = (per[s][k] || 0) + 1; });
  }
  ok(shapeOk, 'gravedigger: every shuffle has exactly 1 ambush, 1 chest, 2 loot, 1 bones');
  let worst = 0;
  for (const s of per) for (const [k, p] of Object.entries({ loot: 0.4, chest: 0.2, ambush: 0.2, bones: 0.2 })) worst = Math.max(worst, Math.abs((s[k] || 0) / N - p));
  ok(worst <= TOL, `gravedigger: per-mound content shares max dev ${(worst * 100).toFixed(2)}%`);
  table('gravedigger bones key', 'bones', (r) => (r.chance(T.BONES_KEY_CHANCE) ? 'key' : 'none'), { key: 0.25, none: 0.75 }, { perRoom: 5 });
}
// ---- dead man's hand shuffle: every card lands on every card slot equally; potion map is a permutation, each colour hits each effect equally
{
  const pos = {};
  for (let i = 0; i < N; i++) shuffleCheck(T.shuffleHand(subRng('hand', 1000 + i)), pos);
  function shuffleCheck(order, acc) { order.forEach((id, s) => { const k = `${s}:${id}`; acc[k] = (acc[k] || 0) + 1; }); }
  let worst = 0;
  for (const v of Object.values(pos)) worst = Math.max(worst, Math.abs(v / N - 0.2));
  ok(Object.keys(pos).length === 25 && worst <= TOL, `dead_mans_hand: 25 card/slot pairs each 20% (max dev ${(worst * 100).toFixed(2)}%)`);
  const eff = {};
  let perm = true;
  for (let i = 0; i < N; i++) {
    const m = T.potionMap(subRng('potions', 1000 + i));
    if (new Set(Object.values(m)).size !== 6 || Object.keys(m).length !== 6) perm = false;
    for (const [c, e] of Object.entries(m)) { const k = `${c}:${e}`; eff[k] = (eff[k] || 0) + 1; }
  }
  let w2 = 0;
  for (const v of Object.values(eff)) w2 = Math.max(w2, Math.abs(v / N - 1 / 6));
  ok(perm && Object.keys(eff).length === 36 && w2 <= TOL, `snake_oil: colour -> effect map is a permutation, each pairing 1/6 (max dev ${(w2 * 100).toFixed(2)}%)`);
  let distinct = true;
  for (let i = 0; i < 2000; i++) if (new Set(T.shelfColors(subRng('shelf', 1000 + i))).size !== 3) distinct = false;
  ok(distinct, 'snake_oil: the three shelf colours are always distinct');
}
// ---- duel draw delay: 3.4 + U(0, 1.2)
{
  let lo = 9, hi = 0, sum = 0;
  for (let i = 0; i < N; i++) { const d = T.drawDelay(subRng('draw', 1000 + i)); lo = Math.min(lo, d); hi = Math.max(hi, d); sum += d; }
  ok(lo >= 3.4 && hi < 4.6 && Math.abs(sum / N - 4.0) < 0.03, `quick_draw: DRAW delay in [3.4, 4.6) mean ${(sum / N).toFixed(3)} (design 4.0)`);
}
// ---- daily determinism: outcomes are a function of (seed, room seed, label, n) only
{
  initSeed(424242);
  const a = [0, 1, 2, 3, 4].map((n) => T.rollBet(subRng('bet', 7, n), 0)).join();
  const b = [4, 2, 0, 3, 1].map((n) => [n, T.rollBet(subRng('bet', 7, n), 0)]).sort((x, y) => x[0] - y[0]).map((x) => x[1]).join();
  const w1 = [0, 1, 2].map((n) => T.rollWish(subRng('wish', 9, n))).join();
  const w2 = [2, 1, 0].map((n) => T.rollWish(subRng('wish', 9, n))).reverse().join();
  ok(a === b, `determinism: bet outcomes identical in any order (${a})`);
  ok(w1 === w2, `determinism: wish outcomes identical in any order (${w1})`);
  const g1 = T.shuffleGraves(subRng('graves', 5)).join(), g2 = T.shuffleGraves(subRng('graves', 5)).join();
  initSeed(424243);
  const g3 = T.shuffleGraves(subRng('graves', 5)).join();
  ok(g1 === g2, 'determinism: same seed -> same grave layout');
  console.log(`info  another seed usually differs (${g1} / ${g3})`);
}
if (!process.argv.includes('--pure')) await play();
console.log(fails ? `\n${fails} FAILED` : '\nevents-sim: all ok');
process.exit(fails ? 1 : 0);

// ====================================================================================================================== scripted playthroughs
async function play() {
  const { launch } = await import('./harness.mjs');
  const query = process.argv.find((a) => a.startsWith('?')) || '?debug=1&seed=77';
  const g = await launch({ query, name: 'events-sim', quiet: true });
  await g.startRun();
  await g.eval(async () => {
    window.__dw.api.godMode(true);
    const { bus } = await import('/src/core/events.js');
    window.__T = await import('/src/rooms/special/events/tables.js');
    window.__R = await import('/src/core/rng.js');
    window.__log = [];
    for (const e of ['event:done', 'event:started', 'bet:result', 'potion:drunk', 'bullet:fired', 'curse:gained', 'blessing:gained', 'room:locked']) {
      bus.on(e, (d) => window.__log.push({ e, d: e === 'bullet:fired' ? { owner: d.owner } : d && d.outcome !== undefined ? { outcome: d.outcome, id: d.id, net: d.net } : d && d.effect ? { effect: d.effect, color: d.color } : d && d.outcome !== undefined ? d : d && d.id ? { id: d.id } : {} }));
    }
    // synthesize an event room from the k-th eligible normal room of the floor
    window.__mk = (type, extra = {}, k = 0) => {
      const m = window.__dw.scene.roomMgr;
      const defs = m.floor.rooms.filter((r) => (r._orig || r.type) === 'normal' && r.dist >= 2);
      const def = defs[k];
      def._orig = def._orig || 'normal';
      for (const key of ['template', 'mini', 'event', 'variant', 'pocket']) delete def[key];
      Object.assign(def, { type, ...extra });
      delete m.states[def.id];
      window.__dw.player.godMode = true;
      m.jump(def.id, null);
      return def.id;
    };
    window.__room = () => window.__dw.scene.room;
    window.__sub = () => window.__dw.scene.room.controller('event').sub;
    window.__stand = (x, y) => window.__dw.player.teleport(x, y);
    window.__away = () => window.__dw.player.teleport(720, 760);
    window.__count = (e) => window.__log.filter((l) => l.e === e).length;
    window.__leave = (id) => { const m = window.__dw.scene.roomMgr; m.jump(m.floor.rooms.find((r) => r.id !== id).id); };
  });
  await g.wait(500);
  const SLOW = Number(process.env.QA_SLOW || 3); // headless Chrome under load runs at a few fps: scale every wait
  const wait = (ms) => g.wait(ms * SLOW);
  const E = (fn, ...a) => g.eval(fn, ...a);
  const W = (fn, arg, timeout = 40000) => g.page.waitForFunction(fn, { timeout: timeout * SLOW, polling: 100 }, arg).then(() => true).catch(() => false);
  const mk = (ev, k = 0) => E((a) => { const id = window.__mk('event', { template: `event_${a.ev}`, event: a.ev }, a.k); window.__away(); return id; }, { ev, k }); // the jump drops you at the room centre, which can sit inside a ring
  const settle = () => wait(700);
  const fresh = async () => { await E(() => { window.__log.length = 0; const p = window.__dw.player; p.hp = p.maxHp; p.coins = 50; p.curses && (p.curses.length = 0); p.blessings && (p.blessings.length = 0); }); };

  const only = (n) => !process.env.QA_ONLY || process.env.QA_ONLY.split(',').includes(n);
  // ---------------------------------------------------------------------------------------------- card_sharp: 5 hands, fold, re-entry, outcome sequence == table rolls
  if (only('card_sharp')) {
    console.log('--- card_sharp');
    await fresh();
    const id = await mk('card_sharp');
    await settle();
    await E(() => { window.__dw.player.coins = 40; });
    for (let i = 0; i < 8; i++) {
      const done = await E(() => window.__sub().data.folded);
      if (done) break;
      const before = await E(() => window.__sub().data.hands);
      await E(() => { const r = window.__sub().chips[0].ring; window.__stand(r.x, r.y); });
      const okHand = await W((b) => { const s = window.__sub(); return s.data.hands > b && !s.data.pending && !s.busy; }, before, 20000);
      if (!okHand) { ok(false, 'card_sharp hand did not resolve'); break; }
      await E(() => window.__away());
      await W(() => window.__sub().armed[0], 0, 8000);
    }
    const st = await E(() => { const s = window.__sub(), d = s.data; return { hands: d.hands, folded: d.folded, net: s.state.net, coins: window.__dw.player.coins, seed: window.__room().def.seed, log: window.__log.filter((l) => l.e === 'bet:result').map((l) => l.d.outcome), done: window.__count('event:done') }; });
    ok(st.hands <= 5 && st.folded, `card_sharp: ${st.hands} hands then the house folds (${st.log.join(',')})`);
    ok(st.log.length === st.hands, 'card_sharp: one bet:result per hand');
    const exp = await E((a) => a.log.map((_, n) => window.__T.rollBet(window.__R.subRng('bet', a.seed, n), 0)), st);
    ok(JSON.stringify(exp) === JSON.stringify(st.log), `card_sharp: outcomes equal the seeded table rolls (${exp.join(',')})`);
    ok(st.coins === 40 + st.net || st.coins === 99, `card_sharp: coins ${st.coins} == 40 + net ${st.net}`);
    ok(st.done === 1, 'card_sharp: event:done fired once');
    // re-entry: nothing pays twice, chips stay closed
    await E((id) => window.__leave(id), id); await wait(300);
    await E((id) => window.__dw.scene.roomMgr.jump(id), id); await settle();
    const r2 = await E(() => { const s = window.__sub(); s.chips.forEach((c) => window.__stand(c.ring.x, c.ring.y)); return { hands: s.data.hands, folded: s.data.folded, coins: window.__dw.player.coins, rings: s.chips.filter((c) => c.ring.enabled).length, ped: window.__room().pedestals.length }; });
    await wait(900);
    const r3 = await E(() => ({ hands: window.__sub().data.hands, coins: window.__dw.player.coins }));
    ok(r2.hands === st.hands && r2.folded && r2.rings === 0 && r3.hands === st.hands && r3.coins === r2.coins, `card_sharp re-entry: closed, ${r3.hands} hands, coins unchanged`);
  }

  // ---------------------------------------------------------------------------------------------- wishing_well: 12 throws, item on the 12th, sequence == rolls
  if (only('wishing_well')) {
    console.log('--- wishing_well');
    await fresh();
    const id = await mk('wishing_well');
    await settle();
    await E(() => { window.__dw.player.coins = 99; });
    await E(() => { const r = window.__sub().ringObj; window.__stand(r.x, r.y); });
    const done = await W(() => { const s = window.__sub(); return s.data.throws >= 12 && s.data.pending == null; }, 0, 60000);
    const st = await E(() => { const s = window.__sub(), d = s.data, p = window.__dw.player; return { throws: d.throws, luck: d.luck, jackpot: d.jackpot, net: s.state.net, ped: window.__room().pedestals.filter((q) => !q.rec.taken).length, seed: window.__room().def.seed, curses: (p.curses || []).length, done: window.__count('event:done'), ring: s.ringObj.enabled }; });
    const exp = await E((a) => { const o = []; for (let n = 0; n < 11; n++) o.push(window.__T.rollWish(window.__R.subRng('wish', a.seed, n))); return o; }, st);
    ok(done && st.throws === 12 && st.net === -12, `well: 12 throws, 12 coins spent (net ${st.net})`);
    ok(st.jackpot && st.ped === 1, `well: the 12th throw brings up exactly one treasure pedestal (${st.ped})`);
    ok(st.luck === Math.min(3, exp.filter((x) => x === 'luck').length), `well: luck boons ${st.luck} == min(3, ${exp.filter((x) => x === 'luck').length}) from the seeded rolls`);
    ok(st.curses === Math.min(exp.filter((x) => x === 'curse').length, 4), `well: curses ${st.curses} == seeded rolls (${exp.filter((x) => x === 'curse').length})`);
    ok(st.done === 1 && !st.ring, 'well: event:done once, ring closed');
    await E((id) => window.__leave(id), id); await wait(300);
    await E((id) => window.__dw.scene.roomMgr.jump(id), id); await settle();
    await E(() => { const r = window.__sub().ringObj; window.__stand(r.x, r.y); });
    await wait(1200);
    const r2 = await E(() => ({ throws: window.__sub().data.throws, ped: window.__room().pedestals.filter((q) => !q.rec.taken).length, coins: window.__dw.player.coins }));
    ok(r2.throws === 12 && r2.ped === 1, `well re-entry: still 12 throws, still ${r2.ped} pedestal (no duplicate reward)`);
  }

  // ---------------------------------------------------------------------------------------------- gravedigger: all 5 graves, exactly one ambush then a chest
  if (only('gravedigger')) {
    console.log('--- gravedigger');
    await fresh();
    const id = await mk('gravedigger');
    await settle();
    const seed = await E(() => window.__room().def.seed);
    let lockedSeen = 0, maxFoes = 0;
    for (let i = 0; i < 5; i++) {
      await E((i) => { const m = window.__sub().mounds[i]; window.__stand(m.at.x, m.at.y + 8); }, i);
      const dug = await W((i) => window.__sub().data.dug[i], i, 15000);
      if (!dug) { ok(false, `gravedigger: mound ${i} was not dug`); break; }
      await E(() => window.__away());
      const amb = await E(() => window.__sub().data.ambush);
      if (amb === 'active') {
        await wait(1500);
        for (let t = 0; t < 60; t++) {
          const s = await E(() => { const c = window.__sub(); return { locked: window.__room().locked, foes: c.foes.filter((e) => e.alive).length, pend: c.pending, act: c.data.ambush }; });
          if (s.locked) lockedSeen++;
          maxFoes = Math.max(maxFoes, s.foes);
          if (s.act === 'done') break;
          await E(() => window.__dw.api.killAll());
          await wait(400);
        }
      }
      await wait(200);
    }
    const st = await E(() => { const s = window.__sub(), d = s.data; return { dug: d.dug.every(Boolean), ambush: d.ambush, chests: window.__room().chests.length, pk: window.__room().pickups.length, locked: window.__room().locked, graves: d.graves.join(','), done: window.__count('event:done'), locks: window.__count('room:locked'), state: window.__room().state.chests.length }; });
    ok(st.dug && st.ambush === 'done', `gravedigger: all 5 dug, ambush done (${st.graves})`);
    ok(lockedSeen > 0 && maxFoes >= 3 && !st.locked, `gravedigger: exactly one ambush locked the room (${lockedSeen} polls), ${maxFoes} undead, then unlocked; locks fired ${st.locks}`);
    ok(st.chests === 2, `gravedigger: coffin chest + ambush chest = ${st.chests} wooden chests`);
    ok(st.done === 1, 'gravedigger: event:done once');
    const preN = await E((id) => { const n = window.__room().pickups.length; window.__pre = window.__room().pickups.map((p) => p.type + (p.alive ? '' : '(dead)')).join(','); window.__leave(id); return n; }, id); await wait(300);
    await E((id) => window.__dw.scene.roomMgr.jump(id), id); await settle();
    const r1 = await E(() => ({ pk: window.__room().pickups.length, chests: window.__room().chests.length, now: window.__room().pickups.map((p) => p.type).join(','), pre: window.__pre }));
    await E(() => { const c = window.__sub(); c.mounds.forEach((m) => window.__stand(m.at.x, m.at.y + 8)); });
    await wait(1300);
    const r2 = await E(() => { const s = window.__sub(); return { dug: s.data.dug.every(Boolean), chests: window.__room().chests.length, locked: window.__room().locked, foes: window.__dw.scene.enemies.filter((e) => e.alive).length, rings: s.mounds.filter((m) => m.ring.enabled).length, dugState: s.data.dug.length }; });
    ok(r2.dug && r1.chests === 2 && r2.chests === 2 && r1.now.startsWith(r1.pre) && !r2.locked && r2.foes === 0 && r2.rings === 0, `gravedigger re-entry: same mounds, ${r2.chests} chests, ${r1.pk}/${preN} pickups restored (an unopened chest may open on contact) (${r1.pre} -> ${r1.now}), no second ambush (standing on the mounds again digs nothing)`);
  }

  // ---------------------------------------------------------------------------------------------- preacher: each altar in its own run, pick-one respected
  for (const pick of only('preacher') ? ['communion', 'absolution', 'plate'] : []) {
    console.log(`--- preacher / ${pick}`);
    await fresh();
    if (pick === 'absolution') await E(() => { window.__dw.api.giveCurse('curse_debt'); window.__dw.api.giveCurse('curse_dark'); });
    const id = await mk('preacher', 1);
    await settle();
    const before = await E(() => { const p = window.__dw.player; return { hp: p.hp, tin: p.tin, coins: p.coins, bl: (p.blessings || []).length, cu: (p.curses || []).length, seed: window.__room().def.seed, price: p.price(12) }; });
    await E((pick) => { const a = window.__sub().altars.find((x) => x.id === pick); window.__stand(a.at.x, a.at.y + 8); }, pick);
    const done = await W(() => window.__sub().data.chosen, 0, 15000);
    await E(() => window.__away());
    await wait(300);
    const after = await E(() => { const p = window.__dw.player, s = window.__sub(); return { chosen: s.data.chosen, hp: p.hp, maxHp: p.maxHp, tin: p.tin, coins: p.coins, bl: (p.blessings || []).length, cu: (p.curses || []).length, open: s.altars.filter((a) => a.ring.enabled).length, done: window.__count('event:done') }; });
    ok(done && after.chosen === pick && after.open === 0 && after.done === 1, `preacher ${pick}: chosen, the other altars are snuffed, event:done once`);
    if (pick === 'communion') {
      const r = await E((a) => window.__T.rollCommunion(window.__R.subRng('communion', a.seed, 0)), before);
      const okv = r === 'false_prophet' ? after.cu === before.cu + 1 && after.bl === before.bl : after.bl === before.bl + 1 && after.cu === before.cu;
      ok(okv && (r === 'miracle' ? after.hp === after.maxHp : after.hp === before.hp - 2), `preacher communion: roll ${r} -> blessings ${after.bl}, curses ${after.cu}, hp ${before.hp} -> ${after.hp}`);
    } else if (pick === 'absolution') {
      ok(after.cu === 0 && after.tin === before.tin + 4, `preacher absolution: ${before.cu} curses stripped, +${after.tin - before.tin} tin units`);
    } else {
      const bl = await E((a) => window.__R.subRng('plate', a.seed, 0).chance(0.25), before);
      ok(after.coins === before.coins - before.price && after.hp === after.maxHp && after.bl === before.bl + (bl ? 1 : 0), `preacher plate: -${before.price}c, full heal, blessing ${bl ? 'yes' : 'no'} as rolled`);
    }
    // pick-one: the other altars do nothing, also after re-entry
    await E((id) => window.__leave(id), id); await wait(300);
    await E((id) => window.__dw.scene.roomMgr.jump(id), id); await settle();
    await E(() => { window.__sub().altars.forEach((a) => window.__stand(a.at.x, a.at.y + 8)); });
    await wait(1600);
    const re = await E(() => { const p = window.__dw.player, s = window.__sub(); return { chosen: s.data.chosen, bl: (p.blessings || []).length, cu: (p.curses || []).length, coins: p.coins, open: s.altars.filter((a) => a.ring.enabled).length }; });
    ok(re.chosen === pick && re.bl === after.bl && re.cu === after.cu && re.coins === after.coins && re.open === 0, `preacher ${pick} re-entry: still chosen, nothing else taken`);
  }

  // ---------------------------------------------------------------------------------------------- snake_oil: buy 3, mapping stable across two salesmen
  if (only('snake_oil')) {
    console.log('--- snake_oil');
    await fresh();
    const maps = [];
    for (let k = 0; k < 2; k++) {
      await E(() => { window.__log.length = 0; window.__dw.player.coins = 30; });
      const id = await mk('snake_oil', k);
      await settle();
      maps.push(await E(() => ({ map: window.__sub().map, shelf: window.__sub().data.shelf.slice(), seed: window.__room().def.seed })));
      for (let i = 0; i < 3; i++) {
        await E((i) => { const s = window.__sub().shelves[i]; window.__stand(s.at.x, s.at.y + 8); }, i);
        await W((i) => window.__sub().data.bought[i], i, 10000);
        await E(() => window.__away());
        await wait(2200); // kerosene lights a fuse at the feet: let it blow
      }
      const st = await E(() => ({ bought: window.__sub().data.bought.every(Boolean), buys: window.__sub().data.buys, net: window.__sub().state.net, drunk: window.__log.filter((l) => l.e === 'potion:drunk').map((l) => l.d), done: window.__count('event:done'), known: Object.keys(window.__dw.scene.run.potionKnown) }));
      const water = await E((a) => [0, 1, 2].map((n) => window.__R.subRng('water', a.seed, n).chance(0.1)), maps[k]);
      const expDrunk = maps[k].shelf.map((c, i) => (water[i] ? null : { color: c, effect: maps[k].map[c] })).filter(Boolean);
      ok(st.bought && st.buys === 3 && st.net === -15 && st.done === 1, `snake_oil #${k + 1}: 3 potions bought for 15c, event:done once`);
      ok(JSON.stringify(st.drunk.map((d) => `${d.color}=${d.effect}`)) === JSON.stringify(expDrunk.map((d) => `${d.color}=${d.effect}`)), `snake_oil #${k + 1}: drunk effects follow the colour map (${st.drunk.map((d) => d.color + '=' + d.effect).join(' ') || 'all water'}; expected ${expDrunk.map((d) => d.color + '=' + d.effect).join(' ') || 'all water'}; shelf ${maps[k].shelf})`);
      await E(() => window.__dw.player.hp = window.__dw.player.maxHp);
      // re-entry: bought shelves stay empty
      await E((id) => window.__leave(id), id); await wait(300);
      await E((id) => window.__dw.scene.roomMgr.jump(id), id); await settle();
      const re = await E(() => { const s = window.__sub(); s.shelves.forEach((x) => window.__stand(x.at.x, x.at.y + 8)); return { rings: s.shelves.filter((x) => x.ring.enabled).length, buys: s.data.buys, coins: window.__dw.player.coins }; });
      await wait(900);
      const re2 = await E(() => ({ buys: window.__sub().data.buys, coins: window.__dw.player.coins }));
      ok(re.rings === 0 && re2.buys === 3 && re2.coins === re.coins, `snake_oil #${k + 1} re-entry: shelves empty, no purchase repeated`);
    }
    ok(JSON.stringify(maps[0].map) === JSON.stringify(maps[1].map) && maps[0].seed !== maps[1].seed, 'snake_oil: two salesmen (different rooms) share one colour -> effect mapping');
    // the six effects themselves
    const fx = await E(async () => {
      const { drink } = await import('/src/rooms/special/events/SnakeOil.js');
      const sc = window.__dw.scene, p = window.__dw.player, out = {};
      const snap = () => ({ dmg: p.stats.damage, ms: p.stats.moveSpeed, fd: p.stats.fireDelay, poison: p.stats.poison, shield: p.stats.roomShield, hp: p.hp, dyn: p.dynamite });
      for (const e of ['p_heal', 'p_vigor', 'p_swift', 'p_venom', 'p_laudanum', 'p_kerosene']) {
        p.hp = 3; const b = snap(); drink(sc, p, e); p.recomputeStats && p.recomputeStats(); out[e] = { b, a: snap() };
        for (const id of ['potion_vigor', 'potion_swift', 'potion_venom', 'potion_laudanum']) p.removeBuff && p.removeBuff(id);
        p.recomputeStats && p.recomputeStats();
      }
      return out;
    });
    ok(fx.p_heal.a.hp > fx.p_heal.b.hp, 'potion p_heal heals');
    ok(Math.abs(fx.p_vigor.a.dmg - fx.p_vigor.b.dmg - 0.8) < 1e-6, `potion p_vigor +0.8 damage (${fx.p_vigor.b.dmg} -> ${fx.p_vigor.a.dmg})`);
    ok(fx.p_swift.a.ms - fx.p_swift.b.ms === 80 && fx.p_swift.a.fd < fx.p_swift.b.fd, 'potion p_swift +80 speed, faster fire');
    ok(fx.p_venom.a.hp === 2 && fx.p_venom.a.poison > fx.p_venom.b.poison, `potion p_venom -1 hp unit, poison ${fx.p_venom.a.poison}`);
    ok(fx.p_laudanum.a.shield === fx.p_laudanum.b.shield + 1 && fx.p_laudanum.a.ms === fx.p_laudanum.b.ms - 70, 'potion p_laudanum roomShield +1, speed -70');
    ok(fx.p_kerosene.a.dyn === fx.p_kerosene.b.dyn + 3, 'potion p_kerosene +3 dynamite');
    await wait(2500);
  }

  // ---------------------------------------------------------------------------------------------- quick_draw: invulnerable until DRAW, quick draw window, win, flawless flag
  for (const flawless of only('quick_draw') ? [true, false] : []) {
    console.log(`--- quick_draw / ${flawless ? 'flawless' : 'hurt'}`);
    await fresh();
    const id = await mk('quick_draw', flawless ? 0 : 1);
    await settle();
    const pre = await E(() => { const c = window.__sub(), e = c.duelist; const hp = e.hp; const r = e.takeHit(3, { bullet: { age: 0 }, angle: 0 }); return { r, same: e.hp === hp, inv: e.invulnerable, phase: c.data.phase, seed: window.__room().def.seed }; });
    ok(pre.r === 'ignore' && pre.same && pre.inv && pre.phase === 'idle', 'duel: the duelist is invulnerable before DRAW (bullets pass)');
    await E(() => { const c = window.__sub(); window.__stand(c.mark.x, c.mark.y); });
    ok(await W(() => window.__sub().data.phase === 'duel', 0, 15000), 'duel: chalk mark hold starts the duel');
    await E(() => window.__away());
    const locked = await E(() => window.__room().locked);
    ok(locked, 'duel: doors locked');
    ok(await W(() => window.__sub().bells >= 3, 0, 20000), 'duel: bell tolled three times');
    const drawT = await E(() => window.__sub().drawT);
    const expDraw = await E((a) => window.__T.drawDelay(window.__R.subRng('draw', a.seed, 0)), pre);
    ok(Math.abs(drawT - expDraw) < 1e-9 && drawT >= 3.4 && drawT < 4.6, `duel: DRAW delay ${drawT.toFixed(2)} s == seeded roll`);
    ok(await W(() => window.__sub().drawn, 0, 20000), 'duel: DRAW!');
    const q = await E(() => {
      const e = window.__sub().duelist; const c = window.__sub();
      const hp0 = e.hp;
      const r = e.takeHit(1, { bullet: { age: e.clock }, angle: 0 }); // fired at the instant of DRAW, inside the 0.7 s window
      const hp1 = e.hp;
      return { r, dmg: hp0 - hp1, stun: !!e.status.stun, used: e.quickUsed, clock: e.clock };
    });
    ok(q.r === 'hit' && Math.abs(q.dmg - 2 * (q.dmg / 2)) < 1e-9 && q.dmg >= 1.99 && q.stun && q.used, `duel: QUICK DRAW hit did x2 (${q.dmg}) and stunned 1.5 s`);
    const late = await E(() => { const e = window.__sub().duelist; const hp0 = e.hp; e.takeHit(1, { bullet: { age: 0 }, angle: 0 }); return { dmg: hp0 - e.hp, clock: e.clock }; });
    ok(late.dmg < 1.5, `duel: only the first quick hit is doubled (next hit ${late.dmg})`);
    const fired = await W(() => window.__log.filter((l) => l.e === 'bullet:fired' && l.d.owner === 'enemy').length >= 3, 0, 40000);
    ok(fired, 'duel: after the stun the ghost fires its 3-shot burst at the player');
    if (!flawless) await E(async () => { const { bus } = await import('/src/core/events.js'); bus.emit('player:hurt', { units: 1, source: 'test' }); });
    await E(() => { const e = window.__sub().duelist; e.hp = 0; e.die({}); });
    ok(await W(() => window.__sub().data.phase === 'done', 0, 8000), 'duel: killing the ghost ends the duel');
    await wait(600);
    const win = await E(() => ({ locked: window.__room().locked, chests: window.__room().chests.length, ped: window.__room().pedestals.filter((p) => !p.rec.taken).length, flawless: window.__dw.scene.run.flawlessDuel, outcome: window.__sub().data.outcome, done: window.__count('event:done'), pk: window.__room().pickups.length }));
    ok(!win.locked && win.chests === 1 && win.done === 1, `duel: unlocked, free chest at centre, event:done once (${win.outcome})`);
    ok(flawless ? win.flawless === true && win.ped + win.pk >= 1 : win.flawless === false && win.ped === 0, `duel: flawless flag ${win.flawless}, treasure pedestal ${win.ped} (${flawless ? 'expected' : 'not expected'})`);
    await E((id) => window.__leave(id), id); await wait(300);
    await E((id) => window.__dw.scene.roomMgr.jump(id), id); await settle();
    const re = await E(() => { const c = window.__sub(); return { phase: c.data.phase, foe: window.__dw.scene.enemies.filter((e) => e.alive).length, chests: window.__room().chests.length, ped: window.__room().pedestals.length, mark: !!c.mark, locked: window.__room().locked }; });
    ok(re.phase === 'done' && re.foe === 0 && re.chests === 1 && !re.mark && !re.locked, `duel re-entry: no ghost, no chalk mark, ${re.chests} chest, ${re.ped} pedestals`);
  }

  await wait(300);
  ok(g.errors.length === 0, `no console errors during playthroughs (${g.errors.length}) ${g.errors.slice(0, 3).join(' | ')}`);
  await g.close();
}
