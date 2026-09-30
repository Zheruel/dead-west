// QA-1 rider mechanics (CHARACTERS_META G3) + Hell numbers (G9). node tools/qa/qa1-riders.mjs [preacher|hunter|queen|hell]
import { boot } from './spec-lib.mjs';
import { check, results } from './qa1-lib.mjs';

const which = process.argv[2] || 'all';
const run = (w) => which === 'all' || which === w;

async function preacher() {
  const g = await boot('?debug=1&seed=42&char=preacher');
  await g.wait(800);
  const r = await g.eval(() => {
    const sc = window.__dw.scene, p = sc.player, api = window.__dw.api, o = {};
    o.tin0 = p.tin; o.hp0 = p.hp; o.pellets = p.stats.bulletCount; o.spread = p.stats.spreadDeg; o.plating = p.stats.tinPlating; o.undead = p.stats.undeadDamageMult; o.flat = p.stats.damage;
    const hit = (u, extra) => { p.hurtT = 0; p.entryInv = 0; p.godMode = false; const b = { hp: p.hp, tin: p.tin }; p.damage(u, { x: p.x + 1, y: p.y, ...(extra || {}) }); return { dtin: b.tin - p.tin, dhp: b.hp - p.hp }; };
    o.hit2 = hit(2); o.hit2b = hit(2); o.hitExpl = hit(2, { explosion: true });
    p.tin = 0; o.hit2NoTin = hit(2);
    p.tin = 4; p.hp = p.maxHp; p.hurtT = 0;
    return o;
  });
  console.log('   preacher', JSON.stringify(r));
  check('RID preacher 5 pellets, spread 9', r.pellets === 5 && r.spread === 9, JSON.stringify(r));
  check('RID preacher tin plating: 2-unit hit costs 1 tin, 0 hp', r.hit2.dtin === 1 && r.hit2.dhp === 0 && r.hit2b.dtin === 1 && r.hit2b.dhp === 0, JSON.stringify([r.hit2, r.hit2b]));
  check('RID preacher tin plating covers explosions', r.hitExpl.dtin === 1 && r.hitExpl.dhp === 0, JSON.stringify(r.hitExpl));
  check('RID preacher without tin a 2-unit hit costs 2 hp', r.hit2NoTin.dhp === 2, JSON.stringify(r.hit2NoTin));
  check('RID preacher undead x1.5', Math.abs(r.undead - 1.5) < 1e-6, String(r.undead));
  // volley size: fire once, count bullets
  const vol = await g.eval(() => {
    const sc = window.__dw.scene, p = sc.player, api = window.__dw.api;
    api.godMode(true);
    sc.gameInput.override = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 } };
    const c0 = sc.bullets.player.list ? sc.bullets.player.list.filter((b) => b.active).length : null;
    window.__step(4);
    const c1 = sc.bullets.player.list ? sc.bullets.player.list.filter((b) => b.active).length : null;
    sc.gameInput.override = { move: { x: 0, y: 0 }, aim: null };
    return { c0, c1, shots: sc.run.shots };
  });
  console.log('   volley', JSON.stringify(vol));
  // faith
  const f = await g.eval(() => {
    const sc = window.__dw.scene, p = sc.player, api = window.__dw.api;
    const fm = p.familiars.find((x) => 'faith' in x);
    if (!fm) return { err: 'no FaithMeter', fams: p.familiars.map((x) => x.constructor.name) };
    const out = { start: fm.faith, steps: [] };
    for (let i = 0; i < 14; i++) {
      const e = api.spawn('coyote', p.x + 150, p.y);
      if (e) { e.hp = 0; e.die({}); }
      out.steps.push(Math.round(fm.faith * 10) / 10);
      if (fm.sanct > 0) break;
    }
    out.sanct = fm.sanct; out.buff = p.buffs.map((b) => b.id || b.name); out.pierce = p.stats.pierce; out.luck = p.stats.luck; out.bdm = p.stats.bulletDamageMult;
    return out;
  });
  console.log('   faith', JSON.stringify(f));
  check('RID preacher faith +8/kill, Sanctified at 100', !f.err && f.steps[0] === 8 && f.sanct > 7 && f.pierce >= 1 && f.bdm >= 1.5, JSON.stringify(f));
  await g.eval(() => window.__step(40 * 9)); // ~ 9 s at 33 ms
  const after = await g.eval(() => { const p = window.__dw.player; const fm = p.familiars.find((x) => 'faith' in x); return { sanct: fm.sanct, bdm: p.stats.bulletDamageMult, pierce: p.stats.pierce }; });
  check('RID preacher Sanctified expires after 8 s', after.sanct === 0 && after.bdm < 1.5, JSON.stringify(after));
  check('RID preacher no console errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
  await g.close();
}

