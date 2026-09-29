# DEAD WEST v2 - Audio Spec (Round 2)

Extends `docs/ASSET_SPEC.md` (Audio section) and the conventions of `src/core/mix.js` / `AudioHooks.js` / `AudioDirector.js`. Two agents use this file: the AUDIO WORKFLOW agents (produce files + `*.audio.json` + `CREDITS_*.md` + `MIX` rows) and the AUDIO INTEGRATION agent (director/hooks/aliases). Where a designer doc lists a key that this file merges or renames, this file wins (section 8).

**Rule 0: the game must run and sound complete with ZERO new audio files.** Every new SFX key resolves through `SFX_ALIAS` (section 7) to an existing file at some rate/volume until a real file lands; every new music key falls back to the closest existing track (section 2). `?nosfx`-style gaps never throw.

## 1. Files, sourcing, pipeline
- New metadata files (tools/build_manifest.py merges all `*.audio.json`): `public/assets/audio/sfx2.audio.json`, `music2.audio.json`; credits `CREDITS_sfx2.md`, `CREDITS_music2.md`. Files: `public/assets/audio/sfx/<key>[_2|_3].mp3` (<= ~500 KB each), `public/assets/audio/music/<key>.mp3` (loops <= 3 MB, encoded like round 1: stereo mp3 `-q:a 4`, loudness ~ -16 LUFS, bosses -15, static gain, ~-1 dBTP limiter; `optimize_assets.py` shrinks to 96 kbps).
- Sourcing order: (1) own synthesis (Python/ffmpeg: noise, filters, sines, FM; good for ticks, zaps, hisses, bells, dings, whooshes, rail clacks); (2) CC0 (freesound.org CC0, OpenGameArt CC0); (3) CC-BY with credits (Kevin MacLeod incompetech, already used: attribution block exists in `CREDITS_music.md`; copy the same block). Log the source URL + license of EVERY file in the `.audio.json` (`source`, `license`) and the CREDITS file. No paid or unclear licenses. Round 1 used freesound CC0 for SFX and incompetech for music; keep that.
- Music candidates: query `https://incompetech.com/music/royalty-free/pieces.json` by genre/tempo/mood (round 1 did this); do NOT trust remembered titles. Loops need bar-aligned loop points with the tail equal-power crossfaded into the head (1.5-3 s), exactly as round 1. Time-stretch (`ffmpeg atempo`, or `librosa`/`rubberband` if installed) is allowed to hit the BPMs below.
- Loudness: run `tools/measure_audio.py` after adding files (regenerates `src/core/mixLevels.js`), then add MIX rows (section 5). Variants `<key>_2`, `<key>_3` are picked randomly by the game; provide 2-3 for frequent sounds (marked xN).
- Priorities: **P1** = needed for chapter 2 to feel finished (floor/boss music, hazard/enemy/boss cues, crossroads core); **P2** = events/minis/elites/story; **P3** = optional polish. Ship all P1 before P2.

