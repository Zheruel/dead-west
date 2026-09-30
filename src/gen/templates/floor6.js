// Floor 6 - The Last Chance Saloon (CHAPTER2 s5-s6): the Devil's own casino. Enemy pool: card_shark (ranged), loaded_die (roller), slot_fiend (random
// attacker), waiter_imp (flying lobber), bouncer (front-armoured tank), joker (blinker) + the returning possessed / skeleton.
// 14 normals (tier 1: 4, tier 2: 6, tier 3: 4) + the Ol' Scratch arena. Art: R = overturned poker table / dead slot machine, B = chip crate,
// P = open cellar hatch, S = broken glass, d = spittoon / candelabra, r k = red / black roulette tiles (walkable, code-drawn).
// Hazard quota: chandelier (>= 6): n01 n04 n05 n08 n10 n11 n13 n14; roulette (>= 4): n03 n06 n09 n11 n12 n13. Both in one room only in tier 3 (n11, n13).
// Threat budget per room (sum over waves, CHAPTER2 s6): tier 1 = 6-8, tier 2 = 9-12, tier 3 = 13-17 (card_shark 2, loaded_die 2, slot_fiend 3,
// waiter_imp 1.5, bouncer 4, joker 2, possessed 2, skeleton 1.5). Roulette regions are 3x3 .. 9x3 and never touch a door or its front tile; roulette rooms bias
// away from the light-eating modifiers (darkness / fog) so the colour call stays readable. Combos the pool is built for: bouncer + card_shark x2, loaded_die in a
// roulette room, slot_fiend + waiter_imp x2 under a chandelier, joker + card_shark. See floor1.js for conventions (digit = wave, `waves` lists in reading order).
const READABLE = { darkness: 0.25, fog: 0.4, lurch: 0.3 }; // modBias for roulette rooms

