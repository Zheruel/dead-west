// Codex text tables (CHARACTERS_META D1, STORY_PRESENTATION s9). Pure data (node-safe). The story job may ship data/story/bestiary.js with the
// remaining chapter-2 lines: CodexScene passes that module to mergeBestiary(). Everything here degrades to generic text when an id is missing.

/** Existing 16 enemies: {name, lore (<= 30 words), tip (<= 64 chars)}. */
export const ENEMY_TEXT = {
  coyote: { name: 'Mangy Coyote', lore: 'Perdition\'s coyotes stopped eating carrion the day the carrion started answering back. Now they hunt in a hurry.', tip: 'Howl means charge. Roll sideways, never backwards.' },
  rattlesnake: { name: 'Rattlesnake', lore: 'Cascabel\'s small print. Every rattle is a legal notice; every bite is enforcement.', tip: 'Rattle first, then a fan of three. Step out of the arc.' },
  tumbleweed: { name: 'Tumbleweed', lore: 'Nothing in Dry Gulch is as innocent as it looks. Especially the tumbleweeds. They have teeth.', tip: 'It splits when it dies. Finish the little ones fast.' },
  tumbleweed_mini: { name: 'Little Weed', lore: 'Smaller, faster, and every bit as unhappy about it.', tip: 'One shot each. Do not chase them.' },
  outlaw: { name: 'Outlaw', lore: 'Took the Devil\'s water and skipped the fine print. Kept the gun, lost the future.', tip: 'Aimed shot every second or so. Strafe across it.' },
  buzzard: { name: 'Skull-Faced Buzzard', lore: 'Circles the living out of habit and the dead out of hope.', tip: 'Wings back means dive. Sidestep, then punish.' },
  possessed: { name: 'The Possessed', lore: 'Perdition men with more passengers than sense. The red eyes are the tenants.', tip: 'Lunges at range. Hurt it and it gets faster.' },
  skeleton: { name: 'Skeleton Gunslinger', lore: 'Fastest draw in the county, once. Wore out his welcome, then his flesh.', tip: 'Fires a spinning cross of four. Stand in the gaps.' },
  dynamiter: { name: 'Dynamiter', lore: 'Believes every problem is a hole in the ground that has not happened yet.', tip: 'The stick lands in a second. Leave the circle.' },
  ghost: { name: 'Prospector Ghost', lore: 'Still looking for the vein he died on. Takes it personally when you cross his claim.', tip: 'Untouchable while faded. Shoot it when it goes solid.' },
  scarecrow: { name: 'Hanged Scarecrow', lore: 'Nobody remembers who strung him up first. The crows do, and they are loyal.', tip: 'Never moves. Thin the crows, then finish it.' },
  crow: { name: 'Gallows Crow', lore: 'The scarecrow\'s staff. They work for scraps, and you are the scraps.', tip: 'Three hit points. Any bullet will do.' },
  miner: { name: 'Sundown Miner', lore: 'The shift never ended. Neither did he.', tip: 'Armoured in front. Circle behind. The swing is slow.' },
  bat: { name: 'Cave Bat', lore: 'The mine\'s smallest tenants and its loudest. They arrive in threes and have opinions.', tip: 'Erratic. Hold a spot and shoot, do not chase.' },
  mole: { name: 'Grave Mole', lore: 'Digs where the Undertaker did not finish, and has views on your boots.', tip: 'When the mound stops, move. It is stunned after it pops.' },
  coffin: { name: 'Hopping Coffin', lore: 'Lid ajar, something inside very keen to meet you. It brought friends.', tip: 'The hop lands a shockwave. Two bats on death.' },
};

/** Bosses (the three original ones; chapter 2 bosses come from bestiary.js or fall back to BOSS_META name / title). */
export const BOSS_TEXT = {
  cascabel: { lore: 'Old ranchers say the snake ate a preacher\'s bell and has rung ever since.', tip: 'Watch the tail: it rattles before every dive.', attacks: ['Tail rattle fan', 'Pop-up dive', 'Venom spit'] },
  grimm: { lore: 'Marshal Grimm hanged fifty men for the Devil. The noose went around his own neck at the fifty-first.', tip: 'Dynamite rings mark where they land. Keep moving.', attacks: ['Quick-draw volley', 'Dynamite ring', 'Hangman\'s charge'] },
  undertaker: { lore: 'He never stopped measuring. Every coffin in the mine was cut to fit someone still walking.', tip: 'Coffin lids telegraph the drop. Circle the shovel.', attacks: ['Coffin drop', 'Shovel sweep', 'Grave summons'] },
};

/** Mini-bosses shown under OUTLAWS (names come from BOSS_META). */
export const MINI_TEXT = {
  ol_fury: { lore: 'A bull that wouldn\'t stay buried, wrapped in barbed wire and grudges.', tip: 'It charges in straight lines. Let it hit the wall.' },
  hangman: { lore: 'Drop is just rope. He has plenty of both.', tip: 'The chain swing has a long wind-up. Roll through it.' },
  motherlode: { lore: 'All that glitters is a miner who did not make it out.', tip: 'Shoot the lantern heart when the boulder goes up.' },
  ash_deacon: { lore: 'Dust thou art. He is happy to help with the returning.', tip: 'Stay off the censer\'s trail of sparks.' },
  stoker: { lore: 'Full steam ahead is the only speed Stoker Jack knows.', tip: 'Wait for the lunge, then shoot the furnace.' },
  head_bouncer: { lore: 'Last call was an hour ago. Nobody told him.', tip: 'The thrown bottle marks its landing. Leave the marker.' },
};

