// Audio manager. Sfx: variant pick (no immediate repeats), per-file loudness normalisation + per-key rules from mix.js (polyphony caps with
// oldest-voice stealing, rate limits, random detune, coin pitch chains, music ducking on important stingers). Layers (Music, Ambience):
// crossfading looped beds with lazy loading (AudioLoader), user volume, timed ducking, pause ducking and an optional low-pass "muffle"
// (pause menu, low-health heartbeat). Heartbeat loop, mute/volume persistence and autoplay unlock live here too.
// Missing keys / files are ignored silently, so the game runs without any audio assets. Round 2 fallback layer (AudioAliases.js):
//   Sfx.play(key): manifest file -> else SFX_ALIAS chain (base file at rate/vol, plus layers) -> else silent.
//   Music/Ambience.play(key): manifest file -> else MUSIC_FALLBACK chain -> else silent; a lazily loaded track that fails to load falls back too.
//   Music.setRouter(): the AudioDirector maps every request (GameScene's, flow's, its own) to the effective track and decides the ambience.
//   Debug: ?hideaudio=new hides every key AudioAliases covers (empty new-audio directory), ?hideaudio=a,b hides those keys.
import { Assets } from './Assets.js';
import { Save } from './Save.js';
import { bus } from './events.js';
import { gainFor, rowFor } from './mix.js';
import { AudioLoader } from './AudioLoader.js';
import { SFX_ALIAS, NEW_AUDIO, resolveChain, MUSIC_FALLBACK } from './AudioAliases.js';

let game = null;
const variants = new Map(); // base key -> [keys]
const lastVariant = new Map();
const lastPlayed = new Map();
const voices = new Map(); // poly group -> [sound]
const loops = new Set(); // active Sfx.loop handles (scaled while paused)
let active = 0;
const MAX_POLY = 24;
const DEFAULT_GAP = 0.04;
let pauseMul = 1; // pause-menu duck applied to beds + loops
let chainN = 0, chainT = 0;

// ?hideaudio=new|a,b : keys treated as absent everywhere (QA: proves aliases / fallbacks with an empty new-audio directory)
const hidden = new Set();
function parseHidden() {
  try {
    const q = new URLSearchParams(window.location.search).get('hideaudio');
    if (!q) return;
    for (const k of q.split(',')) { if (k === 'new') NEW_AUDIO.forEach((x) => hidden.add(x)); else if (k) hidden.add(k); }
  } catch (e) { /* no window / bad query */ }
}
const isHidden = (key) => hidden.size > 0 && hidden.has(key.replace(/_\d+$/, ''));
const inManifest = (key) => !!Assets.manifest.audio[key] && !isHidden(key);

