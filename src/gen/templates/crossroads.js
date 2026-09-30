// The Crossroads pocket room (EVENTS s2.3): reached through the HellGate after a boss on floors 1-5, never placed on the floor grid, never gets doors.
// K = the Dealer (6,1); I = the three offer tables L / C / R (2,3) (6,3) (10,3), left to right; X keeps everything else off the tables' rings; the return
// portal sits at tile (6,5) (RoomManager, not a template char). Two `d` decor (candles). No enemies, no obstacles.
export default [
  {
    id: 'crossroads_a', kind: 'crossroads', floors: [1, 2, 3, 4, 5, 6], weight: 1,
    layout: [
      '.d.........d.',
      '......K......',
      '.XXX.XXX.XXX.',
      '..I...I...I..',
      '.XXX.XXX.XXX.',
      '.............',
      '.............',
    ],
  },
];
