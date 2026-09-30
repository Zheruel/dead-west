// Boss and mini-boss words (STORY_PRESENTATION s7): card lines typed under the title, rider overrides, phase banners, WANTED small print, death quips.
// Pure data (node-importable). Consumers: src/ui/Cards.js (boss / mini cards, death quips), Boss.js phase banners, finale.
//   bossIntro(id, {char, trueEligible})  -> {line, extra, extraDelay}   `extra` = second line typed `extraDelay` ms later (Scratch, clean Hell ride)
//   bossDeath(id, {char})                -> string | null               null = no quip (Scratch on the true finale)
//   phaseBanner(id, phase)               -> string | null               UPPERCASE, <= 24 chars
//   miniLines(id)                        -> {name, title, wantedFor, banner, death}
// Word limits (s5.3): card lines <= 12 words on the doc's own text; lint fails > 16, warns > 12.

/** Default card lines. `name` / `title` mirror BOSS_META (EVENTS/CHAPTER2 win on titles; lint warns on drift). */
export const BOSS_LINES = {
  cascabel: { name: 'EL CASCABEL', title: 'The Rattle Before The Bite', intro: 'Sssso. The debtor walks. How sssoon he crawlsss.', death: 'First noticssse ssserved. Sssecond comesss on horssseback.' },
  grimm: { name: 'MARSHAL GRIMM', title: 'The Law Never Sleeps', intro: 'Evenin\'. You are under arrest. The charge is breathing.', death: "Court's adjourned. Read the fine print, son." },
  undertaker: { name: 'THE UNDERTAKER', title: 'Last Rites For The Living', intro: 'Another one out of the ground. Sloppy work. Mine, I mean.', death: 'The mine has a basement. There is always more below.' },
  toro: { name: 'EL TORO INFERNAL', title: 'Horns of the Furnace', intro: '*snorts* The Devil brands what the Undertaker delivers. Hold still.', death: 'The herd... goes on. Without me.' },
  engine: { name: 'ENGINE NO. 666', title: 'The Midnight Express', intro: 'All aboard. The twelve o\'clock leaves on time. It always leaves on time.', death: 'Late. I am... finally... late.' },
  scratch: { name: "OL' SCRATCH", title: 'The House Always Wins', intro: 'Friend! Sit. You have made me a fortune and a small amount of trouble.', death: 'Bravo. Bravo! The chair is yours. I am so very tired.' },
};

/** Rider overrides (replace `intro` / `death`; unlisted riders use the default). Only Grimm, the Undertaker and Scratch have them. */
export const RIDER_INTROS = {
  grimm: {
    gunslinger: { intro: 'Deputy Marrow. You wore my second star.', death: "Court's adjourned, Eli. I was always fair." },
    preacher: { intro: 'Chaplain. You blessed every one of them. Bless yourself.' },
    hunter: { intro: 'Rook. A man who collects should know what a warrant costs.' },
    queen: { intro: 'Miss Marlowe. Cheating is a hanging offence in this county.' },
  },
  undertaker: {
    gunslinger: { intro: 'I dug you shallow. I am about to correct that.', death: 'The mine has a basement, Eli. Your wife is in it.' },
    preacher: { intro: 'Reverend. I measured your congregation. Fifty exact fits.' },
    hunter: { intro: 'Bounty man. I have been measuring you for a year. Come closer.' },
    queen: { intro: 'Madam. Gold leaf on the lid, I think. You deserve it.' },
  },
  scratch: {
    gunslinger: { intro: 'Eli! The best deputy I ever buried. Ada sends her regards. She is quite well.' },
    preacher: { intro: 'Reverend! Still praying? Let us see who answers.' },
    hunter: { intro: 'Mr. Rook! Yes, that is my poster. Lovely frame.' },
    queen: { intro: 'Maude, darling. Do you know what the win cost you? I do.' },
  },
};