/** One-line world entries by codex kind: id -> [name, line]. Feeds the WORLD section at the end of the LORE tab. */
export const WORLD = {
  events: {
    card_sharp: ['Card Sharp', 'A skeleton gambler will bet anything you can carry, and a few things you cannot.'],
    wishing_well: ['Wishing Well', 'Coins in, wishes out. The well keeps the change.'],
    gravedigger: ['Gravedigger', 'He digs for the living, since the dead never pay.'],
    preacher: ['Preacher', 'A confessional in the desert. The booth is warm, and so is the reply.'],
    snake_oil: ['Snake Oil Salesman', 'Six colours, six cures, one wagon. The bottle knows which is which.'],
    quick_draw: ['Quick Draw', 'A bell, a chalk mark and a stranger with steady hands.'],
  },
  affixes: {
    cursed: ['Cursed', 'Sold its soul twice. Tough, and it pays back in hearts.'],
    armored: ['Armored', 'Plated for bullets. Explosions do not care.'],
    swift: ['Swift', 'Faster feet, shorter patience.'],
    volatile: ['Volatile', 'Goes off when it dies. Do not stand close.'],
    shielded: ['Shielded', 'A blue bubble soaks the first hits.'],
    splitting: ['Splitting', 'Two smaller ones crawl out of the body.'],
    burning: ['Burning', 'Leaves fire behind and takes none from yours.'],
    vampiric: ['Vampiric', 'Every hit it lands heals it.'],
  },
  mods: {
    dust_storm: ['Dust Storm', 'Wind pushes you along a random cardinal line.'],
    darkness: ['Darkness', 'Only a small lantern circle is lit.'],
    stampede: ['Stampede', 'Chevrons on the walls mean spectral bulls are coming.'],
    blood_moon: ['Blood Moon', 'Everyone hits harder, and everyone dies sooner.'],
    fog: ['Fog', 'A cold grey shroud hides the far side of the room.'],
    rockfall: ['Rockfall', 'The ceiling drops rocks. Watch the warning circles.'],
    hellfire: ['Hellfire', 'Embers mark the floor before it burns.'],
    lurch: ['Lurch', 'The whole room shoves sideways on a timer.'],
  },
  curses: {
    curse_debt: ['Debt', 'Everything costs half again as much.'],
    curse_dark: ['The Dark', 'A quarter of the plain rooms go dark.'],
    curse_rot: ['Rot', 'Elites come twice as often.'],
    curse_lead: ['Lead', 'Slower on foot, slower to roll.'],
  },
  blessings: {
    bless_steady: ['Steady Hand', 'Shoot 8 percent faster.'],
    bless_grace: ['Grace', 'A little more luck than you deserve.'],
    bless_iron: ['Iron', 'Hit harder, and start with tin.'],
    bless_fleet: ['Fleet Foot', 'Faster on foot, faster off a roll.'],
  },
  secrets: {
    stash: ['Stash', 'A wall that was never a wall. Two pickups and maybe a relic.'],
    dead_mans_hand: ['Dead Man\'s Hand', 'Five cards face down. Take one; the rest burn.'],
    cache: ['Cache', 'Crates and powder barrels. Mind the chain reaction.'],
    shrine: ['Shrine', 'A guaranteed relic behind a ring of spikes.'],
    supersecret: ['The Vault', 'A room behind the secret room. Somebody hid it twice.'],
  },
  potions: {
    p_heal: ['Tonic', 'Heals four units. The label was accurate for once.'],
    p_vigor: ['Vigor', 'More damage, no side effects worth mentioning.'],
    p_swift: ['Swiftness', 'Fast, fleeting, and gone in 45 seconds.'],
    p_venom: ['Venom', 'Costs a unit of health; bullets poison in return.'],
    p_laudanum: ['Laudanum', 'A room shield, and legs like wet sand.'],
    p_kerosene: ['Kerosene', 'A lit stick at your feet and three more in the pack.'],
  },
};

/** Section titles of the WORLD list in kind order. */
export const WORLD_KINDS = [['events', 'EVENTS'], ['affixes', 'ELITE AFFIXES'], ['mods', 'ROOM MODIFIERS'], ['curses', 'CURSES'], ['blessings', 'BLESSINGS'], ['secrets', 'SECRETS'], ['potions', 'POTIONS']];

/** Merge a story bestiary module ({id: {name, lore, tip}} or {BESTIARY}) into ENEMY_TEXT; returns the number of entries added. Never throws. */
export function mergeBestiary(mod) {
  try {
    const src = mod && (mod.BESTIARY || mod.default || mod);
    if (!src || typeof src !== 'object') return 0;
    let n = 0;
    for (const [id, e] of Object.entries(src)) {
      if (e && typeof e === 'object' && (e.lore || e.tip || e.name)) { ENEMY_TEXT[id] = { ...ENEMY_TEXT[id], ...e }; n++; }
    }
    return n;
  } catch (e) { return 0; }
}

/** Fallback readable name for an id. */
export const prettyId = (id) => String(id).replace(/^(p_|curse_|bless_)/, '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
export const enemyText = (id) => ENEMY_TEXT[id] || { name: prettyId(id), lore: '', tip: '' };
