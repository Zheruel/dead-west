// Cutscene scripts (STORY_PRESENTATION s5.1 schema, s6 scripts). Pure data (no Phaser): node-importable, linted by tools/qa/story-lint.mjs.
//
//   CUTSCENES[id] = { music, letterbox, kind?, panels: [Panel], ... }
//   Panel = {
//     image           texture key (missing / not loaded = dark placeholder with the key name; the caption still plays)
//     caption         string[] (1-2 lines, <= 52 chars per line, <= 2 sentences)
//     caption_if      { char: {<rider>: string[]}, clean: string[], hell: string[] }   first match wins, order char > clean > hell
//     caption_after   string[] typed after the overlay ends (default) | caption_after_if { char: {...} } same grammar
//     sfx             [key | {key, at (seconds into the panel)}]   'amb_*' keys go to the ambience layer
//     duration        minimum hold in seconds (the panel also waits for its typewriter + 0.9 s)
//     transition      OUT of the panel: cut | fade | iris | ink | flash | slam
//     kb              Ken-Burns: push_in (1.00 -> 1.08) | pull_out | pan_l | pan_r (scale 1.10, drift 40 px) | still
//     shake           px of camera shake while the panel shows
//     tint            'sepia' (multiply 0xd9b071) | 'red' | null
//     focus           [x, y] iris focus point (default screen centre)
//     overlay         { type: 'parchment', at, text, text_if: {char: {...}}, ms (ms per char), ms_if: {char: {...}}, hold (s) }
//                     | { type: 'stamp', text, at, only_char: [rider...] }   (Rye title stamped over the image)
//   }
//   kind: 'ledger' cutscenes are text-only rider cards (s6.3): { kind: 'ledger', char, lines: [3 strings] }; kind: 'card' = black typed text card (s5.2, F4 -> F5).
// Context (ctx) = { char, clean, hell } from flow.cutsceneCtx / ?cutscene=<id>&char=&clean=1&hell=1.
import { LEDGER_CARDS, RIDERS, TEXT_CARDS } from './text.js';

export const TINTS = { sepia: 0xd9b071, red: 0xff7a68 };
export const KB_MODES = ['push_in', 'pull_out', 'pan_l', 'pan_r', 'still'];
export const TRANSITIONS = ['cut', 'fade', 'iris', 'ink', 'flash', 'slam'];

const P = (image, caption, duration, transition, extra = {}) => ({ image, caption, duration, transition, kb: 'push_in', ...extra });
/** Same caption for the four riders except where the script names the rider (`c` = {gunslinger, preacher, hunter, queen}). */
const RIDER_CAPTIONS = (c) => ({ char: { gunslinger: c.gunslinger, preacher: c.preacher, hunter: c.hunter, queen: c.queen } });

