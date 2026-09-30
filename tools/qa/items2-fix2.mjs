// FIX-2 checks (engine+items): elite nameplates clamped / de-collided, peddler speech in the shop, per-rider shot sfx keys, coal/rock bullet halo.
//   node tools/qa/items2-fix2.mjs [--shots]
import { boot, reporter } from './items2-lib.mjs';
const { ok, r } = reporter();
const shots = process.argv.includes('--shots');
const g = await boot('items2-fix2', process.env.Q || '?debug=1&seed=42&unlockall=1');
const ev = (fn, ...a) => g.eval(fn, ...a);
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ---- elite nameplates: 8 elites stacked near the top wall and the right edge
await ev(async () => {
  const dw = window.__dw; dw.api.godMode(true); dw.api.killAll();
  const ids = ['coyote', 'rattlesnake', 'skeleton', 'bat', 'coyote', 'rattlesnake', 'skeleton', 'coyote'];
  const affs = [['armored'], ['cursed'], ['swift'], ['armored'], ['vampiric'], ['shielded'], ['volatile'], ['burning']];
  ids.forEach((id, i) => { const e = dw.api.spawn(id, i < 4 ? 420 + i * 30 : 1330, i < 4 ? 215 : 300 + (i - 4) * 20, { affixes: affs[i] }); if (e) { e.speed = 0; e.ai = () => {}; e.contactDamage = 0; } });
  window.__PLATE_T = performance.now();
});
await sleep(400);
const plates = await ev(() => window.__dw.scene.enemies.filter((e) => e._affix && e._affix.plate).map((e) => { const p = e._affix.plate; return { x: p.x, y: p.y, w: p.width * p.scaleX, h: p.height * p.scaleY }; }));
ok('elite plates spawned', plates.length >= 6, `${plates.length}`);
ok('plates inside screen (x margin 8, below HUD strip)', plates.every((p) => p.x - p.w / 2 >= 7.5 && p.x + p.w / 2 <= 1440 - 7.5 && p.y - p.h / 2 >= 98), JSON.stringify(plates.map((p) => [Math.round(p.x - p.w / 2), Math.round(p.y - p.h / 2), Math.round(p.x + p.w / 2)])));
let overlap = 0;
for (let i = 0; i < plates.length; i++) for (let j = i + 1; j < plates.length; j++) { const a = plates[i], b = plates[j]; if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 1) overlap++; }
ok('plates do not overlap each other', overlap === 0, `${overlap} overlaps`);
if (shots) await g.shot('fix2-plates');

// ---- shot sfx per rider
const shot = await ev(async () => {
  const { Sfx } = await import('/src/core/Audio.js');
  const dw = window.__dw, p = dw.player, out = {}, seen = [];
  const orig = Sfx.play.bind(Sfx); Sfx.play = (k, o) => { seen.push(k); return orig(k, o); };
  for (const c of ['gunslinger', 'preacher', 'hunter', 'queen']) {
    p._setCharBase(c); seen.length = 0; p.fireCd = 0; p.lastShotAt = -99; p.fire({ x: 1, y: 0 });
    out[c] = seen.filter((k) => k.startsWith('shoot'));
  }
  Sfx.play = orig; p._setCharBase('gunslinger');
  return out;
});
ok('gunslinger shoots plain `shoot`', shot.gunslinger.includes('shoot'), JSON.stringify(shot.gunslinger));
ok('preacher -> shoot_scatter', shot.preacher.includes('shoot_scatter'), JSON.stringify(shot.preacher));
ok('hunter -> shoot_rifle', shot.hunter.includes('shoot_rifle'), JSON.stringify(shot.hunter));
ok('queen -> shoot_twin', shot.queen.includes('shoot_twin'), JSON.stringify(shot.queen));

// ---- frozen kill + arc sounds
const snd = await ev(async () => {
  const { Sfx } = await import('/src/core/Audio.js');
  const dw = window.__dw, seen = [];
  const orig = Sfx.play.bind(Sfx); Sfx.play = (k, o) => { seen.push(k); return orig(k, o); };
  dw.api.killAll();
  const e = dw.api.spawn('coyote', 700, 500); e.speed = 0; e.ai = () => {}; e.applyStatus('frozen', { t: 2 }); e.die({});
  dw.scene.fx.arc(300, 300, 400, 340);
  Sfx.play = orig; return seen;
});
ok('frozen kill plays freeze_shatter', snd.includes('freeze_shatter'), JSON.stringify(snd));
ok('fx.arc plays shock_zap', snd.includes('shock_zap'), JSON.stringify(snd));

// ---- peddler: greeting on entering the shop, buy / deny lines
await ev(() => { const dw = window.__dw; dw.api.godMode(true); dw.api.killAll(); dw.api.jump('shop'); });
// headless game time runs slower than wall time: poll instead of sleeping
const say1 = await ev(async () => {
  const sc = window.__dw.scene, r = sc.room;
  const txt = () => r.objs.filter((o) => o.type === 'Text' && o.visible && o.text).map((o) => o.text);
  const t0 = performance.now(); while (performance.now() - t0 < 20000 && !txt().some((t) => t.length > 12)) await new Promise((res) => setTimeout(res, 100));
  return { type: r.type, ped: !!r.peddler, tags: txt() };
});
ok('peddler speaks the greeting on entering the shop', say1.type === 'shop' && say1.ped && say1.tags.length > 0, JSON.stringify(say1));
if (shots) await g.shot('fix2-peddler');
const say2 = await ev(async () => {
  const dw = window.__dw, sc = dw.scene, r = sc.room, { bus } = await import('/src/core/events.js');
  const { PEDDLER } = await import('/src/data/story/dialogue.js');
  const txt = () => r.objs.filter((o) => o.type === 'Text' && o.visible).map((o) => o.text).join('|');
  const until = async (list) => { const t0 = performance.now(); while (performance.now() - t0 < 20000) { const t = txt(); if (list.some((l) => t.includes(l))) return t; await new Promise((res) => setTimeout(res, 100)); } return txt(); };
  bus.emit('pickup:denied', { price: 5, type: 'x' });
  const t1 = await until(PEDDLER.deny);
  bus.emit('shop:bought', { price: 3, type: 'x' });
  const t2 = await until([...PEDDLER.buy, ...PEDDLER.sold_out]);
  return { deny: PEDDLER.deny.some((l) => t1.includes(l)), buyOrSold: [...PEDDLER.buy, ...PEDDLER.sold_out].some((l) => t2.includes(l)), t1, t2 };
});
ok('deny line spoken', say2.deny, say2.t1);
ok('buy/sold-out line spoken', say2.buyOrSold, say2.t2);

console.log('errors', g.errors.filter((e) => !/favicon/.test(e)));
ok('no console errors', g.errors.filter((e) => !/favicon/.test(e)).length === 0);
await g.close();
console.log(`items2-fix2: ${r.pass} pass, ${r.fail} fail`);
process.exit(r.fail ? 1 : 0);
