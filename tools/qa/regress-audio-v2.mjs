// REGRESSION (audio, round 2): director routes + fallback layer in the live page.  `node tools/qa/regress-audio-v2.mjs [--hidden]`
//   default : real files (routes per floor / boss stem / champion / pocket / vault / shop / interlude / ending, stem crossfade, loop position)
//   --hidden: same routes with ?hideaudio=new (EMPTY new-audio directory): every key must still resolve through SFX_ALIAS / MUSIC_FALLBACK, no errors
// Routing is asserted on the REQUESTED key (`Audio.debug().want`, what the director decided: instant), audibility on `Music.current()` after the lazy load
// (`settle`). All waits are condition-based with long timeouts, so the script also works on a machine that is busy with other jobs.
import { launch } from './harness.mjs';
const hidden = process.argv.includes('--hidden');
const g = await launch({ query: `?debug=1&seed=42${hidden ? '&hideaudio=new' : ''}`, name: 'audio-v2', quiet: true });
const A = (fn, ...a) => g.eval(fn, ...a);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, extra); };
const dbg = () => A(() => window.__dwAudio.Audio.debug());
const until = async (fn, ms = 60000, step = 150) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await g.wait(step); } };
const want = async () => (await dbg()).want;
const wantIs = (k, ms) => until(async () => (await want()) === k, ms);
const cur = () => A(() => window.__dwAudio.Music.current());
const file = () => A(() => window.__dwAudio.Music.file());
/** music layer settled on exactly one fully faded-in playing voice (lazy loads can take a while) */
const settle = async (ms = 45000) => { let d = null; await until(async () => { d = await dbg(); return d.music.length === 1 && d.music[0].playing && d.music[0].k >= 0.99; }, ms); return d || dbg(); };
const setFloor = async (n) => { await A((f) => window.__dw.api.setFloor(f), n); await until(() => A((f) => window.__dw.scene.floorNum === f && window.__dw.scene.room && window.__dw.scene.room.state.entered, n)); };
const enter = async (t) => {
  const id = await A((x) => window.__dw.api.jump(x), t);
  if (!id) return null;
  await until(() => A((rid) => { const s = window.__dw.scene; return s.roomMgr.currentId === rid && !s.transitioning && s.room && s.room.state.entered; }, id));
  return id;
};
const FLOOR_BED = { 1: 'amb_wind', 2: 'amb_wind', 3: 'amb_cave', 4: 'amb_lava', 5: 'amb_rail', 6: 'amb_saloon' };
const STEMS = { 5: ['mus_boss5_a', 'mus_boss5_b', 'mus_boss5_c'], 6: ['mus_boss6_a', 'mus_boss6_b', 'mus_boss6_c', 'mus_boss6_d'] };
const BOSS = { 1: 'mus_boss', 2: 'mus_boss', 3: 'mus_boss_final', 4: 'mus_boss4', 5: 'mus_boss5_a', 6: 'mus_boss6_a' };
const NEW_MUSIC = new Set(['mus_floor4', 'mus_floor5', 'mus_floor6', 'mus_boss4', 'mus_boss5_a', 'mus_boss5_b', 'mus_boss5_c', 'mus_boss6_a', 'mus_boss6_b', 'mus_boss6_c', 'mus_boss6_d', 'mus_crossroads', 'mus_miniboss', 'mus_interlude']);

await g.wait(1500);
await g.startRun();
await A(() => window.__dw.api.godMode(true));

