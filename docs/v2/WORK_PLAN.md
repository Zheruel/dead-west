# DEAD WEST v2 - Work Plan (Round 2)

Executable plan for the improvement round: turn the finished 3-floor game into a 6-floor, 4-rider, 74-item roguelike with events, devil deals, mini-bosses, meta-progression, story and polish. Companion docs: `ARCH_V2.md` (engineering, ids, events, ownership, schemas), `ASSET_SPEC_V2.md` (98 art generations in batches), `AUDIO_SPEC_V2.md` (audio keys, mix, director), and the five designer docs (each ends with "Integrator notes").

## 0. Summary, cuts, budgets

| Item | Value |
|---|---|
| New content | 3 floors (F4-F6), 18 enemies + `duelist` + 6 mini-bosses, 3 bosses, 45 room templates + ~20 special templates, 3 riders, 46 items, 26 synergies, 6 events, Crossroads, 8 elite affixes, 8 room modifiers, 44 achievements, 30 bounty contracts, 15 mutators, Codex, Notoriety, Hell on Earth, Daily Ride, 2 endings, ~24 story panels, title parallax, credits |
| Art | **98 generations** planned (39 CH2 + 16 riders/meta + 10 variety + 9 items + 24 story), ceiling 130 (about 32 spare for retries) |
| Audio | 92 new SFX keys (~45 real recordings, rest aliases), 17 music keys, 4 ambience beds |
| Agents | Art 19, Audio 4, Foundation 6, Feature 19, QA 5 + Fix 4 + 2 = 59 jobs, each sized 40-60 min |
| Cuts vs designer docs | `ui_board_bg` (code-drawn board), `ui_synergy_ribbon` (code ribbon), `fx_fire` (use `fx_hellfire`), 6 mini sheets -> 3 pair sheets; Codex stays at 6 tabs; no mandatory Chapter 1 art regeneration; no `Player.fire` audio per rider (optional P3 only); modifiers on F1-F6 kept; item FirePool = FirePatch; pair-sheet prompts shared |
| Reconciled conflicts | 18 decisions D1-D18 in `ARCH_V2.md` s0 (bouncer rename, fire, elites, events, gates, crossroads, revive, Jackpot, Hell invuln, checkpoint, floor counts, interlude, ending, music, daily, namespaces) |
| Definition of done | `npm run selftest`, `test:floorgen 300` (floors 1-6), `smoke`, `test:prod`, `?noassets=1`, `?dropassets=40` green; full-run bot reaches the F6 boss on 8 seeds with each rider; zero console errors; F1 -> final ending ~45-55 min for a skilled player; dist <= 70 MB, blocking boot <= 14 MB |

**No commits or pushes unless the user asks.** Deploy (GitHub Pages workflow `.github/workflows/pages.yml` on push to `main`, or the itch.io zip) is prepared in QA-7 and executed only on the user's explicit go-ahead.

## 1. Workflow order and dependency graph

```
WF-1 (all start together, no cross-dependency; code uses placeholders/stubs)
  ART-1  (14 agents, wave 1 = 78 gens)          AUDIO (4 agents)         FOUNDATION (6 agents)
WF-2 (starts when WF-1 pieces finish)
  ART-2  (4 agents, wave 2 = 20 gens)  needs: C1 anchors, A7 portrait_scratch, S1 panels
  FEATURE (19 agents)                   needs: FOUNDATION complete (not art/audio)
WF-3  MERGE (script, no agent): optimize_assets.py + build_manifest.py + measure_audio.py + mixLevels.js once, after ART-1/ART-2/AUDIO
WF-4  QA: QA-1..QA-5 (test only, in parallel) -> FIX-1..FIX-4 (by area) -> QA-6 (feel/balance) -> QA-7 (package, deploy prep)
```
Serial fallback order if parallelism is limited: FOUNDATION -> FEATURE -> ART-1 -> ART-2 -> AUDIO -> MERGE -> QA. Art and audio agents never run `build_manifest.py`/`optimize_assets.py` on the shared tree (they preview into a temp dir); MERGE runs them once so concurrent agents cannot clobber `manifest.json`.

