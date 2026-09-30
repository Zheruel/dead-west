// STORY text: floor cards, whispers, chapter cards, ledger cards, menu/poster copy, credits (STORY_PRESENTATION s4, s5.2, s6.3, s14).
// Pure data + tiny pure helpers (no Phaser, no storage): node-importable, linted by tools/qa/story-lint.mjs.
// Consumers: src/ui/Cards.js (floor / chapter / checkpoint / whispers), MenuScene (subtitle, credits), EndScene (poster strings), Pause / CharSelect
// (labels), CutsceneScene (ledger cards), CreditsScene (credits roll). Everything is keyed by id: rename a key, never rewrite prose.
// Rules (s4): captions <= 2 lines of <= 52 chars, UI labels <= 24 chars, barks / banners UPPERCASE <= 24 chars.

// ------------------------------------------------------------------------------------------------ floor cards (s5.2)
/** primary = shown normally; alt = seeded pick on rides >= 3; hell = HELL ON EARTH. `name` mirrors FLOORS[n].name (lint checks it). */
export const FLOOR_TEXT = {
  1: { name: 'DRY GULCH', primary: 'Where the buzzards circle', alt: 'The ground remembers everyone', hell: 'The sun has a grudge' },
  2: { name: 'PERDITION', primary: 'A town that forgot to die', alt: 'Last one out, hang the sign', hell: "Nobody's home. Nobody's alone." },
  3: { name: 'SUNDOWN MINE', primary: 'Deeper than the Devil digs', alt: 'The dark is on the payroll', hell: 'Bring a candle. Bring two.' },
  4: { name: 'BRIMSTONE BLUFFS', primary: "The Devil's front porch", alt: 'Everything here wears a brand', hell: 'The heat has your name on it' },
  5: { name: 'BLOOD RAIL', primary: 'The midnight run never ends', alt: 'Punctuality is a virtue. Also a threat.', hell: 'Watch the gap. And the whistle.' },
  6: { name: 'THE LAST CHANCE SALOON', primary: 'The house always wins', alt: 'Drinks are on the Devil', hell: 'The dealer is looking at you' },
};

/**
 * Subtitle for a floor card. opts: { hell, runs (rides started on this save), rng (seeded, has .chance) }.
 * Hell rides always use the hell line; from the 3rd ride on, half the cards use the alt line.
 */
export function floorSubtitle(floor, { hell = false, runs = 0, rng = null } = {}) {
  const f = FLOOR_TEXT[floor];
  if (!f) return '';
  if (hell) return f.hell;
  if (runs >= 3 && rng && rng.chance(0.5)) return f.alt;
  return f.primary;
}

/** Accent colours of the floor cards (also FLOORS[n].accent). */
export const FLOOR_ACCENT = { 1: 0xd9a04a, 2: 0xa07ad0, 3: 0x8fc23f, 4: 0xff7a1f, 5: 0x6fe0d0, 6: 0xd4a537 };

// ------------------------------------------------------------------------------------------------ chapter cards
export const CHAPTER_CARDS = {
  1: { line: 'CHAPTER I', name: 'PERDITION COUNTY', tagline: 'Every debt comes due.', tint: 0xffffff },
  2: { line: 'CHAPTER II', name: "HELL'S FRONTIER", tagline: "The Devil's Own Country", tint: 0xff5a2a },
};
export const CHECKPOINT_TOAST = 'CHECKPOINT - THE HOUSE KEEPS YOUR PLACE';
/** Black text cards on a descent (3 s, typed 30 cps, skippable). Key = `f<from>_f<to>`. */
export const TEXT_CARDS = {
  f4_f5: ['The bull went down. Somewhere, a whistle blew.', 'Hell has a railway. Of course it does.'],
};

// ------------------------------------------------------------------------------------------------ room whispers (s5.2)
export const WHISPERS = {
  1: ["Nothing grows here that wasn't paid for.", 'Somebody has been digging, and not to bury.', 'The buzzards are not circling you. Yet.'],
  2: ['Every tombstone is stamped PAID.', 'The saloon piano is playing. The saloon has no piano.', 'A wanted poster with your face. It is dated last year.'],
  3: ['The silver ran out. The dead did not.', 'Someone carved "A.M." into the timber. It is still fresh.', 'The mine is quiet. The mine is listening.'],
  4: ['The ground is warm. The ground is always warm.', 'Every rock here has a brand on it. Some are still smoking.', 'The bull left tracks. The tracks are on fire.'],
  5: ['The station clock stopped at twelve. Nobody has corrected it.', 'The rails are polished. Someone loves this job.', 'A whistle in the fog. You are not on the timetable.'],
  6: ['The piano knows your favourite song. It is a funeral march.', 'A chair is pulled out for you. It is warm.', 'The floor is sticky. Let us hope it is the good kind.'],
};
/** Rider extras: replace a pick 50 % of the time (gunslinger, F4 and F6 only). */
export const WHISPERS_RIDER = {
  gunslinger: {
    4: ['A queen of hearts drifts past on the hot wind.'],
    6: ['Somewhere above the piano, a woman hums a hymn. You know the words.'],
  },
};

