// Death screen words (STORY_PRESENTATION s10): epitaph under the stamp, "Killed by" names (causeOf), retry copy. Pure data + pure helpers.
//   causeOf(killedBy)                                  -> readable cause ("Marshal Grimm", "Boiled steam"...), never empty
//   pickEpitaph(killedBy, {char, hell, rng, last})     -> string  (cause -> rider 25 % -> hard 35 % on HELL ON EARTH -> generic; never == `last`)
// EndScene keeps `Save.flags.lastEpitaph`, passes it as `last` and stores the result. `rng` is any seeded stream with next() (use subRng('epitaph', seed)).

const K = (keys, lines) => [Array.isArray(keys) ? keys : [keys], lines];

/** [[killedBy keys...], [epitaph alternatives...]] rows (s10 table, in order). */
const ROWS = [
  K('cascabel', ['Bitten by the county\'s oldest notice period.', 'Rattled. Then bitten. Then finished.']),
  K('grimm', ['The Law took its course, then your boots.', 'Sentenced, hanged and filed under "Tuesday".']),
  K('undertaker', ['He dug the hole. You supplied the rest.', 'The Undertaker does not do refunds. He does deposits.']),
  K('toro', ['Branded, then trampled. In that order.', 'The furnace has a horn on it.']),
  K('engine', ['Run down by a train that was not even angry.', 'Right on schedule. Yours, not his.']),
  K('scratch', ['The house always wins. It is in the name.', 'You were dealt out with a very good hand. He had a better one.']),
  K('coyote', ['Outrun by a dog with a grudge.']),
  K(['rattlesnake', 'venom'], ['You had six chambers and one snake. Arithmetic is cruel.', 'Poison: the slow way of saying "I told you so".']),
  K(['tumbleweed', 'tumbleweed_mini'], ['Killed by a plant. Please do not tell anyone.']),
  K('outlaw', ['A bandit with better aim and worse manners.']),
  K('buzzard', ['The buzzards were right to circle.']),
  K('possessed', ['Talked to a man with a passenger. It did not go well.']),
  K('skeleton', ['Out-drawn by a man without a stomach.']),
  K(['dynamiter', 'stick'], ['Blown up by someone who thought it was funny.']),
  K(['ghost', 'ghostfire'], ['The dead do not hold grudges. They hold you.', 'Cold fire. Warm regrets.']),
  K('scarecrow', ['You hung around too long.']),
  K('crow', ['A murder of crows. Technically a justified one.']),
  K(['miner', 'melee'], ['The shift ended. Yours, not his.']),
  K('bat', ['Bitten to death by something the size of a hat.']),
  K(['mole', 'burst'], ['Undermined.']),
  K(['coffin', 'nail'], ['The shape should have warned you.', 'A coffin nail. Poetic, if you like that sort of thing.']),
  K(['spikes', 'spike'], ['You knew they were there. They knew you would forget.']),
  K(['explosion', 'dynamite', 'own_dynamite'], ['Your own dynamite. It was very loyal to the cause.']),
  K('rock', ['Rocks fall. Everyone dies. Somebody should have said.']),
  K('the desert', ['The desert takes everyone eventually. It was just patient.']),
  K(['hellhound', 'hellsteer'], ['Who let the dogs out? Hell did.', 'Gored, then grilled.']),
  K('cinder_skull', ['Killed by a lit fuse with a face.']),
  K(['magma_eel', 'lava', 'ember'], ['Swam in the Devil\'s bath. The water was not fine.']),
  K(['sulfur_preacher', 'vent'], ['The sermon was short and smelled of eggs.']),
  K(['magma_golem', 'fire'], ['Burned. In this economy.']),
  K('handcar_bandit', ['Robbed by a man on a pump. Fast, for a pump.']),
  K('signalman', ['You stood where the lamp said. It was not a suggestion.']),
  K(['steam_stoker', 'steam'], ['Boiled alive. Medium rare.']),
  K('crate_mimic', ['The crate was the enemy. It was always the crate.']),
  K('rail_rat', ['Gnawed to death by five small opinions.']),
  K('chain_gang', ['Sentenced to life. Then some.']),
  K('cart', ['Run over by the twelve o\'clock.']),
  K(['card_shark', 'card', 'joker'], ['He dealt from the bottom. So did the deck.']),
  K(['loaded_die', 'roulette'], ['The house rolled. You lost, as scheduled.']),
  K('slot_fiend', ['No payout.']),
  K(['waiter_imp', 'chandelier', 'shard'], ['Service was slow. The chandelier was not.']),
  K('bouncer', ['You were not on the list.']),
  K('head_bouncer', ['You were not on the list. He said so twice.']),
  K('duelist', ['Quick draw, slow death.']),
];

export const EPITAPHS = {
  generic: [
    'The Devil shuffles. You are dealt in again.', 'Your ledger has been updated.', 'You were warned. In the fine print.',
    'Another debtor down. The Dealer barely blinked.', 'Cause of death: Perdition.', 'Buried without a headstone. Again.',
    'The vultures thank you for your service.', 'The debt remains unpaid.', 'Six feet under, and no whiskey.',
    'Your boots were sold before you hit the dirt.', 'The Devil keeps very good books.', 'Perdition County claims another soul.',
  ],
  hard: ['Aces, eights and a bad habit.', 'You asked for the harder hand. It was dealt.'],
  riders: {
    preacher: 'The Chaplain\'s last sermon was short and ended in a hole.',
    hunter: 'Bounty uncollected. Dead or alive, he settled for dead.',
    queen: 'Maude went all in, and "all" was less than she had hoped.',
    gunslinger: 'Late again, Eli.',
  },
  byCause: Object.fromEntries(ROWS.flatMap(([keys, lines]) => keys.map((k) => [k, lines]))),
};

