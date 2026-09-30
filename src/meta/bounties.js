// Bounty Board: 30 fixed contracts = preset challenge runs (CHARACTERS_META B5). Pure data.
// goal: 'clear:N' = defeat the boss of floor N; optional ',hits<=K'. reward: unlock ids ('gate:x', 'title:x') or 'lore:<id>'.
import { hashStr } from '../core/rng.js';

export const TIERS = ['tin', 'silver', 'gold'];
export const TIER_NP = { tin: 100, silver: 200, gold: 400 };
export const TIER_LABEL = { tin: 'TIN', silver: 'SILVER', gold: 'GOLD' };
export const TIER_UNLOCK_AFTER = 6; // completions in tier N open tier N+1

const B = (id, name, tier, char, items, mutators, goal, reward = []) => ({ id, name, tier, char, items, mutators, goal, reward });

export const BOUNTIES = [
  B('bt_greenhorn', 'Greenhorn\'s Errand', 'tin', 'gunslinger', [], [], 'clear:2', ['lore:lore_board']),
  B('bt_big_iron', 'Big Iron', 'tin', 'gunslinger', [], ['big_iron'], 'clear:2'),
  B('bt_dry_town', 'Dry Town', 'tin', 'gunslinger', [], ['dry_town'], 'clear:3'),
  B('bt_sermon_on_the_mount', 'Sermon on the Mount', 'tin', 'preacher', [], ['chambered_three'], 'clear:3'),
  B('bt_long_rifle', 'Long Rifle', 'tin', 'hunter', [], ['lights_out'], 'clear:3'),
  B('bt_pair_of_aces', 'Pair of Aces', 'tin', 'queen', [], ['hobbled'], 'clear:3'),
  B('bt_stumble_home', 'Stumble Home', 'tin', 'gunslinger', [], ['whiskey_legs'], 'clear:3'),
  B('bt_bank_shot', 'Bank Shot', 'tin', 'gunslinger', ['ricochet'], ['bank_shot'], 'clear:3'),
  B('bt_loud_and_clear', 'Loud and Clear', 'tin', 'hunter', [], ['powder_party'], 'clear:3'),
  B('bt_quiet_prayer', 'Quiet Prayer', 'tin', 'preacher', ['duster_coat'], ['hobbled'], 'clear:3'),
  B('bt_glass_jaw', 'Glass Jaw', 'silver', 'gunslinger', ['speed_loader'], ['glass_jaw'], 'clear:4', ['gate:undead']),
  B('bt_stampede', 'Stampede', 'silver', 'hunter', [], ['stampede'], 'clear:4', ['gate:beast']),
  B('bt_all_cursed', 'Everyone\'s Cursed', 'silver', 'preacher', [], ['all_cursed'], 'clear:4', ['gate:ghost']),
  B('bt_rusty_iron', 'Rusty Iron', 'silver', 'queen', [], ['rusty_iron'], 'clear:4', ['gate:scrap']),
  B('bt_dark_road', 'The Dark Road', 'silver', 'gunslinger', ['spirit_lantern'], ['lights_out'], 'clear:4'),
  B('bt_powder_keg_party', 'Powder Keg Party', 'silver', 'queen', ['powder_keg'], ['powder_party'], 'clear:5'),
  B('bt_pale_horse', 'Pale Horse', 'silver', 'preacher', [], ['pale_horse'], 'clear:5'),
  B('bt_hell_for_leather', 'Hell for Leather', 'silver', 'hunter', ['pocket_watch'], ['hell_for_leather'], 'clear:5'),
  B('bt_six_in_three', 'Six in Three', 'silver', 'gunslinger', ['fan_the_hammer'], ['chambered_three'], 'clear:5'),
  B('bt_tightrope', 'Tightrope', 'silver', 'queen', [], ['glass_jaw', 'hobbled'], 'clear:5'),
  B('bt_last_breath', 'Last Breath', 'gold', 'gunslinger', [], ['last_breath'], 'clear:6', ['title:last_breath']),
  B('bt_iron_maiden', 'Iron Maiden', 'gold', 'preacher', [], ['last_breath', 'rusty_iron'], 'clear:6'),
  B('bt_dead_calm', 'Dead Calm', 'gold', 'hunter', ['dead_eye'], ['hobbled', 'lights_out'], 'clear:6'),
  B('bt_house_always_wins', 'The House Always Wins', 'gold', 'queen', [], ['dry_town', 'glass_jaw'], 'clear:6'),
  B('bt_hellbound', 'Hellbound', 'gold', 'gunslinger', [], ['hell_for_leather', 'all_cursed'], 'clear:6'),
  B('bt_no_witnesses', 'No Witnesses', 'gold', 'hunter', [], ['stampede'], 'clear:6,hits<=8'),
  B('bt_thin_ice', 'Thin Ice', 'gold', 'preacher', [], ['whiskey_legs', 'pale_horse'], 'clear:6'),
  B('bt_bullet_hell', 'Bullet Storm', 'gold', 'gunslinger', ['ricochet', 'sawed_off'], ['bank_shot', 'big_iron'], 'clear:6'),
  B('bt_gilded_cage', 'Gilded Cage', 'gold', 'queen', ['lucky_horseshoe'], ['powder_party', 'pale_horse'], 'clear:6'),
  B('bt_devils_due', 'The Devil\'s Due', 'gold', 'gunslinger', [], ['last_breath', 'glass_jaw'], 'clear:6,hits<=12', ['title:devils_due']),
];
export const BOUNTY_BY_ID = Object.fromEntries(BOUNTIES.map((b) => [b.id, b]));
export const byTier = (tier) => BOUNTIES.filter((b) => b.tier === tier);
/** Fixed seed so the layout is learnable. */
export const contractSeed = (id) => hashStr(`bounty:${id}`);
/** 'clear:6,hits<=8' -> {floor: 6, hits: 8 | null}. */
export function parseGoal(goal) {
  const out = { floor: 1, hits: null };
  for (const part of String(goal).split(',')) {
    let m = /^clear:(\d+)$/.exec(part.trim());
    if (m) out.floor = +m[1];
    m = /^hits<=(\d+)$/.exec(part.trim());
    if (m) out.hits = +m[1];
  }
  return out;
}
/** Human goal line for the board / pause menu. */
export function goalText(goal) {
  const g = parseGoal(goal);
  return `Defeat the floor-${g.floor} boss${g.hits != null ? ` taking ${g.hits} hits or fewer` : ''}`;
}
export default BOUNTIES;
