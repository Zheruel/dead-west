// CODEX bestiary text (STORY_PRESENTATION s9, s7.5): enemy lore (<= 30 words) + tip (<= 64 chars), boss / rider bios (<= 30 words).
// Pure data. `BESTIARY` is merged into codexText.ENEMY_TEXT by CodexScene (mergeBestiary): {id: {name, lore, tip}}; entries for the 16 round-1 enemies
// are identical to codexText.js (lint compares). The mini `bouncer (mini)` of the doc is `head_bouncer` (D1) and lives in codexText MINI_TEXT.
// Template for later enemies: id | name (<= 24 chars) | lore (1-2 sentences, <= 30 words: what it was + one dark-funny detail) | tip (<= 64 chars: telegraph, then answer).
const E = (name, lore, tip) => ({ name, lore, tip });

export const BESTIARY = {
  // ---- 9.1 existing 16
  coyote: E('Mangy Coyote', "Perdition's coyotes stopped eating carrion the day the carrion started answering back. Now they hunt in a hurry.", 'Howl means charge. Roll sideways, never backwards.'),
  rattlesnake: E('Rattlesnake', "Cascabel's small print. Every rattle is a legal notice; every bite is enforcement.", 'Rattle first, then a fan of three. Step out of the arc.'),
  tumbleweed: E('Tumbleweed', 'Nothing in Dry Gulch is as innocent as it looks. Especially the tumbleweeds. They have teeth.', 'It splits when it dies. Finish the little ones fast.'),
  tumbleweed_mini: E('Little Weed', 'Smaller, faster, and every bit as unhappy about it.', 'One shot each. Do not chase them.'),
  outlaw: E('Outlaw', "Took the Devil's water and skipped the fine print. Kept the gun, lost the future.", 'Aimed shot every second or so. Strafe across it.'),
  buzzard: E('Skull-Faced Buzzard', 'Circles the living out of habit and the dead out of hope.', 'Wings back means dive. Sidestep, then punish.'),
  possessed: E('The Possessed', 'Perdition men with more passengers than sense. The red eyes are the tenants.', 'Lunges at range. Hurt it and it gets faster.'),
  skeleton: E('Skeleton Gunslinger', 'Fastest draw in the county, once. Wore out his welcome, then his flesh.', 'Fires a spinning cross of four. Stand in the gaps.'),
  dynamiter: E('Dynamiter', 'Believes every problem is a hole in the ground that has not happened yet.', 'The stick lands in a second. Leave the circle.'),
  ghost: E('Prospector Ghost', 'Still looking for the vein he died on. Takes it personally when you cross his claim.', 'Untouchable while faded. Shoot it when it goes solid.'),
  scarecrow: E('Hanged Scarecrow', 'Nobody remembers who strung him up first. The crows do, and they are loyal.', 'Never moves. Thin the crows, then finish it.'),
  crow: E('Gallows Crow', "The scarecrow's staff. They work for scraps, and you are the scraps.", 'Three hit points. Any bullet will do.'),
  miner: E('Sundown Miner', 'The shift never ended. Neither did he.', 'Armoured in front. Circle behind. The swing is slow.'),
  bat: E('Cave Bat', "The mine's smallest tenants and its loudest. They arrive in threes and have opinions.", 'Erratic. Hold a spot and shoot, do not chase.'),
  mole: E('Grave Mole', 'Digs where the Undertaker did not finish, and has views on your boots.', 'When the mound stops, move. It is stunned after it pops.'),
  coffin: E('Hopping Coffin', 'Lid ajar, something inside very keen to meet you. It brought friends.', 'The hop lands a shockwave. Two bats on death.'),
  // ---- 9.2 chapter 2 + the event duelist
  hellhound: E('Hellhound', 'Leashed only by the bar tab. Its bites cost extra.', 'Sidestep the lunge line and the flames miss.'),
  hellsteer: E('Hellsteer', 'A calf of the Devil\'s herd, already branded, already furious.', 'Paws before the charge. It dazes on walls.'),
  cinder_skull: E('Cinder Skull', "A cigar the size of a man's head, still lit and eager to go out with a bang.", 'Shoot it before it arms. Dead skulls are harmless.'),
  magma_eel: E('Magma Eel', 'Swims where the ground forgot to cool. Surfaces only to complain.', 'Only exposed when surfaced. Shoot it as it spits.'),
  sulfur_preacher: E('Sulfur Preacher', 'Preaches the gospel of the furnace. His congregation gets thicker skin.', 'Kill him first: his ward halves damage to the rest.'),
  magma_golem: E('Magma Golem', "The Bluffs' oldest resident. Old enough to have opinions about erosion.", 'The slam draws a lane. Leave it, then flank.'),
  handcar_bandit: E('Handcar Bandit', 'Robbed the wrong train. It was the Devil\'s. He is still working off the fine.', 'Two spikes a volley. Step off his rail.'),
  signalman: E('Signalman', 'Lights the way for trains that no longer run. Locks onto you like a timetable.', 'It locks row and column. The diagonals are safe.'),
  steam_stoker: E('Steam Stoker', 'Shovels coal into a boiler that runs on regret. Never complained. Never stopped.', 'Blast, then a scald cloud. Do not stand in the cloud.'),
  crate_mimic: E('Crate Mimic', 'That cover you were crouching behind has been watching you for a while.', 'Be suspicious of cover. It wakes when you get close.'),
  rail_rat: E('Rail Rat', 'Comes in fives. Sparks from the tail. Nobody has ever counted them twice.', 'Pack of five. Kill them at a doorway.'),
  chain_gang: E('Chain Gang', 'Four convicts on one sentence. The sentence is life. Then more.', 'Kill the head first. Each link takes over, faster.'),
  card_shark: E('Card Shark', 'Deals from the bottom, the top and the sleeve. Every card is a knife.', 'Three arcing cards, then a slow reload. Punish the reload.'),
  loaded_die: E('Loaded Die', 'Rolls whatever the house needs. Angry pips in place of eyes.', 'Count its pips. That many chips are coming.'),
  slot_fiend: E('Slot Fiend', 'A machine that pays out in bullets and never in coin.', 'Read the reels. A mismatch means it jams.'),
  waiter_imp: E('Waiter Imp', 'Delivers drinks and grievances. Tips are optional. Ducking is not.', 'The bottle lands in a second. Leave the marker.'),
  bouncer: E('Bouncer', 'Two hundred pounds of "not tonight". Has never been asked twice.', 'Shielded in front. Hit his sides, or the rush recovery.'),
  joker: E('Joker', 'Laughs first, always. The laughing is the worst part.', 'Watch for the jack-in-the-box. Short fuse.'),
  duelist: E('Ghost Duelist', 'Has been waiting for a quicker draw since 1881. It has been a long wait.', 'Invulnerable until DRAW. Fire the instant the bell ends.'),
};