/** Every epitaph string (lint: no duplicates across the whole table). */
export function allEpitaphs() {
  const out = [...EPITAPHS.generic, ...EPITAPHS.hard, ...Object.values(EPITAPHS.riders)];
  for (const [, lines] of ROWS) out.push(...lines);
  return out;
}

export function pickEpitaph(killedBy, { char = 'gunslinger', hell = false, rng = null, last = null } = {}) {
  const r = () => (rng ? rng.next() : 0.5);
  const cause = EPITAPHS.byCause[String(killedBy || '').toLowerCase()] || null;
  const rider = EPITAPHS.riders[char] || null;
  let pool;
  if (hell && r() < 0.35) pool = EPITAPHS.hard;
  else if (rider && r() < 0.25) pool = [rider];
  else pool = cause || EPITAPHS.generic;
  let cands = pool.filter((t) => t !== last);
  if (!cands.length) cands = (cause || EPITAPHS.generic).filter((t) => t !== last);
  if (!cands.length) cands = EPITAPHS.generic.filter((t) => t !== last);
  return cands[Math.floor(r() * cands.length) % cands.length];
}

// ------------------------------------------------------------------------------------------------ "Killed by" names
/**
 * killedBy key -> name. Keys come from Player.die: enemyName || source.kind || 'explosion' | 'the desert'. Existing round-1 names are kept; chapter 2
 * adds the bosses, the hazards of FN-2 and the minis (EVENTS). Unlisted keys fall back to "A <key>" so the line is never empty.
 */
export const CAUSE_NAMES = {
  // round 1
  spikes: 'Rusty spikes', explosion: 'Dynamite', dynamite: 'Dynamite', 'the desert': 'The desert itself', enemy: 'A stray bullet', venom: 'Snake venom',
  nail: 'A coffin nail', ghostfire: 'Ghostfire', rock: 'A falling rock', stick: 'A stick of dynamite', contact: 'A close encounter', dive: 'El Cascabel',
  burst: 'A very angry mole', melee: 'A pickaxe', slam: 'Marshal Grimm', cascabel: 'El Cascabel', grimm: 'Marshal Grimm', undertaker: 'The Undertaker',
  tumbleweed_mini: 'A tumbleweed', crow: 'A murder of crows',
  // chapter 2 bosses
  toro: 'El Toro Infernal', engine: 'Engine No. 666', scratch: "Ol' Scratch",
  // hazards and player damage kinds (ARCH s8): lava fire vent cart steam chandelier roulette card quicksand own_dynamite
  lava: 'Molten rock', fire: 'Hellfire', vent: 'A sulfur vent', cart: 'A runaway handcar', steam: 'Scalding steam', chandelier: 'A falling chandelier',
  roulette: 'The roulette wheel', card: 'A razor card', quicksand: 'Quicksand', own_dynamite: 'Your own dynamite', ember: 'A lava ember', shard: 'Chandelier glass',
  shockwave: 'A shockwave', spike: 'A rail spike', stampede: 'A spectral stampede', hazard: 'The scenery', pity: 'The Devil\'s idea of a joke',
  item_curse: 'A curse', item_hearts: 'A bad bargain', item_coins: 'A bad bargain', pact: 'A pact',
  // chapter 2 enemies
  hellhound: 'A hellhound', hellsteer: 'A hellsteer', cinder_skull: 'A cinder skull', magma_eel: 'A magma eel', sulfur_preacher: 'A sulfur preacher',
  magma_golem: 'A magma golem', handcar_bandit: 'A handcar bandit', signalman: 'A signalman', steam_stoker: 'A steam stoker', crate_mimic: 'A crate mimic',
  rail_rat: 'A rail rat', chain_gang: 'The chain gang', card_shark: 'A card shark', loaded_die: 'A loaded die', slot_fiend: 'A slot fiend', waiter_imp: 'A waiter imp',
  bouncer: 'A bouncer', joker: 'A joker', duelist: 'A ghost duelist',
  // bullet / damage kinds the chapter 2 enemies and bosses emit
  bottle: 'A thrown bottle', jack_box: 'A jack-in-the-box', bite: 'A hellhound bite', chip: 'A poker chip', spade: 'A razor spade', coal: 'A lump of coal',
  fire_pillar: 'A pillar of fire', ash_step: 'Hot ash', noose: 'A noose', stool: 'A flying bar stool', mug: 'A flying mug', stomp: 'A stampeding boot',
  steam_burst: 'A steam burst', boss: 'A boss', herd: 'The Devil\'s herd',
  // mini-bosses (EVENTS)
  ol_fury: "Ol' Fury", hangman: 'The Hangman', motherlode: 'The Motherlode', ash_deacon: 'The Ash Deacon', stoker: 'Stoker Jack', head_bouncer: 'The Head Bouncer',
};

export function causeOf(k) {
  if (!k) return 'Unknown causes';
  if (CAUSE_NAMES[k]) return CAUSE_NAMES[k];
  if (/[A-Z ]/.test(k)) return k; // already a proper name ("Marshal Grimm")
  const w = String(k).replace(/_/g, ' ');
  return `${/^[aeiou]/i.test(w) ? 'An' : 'A'} ${w.charAt(0).toUpperCase()}${w.slice(1)}`;
}