export default [
  // ---------------------------------------------------------------------------------------------------- tier 1 (threat 6-8)
  { // gambling floor: open carpet, candelabras in the corners, the first chandelier
    id: 'f6_n01', kind: 'normal', floors: [6], weight: 1, tier: 1, chandelier: true,
    layout: [
      '.............',
      '.d.........d.',
      '..1.......1..',
      '.............',
      '..2.......2..',
      '.d.........d.',
      '.............',
    ],
    waves: { 1: ['card_shark', 'waiter_imp'], 2: ['possessed', 'skeleton'] },
  },
  { // slot machine alley: two banks of dead machines to shoot around
    id: 'f6_n02', kind: 'normal', floors: [6], weight: 1, tier: 1,
    layout: [
      '.............',
      '.............',
      '..1.R...R.1..',
      '.............',
      '..2.R...R.2..',
      '.............',
      '.............',
    ],
    waves: { 1: ['joker', 'card_shark'], 2: ['card_shark', 'waiter_imp'] },
  },
  { // little roulette: a 3x3 wheel in the middle, dice and cards around it
    id: 'f6_n03', kind: 'normal', floors: [6], weight: 1, tier: 1, roulette: true, modBias: READABLE,
    layout: [
      '.............',
      '..1.......1..',
      '.....rkr.....',
      '.....krk.....',
      '.....rkr.....',
      '..2.......2..',
      '.............',
    ],
    waves: { 1: ['loaded_die', 'card_shark'], 2: ['waiter_imp', 'joker'] },
  },
  { // pillared hall: four slot machines hold the chandelier's shard rings apart
    id: 'f6_n04', kind: 'normal', floors: [6], weight: 1, tier: 1, chandelier: true,
    layout: [
      '.............',
      '..1.......1..',
      '...R.....R...',
      '.............',
      '...R.....R...',
      '..2.......2..',
      '.............',
    ],
    waves: { 1: ['joker', 'card_shark'], 2: ['waiter_imp', 'waiter_imp'] },
  },
  // ---------------------------------------------------------------------------------------------------- tier 2 (threat 9-12)
  { // card room: chip crates in the corners, imps and a slot fiend under the chandelier
    id: 'f6_n05', kind: 'normal', floors: [6], weight: 1, tier: 2, chandelier: true,
    layout: [
      '.............',
      '.BB.......BB.',
      '..1.......1..',
      '....2.2.2....',
      '......1......',
      '.BB.......BB.',
      '.............',
    ],
    waves: { 1: ['card_shark', 'card_shark', 'joker'], 2: ['waiter_imp', 'slot_fiend', 'waiter_imp'] },
  },
  { // roulette table: a 5x3 wheel between the sharks, a bouncer walks in behind
    id: 'f6_n06', kind: 'normal', floors: [6], weight: 1, tier: 2, roulette: true, modBias: READABLE,
    layout: [
      '.............',
      '.R.........R.',
      '..1.rkrkr.1..',
      '....krkrk....',
      '..2.rkrkr.2..',
      '.R.........R.',
      '.............',
    ],
    waves: { 1: ['card_shark', 'card_shark'], 2: ['bouncer', 'joker'] },
  },
  { // the bar: a counter of slot machines with one gap, a bouncer guarding the sharks
    id: 'f6_n07', kind: 'normal', floors: [6], weight: 1, tier: 2,
    layout: [
      '.............',
      '..1.......1..',
      '.............',
      '....RR.RR....',
      '.............',
      '..2.......2..',
      '.............',
    ],
    waves: { 1: ['bouncer', 'card_shark'], 2: ['card_shark', 'joker'] },
  },
  { // the long bar: overturned tables at both ends, undead patrons first
    id: 'f6_n08', kind: 'normal', floors: [6], weight: 1, tier: 2, chandelier: true,
    layout: [
      '.............',
      '..1.......1..',
      '......1......',
      '..RR.....RR..',
      '.............',
      '..2.......2..',
      '.............',
    ],
    waves: { 1: ['skeleton', 'skeleton', 'possessed'], 2: ['joker', 'card_shark'] },
  },
  { // roulette floor: the whole middle is a 9x3 wheel, dice roll across the colours
    id: 'f6_n09', kind: 'normal', floors: [6], weight: 1, tier: 2, roulette: true, modBias: READABLE,
    layout: [
      '...1.....1...',
      '.............',
      '..rkrkrkrkr..',
      '..krkrkrkrk..',
      '..rkrkrkrkr..',
      '.............',
      '...2.....2...',
    ],
    waves: { 1: ['loaded_die', 'loaded_die'], 2: ['card_shark', 'slot_fiend'] },
  },
  { // cellar hatches in the corners, a second wave walks in through the centre lane
    id: 'f6_n10', kind: 'normal', floors: [6], weight: 1, tier: 2, chandelier: true,
    layout: [
      '.............',
      '.PP.......PP.',
      '..1...2...1..',
      '.............',
      '..1...2...1..',
      '.PP.......PP.',
      '.............',
    ],
    waves: { 1: ['possessed', 'card_shark', 'card_shark', 'possessed'], 2: ['waiter_imp', 'joker'] },
  },
  // ---------------------------------------------------------------------------------------------------- tier 3 (threat 13-17)
  { // high roller's lounge: 5x3 wheel + chandelier, three waves
    id: 'f6_n11', kind: 'normal', floors: [6], weight: 1, tier: 3, chandelier: true, roulette: true, modBias: READABLE,
    layout: [
      '...3.....3...',
      '..1.......1..',
      '.R..rkrkr..R.',
      '....krkrk....',
      '.R..rkrkr..R.',
      '..2.......2..',
      '.............',
    ],
    waves: { 1: ['bouncer', 'card_shark'], 2: ['card_shark', 'slot_fiend'], 3: ['waiter_imp', 'waiter_imp'] },
  },
  { // the wheel: a full 9x3 wheel, sharks and dice first, the doorman later
    id: 'f6_n12', kind: 'normal', floors: [6], weight: 1, tier: 3, roulette: true, modBias: READABLE,
    layout: [
      '...1.....1...',
      '.3.........3.',
      '..rkrkrkrkr..',
      '..krkrkrkrk..',
      '..rkrkrkrkr..',
      '.............',
      '..2.......2..',
    ],
    waves: { 1: ['card_shark', 'loaded_die'], 2: ['bouncer', 'joker'], 3: ['card_shark', 'waiter_imp'] },
  },
  { // the devil's dining room: two 3x3 wheels flank a slot fiend, chandelier overhead
    id: 'f6_n13', kind: 'normal', floors: [6], weight: 1, tier: 3, chandelier: true, roulette: true, modBias: READABLE,
    layout: [
      '.............',
      '..1.......1..',
      '..rkr.1.rkr..',
      '..krk...krk..',
      '..rkr.2.rkr..',
      '..2..3.3..2..',
      '.............',
    ],
    waves: { 1: ['waiter_imp', 'waiter_imp', 'slot_fiend'], 2: ['joker', 'card_shark', 'card_shark'], 3: ['skeleton', 'skeleton'] },
  },
  { // chandelier cross: slot machines split the room into four bays, three waves of the whole pool
    id: 'f6_n14', kind: 'normal', floors: [6], weight: 1, tier: 3, chandelier: true,
    layout: [
      '.............',
      '..1.......1..',
      '.....R.R.....',
      '..2.......2..',
      '.....R.R.....',
      '..3.......3..',
      '.............',
    ],
    waves: { 1: ['bouncer', 'joker'], 2: ['card_shark', 'slot_fiend'], 3: ['waiter_imp', 'waiter_imp'] },
  },
  // ---------------------------------------------------------------------------------------------------- boss
  { // OL' SCRATCH's poker table: slot machines in the corners, a 7x3 wheel (used only by roulette_call: no `roulette` flag = no auto scheduler), the dealer's
    // spot '1' at (6,2) (marker cannot sit on the door-front tile (6,1); mirrored away from the entry door at runtime). Rows 0, 5-6 never roulette.
    id: 'f6_boss', kind: 'boss', floors: [6], boss: 'scratch', weight: 1,
    layout: [
      '..d.......d..',
      '.R.........R.',
      '...krk1krk...',
      '...rkrkrkr...',
      '...krkrkrk...',
      '.R.........R.',
      '..d.......d..',
    ],
  },
];