/** One whisper for a floor's start room. `rng` is the seeded stream (rng.game); consumes a fixed 2 draws so the stream stays in step. */
export function pickWhisper(floor, char, rng) {
  const list = WHISPERS[floor] || WHISPERS[1];
  const pick = list[Math.floor(rng.next() * list.length)];
  const extra = WHISPERS_RIDER[char] && WHISPERS_RIDER[char][floor];
  const swap = rng.next() < 0.5;
  return extra && swap ? extra[0] : pick;
}

// ------------------------------------------------------------------------------------------------ ledger cards (s6.3)
/** Text-only rider cards: line 1-3. Shown for a rider's first two rides and whenever the intro is skipped. */
export const LEDGER_CARDS = {
  gunslinger: ['Eli Marrow. Hanged. Buried shallow.', 'Owes one soul. Reads the fine print now.', 'Somewhere down the road, a bed is empty.'],
  preacher: ['He blessed fifty men on their way to the rope.', 'The Devil counted every blessing as consent.', 'A summons in the hymnal. He packed the scattergun.'],
  hunter: ['Cormac Rook has never missed a payday.', 'Somebody has posted a price on his head.', 'He intends to collect on the one who did it.'],
  queen: ['Maude Marlowe once cheated the Devil at cards.', 'He let her win. She has been wondering why.', 'A marked ace arrived by post. Rematch.'],
};
/** Character-select taglines (also unlock toasts). */
export const CHAR_TAGLINES = {
  gunslinger: 'Owes one soul. Pays in lead.',
  preacher: 'Blessed the noose. Regrets the blessing.',
  hunter: 'Never missed a payday. Never met this mark.',
  queen: "Beat the Devil once. He's still sore.",
};
/** Names spoken in cutscene captions (the UI keeps "The Gunslinger"). */
export const RIDER_NAMES = { gunslinger: 'Eli Marrow', preacher: 'Josiah Thorne', hunter: 'Cormac Rook', queen: 'Maude Marlowe' };
export const RIDERS = ['gunslinger', 'preacher', 'hunter', 'queen'];

// ------------------------------------------------------------------------------------------------ menu and poster copy (s4)
/** Under the logo, one per launch. `progress` = {won, trueEnding}: extra lines that replace the base rotation. */
export const MENU_SUBTITLES = ['The Devil keeps very good books.', 'Ride out. Ride hard. Ride dead.', 'Every debt comes due.', 'Read the fine print.'];
export const MENU_SUBTITLE_WON = 'The deck is warm.';
export const MENU_SUBTITLE_TRUE = 'The county is quiet.';
export function menuSubtitle({ won = false, trueEnding = false } = {}, rng = null) {
  if (trueEnding) return MENU_SUBTITLE_TRUE;
  const pool = won ? [...MENU_SUBTITLES, MENU_SUBTITLE_WON, MENU_SUBTITLE_WON] : MENU_SUBTITLES;
  return pool[rng ? Math.floor(rng.next() * pool.length) : 0];
}

export const WIN_POSTER = {
  h1: 'CHAPTER II',
  h2: "-  HELL'S FRONTIER  -",
  sub: { a: 'The House has new management.', true: 'The county is quiet. The books are closed.' },
};

/** UI lexicon: labels used across scenes (<= 24 chars where they sit on a button). */
export const UI = {
  menu: ['RIDE OUT', 'DAILY RIDE', 'BOUNTY BOARD', 'CODEX', 'OPTIONS', 'CREDITS'],
  continue: (floor) => `CONTINUE - FLOOR ${floor}`,
  charSelect: 'CHOOSE YOUR RIDER',
  modes: {
    normal: ['NORMAL', 'The way the Devil intended.'],
    hell: ['HELL ON EARTH', 'Same county. The Devil changed what counts as fair.'],
    daily: ['DAILY RIDE', 'Same sun, same road. One rider at a time.'],
  },
  retry: 'R  -  DEAL ME IN AGAIN',
  hellDead: "Dealt a dead man's hand.",
  pause: ['RIDE ON', 'OPTIONS', 'FOLD THE HAND'],
  foldConfirm: 'Fold the hand? The Devil keeps your chips.',
  hands: { clean: 'HANDS: CLEAN', signed: 'HANDS: SIGNED' },
};

