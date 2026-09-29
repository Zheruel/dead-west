# DEAD WEST v2 - STORY & PRESENTATION BIBLE

Owner: story/presentation. Sibling docs (read, and obeyed on ids/numbers): `CHAPTER2.md` (floors 4-6, bosses `toro engine scratch`, its section 8 hands the ending to this doc), `CHARACTERS_META.md` (riders `gunslinger preacher hunter queen`, modes `normal hell daily contract`, Save v2, Codex/lore), `EVENTS_MINIBOSSES.md` (Crossroads Dealer, 6 events, 6 mini-bosses), `ITEMS_V2.md` (item field `lore`). **This doc owns all words**: cards, cutscenes, barks, quips, lore, dialogue, tips, credits. Everything is keyed by id, so a renamed id means renaming a key, never rewriting prose. No voice acting, no branching dialogue, no video.

Sibling conflicts found (integrator: fix in siblings, not here): (1) `bouncer` is both an enemy (CHAPTER2 F6) and a mini-boss (EVENTS); rename the mini to `head_bouncer`. Mini text below is keyed `bouncer (mini)`; re-key. (2) CHAPTER2 refers to `docs/v2/STORY.md`; that module is sections 5-6 here (`src/scenes/ending.js`, `runEnding`). (3) Item field is `lore` (ITEMS_V2), not `flavor`. (4) The Ch1 "CHAPTER I COMPLETE" poster is CHAPTER2's overlay, not `run:ended`; only Ch2 wins reach `run:ended {variant:'complete'}`.

---
## 1. WORLD & CANON

**Perdition County, 1887.** Frontier territory. Founded as Providence Creek, renamed "Perdition" in 1879 by settlers who thought it was funny, the winter a land-and-loan man called Mr. Nicholas Scratch arrived with water, silver and paperwork. Everyone who signed the **Great Loan** got a well that never ran dry and a mine that never ran out. The bill comes due at death.

**Ol' Scratch, the Dealer, the House.** The Devil as a gentleman gambler (art canon = CHAPTER2 Boss 6): tall, red-skinned, black velvet tuxedo, top hat with two small horns, gold-tooth grin, cane, a deck always in hand; in his true form a huge goat-legged devil wreathed in hellfire. Runs the **Last Chance Saloon** at the bottom of the county. **He never lies.** Every sentence is true, every deal is a trap you agreed to. Courteous, cheerful, contractual; calls everyone "friend".

**The Ledger (the Contract).** One book, one page per debtor. **Page one** is the price (a soul, due on demand). **Page two** is the fine print nobody reads: the **surety clause**. If the debtor defaults, whatever they love most is *held at the House* until the account is settled in full.

