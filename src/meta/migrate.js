// Save v1 -> v2 (CHARACTERS_META B1). Pure: takes the parsed v1 object and a fresh v2 skeleton, returns the v2 save. The v1 storage key is never touched.
import { ACHIEVEMENTS } from './achievements.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const NP_OF = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a.np]));

/** Notoriety recomputed from scratch: floor(kills * 25 / 100) + the NP of every earned deed. */
export function recomputeNp(save) {
  let np = Math.floor((num(save.stats && save.stats.kills) * 25) / 100);
  for (const id of Object.keys(save.ach || {})) np += NP_OF[id] || 0;
  return np;
}

/**
 * @param v1 parsed v1 save (any shape; garbage tolerated)
 * @param fresh a fresh v2 object to fill (from Save's factory)
 */
export function migrateV1(v1, fresh) {
  const s = fresh;
  const o = v1 && typeof v1 === 'object' ? v1 : {};
  const now = Date.now();
  const runs = num(o.runs), wins = num(o.wins), bestFloor = num(o.bestFloor);
  s.stats.runs = runs; s.stats.deaths = num(o.deaths); s.stats.wins = wins; s.stats.kills = num(o.kills); s.stats.playTime = num(o.playTime);
  s.best.killsInRun = num(o.bestKills); s.best.time.normal = num(o.bestTime); s.best.floor = bestFloor;
  if (Array.isArray(o.itemsSeen)) for (const id of o.itemsSeen) if (typeof id === 'string') s.codex.items[id] = 2;
  if (o.settings && typeof o.settings === 'object') {
    const st = o.settings;
    for (const k of ['mute', 'volume', 'music', 'sfx']) if (st[k] != null && typeof st[k] === typeof s.settings[k]) s.settings[k] = st[k];
    if (typeof st.shake === 'boolean') { s.settings.shake = st.shake; s.settings.shakeAmt = st.shake ? 1 : 0; }
  }
  const grant = (id) => { s.unlocks[id] = now; };
  const ach = (id) => { s.ach[id] = now; };
  const bk = (id) => { s.stats.bk[id] = Math.max(1, s.stats.bk[id] || 0); s.codex.bosses[id] = { seen: 1, killed: 1, bestFight: 0, noHit: 0 }; };
  // retro-credit generously
  if (wins >= 1) {
    bk('cascabel'); bk('grimm'); bk('undertaker');
    s.chars.gunslinger.marks.undertaker = 1;
    grant('char:preacher'); grant('char:hunter'); grant('mode:daily');
    ach('rattle_silenced'); ach('lawless'); ach('last_rites');
  } else if (bestFloor >= 3) {
    bk('cascabel'); bk('grimm');
    grant('char:preacher');
    ach('rattle_silenced'); ach('lawless');
  } else if (bestFloor >= 2) {
    bk('cascabel');
    ach('rattle_silenced');
  }
  s.notoriety.np = recomputeNp(s);
  return s;
}
export default migrateV1;
