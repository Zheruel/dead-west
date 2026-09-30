# QA-5 Spec audit (round 2)

Method: node static scripts (`tools/qa/spec5-*.mjs`) against pure-data registries, plus private-harness browser probes. Tables list only FAIL rows plus a pass count per section; every script is re-runnable. Severity: P1 missing/wrong feature, P2 number off, P3 polish. Area: E = engine+items, W = world+flow, M = meta+ui+story+audio, C = content.


### CHAPTER2: static (registries, floors, templates, economy)  (pass 63 / fail 6)

| item | expected | actual | result | sev | area | ref |
|---|---|---|---|---|---|---|
| FLOOR_GEN normals F4/F5/F6 (FIX-1: left as is, ARCH D11 decision, no gameplay harm) | [[7,8],[8,9],[9,10]] | [[7,8],[9,9],[9,10]] | FAIL | P3 | W | CHAPTER2 s2 (impl: F5 [9,9] core 11-12 per ARCH D11) |
| threat sum per template in tier budget (sum over waves) | all in range | f6_n08(T2)=8.5 | FAIL | P3 | C | CHAPTER2 s6 | FIXED by FIX-4 (f6_n08 wave 2 + waiter_imp = 10) |
| DOC-LITERAL budget is per wave: waves outside tier range | 0 | 91/94 waves | FAIL | P3 | C | CHAPTER2 s6 ("Budget per wave sum"); impl+headers use sum over waves |
| F6 roulette region width 3..5 (doc text; doc example is 9 wide) | 3x3..5x3 | f6_n03:3w f6_n06:5w f6_n09:9w f6_n11:5w f6_n12:9w f6_n13:9w | FAIL | P3 | C | CHAPTER2 s6 (doc self-contradiction: sample f6_n09 is 9 wide) |
| f5_boss spawn digit (6,1) | [[6,1]] | [[7,1]] | FAIL | P3 | C |  |
| f6_boss spawn digit (6,1) | [[6,1]] | [[6,2]] | FAIL | P3 | C |  |

### CHARACTERS_META: static (achievements, contracts, mutators, difficulty, ranks, gates, lore, riders)  (pass 145 / fail 0)

| item | expected | actual | result | sev | area | ref |
|---|---|---|---|---|---|---|
| (all 145 checks pass) | | | pass | | | |

### EVENTS_MINIBOSSES: static (variety, modifiers, affixes, boons, pacts, templates, minis)  (pass 102 / fail 1)

| item | expected | actual | result | sev | area | ref |
|---|---|---|---|---|---|---|
| champion_f3 wave motherlode, slot at col6 row2, rocks | motherlode/[6,2]/10,1,10,5,2,1,2,5 | {"1":["motherlode"]}/[[6,2]]/1,1,1,5,11,1,11,5 | FAIL | P3 | C | EVENTS s4.5 | FIXED by FIX-4 (rocks now at cols 2 / 10) |

### ASSET_SPEC_V2: manifest keys, frames, sizes (s1-s13)  (pass 229 / fail 2)

| item | expected | actual | result | sev | area | ref |
|---|---|---|---|---|---|---|
| sprite props_deals | 8f 128x128 grid center | 8f 128x128 grid bottom png 1024x128 | FAIL | P2 | content | ASSET s5 |
| sprite props_small | 8f 96x96 grid center | 8f 96x96 grid bottom png 768x96 | FAIL | P2 | content | ASSET s5 |

### AUDIO_SPEC_V2: s1-s9 keys, MIX, aliases, hooks, director  (pass 461 / fail 7)

| item | expected | actual | result | sev | area | ref |
|---|---|---|---|---|---|---|
| EVENT_SFX pocket:entered | hellgate_enter | MISSING | FAIL | P3 | audio | AUDIO s9 |
| EVENT_SFX synergy:activated | synergy_chime | MISSING | FAIL | P3 | audio | AUDIO s9 |
| EVENT_SFX meta:unlocked | item_get | MISSING | FAIL | P3 | audio | AUDIO s9 |
| EVENT_SFX meta:achievement | item_get | MISSING | FAIL | P3 | audio | AUDIO s9 |
| EVENT_SFX meta:rank | stamp_slam | MISSING | FAIL | P3 | audio | AUDIO s9 |
| EVENT_SFX secret:revealed | door_unlock | MISSING | FAIL | P3 | audio | AUDIO s9 |
| EVENT_SFX secret:hint | wall_knock | MISSING | FAIL | P3 | audio | AUDIO s9 |

### STORY_PRESENTATION: acceptance in browser (s18.1, s5.6)  (pass 43 / fail 0)

| item | expected | actual | result | sev | area | ref |
|---|---|---|---|---|---|---|
| (all 43 checks pass) | | | pass | | | |

### BOSSES: attack tables and phase thresholds (CH2 s3-5, EVENTS s4.3)  (pass 78 / fail 7)

