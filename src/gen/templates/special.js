// Start / treasure / shop / secret / boss templates shared by the floors (boss rooms are per floor).
// Treasure: pedestal 'I' sits on the ring of the treasure bg (tile 6,3). Shop: rug spans tiles 2..10 x 1..5, keeper 'K' on the back row, items 'H' on the rug.
// Secret: 'C' = pickup, 'I' = 40% item pedestal. Boss: '1' = boss spawn (mirrored away from the entry door at runtime), obstacles are cover
// for the boss's bullet patterns and are kept away from the centre lane the boss needs.
const EMPTY = [
  '.............',
  '.............',
  '.............',
  '.............',
  '.............',
  '.............',
  '.............',
];
export default [
  { id: 'start_a', kind: 'start', floors: [1, 2, 3], weight: 1, layout: EMPTY },
  {
    id: 'start_b', kind: 'start', floors: [1, 2, 3], weight: 1,
    layout: [
      '.............',
      '..d.......d..',
      '.............',
      '.............',
      '.............',
      '..d.......d..',
      '.............',
    ],
  },
  {
    id: 'start_c', kind: 'start', floors: [1, 2, 3], weight: 1,
    layout: [
      '.............',
      '.R.........R.',
      '.............',
      '.............',
      '.............',
      '.R.........R.',
      '.............',
    ],
  },
  // ---- treasure
  {
    id: 'treasure_a', kind: 'treasure', floors: [1, 2, 3], weight: 1,
    layout: [
      '.............',
      '.d.........d.',
      '.............',
      '......I......',
      '.............',
      '.d.........d.',
      '.............',
    ],
  },
  {
    id: 'treasure_b', kind: 'treasure', floors: [1, 2, 3], weight: 1,
    layout: [
      '.............',
      '..R.......R..',
      '.............',
      '......I......',
      '.............',
      '..R.......R..',
      '.............',
    ],
  },
  {
    id: 'treasure_c', kind: 'treasure', floors: [1, 2, 3], weight: 1,
    layout: [
      '.............',
      '.............',
      '..P.......P..',
      '..P...I...P..',
      '..P.......P..',
      '.............',
      '.............',
    ],
  },
  {
    id: 'treasure_d', kind: 'treasure', floors: [1, 2, 3], weight: 1,
    layout: [
      '.............',
      '.............',
      '....R...R....',
      '......I......',
      '....R...R....',
      '.............',
      '.............',
    ],
  },
  {
    // Two pedestals: pick one (the other vanishes). Weighted so F3 treasure rooms have ~25% chance.
    id: 'treasure_two', kind: 'treasure', floors: [3], weight: 1.34, pickOne: true, // 1.34 vs 4 single-pedestal rooms (weight 1) = 25%
    layout: [
      '.............',
      '.............',
      '.............',
      '....I...I....',
      '.............',
      '.............',
      '.............',
    ],
  },
  // ---- shop
  {
    id: 'shop_a', kind: 'shop', floors: [1, 2, 3], weight: 1,
    layout: [
      '.............',
      '.............',
      '......K......',
      '.............',
      '...H..H..H...',
      '.............',
      '.............',
    ],
  },
  {
    id: 'shop_b', kind: 'shop', floors: [1, 2, 3], weight: 1,
    layout: [
      '.............',
      '.R.........R.',
      '......K......',
      '.............',
      '...H..H..H...',
      '.R.........R.',
      '.............',
    ],
  },
  {
    id: 'shop_c', kind: 'shop', floors: [1, 2, 3], weight: 1,
    layout: [
      '.............',
      '.............',
      '....R.K.R....',
      '.............',
      '...H..H..H...',
      '.............',
      '.............',
    ],
  },
  // ---- secret
  {
    id: 'secret_a', kind: 'secret', floors: [1, 2, 3], weight: 1,
    layout: [
      '.............',
      '.............',
      '.............',
      '...C..I..C...',
      '.............',
      '.............',
      '.............',
    ],
  },
  {
    id: 'secret_b', kind: 'secret', floors: [1, 2, 3], weight: 1,
    layout: [
      '.............',
      '.d.........d.',
      '.............',
      '...C..I..C...',
      '.............',
      '.d.........d.',
      '.............',
    ],
  },
  {
    id: 'secret_c', kind: 'secret', floors: [1, 2, 3], weight: 1,
    layout: [
      '.............',
      '.............',
      '.............',
      '..R.C.I.C.R..',
      '.............',
      '.............',
      '.............',
    ],
  },
  // ---- boss rooms
  { // F1: open canyon arena with four rock pillars (cover from the fans and rings)
    id: 'boss_f1', kind: 'boss', floors: [1], boss: 'cascabel', weight: 1,
    layout: [
      '.............',
      '.d.........d.',
      '...R..1..R...',
      '.............',
      '...R.....R...',
      '.d.........d.',
      '.............',
    ],
  },
  { // F2: gallows courtyard: crate stacks in the corners, a few powder barrels as breakable cover
    id: 'boss_f2', kind: 'boss', floors: [2], boss: 'grimm', weight: 1,
    layout: [
      '.............',
      '.R.........R.',
      '....B.1.B....',
      '.............',
      '....B...B....',
      '.R.........R.',
      '.............',
    ],
  },
  { // F3: crypt: boulders in the corners, lanterns/skulls along the edge, the coffin niches are in the wall art; open centre
    id: 'boss_f3', kind: 'boss', floors: [3], boss: 'undertaker', weight: 1,
    layout: [
      'R.d.......d.R',
      '.............',
      '......1......',
      '.............',
      '.............',
      '.............',
      'R.d.......d.R',
    ],
  },
];
