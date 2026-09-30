// Four extra chapter-1 rooms that showcase the new floor hazards (EVENTS s6.1 / s6.3): quicksand `Q` (F1) and retracting spikes `s` (F2, F3).
// f1_17 / f1_18 join floor1's pool, f2_17 floor2's, f3_17 floor3's (ids continue the 16-per-floor numbering). Conventions: see floor1.js.
// Sand and spike tiles never touch an enemy slot, a door or a door-front tile.
export default [
  { // quicksand basin: a rock in the middle of a 3x3 sand ring; the coyotes of the second wave have to cross the sand to reach you
    id: 'f1_17', kind: 'normal', floors: [1], weight: 1, tier: 2,
    layout: [
      '.............',
      '..1.......1..',
      '.....QQQ.....',
      '..2..QRQ..2..',
      '.....QQQ.....',
      '..1.......1..',
      '.............',
    ],
    waves: { 1: ['outlaw', 'rattlesnake', 'rattlesnake', 'outlaw'], 2: ['coyote', 'coyote'] },
  },
  { // sinkhole run: two diagonal sand bands make three lanes, three waves; buzzards ignore the sand
    id: 'f1_18', kind: 'normal', floors: [1], weight: 1, tier: 3,
    layout: [
      '..QQ...Q.....',
      '.1.QQ..QQ..2.',
      '....QQ1.QQ...',
      '...3.QQ..QQ..',
      '.2....QQ1.QQ.',
      '..1....QQ.3QQ',
      '........QQ..Q',
    ],
    waves: { 1: ['outlaw', 'rattlesnake', 'outlaw', 'rattlesnake'], 2: ['coyote', 'coyote'], 3: ['buzzard', 'buzzard'] },
  },
  { // nail-board hall (F2): two strips of retracting spikes rolling in a wave; the middle lane is always safe; three waves
    id: 'f2_17', kind: 'normal', floors: [2], weight: 1, tier: 3,
    layout: [
      '.............',
      '..1.......1..',
      '....sssss....',
      '..2...1...2..',
      '....sssss....',
      '..3.......3..',
      '.............',
    ],
    waves: { 1: ['skeleton', 'skeleton', 'possessed'], 2: ['possessed', 'dynamiter'], 3: ['ghost', 'ghost'] },
  },
  { // spike corridor (F3): a spiked run between two rock lines; bats fly it, walkers take the long way round or time the spikes
    id: 'f3_17', kind: 'normal', floors: [3], weight: 1, tier: 2,
    layout: [
      '.............',
      '..1.......1..',
      '...RRR.RRR...',
      '..2sssssss2..',
      '...RRR.RRR...',
      '..1.......1..',
      '.............',
    ],
    waves: { 1: ['skeleton', 'possessed', 'possessed', 'skeleton'], 2: ['bat', 'bat'] },
  },
];