## 2. Music (all `type:"music"`, loop unless "sting")
Existing (unchanged): `mus_menu`, `mus_floor1..3`, `mus_boss` (bosses 1-2), `mus_boss_final` (the Undertaker, floor 3), `mus_shop`, stings `mus_death`, `mus_victory`.
| key | Pri | Use | Mood / instrumentation | BPM | Loop | dB (MIX) | Fallback |
|---|---|---|---|---|---|---|---|
| `mus_floor4` | P1 | F4 Brimstone Bluffs | war-drum pulse, low brass drones, detuned slide guitar, fire crackle; oppressive, no relief | 84 | ~80-100 s | -30.5 | `mus_floor3` |
| `mus_floor5` | P1 | F5 Blood Rail | 6/8 train-shuffle ostinato (brushed snare, rail clack), harmonica, low strings, distant bell; night dread | ~100 (6/8) | ~80-100 s | -30.5 | `mus_floor2` |
| `mus_floor6` | P1 | F6 Last Chance Saloon (also the `saloon_arrival` intro) | a waltz gone wrong: out-of-tune honky-tonk piano, harpsichord, muted trumpet, choir hum; decadent, uneasy | 96, 3/4 | ~80-100 s | -30.5 | `mus_floor2` |
| `mus_boss4` | P1 | El Toro Infernal | stampede toms, bull-horn brass stabs, driving; phase tension via the same loop | 132 | ~60-80 s | -28 | `mus_boss` |
| `mus_boss5_a` / `_b` / `_c` | P1 | Engine No. 666 phases P0 / P1 / P2 | ONE locomotive ostinato re-tempo'd: 118 / 132 / 148 BPM, steam-whistle stabs, doom; `_b` adds ghostly choir, `_c` adds full brass. Loops must share bar length in beats so a crossfade stays musical | 118 / 132 / 148 | ~50-70 s each | -28 / -27.8 / -27.5 | `mus_boss` |
| `mus_boss6_a` | P1 | Scratch P0 "The Deal" | piano-and-harpsichord poker waltz | 108 | ~60 s | -28 | `mus_boss_final` |
| `mus_boss6_b` | P1 | Scratch P1 "The Raise" | full band + choir stabs | 120 | ~60 s | -27.8 | `mus_boss_final` |
| `mus_boss6_c` | P1 | Scratch P2 "All In" (true form) | organ + choir hell chorale | 132 | ~60 s | -27.5 | `mus_boss_final` |
| `mus_boss6_d` | P1 | Scratch P3 "The Fine Print" | sparse harpsichord + heartbeat + low drone; tension, quiet | 72 | ~45 s | -30 | `mus_boss_final` |
| `mus_interlude` | P1 | chapter interlude card (F3 -> F4), ~30 s, plays once (loop:false, fade-out tail; the loader treats it as a sting) | descending drone, hollow cello, one bell, distant bull-horn; the floor giving way | free | sting | -31 | `mus_floor3` |
| `mus_crossroads` | P1 | Crossroads pocket + supersecret vault | creaking dry guitar, whispered chorus, one crow, low pulse; temptation | ~60 | ~60 s | -32 | `mus_shop` |
| `mus_miniboss` | P2 | champion (mini-boss) fights, all floors | short percussive loop, tense, 16 bars | ~120 | ~30 s | -29 | `mus_boss` |
| `mus_cutscene_intro` | P2 | `intro` + `intro_hell` | lonely slide guitar, wind, funeral pace, distant church bell | 60 | ~50 s | -31 | `mus_menu` |
| `mus_ending_a` | P2 | end_a "Take the Chair" | bittersweet solo piano over a slowed `mus_menu` motif; warm dread | ~70 | ~40 s | -30 | `mus_menu` |
| `mus_ending_true` | P2 | end_true "The Sixth Bullet" | dawn harmonica, major key at last, slide guitar, bells fading | ~72 | ~45 s | -30 | `mus_menu` |
| `mus_credits` | P2 | credits scroll | slow slide-guitar reprise of `mus_menu`, wind | ~66 | ~90 s | -31 | `mus_menu` |
Stings: `mus_death`, `mus_victory` stay. New short stings are SFX-type (below): `mini_intro`, `piano_sting`, `hellgate_open`. `mus_victory` never overlaps an ending track: the win poster plays after credits.
Menu screens (CharSelect, Codex, Board, Daily, Options): keep `mus_menu` (no new track); the director lowers it -3 dB (music level 0.7) inside Codex/Board so text reading is calm.
Existing files to leave unchanged: everything from round 1. `mus_boss`/`mus_boss_final` are not re-encoded.

