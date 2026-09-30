// NPC dialogue (STORY_PRESENTATION s11): the Peddler, the Crossroads Dealer, event-room closing lines. Pure data (node-importable).
// Speech tag look (consumers): 22 px Special Elite on a parchment tag, typewriter 40 cps, hold 2.8 s, wrap 520 px, <= 2 lines; random within a category,
// never the line just used (pickLine). The Dealer's category sizes are exact (greet 4, hover 6, signed 5, refused 3, leaving 4, curse 3): the
// canonical arrays live in src/data/dealerLines.js (FN-5, DealerSpeech) and are re-exported here so story-lint checks one source.
import { DEALER_LINES, DEALER_RIDER_GREET, DEALER_EXTRA } from '../dealerLines.js';

export { DEALER_LINES, DEALER_RIDER_GREET, DEALER_EXTRA };
export const DEALER_COUNTS = { greet: 4, hover: 6, signed: 5, refused: 3, leaving: 4, curse: 3 };

/** Random line from `list`, never `last` (when there is a choice). Returns the line; the caller remembers it. */
export function pickLine(list, rng, last = null) {
  if (!list || !list.length) return '';
  const c = list.length > 1 && last != null ? list.filter((t) => t !== last) : list;
  return c[Math.floor((rng ? rng.next() : 0.5) * c.length) % c.length];
}

// ------------------------------------------------------------------------------------------------ 11.1 peddler
/** One-eyed skeleton huckster on a travel plan he will not explain. The only voice allowed exclamation marks. */
export const PEDDLER = {
  greet: [
    'Step right up! Everything is cursed, but reasonably priced!',
    'Ah, a customer! My favourite kind of living person.',
    'Buy something, friend. My bones ache for commerce.',
    'No refunds. Only regrets. Both at a discount!',
  ],
  greet_return: ['Back again! Did the last thing work? Do not answer.', 'Still alive! I had money on it.'],
  greet_rider: {
    gunslinger: 'Deputy Marrow! Thought you were dead. That is all right. So am I.',
    preacher: 'Chaplain! I have a Bible here, slightly used. Mostly by demons.',
    hunter: 'Mr. Rook! Rope on sale. For your... line of work.',
    queen: 'Miss Marlowe! Cards are extra. Last time you kept the deck.',
  },
  greet_floor: {
    4: 'How did I get down here? Do not ask. I have a very good travel plan.',
    5: 'Ticket? No? Me neither. Buy something.',
    6: 'The saloon takes forty percent. Be kind to a skeleton.',
  },
  buy: ['Pleasure doing business! Mine, anyway.', 'Sold! May it outlive you!', 'A fine choice. I would say "wear it well", but you are dying anyway.'],
  deny: ['Coins, friend. C-O-I-N-S. I can spell it slower.', 'Your pockets are lighter than my skull.', 'Come back when the Devil has been kinder to you.'],
  leave: ['Mind the buzzards!', 'Die somewhere I can find you. I will collect the boots.', 'Give my regards to the hangman!'],
  sold_out: ['Picked clean. Like me, but with more dignity.', 'Nothing left but dust and a lantern I cannot sell.'],
};

/**
 * Peddler greeting: rider line 30 % of the time, else floor line (F4-F6) 40 %, else the plain or return pool.
 * opts: {char, floor, visits (shop visits this run, 1-based), rng, last}
 */
export function peddlerGreeting({ char = 'gunslinger', floor = 1, visits = 1, rng = null, last = null } = {}) {
  const r = () => (rng ? rng.next() : 0.5);
  if (PEDDLER.greet_rider[char] && r() < 0.3) return PEDDLER.greet_rider[char];
  if (PEDDLER.greet_floor[floor] && r() < 0.4) return PEDDLER.greet_floor[floor];
  return pickLine(visits > 1 && r() < 0.5 ? PEDDLER.greet_return : PEDDLER.greet, rng, last);
}

// ------------------------------------------------------------------------------------------------ 11.2 dealer helpers
/**
 * Crossroads greeting. Situational extras replace `greet`: clean Hell run on F5, gunslinger on F4-F5, refused x3 (each 100 % when it applies,
 * first match wins), then the rider line 30 %, else a plain greet.
 * opts: {char, floor, hell, clean, refused (refusals this run), rng, last}
 */