export const CUTSCENES = {
  // ---------------------------------------------------------------------------------------- 6.1 intro "THE DEBT" (first ride, gunslinger)
  intro: {
    music: 'mus_cutscene_intro', letterbox: 96,
    panels: [
      P('cutscene_intro_1', ['Perdition County, winter of \'86.', 'Eli Marrow had a wife, a fever and eleven dollars.'], 6.0, 'fade', { tint: 'sepia', sfx: ['amb_wind', 'heartbeat'], kb: 'push_in' }),
      P('cutscene_intro_2', ['The Dealer made an offer. Eli read page one.', 'Nobody ever reads page two.'], 6.0, 'fade', { tint: 'sepia', sfx: ['pen_scratch', { key: 'card_shuffle', at: 0.6 }], kb: 'pan_r' }),
      P('cutscene_intro_3', ['Ada woke up cured. Eli woke up owing.', 'One morning the bed was empty. The bill was due.'], 5.5, 'slam', { tint: 'sepia', sfx: ['wind_gust', { key: 'door_close', at: 1.6 }], kb: 'pull_out' }),
      P('cutscene_intro_4', ['Eli went after her. Marshal Grimm hanged him for it.', "Fair is the Devil's favourite loophole."], 5.5, 'fade', { tint: 'sepia', sfx: ['bell_toll'], kb: 'push_in' }),
      P('cutscene_intro_5', ['The Undertaker dug the grave shallow.', 'Shallow is easier to undo.'], 5.0, 'iris', { tint: 'sepia', sfx: ['dig'], kb: 'push_in', focus: [720, 560] }),
      P('cutscene_intro_6', ['Some men rest in peace. Eli got a summons.', '"OVERDUE. CALL AT THE LAST CHANCE SALOON."'], 6.0, 'flash', { sfx: ['dig', { key: 'zombie_groan', at: 1.2 }, { key: 'gun_cock', at: 2.4 }], kb: 'pull_out', shake: 2 }),
      P('cutscene_intro_7', ['Six chambers. One county. One overdue account.', 'He had never read page two. He could read a road.'], 6.5, 'fade', { sfx: ['wind_gust', { key: 'gun_cock', at: 3.0 }], kb: 'pan_l' }),
    ],
  },

  // ---------------------------------------------------------------------------------------- Hell on Earth, every rider (no new art)
  intro_hell: {
    music: 'mus_cutscene_intro', letterbox: 96,
    panels: [
      P('cutscene_end_a_5', ["The Devil's books always balance.", 'Somebody new is always owing.'], 5.0, 'ink', { tint: 'red', sfx: ['dig'], kb: 'pull_out' }),
      P('cutscene_intro_7', ['Six chambers. Same debt. Higher interest.', 'The House has read your file.'], 5.0, 'fade', { sfx: ['wind_gust'], kb: 'push_in' }),
    ],
  },

  // ---------------------------------------------------------------------------------------- 6.2 interlude (after the CHAPTER2 card, F3 -> F4)
  interlude_ch1: {
    music: 'mus_interlude', letterbox: 96, keepMusic: true,
    panels: [
      P('cutscene_interlude_1', ['The coffin held no corpse.', 'It held the rest of the contract.'], 7.0, 'fade', {
        sfx: ['page_flip', { key: 'pen_scratch', at: 1.4 }], kb: 'push_in',
        overlay: {
          type: 'parchment', at: 3.2, hold: 2.6, ms: 30, ms_if: { char: { gunslinger: 60 } },
          text: "PAGE TWO. SURETY. Upon the Debtor's default, the Debtor's wife shall be held at the House until the account is settled in full. Signed: A. Marrow, in her own hand.",
          text_if: {
            char: {
              gunslinger: "PAGE TWO. SURETY. Upon the Debtor's default, the Debtor's wife shall be held at the House until the account is settled in full. Signed: A. Marrow, in her own hand.",
              preacher: "PAGE TWO. SURETY. Upon default, the Debtor's flock, fifty souls blessed by his own hand, shall be held at the House until the account is settled in full. Witnessed: J. Thorne. Amen.",
              hunter: "PAGE TWO. SURETY. Upon default, the Debtor's name shall be posted and its price held at the House until the account is settled in full. Signed: C. Rook. Paid In Full.",
              queen: "PAGE TWO. SURETY. Upon default, the Debtor's winnings, every chip she ever won, shall be held at the House until the account is settled in full. Signed: M. Marlowe. Queen of Spades.",
            },
          },
        },
        caption_after: ['Ada had read page two.', 'She signed it anyway.'],
        caption_after_if: {
          char: {
            gunslinger: ['Ada had read page two.', 'She signed it anyway.'],
            preacher: ['The Amen was the signature.', 'It always was.'],
            hunter: ['He had priced everyone else\'s head.', 'He never checked his own.'],
            queen: ['The Devil let her win.', 'Now she saw the receipt.'],
          },
        },
      }),
    ],
  },

  // ---------------------------------------------------------------------------------------- 6.4 F5 boss -> F6
  saloon_arrival: {
    music: 'mus_floor6', letterbox: 96, // the F6 track starts with the arrival; floor:changed then crossfades to the floor's own bed
    panels: [
      P('cutscene_saloon_1', ['The rails run out at the Last Chance Saloon.', 'Everything in the county ends up here.'], 5.5, 'iris', { sfx: ['train_horn', { key: 'piano_sting', at: 2.2 }], kb: 'push_in', focus: [720, 470] }),
    ],
  },

  // ---------------------------------------------------------------------------------------- 6.5 ending A "TAKE THE CHAIR"
  end_a: {
    music: 'mus_ending_a', letterbox: 96, endingImage: 'cutscene_end_a_5',
    panels: [
      P('cutscene_end_a_1', ['The Devil died the way he lived,', 'holding every card and laughing.'], 5.5, 'fade', { sfx: ['card_flip', { key: 'boss_die', at: 0.8 }], kb: 'push_in' }),
      P('cutscene_end_a_2', ['"Congratulations, friend. You\'re hired."', 'Page nine. Nobody reads page nine.'], 5.5, 'fade', { sfx: ['page_flip', { key: 'piano_sting', at: 1.0 }], kb: 'pull_out' }),
      P('cutscene_end_a_3', ['Scratch never lied. Ada walked out, free.', 'She did not look back. He would have done the same.'], 6.0, 'fade', {
        sfx: ['door_open', { key: 'step_wood', at: 1.2 }], kb: 'push_in',
        caption_if: RIDER_CAPTIONS({
          gunslinger: ['Scratch never lied. Ada walked out, free.', 'She did not look back. He would have done the same.'],
          preacher: ['Fifty souls filed out the door, free.', 'The Chaplain counted them twice.'],
          hunter: ['His poster curled and burned on the wall.', 'The price on his head fell to zero.'],
          queen: ['Her winnings turned to ash, and her debt with them.', 'Maude called it the worst hand she ever won.'],
        }),
      }),
      P('cutscene_end_a_4', ['The house rose for its new management.', 'Eli dealt fair. It never once mattered.'], 6.0, 'ink', {
        sfx: ['card_shuffle', { key: 'crowd_murmur', at: 0.4 }], kb: 'pull_out',
        caption_if: RIDER_CAPTIONS({
          gunslinger: ['The house rose for its new management.', 'Eli dealt fair. It never once mattered.'],
          preacher: ['The house rose for its new management.', 'The Chaplain dealt fair. It never once mattered.'],
          hunter: ['The house rose for its new management.', 'Rook dealt fair. It never once mattered.'],
          queen: ['The house rose for its new management.', 'Maude dealt fair. It never once mattered.'],
        }),
      }),
      P('cutscene_end_a_5', ['Somewhere in the gulch, a grave started to move.', 'The Devil keeps very good books. Now, so does he.'], 6.5, 'fade', { sfx: ['dig', { key: 'gun_cock', at: 2.6 }], kb: 'pull_out' }),
    ],
  },

  // ---------------------------------------------------------------------------------------- 6.6 ending B "THE SIXTH BULLET" (after the finale)
  end_true: {
    music: 'mus_ending_true', letterbox: 96, endingImage: 'cutscene_end_true_6',
    panels: [
      P('cutscene_end_true_1', ['Six bullets. The House keeps the sixth.', 'It always did.'], 5.5, 'slam', { sfx: ['gun_cock', { key: 'clock_tick', at: 0.8 }], kb: 'push_in' }),
      P('cutscene_end_true_2', ['The Devil wrote a clause for everything.', "Except a debtor who wouldn't take the job."], 5.5, 'flash', { sfx: ['shoot_crit', { key: 'contract_tear', at: 0.3 }, { key: 'page_burn', at: 0.9 }], kb: 'pull_out', shake: 3 }),
      P('cutscene_end_true_3', ['"Friend, that isn\'t how this--"', 'It was, actually.'], 5.0, 'fade', { sfx: ['card_flip', { key: 'boss_die', at: 0.6 }], kb: 'push_in' }),
      P('cutscene_end_true_4', ['Every page in the Ledger burned at once.', "Perdition County's dead put on their hats and left."], 6.0, 'fade', { sfx: ['crowd_murmur', { key: 'bell_toll', at: 2.0 }], kb: 'pull_out' }),
      P('cutscene_end_true_5', ['Ada lifted her veil and touched his sleeve once.', 'Then she walked east with the rest of them.'], 6.5, 'fade', {
        sfx: ['wind_gust', { key: 'step_dirt', at: 1.4 }], kb: 'pan_r',
        caption_if: RIDER_CAPTIONS({
          gunslinger: ['Ada lifted her veil and touched his sleeve once.', 'Then she walked east with the rest of them.'],
          preacher: ['He said "Amen" again, and meant it the other way.', 'Fifty men put their hats back on.'],
          hunter: ['The price on his head burned to nothing.', 'Rook tipped his hat to the empty wall.'],
          queen: ['Her chips turned to petals on the wind.', 'Maude did not try to catch them.'],
        }),
      }),
      P('cutscene_end_true_6', ['Eli Marrow. Deputy. Debtor. Dead man.'], 7.0, 'fade', {
        sfx: ['bell_toll', 'amb_wind'], kb: 'push_in',
        overlay: { type: 'stamp', text: 'ACCOUNT CLOSED', at: 2.8, only_char: ['gunslinger'] },
        caption_if: RIDER_CAPTIONS({
          gunslinger: ['Eli Marrow. Deputy. Debtor. Dead man.'],
          preacher: ['The Chaplain read last rites at the crossroads.', 'It was the first prayer the county ever earned.'],
          hunter: ['The reward was never paid.', 'He found he did not mind, which annoyed him most.'],
          queen: ['She left the table with nothing on it.', 'It was the best hand she ever played.'],
        }),
      }),
    ],
  },
};

