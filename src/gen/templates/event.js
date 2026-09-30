// Event ("?") rooms, one template per event id (EVENTS s3): `event_<id>`, kind `event`, floors 1-6. No enemy digits. Slot contract for the controllers:
//   K = the bobbing `props_events` prop / NPC (never row 1 col 6: that is the up door's front tile)
//   I = interaction spots, read left to right (rings r 64 never overlap: >= 192 px apart)
//   C = extra spots (graves)
// All markers keep clear of the door tiles and their front tiles; decor `d` is scenery only. No `B` crates in event rooms (they would drop pickups).
//   card_sharp   K table (6,2); I chip stacks 3c / 6c / 10c at (4,4) (6,4) (8,4)
//   wishing_well K well (6,2); I the rim at (6,3)
//   gravedigger  K sign (9,1); C five mounds; I (6,4) spare marker (the ambush-cleared chest rises at the room centre)
//   preacher     K confessional back-centre (6,2); I altars Communion / Absolution / Collection Plate at (3,4) (6,4) (9,4)
//   snake_oil    K wagon (6,2); I three shelf potions in front of it at (4,3) (6,3) (8,3)
//   quick_draw   K duel post + bell (10,2), the duelist stands at (10,3); I the chalk mark at (2,3)
const rows = (over = {}) => Array.from({ length: 7 }, (_, r) => over[r] || '.............');
const ALL = [1, 2, 3, 4, 5, 6];
const event = (id, layout) => ({ id: `event_${id}`, kind: 'event', floors: ALL, weight: 1, layout });

export default [
  event('card_sharp', rows({ 1: '.d.........d.', 2: '......K......', 4: '....I.I.I....', 5: '.d.........d.' })),
  event('wishing_well', rows({ 1: '.d.........d.', 2: '......K......', 3: '......I......', 5: '.d.........d.' })),
  event('gravedigger', rows({ 1: '.d.......K...', 2: '..C...C...C..', 4: '....C.I.C....', 5: '.d.........d.' })),
  event('preacher', rows({ 0: '.d.........d.', 2: '......K......', 4: '...I..I..I...', 5: '.d.........d.' })),
  event('snake_oil', rows({ 1: '.d.........d.', 2: '......K......', 3: '....I.I.I....', 5: '.d.........d.' })),
  event('quick_draw', rows({ 1: '.d.........d.', 2: '..........K..', 3: '..I..........', 5: '.d.........d.' })),
];
