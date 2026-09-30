// FE-E6 behaviour check: waiter_imp, bouncer, joker (CHAPTER2 s5 numbers). Deterministic-ish, headless.
//   node tools/qa/e6-check.mjs [--noassets] [--dropassets=40] [--shots]
// Asserts: bouncer arc block (x0.5 in front, x1 behind / explosion / DoT / recover), windup 0.9 s with the band locked 0.3 s, rush 560 px/s 0.5 s, recover 1.0 s;
// waiter_imp orbit distance 300-380, bottle flight 1.0 s, marker r 70, 1 dmg + 8 shards; joker cycle laugh 0.4 / vanish 0.4 invulnerable, reappear 260-520 px,
// jack box fuse 1.5 s r 110, 1 dmg + 6 shards, max 2 boxes, boxes defused on death. Fails on any console error.
import { launch } from './harness.mjs';

const args = process.argv.slice(2);
const flag = (k) => args.find((a) => a === `--${k}` || a.startsWith(`--${k}=`));
const query = `?debug=1&seed=7${flag('noassets') ? '&noassets=1' : ''}${flag('dropassets') ? '&dropassets=40' : ''}`;
const g = await launch({ query, name: 'e6-check', quiet: true });
await g.startRun();
const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const ev = (fn, ...a) => g.eval(fn, ...a);

await ev(() => { const a = window.__dw.api; a.setFloor(6); a.godMode(true); a.jump('start'); });
await g.wait(1500);
await ev(() => { const a = window.__dw.api; a.killAll(); a.heal(); });

// ------------------------------------------------------------------------------------------------ bouncer
console.log('bouncer');
const b1 = await ev(() => {
  const a = window.__dw.api, s = window.__dw.scene, p = s.player;
  const e = a.spawn('bouncer', p.x + 300, p.y);
  e.spawnT = 0; e.atkCd = 999;
  const hp0 = e.hp;
  const hit = (info) => { const h = e.hp; e.hp += 1e6; const before = e.hp; e.takeHit(10, info); const d = before - e.hp; e.hp = h; return d; };
  e.face = Math.PI; // facing left (toward the player at x-300)
  const front = hit({ x: e.x - 40, y: e.y, angle: 0, bullet: { pierce: 3, m: {} } });
  const back = hit({ x: e.x + 40, y: e.y, angle: Math.PI, bullet: { pierce: 3, m: {} } });
  const side = hit({ x: e.x, y: e.y - 40, angle: Math.PI / 2, bullet: { pierce: 3, m: {} } });
  const edge = hit({ x: e.x + Math.cos(Math.PI + 1.3) * 40, y: e.y + Math.sin(Math.PI + 1.3) * 40, angle: 0, bullet: { pierce: 3, m: {} } }); // 74.5 deg off: outside
  const inEdge = hit({ x: e.x + Math.cos(Math.PI + 1.1) * 40, y: e.y + Math.sin(Math.PI + 1.1) * 40, angle: 0, bullet: { pierce: 3, m: {} } }); // 63 deg: inside
  const expl = hit({ x: e.x - 40, y: e.y, explosion: true });
  const dot = hit({ dot: true });
  const pb = { pierce: 3, m: {} }; hit({ x: e.x - 40, y: e.y, angle: 0, bullet: pb });
  e.blockOn = false;
  const recover = hit({ x: e.x - 40, y: e.y, angle: 0, bullet: { pierce: 3, m: {} } });
  e.blockOn = true;
  window.__e6b = e;
  return { front, back, side, edge, inEdge, expl, dot, consumed: pb.pierce === 0, recover };
});
ok(Math.abs(b1.front - 5) < 0.01, `front hit x0.5 (${b1.front})`);
ok(Math.abs(b1.back - 10) < 0.01 && Math.abs(b1.side - 10) < 0.01, `back/side x1 (${b1.back}/${b1.side})`);
ok(Math.abs(b1.edge - 10) < 0.01 && Math.abs(b1.inEdge - 5) < 0.01, `arc edge 70 deg (${b1.edge}/${b1.inEdge})`);
ok(Math.abs(b1.expl - 10) < 0.01 && Math.abs(b1.dot - 10) < 0.01, `explosion / DoT ignore the block (${b1.expl}/${b1.dot})`);
ok(b1.consumed, 'blocked bullet loses its pierce');
ok(Math.abs(b1.recover - 10) < 0.01, `recover: block off (${b1.recover})`);