// ---------------------------------------------------------------------------------------- 6.3 ledger cards (generated from LEDGER_CARDS)
for (const c of RIDERS) {
  CUTSCENES[`ledger_${c}`] = { kind: 'ledger', char: c, music: null, letterbox: 0, maxSeconds: 4.5, lines: LEDGER_CARDS[c], panels: [] };
}

// ---------------------------------------------------------------------------------------- 5.2 black text card on a descent (F4 -> F5)
CUTSCENES.card_f4_f5 = { kind: 'card', music: null, letterbox: 0, maxSeconds: 6, lines: TEXT_CARDS.f4_f5, panels: [] };

export const CUTSCENE_IDS = Object.keys(CUTSCENES);
export const isCutscene = (id) => !!CUTSCENES[id];

// ---------------------------------------------------------------------------------------- pure helpers (used by CutsceneScene and the linter)
/** Caption lines of a panel for a context: caption_if (char > clean > hell, first match wins) else caption. */
export function panelCaption(panel, ctx = {}) {
  const ci = panel.caption_if;
  if (ci) {
    if (ci.char && ctx.char && ci.char[ctx.char]) return ci.char[ctx.char];
    if (ci.clean && ctx.clean) return ci.clean;
    if (ci.hell && ctx.hell) return ci.hell;
  }
  return panel.caption || [];
}
/** caption_after lines for a context, or null. */
export function panelAfter(panel, ctx = {}) {
  const ci = panel.caption_after_if;
  if (ci) {
    if (ci.char && ctx.char && ci.char[ctx.char]) return ci.char[ctx.char];
    if (ci.clean && ctx.clean) return ci.clean;
    if (ci.hell && ctx.hell) return ci.hell;
  }
  return panel.caption_after || null;
}
/** Parchment overlay: {text, ms (per char), hold, at} for a context, or null when the panel has no parchment or the overlay is a stamp. */
export function overlayFor(panel, ctx = {}) {
  const o = panel.overlay;
  if (!o) return null;
  if (o.type === 'stamp') {
    if (o.only_char && !o.only_char.includes(ctx.char || 'gunslinger')) return null;
    return { type: 'stamp', text: o.text, at: o.at ?? 1.5, hold: o.hold ?? 2.4 };
  }
  const text = (o.text_if && o.text_if.char && ctx.char && o.text_if.char[ctx.char]) || o.text || '';
  const ms = (o.ms_if && o.ms_if.char && ctx.char && o.ms_if.char[ctx.char]) || o.ms || 32;
  return { type: 'parchment', text, ms, at: o.at ?? 2, hold: o.hold ?? 2.4 };
}
export const captionChars = (lines) => (lines || []).reduce((n, l) => n + l.length, 0);
/** Auto duration when a panel has none: 1.6 + 0.045 * chars. */
export const autoDuration = (lines) => 1.6 + 0.045 * captionChars(lines);

/** Upper bound of a cutscene's run time in seconds (typing 42 cps + auto-advance 0.9 s per panel, overlays included): the fail-safe timer adds 10 s. */
export function estimateSeconds(cs, ctx = {}) {
  if (!cs) return 0;
  if (cs.kind === 'ledger' || cs.kind === 'card') return cs.maxSeconds || 4.5;
  let t = 1;
  for (const p of cs.panels) {
    const cap = panelCaption(p, ctx);
    const ov = overlayFor(p, ctx);
    const after = panelAfter(p, ctx);
    let s = Math.max(p.duration ?? autoDuration(cap), 0.5 + captionChars(cap) / 42 + 0.9);
    if (ov && ov.type === 'parchment') s += ov.at + (ov.text.length * ov.ms) / 1000 + ov.hold + (after ? captionChars(after) / 42 + 0.9 : 0);
    else if (ov) s += ov.hold;
    t += s + 1;
  }
  return t;
}
