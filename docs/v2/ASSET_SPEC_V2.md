# DEAD WEST v2 - Asset Spec (Round 2 art contract)

Same contract as `docs/ASSET_SPEC.md` (logical canvas 1440x960, tile 96, sheets = horizontal strips unless "grid", transparent PNG unless *opaque*, the game runs with ANY subset present). Owner: integrator. Designer docs hold the long descriptions; this file is the single execution list. **Where this file and a designer doc disagree, this file wins** (cuts and renames are listed in section 11 and in each doc's "Integrator notes").

Output locations, manifest and pipeline are unchanged: raw -> `art/raw/<key>.png` (+ `.raw.png` untouched, prompt in `art/prompts/<key>.txt`) -> `tools/sprites.py` (strip/grid/one) -> `public/assets/sprites|images/<key>.png` (+ `.meta.json` / `.image.json`) -> `tools/optimize_assets.py` -> `tools/build_manifest.py`. Approved assets are never overwritten in place (`<key>-v2.png`, swap when accepted).

## 0. Budget, waves, rules

**Total planned: 98 image generations** (+4 CH2 reserve + ~28 headroom under the 130 cap for retries; do not exceed 130 total). Nothing in Chapter 1 has to be regenerated (section 12).

| Group | Gens | Source doc |
|---|---|---|
| Chapter 2 world/enemies/bosses/fx | 39 | CHAPTER2 s10 |
| Riders (3 x 4) + meta/UI kit (meta_icons, ach_cat, ui_charselect_bg, ui_codex_bg) | 16 | CHARACTERS_META s A5/E (cut: `ui_board_bg`) |
| Variety (crossroads, events, hazards, 6 minis paired) | 10 | EVENTS s11 (cut: `fx_fire`; minis 6 -> 3 pair sheets) |
| Items (6 icon sheets, familiars, item fx, player projectiles) | 9 | ITEMS s8 (cut: `ui_synergy_ribbon`) |
| Story (7 intro, interlude, saloon, 11 ending, 4 title layers) | 24 | STORY s16 |
| **Total** | **98** | |

**Waves.** Wave 1 = 78 gens, all mutually independent, 14 batches run in parallel (A1-A7, V1, V2, C1, I1, I2, U1, S1, S2). Wave 2 = 20 gens, 4 batches (W1-W4), start when their dependencies are approved: 9 rider sheets need the C1 anchors, 11 ending panels need `portrait_scratch` (A7). Batches are <= 6 generations (one agent, ~40-60 min).

**Global prompt rules (every generation).** Image 1 = `art/style/style_c.png` (always). Boilerplate from `docs/ART_BIBLE.md` (ink-cartoon woodcut, thick black outlines ~4 % of character height, cross-hatch, flat muted colour with grain, big-head proportions, light from top-left, macabre wanted-poster feel, Isaac-like readability). Sprites: transparent background, NO cast shadow / ground plane / text / labels / frame borders / grid lines, one consistent scale and ground line per sheet, every cell padded with empty space. Backgrounds: opaque, EMPTY floor (no props/characters/doorways), 96 px wall band all round (the playable interior is 1248x672), darker vignette at edges, floor value < 40 % so orange/red bullets and the red poncho pop. Full-screen panels: no lettering. Hell-glow accent = `#d63a2a`/`#ff7a1f`; supernatural = `#8fc23f` (F1-3) or `#6fe0d0` (F5 ghosts).

**Generation aspect (GPT Image sizes).** `1536x1024` landscape (backgrounds, panels, 4x2/3x3 sheets), `1024x1536` portrait (pair sheets, title rider), `1024x1024` (portraits, single icon sheets when square). Backgrounds are generated 1536x1024 and cover-cropped/resized to 1440x864 (or 1440x960 for panels), exported WebP q86-90 by `optimize_assets.py`.

**Pair-sheet recipe (enemies, minis).** ONE generation = two creatures on `1024x1536`, 3 columns x 4 rows: rows 1-2 = creature A frames [1..6] reading left-to-right/top-to-bottom, rows 3-4 = creature B. Post: crop the top 1024x768 and bottom 1024x768 halves, run `sprites.py strip --frames 6` on each. Frame roles (all 6-frame enemies): `[0-3]` move/idle loop, `[4]` attack windup/telegraph, `[5]` attack. If a half fails the checklist regenerate as a single (consumes reserve).

**Review gate per batch (agent, before hand-off).** Attach raw + `.preview.png`; frame count/order/size exact; feet on ground line; identical scale across frames; composite over the floor's own backgrounds (`tools/qa/contact-sheet.py`) at 1x; outline weight matches the style ref; no stray fragments; portraits have the face in the upper 60 %. Log the accept/regen decision in `art/qa/<batch>.md`.

## 1. Riders (3 new; Gunslinger keeps all existing keys)

Frame **128x128**, anchor bottom, faces camera / RIGHT for side views, `flipX` in code. Per rider `<id>` in {preacher, hunter, queen}: 4 generations.

| Step | Key | Layout / size | Batch |
|---|---|---|---|
| G0 anchor | `art/style/player_<id>_anchor.png` (reference only, not shipped) | turnaround: front, back, side-right on one `1536x1024` sheet, transparent | C1 (wave 1) |
| G1 walk | `player_<id>_walk_down` 6f, `player_<id>_walk_up` 6f, `player_<id>_walk_side` 6f | `1536x1024`, 6 cols x 3 rows (row1 down, row2 up, row3 side facing RIGHT) -> 3 strips via `sprites.py strip` per row crop | W1/W2 (wave 2) |
| G2 action | `player_<id>_fire` 3f ([0] down, [1] up, [2] side), `player_<id>_roll` 4f (tucked ball, side, rotatable), `player_<id>_death` 5f (hit, stagger, fall, lie, hat over face) | `1536x1024`, 6 cols x 3 rows (row1 fire 3, row2 roll 4, row3 death 5; empty cells transparent) | W1/W2 |
| G3 portrait | `portrait_<id>` single 512x512, transparent, bust, dramatic, face in upper 60 % | `1024x1024` | W1/W2 |

References for G1-G3: `style_c.png` (Image 1) + the approved `player_<id>_anchor.png` (Image 2). Never use red as the main hue (Gunslinger owns red poncho).
- **`preacher`** (Elias Thorne, "The Chaplain"): black frock, brass cross, broad black hat with a brass band, mutton chops, double-barrel scattergun with a bible strapped to the stock; black + brass.
- **`hunter`** (Cormac Rook): tan duster, olive vest, green scarf, wide brim, long rifle across the back with a short carbine in hand, WANTED tag pinned to the hat; tan/olive + green.
- **`queen`** (Maude Marlowe, "Outlaw Queen"): wide feathered hat with a spade pin, red-velvet-purple corset-coat with fur collar, gold-toothed grin, twin nickel revolvers, coin necklace; purple + gold.
Fallback if missing: `Player.skin` tint of the `player_*` set (0xb0b0ff, 0xd0a070, 0xffd070). Gunslinger art is NOT regenerated.

## 2. Chapter 2 world (F4-F6)

### 2.1 Room backgrounds (12 gens; *opaque* 1440x864 WebP; descriptions verbatim from CHAPTER2 s3-s5, condensed here)
Every floor: `_a`, `_b`, `_c`, `_boss`. Palettes: F4 `#2a0f0c #3b2320 #ff7a1f #d8c43a`, F5 `#1b2230 #2b3140 #8a4b1f #d63a2a #6fe0d0`, F6 `#5a0f1a #120c0a #d4a537 #1f4a34`.
| key | art |
|---|---|
| `bg_f4_a` | basalt canyon floor: cracked dark ash-grey ground, hairline glowing-orange cracks, rock walls stained red, faint sulfur dust |
| `bg_f4_b` | sulfur flat: yellow-crusted stone, scorch rings, soot mounds, orange strata walls |
| `bg_f4_c` | bone trail: charred wagon ruts, longhorn bones and ribs in ash, lava-falls dripping at the wall edge |
| `bg_f4_boss` | bull ring: scorched circular arena with horn runes and a bone ring in the floor, walls of stacked skulls and horn banners, lava-moat glow on the wall band; darker + redder |
| `bg_f5_a` | rail yard at night: gravel-and-cinder floor, faint sleeper marks, cold blue fog at edges, corrugated iron + brick walls with red lanterns |
| `bg_f5_b` | roundhouse interior: worn planks on stone, iron girders, hanging chains, steam wisps along the wall base |
| `bg_f5_c` | depot platform: wide weathered boards, worn yellow safety line, ghost-lit station clock stopped at 12:00 on the wall band |
| `bg_f5_boss` | turntable pit: circular iron turntable with radial seams in the floor centre, three worn rail beds on the sides, tunnel-mouth glow on the top wall, sooty brick, red glow |
| `bg_f6_a` | gambling floor: dark carpet, red diamond pattern, gold inlay, brass rail along walls, velvet panels with candle sconces |
| `bg_f6_b` | card room: green-felt inlaid floor with faint gold-thread suit motifs, dark wood wainscot, framed devil portraits |
| `bg_f6_c` | grand hall: black + blood-red marble checker, gold columns and drapes on the wall band, a huge chandelier shadow on the floor centre |
| `bg_f6_boss` | poker arena: whole floor is a huge green baize table with a gold-thread rim ring and painted suit circles, walls of stacked velvet booths, red-black glow; darker + ominous |
Lava, rails, vents, roulette tiles are code/tile-sheet objects and are NEVER painted into backgrounds.

### 2.2 Obstacle grids (3 gens; grid 4x2, 96x96, anchor bottom; generation `1536x1024` 4x2; names order `block_a, block_b, breakable, breakable_broken, pit, spikes, decor_a, decor_b`)
`pit` fills the whole 96x96 tile top-down; `decor_*` are non-colliding.
| key | cells |
|---|---|
| `obst_f4` | basalt boulder with ember cracks / jagged obsidian spire / brimstone barrel with glowing yellow crust / scorched staves + soot / glowing crevasse with ink rim / obsidian shards / longhorn skull on a pike / burnt cactus + charred grave cross |
| `obst_f5` | stacked ties + steel crates / coal heap in an ore hopper / coal barrel with mail sack (also the `crate_mimic` disguise) / splintered slats + spilled coal / broken trestle gap (black void) / railroad spikes in a board / signal lantern post (red lens) / hobo skull in a hat with a bindle |
| `obst_f6` | overturned poker table / dead slot machine (cracked screen) / chip crate / spilled chips + splinters / open cellar hatch with hell glow / broken glass + bottles / gold spittoon + skull ashtray / brass candelabra |

### 2.3 Hazard, prop, fx, projectile sheets
| key | Format | Anchor | Cells / frames | Gen | Batch |
|---|---|---|---|---|---|
| `haz_f4` | grid 4x2, 96x96 | center | `lava_a, lava_b, lava_c` (3-frame flow, seamless tiling top-down, orange/black), `lava_rim` (shore overlay, code rotates), `vent_idle` (grey grate), `vent_warn` (glowing yellow grate), `vent_erupt` (open grate glowing), `scorch_patch` (dark burnt decal) | `1536x1024` 4x2 | A1 |
| `haz_f5` | grid 4x2, 96x96 | center | `rail_h, rail_v, rail_cross, rail_end` (rust rails on sleepers, buffer stop), `steam_pipe` (valve, faces right), `signal_lamp_off, signal_lamp_on`, `coal_pile_decor` | `1536x1024` 4x2 | A2 |
| `haz_cart` | strip 4f, **192x128** | center | `cart_h_0, cart_h_1` (side view, wheels alternate), `cart_v_0, cart_v_1` (front/back view centred): rusty coal-filled mine cart with glaring painted eyes. Ghost version = code tint 0x6fe0d0 | `1536x1024` 2x2 (`sprites.py grid --cols 2 --rows 2`) | A4 |
| `prop_chandelier` | strip 3f, **192x192** | center | `intact` (bone-and-candle chandelier on chains), `falling` (tilted, streaks), `wreck` (crashed bones, candles, shattered crystal) | `1536x1024` 3x1 | A4 |
| `fx_hellfire` | strip 6f, **128x192** | bottom | flame-column loop, hot yellow core, orange rim, black ink outline; reused for fire patches, vents, burning bosses (code tints) | `1536x1024` 3x2 | A4 |
| `projectiles_c2` | grid 4x2, 48x48 | center | `bullet_ember` (yellow-white core, orange rim, black outline), `bullet_coal`, `bullet_steam` (white puff, dark outline), `bullet_card` (points right), `bullet_chip`, `bullet_shard` (glass sliver), `bullet_spade` (violet), `bullet_spike` (railroad spike). Must read on F4 orange | `1536x1024` 4x2 | A4 |
| `img_interlude_ch2` | *opaque* 1440x960 | - | painted panel: the Undertaker's coffin lid split open, black shaft plunging into a red-orange glow, tiny gunslinger silhouette at the rim, cinders rising, blood-red dusk; lower third dark for text | `1536x1024` | A4 |

## 3. Enemies (18 + 6 minis; all strips of 6 frames, anchor bottom)

Roles: `[0-3]` move/idle loop, `[4]` windup, `[5]` attack. Pair sheets per section 0. Cursed/elite = code tint/ring (no art). Frame = px square.
| Pair sheet (1 gen) | key / frame | art (chunky cartoon-grotesque, big head, 3/4 front) | Batch |
|---|---|---|---|
| P-A1 | `enemy_hellhound` 128 | mangy black hound, glowing ribs, mouth of fire, chain collar; [4] crouch, [5] lunge airborne | A5 |
| | `enemy_sulfur_preacher` 128 | hunched zealot in scorched black frock, bone cross, sulfur-yellow eyes, censer with yellow smoke; [4] arms up, [5] arms down chanting | |
| P-A2 | `enemy_hellsteer` 160 | small hellfire bull demon, flame-tipped horns, steaming nostrils, cracked-lava hide; [4] pawing, [5] head down charging | A5 |
| | `enemy_magma_golem` 160 | hulking lava-rock golem, glowing cracks, boulder fists, small skull in the chest; [4] fists raised, [5] slam | |
| P-A3 | `enemy_cinder_skull` 96 | flaming horned skull with trailing fire wisps; frames 0-3 hover wobble; [4] flashing shriek, [5] burst | A5 |
| | `enemy_magma_eel` 128 | lava eel/serpent head with molten-orange jaws and comb fins rising from a lava tile; [4] surfacing, [5] jaws open spitting | |
| P-B1 | `enemy_handcar_bandit` 160 | skeletal bandit on a pump handcar, bandana, top hat, revolver, arms working the pump (0-3 pump cycle); [4] aiming, [5] firing | A6 |
| | `enemy_steam_stoker` 160 | bulky fireman, steaming iron boiler on his back, gas mask, coal shovel; [4] boiler glows, [5] venting blast pose | |
| P-B2 | `enemy_signalman` 128 | pale railway-signalman ghost, cap, red lantern on a pole, tattered tail; [4] lantern swinging, [5] lantern raised | A6 |
| | `enemy_crate_mimic` 128 | fanged long-tongued crate mimic with slat teeth and a nailhead eye (hopping cycle 0-3); [4] shaking, [5] bite | |
| P-B3 | `enemy_rail_rat` 64 | skinny coal-black rat, bloodshot eyes, sparks on its tail; 0-3 scurry, [4] crouch, [5] bite | A6 |
| | `enemy_chain_gang` 128 | shackled skeleton prisoner in striped rags with ball and chain; links reuse frames 0-3 with tint variants; [4] winding up, [5] charge lean | |
| P-C1 | `enemy_card_shark` 128 | dapper demon gambler, green visor, waistcoat, fan of cards; [4] winding a throw, [5] throwing | A7 |
| | `enemy_joker` 128 | harlequin imp jester, split red/black costume, jingling hat, manic grin; [4] laughing, [5] pop-out pose | |
| P-C2 | `enemy_slot_fiend` 160 | waddling slot machine on stubby legs, fanged coin-slot mouth, arm lever (reels are code); [4] pulling the lever, [5] jam/spit | A7 |
| | `enemy_bouncer` 160 | huge horned demon in a tuxedo, earpiece, folded arms; [4] knuckle-crack, [5] shoulder-down rush | |
| P-C3 | `enemy_loaded_die` 128 | big red casino die with chipped corners and angry pips as eyes/mouth; 0-3 tumbling faces (pips are code-overlaid at attack; keep faces mostly blank-eyed), [4] landing squash, [5] flat | A7 |
| | `enemy_waiter_imp` 96 | little horned imp in a bow tie with a tray and bottles, bat wings (flap 0-3); [4] winding a throw, [5] throw | |

**Mini-bosses** (3 pair sheets, frame **192x192**, anchor bottom, same 6-frame roles, sheet `1024x1536` as above; silhouettes must read on F1 ochre, F2 grey-brown, F3 near-black (add a light rim), F4 red-brown, F5 iron-blue, F6 crimson). Batch V2.
| Pair sheet | key | art |
|---|---|---|
| M-1 | `enemy_ol_fury` | huge skeletal-hided longhorn bull, cracked horns wrapped in barbed wire, one glowing red eye, dust-coloured hide; [4] rears up, [5] lowers horns |
| | `enemy_hangman` | tall hooded executioner, burlap mask with stitched grin, noose belt, heavy chain with a spiked ball; [4] arms wide, [5] swings |
| M-2 | `enemy_motherlode` | walking mound of silver ore and rusted cart parts, miner skeleton half-embedded, lantern for a heart; [4] hoists a boulder, [5] slams |
| | `enemy_ash_deacon` | gaunt charred preacher in a smoking black frock, burning bible, chained censer trailing sparks, halo of ash; [4] raises censer, [5] swings |
| M-3 | `enemy_stoker` | massive soot-black coal shoveller, riveted boiler tank with pressure gauge, glowing furnace-mouth chest; [4] leans back, [5] lunges |
| | `enemy_head_bouncer` (was `enemy_bouncer` in EVENTS, renamed: F6 enemy `bouncer` owns that key) | broad red demon in a waistcoat and bow tie, bar towel on the shoulder, bottle-cap teeth, tiny horns, cracked knuckles; visibly larger and richer-dressed than the F6 `bouncer` grunt; [4] winds up, [5] throws |
Code-only enemy variants (no art): `duelist` = `enemy_outlaw` tinted (0xd9c9a0) + duster overlay; `contract_seal`, `jack_box`, `herd`, ghost carts, event bulls (`enemy_coyote` tinted).

## 4. Bosses (3 new; frame **320x320**, anchor bottom; `_idle` 4f loop, `_atk` 4f poses; portraits 512x512 transparent bust)
| Key(s) | Layout | Poses / art | Gens | Batch |
|---|---|---|---|---|
| `boss_toro_idle`, `boss_toro_atk` | one `1536x1024` sheet, 4 cols x 2 rows (row1 idle, row2 atk) | El Toro Infernal: colossal bipedal-hunched bull demon, cracked-lava hide, nose ring, horns wreathed in flame, smoking hooves, frayed chains on wrists, red-yellow furnace glow in chest. idle: breathing + flame flicker. atk [0] paw/head low, [1] full charge, [2] head up fire-breath, [3] dazed with horns stuck | 1 | A5 |
| `portrait_toro` | 512x512 | bust, snorting, horns aflame | 1 | A5 |
| `boss_engine_idle`, `boss_engine_atk` | `1536x1024` 4x2 | Engine No. 666, front-facing locomotive face: headlight eye, cowcatcher teeth, smokestack, skeletal Conductor in the cab window. idle: steam puffs. atk [0] chest thrown open shovelling coal, [1] whistle scream + steam plume, [2] lurching forward, [3] wrecked/steaming | 1 | A6 |
| `boss_engine_run` | **2x2 grid of 512x320 frames** (sheet frame = 512x320, 4 frames), `1536x1024` 2x2 | side view charging right, wheels/pistons cycling, tender + 2 coal cars following, headlight beam; anchor bottom | 1 | A6 |
| `portrait_engine` | 512x512 | skeletal conductor leaning out of the fanged locomotive face | 1 | A6 |
| `boss_scratch_idle`, `boss_scratch_atk` | `1536x1024` 4x2 | Ol' Scratch human form: tall red-skinned gentleman, black velvet tuxedo, top hat with small horns, gold-tooth grin, cane, cards in hand. atk [0] card fan raised, [1] throwing, [2] arms wide (call/summon), [3] chip lobbed | 1 | A7 |
| `boss_scratch_true_idle`, `boss_scratch_true_atk` | `1536x1024` 4x2 | true form: tux burned off, huge horned goat-legged devil wreathed in hellfire, forked tail, glowing eyes. atk [0] hands clasped with fire, [1] casting hellfire, [2] roar arms wide, [3] contract raised | 1 | A7 |
| `portrait_scratch` | 512x512 | human form bust, top hat, gold tooth, one eyebrow raised, ember-lit; **wave-2 reference for all ending panels: approve early** | 1 | A7 |
Boss-sheet post: crop rows, `sprites.py strip --frames 4 --fw 320 --fh 320 --anchor bottom`; `boss_engine_run` `--fw 512 --fh 320`.

## 5. Variety (crossroads, events, hazards)
| Key | Format | Cells / frames | Art | Gen | Batch |
|---|---|---|---|---|---|
| `bg_crossroads` | *opaque* 1440x864 | 1 | dirt crossroads at night, blood-red sky, cracked moon, dead tree, signpost with all arrows pointing down, black table with candles top centre; leave the centre lane open | 1 | V1 |
| `npc_dealer` | strip 6f **160x160**, bottom | 0-3 idle sway (6 fps), 4 beckon with a finger, 5 head thrown back laughing | tall gaunt figure in black frock coat and top hat, pale face with a too-wide grin, goat-yellow eyes, fanning a deck of cards | 1 | V1 |
| `props_deals` | grid 4x2, 128x128 | `hellgate_a, hellgate_b, deal_table, signpost, candelabra, dead_tree, skull_pile, ledger_book` | hellgate = jagged fissure glowing red-orange (a/b two flicker states); deal_table = stone slab, burning candle, parchment contract under a quill | 1 | V1 |
| `props_events` | grid 4x2, **192x192** | `card_table, well, wagon_oil, confessional, grave_mound, grave_open, duel_post, altar_shrine` | card_table round felt table + lantern + grinning skeleton gambler; well mossy stone with rusted bucket; wagon_oil painted wagon of bottles with lanky salesman in striped vest; confessional wooden booth with candles and hooded silhouette; grave_mound/open fresh dirt with shovel / open pit with coffin corner; duel_post gallows-style post with brass bell and chalk boot-print; altar_shrine stacked skulls and candles | 1 | V1 |
| `icons_events` | grid 4x2, 96x96 | `bless_steady, bless_grace, bless_iron, bless_fleet, curse_debt, curse_dark, curse_rot, curse_lead` | round emblem icons: blessings gold-lit (hand on a gun, four-leaf clover, tin star, winged spur), curses red-lit (burning IOU note, closed eye, rotten skull, ball and chain) | 1 | V1 |
| `props_small` | grid 4x2, 96x96 | `potion_bottle, card_back, card_face, chip_stack, heart_container, wanted_poster, chalk_x, rock_chunk` | potion_bottle WHITE glass (code tints); card_face blank cream; heart_container gold-edged heart with a small key-lock; wanted_poster torn poster with a horned skull | 1 | V1 |
| `obst_hazards` | grid 4x2, 96x96, bottom | `quicksand, gravestone, spikes_ret_down, spikes_ret_warn, spikes_ret_up, powder_barrel, rubble, scorch` | neutral palette so floor tints work; quicksand = swirled sand pit with bubbles; scorch = black burnt ground decal with ash | 1 | V2 |
(No `fx_fire`: fire patches use `fx_hellfire`.)

## 6. Items
All 46 icons: 96x96 chunky collectable object, transparent, ink outline, top-left light, strong silhouette; **crossroads (deal) icons sit on a small scorched black disc with a hell-red rim glow**. Cell order and per-cell art = `ITEMS_V2.md` s4.6 table (do not reorder); generation `1536x1024` 4x2, `sprites.py grid --cols 4 --rows 2 --fw 96 --fh 96 --names <ids>`.
| Sheet | Cells (id order) | Batch |
|---|---|---|
| `items2_a` | forked_tongue, widows_bone, lightning_rod, blast_caps, wraith_rounds, lodestone, blue_norther, brand_iron | I1 |
| `items2_b` | gila_gland, holy_water, wanted_poster, bronco_boots, hand_mirror, black_cat_bone, blood_bandana, banker_ledger | I1 |
| `items2_c` | hush_money, rabbits_foot, dowsing_rod, bone_hound, tumbleweed_pal, little_coffin, saints_halo, lit_cigar | I1 |
| `items2_d` | nitro_jelly, short_cylinder, hellfire_round, carousel_slug, widowmaker, ten_gauge_hammer, pawn_ticket, dynamite_crate | I1 |
| `items2_e` | gideons_bible, cylinder_spin, lasso_rope, ouija_planchette, devils_own_colt, cylinder_of_sin, bloodletter, reapers_bargain | I1 |
| `items2_f` | gold_fever, brimstone_bandolier, lazarus_pact, pact_of_ashes, devils_dice, leech_contract, (2 empty) | I1 |
| `familiars_v2` | grid 4x2, **64x64**, anchor bottom: `bone_hound_a/b, tumble_pal_a/b, coffin_pal_a/b, halo_a/b` (tiny cute-macabre, 2-frame idle each, strong outline) | I2 |
| `fx_items` | grid 4x2, **128x128**, center: `fx_firepool` (top-down flame patch; UNUSED in code: FirePool draws `fx_hellfire`, keep the cell as fallback), `fx_holy_pillar` (gold-white vertical beam), `fx_shock_ring` (stomp ring with cracks), `fx_toxic_cloud` (green puff), `fx_dust_cloud` (tan puff), `fx_mark` (red crosshair X), `fx_ice_burst` (blue-white crystal burst), `fx_nova` (gold holy ring); translucent, ink-outlined, additive-friendly, no ground shadow | I2 |
| `projectiles_v2` | grid 4x2, 48x48, center, elongated point RIGHT: `bullet_bone`, `bullet_ghost` (pale green translucent slug), `bullet_cap` (red-orange cap slug), `bullet_orbit` (big brass slug with swirl), `bullet_ice`, `bullet_coin` (gold coin), `bullet_mirror` (silver shard), `bullet_child` (small brass splinter). Player shots keep a pale core + coloured glow: must stay distinct from enemy embers (red-orange ball) and venom (green blob) | I2 |
(No `ui_synergy_ribbon`: the SynergyToast draws a code ribbon.)

## 7. Meta and UI kit
| Key | Format | Cells / art | Gen | Batch |
|---|---|---|---|---|
| `meta_icons` | grid 4x2, 96x96 | `sermon_bible` (worn black bible, brass cross), `hunters_ledger` (open ledger with WANTED tag and rifle bullet), `gilded_pair` (two gold revolvers crossed over a coin), `star_tin`, `star_silver`, `star_gold` (chunky lawman stars, one hue each), `padlock` (iron), `rank_badge` (blank sheriff-star medallion for code tint) | 1 | C1 |
| `ach_cat` | grid 4x2, 96x96 | 8 round tin medals: `combat` (crossed revolvers), `boss` (skull), `ride` (boot spur), `skill` (bullseye), `economy` (coin stack), `relic` (chest), `rider` (hat), `secret` (question mark); locked = code grey tint | 1 | C1 |
| `ui_charselect_bg` | *opaque* 1440x960 | dim saloon back wall, pinned blank wanted posters, lantern glow, empty centre-lower area for cards | 1 | U1 |
| `ui_codex_bg` | *opaque* 1440x960 | leather-bound ledger open on a desk under candlelight, empty cream pages left and right, ribbon bookmarks, dark corners | 1 | U1 |
Code-drawn (no art): Bounty Board face (wood-grain rectangles + nails + `ui_parchment` scraps; `ui_board_bg` cut), mutator chips, Faith arc, Sanctified halo, WANTED mark, rank borders, toasts, synergy ribbon, hell chip, reels, dice pips, roulette tiles, contract seals, suit sigils, ward outline, lava-eel ripples.

## 8. Story, cutscene and title art (24 gens)
All `cutscene_*` panels: *opaque* WebP 1440x960 (`1536x1024` source), painted comic-panel composition, thick ink + cross-hatch, muted palette + ONE hot accent, dramatic camera, no lettering, bottom 220 px calm/dark for captions, 15 % margin around the focal subject (Ken-Burns crops). Refs (Image 2+) in brackets. Ending panels show the rider only as a back/three-quarter silhouette in a generic wide-brim hat.
| Key | Art (from STORY s6, condensed) | Refs | Batch |
|---|---|---|---|
| `cutscene_intro_1` | SEPIA: cramped cabin at night, one candle; Ada (young woman, dark braid, feverish) asleep in an iron bed, bucket of red-stained rags; Eli Marrow (deputy star, hat in hands) bowed at the bedside; dead tree in window | `portrait_player` | S1 |
| `cutscene_intro_2` | sepia + red: card table at a lonely crossroads under a hanging lantern; across from Eli only the Dealer's black-gloved hands fanning cards and a huge moon-white grin in the dark; a contract page glows red, quill with blood | `portrait_player` | S1 |
| `cutscene_intro_3` | sepia: cabin at dawn, empty iron bed, sheets thrown back, a queen of hearts on the pillow, open window; Eli in the doorway crushing his hat | `portrait_player` | S1 |
| `cutscene_intro_4` | sepia: gallows in a ghost-town square at dusk; Marshal Grimm tightens the noose on Eli, hat over Eli's eyes; faceless crowd, long shadows | `portrait_grimm`, `portrait_player` | S1 |
| `cutscene_intro_5` | sepia + ghost-green: night graveyard; the Undertaker pats down a shallow mound, cross with Eli's hat, unused coffin on a headstone, green lantern | `portrait_undertaker` | S1 |
| `cutscene_intro_6` | FULL COLOUR: Dry Gulch at dawn, blood-red sky; a grey hand bursts from the shallow mound gripping a revolver; cross with a note nailed, hat, buzzards; low angle | `portrait_player` | S1 |
| `cutscene_intro_7` | full colour: Eli (3/4 back, ashen, hat, red poncho) at the start of a long dirt road through mesas, a ghost town and a mine to a red glowing saloon on the horizon; epic wide | `portrait_player` | S2 |
| `cutscene_interlude_1` | still life on a rough table under one lantern: thick contract page (blank painted lines), cracked red wax seal, brass key, spectacles, burnt-down candle; warm gold in ink-black; right third calm for the overlay card | - | S2 |
| `cutscene_saloon_1` | small rider silhouette before the huge batwing doors of the Last Chance Saloon, doors = giant fanged jaws under a crimson sign-shape (no letters), red light and cigar smoke; twisted railway track runs into them and ends; night | - | S2 |
| `cutscene_end_a_1` | over the silhouetted rider's shoulder: Ol' Scratch slumped in his velvet chair at the poker table, tux scorched, gun-smoke, ichor, cards drifting up like moths, still grinning | `portrait_scratch` | W2 |
| `cutscene_end_a_2` | close on the table: the Ledger opening itself to a blank page, the empty velvet chair glowing, deck fanned, every card an ace of spades | - | W2 |
| `cutscene_end_a_3` | saloon interior from behind the big chair: far batwing doors open onto daylight; small figures (woman in black veil, file of hatted men, burning poster, drifting gold chips) walk out; dust motes | - | W2 |
| `cutscene_end_a_4` | the rider silhouette now in the chair, hat on the table, shuffling; the saloon (skeletons, ghosts, imps, piano man, slot machine) rises with raised glasses; red light | - | W3 |
| `cutscene_end_a_5` | Dry Gulch grave at dawn (mirror of intro_6): fresh shallow mound, cross, a new grey hand pushing up, buzzards, blood-red sky | `cutscene_intro_6` | W3 |
| `cutscene_end_true_1` | extreme close-up over the shoulder: revolver cylinder, five spent shells, one round glowing hot gold; blurred floating contract over green baize behind | - | W3 |
| `cutscene_end_true_2` | gold-white bullet punching through the floating contract, page tearing open with hellfire, letters flying like sparks; Scratch in true form mid-word, gold teeth open in horror | `portrait_scratch` | W3 |
| `cutscene_end_true_3` | Scratch unravelling into a storm of playing cards and smoke, velvet chair collapsing to ash, top hat rolling | `portrait_scratch` | W3 |
| `cutscene_end_true_4` | saloon roof ripped open, dawn pouring in, ledger pages burning in the air; translucent hatted silhouettes of the dead (skeletons, miners, townsfolk, scarecrow, coyotes, a hellhound on a leash) stream out through the broken doors | - | W3 |
| `cutscene_end_true_5` | county road at sunrise, brimstone turned to wildflowers; long column of freed dead walking east, among them a woman in a black veil lifting it; foreground hat silhouette tipping its hat | - | W4 |
| `cutscene_end_true_6` | crossroads at sunrise (mirror of intro_2): card table gone, wildflowers, signpost with four blank arrow-boards pointing up the road, a wide-brim hat on top, buzzards leaving, warm gold; no figures | `cutscene_intro_2` | W4 |
| `title_l0_sky` | *opaque* 1440x960: blood-red + bruise-purple dusk, cracked sun-moon low on the horizon, streaky ink clouds, faint stars; lower 30 % falls to dark; no ground | `title_bg` | U1 |
| `title_l1_town` | PNG alpha 1440x960: mid-ground silhouette band y 520-800: mesas, ghost-town roofs with steeple and water tower, the Last Chance Saloon glowing red far right; 5 lit amber windows | `title_bg` | U1 |
| `title_l2_fg` | PNG alpha 1440x960: foreground road edge along the bottom, dead cacti far left/right, wooden cross with hat (x~150), bent lamp-post with lit lantern (x~1290); centre-left (x 80-840, y 470-900) kept clear for the menu | - | U1 |
| `title_l3_rider` | PNG alpha 512x640: the gunslinger from behind three-quarters looking toward the town, poncho, hat, revolver hanging, red rim-light (`1024x1536` source, trim) | `portrait_player` | U1 |
Wave-2 batch assignment is in section 9. Consumed but generated elsewhere: `img_interlude_ch2` (A4).

## 9. ART BATCHES (each <= 6 generations = one agent job)

### Wave 1 (start immediately, all independent; 78 gens)
| Batch | Gens | Contents | Agent focus | Depends on |
|---|---|---|---|---|
| A1 | 6 | `bg_f4_a`, `bg_f4_b`, `bg_f4_c`, `bg_f4_boss`, `obst_f4`, `haz_f4` | F4 Brimstone Bluffs environment | - |
| A2 | 6 | `bg_f5_a`, `bg_f5_b`, `bg_f5_c`, `bg_f5_boss`, `obst_f5`, `haz_f5` | F5 Blood Rail environment | - |
| A3 | 5 | `bg_f6_a`, `bg_f6_b`, `bg_f6_c`, `bg_f6_boss`, `obst_f6` | F6 Last Chance Saloon environment | - |
| A4 | 5 | `haz_cart`, `prop_chandelier`, `fx_hellfire`, `projectiles_c2`, `img_interlude_ch2` | shared CH2 fx/props, interlude painting | - |
| A5 | 5 | pairs P-A1, P-A2, P-A3 (6 F4 enemies), `boss_toro` sheet, `portrait_toro` | F4 creatures + Toro | - |
| A6 | 6 | pairs P-B1, P-B2, P-B3 (6 F5 enemies), `boss_engine` sheet, `boss_engine_run`, `portrait_engine` | F5 creatures + Engine | - |
| A7 | 6 | pairs P-C1, P-C2, P-C3 (6 F6 enemies), `boss_scratch` sheet, `boss_scratch_true` sheet, `portrait_scratch` | F6 creatures + Scratch. **Generate + approve `portrait_scratch` FIRST** (unblocks W2-W4) | - |
| V1 | 6 | `bg_crossroads`, `npc_dealer`, `props_deals`, `props_events`, `icons_events`, `props_small` | crossroads/events kit | - |
| V2 | 4 | `obst_hazards`, mini pairs M-1, M-2, M-3 | hazards + 6 minis | - |
| C1 | 5 | `player_preacher_anchor`, `player_hunter_anchor`, `player_queen_anchor` (G0), `meta_icons`, `ach_cat` | rider design anchors + meta icons. **Anchors approved before W1/W2 start** | - |
| I1 | 6 | `items2_a` ... `items2_f` | item icons | - |
| I2 | 3 | `familiars_v2`, `fx_items`, `projectiles_v2` | item fx/familiars/player bullets | - |
| U1 | 6 | `ui_charselect_bg`, `ui_codex_bg`, `title_l0_sky`, `title_l1_town`, `title_l2_fg`, `title_l3_rider` | menu/title | - |
| S1 | 6 | `cutscene_intro_1` ... `cutscene_intro_6` | intro cutscene (sepia set, keep palette consistent) | - |
| S2 | 3 | `cutscene_intro_7`, `cutscene_interlude_1`, `cutscene_saloon_1` | story wave-1 remainder | - |

### Wave 2 (20 gens; starts as dependencies are approved)
| Batch | Gens | Contents | Depends on |
|---|---|---|---|
| W1 | 6 | Preacher G1, G2, G3 (`player_preacher_*`, `portrait_preacher`) + Hunter G1, G2, G3 | C1 (preacher + hunter anchors) |
| W2 | 6 | Queen G1, G2, G3 + `cutscene_end_a_1`, `_2`, `_3` | C1 (queen anchor), A7 (`portrait_scratch`), S1 (palette check only) |
| W3 | 6 | `cutscene_end_a_4`, `_5`, `cutscene_end_true_1` ... `_4` | A7 (`portrait_scratch`), S1 (`intro_6` ref for `end_a_5`) |
| W4 | 2 | `cutscene_end_true_5`, `_6` | S1 (`intro_2` ref for `end_true_6`) |
Reserve: 4 CH2 retries (pair splits, boss sheets) + up to ~28 more before the 130 cap; the batch agent spends them itself and logs each in `art/qa/<batch>.md`. Final QA pass (WORK_PLAN QA-2) may spend the remainder only on player-visible defects.

## 10. Reuse table (NO new art)
| Need | Reuse | Change |
|---|---|---|
| F4-F6 shop | `bg_shop` | tint per floor (F6 "Faro Bank" 0x5a1020); `peddler` stays |
| Treasure / secret / vault / supersecret (F4-F6) | `bg_treasure`, `bg_shop` | floor tint |
| Boss/treasure/shop doors F4-F6 | `doors` | per-floor tint; boss door glow red |
| Champion door | `doors` `door_boss_*` | gold-red tint + `props_small wanted_poster` pinned beside |
| Trapdoor (F3-F5 boss) | `props trapdoor_open` | tint 0x7a2a1a |
| `duelist` | `enemy_outlaw` | tint + duster overlay; friendly-neutral until draw |
| Event stampede bulls / herd | `enemy_coyote` / `enemy_hellsteer` | tint, scale 1.25 (herd 0xff7a3a) |
| Ghost carts / phantom express | `haz_cart` | tint 0x6fe0d0, alpha 0.8, additive |
| Fire patch (all sources, item FirePool) | `fx_hellfire` | `r/64` scale, tint by team |
| Jack-in-the-box | `dynamite_placed` | purple tint + smiley overlay |
| Lava eel ripples, contract seals, roulette, reels, dice pips, chips, cards on card cards | code | Graphics |
| Heart shatter (heart debt) | `hud_icons heart_full` | 6-shard burst |
| Little coffin bats / crow items | `enemy_bat`, `enemy_crow` | scale/tint |
| Chapter cards, ledger cards, credits backdrop | `title_l0_sky`, `portrait_*`, last ending panel | darken/tint |
| `intro_hell` | `cutscene_end_a_5`, `cutscene_intro_7` | tint |
| Toasts, WANTED card, rank frames | `ui_parchment` | scale/tint |
| Bounty Board | code | `ui_parchment` scraps on a wood rectangle |
| Cylinder HUD 3..8 slots | `hud_icons bullet_full/bullet_empty` | layout |
| Tumbleweed props on title | `enemy_tumbleweed`, `enemy_crow` | tint |

## 11. Cuts and renames vs designer docs
Cut: `ui_board_bg` (CHARACTERS_META E17), `ui_synergy_ribbon` (ITEMS s8), `fx_fire` (EVENTS s11; use `fx_hellfire`). Merged: 6 mini sheets -> 3 pair sheets (V2). Renamed: mini `bouncer` -> `head_bouncer` (sprite `enemy_head_bouncer`, title "THE HEAD BOUNCER - Last Call"; F6 enemy `bouncer` unchanged). `props_small wanted_poster` (cell) and item `wanted_poster` (in `items2_b`) are different namespaces on purpose.

## 12. Chapter 1 assets: regenerate/update list
**None mandatory (0 gens).** QA-only checks (run in QA-2, regenerate `-v2` only if it fails):
1. `bullet_enemy`, `bullet_venom`, `bullet_nail`, `bullet_ghostfire` outlines readable on `bg_f4_*` (orange) and `bg_f6_*` (crimson); if not, code adds a 1 px dark outline via a shared `bulletOutline` path (the setting already exists).
2. Returning enemies (`possessed` F4/F6, `skeleton` F5/F6, `ghost` F5) composited over F4-F6 backgrounds; fix by code rim/tint before art.
3. `player_*` poncho red vs `bg_f4_*` / `bg_f6_*`.
4. `doors`, `obst_f1-3`, `pickups`, `props`, `hud_icons`, `fx_*` unchanged.
Optional (only from spare headroom, low priority): `enemy_possessed` F4 fire-variant is a code tint (0xff8040); no art.

## 13. Manifest keys added by this file (for the loader/placeholder agents)
sprites: `player_{preacher,hunter,queen}_{walk_down,walk_up,walk_side,fire,roll,death}` (18), `enemy_*` x18 + x6 minis, `boss_{toro,engine,scratch,scratch_true}_{idle,atk}` (+ `boss_engine_run`), `obst_f4/f5/f6`, `haz_f4/f5/haz_cart`, `prop_chandelier`, `fx_hellfire`, `projectiles_c2`, `projectiles_v2`, `npc_dealer`, `props_deals`, `props_events`, `icons_events`, `props_small`, `obst_hazards`, `items2_a..f`, `familiars_v2`, `fx_items`, `meta_icons`, `ach_cat`; images: `bg_f4_*`, `bg_f5_*`, `bg_f6_*` (a,b,c,boss), `bg_crossroads`, `portrait_{preacher,hunter,queen,toro,engine,scratch}`, `img_interlude_ch2`, `ui_charselect_bg`, `ui_codex_bg`, `title_l0..l3`, `cutscene_*` (20). Every key is optional at runtime (`?noassets=1`, `?dropassets=N` must still boot every screen).