// ------------------------------------------------------------------------------------------------ boot lines (s12; tips live in tips.js)
export const BOOT_LINES_EXTRA = [
  'Branding the herd...', 'Stoking the boiler...', 'Shuffling the marked deck...', 'Reading page two...', 'Oiling the noose...',
  'Persuading the piano...', 'Signing nothing...', 'Waiting for the Devil to stop laughing...',
];

// ------------------------------------------------------------------------------------------------ toasts after the credits (s6.5, s6.6)
export const ENDING_TOASTS = {
  a: { kicker: 'MODE UNLOCKED', name: 'HELL ON EARTH', quote: 'The deck is warm.' },
  true: { kicker: 'TRUE ENDING', name: 'THE SIXTH BULLET', quote: 'The county is quiet.' },
};

// ------------------------------------------------------------------------------------------------ credits (s14)
/**
 * Credits roll. Row kinds: 'title' (Rye, big), 'sub', 'head' (Rye amber heading), 'line' (label + text), 'text', 'gap', 'rule'.
 * `{{music_credits_ch2}}` expands to MUSIC_CREDITS_CH2 (assets/audio/CREDITS_music2a.md, CREDITS_music2b.md).
 */
export const MUSIC_CREDITS_CH2 = [
  '"Crusade", "Death and Axes", "Grand Dark Waltz Allegretto", "Grand Dark Waltz Allegro", "Unholy Knight", "Spider\'s Web", "Past the Edge",',
  '"Anamalie", "Impact Intermezzo", "When The Wind Blows", "Disquiet", "Crossing the Divide"',
  'Ambience: "Bonfire burning" (Werstas) and "Steam whistle" (Konrad Gutkowski), Work With Sounds, CC BY 4.0',
];
export const CREDITS = [
  ['title', 'DEAD WEST'],
  ['sub', 'A Tale of Perdition County'],
  ['rule'],
  ['line', 'GAME DESIGN & CODE', 'The Dead West outfit'],
  ['line', 'ART', 'Painted in ink and cross-hatch with GPT Image 2.5, cut and polished by hand'],
  ['line', 'STORY & WORDS', "The Dead West outfit, with help from the Devil's marketing department"],
  ['line', 'MUSIC', 'Kevin MacLeod (incompetech.com), CC BY 4.0 {{music_credits_ch2}}'],
  ['line', 'SOUND', 'Freesound and Kenney contributors (CC0 / CC BY), see assets/audio/CREDITS_sfx.md'],
  ['line', 'TYPEFACES', 'Rye and Special Elite (Google Fonts, SIL OFL)'],
  ['line', 'ENGINE', 'Phaser 3 + Vite'],
  ['rule'],
  ['line', 'THE RIDERS', 'The Gunslinger, Rev. Josiah Thorne, Cormac Rook, Maude Marlowe'],
  ['line', 'THE KEEPERS', 'El Cascabel, Marshal Grimm, The Undertaker, El Toro Infernal, Engine No. 666'],
  ['line', 'THE HOUSE', "Ol' Scratch"],
  ['line', 'WITH APOLOGIES TO', 'Every buzzard we made a villain'],
  ['rule'],
  ['line', 'SPECIAL THANKS', 'To everyone who died so you could try again'],
  ['text', 'No riders were harmed in the making of this game. Several were invoiced.'],
  ['rule'],
];
/** Last line of the roll by ending. */
export const CREDITS_TAIL = { a: 'The deck is warm.', true: 'ACCOUNT CLOSED.' };

/** Expand the credits rows into plain {kind, label?, text} objects (the placeholder is filled from `musicCredits`, an array of lines). */
export function creditsRows(ending = 'a', musicCredits = MUSIC_CREDITS_CH2) {
  const music = musicCredits.join(' ');
  const rows = CREDITS.map(([kind, a, b]) => {
    if (kind === 'line') return { kind, label: a, text: String(b).replace('{{music_credits_ch2}}', music).replace(/\s+$/, '') };
    if (kind === 'title' || kind === 'sub' || kind === 'text') return { kind, text: a };
    return { kind };
  });
  rows.push({ kind: 'tail', text: CREDITS_TAIL[ending] || CREDITS_TAIL.a });
  return rows;
}