## 3. Ambience (loop:true, type `sfx`, lazy-loaded by `amb_` prefix like round 1)
| key | Pri | Floor / room | Content | dB |
|---|---|---|---|---|
| `amb_wind` | exists | F1, F2 (lower on F2: x0.8) | - | -41 |
| `amb_cave` | exists | F3 | - | -39 |
| `amb_lava` | P1 | F4 | crackle + distant roar, faint heat shimmer hiss | -40 |
| `amb_rail` | P1 | F5 | night wind, far whistle (rare), creaking iron | -40 |
| `amb_saloon` | P1 | F6 | muffled crowd murmur, glass clink, distant laughter | -41 |
| `amb_crossroads` | P1 | Crossroads pocket | dry wind, crickets stop, one crow, low hum | -41 |
Shop keeps ambience off (round 1). Boss rooms: ambience off during boss music (unchanged), back on when the floor track returns.

## 4. SFX keys (new; `type:"sfx"`, `loop:false` unless noted). Src: **N** = new file, **V** = derive from an existing key via alias (`base@rate`, `vol`), **M** = new file preferred, alias meanwhile. xN = provide N variants.
### 4.1 Chapter 2 world (Pri P1)
| key | Src | dB | poly / gap / rand | Use |
|---|---|---|---|---|
| `lava_bubble` | N x2 | -32 | 2 / 0.3 / 150 | lava tile bubbling before a spit |
| `lava_burst` | V explosion@0.75 | -26 | 2 / 0.2 | ember lob, eel surfacing |
| `vent_hiss` | V steam_hiss@0.9 | -32 | 3 / 0.3 | vent warn phase |
| `vent_erupt` | M | -24 | 2 / 0.3 / 100 | vent eruption (short fire whoosh + thump) |
| `fire_whoosh` | N x2 | -27 | 3 / 0.1 / 150 | Toro breath, hound flame fan, fire pillars |
| `fire_crackle` | N (loop) | -38 | 2 loops | fire patches (one shared loop while any patch alive; `fire_loop` = same key) |
| `bull_snort` | N x2 | -26 | 2 / 0.4 / 100 | hellsteer paw, Toro/Ol' Fury telegraph |
| `bull_roar` | N | -20 | 1 / 0.5 / duck [0.45, 1.2] | Toro `boss:phase`, phase-2 roar |
| `hoof_thunder` | N x2 | -25 | 1 / 0.5 | herd stampede tell; `stampede_rumble` alias |
| `hound_growl` | N x2 | -28 | creature group | hellhound windup |
| `train_horn` | N | -20 | 1 / 0.5 / duck [0.45, 1.5] | Engine `boss:phase`, lane charge, `saloon_arrival` cutscene |
| `train_bell` | N | -27 | 4 / 0.15 | lane cart telegraph (x4 rapid), signal |
| `rail_clatter` | N x2 | -30 | 2 / 0.2 | cart/engine passing loop-ish (1.5-3 s) |
| `cart_rumble` | M | -28 | 2 / 0.3 | rail cart lane sweep |
| `steam_hiss` | N x2 | -31 | 3 / 0.3 | T jets warn, stoker vent, steam bullets |
| `steam_blast` | V steam_hiss@0.8 + explosion@1.3 (layer) | -24 | 2 / 0.3 | stoker blast |
| `coal_thud` | V bullet_hit_wall@0.5 (vol +6 dB) | -30 | 3 / 0.08 / 200 | coal landing |
| `mimic_chomp` | N x2 | -26 | 2 / 0.2 | crate mimic wake + bite |
| `rat_squeak` | N x3 | -33 | 4 / 0.08 / 250 | rail rat packs (creature group, rate-limited) |
| `chain_rattle` | V skeleton_rattle@0.7 | -30 | 2 / 0.3 | chain gang |
| `card_throw` | V lasso_swish@1.6 | -30 | 4 / 0.06 / 200 | card bullets |
| `card_shuffle` | N | -29 | 1 / 0.4 | shark reload, Scratch intro, story |
| `chip_clatter` | N x2 | -31 | 3 / 0.1 | chip bullets, slot payout |
| `dice_roll` | N x2 | -29 | 2 / 0.2 | loaded die bounce |
| `slot_spin` | N | -32 | 1 / 0.5 | reels (1.2 s) |
| `slot_ding` | N | -27 | 1 / 0.3 | reel outcome |
| `slot_jam` | V shop_deny@0.7 | -26 | 1 / 0.4 | no-payout jam |
| `glass_break` | N x2 | -27 | 3 / 0.08 / 150 | shard rings, bottles, stool fragments |
| `chandelier_creak` | M | -27 | 1 / 1.0 | 1.2 s chandelier tell |
| `chandelier_crash` | V explosion@0.6 + glass_break (layer) | -20 | 1 / 1.0 / duck [0.5, 0.8] | impact |
| `roulette_tick` | N | -31 | 2 / 0.2 | tile flicker |
| `roulette_zap` | N | -27 | 2 / 0.2 | zap start |
| `piano_sting` | N x2 | -26 | 1 / 0.5 | Scratch, saloon_arrival, F6 gag |
| `devil_laugh` | N x2 | -20 | 1 / 0.5 / duck [0.4, 1.5] | Scratch `boss:phase` (deeper than `dealer_laugh`) |
| `contract_tear` | N | -22 | 1 / 0.5 / duck [0.4, 1.5] | Scratch P3 tear, end_true_2 |
| `seal_break` | V glass_break@1.2 | -27 | 3 / 0.1 | contract seals |
### 4.2 Crossroads (P1 core, P2 rest)
| key | Pri | Src | dB | Use |
|---|---|---|---|---|
| `hellgate_open` | P1 | N | -21 (duck [0.5,1.5]) | gate appears (rumble + low sting) |
| `hellgate_enter` | P1 | V trapdoor@0.7 | -25 | entering pocket / supersecret |
| `dealer_laugh` | P1 | N x2 | -23 | Dealer frame 5 |
| `dealer_mumble` | P2 | N (short tick, x3 pitches) | -34 | speech ticks (max 1 per 3 chars) |
| `contract_hover` | P2 | V page_flip@1.0 | -33 | hover a table |
| `contract_sign` | P1 | N | -22 (duck [0.5,1.2]) | quill scratch + low thunder |
| `heart_pay` | P1 | N | -23 | wet thud, heart cost |
| `curse_gain` | P1 | N | -24 | descending minor chord + whisper |
| `blessing_gain` | P2 | V item_get@1.25 + holy shimmer | -25 | blessing |
| `revive_ace` | P1 | N | -19 (duck [0.35,2.0]) | ace_in_hole / lazarus_pact revive |
### 4.3 Events, minis, elites, hazards, modifiers (P2)
| key | Src | dB | Use |
|---|---|---|---|
| `card_flip` | N x2 | -30 | card table, Scratch intro cards |
| `card_win` / `card_lose` | V item_get@1.4 (vol .6) / V shop_deny@0.8 | -27 | bet result |
| `chip_place` | V chip_clatter@1.2 | -32 | bets |
| `well_plink` | N x2 | -31 | coin into well |
| `well_wish` | V item_get@0.8 | -26 | wish resolves |
| `shovel_dig` | V dig@1.0 | -29 | gravedigger hold-dig (looping ticks by rate) |
| `grave_crack` | V coffin_open@0.8 | -27 | grave breaks |
| `grave_open` | V coffin_open@0.6 | -26 | coffin opens |
| `bottle_pop` | N x2 | -29 | snake-oil cork |
| `potion_gulp` | N x2 | -29 | drink |
| `bell_toll` | N x2 | -24 | duel bell, story cutscenes, ending |
| `duel_draw` | N | -20 | draw crack + whoosh (must cut through) |
| `quick_draw_ding` | V pickup_key@1.5 | -27 | early-draw feedback |
| `mini_intro` | N sting | -20 (duck [0.35,2.0]) | WANTED card |
| `chain_whirl` | V lasso_swish@0.7 | -29 | hangman flail |
| `rock_crumble` | V bullet_hit_wall@0.4 | -30 | motherlode |
| `censer_swing` | V lasso_swish@0.5 | -30 | ash deacon |
| `elite_spawn` | N | -26 | elite ring appears |
| `elite_ting` | V enemy_hit@1.6 | -30 | armored hit |
| `elite_pop` | V fuse | -30 | volatile fuse |
| `quicksand_bubble` | V lava_bubble@0.7 | -34 | Q tile |
| `spikes_ret` | V door_open@1.6 (vol short) | -30 | retracting spikes |
| `rock_warn` / `rock_impact` | V dig@0.8 / V bullet_hit_wall@0.4 | -32 / -27 | rockfall |
| `lurch_creak` | V coffin_open@0.5 | -32 | lurch modifier |
| `blood_moon_howl` | V coyote_howl@0.7 | -28 | once on entry |
| `wall_knock` | V bullet_hit_wall@0.5 | -30 | breakable-wall tell |
| `stampede_rumble` | alias -> `hoof_thunder` | | event stampede |
| `stampede_hoof` | alias -> `hoof_thunder`@1.4 | | |
`secret_reveal` = `door_unlock` (no new key).
### 4.4 Story / UI (P2)
`ui_type` N x2 (-38, poly 2, gap 0.05; typewriter tick), `ink_splat` N (-27), `page_flip` N x2 (-31), `pen_scratch` N x2 (-31), `clock_tick` N (-34), `crowd_murmur` N loop-capable (-36), `wind_gust` N x2 (-33), `page_burn` N (-29).
### 4.5 Items / meta / character polish (P3, all optional: alias exists so nothing breaks)
| key | Alias meanwhile | dB | Use |
|---|---|---|---|
| `synergy_chime` | item_get@1.4 | -24 | `synergy:activated` (capstone adds `room_clear`) |
| `shock_zap` | roulette_zap@1.2 (or explosion@1.8 vol .3) | -30 | lightning rod arcs |
| `freeze_shatter` | glass_break@1.3 | -30 | frozen kill |
| `holy_chime` | item_get@1.1 | -28 | holy pillar / nova |
| `mark_lock` | gun_cock@1.3 | -30 | Hunter mark |
| `ricochet_ping` | bullet_hit_wall@1.6 | -36 | ricochet/mirror bounce |
| `stamp_slam` | door_close@0.8 | -26 | meta rank/achievement stamp |
| `shoot_scatter` | shoot@0.8 (x1.4 vol) | -26 | Preacher scattergun (falls back to `shoot`) |
| `shoot_rifle` | shoot@0.7 | -26 | Hunter |
| `shoot_twin` | shoot@1.15 | -28 | Queen |
Total new SFX keys: 92 (about 45 need genuinely new recordings; the rest are aliases/layers).