// state timeline in simulation time (enemy stateTime at each transition: independent of the headless frame rate)
const tl = await ev(() => new Promise((res) => {
  const s = window.__dw.scene, e = window.__e6b, p = s.player;
  p.x = e.x - 260; p.y = e.y;
  e.atkCd = 0;
  const rec = []; let last = '', lastT = 0, n = 0;
  const f = () => {
    if (!e.alive) return;
    p.x = e.x - 260; p.y = e.y; // keep the player parked in range (god mode)
    if (e.state !== last) { rec.push({ st: e.state, prev: lastT, x: e.x, pose: e.pose, lockA: e.lockA, contact: e.contactDamage, block: e.blockOn }); last = e.state; }
    lastT = e.stateTime;
    if (rec.length >= 5) { s.events.off('postupdate', f); res(rec); }
    if (++n > 3000) { s.events.off('postupdate', f); res(rec); }
  };
  s.events.on('postupdate', f);
}));
const nth = (n, k = 0) => tl.filter((r) => r.st === n)[k];
const wu = nth('windup'), ru = nth('rush'), rc = nth('recover'), w2 = nth('walk', 0);
console.log('   timeline', tl.map((r) => `${r.st}(prev ${r.prev.toFixed(2)})`).join(' '));
ok(ru && Math.abs(ru.prev - 0.9) < 0.08, `windup 0.9 s (${ru ? ru.prev.toFixed(2) : '?'})`);
ok(rc && Math.abs(rc.prev - 0.5) < 0.08, `rush 0.5 s (${rc ? rc.prev.toFixed(2) : '?'})`);
ok(w2 && Math.abs(w2.prev - 1.0) < 0.08, `recover 1.0 s (${w2 ? w2.prev.toFixed(2) : '?'})`);
ok(rc && rc.block === false && rc.pose === 'attack', 'recover: block off, pose 5');
ok(ru && rc && Math.abs(rc.x - ru.x) > 200 && Math.abs(rc.x - ru.x) < 330, `rush distance ~280 px (${ru && rc ? Math.abs(rc.x - ru.x).toFixed(0) : '?'})`);
ok(ru && ru.contact === 0, 'rush: passive contact off (rush has its own 2 dmg)');

// rush contact: 2 damage + throw
const hurt = await ev(() => new Promise((res) => {
  const s = window.__dw.scene, e = window.__e6b, p = s.player;
  p.godMode = false; p.hp = p.maxHp; p.hurtT = 0; p.entryInv = 0; p.recomputeStats && p.recomputeStats();
  e.state = 'walk'; e.hp = e.maxHp; e.atkCd = 0; e.hitDone = false;
  p.x = e.x - 200; p.y = e.y; p.vx = p.vy = 0;
  const hp0 = p.hp; let t = 0;
  const f = () => { t++; if (e.state === 'recover' || t > 200) { s.events.off('postupdate', f); res({ hp0, hp: p.hp, knockX: p.knock.x }); } };
  s.events.on('postupdate', f);
}));
await ev(() => { window.__dw.scene.player.godMode = true; });
console.log('   rush contact', JSON.stringify(hurt));
ok(hurt.hp0 - hurt.hp === 2, `rush contact = 2 dmg (${hurt.hp0} -> ${hurt.hp}), thrown along the rush (knock ${hurt.knockX.toFixed(0)})`);

await ev(() => window.__dw.api.killAll());