async function hunter() {
  const g = await boot('?debug=1&seed=42&char=hunter');
  await g.wait(800);
  const rooms = await g.eval(() => window.__dw.floor.rooms.filter((r) => r.type === 'normal').map((r) => r.id).slice(0, 4));
  const marks = [];
  for (const id of rooms.slice(0, 3)) {
    await g.eval((id) => { const a = window.__dw.api; a.godMode(true); a.jump(id); }, id);
    // let the room start and its waves spawn
    let rec = { id, maxMarked: 0, waves: 0, enemies: 0 };
    for (let i = 0; i < 40; i++) {
      await g.wait(600);
      const s = await g.eval(() => { const sc = window.__dw.scene; const m = sc.enemies.filter((e) => e.marked && e.alive); return { marked: m.length, n: sc.enemies.length, mode: sc.room.mode, id: m[0] && m[0].id, maxHp: m[0] && m[0].maxHp, top: Math.max(0, ...sc.enemies.map((e) => e.maxHp || 0)), wave: sc.room.waveIdx }; });
      rec.maxMarked = Math.max(rec.maxMarked, s.marked); rec.last = s; if (s.marked === 1 && !rec.first) rec.first = s;
      if (s.mode === 'combat' && s.n > 0 && s.marked === 1) break;
    }
    marks.push(rec);
    // kill the marked enemy with a bullet-ish kill and look at the drops
    const pay = await g.eval(() => {
      const sc = window.__dw.scene, room = sc.room;
      const m = sc.enemies.find((e) => e.marked && e.alive);
      if (!m) return { none: true };
      const before = room.pickups.map((p) => p.type);
      m.hp = 0; m.die({ by: 'bullet' });
      const after = room.pickups.map((p) => p.type);
      const added = after.slice(before.length);
      return { id: m.id, added, all: after };
    });
    rec.pay = pay;
    console.log('   hunter room', JSON.stringify(rec));
    await g.eval(() => { const a = window.__dw.api; a.killAll(); });
  }
  check('RID hunter marks exactly 1 enemy per wave (max marked <= 1, >= 1 seen)', marks.every((m) => m.maxMarked === 1), JSON.stringify(marks.map((m) => m.maxMarked)));
  check('RID hunter marked target is the toughest enemy', marks.every((m) => !m.first || m.first.maxHp >= m.first.top - 1e-6), JSON.stringify(marks.map((m) => m.first)));
  check('RID hunter marked kill drops nickel + coin', marks.filter((m) => m.pay && !m.pay.none).every((m) => m.pay.added.includes('coin_nickel') && m.pay.added.includes('coin')), JSON.stringify(marks.map((m) => m.pay)));
  const st = await g.eval(() => { const p = window.__dw.player; return { markMult: p.stats.markMult, markBoss: p.stats.markBossMult, dyn: p.dynamite, dmg: p.stats.dynamiteDamage, fuse: p.stats.dynamiteFuse, maxHp: p.maxHp }; });
  check('RID hunter stats markMult 1.5 / boss 1.2, dyn 7', st.markMult === 1.5 && st.markBoss === 1.2 && st.dyn === 7, JSON.stringify(st));
  check('RID hunter no console errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
  await g.close();
}

async function queen() {
  const g = await boot('?debug=1&seed=42&char=queen');
  await g.wait(800);
  const r = await g.eval(() => {
    const sc = window.__dw.scene, p = sc.player, o = {};
    const read = () => ({ coins: p.coins, dmg: p.stats.damage + p.stats.coinDamage * p.coins, sixth: p.stats.sixthMult + p.stats.jackpotPerCoin * p.coins });
    p.coins = 0; o.c0 = read(); p.coins = 99; o.c99 = read();
    o.coinDamage = p.stats.coinDamage; o.dual = p.stats.dualGuns; o.killCoins = p.stats.jackpotKillCoins; o.dropBonus = p.stats.coinDropBonus; o.luck = p.stats.luck; o.every = p.stats.sixthEvery;
    p.coins = 10;
    return o;
  });
  console.log('   queen', JSON.stringify(r));
  check('RID queen 0 vs 99 coins damage and jackpot', Math.abs(r.c0.dmg - 2) < 1e-6 && Math.abs(r.c99.dmg - (2 + 0.008 * 99)) < 1e-6 && Math.abs(r.c0.sixth - 1.6) < 1e-6 && Math.abs(r.c99.sixth - 3.58) < 1e-6, JSON.stringify(r));
  check('RID queen dualGuns 1, jackpotKillCoins 3, coinDropBonus .08', r.dual === 1 && r.killCoins === 3 && Math.abs(r.dropBonus - 0.08) < 1e-6, JSON.stringify(r));
  // muzzle alternation: fire 4 shots and read bullet spawn y offsets
  const m = await g.eval(() => {
    const sc = window.__dw.scene, p = sc.player, api = window.__dw.api;
    api.godMode(true); api.killAll();
    p.x = 720; p.y = 480;
    sc.gameInput.override = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 } };
    const ys = [];
    const seen = new Set();
    for (let i = 0; i < 120 && ys.length < 6; i++) {
      window.__step(1);
      const list = sc.bullets.player.list || [];
      for (const b of list) if (b.active && !seen.has(b)) { seen.add(b); ys.push(Math.round((b.y - p.y) * 10) / 10); }
    }
    sc.gameInput.override = { move: { x: 0, y: 0 }, aim: null };
    return ys;
  });
  console.log('   muzzle y offsets', JSON.stringify(m));
  const alt = m.length >= 3 && m.every((v, i) => i === 0 || Math.sign(v - 0) !== 0) && new Set(m.map((v) => Math.sign(Math.round(v)))).size >= 2;
  check('RID queen dual muzzle alternates sides', alt, JSON.stringify(m));
  check('RID queen no console errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
  await g.close();
}