const aliasCache = new Map(); // key -> resolved {list, rate, vol, layers} (cleared with the variant cache)
function resetVariants() { variants.clear(); aliasCache.clear(); }
function variantsFor(key) {
  let v = variants.get(key);
  if (v) return v;
  v = [];
  if (!isHidden(key)) {
    if (Assets.hasAudio(key)) v.push(key);
    for (let i = 2; i < 12; i++) if (Assets.hasAudio(`${key}_${i}`)) v.push(`${key}_${i}`);
  }
  if (v.length) variants.set(key, v); // don't cache "missing": lazy tracks may arrive later
  return v;
}
/** A real file (variants) for `key`, or the alias chain's base file. Result: {list, rate, vol, layers|null} or null (cached while non-null). */
function resolveKey(key, withLayers = true) {
  let res = aliasCache.get(key);
  if (res) return res;
  const list = variantsFor(key);
  if (list.length) res = { list, rate: 1, vol: 1, layers: null };
  else {
    let a = SFX_ALIAS[key], rate = 1, vol = 1, layers = null;
    for (let i = 0; a && i < 5 && !res; i++) {
      rate *= a.rate ?? 1; vol *= a.vol ?? 1;
      if (!layers && a.layers) layers = a.layers;
      const bl = variantsFor(a.base);
      if (bl.length) res = { list: bl, rate, vol, layers: null };
      else a = SFX_ALIAS[a.base];
    }
    if (res && layers && withLayers) {
      const out = [];
      for (const l of layers) {
        const r = resolveKey(l.base, false);
        if (r) out.push({ list: r.list, rate: r.rate * (l.rate ?? 1), vol: r.vol * (l.vol ?? 0.7), delay: l.delay || 0 });
      }
      res.layers = out.length ? out : null;
    }
  }
  if (res) aliasCache.set(key, res);
  return res;
}
const now = () => performance.now() / 1000;
const sfxUser = () => Save.vol('sfx', 1);
/** Linear gain of file `k`, normalised to the MIX row of `target` (the requested key: an alias lands on ITS level, not its base's). */
const gainOf = (k, target) => { const m = Assets.audioMeta(k); return gainFor((target || k).replace(/_\d+$/, ''), (m.file || '').replace(/^audio\//, ''), m.volume ?? 0.6); };
const watchers = new Map(); // key -> fn(key): lets the director react to sounds other systems play (e.g. the duel bell)

/** Fade a one-shot out quickly and stop it (voice stealing). */
function steal(s) {
  try {
    const ctx = game.sound.context;
    if (ctx && s.volumeNode) s.volumeNode.gain.setTargetAtTime(0, ctx.currentTime, 0.012);
    setTimeout(() => { try { s.stop(); } catch (e) { /* */ } }, 70);
  } catch (e) { try { s.stop(); } catch (e2) { /* */ } }
}

/** Start one voice of `list` (variant pick, polyphony group cap with oldest-voice stealing, pitch), normalised to the MIX row of `target`. */
function voice(list, row, group, target, opts, rateMul, volMul, main) {
  let k = list[0];
  if (list.length > 1) { // random, never the same file twice in a row
    const last = lastVariant.get(list[0]);
    const pool = list.filter((x) => x !== last);
    k = pool[Math.floor(Math.random() * pool.length)];
    lastVariant.set(list[0], k);
  }
  const cap = (row && row.poly) || 8;
  let vs = voices.get(group);
  if (!vs) voices.set(group, (vs = []));
  while (vs.length >= cap) steal(vs.shift());
  let detune = opts.detune ?? (row && row.rand ? (Math.random() - 0.5) * row.rand : 0);
  if (main && row && row.chain) { const t = now(); chainN = t - chainT < 0.7 ? Math.min(chainN + 1, 7) : 0; chainT = t; detune += chainN * 100; }
  const cfg = { volume: Math.min(2, gainOf(k, target) * volMul * (opts.vol ?? 1) * sfxUser()), rate: (opts.rate ?? 1) * rateMul, detune, pan: opts.pan ?? 0 };
  try {
    const s = game.sound.add(k, cfg);
    active++;
    vs.push(s);
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      active = Math.max(0, active - 1);
      const i = vs.indexOf(s);
      if (i >= 0) vs.splice(i, 1);
      try { s.destroy(); } catch (e) { /* */ }
    };
    s.once('complete', done);
    s.once('stop', done);
    s.play();
    return s;
  } catch (e) {
    active = Math.max(0, active - 1);
    return null;
  }
}

export const Sfx = {
  /** opts: {vol (multiplier on the mixed level), rate, detune (cents), pan, gap}. Keys without a file play their SFX_ALIAS (base + layers). */
  play(key, opts = {}) {
    if (!game || game.sound.locked) return null;
    if (watchers.size) { const w = watchers.get(key); if (w) w(key); }
    const res = resolveKey(key);
    if (!res) return null;
    const row = rowFor(key);
    const t = now();
    const gap = opts.gap ?? (row && row.gap) ?? DEFAULT_GAP;
    if (t - (lastPlayed.get(key) || 0) < gap) return null;
    if (active >= MAX_POLY) return null;
    lastPlayed.set(key, t);
    const group = (row && row.group) || key;
    if (row && row.duck) Music.duckFor(row.duck[0], row.duck[1]);
    const s = voice(res.list, row, group, key, opts, res.rate, res.vol, true);
    if (res.layers) {
      for (let i = 0; i < res.layers.length; i++) {
        const l = res.layers[i];
        const fire = () => { if (game && !game.sound.locked && active < MAX_POLY) voice(l.list, row, `${group}+${i}`, key, opts, l.rate, l.vol, false); };
        if (l.delay > 0) setTimeout(fire, l.delay); else fire();
      }
    }
    return s;
  },
  /** Slight random pitch variation helper. */
  playVar(key, opts = {}) {
    return this.play(key, { ...opts, detune: (opts.detune || 0) + (Math.random() - 0.5) * 160 });
  },
  /** Looping sound; returns {stop(), setVolume(v)} handle (safe even when the key is missing; an alias loops its base file). */
  loop(key, opts = {}) {
    const res = game && !game.sound.locked ? resolveKey(key, false) : null;
    if (!res) return { stop() {}, setVolume() {}, sound: null };
    const file = res.list[0];
    const h = { base: gainOf(file, key) * res.vol * (opts.vol ?? 1), sound: null };
    const apply = () => { try { h.sound.setVolume(Math.min(2, h.base * sfxUser() * pauseMul)); } catch (e) { /* */ } };
    h.sound = game.sound.add(file, { loop: true, volume: 0, rate: (opts.rate ?? 1) * res.rate });
    apply();
    h.sound.play();
    h.apply = apply;
    h.stop = () => { loops.delete(h); try { h.sound.stop(); h.sound.destroy(); } catch (e) { /* */ } };
    h.setVolume = (v) => { h.base = gainOf(file, key) * res.vol * v; apply(); };
    loops.add(h);
    return h;
  },
  /** True when `key` has a real file (aliases do not count). */
  has(key) { return variantsFor(key).length > 0; },
  /** True when playing `key` makes a sound (real file or alias). */
  canPlay(key) { return !!resolveKey(key, false); },
  /** Call fn(key) whenever `key` is played by anyone (returns an unsubscribe fn). One watcher per key. */
  watch(key, fn) { watchers.set(key, fn); return () => { if (watchers.get(key) === fn) watchers.delete(key); }; },
  /** Cut everything that is playing (scene teardown). */
  stopAll() { for (const vs of voices.values()) for (const s of [...vs]) { try { s.stop(); } catch (e) { /* */ } } },
};

// ---------------------------------------------------------------------------------------------------------------------
// Layers: crossfading looped beds (music, ambience)
// ---------------------------------------------------------------------------------------------------------------------
const layers = [];
let stingLevel = 1, stingHold = 0; // timed duck from stingers
let muffleSrc = { pause: 0, heart: 0 };
const muffleAmount = () => Math.max(muffleSrc.pause, muffleSrc.heart);
// named music level sources (menu screens, duel wait...): each fades to its target, the product scales the music bed
const levelSrc = new Map(); // name -> {cur, tgt, rate}
let levelMul = 1;
function tickLevels(dt) {
  let m = 1;
  for (const s of levelSrc.values()) {
    if (s.cur !== s.tgt) s.cur += Math.max(-s.rate * dt, Math.min(s.rate * dt, s.tgt - s.cur));
    m *= s.cur;
  }
  levelMul = m;
}
const BAD_MS = 20000; // a track that failed to load is skipped (fallback chain) for this long

class Layer {
  constructor(name, user, extra) {
    this.name = name; this.user = user; this.extra = extra;
    this.list = []; // voices {key (file), req (requested key), sound, gain, k, dir, dur, filter, mul, eq}
    this.cur = null;
    this.want = null;
    this.bad = new Map(); // key -> time of failed load
    this.lastMuffle = -1;
    layers.push(this);
  }
  /** The REQUESTED key that is playing (logical name, e.g. mus_floor4 even when the fallback file mus_floor3 is what you hear). */
  current() { return this.cur ? this.cur.req : null; }
  /** The file key that is actually playing. */
  file() { return this.cur ? this.cur.key : null; }
  _resolve(req) {
    const t = performance.now();
    return resolveChain(req, (k) => inManifest(k) && !(this.bad.has(k) && t - this.bad.get(k) < BAD_MS), MUSIC_FALLBACK);
  }
  /**
   * opts: fade (ms), loop, vol (bed multiplier, e.g. 0.8), crossfade (equal-power fade both ways, for stem switches),
   * keepPos (start the new track at the same relative loop position as the old one: stems with equal bar layout).
   */
  play(req, opts = {}) {
    this.want = req || null;
    this.opts = opts;
    if (!game) return;
    if (this.cur && this.cur.req === req && !this.cur.done) return;
    const fade = (opts.fade ?? 900) / 1000;
    if (!req) { this._retire(this.cur, fade); this.cur = null; return; }
    const key = this._resolve(req);
    if (!key) { this._retire(this.cur, fade); this.cur = null; return; }
    if (this.cur && this.cur.key === key && !this.cur.done) { this.cur.req = req; return; } // fallback resolves to what is already playing
    if (!Assets.hasAudio(key)) { // lazily loaded: keep the old bed until the new one is decoded
      AudioLoader.ensure(key).then((ok) => {
        if (this.want !== req) return;
        if (!ok) this.bad.set(key, performance.now()); // next fallback in the chain (or silence)
        resetVariants();
        this.play(req, this.opts);
      });
      return;
    }
    if (game.sound.locked) return; // replayed on unlock
    const meta = Assets.audioMeta(key);
    const loop = opts.loop ?? meta.loop ?? !/death|victory/.test(key);
    const eq = !!opts.crossfade;
    const old = this.cur;
    this._retire(old, fade, eq);
    const sound = game.sound.add(key, { loop, volume: 0 });
    let seekTo = 0;
    if (opts.keepPos && old && !old.done) { // same relative position in the loop (Engine stems share a bar layout)
      try {
        const od = old.sound.totalDuration || old.sound.duration, nd = sound.totalDuration || sound.duration;
        if (od > 1 && nd > 1) seekTo = ((old.sound.seek % od) / od) * nd;
      } catch (e) { seekTo = 0; }
    }
    const v = { key, req, sound, gain: gainOf(key), k: 0, dir: 1, dur: Math.max(0.01, fade), filter: null, done: false, mul: opts.vol ?? 1, eq };
    try { // low-pass insert: muteNode -> filter -> volumeNode
      const ctx = game.sound.context;
      if (ctx && sound.muteNode && sound.volumeNode && ctx.createBiquadFilter) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 20000; f.Q.value = 0.5;
        sound.muteNode.disconnect(sound.volumeNode);
        sound.muteNode.connect(f); f.connect(sound.volumeNode);
        v.filter = f;
      }
    } catch (e) { v.filter = null; }
    if (!loop) sound.once('complete', () => { v.done = true; if (this.cur === v) this.cur = null; });
    if (seekTo > 0) sound.play({ seek: seekTo }); else sound.play();
    this.list.push(v);
    this.cur = v;
    this.lastMuffle = -1;
    this._apply(v);
  }
  _retire(v, fade, eq = false) {
    if (!v) return;
    if (fade <= 0.02) { this._kill(v); return; }
    v.dir = -1; v.dur = fade;
    if (eq) v.eq = true;
  }
  _kill(v) {
    v.done = true;
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
    try { v.sound.stop(); v.sound.destroy(); } catch (e) { /* */ }
    if (this.cur === v) this.cur = null;
  }
  stop(fade = 600) { this.want = null; this._retire(this.cur, fade / 1000); this.cur = null; }
  _apply(v) {
    const k = v.eq ? Math.sin(v.k * Math.PI / 2) : v.k; // equal-power for crossfades: gain(old) ^ 2 + gain(new) ^ 2 = 1
    try { v.sound.setVolume(Math.min(1.5, v.gain * this.user() * this.extra() * v.mul * k)); } catch (e) { /* */ }
  }
  tick(dt) {
    const mf = muffleAmount();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      v.k = Math.max(0, Math.min(1, v.k + (v.dir * dt) / v.dur));
      if (v.dir < 0 && v.k <= 0) { this._kill(v); continue; }
      this._apply(v);
      if (v.filter && Math.abs(mf - this.lastMuffle) > 0.01) {
        try { v.filter.frequency.setTargetAtTime(20000 * Math.pow(0.05, mf), game.sound.context.currentTime, 0.12); } catch (e) { /* */ }
      }
    }
    this.lastMuffle = mf;
  }
  replayWanted() { if (this.want && !this.cur) this.play(this.want, { ...(this.opts || {}), fade: 400 }); }
}