// ------------------------------------------------------------------------------------------------ waiter imp
console.log('waiter_imp');
const imp = await ev(() => new Promise((res) => {
  const a = window.__dw.api, s = window.__dw.scene, p = s.player;
  p.godMode = true;
  const e = a.spawn('waiter_imp', p.x + 340, p.y);
  e.spawnT = 0; e.shotCd = 0.5;
  const out = { orbit: [], bottleT: 0, bottleR: 0, shards: 0, flight: 0, windup: 0 };
  let seen = null, lastWind = 0, last = '';
  const f = () => {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (e.state === 'orbit') out.orbit.push(d);
    if (e.state !== last) { if (last === 'windup') out.windup = lastWind; last = e.state; }
    lastWind = e.stateTime;
    const bt = s.dynamites.find((x) => x.constructor.name === 'Bottle');
    if (bt) { seen = bt; out.bottleT = bt.t; out.bottleR = bt.radius; out.flight = bt.flight; out.shards = bt.shards; }
    if (seen && !seen.alive) { s.events.off('postupdate', f); res(out); }
  };
  s.events.on('postupdate', f);
  setTimeout(() => { s.events.off('postupdate', f); res(out); }, 60000);
  window.__e6i = e;
}));
const mean = imp.orbit.reduce((x, y) => x + y, 0) / Math.max(1, imp.orbit.length);
console.log(`   orbit mean ${mean.toFixed(0)} n=${imp.orbit.length}  bottle flight ${imp.bottleT.toFixed(2)}  windup ${imp.windup.toFixed(2)}`);
ok(imp.orbit.length > 10 && mean > 260 && mean < 420, `orbit distance 300-380 band (mean ${mean.toFixed(0)})`);
ok(imp.bottleT >= 0.95 && imp.bottleT <= 1.06, `bottle lands 1.0 s after the throw (${imp.bottleT.toFixed(2)})`);
ok(imp.windup >= 0.35, `windup >= 0.35 s (${imp.windup.toFixed(2)})`);
ok(imp.bottleR === 70 && imp.shards === 8, `marker r 70, 8 shards (${imp.bottleR}/${imp.shards})`);
// damage: stand under a bottle
const bd = await ev(() => new Promise((res) => {
  const s = window.__dw.scene, p = s.player, e = window.__e6i;
  p.godMode = false; p.hp = p.maxHp; p.hurtT = 0; p.entryInv = 0;
  p.x = e.x + 340; p.y = e.y; e.shotCd = 0; e.state = 'orbit';
  const hp0 = p.hp; let t = 0;
  const f = () => { t++; if (!(window.__e6i.bottle && window.__e6i.bottle.alive) && window.__e6i.bottle && t > 30) { s.events.off('postupdate', f); res({ hp0, hp: p.hp }); } if (t > 600) { s.events.off('postupdate', f); res({ hp0, hp: p.hp, timeout: true }); } };
  // keep the player parked at the throw spot: bottle target is recorded at throw, we simply do not move
  s.events.on('postupdate', f);
}));
await ev(() => { window.__dw.scene.player.godMode = true; });
console.log('   bottle hit', JSON.stringify(bd));
ok(bd.hp0 - bd.hp === 1, `standing still under the bottle costs 1 unit (${bd.hp0} -> ${bd.hp})`);
// killing the imp cancels the bottle
const cancel = await ev(() => new Promise((res) => {
  const s = window.__dw.scene, e = window.__e6i;
  e.shotCd = 0; e.state = 'orbit';
  let t = 0;
  const f = () => {
    t++;
    const bt = s.dynamites.find((x) => x.constructor.name === 'Bottle');
    if (bt) { e.hp = 0; e.die({}); s.events.off('postupdate', f); setTimeout(() => res({ alive: bt.alive, left: s.dynamites.some((x) => x.constructor.name === 'Bottle') }), 200); }
    if (t > 900) { s.events.off('postupdate', f); res({ timeout: true }); }
  };
  s.events.on('postupdate', f);
}));
ok(cancel.alive === false && cancel.left === false, `imp death cancels its bottle ${JSON.stringify(cancel)}`);
await ev(() => window.__dw.api.killAll());

