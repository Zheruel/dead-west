// Item `lore` text for the 28 round-1 items (STORY_PRESENTATION s8): pedestal inspect + CODEX RELICS (the pickup banner keeps `NAME - desc`).
// Pure data. <= 72 chars each. Template for new items (held by ITEMS_V2 per-item lines): 1-2 short sentences, <= 72 chars, no numbers or mechanics words
// (`desc` does that), exactly one joke or one chill, present tense, one in-world object; deal items end on a signed feel; synergy items hint the pairing
// without naming it. The shipped defs carry their own `lore` field (FN-4 edited the 28 files); `itemLore(id, def)` prefers this table when present.
export const ITEM_LORE = {
  spurs: 'Jingle-jangle. Everyone hears you coming. Nobody catches you.',
  lucky_horseshoe: "Luck is a debt too. This one just hasn't been called yet.",
  hollow_point: 'Hollow on the inside. Like the man who bought it.',
  speed_loader: 'Six in the time it takes the Devil to clear his throat.',
  long_barrel: 'Reach out and touch someone, from a respectful distance.',
  sawed_off: 'Half the barrel. All of the argument.',
  ricochet: 'If at first you don\'t succeed, blame the wall.',
  dead_eye: 'Patience is a virtue. Patience with a Colt is a verdict.',
  bandolier: 'Nobody has ever regretted bringing more dynamite. Survivors, anyway.',
  snake_oil: 'Cures what ails you. Do not ask what is in it.',
  tin_star: 'Worth about a nickel. Stops about a bullet.',
  liquid_courage: 'The closer you get to dead, the braver you get.',
  cursed_coin: 'It always lands heads. That should worry you.',
  rattler_fang: 'Still wet. Still angry. Points away from you, mostly.',
  silver_bullets: 'The dead have opinions about silver. Loud ones.',
  dynamite_vest: 'Stylish. Loud. Frowned upon by the insurance man.',
  spirit_lantern: "Somebody's soul is in there. It seems to like you.",
  crow_companion: 'He is not a pet. He is a witness who works for scraps.',
  voodoo_doll: 'It looks a lot like the Marshal. Coincidence, probably.',
  duster_coat: 'Dust, bullets and bad news all slide right off.',
  prospectors_pan: 'Every fool with a pan swears the next scoop is the one.',
  hex_bag: "Smells of sulphur and somebody's grandmother. Warm in the palm.",
  fan_the_hammer: 'Speed is nothing without accuracy. Speed is still fun.',
  mezcal_worm: 'It tastes like courage and, a little, like regret.',
  whiskey_bottle: 'Medicine, according to every bar in the West.',
  pocket_watch: 'Time waits for no man. This one asked nicely.',
  powder_keg: 'Subtle it is not. Neither is the crater.',
  lucky_deck: 'Fifty-two cards, all marked. By whom is the question.',
};
export const LORE_MAX = 72;

/** Lore for an item: this table first, then the def's own `lore`, else ''. */
export const itemLore = (id, def = null) => ITEM_LORE[id] || (def && def.lore) || '';