| item | expected | actual | result | sev | area | ref |
|---|---|---|---|---|---|---|
| toro: fire-breath rear 0.7 s | 0.7 | 0.85 | FAIL | P3 | engine+items/content | CH2 s3 Toro |
| toro: breath warn wedge visible last 0.35 s | 0.35 | 0.5 | FAIL | P3 | engine+items/content | CH2 s3 Toro |
| toro: chained charge re-lock pause 0.5 s (P2 0.45) | 0.5 / 0.45 | 0.6 / 0.55 | FAIL | P3 | engine+items/content | CH2 s3 Toro |
| toro: charge lane 110 px wide, visible from 0.55 s of 0.8 s windup | 110 px / 0.25 s | body-width (~2*0.85*92+30) / 0.4 s | FAIL | P3 | engine+items/content | CH2 s3 Toro |
| toro: a wall crash on a non-final chained charge stuns (then skips the 2nd charge) | stun | only the last charge stuns (chain always completes) | FAIL | P3 | engine+items/content | CH2 s3 Toro |
| engine: ghost handcar bandits full HP + loot | normal | 0.6x hp, no loot (header note: tuning) | FAIL | P3 | engine+items/content | CH2 s4 Engine | loot FIXED by FIX-4 (drops normal loot now); 0.6x hp left (balance) |
| scratch: P2 royal_flush beams alternate direction beam-by-beam | alternating | two halves opposite (header note: alternating leaves no safe gap) | FAIL | P3 | engine+items/content | CH2 s5 Scratch |

### ITEMS_V2: 4.5 meta table, 4.3 deals, s5 synergies, s6 pools  (pass 480 / fail 0)

| item | expected | actual | result | sev | area | ref |
|---|---|---|---|---|---|---|
| (all 480 checks pass) | | | pass | | | |

### INTEGRATOR_NOTES: integrator-notes checklists + OPEN_STUBS re-verification  (pass 25 / fail 2)

| item | expected | actual | result | sev | area | ref |
|---|---|---|---|---|---|---|
| STUB DEEDS page size = 9 per page (CHARACTERS s Codex) | 9 | 10 | FAIL | P3 | M | CHARACTERS_META Codex DEEDS |
| STUB RELICS tab synergy sub-filter | sub-filter | none (synergies in detail sheet) | FAIL | P3 | M | CHARACTERS_META Codex RELICS |

## SUMMARY (QA-5)

Areas: E = engine+items, W = world+flow, M = meta+ui+story+audio, C = content.

### Pass/fail per doc

| doc / section | pass | fail | worst |
|---|---|---|---|
| CHAPTER2 static (registries, floors, templates, economy) | 63 | 6 | P3 |
| CHAPTER2 bosses (Toro, Engine, Scratch attack tables) + hazards (hazard-check, mod-check) | 78 + 52 + 22 | 7 (+1 perf timeout, env) | P3 |
| CHARACTERS_META static | 145 | 0 | - |
| EVENTS_MINIBOSSES static + 6 minis | 102 + 24 | 1 | P3 |
| ITEMS_V2 (46 items meta, 10 deals, 26 synergies, pools) + regress-items2 | 480 + 392 | 0 (2 warn) | - |
| ASSET_SPEC_V2 | 229 | 2 | P2 anchor (cosmetic) |
| AUDIO_SPEC_V2 (+ audio-coverage, regress-audio-v2) | 461 | 7 | P3 |
| STORY_PRESENTATION data + browser (+ story-lint 1585/0) | 566 + 43 | 8 | P1 |
| Integrator notes + OPEN_STUBS | 25 | 2 | P3 |

Totals (QA-5 scripts only): about 2,400 pass / 33 fail. P1 = 2 rows (one defect), P2 = about 5 rows, rest P3.

### Top defects