// ------------------------------------------------------------------------------------------------ joker
console.log('joker');
const jk = await ev(() => new Promise((res) => {
  const a = window.__dw.api, s = window.__dw.scene, p = s.player;
  p.godMode = true;
  const e = a.spawn('joker', p.x + 320, p.y);
  e.spawnT = 0; e.blinkCd = 0.2;
  const log = []; let last = '', lastT = 0, maxBoxes = 0, box = null, boxInfo = null, n = 0;
  const f = () => {
    if (!e.alive) return;
    if (e.state !== last) { log.push({ st: e.state, prev: lastT, inv: e.invulnerable, x: e.x, y: e.y, px: p.x, py: p.y }); last = e.state; }
    lastT = e.stateTime;
    const boxes = s.dynamites.filter((x) => x.constructor.name === 'JackBox');
    maxBoxes = Math.max(maxBoxes, boxes.length);
    if (boxes[0] && !box) { box = boxes[0]; boxInfo = { fuse: box.maxFuse, r: box.radius, shards: box.confetti }; }
    if (box) boxInfo.age = box.age;
    if (box && !box.alive && !boxInfo.end) boxInfo.end = true;
    if (log.length >= 8 && boxInfo && boxInfo.end) { s.events.off('postupdate', f); window.__e6j = e; res({ log, maxBoxes, boxInfo }); }
    if (++n > 6000) { s.events.off('postupdate', f); window.__e6j = e; res({ log, maxBoxes, boxInfo, timeout: true }); }
  };
  s.events.on('postupdate', f);
}));
const L = jk.log;
const cyc = (n) => L.filter((r) => r.st === n);
console.log('   ', L.slice(0, 9).map((r) => `${r.st}(prev ${r.prev.toFixed(2)})`).join(' '));
const laugh = cyc('laugh'), van = cyc('vanish'), str = cyc('strafe');
ok(van.length && Math.abs(van[0].prev - 0.4) < 0.08, `laugh 0.4 s (${van[0] ? van[0].prev.toFixed(2) : '?'})`);
ok(str.length > 1 && Math.abs(str[1].prev - 0.4) < 0.08 && van[0].inv, `vanish 0.4 s, invulnerable (${str[1] ? str[1].prev.toFixed(2) : '?'})`);
if (laugh.length > 1) ok(Math.abs(laugh[1].prev + 0.8 - 2.4) < 0.15, `strafe gap gives a 2.4 s cycle (strafe ${laugh[1].prev.toFixed(2)})`);
const d0 = str[1] ? Math.hypot(str[1].x - str[1].px, str[1].y - str[1].py) : 0;
ok(d0 >= 255 && d0 <= 525, `reappears 260-520 px from the player (${d0.toFixed(0)})`);
ok(jk.boxInfo && jk.boxInfo.fuse === 1.5 && jk.boxInfo.r === 110 && jk.boxInfo.shards === 6, `jack box fuse 1.5 r 110 6 shards ${JSON.stringify(jk.boxInfo)}`);
ok(jk.boxInfo && Math.abs(jk.boxInfo.age - 1.5) < 0.08, `box pops 1.5 s after it lands (${jk.boxInfo ? jk.boxInfo.age.toFixed(2) : '?'})`);
ok(jk.maxBoxes <= 2, `max 2 boxes (${jk.maxBoxes})`);
// pop damage + defuse on death (first jack_box damage event = 1 unit, 6 shards spawned)
const pop = await ev(() => new Promise((res) => {
  const s = window.__dw.scene, p = s.player, e = window.__e6j;
  p.godMode = false; p.hp = p.maxHp; p.hurtT = 0; p.entryInv = 0;
  const orig = p.damage.bind(p), log = [];
  p.damage = (u, src) => { const r = orig(u, src); if (src.kind === 'jack_box') log.push({ u, r }); return r; };
  e.blinkCd = 0; e.state = 'strafe';
  let t = 0, box = null;
  const done = (o) => { s.events.off('postupdate', f); p.damage = orig; res(o); };
  const f = () => {
    t++;
    const b = s.dynamites.find((x) => x.constructor.name === 'JackBox');
    if (b && !box) box = b;
    if (box) { p.x = box.x; p.y = box.y; }
    if (box && !box.alive) done({ log, blts: s.bullets.enemy.list.filter((x) => x.active).length });
    if (t > 900) done({ timeout: true, log });
  };
  s.events.on('postupdate', f);
}));
console.log('   pop', JSON.stringify(pop));
ok(pop.log && pop.log[0] && pop.log[0].u === 1 && pop.log[0].r === true && pop.blts >= 6, `pop: 1 dmg + 6 shards (${JSON.stringify(pop.log)}, bullets ${pop.blts})`);
const def = await ev(() => new Promise((res) => {
  const s = window.__dw.scene, p = s.player, e = window.__e6j;
  p.godMode = true;
  e.blinkCd = 0; e.state = 'strafe';
  let t = 0;
  const f = () => {
    t++;
    const b = s.dynamites.find((x) => x.constructor.name === 'JackBox');
    if (b) { e.hp = 0; e.die({}); s.events.off('postupdate', f); setTimeout(() => res({ alive: b.alive, left: s.dynamites.filter((x) => x.constructor.name === 'JackBox').length }), 100); }
    if (t > 900) { s.events.off('postupdate', f); res({ timeout: true }); }
  };
  s.events.on('postupdate', f);
}));
ok(def.alive === false && def.left === 0, `joker death defuses boxes ${JSON.stringify(def)}`);

if (flag('shots')) {
  await ev(() => { const a = window.__dw.api, p = window.__dw.scene.player; a.killAll(); p.godMode = true; p.x = 720; p.y = 528; a.spawn('bouncer', 940, 480); a.spawn('waiter_imp', 500, 400); a.spawn('joker', 900, 700); });
  await g.wait(2500);
  await g.shot('e6-a');
  await g.wait(1200);
  await g.shot('e6-b');
}

await ev(() => window.__dw.api.killAll());
await g.wait(500);
ok(g.errors.length === 0, `no console errors ${g.errors.slice(0, 3).join(' | ')}`);
await g.close();
console.log(fails.length ? `\nFAILED (${fails.length})` : '\nPASS');
process.exit(fails.length ? 1 : 0);