### Agent contract (every code agent)
1. Read first: `docs/ARCHITECTURE.md`, `ARCH_V2.md` s0-s2 + your sections, the designer-doc sections named in your job, and the "Integrator notes" at the end of that doc. Ids/events/ownership in `ARCH_V2.md` win.
2. Edit only files you own (job's "Owns"). Need a change elsewhere: append a line to `docs/v2/INTEGRATION_REQUESTS.md` (`[from job] [to owner] [file] request`) and continue with a local shim; the owner reads it at start and end of their job.
3. Stub-first (ARCH s1.1): deliver importable stubs in the first 10 minutes.
4. Style: vanilla ES modules, 2-space indent, no new dependencies, no emojis in code/comments/UI, pooled objects, no per-frame allocation in hot paths, `bus.scoped`, all storage in try/catch, seeded RNG only (`subRng`), pure-data modules node-importable.
5. Every new asset key/audio key must degrade to a placeholder/alias (`?noassets=1` boots and plays).
6. Before finishing: `npm run selftest`, `npm run smoke`, your job's tests, `?noassets=1` boot. Fix your regressions. Final message = what is done, what is stubbed, open requests (short).
7. Sizes below are targets: if a job overruns, deliver the acceptance core and list the remainder as a FIX item.

## 2. ART workflow (details: `ASSET_SPEC_V2.md` s9)

Each art job = one agent, <= 6 generations, prompts saved to `art/prompts/<key>.txt`, raw kept in `art/raw/`, sliced with `tools/sprites.py`, outputs in `public/assets/{sprites,images}/`, review gate and log in `art/qa/<batch>.md`, contact sheets over the floor backgrounds. Image 1 = `art/style/style_c.png` always. Do not run `build_manifest.py`/`optimize_assets.py` (MERGE does).

| Job | Batch | Gens | Contents | Depends |
|---|---|---|---|---|
| AR-A1 | A1 | 6 | F4 bg x4, `obst_f4`, `haz_f4` | - |
| AR-A2 | A2 | 6 | F5 bg x4, `obst_f5`, `haz_f5` | - |
| AR-A3 | A3 | 5 | F6 bg x4, `obst_f6` | - |
| AR-A4 | A4 | 5 | `haz_cart`, `prop_chandelier`, `fx_hellfire`, `projectiles_c2`, `img_interlude_ch2` | - |
| AR-A5 | A5 | 5 | F4 enemy pairs x3, Toro sheet, `portrait_toro` | - |
| AR-A6 | A6 | 6 | F5 enemy pairs x3, Engine sheet, `boss_engine_run`, `portrait_engine` | - |
| AR-A7 | A7 | 6 | F6 enemy pairs x3, Scratch human + true sheets, `portrait_scratch` (FIRST) | - |
| AR-V1 | V1 | 6 | crossroads/events kit (`bg_crossroads`, `npc_dealer`, `props_deals`, `props_events`, `icons_events`, `props_small`) | - |
| AR-V2 | V2 | 4 | `obst_hazards`, 3 mini pair sheets | - |
| AR-C1 | C1 | 5 | 3 rider anchors, `meta_icons`, `ach_cat` | - |
| AR-I1 | I1 | 6 | `items2_a` ... `items2_f` | - |
| AR-I2 | I2 | 3 | `familiars_v2`, `fx_items`, `projectiles_v2` | - |
| AR-U1 | U1 | 6 | `ui_charselect_bg`, `ui_codex_bg`, 4 title layers | - |
| AR-S1 | S1 | 6 | `cutscene_intro_1..6` | - |
| AR-S2 | S2 | 3 | `cutscene_intro_7`, `cutscene_interlude_1`, `cutscene_saloon_1` | - |
| AR-W1 | W1 | 6 | Preacher + Hunter G1/G2/G3 | AR-C1 approved anchors |
| AR-W2 | W2 | 6 | Queen G1/G2/G3, `cutscene_end_a_1..3` | AR-C1, AR-A7 |
| AR-W3 | W3 | 6 | `cutscene_end_a_4,5`, `cutscene_end_true_1..4` | AR-A7, AR-S1 |
| AR-W4 | W4 | 2 | `cutscene_end_true_5,6` | AR-S1 |
(19 jobs: 15 wave-1 batches = 78 gens, 4 wave-2 batches = 20 gens; 98 total.)
Acceptance (each art job): frame counts/sizes exact per `ASSET_SPEC_V2.md`; every key has `.meta.json`/`.image.json`; preview attached; composite check over the relevant floor backgrounds; retries logged; the agent adds `art/prompts/*.txt`; total gens <= budget of the batch + 1 retry per asset.
Acceptance (MERGE step): manifest builds; `?noassets=1` and default both boot; `public/assets` size report <= 40 MB total (images WebP, sprites pngquant).

## 3. AUDIO workflow (details: `AUDIO_SPEC_V2.md`)

Each agent writes files to `public/assets/audio/{sfx,music}/`, its own `*.audio.json` (`sfx2a`, `sfx2b`, `music2a`, `music2b`) and `CREDITS_*` block; no `mix.js`/director edits (FE-A1 does that). Loops seamless, loudness within 1.5 dB of the MIX targets, source URL + license logged.
| Job | Contents | Size |
|---|---|---|
| AU-1 | `mus_floor4`, `mus_floor5`, `mus_floor6`, `mus_boss4`, `mus_boss5_a/b/c` (one loop re-tempo'd 118/132/148) | ~55 min |
| AU-2 | `mus_boss6_a/b/c/d`, `mus_interlude`, `mus_crossroads`, `mus_miniboss`, `mus_cutscene_intro`, `mus_ending_a`, `mus_ending_true`, `mus_credits`; `amb_lava`, `amb_rail`, `amb_saloon`, `amb_crossroads` | ~60 min |
| AU-3 | SFX chapter-2 world (s4.1: hazards, hell, rail, saloon; 34 keys, real files for the N rows) | ~50 min |
| AU-4 | SFX crossroads/events/minis/elites/hazards/story (s4.2-4.4) + P3 optional; N rows only | ~50 min |
Depends: none. Acceptance: files play in `regress-audio.mjs` (loads by key), `.audio.json` valid for `build_manifest.py`, credits complete, no clipping (peak <= -1 dBTP), each N-row key present or explicitly left to alias (list).

## 4. FOUNDATION workflow (6 agents, run in parallel; stub-first)

Read for all: `ARCH_V2.md` s0-s2, s15-16. Foundation ends when all six pass their acceptance and `npm run selftest && npm run test:floorgen 300 && npm run smoke` are green with floors 1-6 reachable via `?floor=N` using fallback templates, stub enemies and placeholder art.

### FN-1 Floors and flow (~60 min)
- **Owns**: `src/config.js`, `src/gen/{FloorGen,Variety,Templates,templateCheck,selftest}.*`, `src/rooms/RoomManager.js`, `src/scenes/{GameScene,finale,flow}.js`, `src/ui/Cards.js`, `src/core/{events,Debug}.js`, `src/bosses/{registry,index,MiniBoss}.js`, `src/enemies/{registry,index}.js`, stubs (`src/enemies/types/` x19, `src/bosses/types/` x3 + 6 minis), `tools/qa/enemy-check.mjs`.
- **Read**: CHAPTER2 s0-s3(hazard rules only), s5-s9, s12-s13; EVENTS s0-s1, s10, s12; STORY s5.2, s17 chain hooks; META C1/F; ARCH s6-s7, s15.
- **Do**: `MAX_FLOOR 6`, `FLOORS[4..6]`, `FLOOR_GEN[4..6]`, `INTERLUDE_AFTER`, `ROOM_TYPES`, `VARIETY`, `MODIFIERS` numbers, `ROOM_REWARD` ch2 overrides; FloorGen per-floor bounds + `Variety.js` post-pass (champion/event/supersecret/tells/secret variants/modifiers) with forked RNG; Templates `VALID`/`BLOCKING`/fields/kinds/validator + floor-3 fallback; `RoomManager.enterPocket/leavePocket/jump(at)`; `flow.js` (boss-defeat routing, interlude chain with fail-safe, saloon_arrival, `game:ending` + fallback `endRun('complete')`, `afterFloorIntro` checkpoint hook, Hell's Welcome); `finale.js` -> `playBanner`; `GameScene` call sites (run setup via `src/meta/runSetup.js` if present, `?floor=`, `?char`, `?mode`, music routing by `bossMeta`); registry rows + stub classes for all new enemy/boss/mini ids; `enemy-check.mjs`; events header; Debug API core (`setFloor`, `spawn`, `bossRoom`, `jump`, `musicKey`).
- **Acceptance**: `selftest` floors 1-6 pass; `test:floorgen 300` (room counts F4 10-11, F5 11-12, F6 12-13 core; exactly 1 champion per floor; events <= 1; supersecret only next to secret; determinism deep-equal); templates validate; `?floor=4|5|6` playable with stub enemies; F3 boss -> trapdoor -> interlude (placeholders) -> F4 works; killing `scratch` stub emits `game:ending` once and falls back to the complete poster; no console errors with `?noassets=1`.
- **Test**: `npm run selftest`, `test:floorgen`, `smoke`, `node tools/qa/enemy-check.mjs hellhound` (generic spawn/soak).
- **Depends**: none (imports FN-2..FN-6 stubs after minute 10).

### FN-2 Hazards and modifiers (~60 min)
- **Owns**: `src/rooms/hazards/**`, `src/systems/GroundHaz.js`, `src/rooms/special/modifiers/**`, `tools/qa/mod-check.mjs`, `tools/qa/hazard-check.mjs`.
- **Read**: CHAPTER2 s2-s5 hazard tables; EVENTS s6-s7; ARCH s8.
- **Do**: `FirePatch` + `Room.addFire` contract (D2), `LaneSweep` (cart/ghost/herd), lava tiles + spit + eel path (`lavaPath`), vents, steam jets, chandelier, roulette (code-drawn tiles), quicksand, retracting spikes, `Z` barrels, `G` gravestone ambush, `GroundHaz`; LightMask + 8 modifiers; `player.env` writes; all with placeholder drawing when art missing; `Hazards.build/update/dispose` and `Modifiers.*` exact signatures.
- **Acceptance**: `hazard-check` asserts: lava 1 unit/s and roll-across = 0, vent cycle 1.8/0.9/0.9, cart tell 1.0 s + 2 dmg, steam push 300 px/s, chandelier tell 1.2 s + 2 dmg, roulette 1.0 s tell + zap, fire cap 14, lanes stop on clear, quicksand sink 1.6 s, s-spikes cycle 2.8 s; `mod-check` (EVENTS s7.3): stampede telegraph >= 1.0 s, rockfall warn respected, darkness bullets above the mask, no texture leaks after 50 room enters/exits; 60 fps with LightMask.
- **Depends**: FN-6 wires call sites (delivers `Hazards.*` stubs at minute 10; tests run through a template with hazard tiles injected via `?debugTpl`).

### FN-3 Meta, save, characters (~60 min)
- **Owns**: `src/core/{Save,RunState,rng}.js`, `src/meta/**`, `src/data/{characters,difficulty,charBaseStats}.js`, `src/scenes/{MenuScene,EndScene,PauseScene,HUDScene,CharSelectScene,DailyScene,BoardScene,CodexScene}.js`, `src/ui/{OptionsPanel,AchievementToast,StatBars,TabBar,Silhouette}.js`, `src/items/defs/{sermon_bible,hunters_ledger,gilded_pair}.js`, `src/items/familiars/{FaithMeter,WantedMark}.js`, `tools/qa/meta-test.mjs`.
- **Read**: CHARACTERS_META (all), STORY s13.2 (deeds), ARCH s3-s5, s13.
- **Do**: Save v2 + migrate + checkpoint API; `RunState` fields (all docs); `subRng`/`dailySeed`; `Meta` engine + 44 achievements + 30 contracts + 17 gates + ranks + score + lore data (+ STORY deeds); characters, difficulty (`scene.diff`), mutators, daily; scenes (CharSelect, Daily, Board, Codex 6 tabs, Menu list, Notoriety chip, End ledger page, Options pages, toasts); `src/meta/runSetup.js` (`applyRunSetup(scene,data)`, `finishRun(scene,payload)`) for FN-1; character relics/familiars. All scenes work with `?noassets=1`.
- **Acceptance**: `meta-test.mjs` (CHARACTERS_META G.1-G.2, G.5, G.8-G.9 logic parts; every stat/event referenced exists; aliases resolve; migration fixtures; daily stability; rank boundaries); CharSelect all 4 cards with/without art; locked rider cannot start; Save export/import round-trip; localStorage disabled still plays.
- **Depends**: FN-4 exposes `player.snapshot/restore`, `Player.tryRevive`, `stats` seams; FN-1 wires `runSetup`. Uses stubs meanwhile.

### FN-4 Items engine (~60 min)
- **Owns**: `src/entities/{Player,Dynamite,Pedestal,Pickup,Chest,Shop}.js`, `src/systems/{Bullets,Explosions,Fx}.js`, `src/enemies/{Enemy,Grunt}.js`, `src/items/{registry,ItemSystem,hooks,tags,synergies,codexData,baseStats,index}.js`, `src/items/fx/**`, `src/items/familiars/Familiar.js`, the 28 existing `src/items/defs/*.js` (tags/tier/lore/rebalances), `src/ui/{Banner,Relics,Cylinder,ActiveSlot,Hearts,SynergyToast}.js`, `tools/qa/{items2-static,items2-lib,regress-items2}.mjs` (+ per-item plugin dir `tools/qa/items2/`).
- **Read**: ITEMS_V2 s0-s3, s5-s7, s9-s11; CHARACTERS_META A1-A4, F; CHAPTER2 s2 (ward, tags, bullets); EVENTS s5.5, s9; ARCH s5, s10.
- **Do**: registry fields + `gate`; PLAYER_BASE keys + clamps; `hooks.js` (17 hooks) + call sites; bullet pipeline/mods; statuses; `tags.js` + `synergies.js` (26) + toast + pause BUILD panel; `ItemSystem` roll rules, `wouldComplete`, `canPay/pay`, gate filter (D5), `subRng('item')` (D15); Player seams (ARCH s5: char, skin, tinPlating, dualGuns, Jackpot, tryRevive order D7, `heartDebt` alias, `env`, `snapshot/restore`, `hurtInvuln`, damage kinds); `Enemy` helpers (`wardT`, `scene.token`, `keepDistance` helper if absent, affix hook call sites, `enemy:died` payload, diff multipliers); Cylinder N slots; Pedestal tag chips/deal plate; the 28 old defs retagged + rebalance list (ITEMS 3.1); FirePool wrapper; runner with per-item plugin directory.
- **Acceptance**: `items2-static.mjs` (registry validity: 46 ids unique, tags in TAGS, gates valid, no old-item change beyond ITEMS 3.1, 26 synergies compile, pools non-empty); generic runtime test picks each registered new item (once FE agents land) - now with 3 sample defs written by FN-4 to prove hooks, statuses, synergies, cylinder 3..8; old 28 items still pass `regress-items.mjs`; `Player.snapshot/restore` round-trips; no per-frame allocation regressions (`stress-items.mjs`).
- **Depends**: none (Player is the first file to unblock others: land the seams in the first 30 min).

### FN-5 Run variety: elites, crossroads, boons (~50 min)
- **Owns**: `src/enemies/Affixes.js`, `src/systems/{Boons,Crossroads,CodexHooks}.js`, `src/rooms/special/CrossroadsRoom.js`, `src/entities/{HellGate,DealPedestal,Dealer,DealerSpeech}.js`, `src/data/dealerLines.js`, `tools/qa/{xroads-sim,elite-telegraph}.mjs`.
- **Read**: EVENTS s2, s5, s9, s12; STORY s11.2; ITEMS s2.5, s4.3; ARCH s9, s11.
- **Do**: 8 affixes with visuals (ring/tint/glyph/nameplate, code-drawn), `Affixes.roll/apply` with the D3 formula; gate roll + HellGate + pocket controller with L/C/R offers (D6), pacts, HoldRing signing, Dealer speech (exact category counts), heart debt fx; Boons (curses, blessings, `applyBoons`); CodexHooks (bus -> `Save.codexSeen`); NPC/altar fall back to placeholders.
- **Acceptance**: `xroads-sim` (20k boss kills: P(no gate over floors 1-5) < 3 %; pity works); scripted signing of L/C/R with heart debt, hp clamp, coin/key spend, curse list, `ace_in_hole` revive once; pocket enter/leave x50 no leaks; `elite-telegraph` (200 rooms/floor: rate within +-2 % of the formula, <= maxPerRoom, splitting never chains, swift keeps telegraphs >= 0.4 s); `?noassets=1`.
- **Depends**: FN-6 `Controller`/`HoldRing`, FN-1 `enterPocket` (stubs at minute 10); FN-4 `Enemy` call sites (contract in ARCH s9).

### FN-6 Rooms and controllers (~50 min)
- **Owns**: `src/rooms/{Room,Door}.js`, `src/rooms/special/{Controller,ChampionRoom,EventRoom,VaultRoom}.js`, `src/entities/{HoldRing,Trapdoor}.js`, `src/ui/Minimap.js`.
- **Read**: EVENTS s1, s3.1, s4.1-4.2, s7.2, s8.3; CHAPTER2 s2, s7; ARCH s7-s9.
- **Do**: `ROOM_TYPES` dispatch in `Room.build/buildContents`; `Controller` + `HoldRing`; champion/event/vault/secret-variant controller hosting (empty shells FE-V1/FE-M1 fill); tile types `L V = | T r k Q s Z G` in the tile loop (art keys with placeholder drawing) and calls to `Hazards.*`/`Modifiers.*`; `Room.planEncounter` affix call (D3) with RNG stream; `room:wave`; items hook call sites (`roomEnter/wave/roomClear`); `onMiniDefeated` reward table (+ `heart_container` pickup type support with FN-4); `onExplosion` -> fire; `onWallHit`; room-clear bonuses (elite/modifier); `buildWaves` extra-enemy (diff); door kind `champion`; Minimap icons/glyphs; ROOM_REWARD ch2 numbers in `clearRoom`; `reachableSpot` skips lava/Q; pocket room build for `crossroads`.
- **Acceptance**: every room type builds from a debug jump (`api.jump`) with placeholders; state persists across revisits (no duplicate rewards); minimap icons appear per rules; `regress-levels.mjs` timing assertions extended for new tiles; 300-seed floorgen unaffected.
- **Depends**: FN-2 (`Hazards`/`Modifiers` stubs), FN-1 (config/templates), FN-5 (`Affixes` stub).

Foundation exit checklist (integrator runs after the workflow): all Foundation tests + `npm run smoke` with `?floor=1..6` + `?char=` each rider + `?mode=hell` + `?noassets=1`; `INTEGRATION_REQUESTS.md` open items triaged into the Feature jobs.

## 5. FEATURE workflow (19 agents; start after Foundation, run in parallel; disjoint files)

Read for all: `ARCH_V2.md` s0-s2, the job's designer sections, `INTEGRATION_REQUESTS.md`. Each agent works against the Foundation's stubs and placeholder art; art/audio arriving later needs no code change.

### Enemies (6 agents; CHAPTER2 s3-s6, s13.2, s12)
Common acceptance: behaviour exactly per the numbered entry (windup, telegraph >= 0.3 s, damage, cooldowns, tokens), death/loot/hit-flash, elite-safe (`affixBan` per EVENTS 5.2), Hell multipliers respected via `diff`, cursed tint, `?noassets=1` + `?dropassets=40`, 60 s soak per pack via `node tools/qa/enemy-check.mjs <ids>` with no console errors and >= 55 fps, `regress-levels.mjs` still green. Owns: the three `src/enemies/types/<id>.js` files replacing stubs (plus tiny helper files under `src/enemies/parts/<jobid>/`). Size ~45 min each.
| Job | Enemies | Notes |
|---|---|---|
| FE-E1 | `hellhound`, `hellsteer`, `cinder_skull` | flame fan, charge with wall crash, suicide flyer token |
| FE-E2 | `magma_eel`, `sulfur_preacher`, `magma_golem` | eel via `Room.lavaPath`, Sulfur Ward (`wardT`), eruption band |
| FE-E3 | `handcar_bandit`, `signalman`, `steam_stoker` | lane-bound movement, `room.spawnLane` ghost carts, scald cloud |
| FE-E4 | `crate_mimic`, `rail_rat`, `chain_gang` | disguise sprite, pack flocking, linked bodies (`leader`) |
| FE-E5 | `card_shark`, `loaded_die`, `slot_fiend` | curved cards, die pips/chips, code-drawn reels |
| FE-E6 | `waiter_imp`, `bouncer` (F6 grunt), `joker` | bottle marker, frontal arc block, jack-in-the-box (Dynamite subclass, purple tint) |
Depends: Foundation.

### Bosses (3 agents; CHAPTER2 s3-s5, s12-s13.4; STORY 7.1-7.3 barks/cards data consumed via `BOSS_META`)
Owns `src/bosses/types/<id>.js` (+ `src/bosses/parts/<id>*.js`), `tools/qa/boss-<id>-bot.mjs` + lib. Follow `undertaker.js` conventions (`interrupt`, `takeHit` override, `damageMultiplier` windows, hazard list, `Boss.finishDeath`). Size ~60 min each. Acceptance: every attack/phase per doc with tells >= 0.5 s; phase change during any attack cancels cleanly (fuzz `boss.hp` at thresholds mid-attack); every phase reachable via `api`; no generator deadlock; bot win rate over 8 seeds (stock ch1 loot, god mode off) and median fight time within CHAPTER2 s13.4 (Toro 70-85 % / 55-95 s; Engine 60-80 % / 70-115 s; Scratch 40-60 % / 150-260 s); `?noassets=1`; reward flow per CHAPTER2 s7.
| Job | Boss | Special |
|---|---|---|
| FE-B1 | `toro` | charge/pillars/herd lanes (`LaneSweep herd`), hellfire leap, arena `f4_boss` |
| FE-B2 | `engine` | parked/passing/gone state machine, `boss_engine_run` swap, lane charges, derail stun, rail arena `f5_boss` |
| FE-B3 | `scratch` | `formKey` swap (human -> true), 4 phases, contract seals + reflective phase, roulette/chandelier attacks, death halt + `game:ending` (D13), Dead Man's Hand card slam data for the boss card |
Depends: Foundation; FE-T1/T2 provide the arena templates (agents may author a minimal `f{4,5,6}_boss` arena locally if the template is not yet there, FE-T* then overwrite).

### Mini-bosses and events (2 agents)
| Job | Scope | Owns | Acceptance |
|---|---|---|---|
| FE-M1 (~55 min) | 6 minis `ol_fury hangman motherlode ash_deacon stoker head_bouncer` (EVENTS s4.3-4.6, D1) | `src/bosses/types/<6>.js`, `tools/qa/mini-bot.mjs` | each beatable with base stats + roll in <= 70 s by `mini-bot`; first damaging frame >= 0.4 s after telegraph; phase change fires once; reward = chest + bonus; `mini:defeated` payload; `?noassets=1` |
| FE-V1 (~60 min) | 6 event controllers (`card_sharp wishing_well gravedigger preacher snake_oil quick_draw`), `duelist`, secret variants (`dead_mans_hand cache shrine`), tells (`crack knock chalk`), supersecret vault, curses/blessings feed (`Boons` from FN-5) | `src/rooms/special/events/*.js`, `SecretVariants.js`, `src/enemies/types/duelist.js`, `tools/qa/{events-sim,secret-check}.mjs` | `events-sim` probabilities within +-1.5 % over 20k rolls per table; scripted playthroughs per event; room re-entry restores state without duplicate rewards; secret checks (EVENTS 8.4); daily determinism of outcome rolls |
Depends: Foundation.

### Items (3 agents; ITEMS s4, s10; write `src/items/defs/<id>.js` + familiars + `tools/qa/items2/<id>.mjs` per-item assertions from ITEMS s10.3; use `gate:` per `ARCH_V2.md` s10.7, never `unlock:`)
Acceptance each: registry valid (`items2-static`), per-item test passes (behaviour numbers as ITEMS), banner text lengths (`name <= 22`, `desc <= 70`), tags/tier/pool/weight per ITEMS 4.5, codex `lore`, works with `?noassets=1`, no perf regressions (`stress-items.mjs`). Size ~50 min each.
| Job | Items |
|---|---|
| FE-I1 (15 passives) | forked_tongue, widows_bone, lightning_rod, blast_caps, wraith_rounds, lodestone, blue_norther, brand_iron, gila_gland, holy_water, wanted_poster, bronco_boots, hand_mirror, black_cat_bone, blood_bandana |
| FE-I2 (15 passives, 4 familiars) | banker_ledger, hush_money, rabbits_foot, dowsing_rod, bone_hound, tumbleweed_pal, little_coffin, saints_halo, lit_cigar, nitro_jelly, short_cylinder, hellfire_round, carousel_slug, widowmaker, ten_gauge_hammer |
| FE-I3 (6 actives + 10 deals) | pawn_ticket, dynamite_crate, gideons_bible, cylinder_spin, lasso_rope, ouija_planchette; devils_own_colt, cylinder_of_sin, bloodletter, reapers_bargain, gold_fever, brimstone_bandolier, lazarus_pact, pact_of_ashes, devils_dice, leech_contract |
Owns per job: its item files, familiars (`src/items/familiars/<BoneHound|TumbleweedPal|LittleCoffin|SaintsHalo>.js` to FE-I2), `tools/qa/items2/<ids>.mjs`. FE-I3 also validates all 10 deals through the Crossroads room (`api.enterCrossroads`) and the revive order (D7). Depends: Foundation.

### Templates (2 agents; CHAPTER2 s6, EVENTS s4.5/s6/s8; validator `templateCheck`)
Common acceptance: all templates validate (`npm run selftest`), quotas met, tiers 4/6/4 per floor, threat budgets per CHAPTER2 s6, floorgen 300 seeds still pass, every referenced enemy id registered (stubs suffice), a bot clears 3 random templates per floor without soft-lock. Size ~55 min each.
| Job | Owns | Scope |
|---|---|---|
| FE-T1 | `src/gen/templates/{floor4,floor5}.js`, edits in `floor1.js` `floor2.js` `floor3.js` (hazard conversions) | F4: 14 normal + `f4_boss` (quotas: >= 8 `L`, >= 4 `V`, >= 3 `lavaSpit`, `magma_eel` in 3); F5: 14 normal + `f5_boss` (>= 8 with `lanes`, >= 3 `T`, lane `handcar_bandit` in 3); Chapter-1 edits of EVENTS s6 (`Q` in f1_02/07/10/13/15, `s` in f1_05/09 f2_06 f3_15, `Z` in f1_04 f2_09 f2_13 f3_08, `graveAmbush` on f2_01/04/14/15, `modBias` on f3_06/11/14) |
| FE-T2 | `src/gen/templates/{floor6,special}.js`, new `champion.js`, `event.js`, `crossroads.js` (index registered in `templates/index.js`) | F6: 14 normal + `f6_boss` (>= 6 `chandelier`, >= 4 `roulette`, never both below tier 3); `champion_f1..f6` (EVENTS 4.5, `head_bouncer`); 6 `event_<id>`; `crossroads_a`; `vault_a`; `secret_hand/cache/shrine`; new Ch1 templates `f1_17 f1_18 f2_17 f3_17`; start/treasure/shop/secret `floors:[1..6]` |
Note: `templates/index.js` is owned by FE-T2; FE-T1 registers by exporting from its files and FE-T2 adds the import lines at the end (or FE-T1 appends its two lines via INTEGRATION_REQUESTS). Depends: Foundation.

### Story and presentation (2 agents; STORY_PRESENTATION)
| Job | Owns | Scope / acceptance |
|---|---|---|
| FE-S1 (~60 min) | `src/data/story/**` (`cutscenes text bosslines epitaphs dialogue tips bestiary lore lore_items`), `src/scenes/{CutsceneScene,CreditsScene,ending}.js`, `tools/qa/story-lint.mjs` | all text of STORY s4-s14 in data files; cutscene player s5.1 (typewriter, letterbox, skip, transitions, Ken-Burns, `?cutscene=`, `__game.story`); scripts 6.1-6.6 (intro, `intro_hell`, interlude overlay per rider, ledger cards, saloon_arrival, `end_a`, `end_true`); `runEnding` (picks ending, credits, `endRun('complete')`, flags, HELL unlock toast); true finale (Sixth Bullet, 6.6) hooking `flow.trueFinale`; `story-lint` passes (caption lengths, ids exist, dealer counts 4/6/5/3/4/3, `caption_if` covers 4 riders); every cutscene works with all images missing; never plays in daily/contract/CONTINUE |
| FE-S2 (~55 min) | `src/ui/{Cards,Transitions}.js`, `src/scenes/{BootScene,MenuScene(title layers),EndScene(strings)}.js` | chapter/floor cards (alt/hell subtitles, F4-F6 accents), boss/mini cards with typed lines + Scratch five-card slam, phase banners, death quips, room whispers, checkpoint toast, transitions (iris, ink splat, flash, slam), title 4-layer parallax with fallback to `title_bg` + progress tints + tumbleweed/crows, credits modal rows, loading tips from `tips.js` (`needs` filtering), death-screen epitaphs/causeOf (STORY s10); visual QA screenshots at 1x |
Depends: Foundation; FE-S2 depends on FE-S1 data files existing (start with the data schema stubs; FE-S1 lands `data/story/*` first, in its first 25 minutes).

### Audio integration (1 agent, ~50 min)
FE-A1 owns `src/core/{Audio,AudioDirector,AudioHooks,AudioAliases,AudioLoader,mix}.js`. Scope: `SFX_ALIAS` for all keys (AUDIO s7), `MUSIC_FALLBACK`, MIX rows, `EVENT_SFX` additions (s9), director rules (s6: floors 1-6, boss stems on `boss:phase`, champion/pocket/interlude/cutscene/menu routes, ambience, footsteps), lazy prefetch, `Debug.musicKey()` request to FN-1's block. Acceptance: AUDIO s10 integration list; works with an empty new-audio directory; `regress-audio.mjs` + `rb-music.mjs` pass. Depends: Foundation (events); AU-* files optional.

## 6. QA workflow

QA-1..QA-5 run in parallel after MERGE, test-only (they may add scripts under `tools/qa/`, never edit game code). Each returns a prioritized defect list (id, severity, repro, owner-by-area) to the harness. FIX-1..FIX-4 then apply fixes by area (any file in the area). QA-6 tunes numbers. QA-7 packages.

| Job | Scope | Acceptance / method | Size |
|---|---|---|---|
| QA-1 Bots F1-F3 + meta + regression | full-run bot `bot.mjs --seeds 1-8` per rider (4 x 8) to F3 boss and Chapter-1 regression (`spec-*`, `regress-*`, `fuzz-run`, `stress-*`); meta flows (unlock, save, checkpoint), CharSelect/Daily/Board/Codex click-through | zero console errors; no soft-lock; Chapter-1 regression suite green; Meta unlocks fire once; checkpoint continue identical state | 55 min |
| QA-2 Bots F4-F6 + bosses | bots to the F6 boss for 8 seeds (via `?floor=4` + full runs), `boss-toro/engine/scratch-bot` win rates + fight times, `stress-enemies.mjs 4\|5\|6`, encounter budget/clear-time and economy (`bot-report`: coins ~34/38/42 per floor F4/F5/F6), `xroads-sim`, `events-sim` | targets of CHAPTER2 s13 and EVENTS s14; typical clear F4-F6 30-36 min skilled; soaks 55+ fps | 60 min |
| QA-3 Visual review | screenshots at 1x of every new: room bg per floor (with obstacles + hazards + enemies + bullets), each enemy/boss/mini attack pose, hazards, event/crossroads/vault rooms, cards, cutscenes (all panels + captions), title layers, CharSelect/Codex/Board/Daily/End ledger, HUD (cylinder N slots, curse chips, toasts), Chapter-1 readability checks of ASSET_SPEC_V2 s12 | defect list with screenshots (`art/screens/v2/`); readability pass criteria (bullets/poncho on F4/F6, enemy tells); art regen requests limited to spare gens | 55 min |
| QA-4 Robustness | `?noassets=1`, `?dropassets=40`, storage disabled/full, corrupt saves + v1 migration fixtures, import/export, `fuzz-run.mjs` over 4 riders x normal/hell x 10 seeds, tab hide/resume, pause mid-cutscene, rapid retry x50 (leaks), 30-min soak (memory, fps), production build (`test:prod`), 4:3 and 16:10 window sizes | zero console errors; memory growth < 5 % over 30 min; every screen boots with no art | 55 min |
| QA-5 Spec audit | walk `ASSET_SPEC_V2` (every key present or placeholder), `AUDIO_SPEC_V2` (key/alias/mix row), all id lists in the designer docs vs registries (enemies 25, bosses 9, items 74, tags 26, synergies 26, achievements 44, contracts 30, mutators 15, events 6, affixes 8, modifiers 8, curses 4, blessings 4, pacts 5), each designer doc's acceptance/test section (CHAPTER2 s13, CHARACTERS G, ITEMS s10, EVENTS s14, STORY s18), `story-lint`, Integrator-notes checklist | audit table: item, expected, actual, pass/fail | 50 min |
| FIX-1 World/Rooms/Hazards | fixes for QA items in `src/gen`, `src/rooms`, `src/scenes/GameScene`, hazards, modifiers, templates | all listed defects closed, tests green | 55 min |
| FIX-2 Enemies/Bosses/Minis | fixes in `src/enemies`, `src/bosses`, elites | idem | 55 min |
| FIX-3 Items/Meta/Characters | fixes in `src/items`, `src/entities`, `src/meta`, scenes for meta/UI | idem | 55 min |
| FIX-4 Story/UI/Audio/Art integration | fixes in `src/data/story`, cutscenes, cards, title, audio, manifest/art placement, art-regen requests executed from spare gens | idem | 55 min |
| QA-6 Feel and balance | tune numbers only (config/data/defs): boss HP/time targets, enemy budgets, drop rates, shop prices, item tiers vs synergy strength, Hell/Daily fairness (fuzz bot: no un-dodgeable frame), difficulty curve F1..F6, mutator sanity; playtest-by-bot statistics tables; camera shake/hit-stop/juice review list | targets from CHAPTER2 s13.4/s7, ITEMS 1.2 (end-of-ch2 dps 3.5-5x base), full clear 45-55 min; balance table appended to `docs/STATUS.md` | 60 min |
| QA-7 Packaging and deploy prep | `npm run build`, `test:prod`, size budgets (dist <= 70 MB, blocking boot <= 14 MB, lazy lists), `npm run zip` (itch.io), README (controls, flags `?floor ?char ?mode ?daily ?cutscene ?unlockall`), `docs/STATUS.md` + `docs/ARCHITECTURE.md` (replace the "Round 2 (in progress)" pointer with the final file map), credits (art/audio attributions), version stamp; final regression run; deploy instructions for GitHub Pages (`pages.yml` on push to `main`) | build + zip produced; prod-check green; **no push/deploy without the user's explicit request** | 45 min |
Order: MERGE -> (QA-1..QA-5 parallel) -> (FIX-1..FIX-4 parallel) -> re-run failing QA scripts -> QA-6 -> QA-7.

## 7. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Shared-file collisions (Player/Room/GameScene) | single owners, stub-first, INTEGRATION_REQUESTS; Feature agents never touch Foundation-owned engine files |
| Art pair sheets fail slicing | regenerate as singles from the spare budget; `?noassets` fallback keeps game playable |
| Boss balance | bots + `noFloorScale` HP constants; QA-6 tunes numbers only |
| Elite/Hell/curse stacking too hard | cap 0.40 (D3); Hell `eliteMult` 1.6 reviewed in QA-6 |
| Load size | new art lazy-loaded; WebP for opaque images; QA-7 budgets |
| Foundation overrun | acceptance core first; the remainder becomes FIX items; Feature jobs work on stubs |
| Determinism (Daily) | `subRng` everywhere, `Meta.itemsOpen`, no `Math.random` in content; QA-4 daily test |
| Audio licensing | CC0/synthesis first; CC-BY logged with attribution block |