## 5. MIX rows (add to `src/core/mix.js` MIX; `db` per tables above)
Defaults for unlisted new keys: `DEFAULT_DB` -27. Families:
- Creature group (`CREATURE` array, poly 4, gap 0.08): add `hound_growl`, `bull_snort`, `rat_squeak`, `mimic_chomp`, `blood_moon_howl`.
- Important stingers (duck the music): `bull_roar`, `train_horn`, `devil_laugh`, `contract_tear`, `hellgate_open`, `contract_sign`, `revive_ace`, `mini_intro`, `duel_draw`, `chandelier_crash` use `duck: [level, hold]` values in the tables.
- Loops (no poly cap by gap): `fire_crackle`, `amb_*`, `slot_spin` (one-shot 1.2 s).
- Music rows: `mus_floor4/5/6: -30.5`, `mus_boss4: -28`, `mus_boss5_a/b/c: -28/-27.8/-27.5`, `mus_boss6_a/b/c/d: -28/-27.8/-27.5/-30`, `mus_interlude: -31`, `mus_crossroads: -32`, `mus_miniboss: -29`, `mus_cutscene_intro: -31`, `mus_ending_a/true: -30`, `mus_credits: -31`.
- `isLazyAudio`: music + `amb_` lazy as today; `mus_interlude`, `mus_boss6_a` and `mus_ending_*` prefetch when the trigger is near (`AudioLoader.prefetch`): interlude at F3 boss room adjacency, `mus_boss4/5/6_*` at adjacency to the floor's boss room, `mus_crossroads` at gate opening, ending tracks when Scratch reaches P3. `mus_crossroads` and `mus_miniboss` are prefetched on `floor:changed`.

