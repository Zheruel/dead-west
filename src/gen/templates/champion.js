// Champion (mini-boss) rooms, one per floor (EVENTS s4.5): an open 13x7 arena, the mini spawns at '1' (col 6, row 2; mirrored away from the entry door like a
// boss room). Cover = four rocks R at (3,2) (9,2) (3,4) (9,4); the Motherlode keeps row 3 clear for its cart lane (rocks at (2,1) (10,1) (2,5) (10,5)) and
// the Head Bouncer has no rocks but three overturned tables B as breakable cover (the centre lane cols 5-7 stays free, the validator insists).
// waves[1] = the floor's mini id (BOSS_META `mini: true`, floor n); `champion_f<n>` is what FloorGen / Templates.pick('champion') looks up.
const POSTS = [
  '.............',
  '.............',
  '...R..1..R...',
  '.............',
  '...R.....R...',
  '.............',
  '.............',
];
const CART_LANE = [
  '.............',
  '.R.........R.',
  '......1......',
  '.............',
  '.............',
  '.R.........R.',
  '.............',
];
const TABLES = [
  '.............',
  '.............',
  '...B..1..B...',
  '.............',
  '.............',
  '....B........',
  '.............',
];
const champion = (n, mini, layout) => ({ id: `champion_f${n}`, kind: 'champion', floors: [n], weight: 1, layout, waves: { 1: [mini] } });

export default [
  champion(1, 'ol_fury', POSTS), // charges down lanes: rocks break the run-up
  champion(2, 'hangman', POSTS), // noose drops + spiral flail: pillars to hide behind
  champion(3, 'motherlode', CART_LANE), // cart_ram sweeps a whole row: keep the rows open
  champion(4, 'ash_deacon', POSTS), // censer rings + fire pillars
  champion(5, 'stoker', POSTS), // coal lobs, steam cones, boiler charge
  champion(6, 'head_bouncer', TABLES), // mug slides and bum rush break the tables
];
