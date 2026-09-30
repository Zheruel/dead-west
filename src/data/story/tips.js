// Loading-screen lines and tips (STORY_PRESENTATION s12). Pure data; BootScene picks from BOOT_LINES and availableTips().
//   TIPS rows: {t, needs}; `needs` in core | ch2 | deals | events | meta | hell | daily. A tip is shown once its feature is unlocked / reached.
//   availableTips(features) -> string[]   features = iterable of need names the player has (core is always on), e.g. ['ch2', 'deals']
//   featuresFromSave(save) -> string[]    derives the feature set from a Save v2 object (defensive: any missing field means "not yet")
import { BOOT_LINES_EXTRA } from './text.js';

/** The 10 round-1 lines kept, plus the round-2 ones. */
export const BOOT_LINES = [
  'Digging up old debts...', 'Loading the six-shooter...', 'Sharpening the noose...', 'Waking the dead...', 'Counting the bullets...',
  'Feeding the buzzards...', 'Polishing the tin star...', 'Praying to a silent sky...', 'Reading the fine print of the contract...', "Summoning the Devil's bookkeeper...",
  ...BOOT_LINES_EXTRA,
];

export const TIPS = [
  { needs: 'core', t: 'Every sixth bullet hits twice as hard and pierces. Count with the cylinder.' },
  { needs: 'core', t: 'Space rolls through bullets. The roll has a cooldown, so pick your moment.' },
  { needs: 'core', t: 'Dynamite hurts you too. It also opens secret rooms.' },
  { needs: 'core', t: 'Golden doors need a key. Somewhere on the floor, one is waiting.' },
  { needs: 'core', t: 'Tin hearts are lost before your red ones.' },
  { needs: 'core', t: 'Every attack is telegraphed. Watch the wind-up pose.' },
  { needs: 'core', t: 'Cleared rooms recharge your active item.' },
  { needs: 'core', t: 'Cracked walls in dead ends hide something. Bring dynamite.' },
  { needs: 'core', t: 'Skeletons, ghosts and miners are undead. Silver hurts them more.' },
  { needs: 'core', t: 'Ghosts cannot be hurt while faded. Wait for the wail.' },
  { needs: 'core', t: 'Miners are armoured in front. Walk around them.' },
  { needs: 'core', t: 'Moles surface where you stand. Move when the mound stops.' },
  { needs: 'core', t: 'Pits stop walkers, not bullets. Shoot across them.' },
  { needs: 'core', t: 'Shops sell what the Devil skips. Spend your coins before the boss.' },
  { needs: 'core', t: 'The boss door is red and it does not open twice.' },
  { needs: 'core', t: 'Rolling into a corner is how heroes end up in corners.' },
  { needs: 'core', t: 'Enemies in a red aura are Cursed: tougher, but they drop a heart.' },
  { needs: 'core', t: 'Sign nothing. Some rides are won by refusing.' },
  { needs: 'ch2', t: 'Lava burns. Go around, or go fast.' },
  { needs: 'ch2', t: 'Signalmen lock your row and column. The diagonals are safe.' },
  { needs: 'ch2', t: 'A rail lane flashes red before the cart comes. Believe it.' },
  { needs: 'ch2', t: 'That crate has been watching you.' },
  { needs: 'ch2', t: 'Kill the Sulfur Preacher first. His ward halves your damage.' },
  { needs: 'ch2', t: "A chandelier's shadow means move." },
  { needs: 'ch2', t: 'On the roulette floor, the colour they call is the colour to leave.' },
  { needs: 'deals', t: 'The Crossroads opens after a boss. Sometimes. It always closes.' },
  { needs: 'deals', t: 'Every deal at the Crossroads is true. That is the problem.' },
  { needs: 'deals', t: 'You can leave the Crossroads without signing. He will remember.' },
  { needs: 'events', t: 'Question-mark rooms are gambles. Most gambles are polite about it.' },
  { needs: 'events', t: 'Mini-bosses pay well and hit hard. The bounty is on the poster.' },
  { needs: 'meta', t: 'Some deeds unlock new riders. Check the Board.' },
  { needs: 'meta', t: 'The Codex remembers everything you have met.' },
  { needs: 'meta', t: 'Each rider plays differently. Try one you dislike.' },
  { needs: 'hell', t: 'Hell on Earth is a longer ride with a harder Devil.' },
  { needs: 'hell', t: 'Sign nothing. On Hell on Earth, that is how the story ends.' },
  { needs: 'daily', t: "Today's daily ride is the same county for every rider." },
];
export const TIP_NEEDS = ['core', 'ch2', 'deals', 'events', 'meta', 'hell', 'daily'];

/** Tips whose feature is available. `features` = iterable of need names; 'core' is implied. */
export function availableTips(features = []) {
  const have = new Set(features);
  have.add('core');
  return TIPS.filter((x) => have.has(x.needs)).map((x) => x.t);
}

/**
 * Feature set from a Save v2 object: ch2 (reached chapter 2), deals (a deal signed or floor >= 2 reached), events (floor >= 2), meta (any win / 2+ runs),
 * hell (mode:hell unlocked), daily (mode:daily unlocked). Never throws; a fresh or corrupt save yields ['core'].
 */
export function featuresFromSave(save) {
  const f = ['core'];
  try {
    if (!save) return f;
    const best = (save.best && save.best.floor) || 0, runs = (save.stats && save.stats.runs) || 0, wins = (save.stats && save.stats.wins) || 0;
    const unl = save.unlocks || {};
    if ((save.chapterReached || 1) >= 2 || best >= 4) f.push('ch2');
    if (best >= 3 || unl['gate:bloodpact']) f.push('deals');
    if (best >= 2) f.push('events');
    if (wins > 0 || runs >= 2 || unl['char:preacher'] || unl['char:hunter']) f.push('meta');
    if (unl['mode:hell']) f.push('hell');
    if (unl['mode:daily']) f.push('daily');
  } catch (e) { /* defensive */ }
  return f;
}
