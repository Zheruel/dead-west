// Run-variety decisions for FloorGen (EVENTS s1.3, s3.1, s7, s8). Pure JS, deterministic from (seed, floor): FloorGen calls these after the core
// layout so the base RNG stream keeps its old consumption order. Streams are keyed like `subRng` (same formula) but take the seed explicitly,
// because generateFloor(floor, seed) must not depend on the global run seed.
import { RNG, hashStr } from '../core/rng.js';
import { VARIETY, MODIFIERS, eventChance, modChance, modMaxPerFloor, superSecretChance } from '../config.js';
import { MINI_IDS } from '../bosses/registry.js';

/** Same stream as `subRng(label, ...parts)` when `seed` is the run seed. */
export const seedRng = (seed, label, ...parts) => new RNG(hashStr(`sub:${label}:${seed}:${parts.join(':')}`));
export const subSeed = (seed, label, ...parts) => hashStr(`sub:${label}:${seed}:${parts.join(':')}`);

/** Mini boss that lives in the champion room of `floor`. */
export const miniFor = (floor) => MINI_IDS[floor - 1] || null;

/**
 * Event id for `floor` or null. Each floor rolls its own presence (eventChance) and pick; an id already shown on an earlier floor of the run is
 * down-weighted (repeatMult). Depends only on the seed, never on player state.
 */
export function eventFor(seed, floor) {
  const ids = Object.keys(VARIETY.event.weights);
  const seen = new Set();
  let id = null;
  for (let f = 1; f <= floor; f++) {
    id = null;
    if (!seedRng(seed, 'event-roll', f).chance(eventChance(f))) continue;
    id = seedRng(seed, 'event-pick', f).weighted(ids, (k) => VARIETY.event.weights[k] * (seen.has(k) ? VARIETY.event.repeatMult : 1));
    seen.add(id);
  }
  return id;
}

/** Secret-room variant (stash / dead_mans_hand / cache / shrine). */
export function secretVariant(seed, floor) {
  const w = VARIETY.secret.variantWeights;
  return seedRng(seed, 'secret', floor).weighted(Object.keys(w), (k) => w[k]);
}

/** Tell shown at a secret door: `crack` (brittle) | `knock` | `chalk`. Doors to a super-secret room always carry chalk and never break from bullets. */
export function secretTell(seed, floor, pairKey, isSuper) {
  const w = VARIETY.secret.tellWeights;
  const tell = isSuper ? 'chalk' : seedRng(seed, 'tell', floor, pairKey).weighted(Object.keys(w), (k) => w[k]);
  return { tell, brittle: tell === 'crack' };
}

/** Does this floor get a super-secret room (when a spot exists)? `r` = the floor's forked variety RNG (always consumed, so layouts stay stable). */
export const rollSuperSecret = (r, floor) => r.chance(superSecretChance(floor));

/**
 * Room modifiers: every `normal` room at distance >= mod.minDist rolls modChance until modMaxPerFloor is reached. Selection weights come from
 * MODIFIERS[id].floors[floor] times the template's modBias; rooms whose template has graveAmbush are skipped. Sets `room.mod`.
 * `templateOf(room)` returns the parsed template. Returns the rooms that got a modifier.
 */
export function assignModifiers(rooms, floor, r, templateOf) {
  const out = [];
  const max = modMaxPerFloor(floor);
  const ids = Object.keys(MODIFIERS).filter((id) => (MODIFIERS[id].floors[floor] || 0) > 0);
  if (!ids.length) return out;
  for (const room of rooms) {
    if (out.length >= max) break;
    if (room.type !== 'normal' || room.dist < VARIETY.mod.minDist) continue;
    const tpl = templateOf(room);
    if (tpl && tpl.graveAmbush) continue;
    if (!r.chance(modChance(floor))) continue;
    const bias = (tpl && tpl.modBias) || {};
    room.mod = r.weighted(ids, (id) => MODIFIERS[id].floors[floor] * (bias[id] ?? 1));
    out.push(room);
  }
  return out;
}
