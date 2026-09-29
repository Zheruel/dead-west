// Deterministic RNG (mulberry32). Pure JS, usable from node.
// Streams: `floor` (floor generation, room content selection) vs `game` (drops, gameplay rolls).
// Use ?seed=N in the URL to fix the run seed.

export function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class RNG {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** float in [a,b) */
  float(a = 0, b = 1) { return a + this.next() * (b - a); }
  /** int in [a,b] inclusive */
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr.length ? arr[Math.floor(this.next() * arr.length)] : undefined; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** items: [{weight, ...}] or use `getW(item)`. Returns the item. */
  weighted(items, getW = (x) => x.weight ?? 1) {
    let total = 0;
    for (const it of items) total += Math.max(0, getW(it));
    if (total <= 0) return items[0];
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, getW(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }
  fork(label) { return new RNG(hashStr(`${this.s}:${label}`)); }
}

let runSeed = 1;
const streams = { game: new RNG(1) };

/** Reads ?seed=N (if present) else random. Call at run start. Returns the seed. */
export function initSeed(explicit) {
  let seed = explicit;
  if (seed == null && typeof location !== 'undefined') {
    const p = new URLSearchParams(location.search).get('seed');
    if (p != null && p !== '') seed = /^-?\d+$/.test(p) ? parseInt(p, 10) : hashStr(p);
  }
  if (seed == null) seed = (Math.random() * 4294967295) >>> 0;
  runSeed = seed >>> 0;
  streams.game = new RNG(hashStr(`game:${runSeed}`));
  return runSeed;
}
export const getSeed = () => runSeed;
/** Fresh deterministic stream for floor N (independent of gameplay rolls). */
export const floorRng = (floor, seed = runSeed) => new RNG(hashStr(`floor:${seed}:${floor}`));
/** Gameplay stream: drops, random rolls that should be reproducible for a seed. */
export const rng = {
  get game() { return streams.game; },
};