for (let n = 1; n <= 6; n++) {
  await setFloor(n);
  const d = await settle();
  const k = await cur();
  ok(`F${n} floor track`, k === `mus_floor${n}`, `key=${k} file=${await file()}`);
  ok(`F${n} floor bed`, d.ambReq === FLOOR_BED[n], `amb=${d.ambReq}`);
  ok(`F${n} one music voice`, d.music.length === 1, JSON.stringify(d.music));
  if (hidden && NEW_MUSIC.has(k)) ok(`F${n} fallback file audible`, (await file()) !== k && !!(await file()), `file=${await file()}`);

  if (await enter('shop')) { // shop: shop track, bed off
    ok(`F${n} shop track`, await wantIs('mus_shop'), `want=${await want()}`);
    const s = await until(async () => { const x = await dbg(); return x.ambReq === null ? x : null; }, 20000);
    ok(`F${n} shop bed off`, !!s, `amb=${(await dbg()).ambReq}`);
  }
  if (await enter('champion')) { // champion room: mini-boss track while uncleared, floor track after mini:defeated
    await A(() => { for (const e of window.__dw.scene.enemies) if (e.isBoss) e.destroy(); });
    ok(`F${n} champion room`, await wantIs('mus_miniboss'), `want=${await want()}`);
    await A(async () => { const { bus } = await import('/src/core/events.js'); bus.emit('mini:defeated', { id: 'x' }); });
    ok(`F${n} mini:defeated -> floor track`, await wantIs(`mus_floor${n}`), `want=${await want()}`);
  } else console.log('note', `F${n} has no champion room in this seed`);
  if (await enter('supersecret')) ok(`F${n} supersecret vault`, await wantIs('mus_crossroads'), `want=${await want()}`);
  if (n <= 5) { // crossroads pocket (boss floors 1-5)
    await enter('boss');
    await A(() => { window.__dw.room.state.cleared = true; for (const e of [...window.__dw.scene.enemies]) e.destroy(); });
    const entered = await A(() => window.__dw.api.enterCrossroads());
    if (entered && await until(() => A(() => window.__dw.scene.roomMgr.inPocket && !window.__dw.scene.transitioning))) {
      const okk = await wantIs('mus_crossroads');
      const dd = await until(async () => { const x = await dbg(); return x.ambReq === 'amb_crossroads' ? x : null; }, 20000);
      ok(`F${n} crossroads pocket`, okk && !!dd, `want=${await want()} amb=${(await dbg()).ambReq}`);
      await A(() => window.__dw.scene.roomMgr.leavePocket());
      await until(() => A(() => !window.__dw.scene.roomMgr.inPocket && !window.__dw.scene.transitioning));
      ok(`F${n} pocket left -> floor track`, await wantIs(`mus_floor${n}`), `want=${await want()}`);
    } else console.log('note', `F${n} pocket not available`);
  }
}

// boss stems: enter the boss room, fire boss:phase, watch the equal-power crossfade
for (const n of [3, 4, 5, 6]) {
  await setFloor(n);
  await enter('boss');
  const boss = await A(() => { const b = window.__dw.scene.enemies.find((e) => e.isBoss); return b ? b.id : null; });
  await until(async () => (await cur()) === BOSS[n] || (hidden && (await want()) === BOSS[n] && (await settle(1000)).music.length === 1), 60000);
  const d0 = await settle();
  ok(`F${n} boss room track`, (await want()) === BOSS[n] && (await cur()) === BOSS[n], `want=${await want()} key=${await cur()} boss=${boss}`);
  ok(`F${n} bed off during boss room`, !!(await until(async () => (await dbg()).amb.length === 0, 15000)), JSON.stringify((await dbg()).amb));
  const stems = STEMS[n];
  if (stems) {
    for (let ph = 1; ph < stems.length; ph++) {
      await until(async () => (await settle(20000)).music.length === 1, 30000);
      // preload the stem so the crossfade itself is measured (a lazy load only delays its start)
      await A((k) => window.__dwAudio.AudioLoader.ensure(k), stems[ph]);
      const steady0 = (await dbg()).music.reduce((a, v) => a + v.vol, 0);
      await A(async (p) => {
        const { bus } = await import('/src/core/events.js');
        const b = window.__dw.scene.enemies.find((e) => e.isBoss);
        bus.emit('boss:phase', { phase: p, boss: b, id: b && b.id });
      }, ph);
      ok(`F${n} stem P${ph} requested`, await wantIs(stems[ph], 5000), `want=${await want()}`);
      // sample the crossfade: audible at every sample (no silence gap), never more than 2 voices (no double play)
      let minSum = 9, maxVoices = 0;
      const t0 = Date.now();
      while (Date.now() - t0 < 1800) {
        const d = await dbg();
        const sum = d.music.reduce((a, v) => a + v.vol, 0);
        maxVoices = Math.max(maxVoices, d.music.length);
        if (d.music.length === 2 && d.music.every((v) => v.k > 0.05 && v.k < 0.95)) minSum = Math.min(minSum, sum);
        await g.wait(40);
      }
      const d1 = await settle();
      const steady1 = d1.music[0] ? d1.music[0].vol : 0;
      ok(`F${n} stem P${ph} audible, single voice after fade`, (await cur()) === stems[ph] && d1.music.length === 1, `key=${await cur()} voices=${d1.music.length}`);
      if (!hidden && minSum < 9) ok(`F${n} crossfade P${ph} has no silence gap (equal power)`, minSum > 0.8 * Math.min(steady0, steady1), `minSum=${minSum.toFixed(3)} steady ${steady0.toFixed(3)} -> ${steady1.toFixed(3)}`);
      ok(`F${n} crossfade P${ph} max 2 voices`, maxVoices <= 2, `${maxVoices}`);
    }
  }
  // boss dead -> back to the floor track, bed returns (Scratch: the ending owns the music, nothing restarts)
  await A(async () => { const { bus } = await import('/src/core/events.js'); const b = window.__dw.scene.enemies.find((e) => e.isBoss); bus.emit('boss:defeated', { boss: b || { id: 'x', meta: {} } }); window.__dw.room.state.cleared = true; });
  if (n < 6) {
    ok(`F${n} boss defeated -> floor track`, await wantIs(`mus_floor${n}`, 20000), `want=${await want()}`);
    ok(`F${n} bed returns`, !!(await until(async () => (await dbg()).ambReq === FLOOR_BED[n], 20000)), `amb=${(await dbg()).ambReq}`);
  } else ok('F6 final boss defeated: no floor track restart', !(await wantIs('mus_floor6', 4000)), `want=${await want()}`);
}