const musicLayer = new Layer('music', () => Save.vol('music', 0.5) * 2, () => pauseMul * stingLevel * levelMul);
const ambLayer = new Layer('amb', () => sfxUser() * 0.9 + 0.1, () => pauseMul * (0.55 + 0.45 * stingLevel));

let lastTick = now();
function loopTick() {
  const t = now();
  const dt = Math.min(0.25, t - lastTick);
  lastTick = t;
  // stinger duck: hold, then swell back over ~1.2 s
  if (stingHold > 0) stingHold -= dt;
  else if (stingLevel < 1) stingLevel = Math.min(1, stingLevel + dt / 1.2);
  tickLevels(dt);
  for (const l of layers) l.tick(dt);
  requestAnimationFrame(loopTick);
}

const AMB_KEEP = /^mus_(floor|boss|shop|miniboss)/;
let router = null; // {route(key, opts) -> effective key, amb(effKey, opts) -> undefined (default) | null (ambience off) | {key, vol}}
export const Music = {
  /** The requested (logical) key of the track that is playing / fading in. */
  current() { return musicLayer.current(); },
  /** The file key actually audible (differs from current() when a fallback stands in for a missing track). */
  file() { return musicLayer.file(); },
  /** The AudioDirector installs itself here: it decides which track a request really means (stems, champion, pocket) and the ambience. */
  setRouter(r) { router = r; },
  /**
   * Crossfade to `key` (looping unless the manifest says otherwise). Lazily fetches the track first (old track keeps playing meanwhile).
   * opts: fade (ms), crossfade (equal-power, stem switch), keepPos (same loop position), raw (skip the router).
   */
  play(key, opts = {}) {
    if (router && key && !opts.raw) { try { key = router.route(key, opts); } catch (e) { /* keep the requested key */ } }
    let amb;
    if (router && key && router.amb) { try { amb = router.amb(key, opts); } catch (e) { amb = undefined; } }
    if (amb === undefined) { if (!AMB_KEEP.test(key || '')) Ambience.stop(opts.fade ?? 900); }
    else if (amb) Ambience.play(amb.key, { vol: amb.vol });
    else Ambience.stop(opts.fade ?? 900);
    musicLayer.play(key, opts);
  },
  stop(fade = 600) { musicLayer.stop(fade); },
  /** Pause-menu duck (1 = normal, <1 = ducked + muffled). Also quiets beds' loops (fuse, heartbeat). */
  duck(v) {
    pauseMul = v;
    muffleSrc.pause = v < 1 ? 0.55 : 0;
    for (const h of loops) h.apply && h.apply();
  },
  /** Timed dip for stingers: music goes to `level` (x normal) for `hold` seconds, then swells back. */
  duckFor(level, hold) { if (level < stingLevel || stingHold < hold) { stingLevel = Math.min(stingLevel, level); stingHold = Math.max(stingHold, hold); } },
  /** Named sustained music level (menu screens 0.7, duel wait 0.25): fades to `v` over `fadeMs`; 1 clears it. */
  level(name, v, fadeMs = 600) {
    let s = levelSrc.get(name);
    if (!s) levelSrc.set(name, (s = { cur: 1, tgt: 1, rate: 1 }));
    s.tgt = v;
    s.rate = 1 / Math.max(0.05, fadeMs / 1000);
  },
  muffle(src, amount) { muffleSrc[src] = amount; },
  refreshVolume() { for (const l of layers) l.list.forEach((v) => l._apply(v)); },
};
/** Quiet looped ambience bed (amb_wind / amb_cave / amb_lava ...), crossfaded like music, sits well under it. opts: fade (ms), vol (multiplier). */
export const Ambience = {
  play(key, opts = {}) { ambLayer.play(key, { fade: 1800, ...opts }); },
  stop(fade = 900) { ambLayer.stop(fade); },
  current() { return ambLayer.current(); },
};