## 6. Director and hook rules (`src/core/AudioDirector.js`, `AudioHooks.js`)
Data-driven from `FLOORS` / `BOSS_META`, no floor literals:
| Concern | Rule |
|---|---|
| Floor music | `FLOORS[n].music` (F1-F6 `mus_floor1..6`). No clamp to 3 |
| Boss music | `bossMeta(tpl.boss).music`: cascabel/grimm `boss` (`mus_boss`), undertaker `boss_final`, toro `boss4`, engine `boss5` (stems `_a/_b/_c`), scratch `boss6` (stems `_a.._d`). Track key = `mus_<music>` or, for stems, `mus_<music>_<a..d>` picked by `boss:phase` phase index (0->a, 1->b, 2->c, 3->d; Engine P2 -> c, Scratch P3 -> d; a boss with fewer stems clamps to its last) |
| Stem switching | `Music.play(key, {fade: 1000, crossfade: true})` on `boss:phase`, keeping the loop position ratio when both stems have equal bar length (Engine); Scratch stems start from 0 |
| Champion room | uncleared `champion` room -> `mus_miniboss`; on `mini:defeated` back to floor track (fade 1200) |
| Crossroads pocket | `pocket:entered` -> `mus_crossroads` + `amb_crossroads`; `pocket:left` -> floor track + floor ambience. Supersecret vault uses the same |
| Event rooms | keep floor music; each event room adds nothing but SFX; `quick_draw` duel: music fades to 0.25 during the wait, restored on resolution |
| Shop | `mus_shop` (all floors), F6 shop unchanged music |
| Ambience per floor | F1 `amb_wind`, F2 `amb_wind` (x0.8), F3 `amb_cave`, F4 `amb_lava`, F5 `amb_rail`, F6 `amb_saloon` |
| Footsteps | `STEP`: F1 `step_dirt`, F2 `step_wood`, F3 `step_dirt`, F4 `step_dirt`, F5 `step_dirt` (gravel: rate 0.85), F6 `step_wood` |
| Interlude | on descent from F3: fade floor music 800 ms, `mus_interlude` plays during the interlude card, `floor:changed` (F4) starts `mus_floor4` with fade 1500 |
| Cutscenes | `CutsceneScene` owns its music (`music` field per cutscene): crossfade 600 ms in; the next scene sets its own; 500 ms silence before the first caption; the finale mutes music 2 s then returns it on one held chord; `mus_victory` only after credits |
| Menu / options | menu music continues across CharSelect/Codex/Board; Codex/Board at level 0.7 |
| Hell on Earth | no separate track (mood via ambience only): floor `amb_*` +1 dB, `mus_floor*` rate 1.0 (no pitch tricks) |
| Death / victory | unchanged (`mus_death`, `mus_victory`); `game:ending` fades music 1.0 s, no `mus_victory` before the ending scenes |

