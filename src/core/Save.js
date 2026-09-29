// localStorage persistence with try/catch everywhere (private mode, blocked storage, etc).
const KEY = 'deadwest.save.v1';
const DEFAULT = {
  bestFloor: 0,
  bestTime: 0, // seconds, best full-clear (0 = none)
  runs: 0,
  deaths: 0,
  wins: 0,
  kills: 0,
  itemsSeen: [],
  bestKills: 0, // most kills in a single run
  playTime: 0, // total seconds ridden
  settings: { mute: false, volume: 0.8, shake: true, music: 0.5, sfx: 1 },
};
let cache = null;

function load() {
  if (cache) return cache;
  let data = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch (e) { /* ignore */ }
  cache = { ...DEFAULT, ...(data || {}) };
  cache.settings = { ...DEFAULT.settings, ...((data && data.settings) || {}) };
  if (!Array.isArray(cache.itemsSeen)) cache.itemsSeen = [];
  return cache;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* ignore */ }
}

export const Save = {
  get() { return load(); },
  update(fn) { fn(load()); persist(); },
  settings() { return load().settings; },
  setSetting(k, v) { load().settings[k] = v; persist(); },
  /** Numeric setting clamped to 0..1 (volume sliders). */
  vol(k, def = 1) { const v = load().settings[k]; return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : def; },
  seeItem(id) {
    const d = load();
    if (!d.itemsSeen.includes(id)) { d.itemsSeen.push(id); persist(); }
  },
  /** stats: {floor, time, kills, won, abandoned}. abandoned = quit to menu mid-run: counts as a run but not as a death. */
  recordRun({ floor = 0, time = 0, kills = 0, won = false, abandoned = false }) {
    const d = load();
    d.runs++;
    d.kills += kills;
    d.playTime = (d.playTime || 0) + time;
    d.bestKills = Math.max(d.bestKills || 0, kills);
    if (won) {
      d.wins++;
      if (!d.bestTime || time < d.bestTime) d.bestTime = time;
    } else if (!abandoned) d.deaths++;
    d.bestFloor = Math.max(d.bestFloor, floor);
    persist();
  },
  reset() { cache = { ...DEFAULT, settings: { ...DEFAULT.settings }, itemsSeen: [] }; persist(); },
};
export default Save;