// ---------------------------------------------------------------------------------------------------------------------
let heart = null;
let heartOn = false;
let muted = false;

export const Audio = {
  init(g) {
    if (game) return;
    game = g;
    parseHidden();
    AudioLoader.init(g);
    const s = Save.settings();
    game.sound.volume = s.volume ?? 0.8;
    muted = !!s.mute;
    game.sound.mute = muted;
    requestAnimationFrame(loopTick);
    const resume = () => {
      try { if (game.sound.context && game.sound.context.state === 'suspended') game.sound.context.resume(); } catch (e) { /* */ }
    };
    window.addEventListener('keydown', resume);
    window.addEventListener('pointerdown', resume);
    game.sound.on('unlocked', () => { resetVariants(); for (const l of layers) l.replayWanted(); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && !e.repeat) Audio.toggleMute();
    });
  },
  get muted() { return muted; },
  toggleMute() {
    if (!game) return;
    muted = !muted; // own flag: Phaser's getter reads the GainNode value, which lags while the AudioContext is still suspended
    game.sound.mute = muted;
    Save.setSetting('mute', muted);
    bus.emit('ui:toast', { text: muted ? 'SOUND OFF' : 'SOUND ON' });
    bus.emit('audio:changed');
    return muted;
  },
  setMute(m) { if (game) { muted = !!m; game.sound.mute = muted; Save.setSetting('mute', muted); bus.emit('audio:changed'); } },
  setVolume(v) {
    v = Math.max(0, Math.min(1, v));
    if (game) game.sound.volume = v;
    Save.setSetting('volume', v);
  },
  /** Low-health heartbeat loop on/off (also dulls the music a little so the heart reads). */
  heartbeat(on) {
    if (on === heartOn) return;
    heartOn = on;
    muffleSrc.heart = on ? 0.35 : 0;
    if (on) heart = Sfx.loop('heartbeat', { rate: 1.12 });
    else if (heart) { heart.stop(); heart = null; }
  },
  /** Reset variant cache (after assets change). */
  reset() { resetVariants(); },
  /** Debug/QA snapshot of what is audible. */
  debug() {
    if (!game) return null;
    return {
      locked: game.sound.locked, muted, master: game.sound.volume, active,
      want: musicLayer.want, req: Music.current(), ambReq: Ambience.current(),
      music: musicLayer.list.map((v) => ({ key: v.key, req: v.req, k: +v.k.toFixed(2), vol: +v.sound.volume.toFixed(3), playing: v.sound.isPlaying })),
      amb: ambLayer.list.map((v) => ({ key: v.key, k: +v.k.toFixed(2), vol: +v.sound.volume.toFixed(3), playing: v.sound.isPlaying })),
      sfx: game.sound.sounds.filter((s) => s.isPlaying && !musicLayer.list.concat(ambLayer.list).some((v) => v.sound === s)).map((s) => `${s.key}@${s.volume.toFixed(3)}${s.loop ? ':loop' : ''}`),
      groups: Object.fromEntries([...voices].filter(([, v]) => v.length).map(([k, v]) => [k, v.length])),
      duck: { pauseMul, sting: +stingLevel.toFixed(2), level: +levelMul.toFixed(2), muffle: muffleAmount() },
    };
  },
};