async function hell() {
  const out = {};
  for (const mode of ['normal', 'hell']) {
    const g = await boot(`?debug=1&seed=42&mode=${mode}`);
    await g.wait(600);
    out[mode] = await g.eval(() => {
      const sc = window.__dw.scene, api = window.__dw.api, p = sc.player;
      api.godMode(true);
      const e = api.spawn('coyote', p.x + 300, p.y);
      const b = { hp: e.maxHp, diff: sc.diff && { ...sc.diff }, hurtInvuln: p.stats.hurtInvuln, entry: p.stats.roomEntryInvuln };
      return b;
    });
    await g.close();
  }
  console.log('   normal', JSON.stringify(out.normal)); console.log('   hell', JSON.stringify(out.hell));
  const ratio = out.hell.hp / out.normal.hp;
  check('HELL enemy HP x1.30 on the same coyote', Math.abs(ratio - 1.3) < 0.02, String(ratio));
  check('HELL hurtInvuln .85', Math.abs(out.hell.hurtInvuln - 0.85) < 1e-6 && out.normal.hurtInvuln === 1, JSON.stringify([out.normal.hurtInvuln, out.hell.hurtInvuln]));
}

(async () => {
  try {
    if (run('preacher')) await preacher();
    if (run('hunter')) await hunter();
    if (run('queen')) await queen();
    if (run('hell')) await hell();
  } catch (e) { console.log('SCRIPT ERROR', e && e.stack || e); check('riders script completed', false, String(e).slice(0, 200)); }
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed`); for (const b of bad) console.log('FAILED:', b.name, b.detail);
  process.exit(0);
})();