/** Boss and rider bios (s7.5), <= 30 words. Shown under OUTLAWS / on the CharSelect card. */
export const BIOS = {
  cascabel: 'The first notice in Perdition County. He does not bite to kill. He bites to remind.',
  grimm: 'The county\'s law. Hanged fifty men fairly, then his own noose. He believes he is fair. He is a clerk.',
  undertaker: 'Digs shallow and tidy. Every grave in the mine is his, and every grave is a loan.',
  toro: "The Devil's foreman. Brands every soul the Undertaker delivers, and does not ask them to hold still.",
  engine: 'The Midnight Express has never been late. The Conductor in the cab has been waiting since 1881 to be.',
  scratch: 'The Dealer, the House, the County. Wants only to retire, and to be replaced by someone who can win.',
  gunslinger: 'Deputy Marrow signed one page and skipped another. It cost him a wife, a rope and eight months underground.',
  preacher: 'Josiah Thorne blessed every man Grimm hanged. The Amen sticks in his throat. He carries a Bible and a scattergun and finds them equally persuasive.',
  hunter: 'Cormac Rook has never missed a payday. The only bounty he cannot collect is his own.',
  queen: 'Maude Marlowe beat the Devil at cards once. He let her. She keeps wondering what it cost.',
};

export default BESTIARY;