## 7. `SFX_ALIAS` (new file `src/core/AudioAliases.js`)
`export const SFX_ALIAS = { key: { base: 'explosion', rate: 0.75, vol: 1, layers?: [{base,rate,vol,delay}] } }` covering EVERY key in section 4 with a "V"/alias entry and a sensible fallback for every "N/M" key (closest existing sound, e.g. `train_horn` -> `boss_intro@0.7`, `bull_roar` -> `zombie_groan@0.5`, `devil_laugh` -> `ghost_wail@0.55`, `piano_sting` -> `item_get@0.7`, `card_shuffle` -> `whip_crack@1.4 vol .5`, `rat_squeak` -> `bat_screech@1.8 vol .5`, `hellgate_open` -> `trapdoor@0.6 + explosion@0.5`). `Sfx.play(key, opts)`: manifest has key -> real file; else `SFX_ALIAS[key]` -> play base with `rate*opts.rate`, `vol*opts.vol` (layers played too); else silent (never throws). Music: `MUSIC_FALLBACK[key]` table (column "Fallback" in section 2). Aliases are removed lazily: when a real file lands the manifest wins, no code change.

## 8. Merges and renames vs designer docs
`fire_loop` -> `fire_crackle`; `stampede_rumble` / `stampede_hoof` -> aliases of `hoof_thunder`; `dealer_laugh` (Dealer) and `devil_laugh` (Scratch) stay two keys; `secret_reveal` = `door_unlock`; `steam_hiss`, `glass_break`, `bull_snort` are defined once (CHAPTER2 and EVENTS both list them); `bell_toll`, `card_flip`, `card_shuffle`, `piano_sting`, `train_horn`, `contract_tear`, `page_flip`, `pen_scratch` are shared with STORY; optional `synergy` (ITEMS) = `synergy_chime`. Event names use the canonical bus names of `ARCH_V2.md` s0.

