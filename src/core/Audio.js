// Audio manager. Sfx: variant pick (no immediate repeats), per-file loudness normalisation + per-key rules from mix.js (polyphony caps with
// oldest-voice stealing, rate limits, random detune, coin pitch chains, music ducking on important stingers). Layers (Music, Ambience):
// crossfading looped beds with lazy loading (AudioLoader), user volume, timed ducking, pause ducking and an optional low-pass "muffle"
// (pause menu, low-health heartbeat). Heartbeat loop, mute/volume persistence and autoplay unlock live here too.
// Missing keys / files are ignored silently, so the game runs without any audio assets.
import { Assets } from './Assets.js';
import { Save } from './Save.js';
import { bus } from './events.js';
import { gainFor, rowFor } from './mix.js';
import { AudioLoader } from './AudioLoader.js';

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

function variantsFor(key) {
  let v = variants.get(key);
  if (v) return v;
  v = [];
  if (Assets.hasAudio(key)) v.push(key);
  for (let i = 2; i < 12; i++) if (Assets.hasAudio(`${key}_${i}`)) v.push(`${key}_${i}`);
  if (v.length) variants.set(key, v); // don't cache "missing": lazy tracks may arrive later
  return v;
}
const now = () => performance.now() / 1000;
const sfxUser = () => Save.vol('sfx', 1);
const gainOf = (k) => { const m = Assets.audioMeta(k); return gainFor(k.replace(/_\d+$/, ''), (m.file || '').replace(/^audio\//, ''), m.volume ?? 0.6); };

/** Fade a one-shot out quickly and stop it (voice stealing). */
function steal(s) {
  try {
    const ctx = game.sound.context;
    if (ctx && s.volumeNode) s.volumeNode.gain.setTargetAtTime(0, ctx.currentTime, 0.012);
    setTimeout(() => { try { s.stop(); } catch (e) { /* */ } }, 70);
  } catch (e) { try { s.stop(); } catch (e2) { /* */ } }
}

export const Sfx = {
  /** opts: {vol (multiplier on the mixed level), rate, detune (cents), pan, gap} */
  play(key, opts = {}) {
    if (!game || game.sound.locked) return null;
    const list = variantsFor(key);
    if (!list.length) return null;
    const row = rowFor(key);
    const t = now();
    const gap = opts.gap ?? (row && row.gap) ?? DEFAULT_GAP;
    if (t - (lastPlayed.get(key) || 0) < gap) return null;
    if (active >= MAX_POLY) return null;
    lastPlayed.set(key, t);
    // variant: random, never the same file twice in a row
    let k = list[0];
    if (list.length > 1) {
      const last = lastVariant.get(key);
      const pool = list.filter((x) => x !== last);
      k = pool[Math.floor(Math.random() * pool.length)];
      lastVariant.set(key, k);
    }
    // polyphony group: cut the oldest voice when the cap is hit
    const group = (row && row.group) || key;
    const cap = (row && row.poly) || 8;
    let vs = voices.get(group);
    if (!vs) voices.set(group, (vs = []));
    while (vs.length >= cap) steal(vs.shift());
    // pitch
    let detune = opts.detune ?? (row && row.rand ? (Math.random() - 0.5) * row.rand : 0);
    if (row && row.chain) { chainN = t - chainT < 0.7 ? Math.min(chainN + 1, 7) : 0; chainT = t; detune += chainN * 100; }
    const cfg = { volume: Math.min(2, gainOf(k) * (opts.vol ?? 1) * sfxUser()), rate: opts.rate ?? 1, detune, pan: opts.pan ?? 0 };
    if (row && row.duck) Music.duckFor(row.duck[0], row.duck[1]);
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
  },
  /** Slight random pitch variation helper. */
  playVar(key, opts = {}) {
    return this.play(key, { ...opts, detune: (opts.detune || 0) + (Math.random() - 0.5) * 160 });
  },
  /** Looping sound; returns {stop(), setVolume(v)} handle (safe even when the key is missing). */
  loop(key, opts = {}) {
    const list = game && !game.sound.locked ? variantsFor(key) : [];
    if (!list.length) return { stop() {}, setVolume() {}, sound: null };
    const h = { base: gainOf(list[0]) * (opts.vol ?? 1), sound: null };
    const apply = () => { try { h.sound.setVolume(Math.min(2, h.base * sfxUser() * pauseMul)); } catch (e) { /* */ } };
    h.sound = game.sound.add(list[0], { loop: true, volume: 0, rate: opts.rate ?? 1 });
    apply();
    h.sound.play();
    h.apply = apply;
    h.stop = () => { loops.delete(h); try { h.sound.stop(); h.sound.destroy(); } catch (e) { /* */ } };
    h.setVolume = (v) => { h.base = gainOf(list[0]) * v; apply(); };
    loops.add(h);
    return h;
  },
  has(key) { return variantsFor(key).length > 0; },
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

class Layer {
  constructor(name, user, extra) {
    this.name = name; this.user = user; this.extra = extra;
    this.list = []; // voices {key, sound, gain, k, dir, dur, filter}
    this.cur = null;
    this.want = null;
    this.lastMuffle = -1;
    layers.push(this);
  }
  current() { return this.cur ? this.cur.key : null; }
  play(key, opts = {}) {
    this.want = key || null;
    this.opts = opts;
    if (!game) return;
    if (this.cur && this.cur.key === key && !this.cur.done) return;
    if (!key) { this._retire(this.cur, (opts.fade ?? 900) / 1000); this.cur = null; return; }
    if (!Assets.manifest.audio[key]) { this._retire(this.cur, (opts.fade ?? 900) / 1000); this.cur = null; return; }
    if (!Assets.hasAudio(key)) { // lazily loaded: keep the old bed until the new one is decoded
      AudioLoader.ensure(key).then((ok) => { if (ok && this.want === key) { variants.clear(); this.play(key, this.opts); } });
      return;
    }
    if (game.sound.locked) return; // replayed on unlock
    const fade = (opts.fade ?? 900) / 1000;
    this._retire(this.cur, fade);
    const meta = Assets.audioMeta(key);
    const loop = opts.loop ?? meta.loop ?? !/death|victory/.test(key);
    const sound = game.sound.add(key, { loop, volume: 0 });
    const v = { key, sound, gain: gainOf(key), k: 0, dir: 1, dur: Math.max(0.01, fade), filter: null, done: false };
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
    sound.play();
    this.list.push(v);
    this.cur = v;
    this.lastMuffle = -1;
    this._apply(v);
  }
  _retire(v, fade) {
    if (!v) return;
    if (fade <= 0.02) { this._kill(v); return; }
    v.dir = -1; v.dur = fade;
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
    try { v.sound.setVolume(Math.min(1.5, v.gain * this.user() * this.extra() * v.k)); } catch (e) { /* */ }
  }
  tick(dt) {
    const mf = muffleAmount();
    for (const v of [...this.list]) {
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

const musicLayer = new Layer('music', () => Save.vol('music', 0.5) * 2, () => pauseMul * stingLevel);
const ambLayer = new Layer('amb', () => sfxUser() * 0.9 + 0.1, () => pauseMul * (0.55 + 0.45 * stingLevel));

let lastTick = now();
function loopTick() {
  const t = now();
  const dt = Math.min(0.25, t - lastTick);
  lastTick = t;
  // stinger duck: hold, then swell back over ~1.2 s
  if (stingHold > 0) stingHold -= dt;
  else if (stingLevel < 1) stingLevel = Math.min(1, stingLevel + dt / 1.2);
  for (const l of layers) l.tick(dt);
  requestAnimationFrame(loopTick);
}

const AMB_KEEP = /^mus_(floor|boss|shop)/;
export const Music = {
  current() { return musicLayer.current(); },
  /** Crossfade to `key` (looping unless the manifest says otherwise). Lazily fetches the track first (old track keeps playing meanwhile). */
  play(key, opts = {}) {
    if (!AMB_KEEP.test(key || '')) Ambience.stop(opts.fade ?? 900);
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
  muffle(src, amount) { muffleSrc[src] = amount; },
  refreshVolume() { for (const l of layers) l.list.forEach((v) => l._apply(v)); },
};
/** Quiet looped ambience bed (amb_wind / amb_cave), crossfaded like music, sits well under it. */
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
    game.sound.on('unlocked', () => { variants.clear(); for (const l of layers) l.replayWanted(); });
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
  reset() { variants.clear(); },
  /** Debug/QA snapshot of what is audible. */
  debug() {
    if (!game) return null;
    return {
      locked: game.sound.locked, muted, master: game.sound.volume, active,
      music: musicLayer.list.map((v) => ({ key: v.key, k: +v.k.toFixed(2), vol: +v.sound.volume.toFixed(3), playing: v.sound.isPlaying })),
      amb: ambLayer.list.map((v) => ({ key: v.key, k: +v.k.toFixed(2), vol: +v.sound.volume.toFixed(3), playing: v.sound.isPlaying })),
      sfx: game.sound.sounds.filter((s) => s.isPlaying && !musicLayer.list.concat(ambLayer.list).some((v) => v.sound === s)).map((s) => `${s.key}@${s.volume.toFixed(3)}${s.loop ? ':loop' : ''}`),
      groups: Object.fromEntries([...voices].filter(([, v]) => v.length).map(([k, v]) => [k, v.length])),
      duck: { pauseMul, sting: +stingLevel.toFixed(2), muffle: muffleAmount() },
    };
  },
};

export const MUSIC_FOR = {
  menu: 'mus_menu', floor1: 'mus_floor1', floor2: 'mus_floor2', floor3: 'mus_floor3',
  boss: 'mus_boss', boss_final: 'mus_boss_final', shop: 'mus_shop', death: 'mus_death', victory: 'mus_victory',
};
export const playMusicFor = (name, opts) => Music.play(MUSIC_FOR[name] || name, opts);
if (typeof window !== 'undefined') window.__dwAudio = { Audio, Sfx, Music, Ambience, AudioLoader }; // QA / console access
export default Audio;