**The cattle drive of souls** (the county's real structure; the floors are its stages):
| Stage | Floor | Keeper | What it does |
|---|---|---|---|
| Notice | F1 Dry Gulch | El Cascabel | the first warning, a rattle before the bite |
| Law | F2 Perdition | Marshal Grimm | hunts and hangs runaways, fairly |
| Burial | F3 Sundown Mine | The Undertaker | files the dead in shallow graves, ready to be dug up |
| Brand | F4 Brimstone Bluffs | El Toro Infernal | brands each delivered soul with the House's mark |
| Rail | F5 Blood Rail | Engine No. 666 | ships the branded herd to market, exactly on time |
| Market | F6 Last Chance Saloon | Ol' Scratch | deals every soul to the highest bidder, forever |
Running joke: the Devil's business is agriculture, logistics and retail. The county is a well-run company.

**The Sixth Bullet.** The revolver was a gift in the contract: it never runs dry. The House takes its cut of every sixth round (x2, pierces). That bullet was always Scratch's. **True ending:** you give it back, into the Ledger.

**Why the debtor was dragged back.** Scratch is old and bored and wants to retire. His six keepers were his succession pool. Anyone who fights all the way to his table is the only applicant with the right work ethic: every bullet fired through the county was a job interview. He says so only at the end ("a vacancy"). **Four riders** received the same summons (the Gunslinger's note on his cross, the Preacher's in a hymnal, the Hunter's as a poster, the Queen's as a marked ace); each run is a fresh deal at the same table.
**Death (canon).** The Dealer collects, shuffles, deals you in again. Death and retry copy use shuffle/deal language.

### 1.1 Timeline
| When | Event |
|---|---|
| 1879 | Great Loan signed. County renamed. Marshal Grimm signs first and becomes the Law. |
| Winter 1886 | Fever. Ada Marrow is dying. Deputy Eli Marrow (the Gunslinger) rides to the crossroads and signs. Reads page one only. |
| Spring 1887 | Ada wakes cured. The first installment falls due. Eli stalls. One morning the bed is empty, a queen of hearts on the pillow: default triggered page two, and Ada is held at the House. |
| Summer 1887 | Eli goes after her. Grimm hangs him. The Undertaker buries him shallow. |
| Now | A note is nailed to his cross. He digs out. |
The Gunslinger stays "The Gunslinger" in all UI. "Eli Marrow" is spoken only in cutscenes and by bosses, as a reveal. Ada never appears as a boss or NPC: she is a held asset, seen only in art and captions.

---
## 2. RIDERS & MOTIVES
| id | name / alias | motive | what the House holds (page two) | voice | payoff |
|---|---|---|---|---|---|
| `gunslinger` | Eli Marrow, "The Gunslinger". Ex-deputy, hanged, buried shallow | Get Ada out of the House | Ada, his wife | laconic, says less than he means | frees Ada; in the true ending he closes the account and rests |
| `preacher` | Rev. Josiah Thorne, "The Hangman's Chaplain" | Buy back the fifty men he blessed on their way to Grimm's noose | his flock, fifty souls | pulpit cadence, gallows humour | recants the Amen aloud |
| `hunter` | Cormac Rook, "Paid In Full" | Cancel the price on his own head by bringing in the biggest mark | his name, posted, its price held | dry, mercenary, unimpressed | the poster burns |
| `queen` | Maude Marlowe, "Queen of Spades". Cheated the Devil at cards once; he let her win, to see what it would cost her | Find out what she owes, then win it all back | every chip she ever won | silk-smooth, over-explains her bluffs | leaves the table with nothing on it |
**Keepers' motives.** `cascabel` = first notice, hisses in the Dealer's voice without knowing why. `grimm` = the Law: believes he is fair, is a clerk. `undertaker` = tidy, hates loose ends (you). `toro` = the Devil's foreman: brands what the Undertaker delivers, speaks in snorts and short sentences. `engine` = the Conductor in the cab, a debtor who paid by hauling everyone else's; terrified of being late. `scratch` = the House: wants a successor, wins either way (except the true ending).
NPCs: `peddler` = one-eyed skeleton huckster on a travel plan he will not explain. `dealer` (Crossroads, `npc_dealer`) = Scratch's smiling projection; same voice as the boss.

---
## 3. STORY ARC & BEATS
| Beat | When | What happens | Delivered by |
|---|---|---|---|
| Prologue | first ride of the save (Normal), each Hell ride | Flashback: fever, crossroads, empty bed, gallows, burial, waking | `intro` (7 panels) or `intro_hell` (2) |
| F1 Dry Gulch | run | The summons; first notice | whispers, El Cascabel |
| F2 Perdition | run | The town that signed: every tombstone stamped PAID | whispers, Marshal Grimm |
| F3 Sundown Mine | run | Where the silver and the dead come from; "A.M." carved in a beam | whispers, The Undertaker |
| **Interlude** | F3 trapdoor | CHAPTER2 sequence; page two and the surety clause revealed; the shaft ends in brimstone | `interlude_ch1` |
| F4 Brimstone Bluffs | run | The Brand: hell's front porch. "Hell's Welcome" toast (CHAPTER2) | El Toro Infernal |
| F5 Blood Rail | run | The Rail: the herd ships on time | Engine No. 666, Crossroads taunts |
| F5 -> F6 | trapdoor | The rails run out at the saloon | `saloon_arrival` (1 panel) |
| F6 Last Chance Saloon | run | The Market; the vacancy is named | Ol' Scratch |
| **Ending A "Take the Chair"** | any Normal/Hell win | Scratch dies laughing: "You're hired." The surety is released; the rider takes the chair; the cycle continues | `end_a` (5 panels) + credits |
| **Ending B "The Sixth Bullet"** (true) | win with `run.mode==='hell' && run.deals.length===0` | The rider refuses the chair and fires the sixth bullet into the Ledger; everything burns, the dead walk out | Sixth Bullet finale + `end_true` (6 panels) + credits |
**True-ending gate (exact):** `run.trueEligible = (run.mode==='hell') && (run.deals.length===0)`, evaluated when `scratch` spawns and re-checked at his death (`deals` = accepted Crossroads contracts of any kind, EVENTS `run.deals[]`). Same condition as deed `clean_hands` plus Hell. On `hell` from floor 4 the pause menu shows `HANDS: CLEAN` (bone glove icon, code-drawn) while eligible and `HANDS: SIGNED` after a deal; Normal mode never shows it. The Dealer teaches the rule in character (11.2) and lore `lore_true` (13.1) states it. Daily and contract runs never play endings: a `daily` win = results poster only.
**Replay loop:** Ending A unlocks `mode:hell` (META, via deed `debt_paid`). HELL ON EARTH is the New Game+: same county, `intro_hell`, hell floor subtitles, tougher numbers (META). The game is complete after any win; the true ending is the mastery goal.
**Sixth Bullet finale.** Hook in `GameScene.onBossDefeated` for `scratch`, after CHAPTER2's halt (bullets/hazards cleared, `scene.cutscene=true`, slow-mo). Eligible: Scratch does not die; his P3 contract mechanic ends with the contract page lifted to hover at (720,470), scale 1.3, invulnerable. On one knee he slaps the floor: "Nobody hurts a man who holds the paper!" Music mutes for 2 s (only `clock_tick` + heartbeat). The cylinder HUD resets to 0/6 and the caption `SIX.` shows. The rider fires 6 shots (any weapon, any rider): shots 1-5 pass through the page with a hollow tin `click`, the **sixth** is the gold crit slug and connects (hit-stop 200 ms, `contract_tear` + `page_burn`, gold flash 300 ms, music returns on one held chord). No fail state, no enemies, ~4 s. Then `game:ending {ending:'sixth_bullet', run, character, difficulty, seed}`. Not eligible: `game:ending {ending:'devil_defeated', ...}` and `end_a`. `run:ended` gains payload field `ending: 'a' | 'true'`.

---
## 4. TONE & VOICE GUIDE
- **Register:** grim, deadpan, darkly funny. Understatement beats jokes. Terse western narration: short declaratives, past tense in cutscenes, no modern slang, never winks at the player.
- **Limits:** captions <= 2 lines, **<= 52 chars per line**, <= 2 sentences. UI labels <= 24 chars. `lore` (items) <= 72 chars. Barks/banners <= 24 chars, UPPERCASE.
- **Formula:** state a horror plainly, then add one bureaucratic detail. "The Undertaker dug the grave shallow. Shallow is easier to undo."
- **Voices:** Scratch friendly, courtly, "friend", never raises his voice. Grimm legalese. Undertaker hushed, tidy. Toro snorts, few words. Engine (Conductor) clipped, schedule-obsessed. Peddler is the only NPC allowed exclamation marks.
- **Never:** explain the joke, emoji, "lol", fourth-wall breaks, slurs or dialect spelling, glorifying self-harm (the true ending is about *refusing* a bargain).
- **UI lexicon (matches META):** rider (player), ride (run), hanged (died), deal / shuffle (retry), bullets, hearts, CODEX, DEEDS, THE BOARD, NOTORIETY, DAILY RIDE (warrant = daily seed), the House (the rules / Scratch), the Ledger (in-world only).
- **Menu (META order):** RIDE OUT, DAILY RIDE, BOUNTY BOARD, CODEX, OPTIONS, CREDITS; plus `CONTINUE - FLOOR n` (CHAPTER2) on top when a checkpoint exists. Char select header `CHOOSE YOUR RIDER`. Mode chips: NORMAL ("The way the Devil intended.") / HELL ON EARTH ("Same county. The Devil changed what counts as fair.") / DAILY RIDE ("Same sun, same road. One rider at a time."). Death retry `R  -  DEAL ME IN AGAIN`. Pause: RIDE ON / OPTIONS / FOLD THE HAND; confirm "Fold the hand? The Devil keeps your chips."
- **Menu subtitle** (under the logo, one per launch): The Devil keeps very good books. / Ride out. Ride hard. Ride dead. / Every debt comes due. / Read the fine print. / (after first win) The deck is warm. / (after true ending) The county is quiet.
- **Win poster** (EndScene `complete`, META "CHAPTER II"): h1 `CHAPTER II`, h2 `-  HELL'S FRONTIER  -`, sub: Ending A "The House has new management." / Ending B "The county is quiet. The books are closed."

---
## 5. PRESENTATION SPEC

### 5.1 Cutscene player (data-driven)
New scene `CutsceneScene` (`src/scenes/CutsceneScene.js`), data `src/data/story/cutscenes.js`. Start: `scene.start('Cutscene', { id, next: { scene, data }, ctx: { char, clean, hell } })`.
```js
export const CUTSCENES = {
  intro: { music: 'mus_cutscene_intro', letterbox: 96, panels: [
    { image: 'cutscene_intro_1', caption: ['line one', 'line two'],
      caption_if: { char: { preacher: ['..','..'] }, clean: ['..','..'], hell: ['..','..'] },
      caption_after: null, sfx: ['amb_wind'], duration: 6.0, transition: 'fade', kb: 'push_in',
      shake: 0, tint: 'sepia', overlay: null } ] },
};
```
Panel fields: `image` (missing key = placeholder: dark vignette + key name; caption still works), `caption` (1-2 lines), `caption_if` (first match wins; order `char`, `clean`, `hell`), `caption_after` (typed after the overlay ends), `sfx` (keys, or `{key, at}` seconds), `duration` (min hold; auto = 1.6 + 0.045*chars), `transition` OUT of the panel (`cut|fade|iris|ink|flash|slam`), `kb` (`push_in` 1.00->1.08, `pull_out`, `pan_l`/`pan_r` scale 1.10 drift 40 px, `still`), `shake` px, `tint` (`sepia` = multiply 0xd9b071), `overlay` (`{type:'parchment', text, at}` typed on `ui_parchment`, per rider via `text_if.char`).
Behaviour:
- Caption: Special Elite 30 px bone `#e8dcc0`, ink stroke 5, centred y=830 over a code-drawn gradient (black 0->0.7, 260 px), typewriter 42 cps with `ui_type` (max 1 tick per 3 chars). Letterbox bars 96 px slide in.
- Input: first Space/Enter/click completes the typewriter, second advances. **Hold Esc/Space 0.6 s skips the whole cutscene** (progress ring). Auto-advance after typing + 0.9 s. If already seen (`Save.flag('seen_<id>')`), a single Esc skips it.
- Music crossfades in 600 ms; the next scene sets its own. Transitions: `fade` 450 ms through black; `iris` circular closing mask 600 ms on the focus point, next panel iris-in; `ink` ink-splatter wipe (5.4); `flash` 90 ms white; `slam` hard cut + 6 px shake.
- `next` always starts (fail-safe timer = total duration + 10 s). Cutscenes fire only on a **descent/ending transition**, never on `CONTINUE` checkpoint loads. Modes `daily` and `contract` never play cutscenes.
- Replay from CODEX > LORE ("Reread" on entries with `reread`). Flags in Save v2 `flags`: `introSeen`, `seen_<id>`, `ending_a`, `ending_true`.
- Automation: `window.__game.story = { play(id, ctx), skip(), current }`; URL `?cutscene=<id>&char=<id>&clean=1&hell=1`.

### 5.2 Chapter and floor cards (extend `src/ui/Cards.js`)
- **Chapter card** (3.6 s, blocks input; F1 start and after the interlude): `CHAPTER II` (Special Elite 34 px amber, letterspacing 16) -> `HELL'S FRONTIER` (Rye 84 px bone, stroke 12, slams 1.4x->1x + 6 px shake + `boss_intro` rate 0.8) -> rule -> tagline typed. Ch1: `CHAPTER I` / `PERDITION COUNTY` / "Every debt comes due." Ch2 tagline: "The Devil's Own Country". Backdrop = `title_l0_sky` darkened 55% (Ch2 tinted 0xff5a2a); no new art.
- **Floor card** (existing; accent colours F4 `#ff7a1f`, F5 `#6fe0d0`, F6 `#d4a537`, matching floor palettes). `primary` = CHAPTER2 `FLOORS.subtitle`; `alt` on rides >= 3 (seeded); `hell` on HELL ON EARTH.
| floor | name | primary | alt | hell |
|---|---|---|---|---|
| 1 | DRY GULCH | Where the buzzards circle | The ground remembers everyone | The sun has a grudge |
| 2 | PERDITION | A town that forgot to die | Last one out, hang the sign | Nobody's home. Nobody's alone. |
| 3 | SUNDOWN MINE | Deeper than the Devil digs | The dark is on the payroll | Bring a candle. Bring two. |
| 4 | BRIMSTONE BLUFFS | The Devil's front porch | Everything here wears a brand | The heat has your name on it |
| 5 | BLOOD RAIL | The midnight run never ends | Punctuality is a virtue. Also a threat. | Watch the gap. And the whistle. |
| 6 | THE LAST CHANCE SALOON | The house always wins | Drinks are on the Devil | The dealer is looking at you |
- **Checkpoint toast** (after the F4 fade-in, with CHAPTER2's "THE HEAT WELCOMES YOU"): `CHECKPOINT - THE HOUSE KEEPS YOUR PLACE` (1.6 s, sand).
- **Room whispers** (new, non-blocking): on first entry to a floor's Start room, one of 3 (seeded `rng.game`), italic 26 px sand, y=900, 3.2 s.
  - F1: Nothing grows here that wasn't paid for. / Somebody has been digging, and not to bury. / The buzzards are not circling you. Yet.
  - F2: Every tombstone is stamped PAID. / The saloon piano is playing. The saloon has no piano. / A wanted poster with your face. It is dated last year.
  - F3: The silver ran out. The dead did not. / Someone carved "A.M." into the timber. It is still fresh. / The mine is quiet. The mine is listening.
  - F4: The ground is warm. The ground is always warm. / Every rock here has a brand on it. Some are still smoking. / The bull left tracks. The tracks are on fire.
  - F5: The station clock stopped at twelve. Nobody has corrected it. / The rails are polished. Someone loves this job. / A whistle in the fog. You are not on the timetable.
  - F6: The piano knows your favourite song. It is a funeral march. / A chair is pulled out for you. It is warm. / The floor is sticky. Let us hope it is the good kind.
  - `gunslinger` extra (F4, F6, replaces a pick 50%): A queen of hearts drifts past on the hot wind. / Somewhere above the piano, a woman hums a hymn. You know the words.
- **Text cards** (black, 3 s, typed 30 cps, skippable; on descent only): F4->F5 "The bull went down. Somewhere, a whistle blew." / "Hell has a railway. Of course it does."; F3->F4 handled by `interlude_ch1`; F5->F6 goes to `saloon_arrival`.

### 5.3 Boss and mini-boss cards (extend `Cards.showBoss`, existing 2.1 s letterbox, 128 px bars)
Keep bars, portrait, glow, name slam. Add: (a) **typed spoken line** under the title (Special Elite 26 px bone italic, 30 ms/char, <= 12 words; table 7.1); (b) total 2.9 s (Scratch 4.6 s: five cards slam onto the table bottom-centre, code-drawn 60x84 rounded rects with suit glyph, 0.28 s apart, `card_flip` each; the Dead Man's Hand: A spades, A clubs, 8 spades, 8 clubs, fifth face-down); (c) any key skips after 0.8 s; (d) **phase banners** use the existing banner widget, UPPERCASE, 1.2 s (7.3); (e) boss death: 1.2 s slow-mo, death quip typed over the corpse (bone italic 32 px, fades at 3 s); Scratch's quip plays before the finale or ending. **Mini-boss WANTED card** (EVENTS, 1.0 s): under `NAME` and `BOUNTY $n` add a small-print line `WANTED FOR: <crime>` (Special Elite 20 px ink on the poster); quip typed 2 s on death; phase banner per 7.4.

### 5.4 Screen transitions (all code-drawn, no assets)
| Moment | Transition | Impl |
|---|---|---|
| Menu -> run | gun_cock + fade 320 ms (existing) | keep |
| Trapdoor down | **iris-out** on the player 500 ms, iris-in on arrival | geometry mask over a black overlay |
| F3 -> F4 | CHAPTER2: banner, fade to black, `interlude_ch1`, fade-in F4 | scene chain |
| Death | red vignette 300 ms -> **ink splatter** wipe 700 ms -> End poster | 18-24 blob polygons (Graphics, 5-9 lobes, seeded) scaling from 0 to cover |
| Retry (R) | ink splatter reverse 400 ms | same |
| Cutscene panels | per-panel `transition` | 5.1 |
| Sixth Bullet | hit-stop 200 ms, gold flash 300 ms, fade to white 1.2 s -> `end_true` | tween |

### 5.5 Title screen (MenuScene): 4 layers, no full animation
| layer key | type / size | content (ink woodcut, `art/style/style_c.png` as Image 1) | motion (code) |
|---|---|---|---|
| `title_l0_sky` | opaque webp 1440x960 | Blood-red and bruise-purple dusk, cracked sun-moon low on the horizon, streaky ink clouds, faint stars; lower 30% falls to dark; no ground detail | drift x +/-20 px over 40 s; parallax 6 px |
| `title_l1_town` | png alpha 1440x960 | Mid-ground silhouette band y 520-800: mesas, ghost-town roofs with steeple and water tower, the Last Chance Saloon glowing red far right like a beacon; 5 lit amber windows | parallax 14 px; per-window additive glow flicker (window coords measured after art lands, stored in `title.meta.json`) |
| `title_l2_fg` | png alpha 1440x960 | Foreground: road edge along the bottom, dead cacti at far left/right, wooden cross with hat (x~150), bent lamp-post with lit lantern (x~1290); centre-left (x 80-840, y 470-900) kept clear for the menu | parallax 30 px; lantern glow (`glow`, amber, additive) flickers 0.75-1.0 alpha ~9 Hz smoothed noise + warm light pool on the road |
| `title_l3_rider` | png alpha 512x640 | The gunslinger from behind three-quarters, looking toward the town, poncho, hat, revolver hanging, red rim-light | at x~1090, feet y~860: breathing scaleY 1.000<->1.014 (3.4 s sine, anchored bottom) + 0.4 deg sway |
Code extras: tumbleweed (`enemy_tumbleweed` frames 0-3, tint 0x3a2a1e, scale 0.8) rolls across the road every 22-38 s; two silhouette crows (`enemy_crow` tinted black) cross the sun every ~40 s; existing embers + vignette; logo bob stays. Mouse parallax = (mouseX-720)/720 x factor. Every layer optional (missing -> current `title_bg`). **Progress variants (tint only):** after first win sky 0xffc890; after true ending sky 0xffe2b0, rider hidden, subtitle "The county is quiet."; HELL ON EARTH chip hovered/selected = sky 0xff6a5a + distant lightning (white flash 90 ms every 15-25 s, `explosion` vol 0.15 rate 0.4).

### 5.6 Credits
`CreditsScene`: scroll 46 px/s, Special Elite 28 px, headings Rye 36 px amber, over the last ending panel (`cutscene_end_a_5` / `cutscene_end_true_6`) darkened 55%; ESC/hold skips; then EndScene `complete` poster. The menu Credits modal keeps its short list and appends the section 14 rows.

---
## 6. CUTSCENE SCRIPTS
Art rules for every full-screen panel: painted comic panel, thick ink outline, cross-hatch, muted palette (ART_BIBLE) + one hot accent; `art/style/style_c.png` as Image 1, existing `portrait_*` as Image 2+ where listed; **no text or lettering in the image**; keep the bottom 220 px calm/dark for captions; 15% margin round the focal subject (Ken-Burns scales it). Output 1536x1024 -> 1440x960 webp q86 `public/assets/images/<key>.webp` + `.image.json`. **Ending panels show the rider only as a back/three-quarter silhouette in a generic wide-brim hat** (captions carry the character).

### 6.1 `intro` "THE DEBT" (first ride, 7 panels ~41 s). Panels 1-5 SEPIA (duotone #6b4423/#e8dcc0, only blood-red and ghost-green accents); 6-7 full colour: the colour arrives when he wakes. Non-`gunslinger` riders get their ledger card (6.3) instead and skip this.
| key | art | caption (`/` = line) | sfx | dur | out |
|---|---|---|---|---|---|
| `cutscene_intro_1` | Sepia. Cramped frontier cabin at night, one candle. Ada (young woman, long dark braid, pale, feverish) asleep in an iron bed, bucket of red-stained rags. Eli Marrow (big-head cartoon, deputy tin star, hat in hands, head bowed) at the bedside. Dead tree in the window. | Perdition County, winter of '86. / Eli Marrow had a wife, a fever and eleven dollars. | amb_wind, heartbeat | 6.0 | fade |
| `cutscene_intro_2` | Sepia + red. A rickety card table at a lonely crossroads under one hanging lantern. Across from Eli sit only the Dealer's long black-gloved hands fanning cards and a huge moon-white grin floating in darkness. A contract page glows faintly red; Eli's hand signs with a quill, blood on the nib. | The Dealer made an offer. Eli read page one. / Nobody ever reads page two. | pen_scratch, card_shuffle | 6.0 | fade |
| `cutscene_intro_3` | Sepia. The cabin bedroom at dawn, grey light. The iron bed is empty, sheets thrown back, a single queen of hearts on the pillow, window open. Eli in the doorway with his hat crushed in one hand. | Ada woke up cured. Eli woke up owing. / One morning the bed was empty. The bill was due. | wind_gust, door_close | 5.5 | slam |
| `cutscene_intro_4` | Sepia. Gallows in a ghost-town square at dusk. Marshal Grimm (skeletal lawman, long duster, tin star, wide hat; ref `portrait_grimm`) tightens the noose on Eli, hat over Eli's eyes. Silent faceless crowd with long shadows. | Eli went after her. Marshal Grimm hanged him for it. / Fair is the Devil's favourite loophole. | bell_toll | 5.5 | fade |
| `cutscene_intro_5` | Sepia + ghost-green. Night graveyard. The Undertaker (gaunt, top hat, frock coat, shovel; ref `portrait_undertaker`) pats down a very shallow mound; wooden cross with Eli's hat; an unused coffin leaning on a headstone. Green lantern. | The Undertaker dug the grave shallow. / Shallow is easier to undo. | dig | 5.0 | iris |
| `cutscene_intro_6` | FULL COLOUR. Dry Gulch at dawn, blood-red sky. A grey hand bursts out of the shallow mound gripping a revolver; the cross has a note nailed to it; buzzards; a hat on the cross. Dramatic low angle. | Some men rest in peace. Eli got a summons. / "OVERDUE. CALL AT THE LAST CHANCE SALOON." | dig, zombie_groan, gun_cock | 6.0 | flash |
| `cutscene_intro_7` | Full colour. Eli (3/4 back, ashen skin, hat, red poncho, revolver hanging; ref `portrait_player`) at the start of a long dirt road running through mesas, a ghost town and a mine to a red glowing saloon on the far horizon. Buzzards. Epic wide composition. | Six chambers. One county. One overdue account. / He had never read page two. He could read a road. | wind_gust, gun_cock | 6.5 | fade |
`intro_hell` (HELL ON EARTH, all riders, 2 panels, ~10 s): A = `cutscene_end_a_5` tinted red: "The Devil's books always balance. / Somebody new is always owing." (5 s, ink). B = `cutscene_intro_7`: "Six chambers. Same debt. Higher interest. / The House has read your file." (5 s, fade). No new art.

### 6.2 `interlude_ch1` (F3 trapdoor -> F4; follows CHAPTER2 section 1: banner "CHAPTER I COMPLETE", trapdoor, fade to black; music `mus_interlude`; checkpoint set after the F4 fade-in)
CHAPTER2 owns the typed lines over `img_interlude_ch2`; this doc supplies the words: "The shaft doesn't end in rock. / It ends in brimstone." then "Something down there / is holding the other end of your debt." (6.5 s, `coffin_open`, `wind_gust`, fade). Then one new panel:
| key | art | caption | sfx | dur | out |
|---|---|---|---|---|---|
| `cutscene_interlude_1` | Still life on a rough table under one lantern: a thick contract page (text unreadable, blank painted lines), a cracked red wax seal, a brass key, spectacles, a burnt-down candle stub. Warm gold light in an ink-black room. Right third calm for the overlay card. | The coffin held no corpse. / It held the rest of the contract. | page_flip, pen_scratch | 7.0 | fade |
Overlay on `cutscene_interlude_1` (typed on `ui_parchment`, 24 px, 5 s, `text_if.char`):
- `gunslinger`: "PAGE TWO. SURETY. Upon the Debtor's default, the Debtor's wife shall be held at the House until the account is settled in full. Signed: A. Marrow, in her own hand." `caption_after`: Ada had read page two. / She signed it anyway.
- `preacher`: "PAGE TWO. SURETY. Upon default, the Debtor's flock, fifty souls blessed by his own hand, shall be held at the House until the account is settled in full. Witnessed: J. Thorne. Amen." `caption_after`: The Amen was the signature. / It always was.
- `hunter`: "PAGE TWO. SURETY. Upon default, the Debtor's name shall be posted and its price held at the House until the account is settled in full. Signed: C. Rook. Paid In Full." `caption_after`: He had priced everyone else's head. / He never checked his own.
- `queen`: "PAGE TWO. SURETY. Upon default, the Debtor's winnings, every chip she ever won, shall be held at the House until the account is settled in full. Signed: M. Marlowe. Queen of Spades." `caption_after`: The Devil let her win. / Now she saw the receipt.
Then the F4 chapter card (5.2) and floor card. Ada's page-two reveal for `gunslinger` is the emotional pivot of the game: play the overlay slowly, 60 ms/char, no music swell.

### 6.3 Ledger cards (text-only; shown at run start for a rider's first two rides, and whenever the cutscene is skipped)
Layout: `title_l0_sky` darkened 60%, `portrait_<char>` left (500 px), 3 lines Special Elite 34 px right, `CLICK` to continue, 4.5 s max.
| id | line 1 | line 2 | line 3 |
|---|---|---|---|
| `gunslinger` | Eli Marrow. Hanged. Buried shallow. | Owes one soul. Reads the fine print now. | Somewhere down the road, a bed is empty. |
| `preacher` | He blessed fifty men on their way to the rope. | The Devil counted every blessing as consent. | A summons in the hymnal. He packed the scattergun. |
| `hunter` | Cormac Rook has never missed a payday. | Somebody has posted a price on his head. | He intends to collect on the one who did it. |
| `queen` | Maude Marlowe once cheated the Devil at cards. | He let her win. She has been wondering why. | A marked ace arrived by post. Rematch. |
Character-select taglines (also unlock toasts): `gunslinger` Owes one soul. Pays in lead. / `preacher` Blessed the noose. Regrets the blessing. / `hunter` Never missed a payday. Never met this mark. / `queen` Beat the Devil once. He's still sore.

### 6.4 `saloon_arrival` (F5 boss -> F6, Normal/Hell rides, 1 panel, music `mus_floor6` intro)
| key | art | caption | sfx | dur | out |
|---|---|---|---|---|---|
| `cutscene_saloon_1` | Rider silhouette (small, back, wide-brim hat) before the huge double doors of the Last Chance Saloon: the batwing doors are giant fanged jaws under a crimson sign-shape (no letters), red light and cigar smoke spilling out; a twisted railway track runs straight into them and ends. Night, crimson sky. | The rails run out at the Last Chance Saloon. / Everything in the county ends up here. | train_horn, piano_sting | 5.5 | iris |

### 6.5 `end_a` "TAKE THE CHAIR" (5 panels ~30 s, music `mus_ending_a`). Scratch: human form, ref `portrait_scratch`.
| key | art | caption (default) | sfx | dur | out |
|---|---|---|---|---|---|
| `cutscene_end_a_1` | Over the shoulder of the silhouetted rider: Ol' Scratch, tuxedo scorched, slumped in his velvet chair at the poker table, gun-smoke, black ichor, cards drifting up like moths, still grinning, top hat askew, gold tooth gleaming. | The Devil died the way he lived, / holding every card and laughing. | card_flip, boss_die | 5.5 | fade |
| `cutscene_end_a_2` | Close on the table: the Ledger opening itself to a blank page, the empty velvet chair glowing faintly, the deck fanned out, every card an ace of spades. | "Congratulations, friend. You're hired." / Page nine. Nobody reads page nine. | page_flip, piano_sting | 5.5 | fade |
| `cutscene_end_a_3` | Saloon interior from behind the big chair: at the far end the batwing doors open onto daylight; small figures (a woman in a black veil, a file of men in hats, a burning poster, drifting gold chips) walk out into the light. Dust motes. | `gunslinger`: Scratch never lied. Ada walked out, free. / She did not look back. He would have done the same. `preacher`: Fifty souls filed out the door, free. / The Chaplain counted them twice. `hunter`: His poster curled and burned on the wall. / The price on his head fell to zero. `queen`: Her winnings turned to ash, and her debt with them. / Maude called it the worst hand she ever won. | door_open, step_wood | 6.0 | fade |
| `cutscene_end_a_4` | The silhouetted rider now seated in the chair, hat on the table, shuffling the deck; behind them the whole saloon (skeletons, ghosts, imps, piano man, slot machine) rises with raised glasses; red light. | `gunslinger`: The house rose for its new management. / Eli dealt fair. It never once mattered. `preacher`: The house rose for its new management. / The Chaplain dealt fair. It never once mattered. `hunter`: The house rose for its new management. / Rook dealt fair. It never once mattered. `queen`: The house rose for its new management. / Maude dealt fair. It never once mattered. | card_shuffle, crowd_murmur | 6.0 | ink |
| `cutscene_end_a_5` | Dry Gulch grave at dawn (mirror of `intro_6`): a fresh shallow mound, wooden cross, a new grey hand pushing up through the dirt, buzzards, blood-red sky. | Somewhere in the gulch, a grave started to move. / The Devil keeps very good books. Now, so does he. | dig, gun_cock | 6.5 | fade |
After the credits: toast (META `meta:unlocked`) `HELL ON EARTH - "The deck is warm."` on the first win; `Save.flag('ending_a')`.

### 6.6 `end_true` "THE SIXTH BULLET" (6 panels ~38 s, music `mus_ending_true`). Plays after the finale.
| key | art | caption (default) | sfx | dur | out |
|---|---|---|---|---|---|
| `cutscene_end_true_1` | Extreme close-up over the shoulder: a revolver cylinder, five spent shells and one round glowing hot gold; behind it, out of focus, the floor contract floating over the green baize. | Six bullets. The House keeps the sixth. / It always did. | gun_cock, clock_tick | 5.5 | slam |
| `cutscene_end_true_2` | A gold-white bullet punching through the floating contract, the page tearing open with hellfire, letters flying off like sparks; Ol' Scratch caught mid-word in true form, horns, mouth of gold teeth open in horror (ref `portrait_scratch`). | The Devil wrote a clause for everything. / Except a debtor who wouldn't take the job. | shoot_crit, contract_tear, page_burn | 5.5 | flash |
| `cutscene_end_true_3` | Scratch unravelling into a storm of playing cards and smoke, his velvet chair collapsing to ash, his top hat rolling across the floor. | "Friend, that isn't how this--" / It was, actually. | card_flip, boss_die | 5.0 | fade |
| `cutscene_end_true_4` | The Last Chance Saloon roof ripped open; dawn light pouring in; ledger pages burning in the air; a crowd of translucent hat-wearing silhouettes of the dead (skeletons, miners, townsfolk, the scarecrow, coyotes, a hellhound on a leash) streaming out through the broken doors into the sun. | Every page in the Ledger burned at once. / Perdition County's dead put on their hats and left. | crowd_murmur, bell_toll | 6.0 | fade |
| `cutscene_end_true_5` | The county road at sunrise, the brimstone gone to wildflowers; a long column of freed dead walking east; among them a woman in a black veil lifting it; in the foreground the rider's hat silhouette at the roadside, tipping the hat. | `gunslinger`: Ada lifted her veil and touched his sleeve once. / Then she walked east with the rest of them. `preacher`: He said "Amen" again, and meant it the other way. / Fifty men put their hats back on. `hunter`: The price on his head burned to nothing. / Rook tipped his hat to the empty wall. `queen`: Her chips turned to petals on the wind. / Maude did not try to catch them. | wind_gust, step_dirt | 6.5 | fade |
| `cutscene_end_true_6` | The crossroads at sunrise (mirror of `intro_2`): the card table gone, wildflowers, a wooden signpost with four blank arrow-boards now pointing up the road, a wide-brim hat resting on top, buzzards flying away, warm gold light. No figures. | `gunslinger`: Eli Marrow. Deputy. Debtor. Dead man. / ACCOUNT CLOSED. `preacher`: The Chaplain read the last rites over the crossroads. / It was the first prayer the county ever earned. `hunter`: The reward was never paid. He found / he did not mind, which annoyed him most. `queen`: She left the table with nothing on it. / It was the best hand she ever played. | bell_toll, amb_wind | 7.0 | fade |
After panel 6 (`gunslinger`): `ACCOUNT CLOSED` in Rye 54 px over the image; credits. Toast `TRUE ENDING - "The county is quiet."`; `Save.flag('ending_true')`.

---
## 7. BOSSES
### 7.1 Card lines (`intro` typed on the card; `death` typed over the corpse)
| id | NAME | title | intro | death |
|---|---|---|---|---|
| `cascabel` | EL CASCABEL | The Rattle Before The Bite | Sssso. The debtor walks. How sssoon he crawlsss. | First noticssse ssserved. Sssecond comesss on horssseback. |
| `grimm` | MARSHAL GRIMM | The Law Never Sleeps | Evenin'. You are under arrest. The charge is breathing. | Court's adjourned. Read the fine print, son. |
| `undertaker` | THE UNDERTAKER | Last Rites For The Living | Another one out of the ground. Sloppy work. Mine, I mean. | The mine has a basement. There is always more below. |
| `toro` | EL TORO INFERNAL | Horns of the Furnace | *snorts* The Devil brands what the Undertaker delivers. Hold still. | The herd... goes on. Without me. |
| `engine` | ENGINE NO. 666 | The Midnight Express | All aboard. The twelve o'clock leaves on time. It always leaves on time. | Late. I am... finally... late. |
| `scratch` | OL' SCRATCH | The House Always Wins | Friend! Sit. You have made me a fortune and a small amount of trouble. | Bravo. Bravo! The chair is yours. I am so very tired. |
### 7.2 Rider overrides (replace `intro`; unlisted riders use the default). Character overrides exist for Grimm, the Undertaker and Scratch only.
| boss | rider | intro | death |
|---|---|---|---|
| `grimm` | gunslinger | Deputy Marrow. You wore my second star. | Court's adjourned, Eli. I was always fair. |
| `grimm` | preacher | Chaplain. You blessed every one of them. Bless yourself. | - |
| `grimm` | hunter | Rook. A man who collects should know what a warrant costs. | - |
| `grimm` | queen | Miss Marlowe. Cheating is a hanging offence in this county. | - |
| `undertaker` | gunslinger | I dug you shallow. I am about to correct that. | The mine has a basement, Eli. Your wife is in it. |
| `undertaker` | preacher | Reverend. I measured your congregation. Fifty exact fits. | - |
| `undertaker` | hunter | Bounty man. I have been measuring you for a year. Come closer. | - |
| `undertaker` | queen | Madam. Gold leaf on the lid, I think. You deserve it. | - |
| `scratch` | gunslinger | Eli! The best deputy I ever buried. Ada sends her regards. She is quite well. | - |
| `scratch` | preacher | Reverend! Still praying? Let us see who answers. | - |
| `scratch` | hunter | Mr. Rook! Yes, that is my poster. Lovely frame. | - |
| `scratch` | queen | Maude, darling. Do you know what the win cost you? I do. | - |
| `scratch` | any + `trueEligible` | You have signed nothing on the way here. I am almost offended. | (finale plays; no death line) |
Scratch's true-eligible intro replaces the rider intro; if a rider override exists it is typed as a second line 1.4 s later. His P3 contract lines (CHAPTER2 P3 banner READ THE FINE PRINT) use one bark when the page unfurls: "Page nine. Do read along." Finale line: "Nobody hurts a man who holds the paper!"
### 7.3 Phase banners (UPPERCASE, existing banner widget; each fits the 24-char rule)
CHAPTER2 owns Ch2 and they stay as written: `toro` P1 THE FURNACE ROARS / P2 HELLFIRE!; `engine` P1 ALL ABOARD THE DEAD / P2 FULL STEAM AHEAD; `scratch` P0 DEAL ME IN / P1 I RAISE / P2 ALL IN / P3 READ THE FINE PRINT. Ch1 (new): `cascabel` P2 THE RATTLE QUICKENS; `grimm` P2 DEPUTIES, ARREST HIM / P3 ORDER IN THE COURT; `undertaker` P2 EVERY BOX HAS A TENANT / P3 THE LID CLOSES.
### 7.4 Mini-bosses (EVENTS ids; WANTED card small print + banner + death quip)
| id | title (EVENTS) | WANTED FOR | phase banner | death quip |
|---|---|---|---|---|
| `ol_fury` | The Bull That Wouldn't Stay Buried | Trampling three churches and a funeral | WIRE AND FURY | Buried again. It will not take. |
| `hangman` | Drop Is Just Rope | Hanging without a trial, a warrant or a wage | THE DROP | Rope's cut. Nobody drops today. |
| `motherlode` | All That Glitters | Four tons of silver, armed and dangerous | THE VEIN RISES | All that glitters goes to pieces. |
| `ash_deacon` | Dust Thou Art | Burning the Good Book, the pews and the people in them | ASH FALLS | To dust. As promised. |
| `stoker` | Full Steam Ahead | Overheating the West. Personally. | OVERPRESSURE | Boiler's cold. So is the rest. |
| `bouncer` (mini) | Last Call | Refusing service to the living | LAST CALL | Last call, friend. Yours. |
(If a title differs in EVENTS, EVENTS wins on the title; the four text columns stay.)
### 7.5 CODEX boss and rider bios (`meta.codex`, <= 30 words)
- `cascabel`: The first notice in Perdition County. He does not bite to kill. He bites to remind.
- `grimm`: The county's law. Hanged fifty men fairly, then his own noose. He believes he is fair. He is a clerk.
- `undertaker`: Digs shallow and tidy. Every grave in the mine is his, and every grave is a loan.
- `toro`: The Devil's foreman. Brands every soul the Undertaker delivers, and does not ask them to hold still.
- `engine`: The Midnight Express has never been late. The Conductor in the cab has been waiting since 1881 to be.
- `scratch`: The Dealer, the House, the County. Wants only to retire, and to be replaced by someone who can win.
- `gunslinger`: Deputy Marrow signed one page and skipped another. It cost him a wife, a rope and eight months underground.
- `preacher`: Josiah Thorne blessed every man Grimm hanged. The Amen sticks in his throat. He carries a Bible and a scattergun and finds them equally persuasive.
- `hunter`: Cormac Rook has never missed a payday. The only bounty he cannot collect is his own.
- `queen`: Maude Marlowe beat the Devil at cards once. He let her. She keeps wondering what it cost.

---
## 8. ITEM `lore` TEXT (28 existing items; ITEMS_V2 field `lore`, <= 72 chars; pedestal inspect + CODEX; pickup banner keeps `NAME - desc`)
| id | lore |
|---|---|
| `spurs` | Jingle-jangle. Everyone hears you coming. Nobody catches you. |
| `lucky_horseshoe` | Luck is a debt too. This one just hasn't been called yet. |
| `hollow_point` | Hollow on the inside. Like the man who bought it. |
| `speed_loader` | Six in the time it takes the Devil to clear his throat. |
| `long_barrel` | Reach out and touch someone, from a respectful distance. |
| `sawed_off` | Half the barrel. All of the argument. |
| `ricochet` | If at first you don't succeed, blame the wall. |
| `dead_eye` | Patience is a virtue. Patience with a Colt is a verdict. |
| `bandolier` | Nobody has ever regretted bringing more dynamite. Survivors, anyway. |
| `snake_oil` | Cures what ails you. Do not ask what is in it. |
| `tin_star` | Worth about a nickel. Stops about a bullet. |
| `liquid_courage` | The closer you get to dead, the braver you get. |
| `cursed_coin` | It always lands heads. That should worry you. |
| `rattler_fang` | Still wet. Still angry. Points away from you, mostly. |
| `silver_bullets` | The dead have opinions about silver. Loud ones. |
| `dynamite_vest` | Stylish. Loud. Frowned upon by the insurance man. |
| `spirit_lantern` | Somebody's soul is in there. It seems to like you. |
| `crow_companion` | He is not a pet. He is a witness who works for scraps. |
| `voodoo_doll` | It looks a lot like the Marshal. Coincidence, probably. |
| `duster_coat` | Dust, bullets and bad news all slide right off. |
| `prospectors_pan` | Every fool with a pan swears the next scoop is the one. |
| `hex_bag` | Smells of sulphur and somebody's grandmother. Warm in the palm. |
| `fan_the_hammer` | Speed is nothing without accuracy. Speed is still fun. |
| `mezcal_worm` | It tastes like courage and, a little, like regret. |
| `whiskey_bottle` | Medicine, according to every bar in the West. |
| `pocket_watch` | Time waits for no man. This one asked nicely. |
| `powder_keg` | Subtle it is not. Neither is the crater. |
| `lucky_deck` | Fifty-two cards, all marked. By whom is the question. |
(Ids follow the shipped item defs; the integrator remaps any that differ. Two `snake_oil` uses exist: item vs event; keep both.)
**Template for new items** (ITEMS_V2 carries a quoted line per item; hold it to this): 1-2 short sentences, <= 72 chars, no numbers or mechanics words (`desc` does that), exactly one joke or one chill, present tense, one in-world object. Crossroads deal items end on a signed feel. Synergy items hint the pairing without naming it. Samples (not real ids): A pen that writes in someone else's hand. / It is warm. Do not ask who from. / The train left. The whistle stayed. / Every ace is the same ace. / It hums a hymn you cannot place.

---
## 9. BESTIARY (CODEX text: `lore` <= 30 words, `tip` <= 64 chars; feeds `codexText.js`)
### 9.1 Existing 16
| id | name | lore | tip |
|---|---|---|---|
| `coyote` | Mangy Coyote | Perdition's coyotes stopped eating carrion the day the carrion started answering back. Now they hunt in a hurry. | Howl means charge. Roll sideways, never backwards. |
| `rattlesnake` | Rattlesnake | Cascabel's small print. Every rattle is a legal notice; every bite is enforcement. | Rattle first, then a fan of three. Step out of the arc. |
| `tumbleweed` | Tumbleweed | Nothing in Dry Gulch is as innocent as it looks. Especially the tumbleweeds. They have teeth. | It splits when it dies. Finish the little ones fast. |
| `tumbleweed_mini` | Little Weed | Smaller, faster, and every bit as unhappy about it. | One shot each. Do not chase them. |
| `outlaw` | Outlaw | Took the Devil's water and skipped the fine print. Kept the gun, lost the future. | Aimed shot every second or so. Strafe across it. |
| `buzzard` | Skull-Faced Buzzard | Circles the living out of habit and the dead out of hope. | Wings back means dive. Sidestep, then punish. |
| `possessed` | The Possessed | Perdition men with more passengers than sense. The red eyes are the tenants. | Lunges at range. Hurt it and it gets faster. |
| `skeleton` | Skeleton Gunslinger | Fastest draw in the county, once. Wore out his welcome, then his flesh. | Fires a spinning cross of four. Stand in the gaps. |
| `dynamiter` | Dynamiter | Believes every problem is a hole in the ground that has not happened yet. | The stick lands in a second. Leave the circle. |
| `ghost` | Prospector Ghost | Still looking for the vein he died on. Takes it personally when you cross his claim. | Untouchable while faded. Shoot it when it goes solid. |
| `scarecrow` | Hanged Scarecrow | Nobody remembers who strung him up first. The crows do, and they are loyal. | Never moves. Thin the crows, then finish it. |
| `crow` | Gallows Crow | The scarecrow's staff. They work for scraps, and you are the scraps. | Three hit points. Any bullet will do. |
| `miner` | Sundown Miner | The shift never ended. Neither did he. | Armoured in front. Circle behind. The swing is slow. |
| `bat` | Cave Bat | The mine's smallest tenants and its loudest. They arrive in threes and have opinions. | Erratic. Hold a spot and shoot, do not chase. |
| `mole` | Grave Mole | Digs where the Undertaker did not finish, and has views on your boots. | When the mound stops, move. It is stunned after it pops. |
| `coffin` | Hopping Coffin | Lid ajar, something inside very keen to meet you. It brought friends. | The hop lands a shockwave. Two bats on death. |
### 9.2 Chapter 2 (CHAPTER2 ids) + event enemy
| id | name | lore | tip |
|---|---|---|---|
| `hellhound` | Hellhound | Leashed only by the bar tab. Its bites cost extra. | Sidestep the lunge line and the flames miss. |
| `hellsteer` | Hellsteer | A calf of the Devil's herd, already branded, already furious. | Paws before the charge. It dazes on walls. |
| `cinder_skull` | Cinder Skull | A cigar the size of a man's head, still lit and eager to go out with a bang. | Shoot it before it arms. Dead skulls are harmless. |
| `magma_eel` | Magma Eel | Swims where the ground forgot to cool. Surfaces only to complain. | Only exposed when surfaced. Shoot it as it spits. |
| `sulfur_preacher` | Sulfur Preacher | Preaches the gospel of the furnace. His congregation gets thicker skin. | Kill him first: his ward halves damage to the rest. |
| `magma_golem` | Magma Golem | The Bluffs' oldest resident. Old enough to have opinions about erosion. | The slam draws a lane. Leave it, then flank. |
| `handcar_bandit` | Handcar Bandit | Robbed the wrong train. It was the Devil's. He is still working off the fine. | Two spikes a volley. Step off his rail. |
| `signalman` | Signalman | Lights the way for trains that no longer run. Locks onto you like a timetable. | It locks row and column. The diagonals are safe. |
| `steam_stoker` | Steam Stoker | Shovels coal into a boiler that runs on regret. Never complained. Never stopped. | Blast, then a scald cloud. Do not stand in the cloud. |
| `crate_mimic` | Crate Mimic | That cover you were crouching behind has been watching you for a while. | Be suspicious of cover. It wakes when you get close. |
| `rail_rat` | Rail Rat | Comes in fives. Sparks from the tail. Nobody has ever counted them twice. | Pack of five. Kill them at a doorway. |
| `chain_gang` | Chain Gang | Four convicts on one sentence. The sentence is life. Then more. | Kill the head first. Each link takes over, faster. |
| `card_shark` | Card Shark | Deals from the bottom, the top and the sleeve. Every card is a knife. | Three arcing cards, then a slow reload. Punish the reload. |
| `loaded_die` | Loaded Die | Rolls whatever the house needs. Angry pips in place of eyes. | Count its pips. That many chips are coming. |
| `slot_fiend` | Slot Fiend | A machine that pays out in bullets and never in coin. | Read the reels. A mismatch means it jams. |
| `waiter_imp` | Waiter Imp | Delivers drinks and grievances. Tips are optional. Ducking is not. | The bottle lands in a second. Leave the marker. |
| `bouncer` (enemy) | Bouncer | Two hundred pounds of "not tonight". Has never been asked twice. | Shielded in front. Hit his sides, or the rush recovery. |
| `joker` | Joker | Laughs first, always. The laughing is the worst part. | Watch for the jack-in-the-box. Short fuse. |
| `duelist` (EVENTS) | Ghost Duelist | Has been waiting for a quicker draw since 1881. It has been a long wait. | Invulnerable until DRAW. Fire the instant the bell ends. |
(Tip mechanics were written from CHAPTER2's telegraph descriptions; the integrator adjusts wording where a number differs. Template for later enemies: `id | name (<= 24 chars) | lore (1-2 sentences, <= 30 words: what it was + one dark-funny detail) | tip (<= 64 chars: the telegraph, then the answer)`.)

---
## 10. DEATH SCREEN (extends `EndScene`)
Poster keeps `WANTED / DEAD OR ALIVE`. `Killed by` uses `causeOf` (CHAPTER2 adds hazard strings; add `toro: 'El Toro Infernal'`, `engine: 'Engine No. 666'`, `scratch: 'Ol\' Scratch'`, mini names from EVENTS). Under the stamp, an italic **epitaph** chosen by `run.killedBy`, fallback `generic`; never the same one twice in a row (`Save.flags.lastEpitaph`). Selection: cause key -> rider key (25%) -> `hard` (35% on HELL ON EARTH) -> generic. Retry hint `R  -  DEAL ME IN AGAIN`. Hell adds `Dealt a dead man's hand.` under WANTED.
| key | epitaphs (`/` alternates; pick 1) |
|---|---|
| `generic` | The Devil shuffles. You are dealt in again. / Your ledger has been updated. / You were warned. In the fine print. / Another debtor down. The Dealer barely blinked. / Cause of death: Perdition. / Buried without a headstone. Again. / The vultures thank you for your service. / The debt remains unpaid. / Six feet under, and no whiskey. / Your boots were sold before you hit the dirt. / The Devil keeps very good books. / Perdition County claims another soul. |
| `cascabel` | Bitten by the county's oldest notice period. / Rattled. Then bitten. Then finished. |
| `grimm` | The Law took its course, then your boots. / Sentenced, hanged and filed under "Tuesday". |
| `undertaker` | He dug the hole. You supplied the rest. / The Undertaker does not do refunds. He does deposits. |
| `toro` | Branded, then trampled. In that order. / The furnace has a horn on it. |
| `engine` | Run down by a train that was not even angry. / Right on schedule. Yours, not his. |
| `scratch` | The house always wins. It is in the name. / You were dealt out with a very good hand. He had a better one. |
| `coyote` | Outrun by a dog with a grudge. |
| `rattlesnake`, `venom` | You had six chambers and one snake. Arithmetic is cruel. / Poison: the slow way of saying "I told you so". |
| `tumbleweed`, `tumbleweed_mini` | Killed by a plant. Please do not tell anyone. |
| `outlaw` | A bandit with better aim and worse manners. |
| `buzzard` | The buzzards were right to circle. |
| `possessed` | Talked to a man with a passenger. It did not go well. |
| `skeleton` | Out-drawn by a man without a stomach. |
| `dynamiter`, `stick` | Blown up by someone who thought it was funny. |
| `ghost`, `ghostfire` | The dead do not hold grudges. They hold you. / Cold fire. Warm regrets. |
| `scarecrow` | You hung around too long. |
| `crow` | A murder of crows. Technically a justified one. |
| `miner`, `melee` | The shift ended. Yours, not his. |
| `bat` | Bitten to death by something the size of a hat. |
| `mole`, `burst` | Undermined. |
| `coffin`, `nail` | The shape should have warned you. / A coffin nail. Poetic, if you like that sort of thing. |
| `spikes` | You knew they were there. They knew you would forget. |
| `explosion`, `dynamite` | Your own dynamite. It was very loyal to the cause. |
| `rock` | Rocks fall. Everyone dies. Somebody should have said. |
| `the desert` | The desert takes everyone eventually. It was just patient. |
| `hellhound`, `hellsteer` | Who let the dogs out? Hell did. / Gored, then grilled. |
| `cinder_skull` | Killed by a lit fuse with a face. |
| `magma_eel`, `lava` | Swam in the Devil's bath. The water was not fine. |
| `sulfur_preacher`, `vent` | The sermon was short and smelled of eggs. |
| `magma_golem`, `fire` | Burned. In this economy. |
| `handcar_bandit` | Robbed by a man on a pump. Fast, for a pump. |
| `signalman` | You stood where the lamp said. It was not a suggestion. |
| `steam_stoker`, `steam` | Boiled alive. Medium rare. |
| `crate_mimic` | The crate was the enemy. It was always the crate. |
| `rail_rat` | Gnawed to death by five small opinions. |
| `chain_gang` | Sentenced to life. Then some. |
| `cart` | Run over by the twelve o'clock. |
| `card_shark`, `card`, `joker` | He dealt from the bottom. So did the deck. |
| `loaded_die`, `roulette` | The house rolled. You lost, as scheduled. |
| `slot_fiend` | No payout. |
| `waiter_imp`, `chandelier` | Service was slow. The chandelier was not. |
| `bouncer` | You were not on the list. |
| `duelist` | Quick draw, slow death. |
| `hard` (Hell on Earth) | Aces, eights and a bad habit. / You asked for the harder hand. It was dealt. |
| rider keys | `preacher`: The Chaplain's last sermon was short and ended in a hole. / `hunter`: Bounty uncollected. Dead or alive, he settled for dead. / `queen`: Maude went all in, and "all" was less than she had hoped. / `gunslinger`: Late again, Eli. |

---
## 11. NPC DIALOGUE (speech tag: 22 px Special Elite on a parchment tag above the speaker, typewriter 40 cps, hold 2.8 s, wrap 520 px, <= 2 lines; random within a category, never the last one repeated)
### 11.1 `peddler` (cheerful huckster skeleton; the only voice allowed exclamation marks)
| category | lines |
|---|---|
| greet | Step right up! Everything is cursed, but reasonably priced! / Ah, a customer! My favourite kind of living person. / Buy something, friend. My bones ache for commerce. / No refunds. Only regrets. Both at a discount! |
| greet_return (2nd+ shop) | Back again! Did the last thing work? Do not answer. / Still alive! I had money on it. |
| greet_rider | `gunslinger`: Deputy Marrow! Thought you were dead. That is all right. So am I. / `preacher`: Chaplain! I have a Bible here, slightly used. Mostly by demons. / `hunter`: Mr. Rook! Rope on sale. For your... line of work. / `queen`: Miss Marlowe! Cards are extra. Last time you kept the deck. |
| greet_floor | F4: How did I get down here? Do not ask. I have a very good travel plan. / F5: Ticket? No? Me neither. Buy something. / F6: The saloon takes forty percent. Be kind to a skeleton. |
| buy | Pleasure doing business! Mine, anyway. / Sold! May it outlive you! / A fine choice. I would say "wear it well", but you are dying anyway. |
| deny | Coins, friend. C-O-I-N-S. I can spell it slower. / Your pockets are lighter than my skull. / Come back when the Devil has been kinder to you. |
| leave | Mind the buzzards! / Die somewhere I can find you. I will collect the boots. / Give my regards to the hangman! |
| sold_out | Picked clean. Like me, but with more dignity. / Nothing left but dust and a lantern I cannot sell. |
### 11.2 `dealer` (Crossroads; EVENTS `DEALER_LINES` category sizes are exact: greet 4, hover 6, signed 5, refused 3, leaving 4, curse 3)
| category | lines |
|---|---|
| greet | Well, well. A debtor with initiative. Pull up a chair, friend. / You found my little office. How thoughtful. / Come in. The door was never locked. It was never a door. / Ah, a customer. I do love a customer who is still breathing. |
| hover | Read it twice. I will not tell you what the second read says. / Everything I offer is true. That is the problem. / A little of yours, a lot of mine. / Take your time. I have all of it. / The terms are simple. The consequences are elegant. / Sign, and I will owe you. I do so like owing. |
| signed | Wonderful. Signed and witnessed. / A pleasure. I honour every word. Especially the small ones. / Hm. Hm! That felt like a real smile. / There. Now we are partners. Of a sort. / Keep the pen. No, I insist. It remembers you. |
| refused | No? Of course. The offer stands. It always stands. / Pride. Delicious. Please, keep it. / You will be back. Everyone is back. |
| leaving | Mind the way out. It is much longer than the way in. / Give my regards to the Marshal. He has never once written. / Until we meet again. Which is soon. / Go on, then. I shall be here. I am always here. |
| curse | A little something to remember me by. / Free of charge. Well. Free of coin. / It is only a curse. Everyone has one. You have merely upgraded. |
| extra: rider (replaces `greet` 30%) | `gunslinger`: Eli. The deputy. Still on my books, friend. / `preacher`: Reverend. I did so enjoy the Amen. / `hunter`: Mr. Rook! Business or pleasure? I only ask because you are armed. / `queen`: Maude! Do not bother shuffling. I have already counted. |
| extra: refused x3 in a run | Three times. I am beginning to take it personally. / You have said no more than anyone in county history. Impressive. Irritating. |
| extra: `gunslinger`, F4-F5 | Your missus asks after you, deputy. She is quite well. Comparatively. |
| extra: clean Hell run, F5 | Not one signature. Not one. I have a page for you regardless. |
### 11.3 Event rooms (EVENTS outcome ids; banner `EVENT: <NAME>` stays EVENTS'; lines are the NPC/closing text; UI strings in CAPS are EVENTS' own)
| event | greet | outcomes |
|---|---|---|
| `card_sharp` | Take a seat. Everyone loses here. Some lose slower. / Cards, chips, cheap thrills. The thrills are the cheap part. | bust: Bust. The house thanks you. / push: A push. Nobody wins. Nobody dies. Boring. / win: A winner! It happens. Rarely. / ace_high: Ace high! The house weeps. / dead_mans_hand: Aces and eights. Take the prize. The dead man will not miss it. / fold (5 hands or net 25): The house is closed. The house is also smug. / broke: No chips, no cards. The rules are older than the county. |
| `wishing_well` | A well. Dry since 1879. It still wants coins. | nothing: THE WELL IS SILENT / heart_half, heart_full, heart_tin: Something warm rises out of the dark. / key: It gives you a key. To what, it does not say. / dynamite: The well has opinions about the bank. Here. / coin_nickel: A nickel back. The well is not sentimental. / luck: The well approves. Briefly. / curse: A hand takes the coin. A hand takes more. / pity (12th throw): The well coughs up something. Take it and go. |
| `gravedigger` | Fresh graves. Someone is still expecting company. | loot: Somebody was buried with their good boots. / chest: Somebody was buried with the good chest. / bones: JUST BONES / ambush: They were not dead. They were resting. / done: That is the last of them. Fill the holes yourself. |
| `preacher` (ghost Confessional) | Confess, child. It is free. Absolution is the expensive part. | Communion: Take, eat. This is my body, and also a fair warning. / blessing: Your sins are forgiven. Some are only postponed. / miracle: A miracle! I am as surprised as you. / false prophet: I was wrong. So very wrong. Enjoy the curse. / Absolution, no curses (NO SINS): No sins? In this county? You must be new. / Plate: Give until it hurts. Or until you are healed. / leave: Go in peace. Or in pieces. |
| `snake_oil` | Step up, step up! One bottle cures all that ails you, and I do mean all! / Colours! Each one a miracle. Each miracle has a colour. | Potion names (shelf tooltip once identified): `p_heal` Red Restorative / `p_vigor` Vigour Elixir / `p_swift` Quicksilver Tonic / `p_venom` Rattler's Kiss / `p_laudanum` Mother's Comfort / `p_kerosene` Lamp Oil (Do Not Drink). Buy: A wise investment. The wisest I have seen all week. / watered: TASTES LIKE WATER / Hm. The batch was off. / done: Shelf's bare, friend. Come back after the next war. |
| `quick_draw` (`duelist`) | Draw when you are ready. I have all night. You have less. | bell: 1 .. 2 .. 3 / DRAW! / QUICK DRAW! / flawless win: Not a scratch. He tips his hat. Then he is gone. / lose: Better luck next life. / decline: The coward's road is the long one. |

---
## 12. LOADING TIPS & LINES (BootScene; `src/data/story/tips.js` `{t, needs}`; `needs` in `core ch2 deals events meta hell daily`; filter by unlocked features)
Boot lines: existing 10 kept, plus: Branding the herd... / Stoking the boiler... / Shuffling the marked deck... / Reading page two... / Oiling the noose... / Persuading the piano... / Signing nothing... / Waiting for the Devil to stop laughing...
| needs | tip (<= 96 chars) |
|---|---|
| core | Every sixth bullet hits twice as hard and pierces. Count with the cylinder. |
| core | Space rolls through bullets. The roll has a cooldown, so pick your moment. |
| core | Dynamite hurts you too. It also opens secret rooms. |
| core | Golden doors need a key. Somewhere on the floor, one is waiting. |
| core | Tin hearts are lost before your red ones. |
| core | Every attack is telegraphed. Watch the wind-up pose. |
| core | Cleared rooms recharge your active item. |
| core | Cracked walls in dead ends hide something. Bring dynamite. |
| core | Skeletons, ghosts and miners are undead. Silver hurts them more. |
| core | Ghosts cannot be hurt while faded. Wait for the wail. |
| core | Miners are armoured in front. Walk around them. |
| core | Moles surface where you stand. Move when the mound stops. |
| core | Pits stop walkers, not bullets. Shoot across them. |
| core | Shops sell what the Devil skips. Spend your coins before the boss. |
| core | The boss door is red and it does not open twice. |
| core | Rolling into a corner is how heroes end up in corners. |
| core | Enemies in a red aura are Cursed: tougher, but they drop a heart. |
| core | Sign nothing. Some rides are won by refusing. |
| ch2 | Lava burns. Go around, or go fast. |
| ch2 | Signalmen lock your row and column. The diagonals are safe. |
| ch2 | A rail lane flashes red before the cart comes. Believe it. |
| ch2 | That crate has been watching you. |
| ch2 | Kill the Sulfur Preacher first. His ward halves your damage. |
| ch2 | A chandelier's shadow means move. |
| ch2 | On the roulette floor, the colour they call is the colour to leave. |
| deals | The Crossroads opens after a boss. Sometimes. It always closes. |
| deals | Every deal at the Crossroads is true. That is the problem. |
| deals | You can leave the Crossroads without signing. He will remember. |
| events | Question-mark rooms are gambles. Most gambles are polite about it. |
| events | Mini-bosses pay well and hit hard. The bounty is on the poster. |
| meta | Some deeds unlock new riders. Check the Board. |
| meta | The Codex remembers everything you have met. |
| meta | Each rider plays differently. Try one you dislike. |
| hell | Hell on Earth is a longer ride with a harder Devil. |
| hell | Sign nothing. On Hell on Earth, that is how the story ends. |
| daily | Today's daily ride is the same county for every rider. |

---
## 13. LORE ENTRIES & DEEDS (extends META `lore.js`, same shape `{id, title, hint, unlock, text}`; `reread` = cutscene id, shown as a Reread button)
### 13.1 Lore (<= 30 words)
| id | Title | Unlock (META grammar) | Text | reread |
|---|---|---|---|---|
| `lore_prologue` | The Debt, Retold | `E run:started{char=gunslinger}` | Eli read page one. The Devil counted on that. So does every contract in the county. | `intro` |
| `lore_page_two` | Page Two | `E floor:changed{floor=4}` | Every contract has a second page: something you love, held at the House until the account is settled. | `interlude_ch1` |
| `lore_toro` | The Brand | `L.bk.toro >= 1` | Every soul in the county wears the House's mark. Toro applies it personally, and does not wait for consent. | - |
| `lore_engine` | The Twelve O'Clock | `L.bk.engine >= 1` | The Midnight Express has never been late. The station clock stopped at noon so nobody could prove otherwise. | - |
| `lore_scratch` | The House | `L.bk.scratch >= 1` | The Devil has never told a lie. He has simply never been asked the right question. | - |
| `lore_drive` | Brand, Rail, Market | `E floor:changed{floor=6}` | The county is a cattle drive. The Undertaker delivers, the bull brands, the train ships, the saloon sells. | - |
| `lore_shuffle` | The Shuffle | `L.deaths >= 3` | When a debtor dies, the Dealer collects, shuffles and deals them in again. It is not mercy. It is inventory. | - |
| `lore_chair` | The Chair | `E run:ended{variant=complete,ending=a}` | The velvet chair is warm. It is always warm. It has never been empty for long. | `end_a` |
| `lore_true` | The Sixth Bullet | `E run:ended{variant=complete,ending=true}` | The House takes every sixth bullet. Nobody thought to ask what happens if you give it back. On Hell on Earth, sign nothing. | `end_true` |
Locked hints (always visible): `lore_chair` "Win a ride." / `lore_true` "Win on Hell on Earth with clean hands." / others "Keep riding."
### 13.2 Deeds to append to META `achievements.js`
| id | Name | Description | Condition | Reward |
|---|---|---|---|---|
| `take_the_chair` | Take the Chair | Finish the story | `E run:ended{variant=complete,ending=a}` | 20 NP |
| `sixth_bullet` | The Sixth Bullet | See the true ending | `E run:ended{variant=complete,ending=true}` | 250 NP, `title:closer` |
(`clean_hands` in META stays as is; `sixth_bullet` implies it.)

---
## 14. CREDITS TEXT
```
DEAD WEST
A Tale of Perdition County
--
GAME DESIGN & CODE      The Dead West outfit
ART                     Painted in ink and cross-hatch with GPT Image 2.5, cut and polished by hand
STORY & WORDS           The Dead West outfit, with help from the Devil's marketing department
MUSIC                   Kevin MacLeod (incompetech.com), CC BY 4.0  {{music_credits_ch2}}
SOUND                   Freesound and Kenney contributors (CC0 / CC BY), see assets/audio/CREDITS_sfx.md
TYPEFACES               Rye and Special Elite (Google Fonts, SIL OFL)
ENGINE                  Phaser 3 + Vite
--
THE RIDERS              The Gunslinger, Rev. Josiah Thorne, Cormac Rook, Maude Marlowe
THE KEEPERS             El Cascabel, Marshal Grimm, The Undertaker, El Toro Infernal, Engine No. 666
THE HOUSE               Ol' Scratch
WITH APOLOGIES TO       Every buzzard we made a villain
--
SPECIAL THANKS          To everyone who died so you could try again
No riders were harmed in the making of this game. Several were invoiced.
--
END A tail: The deck is warm.        END B tail: ACCOUNT CLOSED.
```
`{{music_credits_ch2}}` is filled from `public/assets/audio/CREDITS_music.md`. Open audio licence flags (STATUS.md) stay open.

---
## 15. AUDIO DIRECTION (mood words; keys per CHAPTER2/EVENTS where they exist)
| key | owner | use | mood |
|---|---|---|---|
| `mus_cutscene_intro` | new | intro, intro_hell | lonely slide guitar, wind, slow 60 bpm, funeral, distant church bell, dust |
| `mus_interlude` | CHAPTER2 | interlude_ch1 | descending drone, hollow cello, single bell, dread, the floor giving way |
| `mus_floor4` / `mus_boss4` | CHAPTER2 | Brimstone Bluffs / Toro | war-drum pulse, low brass, detuned slide, fire crackle; stampede toms, bull-horn stabs |
| `mus_floor5` / `mus_boss5_*` | CHAPTER2 | Blood Rail / Engine | 6/8 train shuffle, harmonica, low strings, far bell; one ostinato at rising tempo, steam-whistle stabs, doom |
| `mus_floor6` / `mus_boss6_*` | CHAPTER2 | Last Chance Saloon / Scratch | a waltz gone wrong, out-of-tune honky-tonk, harpsichord, muted trumpet, choir hum; poker waltz, band, hell chorale, heartbeat and drone |
| `mus_crossroads` | EVENTS | Crossroads | creaking guitar, whispered chorus, one crow, temptation, low pulse |
| `mus_ending_a` | new | end_a | bittersweet, solo piano over a slowed `mus_menu`, resignation, warm dread |
| `mus_ending_true` | new | end_true | dawn harmonica, major key at last, slide guitar, gratitude, bells fading |
| `mus_credits` | new | credits | slow slide-guitar reprise of `mus_menu`, wind |
New SFX (1-3 variants each): `ui_type`, `ink_splat`, `page_flip`, `pen_scratch`, `clock_tick`, `crowd_murmur`, `wind_gust`, `page_burn`, `card_flip`. Reuse (exist or listed by siblings): `boss_intro`, `boss_die`, `gun_cock`, `dig`, `coffin_open`, `door_open`, `door_close`, `step_dirt`, `step_wood`, `shoot_crit`, `heartbeat`, `amb_wind`, `zombie_groan`, `bell_toll`, `train_horn`, `card_shuffle`, `piano_sting`, `contract_tear`, `devil_laugh`. Rules: 500 ms of silence before the first caption; the finale mutes music 2 s and returns it on one held chord; ending music never overlaps `mus_victory`.

---
## 16. FULL-SCREEN / STORY ART LIST (24 generations, under the ~28 cap; 4 spare for regenerations)
| # | key | type | size | wave | refs (Image 2+) | note |
|---|---|---|---|---|---|---|
| 1-7 | `cutscene_intro_1` ... `_7` | opaque webp | 1440x960 | 1 | `portrait_player` (1,2,3,6,7), `portrait_grimm` (4), `portrait_undertaker` (5) | 6.1; 1-5 sepia |
| 8 | `cutscene_interlude_1` | opaque webp | 1440x960 | 1 | - | 6.2 |
| 9 | `cutscene_saloon_1` | opaque webp | 1440x960 | 1 | - | 6.4 |
| 10-14 | `cutscene_end_a_1` ... `_5` | opaque webp | 1440x960 | 2 | `portrait_scratch` (1,2) | 6.5 |
| 15-20 | `cutscene_end_true_1` ... `_6` | opaque webp | 1440x960 | 2 | `portrait_scratch` (2,3) | 6.6 |
| 21 | `title_l0_sky` | opaque webp | 1440x960 | 1 | `title_bg` | 5.5 |
| 22 | `title_l1_town` | png alpha | 1440x960 | 1 | `title_bg` | 5.5 |
| 23 | `title_l2_fg` | png alpha | 1440x960 | 1 | - | 5.5 |
| 24 | `title_l3_rider` | png alpha | 512x640 | 1 | `portrait_player` | 5.5 |
Consumed, generated by CHAPTER2: `img_interlude_ch2`, `portrait_toro`, `portrait_engine`, `portrait_scratch` (wave 2 waits for the last; if late, generate from the canon text in section 1 and regenerate only if it drifts). Reused with no new art: `intro_hell` (`cutscene_end_a_5`, `cutscene_intro_7`), ledger cards, chapter cards (`title_l0_sky` tinted), credits backgrounds, all transitions, boss-intro card hands, WANTED card poster (EVENTS `props_small`).
Prompt boilerplate: ART_BIBLE block + "Comic-book panel composition, dramatic camera, thick ink outlines, cross-hatching, muted palette with one hot accent colour; lower fifth calm and dark; no text, no lettering, no signage letters."

---
## 17. IMPLEMENTATION NOTES
| Area | Change |
|---|---|
| New data | `src/data/story/`: `cutscenes.js`, `text.js` (floor subtitles, whispers, ledger cards, banners), `bosslines.js` (7), `epitaphs.js` (10), `dialogue.js` (11), `tips.js` (12), `bestiary.js` (9, imported by META `codexText.js`), `lore.js` additions (13), `lore_items.js` (8). Plain objects, no Phaser imports (node-testable). |
| Scenes | `CutsceneScene`, `CreditsScene`, `src/scenes/ending.js` exporting `runEnding(scene, payload)` (`game:ending` handoff, CHAPTER2 section 8): picks `end_a`/`end_true` from `payload.ending`, plays credits, then `endRun('complete')`; falls back to the old poster if a module is missing. Register in `src/main.js`. |
| Chain hooks | `GameScene.onBossDefeated`: `undertaker` -> CHAPTER2 banner then trapdoor -> `interlude_ch1`; `engine` -> trapdoor -> `saloon_arrival`; `scratch` -> finale/ending. CHAPTER2 `playBanner` (from the `finale.js` refactor) reused. `INTERLUDE_AFTER = 3`. |
| `RunState` / Save | uses META `run.mode`, `run.char`, `run.deals[]`; add `get trueEligible()`; `Save.flags`: `introSeen`, `seen_<id>`, `ending_a`, `ending_true`, `lastEpitaph`. |
| `Cards.js` | chapter card, F4-F6 accents, boss spoken line + death quip, mini-boss `WANTED FOR` small print, checkpoint toast. |
| `EndScene` | win poster strings (section 4), epitaphs, retry copy, `causeOf` additions. |
| `MenuScene` | 4 title layers with fallback, subtitle rotation, credits rows. |
| `BootScene` | `TIPS` from `tips.js`. |
| Events | new: `story:cutscene {id}`, `story:trueFinale`; `game:ending` (CHAPTER2); `run:ended` gains `ending`. |
| Fonts | Rye + Special Elite only. |
| Fallbacks | Every new image key optional: the game runs with none of the 24 (placeholder panels). |

## 18. TEST / ACCEPTANCE
1. `?cutscene=<id>` plays each cutscene headless; `__game.story.skip()` advances; `next` starts even with all images missing; `daily`/`contract` runs never enter a cutscene; `CONTINUE` never replays interlude/saloon.
2. `tools/qa/story-lint.mjs` (build it): captions <= 2 lines and <= 52 chars/line (all `caption`, `caption_if`, `caption_after`); item `lore` <= 72; tips <= 96; bestiary tip <= 64, lore <= 30 words; every cutscene image key in the manifest or flagged placeholder; every referenced boss/enemy/item/rider/mini id exists in its registry; no duplicate epitaph; `caption_if.char` covers all 4 riders on panels that name a rider; `DEALER_LINES` category counts equal 4/6/5/3/4/3.
3. `trueEligible` unit tests: normal + 0 deals = false; hell + 1 deal = false; hell + 0 deals = true; daily = false. The finale completes with each of the 4 riders; cylinder starts at 0/6; shot 6 always connects; pause works, skipping is impossible mid-finale.
4. Win flow: Normal win -> `end_a` -> credits -> `complete` poster -> `mode:hell` unlocked (toast), `Save.flags.ending_a`; Hell + clean win -> finale -> `end_true` -> credits; replays via CODEX > LORE.
5. Death flow: every `killedBy` key `Player.die` can emit maps to a non-empty `causeOf` and an epitaph (fallback generic); epitaph differs from the last.
6. Chapter chain: F3 boss -> banner -> trapdoor -> interlude (per-rider overlay) -> F4 with checkpoint; ESC skips forward only.
7. Visual pass at 1x: captions legible on all 24 panels; letterbox does not clip focal subjects; title parallax has no seams at +/-30 px.
8. `npm run smoke`, `selftest`, `test:prod` pass with all new files.

## 19. SCOPE GUARDS (do NOT build)
No voice acting; no video or frame-by-frame animation; no branching dialogue, dialogue trees or reputation; no per-rider cutscene art (captions carry the rider, silhouettes carry the picture); no cutscenes in daily or contract runs; no endings beyond A and B; no lore pickups in the world (whispers, NPCs and the Codex are the only lore channels); no cutscene editor; no localisation layer beyond keeping text in `src/data/story/`; no new fonts; no mid-run save except CHAPTER2's checkpoint. If a sibling conflicts on ids or numbers, the sibling wins; this doc wins on all words.

## Integrator notes
Authoritative reconciliation is `ARCH_V2.md` s0 (D1-D18).
- Endings: `runEnding` in `src/scenes/ending.js`, event `game:ending`, `run:ended` gains `ending` (D13). Ending A is "Take the Chair"; the true "Sixth Bullet" ending needs Hell and no deals.
- Both `img_interlude_ch2` and `cutscene_interlude_1` are kept (D12).
- Boss music is decided by `BOSS_META.music` (D14).
- Codex has six tabs (BESTIARY, RELICS, OUTLAWS, LORE, DEEDS, RECORD); deeds data ships from FE-S1.
- Art: 24 story panels are generated in two waves (ASSET_SPEC_V2 s8-s9); ending panels `end_a_4,5` and `end_true_*` depend on the Scratch portrait and intro panels. `ui_board_bg` is cut.
- The game must run with all story art and audio missing.
