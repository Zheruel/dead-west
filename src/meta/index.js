// Browser entry for the meta layer: importing this module wires the Meta singleton to the game bus exactly once (never scene-scoped).
// Node tests import ./Meta.js directly and drive Meta.handle().
import { bus } from '../core/events.js';
import { Meta } from './Meta.js';

if (typeof window !== 'undefined') Meta.attach(bus);
export { Meta };
export { ACHIEVEMENTS, ACH_BY_ID, ACH_CATS } from './achievements.js';
export { BOUNTIES, BOUNTY_BY_ID, TIERS, TIER_NP, TIER_LABEL } from './bounties.js';
export { UNLOCKS, UNLOCK_BY_ID, TITLES } from './unlocks.js';
export { LORE, LORE_BY_ID } from './lore.js';
export { RANKS, rankFor, nextRank, frameTint } from './ranks.js';
export { computeReward, runNp } from './score.js';
export default Meta;