## 9. `EVENT_SFX` additions (AudioHooks; `string` or `fn(payload)`)
| Event | Sound |
|---|---|
| `boss:phase` | fn: toro -> `bull_roar`; engine -> `train_horn`; scratch -> `devil_laugh`; others -> `boss_hit` rate 0.6 (existing behaviour) |
| `deal:signed` | `contract_sign` |
| `deal:refused` | `shop_deny` |
| `deal:paid` | `heart_pay` when cost is hearts |
| `gate:opened` | `hellgate_open` |
| `pocket:entered` | `hellgate_enter` |
| `pocket:left` | `door_close` rate 0.8 |
| `curse:gained` / `blessing:gained` | `curse_gain` / `blessing_gain` |
| `player:revived` | `revive_ace` |
| `bet:result` | `card_win` if payout > bet else `card_lose` |
| `potion:drunk` | `potion_gulp` |
| `mini:spawned` | `mini_intro` |
| `mini:defeated` | `boss_die` vol 0.6 rate 1.25 |
| `elite:spawned` | `elite_spawn` |
| `synergy:activated` | `synergy_chime` |
| `meta:unlocked`, `meta:achievement` | `item_get` |
| `meta:rank` | `stamp_slam` |
| `secret:revealed` | `door_unlock` |
| `secret:hint` | `wall_knock` |
| `supersecret:entered` | `hellgate_enter` |
| `modifier:entered` | fn: `blood_moon` -> `blood_moon_howl`, `lurch` -> `lurch_creak`, others none |
| `hazard:hurt` | fn by `type`: lava/vent/fire -> `fire_whoosh` vol .6; cart -> `cart_rumble`; chandelier -> `chandelier_crash` |
Hazard/enemy/boss attack cues (lava_bubble, vent_hiss, train_bell, slot_spin, chandelier_creak, roulette_tick/zap, card_throw ...) are played directly by the owning object with `Sfx.play()` as in round 1 (per-object, high-frequency).

## 10. Deliverables and acceptance
AUDIO WORKFLOW output: (P1) `mus_floor4/5/6`, `mus_boss4`, `mus_boss5_a/b/c`, `mus_boss6_a/b/c/d`, `mus_interlude`, `mus_crossroads`, `amb_lava/rail/saloon/crossroads`, all P1 SFX N-rows; (P2) minis/events/story/elite files; (P3) optional. Each file: source + license logged, loudness within 1.5 dB of its MIX target (verified by `measure_audio.py`), loops seamless (loop-point click test: render 3 loops, no discontinuity > -50 dB), music CREDITS include the attribution block.
AUDIO INTEGRATION acceptance: (1) with an EMPTY new-audio directory the game boots and every listed key plays via alias without console errors (`regress-audio.mjs` extended); (2) music per floor/boss/stem/champion/pocket/interlude routes as section 6 (asserted through `__dw.api.musicKey()`); (3) `boss:phase` crossfade 1.0 s with no double-play or silence gap; (4) `rb-music.mjs` passes; (5) no key in section 4 missing a MIX row or alias.
