// Start / treasure / shop / secret / vault / boss templates shared by the floors (boss rooms are per floor; the F6 boss lives in floor6.js).
// Everything except the boss rooms and `treasure_two` (F3 pick-one) is available on floors 1-6. Secret variants (EVENTS 8.1): `stash` = secret_a/b/c,
// `dead_mans_hand` = secret_hand (5 C: one card survives), `cache` = secret_cache (8 B + 3 Z powder barrels in one chain), `shrine` = secret_shrine (ring of `s`
// spikes round one pedestal). `vault_a` = the Dealer's Safe (supersecret: two pedestals, coins below).
// Treasure: pedestal 'I' sits on the ring of the treasure bg (tile 6,3). Shop: rug spans tiles 2..10 x 1..5, keeper 'K' on the back row, items 'H' on the rug.
// Secret: 'C' = pickup, 'I' = 40% item pedestal. Boss: '1' = boss spawn (mirrored away from the entry door at runtime), obstacles are cover
// for the boss's bullet patterns and are kept away from the centre lane the boss needs.
const FLOORS_ALL = [1, 2, 3, 4, 5, 6];
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
  { id: 'start_a', kind: 'start', floors: FLOORS_ALL, weight: 1, layout: EMPTY },
  {
    id: 'start_b', kind: 'start', floors: FLOORS_ALL, weight: 1,
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
    id: 'start_c', kind: 'start', floors: FLOORS_ALL, weight: 1,
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
    id: 'treasure_a', kind: 'treasure', floors: FLOORS_ALL, weight: 1,
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
    id: 'treasure_b', kind: 'treasure', floors: FLOORS_ALL, weight: 1,
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
    id: 'treasure_c', kind: 'treasure', floors: FLOORS_ALL, weight: 1,
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
    id: 'treasure_d', kind: 'treasure', floors: FLOORS_ALL, weight: 1,
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
    id: 'shop_a', kind: 'shop', floors: FLOORS_ALL, weight: 1,
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
    id: 'shop_b', kind: 'shop', floors: FLOORS_ALL, weight: 1,
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
    id: 'shop_c', kind: 'shop', floors: FLOORS_ALL, weight: 1,
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
    id: 'secret_a', kind: 'secret', floors: FLOORS_ALL, weight: 1,
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
    id: 'secret_b', kind: 'secret', floors: FLOORS_ALL, weight: 1,
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
    id: 'secret_c', kind: 'secret', floors: FLOORS_ALL, weight: 1,
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
  // ---- secret variants (rolled by floorgen, see Variety.js; SecretVariants.js hosts the behaviour)
  { // dead man's hand: five face-down cards in a fan, take ONE (the others burn). Slots are sorted left to right by the controller.
    id: 'secret_hand', kind: 'secret', variant: 'dead_mans_hand', floors: FLOORS_ALL, weight: 1,
    layout: [
      '.............',
      '.d.........d.',
      '......C......',
      '....C...C....',
      '..C.......C..',
      '.d.........d.',
      '.............',
    ],
  },
  { // cache: a plus of 8 crates and a chain of 3 powder barrels through the middle row; one dynamite (or careful fire) clears it, distance is safe
    id: 'secret_cache', kind: 'secret', variant: 'cache', floors: FLOORS_ALL, weight: 1,
    layout: [
      '.............',
      '.d.........d.',
      '.....BBB.....',
      '....BZZZB....',
      '.....BBB.....',
      '.d.........d.',
      '.............',
    ],
  },
  { // shrine: one pedestal ringed by retracting spikes (1 gap tile per 2.8 s window); the reward is guaranteed, the crossing costs 1 unit at worst
    id: 'secret_shrine', kind: 'secret', variant: 'shrine', floors: FLOORS_ALL, weight: 1,
    layout: [
      '.............',
      '..d.......d..',
      '.....sss.....',
      '.....sIs.....',
      '.....sss.....',
      '..d.......d..',
      '.............',
    ],
  },
  // ---- super-secret: the Dealer's Safe (left pedestal = crossroads-pool item, right = treasure-pool item; VaultRoom sorts I left to right, coins drop below)
  {
    id: 'vault_a', kind: 'supersecret', floors: FLOORS_ALL, weight: 1,
    layout: [
      '.d.........d.',
      '.............',
      '.............',
      '....I...I....',
      '.............',
      '.............',
      '.d.........d.',
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
