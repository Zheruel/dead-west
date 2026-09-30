// localStorage persistence, Save v2 (key `deadwest.save.v2`; the v1 key is left untouched as a backup). Every storage call is wrapped in
// try/catch: with storage missing, blocked or full the game keeps an in-memory save and never throws. Pure JS (node-safe: tests inject a
// storage with Save._useStorage). Schema: docs/v2/CHARACTERS_META.md B1 + ARCH_V2 s3.
//   get() cached object | settings()/setSetting/vol | stat(path,n)/max(path,v) | flag/setFlag | unlocked/grant/itemUnlocked | codexSeen(kind,id)
//   persist()/persistSoon() | export()/import(str) | resetProgress() | saveCheckpoint(run, player)/loadCheckpoint()/clearCheckpoint()
import { migrateV1 } from '../meta/migrate.js';
import { getItem } from '../items/registry.js';
import RunState from './RunState.js';
import { MAX_FLOOR } from '../config.js';

export const KEY = 'deadwest.save.v2';
export const KEY_V1 = 'deadwest.save.v1';
export const KEY_CORRUPT = 'deadwest.save.v2.corrupt'; // raw text of an unreadable v2 save (QA4-021), kept until the next unreadable one

const DEFAULT_SETTINGS = {
  mute: false, volume: 0.8, music: 0.5, sfx: 1, shake: true, shakeAmt: 1, flash: true, bulletOutline: false, dmgNumbers: false,
  runTimer: true, autoPause: true, synergyHints: true, lastChar: 'gunslinger', lastMode: 'normal', title: 'rank',
};
const STAT_KEYS = ['runs', 'deaths', 'wins', 'abandons', 'kills', 'playTime', 'bountyEarned', 'coinsCollected', 'coinsSpent', 'keysUsed', 'dynamitePlaced', 'dynamiteKills',
  'shots', 'sixthShots', 'sixthKills', 'deadEyeKills', 'rolls', 'hits', 'damageTaken', 'itemsPicked', 'roomsCleared', 'hitlessRooms', 'secrets', 'shopBuys',
  'chests', 'deals', 'eventsDone', 'minibosses', 'elites', 'floorsDescended', 'marksCollected', 'bountiesDone', 'dailyRuns'];
export const CODEX_MAPS = ['enemies', 'items', 'bosses', 'lore', 'events', 'minis', 'affixes', 'mods', 'curses', 'blessings', 'secrets', 'potions', 'synergies'];
const CHAR_IDS = ['gunslinger', 'preacher', 'hunter', 'queen'];
const HISTORY_MAX = 25, DAILY_MAX = 200;

const mkChar = (unlocked = false) => ({ unlocked, runs: 0, wins: 0, bestFloor: 0, marks: { undertaker: 0, final: 0, hell: 0 } });

/** Fresh v2 save. */
export function freshSave() {
  const stats = { k: {}, bk: {} };
  for (const k of STAT_KEYS) stats[k] = 0;
  const codex = {};
  for (const k of CODEX_MAPS) codex[k] = {};
  const chars = {};
  for (const id of CHAR_IDS) chars[id] = mkChar(id === 'gunslinger');
  const now = Date.now();
  return {
    v: 2, created: now, updated: now, chapterReached: 1,
    settings: { ...DEFAULT_SETTINGS },
    stats,
    best: { floor: 0, time: { normal: 0, hell: 0 }, killsInRun: 0, reward: 0 },
    chars, codex, ach: {}, achProg: {}, unlocks: {}, bounty: {},
    notoriety: { np: 0, rank: 1 },
    daily: { lastDate: '', streak: 0, bestStreak: 0, entries: [] },
    history: [],
    flags: {},
    checkpoint: null,
  };
}

// ---------------------------------------------------------------------------------------------- repair
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const nonNeg = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : d);

