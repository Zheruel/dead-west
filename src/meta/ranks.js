// Notoriety ranks (CHARACTERS_META B9). Cosmetic only. Pure data.
export const RANKS = [
  { rank: 1, title: 'Greenhorn', np: 0 },
  { rank: 2, title: 'Drifter', np: 100 },
  { rank: 3, title: 'Hired Gun', np: 300 },
  { rank: 4, title: 'Gunfighter', np: 600 },
  { rank: 5, title: 'Desperado', np: 1000 },
  { rank: 6, title: 'Outlaw', np: 1600 },
  { rank: 7, title: 'Wanted Man', np: 2400 },
  { rank: 8, title: 'Scourge of Perdition', np: 3400 },
  { rank: 9, title: 'Devil\'s Rival', np: 4600 },
  { rank: 10, title: 'Dead Man Walking', np: 6000 },
  { rank: 11, title: 'Living Legend', np: 8000 },
];
/** Rank object for a Notoriety total (boundaries inclusive: 100 -> rank 2). */
export function rankFor(np) {
  let r = RANKS[0];
  for (const x of RANKS) if (np >= x.np) r = x;
  return r;
}
/** Next rank above `np`, or null at the top. */
export function nextRank(np) { return RANKS.find((x) => x.np > np) || null; }
/** Poster frame tint per rank: bronze (5+), silver (8+), gold (11); null below. Code-tinted parchment, no art. */
export function frameTint(rank) { return rank >= 11 ? 0xe8c040 : rank >= 8 ? 0xc8ccd4 : rank >= 5 ? 0xc08850 : null; }
export default RANKS;
