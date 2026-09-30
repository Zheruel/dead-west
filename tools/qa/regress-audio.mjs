// REGRESSION (audio): PASS/FAIL unit checks in the live page (polyphony cap, coin chain, lazy music + crossfade, ambience, pause duck, heartbeat muffle, mute persistence).  `node tools/qa/regress-audio.mjs`
import { launch } from './harness.mjs';
const g = await launch({ query: '?debug=1&seed=42', name: 'audio-unit' });
const A = (fn, ...a) => g.eval(fn, ...a);
await g.wait(2000);
await g.startRun();
await g.wait(1500);
const ok = (name, cond, extra = '') => console.log(cond ? 'PASS' : 'FAIL', name, extra);
// 1. polyphony cap for shoot
const poly = await A(async () => {
  const { Sfx, Audio } = window.__dwAudio; let max = 0;
  for (let i = 0; i < 40; i++) { Sfx.play('shoot', { gap: 0 }); max = Math.max(max, Audio.debug().groups.shot || 0); await new Promise((r) => setTimeout(r, 30)); }
  return max;
});
ok('shoot polyphony <= 5', poly <= 5 && poly >= 3, `max=${poly}`);
// 2. coin pitch chain
const chain = await A(async () => { const { Sfx } = window.__dwAudio; const d = []; const gm = window.__game.sound; const add = gm.add.bind(gm); gm.add = (k, c) => { if (/coin/.test(k)) d.push(c.detune | 0); return add(k, c); };
  for (let i = 0; i < 5; i++) { Sfx.play('pickup_coin'); await new Promise((r) => setTimeout(r, 90)); } gm.add = add; return d; });
ok('coin chain rises', chain.length >= 4 && chain[chain.length - 1] > chain[0], JSON.stringify(chain));
// 3. lazy music: boss track
const before = await A(() => window.__dwAudio.AudioLoader.has('mus_boss'));
await A(() => window.__dwAudio.Music.play('mus_boss'));
await g.wait(3000);
const d1 = await A(() => window.__dwAudio.Audio.debug());
ok('boss music lazily loaded + playing', !before && d1.music.some((v) => v.key === 'mus_boss' && v.playing), JSON.stringify(d1.music));
ok('floor music faded out', !d1.music.some((v) => v.key === 'mus_floor1'), '');
// 4. ambience floor 3 + boss_final
await A(() => { window.__dwAudio.Ambience.play('amb_cave'); window.__dwAudio.Music.play('mus_shop'); });
await g.wait(4500);
const d2 = await A(() => window.__dwAudio.Audio.debug());
ok('cave ambience + shop music', d2.amb.length === 1 && d2.amb[0].key === 'amb_cave' && d2.music.length === 1 && d2.music[0].key === 'mus_shop', JSON.stringify([d2.amb, d2.music]));
// 5. pause duck + muffle
await A(() => window.__dwAudio.Music.duck(0.3));
await g.wait(600);
const d3 = await A(() => window.__dwAudio.Audio.debug());
ok('pause ducks music', d3.duck.pauseMul === 0.3 && d3.duck.muffle > 0 && d3.music[0].vol < d2.music[0].vol * 0.5, JSON.stringify(d3.music) + JSON.stringify(d3.duck));
await A(() => window.__dwAudio.Music.duck(1));
// 6. heartbeat loop + muffle
await A(() => { const p = window.__dw.player; p.hp = 2; p.tin = 0; });
await g.wait(400);
const d4 = await A(() => window.__dwAudio.Audio.debug());
ok('heartbeat loops + muffles music', d4.sfx.some((s) => s.startsWith('heartbeat') && s.endsWith(':loop')) && d4.duck.muffle > 0, JSON.stringify(d4.sfx));
const cutoff = await A(() => { const v = window.__game.sound.sounds.find((s) => s.key === 'mus_shop'); return v && v.muteNode ? 'has-nodes' : 'none'; });
await A(() => { const p = window.__dw.player; p.hp = 6; });
// 7. mute persisted
await g.tap('KeyM');
await g.wait(200);
ok('M mutes', await A(() => window.__dwAudio.Audio.muted) === true);
await g.page.reload({ waitUntil: 'domcontentloaded' });
await g.wait(1500);
await g.page.waitForFunction(() => window.__game && window.__game.scene.isActive('Menu'), { timeout: 60000 });
await g.wait(500);
ok('mute persisted after reload', await A(() => window.__dwAudio.Audio.muted) === true);
await g.tap('KeyM');
await g.wait(200);
// 8. round 2 fallback layer (director routes / stems / empty-new-audio run: tools/qa/regress-audio-v2.mjs [--hidden]; static coverage: audio-coverage.mjs)
const r2 = await A(async () => {
  const { Sfx, Music, SFX_ALIAS } = window.__dwAudio;
  const dead = Object.keys(SFX_ALIAS).filter((k) => !Sfx.canPlay(k));
  let threw = false;
  try { Sfx.play('no_such_key_xyz'); Sfx.loop('no_such_key_xyz').stop(); Music.play('mus_no_such_track', { fade: 100 }); Music.stop(100); } catch (e) { threw = true; }
  return { dead, threw, unknown: Sfx.canPlay('no_such_key_xyz') };
});
ok('every SFX_ALIAS key makes a sound', r2.dead.length === 0, r2.dead.join(','));
ok('unknown sfx / music keys are silent and never throw', !r2.threw && !r2.unknown);
console.log('errors', g.errors.filter((e) => !/favicon|404/.test(e)));
await g.close();