/** Scratch on a true-eligible ride (Hell, no deals): replaces the intro; the rider override, if any, is typed as a second line 1.4 s later. */
export const SCRATCH_TRUE_INTRO = 'You have signed nothing on the way here. I am almost offended.';
export const SCRATCH_TRUE_EXTRA_MS = 1400;
/** Barks: the P3 contract page unfurling, and the Sixth Bullet finale cry. */
export const SCRATCH_BARKS = { page: 'Page nine. Do read along.', finale: 'Nobody hurts a man who holds the paper!' };

export function bossIntro(id, { char = 'gunslinger', trueEligible = false } = {}) {
  const d = BOSS_LINES[id];
  if (!d) return { line: '', extra: null, extraDelay: 0 };
  const o = RIDER_INTROS[id] && RIDER_INTROS[id][char];
  if (id === 'scratch' && trueEligible) return { line: SCRATCH_TRUE_INTRO, extra: o ? o.intro : null, extraDelay: SCRATCH_TRUE_EXTRA_MS };
  return { line: (o && o.intro) || d.intro, extra: null, extraDelay: 0 };
}

export function bossDeath(id, { char = 'gunslinger', trueEligible = false } = {}) {
  const d = BOSS_LINES[id];
  if (!d) return null;
  if (id === 'scratch' && trueEligible) return null; // the finale plays instead
  const o = RIDER_INTROS[id] && RIDER_INTROS[id][char];
  return (o && o.death) || d.death;
}

// ------------------------------------------------------------------------------------------------ phase banners (s7.3)
/** Existing widget, UPPERCASE, 1.2 s, <= 24 chars. Chapter 2 banners are CHAPTER2's and stay as written. Key = boss id, then phase index. */
export const PHASE_BANNERS = {
  cascabel: { 2: 'THE RATTLE QUICKENS' },
  grimm: { 2: 'DEPUTIES, ARREST HIM', 3: 'ORDER IN THE COURT' },
  undertaker: { 2: 'EVERY BOX HAS A TENANT', 3: 'THE LID CLOSES' },
  toro: { 1: 'THE FURNACE ROARS', 2: 'HELLFIRE!' },
  engine: { 1: 'ALL ABOARD THE DEAD', 2: 'FULL STEAM AHEAD' },
  scratch: { 0: 'DEAL ME IN', 1: 'I RAISE', 2: 'ALL IN', 3: 'READ THE FINE PRINT' },
};
export const phaseBanner = (id, phase) => (PHASE_BANNERS[id] && PHASE_BANNERS[id][phase]) || null;

// ------------------------------------------------------------------------------------------------ mini-bosses (s7.4)
/** WANTED card small print, phase banner, death quip. Titles come from BOSS_META (EVENTS wins on the title). `bouncer (mini)` = `head_bouncer` (D1). */
export const MINI_LINES = {
  ol_fury: { name: "OL' FURY", title: "The Bull That Wouldn't Stay Buried", wantedFor: 'Trampling three churches and a funeral', banner: 'WIRE AND FURY', death: 'Buried again. It will not take.' },
  hangman: { name: 'THE HANGMAN', title: 'Drop Is Just Rope', wantedFor: 'Hanging without a trial, a warrant or a wage', banner: 'THE DROP', death: "Rope's cut. Nobody drops today." },
  motherlode: { name: 'THE MOTHERLODE', title: 'All That Glitters', wantedFor: 'Four tons of silver, armed and dangerous', banner: 'THE VEIN RISES', death: 'All that glitters goes to pieces.' },
  ash_deacon: { name: 'THE ASH DEACON', title: 'Dust Thou Art', wantedFor: 'Burning the Good Book, the pews and the people in them', banner: 'ASH FALLS', death: 'To dust. As promised.' },
  stoker: { name: 'STOKER JACK', title: 'Full Steam Ahead', wantedFor: 'Overheating the West. Personally.', banner: 'OVERPRESSURE', death: "Boiler's cold. So is the rest." },
  head_bouncer: { name: 'THE HEAD BOUNCER', title: 'Last Call', wantedFor: 'Refusing service to the living', banner: 'LAST CALL', death: 'Last call, friend. Yours.' },
};
export const miniLines = (id) => MINI_LINES[id] || null;

/** Small print fallback when a mini has no row. */
export const WANTED_FALLBACK = 'Disturbing the peace';