| # | id | sev | doc ref | area | note |
|---|---|---|---|---|---|
| 1 | peddler-speech-unwired | P1 | STORY s11.1 | M | **FIXED by FIX-2** (Shop.installPeddler: greeting / buy / deny / sold_out / leave). 24 peddler lines: no consumer of peddlerGreeting; shop peddler never speaks |
| 2 | event-npc-lines-unused | P2 | STORY s11.3 | W | 45 event NPC/closing lines; only 5 appear, rooms use EVENTS' own text; EVENT_LINES unreferenced |
| 3 | char-taglines-unused | P2 | STORY s6.3 | M | CHAR_TAGLINES not shown in char select |
| 4 | props-anchor | P2 | ASSET s5 | C | props_deals / props_small anchor bottom, spec center |
| 5 | potion-names-unused | P3 | STORY s11.3 | M | POTION_NAMES unreferenced |
| 6 | interlude-hold | P3 | STORY s6.2 | M | interlude overlay holds 2.6 s, doc 5 s |
| 7 | end-true-6-caption | P3 | STORY s6.6 | M | Preacher caption reworded ("last rites at the crossroads") |
| 8 | audio-event-sfx-owners | P3 | AUDIO s9 | M | 7 EVENT_SFX hooks (pocket:entered, synergy:activated, meta:unlocked/achievement/rank, secret:revealed/hint) handled by owners, not the hook table |
| 9 | audio-shoot-keys-unplayed | P3 | AUDIO s2 | E | **FIXED by FIX-2** (Player.fire per-rider key, Fx.arc shock_zap, Enemy.die freeze_shatter). shoot_scatter/rifle/twin, shock_zap, freeze_shatter defined but never played |
| 10 | deeds-page-size | P3 | CHARACTERS s Codex | M | DEEDS 10 per page, doc 9 |
| 11 | relics-synergy-filter | P3 | CHARACTERS s Codex | M | no synergy sub-filter on RELICS |
| 12 | floorgen-f5 | P3 | CHAPTER2 s2 (D11) | W | F5 normals [9,9] vs doc [8,9] (impl follows ARCH D11) |
| 13 | template-budget-literal | P3 | CHAPTER2 s6 | C | budget "per wave" contradicts "sum"; 91/94 waves outside tier range under literal reading; f6_n08 sum 8.5 |
| 14 | roulette-region | P3 | CHAPTER2 s6 | C | f6 roulette regions 9 wide in 3 templates; doc text says 3..5 (doc self-conflict) |
| 15 | boss-spawn-digits | P3 | CHAPTER2 s6 | C | f5_boss spawn (7,1), f6_boss (6,2), doc (6,1) |
| 16 | champion-f3-slot | P3 | EVENTS s4.5 | C | champion_f3 wave/slot/rocks differ from the table |
| 17 | toro-breath-timing | P3 | CHAPTER2 s3 | E | fire-breath rear 0.85 (0.7), warn wedge 0.5 (0.35) |
| 18 | toro-chain-pause | P3 | CHAPTER2 s3 | E | chained charge pause 0.6/0.55 (0.5/0.45); charge lane 0.4 s visible; non-final crash does not stun |
| 19 | engine-ghost-bandits | P3 | CHAPTER2 s4 | E | handcar bandits 0.6x hp, no loot |
| 20 | scratch-flush-p2 | P3 | CHAPTER2 s5 | E | P2 royal_flush beams are two opposed halves, not alternating; width 48 (doc open item) |
| 21 | story-intro-words | P3 | STORY s5 | M | Engine/Scratch intro lines 13/14 words (spec 12), story-lint warn |
| 22 | perf-mod-check | P3 | test env | - | mod-check perf step timed out under machine load (not a game fault) |
| 23 | fps-soak | P3 | OPEN_STUBS | - | >= 55 fps soak never measured by any agent (headless cannot) |
| 24 | pawn-ticket-doc | P3 | ITEMS s10.3 | doc | test text +22 vs implemented +25 (doc error) |
| 25 | audio-poly-doc | P3 | AUDIO s4.1 | doc | creature poly 2 vs group poly 4 (doc self-conflict) |

Not defects: every registry count (25 enemies, 9 bosses, 74 items, 26 tags, 26 synergies, 44+ achievements, 30 contracts, 15 mutators, 6 events, 8 affixes, 8 modifiers, 4 curses, 4 blessings, 5 pacts, 4 riders, 17 gates), revive order, cylinder 3..8, all 10 devil deal prices, all 46 item meta rows, all 26 synergy ids/kinds/reqs/cues, all hazard numbers (lava, vents, carts, steam, chandelier, roulette, fire, quicksand, spikes, grave) and all 8 modifiers match the docs.

### STORY_PRESENTATION: data vs doc text (s5-s14)  (pass 567 / fail 7)

| item | expected | actual | result | sev | area | ref |
|---|---|---|---|---|---|---|
| cutscene_end_true_6 caption [preacher] | The Chaplain read the last rites over the crossroads. / It was the first prayer the county ever earned. | The Chaplain read last rites at the crossroads. / It was the first prayer the county ever earned. | FAIL | P3 | story | s6.6 |
| interlude overlay hold 5 s (doc: typed 5 s) | 5 | 2.6 | FAIL | P3 | story | s6.2 |
| consumed by game code: peddlerGreeting | used in src/ | NOT REFERENCED outside data/story | FAIL | P1 | story | s11.1 peddler speech tags (24 lines) |
| consumed by game code: POTION_NAMES | used in src/ | NOT REFERENCED outside data/story | FAIL | P3 | story | s11.3 potion names | FIXED by FIX-4 (SnakeOil floating name after drinking) |
| consumed by game code: CHAR_TAGLINES | used in src/ | NOT REFERENCED outside data/story | FAIL | P2 | story | s6.3 char-select taglines |
| peddler lines present anywhere in game code (24) | 24 | 0 | FAIL | P1 | story | s11.1 |
| event NPC lines (s11.3) present in event room code | 45 | 5 | FAIL (FIXED by FIX-4: every controller speaks EVENT_LINES through events/common.js speak(); literals live in data/story so the grep cannot see them; tools/qa/fix4-events.mjs checks each key) | P2 | story | s11.3 |