export function dealerGreeting({ char = 'gunslinger', floor = 1, hell = false, clean = false, refused = 0, rng = null, last = null } = {}) {
  const r = () => (rng ? rng.next() : 0.5);
  if (hell && clean && floor === 5) return DEALER_EXTRA.cleanHell;
  if (char === 'gunslinger' && (floor === 4 || floor === 5) && r() < 0.5) return DEALER_EXTRA.gunslingerLate;
  if (refused >= 3 && r() < 0.6) return pickLine(DEALER_EXTRA.refusedThrice, rng, last);
  if (DEALER_RIDER_GREET[char] && r() < 0.3) return DEALER_RIDER_GREET[char];
  return pickLine(DEALER_LINES.greet, rng, last);
}

// ------------------------------------------------------------------------------------------------ 11.3 event rooms
/** NPC greeting + outcome closing lines per event (EVENTS ids). UI strings in CAPS are EVENTS' own; these are the spoken / caption lines. */
export const EVENT_LINES = {
  card_sharp: {
    greet: ['Take a seat. Everyone loses here. Some lose slower.', 'Cards, chips, cheap thrills. The thrills are the cheap part.'],
    bust: 'Bust. The house thanks you.',
    push: 'A push. Nobody wins. Nobody dies. Boring.',
    win: 'A winner! It happens. Rarely.',
    ace_high: 'Ace high! The house weeps.',
    dead_mans_hand: 'Aces and eights. Take the prize. The dead man will not miss it.',
    fold: 'The house is closed. The house is also smug.',
    broke: 'No chips, no cards. The rules are older than the county.',
  },
  wishing_well: {
    greet: ['A well. Dry since 1879. It still wants coins.'],
    nothing: 'THE WELL IS SILENT',
    heart: 'Something warm rises out of the dark.',
    key: 'It gives you a key. To what, it does not say.',
    dynamite: 'The well has opinions about the bank. Here.',
    coin_nickel: 'A nickel back. The well is not sentimental.',
    luck: 'The well approves. Briefly.',
    curse: 'A hand takes the coin. A hand takes more.',
    pity: 'The well coughs up something. Take it and go.',
  },
  gravedigger: {
    greet: ['Fresh graves. Someone is still expecting company.'],
    loot: 'Somebody was buried with their good boots.',
    chest: 'Somebody was buried with the good chest.',
    bones: 'JUST BONES',
    ambush: 'They were not dead. They were resting.',
    done: 'That is the last of them. Fill the holes yourself.',
  },
  preacher: {
    greet: ['Confess, child. It is free. Absolution is the expensive part.'],
    communion: 'Take, eat. This is my body, and also a fair warning.',
    blessing: 'Your sins are forgiven. Some are only postponed.',
    miracle: 'A miracle! I am as surprised as you.',
    false_prophet: 'I was wrong. So very wrong. Enjoy the curse.',
    no_sins: 'No sins? In this county? You must be new.',
    plate: 'Give until it hurts. Or until you are healed.',
    leave: 'Go in peace. Or in pieces.',
  },
  snake_oil: {
    greet: ['Step up, step up! One bottle cures all that ails you, and I do mean all!', 'Colours! Each one a miracle. Each miracle has a colour.'],
    buy: 'A wise investment. The wisest I have seen all week.',
    watered: 'TASTES LIKE WATER',
    watered_line: 'Hm. The batch was off.',
    done: "Shelf's bare, friend. Come back after the next war.",
  },
  quick_draw: {
    greet: ['Draw when you are ready. I have all night. You have less.'],
    bell: ['1 .. 2 .. 3', 'DRAW!', 'QUICK DRAW!'],
    win_flawless: 'Not a scratch. He tips his hat. Then he is gone.',
    lose: 'Better luck next life.',
    decline: "The coward's road is the long one.",
  },
};
/** Potion names (shelf tooltip once identified). */
export const POTION_NAMES = {
  p_heal: 'Red Restorative', p_vigor: 'Vigour Elixir', p_swift: 'Quicksilver Tonic', p_venom: "Rattler's Kiss", p_laudanum: "Mother's Comfort", p_kerosene: 'Lamp Oil (Do Not Drink)',
};
