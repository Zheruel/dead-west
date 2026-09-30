// Built-in stand-in templates so every floor (1-6) and every room kind generates before the content jobs land (ARCH s6). Pure data.
// A real template with the same id (or, for derived floor sets, any real template of that floor and kind) always wins; see Templates.js.
//   BUILTIN            champion_f1..6, event_<id> x6, crossroads_a, vault_a, secret_hand / secret_cache / secret_shrine
//   deriveNormals(...) floor-3 normals re-used on another floor with random enemy fill (Room fills empty wave lists from that floor's pool)
//   deriveBoss(...)    the floor-3 boss arena for another floor's boss
import { FLOORS } from '../config.js';
import { MINI_IDS } from '../bosses/registry.js';

const ROW = '.............';
const rows = (over = {}) => Array.from({ length: 7 }, (_, r) => over[r] || ROW);

const champion = (n, layout) => ({ id: `champion_f${n}`, kind: 'champion', floors: [n], weight: 1, layout, waves: { 1: [MINI_IDS[n - 1]] }, fallback: true });
const COVER = rows({ 2: '...R..1..R...', 4: '...R.....R...' });
const CART_LANE = rows({ 1: '..R.......R..', 2: '......1......', 5: '..R.......R..' });
const TABLES = rows({ 2: '...B..1..B...', 4: '...B.........' });

const event = (id, layout) => ({ id: `event_${id}`, kind: 'event', floors: [1, 2, 3, 4, 5, 6], weight: 1, layout, fallback: true });

export const BUILTIN = [
  champion(1, COVER), champion(2, COVER), champion(3, CART_LANE), champion(4, COVER), champion(5, COVER), champion(6, TABLES),
  event('card_sharp', rows({ 2: '......K......', 4: '.....I.I.....', 5: '.d.........d.' })),
  event('wishing_well', rows({ 2: '......K......', 4: '......I......' })),
  event('gravedigger', rows({ 1: '..........K..', 2: '..C.C.C.C.C..', 3: '......I......' })),
  event('snake_oil', rows({ 2: '......K......', 4: '..I...I...I..' })),
  event('preacher', rows({ 2: '......K......', 4: '......I......', 5: '.d.........d.' })),
  event('quick_draw', rows({ 2: '......K......', 4: '......I......' })),
  { id: 'crossroads_a', kind: 'crossroads', floors: [1, 2, 3, 4, 5, 6], weight: 1, fallback: true, layout: rows({ 0: '.d.........d.', 1: '......K......', 3: '..I...I...I..' }) },
  { id: 'vault_a', kind: 'supersecret', floors: [1, 2, 3, 4, 5, 6], weight: 1, fallback: true, layout: rows({ 2: '......C......', 3: '....I...I....', 4: '......C......' }) },
  { id: 'secret_hand', kind: 'secret', variant: 'dead_mans_hand', floors: [1, 2, 3, 4, 5, 6], weight: 1, fallback: true, layout: rows({ 2: '..C.C.C.C.C..' }) },
  { id: 'secret_cache', kind: 'secret', variant: 'cache', floors: [1, 2, 3, 4, 5, 6], weight: 1, fallback: true, layout: rows({ 2: '..BBB.Z.BBB..', 3: '..B...Z...B..', 4: '..BBB.Z.BBB..' }) },
  { id: 'secret_shrine', kind: 'secret', variant: 'shrine', floors: [1, 2, 3, 4, 5, 6], weight: 1, fallback: true, layout: rows({ 2: '.....sss.....', 3: '.....sIs.....', 4: '.....sss.....' }) },
];

/** Floor-3 normal templates (parsed defs) as normals for `floor`: random enemy fill, flyer spawns dropped (they name floor-3 enemies). */
export function deriveNormals(floor, sources) {
  return sources.map((t) => ({
    id: `${t.id}_f${floor}`, kind: 'normal', floors: [floor], weight: t.weight, tier: t.tier, layout: t.layout,
    derived: true,
  }));
}

/** Boss arena of floor 3 used for another floor's boss (`FLOORS[n].boss`). */
export function deriveBoss(floor, source) {
  return { id: `boss_f${floor}`, kind: 'boss', floors: [floor], weight: 1, layout: source.layout, boss: FLOORS[floor].boss, derived: true };
}