// Engine stems keep the loop position across the crossfade
if (!hidden) {
  await setFloor(5); await enter('boss');
  await A(() => window.__dwAudio.AudioLoader.ensure(['mus_boss5_a', 'mus_boss5_b']));
  await A(() => { window.__dwAudio.Music.play('mus_boss4', { fade: 100 }); window.__dwAudio.Music.play('mus_boss5', { fade: 100 }); }); // (re)start the A stem
  await until(() => A(() => window.__game.sound.sounds.some((s) => s.key === 'mus_boss5_a' && s.isPlaying && s.seek > 3)), 30000);
  const pos = await A(async () => {
    const { bus } = await import('/src/core/events.js');
    const a = window.__game.sound.sounds.find((s) => s.key === 'mus_boss5_a' && s.isPlaying);
    const before = a.seek / a.totalDuration, t = performance.now();
    bus.emit('boss:phase', { phase: 1, boss: window.__dw.scene.enemies.find((e) => e.isBoss), id: 'engine' });
    const b = window.__game.sound.sounds.find((s) => s.key === 'mus_boss5_b' && s.isPlaying);
    if (!b) return null;
    return { before, after: b.seek / b.totalDuration, dt: (performance.now() - t) / 1000 };
  });
  ok('Engine stems keep the loop position', pos && Math.abs(pos.after - pos.before) < 0.04, JSON.stringify(pos));
}

// interlude plays as a sting; game:ending fades the music out
await setFloor(3);
await A(async () => { const { playMusicFor } = await import('/src/core/Audio.js'); playMusicFor('mus_interlude', { fade: 600 }); });
ok('interlude route', await wantIs('mus_interlude'), `want=${await want()}`);
await until(async () => (await cur()) === 'mus_interlude', 45000);
ok('interlude audible (or fallback)', (await cur()) === 'mus_interlude', `key=${await cur()} file=${await file()}`);
await A(async () => { const { bus } = await import('/src/core/events.js'); bus.emit('game:ending', { ending: 'devil_defeated' }); });
const de = await until(async () => { const d = await dbg(); return d.music.length === 0 && d.amb.length === 0 ? d : null; }, 20000);
ok('game:ending fades music + bed out', !!de, JSON.stringify(await dbg()));

// every alias key resolves to a sound; layered aliases start extra voices
const sfx = await A(async () => {
  const { Sfx, SFX_ALIAS } = window.__dwAudio;
  const silent = [];
  for (const k of Object.keys(SFX_ALIAS)) {
    if (k === 'fire_loop' || k === 'fire_crackle' || k === 'crowd_murmur') { const h = Sfx.loop(k); if (!h.sound) silent.push(k); h.stop(); continue; }
    if (!Sfx.canPlay(k)) { silent.push(k); continue; }
    Sfx.play(k, { gap: 0 });
  }
  Sfx.stopAll();
  return { silent, total: Object.keys(SFX_ALIAS).length };
});
ok('all alias keys resolve to a sound', sfx.silent.length === 0, `silent=${sfx.silent.join(',')} of ${sfx.total}`);
const fps = await A(() => window.__game.loop.actualFps);
console.log('info fps', fps.toFixed(1), '(not asserted: the machine is shared)');
const errs = g.errors.filter((e) => !/favicon|404/.test(e));
ok('no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 5)));
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
await g.close();
process.exit(fails ? 1 : 0);