/** Merge untrusted data over a fresh skeleton: unknown/mistyped fields are dropped, counters clamped >= 0. Never throws. */
export function repair(data) {
  const s = freshSave();
  if (!isObj(data)) return s;
  const d = data;
  if (typeof d.created === 'number') s.created = d.created;
  if (typeof d.updated === 'number') s.updated = d.updated;
  s.chapterReached = d.chapterReached === 2 ? 2 : 1;
  if (isObj(d.settings)) for (const k of Object.keys(DEFAULT_SETTINGS)) if (typeof d.settings[k] === typeof DEFAULT_SETTINGS[k]) s.settings[k] = d.settings[k];
  for (const k of ['volume', 'music', 'sfx']) s.settings[k] = Math.max(0, Math.min(1, s.settings[k]));
  s.settings.shakeAmt = Math.max(0, Math.min(1, s.settings.shakeAmt));
  if (isObj(d.stats)) {
    for (const k of STAT_KEYS) s.stats[k] = nonNeg(d.stats[k]);
    for (const m of ['k', 'bk']) if (isObj(d.stats[m])) for (const id of Object.keys(d.stats[m])) s.stats[m][id] = nonNeg(d.stats[m][id]);
  }
  if (isObj(d.best)) {
    s.best.floor = nonNeg(d.best.floor); s.best.killsInRun = nonNeg(d.best.killsInRun); s.best.reward = nonNeg(d.best.reward);
    if (isObj(d.best.time)) { s.best.time.normal = nonNeg(d.best.time.normal); s.best.time.hell = nonNeg(d.best.time.hell); }
  }
  if (isObj(d.chars)) {
    for (const id of CHAR_IDS) {
      const c = d.chars[id];
      if (!isObj(c)) continue;
      const t = s.chars[id];
      t.unlocked = id === 'gunslinger' ? true : !!c.unlocked;
      t.runs = nonNeg(c.runs); t.wins = nonNeg(c.wins); t.bestFloor = nonNeg(c.bestFloor);
      if (isObj(c.marks)) for (const m of ['undertaker', 'final', 'hell']) t.marks[m] = c.marks[m] ? 1 : 0;
    }
  }
  if (isObj(d.codex)) {
    for (const k of CODEX_MAPS) {
      if (!isObj(d.codex[k])) continue;
      for (const id of Object.keys(d.codex[k])) {
        const v = d.codex[k][id];
        if (typeof v === 'number' || isObj(v)) s.codex[k][id] = isObj(v) ? { ...v } : v;
      }
    }
  }
  for (const m of ['ach', 'achProg', 'unlocks']) if (isObj(d[m])) for (const id of Object.keys(d[m])) if (typeof d[m][id] === 'number') s[m][id] = d[m][id];
  if (isObj(d.bounty)) {
    for (const id of Object.keys(d.bounty)) {
      const b = d.bounty[id];
      if (!isObj(b)) continue;
      const bb = isObj(b.best) ? b.best : {};
      s.bounty[id] = { done: nonNeg(b.done), tries: nonNeg(b.tries), best: { time: nonNeg(bb.time), reward: nonNeg(bb.reward) } };
    }
  }
  if (isObj(d.notoriety)) { s.notoriety.np = nonNeg(d.notoriety.np); s.notoriety.rank = Math.max(1, nonNeg(d.notoriety.rank, 1)); }
  if (isObj(d.daily)) {
    if (typeof d.daily.lastDate === 'string') s.daily.lastDate = d.daily.lastDate;
    s.daily.streak = nonNeg(d.daily.streak); s.daily.bestStreak = nonNeg(d.daily.bestStreak);
    if (Array.isArray(d.daily.entries)) s.daily.entries = d.daily.entries.filter(isObj).slice(-DAILY_MAX).map((e) => ({ ...e }));
  }
  if (Array.isArray(d.history)) s.history = d.history.filter(isObj).slice(-HISTORY_MAX).map((e) => ({ ...e }));
  if (isObj(d.flags)) for (const id of Object.keys(d.flags)) { const v = d.flags[id]; if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') s.flags[id] = v; }
  s.checkpoint = repairCheckpoint(d.checkpoint);
  return s;
}

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const clampInt = (v, lo, hi, d) => (fin(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
const strList = (a, max = 200) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.length <= 64).slice(0, max) : []);
/** RunState.toJSON shape: every key of a fresh RunState keeps its type (numbers finite, arrays arrays, objects plain), unknown keys are dropped. */
function repairRun(o) {
  const base = new RunState(0).toJSON();
  const out = JSON.parse(JSON.stringify(base));
  if (!isObj(o)) return out;
  for (const k of Object.keys(base)) {
    const b = base[k], v = o[k];
    if (v === undefined) continue;
    if (typeof b === 'number') { if (fin(v)) out[k] = v; }
    else if (typeof b === 'boolean') { if (typeof v === 'boolean') out[k] = v; }
    else if (Array.isArray(b)) { if (Array.isArray(v)) { try { out[k] = JSON.parse(JSON.stringify(v)).slice(0, 300); } catch (e) { /* keep default */ } } }
    else if (b && typeof b === 'object') { if (isObj(v)) { try { out[k] = JSON.parse(JSON.stringify(v)); } catch (e) { /* keep default */ } } }
    else if (typeof v === 'string' || fin(v) || isObj(v) || v === null) { try { out[k] = JSON.parse(JSON.stringify(v)); } catch (e) { /* keep default */ } } // null-default fields (killedBy, daily, ending ...)
  }
  return out;
}
/**
 * Validate an untrusted checkpoint (hand-edited / imported save, QA4-022): floor 1..MAX_FLOOR, seed number, every numeric field finite and clamped,
 * item / curse / blessing lists arrays of strings, char / mode known ids. Returns a clean copy, or null when it cannot be a checkpoint.
 */
export function repairCheckpoint(cp) {
  if (!isObj(cp) || cp.v !== 1 || !fin(cp.floor)) return null;
  const maxHp = clampInt(cp.maxHp, 1, 40, undefined);
  const out = {
    v: 1,
    seed: fin(cp.seed) ? Math.trunc(cp.seed) : (typeof cp.seed === 'string' && cp.seed.trim() !== '' && fin(+cp.seed) ? Math.trunc(+cp.seed) : 0),
    floor: clampInt(cp.floor, 1, MAX_FLOOR, 1),
    char: CHAR_IDS.includes(cp.char) ? cp.char : 'gunslinger',
    mode: cp.mode === 'hell' ? 'hell' : 'normal',
    items: strList(cp.items),
    active: isObj(cp.active) && typeof cp.active.id === 'string' ? { id: cp.active.id, charge: clampInt(cp.active.charge, 0, 99, 0) } : null,
    hp: clampInt(cp.hp, 1, maxHp || 40, maxHp || 6),
    tin: clampInt(cp.tin, 0, 40, 0),
    coins: clampInt(cp.coins, 0, 99999, 0),
    keys: clampInt(cp.keys, 0, 99, 0),
    dyn: clampInt(cp.dyn, 0, 99, 0),
    curses: strList(cp.curses, 40),
    blessings: strList(cp.blessings, 40),
    heartDebt: clampInt(cp.heartDebt, 0, 40, 0),
    extraHearts: clampInt(cp.extraHearts, 0, 40, 0),
    revive: cp.revive ? 1 : 0,
    itemState: {},
    time: fin(cp.time) ? Math.max(0, cp.time) : 0,
    kills: clampInt(cp.kills, 0, 1e7, 0),
    run: repairRun(cp.run),
  };
  if (maxHp !== undefined) out.maxHp = maxHp;
  if (isObj(cp.itemState)) { try { out.itemState = JSON.parse(JSON.stringify(cp.itemState)); } catch (e) { /* keep {} */ } }
  out.run.floor = out.floor; out.run.char = out.char; out.run.mode = out.mode; out.run.seed = out.seed;
  return out;
}

/** Non-enumerable v1-shaped accessors (bestFloor, runs, ...) so code written against the v1 save keeps working (not serialised). */
function addLegacyView(s) {
  const def = (k, get) => Object.defineProperty(s, k, { get, enumerable: false, configurable: true });
  def('bestFloor', () => s.best.floor);
  def('bestTime', () => s.best.time.normal);
  def('bestKills', () => s.best.killsInRun);
  for (const k of ['runs', 'deaths', 'wins', 'kills', 'playTime']) def(k, () => s.stats[k]);
  def('itemsSeen', () => Object.keys(s.codex.items).filter((id) => s.codex.items[id] >= 1));
  return s;
}

// ---------------------------------------------------------------------------------------------- storage
let cache = null;
let custom = null; // injected storage (tests)
let timer = null;
let noProgress = false; // Meta.enabled === false (debug / god / unlockall runs): checkpoints are not written

function store() {
  if (custom) return custom;
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
}
function read(key) {
  try { const st = store(); const raw = st && st.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
/** Unreadable / non-v2 text in the v2 key: keep a copy under KEY_CORRUPT before the next persist overwrites it (QA4-021, Q1-09). Never throws. */
function backupUnreadable(key) {
  try {
    const st = store(); const raw = st && st.getItem(key);
    if (!raw || raw === 'null') return;
    st.setItem(KEY_CORRUPT, String(raw).slice(0, 4000000));
  } catch (e) { /* storage full / blocked: nothing to do */ }
}
function load() {
  if (cache) return cache;
  let data = read(KEY);
  let s;
  if (data && data.v === 2) s = repair(data);
  else {
    backupUnreadable(KEY); // truncated JSON, wrong shape or a future version: keep the raw text
    const v1 = read(KEY_V1);
    s = v1 ? repair(migrateV1(v1, freshSave())) : freshSave();
    if (v1) { try { const st = store(); if (st) st.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
  }
  data = null;
  cache = addLegacyView(s);
  return cache;
}
function persist() {
  if (!cache) return;
  cache.updated = Date.now();
  if (timer) { clearTimeout(timer); timer = null; }
  try { const st = store(); if (st) st.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* storage full / blocked: keep the in-memory save */ }
}
function persistSoon() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; persist(); }, 800);
  if (timer && typeof timer.unref === 'function') timer.unref();
}
if (typeof window !== 'undefined' && window.addEventListener) {
  try {
    window.addEventListener('beforeunload', () => persist());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
  } catch (e) { /* ignore */ }
}

const enc = (str) => {
  try { return btoa(unescape(encodeURIComponent(str))); } catch (e) { return typeof Buffer !== 'undefined' ? Buffer.from(str, 'utf8').toString('base64') : ''; }
};
const dec = (b64) => {
  try { return decodeURIComponent(escape(atob(b64))); } catch (e) { return typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64').toString('utf8') : ''; }
};

/** Resolve a dotted path ('kills', 'k.coyote') under `root`; returns [container, key]. */
function slot(root, path) {
  const parts = String(path).split('.');
  let o = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isObj(o[parts[i]])) o[parts[i]] = {};
    o = o[parts[i]];
  }
  return [o, parts[parts.length - 1]];
}

export const Save = {
  /** Set by Meta: mirrors Meta.itemsOpen (Daily / contracts / ?unlockall open every item gate). */
  itemsOpen: false,
  get() { return load(); },
  update(fn) { fn(load()); persist(); },
  settings() { return load().settings; },
  setSetting(k, v) {
    const s = load().settings;
    s[k] = v;
    if (k === 'shakeAmt') s.shake = v > 0; // the boolean stays in sync for code that still reads it
    if (k === 'shake') s.shakeAmt = v ? Math.max(0.25, s.shakeAmt || 1) : 0;
    persist();
  },
  /** Numeric setting clamped to 0..1 (volume sliders). */
  vol(k, def = 1) { const v = load().settings[k]; return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : def; },
  seeItem(id) {
    const c = load().codex.items;
    if ((c[id] || 0) < 1) { c[id] = 1; persistSoon(); }
  },
  /** Legacy v1 entry point: the Meta engine now records runs from bus events (run:ended). Kept as a no-op so old call sites cannot double count. */
  recordRun() {},
  /** Full reset (settings included). Prefer resetProgress(). */
  reset() { cache = addLegacyView(freshSave()); persist(); },

  // ---- counters / flags / unlocks
  /** stats[path] += n (path like 'kills' or 'k.coyote'); returns the new value. Persists lazily. */
  stat(path, n = 1) {
    const [o, k] = slot(load().stats, path);
    o[k] = (o[k] || 0) + n;
    persistSoon();
    return o[k];
  },
  /** stats[path] = max(current, v). Returns the new value. */
  max(path, v) {
    const [o, k] = slot(load().stats, path);
    if (v > (o[k] || 0)) { o[k] = v; persistSoon(); }
    return o[k] || 0;
  },
  /** Read a lifetime stat by dotted path (0 when missing). */
  getStat(path) {
    let o = load().stats;
    for (const p of String(path).split('.')) { if (!o || typeof o !== 'object') return 0; o = o[p]; }
    return typeof o === 'number' ? o : 0;
  },
  flag(id) { return load().flags[id]; },
  setFlag(id, v = true) { const f = load().flags; if (f[id] !== v) { f[id] = v; persistSoon(); } },
  unlocked(id) { return !!load().unlocks[id]; },
  /** Write an unlock id. Returns true when it was new. Persists immediately. */
  grant(id) {
    const u = load().unlocks;
    if (u[id]) return false;
    u[id] = Date.now();
    persist();
    return true;
  },
  /** Item gate (ARCH D5): `!def.gate || itemsOpen || unlocked('gate:'+def.gate)`. */
  itemUnlocked(id) {
    const def = typeof id === 'string' ? getItem(id) : id;
    if (!def || !def.gate) return true;
    return this.itemsOpen || this.unlocked(`gate:${def.gate}`);
  },
  /** Codex world feed (CodexHooks): kind in events|minis|affixes|mods|curses|blessings|secrets|potions|synergies. Returns true when new. */
  codexSeen(kind, id) {
    if (id == null || id === '') return false;
    const c = load().codex;
    if (!c[kind]) c[kind] = {};
    if (c[kind][id]) return false;
    c[kind][id] = 1;
    persistSoon();
    return true;
  },
  persist,
  persistSoon,
  /** Flush pending writes now (call at run end / unlock). */
  flush: persist,

  // ---- export / import / reset
  export() { return enc(JSON.stringify(load())); },
  /** Replace the save with an exported string. Returns true on success (validates v === 2 and repairs the data). */
  import(str) {
    try {
      const data = JSON.parse(dec(String(str).trim()));
      if (!isObj(data) || data.v !== 2) return false;
      cache = addLegacyView(repair(data));
      persist();
      return true;
    } catch (e) { return false; }
  },
  /** Wipe all progress, keep settings. */
  resetProgress() {
    const settings = { ...load().settings };
    cache = addLegacyView(freshSave());
    cache.settings = settings;
    persist();
  },

  // ---- checkpoint (ARCH D10): Normal and Hell runs only, written at the start of F4/F5/F6
  /** Store a resumable snapshot. `player.snapshot()` (FN-4) is preferred; a basic snapshot of the Player fields is the fallback. Returns true when written. */
  saveCheckpoint(run, player) {
    try {
      if (noProgress || !run || !player || (run.mode !== 'normal' && run.mode !== 'hell')) return false;
      const snap = typeof player.snapshot === 'function' ? player.snapshot() : {
        items: [...(player.items || [])], active: player.active ? { id: player.active.id, charge: player.active.charge } : null,
        hp: player.hp, maxHp: player.maxHp, tin: player.tin, coins: player.coins, keys: player.keys, dyn: player.dynamite,
        curses: [...(player.curses || [])], blessings: [...(player.blessings || [])], heartDebt: player.heartDebt || 0, itemState: {},
      };
      const cp = { v: 1, seed: run.seed, floor: run.floor, char: run.char, mode: run.mode, ...JSON.parse(JSON.stringify(snap)), time: run.time, kills: run.kills, run: run.toJSON() };
      const s = load();
      s.checkpoint = cp;
      s.chapterReached = Math.max(s.chapterReached, run.floor > 3 ? 2 : 1);
      persist();
      return true;
    } catch (e) { return false; }
  },
  loadCheckpoint() {
    const cp = load().checkpoint;
    return cp && cp.v === 1 && typeof cp.floor === 'number' && cp.floor >= 1 ? cp : null;
  },
  clearCheckpoint() { const s = load(); if (s.checkpoint) { s.checkpoint = null; persist(); } },
  /** Meta toggles this: true while a debug / god / unlockall run is active. */
  setProgressLocked(b) { noProgress = !!b; },

  // ---- test hooks
  /** Use `storage` ({getItem,setItem,removeItem}) instead of localStorage and drop the cache (tests). Pass null to restore. */
  _useStorage(storage) { custom = storage || null; cache = null; if (timer) { clearTimeout(timer); timer = null; } },
  _drop() { cache = null; },
};
export default Save;