export const MUSIC_FOR = {
  menu: 'mus_menu', floor1: 'mus_floor1', floor2: 'mus_floor2', floor3: 'mus_floor3', floor4: 'mus_floor4', floor5: 'mus_floor5', floor6: 'mus_floor6',
  boss: 'mus_boss', boss_final: 'mus_boss_final', boss4: 'mus_boss4', boss5: 'mus_boss5', boss6: 'mus_boss6', miniboss: 'mus_miniboss',
  shop: 'mus_shop', interlude: 'mus_interlude', crossroads: 'mus_crossroads', cutscene_intro: 'mus_cutscene_intro',
  ending_a: 'mus_ending_a', ending_true: 'mus_ending_true', credits: 'mus_credits', death: 'mus_death', victory: 'mus_victory',
};
/** Track key for a MUSIC_FOR name ('boss4') or a full key ('mus_boss4'). */
export const musicKeyFor = (name) => MUSIC_FOR[name] || (String(name).startsWith('mus_') ? name : `mus_${name}`);
export const playMusicFor = (name, opts) => Music.play(musicKeyFor(name), opts);
if (typeof window !== 'undefined') window.__dwAudio = { Audio, Sfx, Music, Ambience, AudioLoader, SFX_ALIAS }; // QA / console access
export default Audio;
