# DEAD WEST v2 - Engineering Plan (ARCH_V2)

Integrator's plan for Round 2, on top of `docs/ARCHITECTURE.md`. The five designer docs (`CHAPTER2`, `CHARACTERS_META`, `ITEMS_V2`, `EVENTS_MINIBOSSES`, `STORY_PRESENTATION`) stay the source for numbers, rules and text; **this file wins on ids, event names, file ownership, schemas and every conflict**. Each designer doc has an "Integrator notes" section at its end listing the fixes that touch it. Art: `ASSET_SPEC_V2.md`. Audio: `AUDIO_SPEC_V2.md`. Jobs and order: `WORK_PLAN.md`.

Stack constraints unchanged: Phaser 3.90, vanilla ES modules, logical 1440x960, custom collision, no physics engine, everything auto-registered by `import.meta.glob`, every asset optional (`?noassets=1`, `?dropassets=N`), determinism through seeded RNG, `bus.scoped` for scene listeners, pooled objects, try/catch around all storage. Pure-data modules (`src/data/**`, `src/meta/*` predicates, `src/items/{tags,synergies}.js`, `src/gen/**`) must import in plain node so `tools/qa/*.mjs` can test them without a browser.

## 0. Reconciliation decisions (binding)

| # | Conflict | Decision |
|---|---|---|
| D1 | Mini-boss `bouncer` (EVENTS) vs F6 enemy `bouncer` (CHAPTER2) | Mini renamed **`head_bouncer`** (sprite `enemy_head_bouncer`, card "THE HEAD BOUNCER - Last Call"; STORY 7.4 keys re-keyed). F6 enemy keeps `bouncer` |
| D2 | Two fire systems (CHAPTER2 `FirePatch`, EVENTS `entities/FirePatch.js`, ITEMS `FirePool`) | ONE class `src/rooms/hazards/FirePatch.js`, API `Room.addFire(x, y, r, dur, {dmg = 1, team = 'enemy', dps})`; `Room.ignite(x, y, {r, life, count, spread})` = thin wrapper (EVENTS callers). Cap 14 per room (oldest culled). `team:'enemy'` hurts the player (1 unit per 1.0 s, i-frames apply, `explosionImmune` immune) and applies `burn` (dps 3, 2.5 s) to enemies without tag `fire` / affix `burning`; `team:'player'` (ITEMS FirePool) never hurts the player, applies burn + `dps` to enemies. Art: `fx_hellfire` only (`fx_fire` cut). `items/fx/FirePool.js` becomes a 10-line wrapper around `addFire(...,{team:'player'})` |
| D3 | Three elite systems (`cursed` 8 %, CHAPTER2 `cursedByFloor`, EVENTS affixes, ITEMS `curseHunted`, META `all_cursed`/Hell chance) | EVENTS `VARIETY.elite.chance` [.08 .10 .12 .14 .16 .18] authoritative; CHAPTER2 `cursedByFloor` dropped. Final chance = `min(0.40, base * diff.eliteMult * (curse_rot ? 2 : 1) * (1 + 1.5*curseHunted))`; Hell `eliteMult` 1.6. Mutator `all_cursed` forces affix `cursed` on every eligible spawn. `enemy:died` payload: `elite` (bool) + `affixes[]` (META's `elite: false|'cursed'|'champion'` is derived by Meta: `champion` = `mini:defeated`) |
| D4 | Bus event names differ across docs | Canonical = EVENTS names (section 2). Meta keeps an alias table: `crossroads:deal -> deal:signed`, `crossroads:refused -> deal:refused`, `event:resolved -> event:done`, `miniboss:defeated -> mini:defeated`; META condition strings are rewritten by `compileCond` through the alias table. `sign_here` = `E deal:signed{}` |
| D5 | Item unlock groups `ug_*` (ITEMS) vs `gate:*` (META) | `ug_*` dropped. Items use `gate: '<name>'` only (17 gates, section 10.7). `Save.itemUnlocked(id)` = `!def.gate || Meta.itemsOpen || Save.unlocked('gate:'+def.gate)`. `souls_sold` threshold 10 -> 5 deals |
| D6 | Crossroads location and pricing | Post-boss HellGate portal -> pocket room (EVENTS s2, boss floors 1-5). Tables: **L** = item at its native `deal.pay` (ITEMS s4.3); **C** = item with ALTERNATE payment (60 % a curse, 40 % 30 coins); **R** = a Pact. One drawback field `deal.pay`; `heartDebt` is the single heart-cost counter (`player.penalty.containers` is a getter alias). ITEMS "2 offers" rule superseded by 3 tables |
| D7 | Revive stacking (`black_cat_bone`, `ace_in_hole` pact, `lazarus_pact`) | One `Player.tryRevive(source)` in the `deathSave` path, order `[black_cat_bone, ace_in_hole, lazarus_pact]`, first available wins, one revive per lethal hit, hp 6 units (`ace_in_hole`) / 2 units (others as ITEMS 2.5) |
| D8 | Queen Jackpot vs `sixthMult` | Relic sets `stats.sixthMult = 1.6` and `jackpotPerCoin = 0.02`; effective Sixth multiplier = `sixthMult + jackpotPerCoin * coins` (items add to `sixthMult`). `jackpotBase` removed. Cylinder HUD draws `stats.sixthEvery` slots (3..8, default 6) |
| D9 | Hell invulnerability | `stats.hurtInvuln` base comes from `diff.hurtInvuln` (1.0 normal, 0.85 hell), items multiply; `roomEntryInvuln` 0.5 / 0.4 |
| D10 | Checkpoint | Lives in Save v2 (`checkpoint`, `chapterReached`) for Normal and Hell runs only; written by `Save.saveCheckpoint(run, player)` at the start of F4, F5, F6 after fade-in; restore through `Player.snapshot()/restore()` + `RunState.toJSON()/fromJSON()`; cleared on death, win, abandon, or load. Menu shows CONTINUE - FLOOR n |
| D11 | FloorGen room counts | Room bounds from `FLOOR_GEN[n]`, counting only core types (`start normal treasure shop boss`); `validateFloor` bound = `[core.min, core.max + 2]` with extras (champion, event, secret, supersecret) checked separately; `runSelfTest` floors 1-6 |
| D12 | Interlude assets | Keep BOTH `img_interlude_ch2` (CHAPTER2, typed lines) and `cutscene_interlude_1` (STORY, page-two panel): sequence = banner -> trapdoor -> black -> `img_interlude_ch2` card -> `cutscene_interlude_1` (+ rider overlay) -> F4 chapter card -> floor card |
| D13 | Ending hand-off | `runEnding(scene, payload)` in `src/scenes/ending.js`. `game:ending {ending:'devil_defeated'|'true', ...}`; `run:ended.variant` stays `death|complete|contract` and gains `ending: 'a'|'true'|null` |
| D14 | Undertaker music | Undertaker keeps `mus_boss_final`; `BOSS_META.<id>.music` decides for all bosses (`boss`, `boss_final`, `boss4`, `boss5`, `boss6`) |
| D15 | Daily determinism | All item rolls use `subRng('item', room.seed, slot)` (not `rng.game`), so seed-mates get identical pools; crossroads offers accepted to differ after different play (EVENTS s12) |
| D16 | Namespaces | Event room id `preacher` != rider `preacher`; room modifier `stampede`/`darkness` != mutators `stampede`/`lights_out`; item `wanted_poster` != prop cell `wanted_poster`. Ids are unique per registry, never across registries |
| D17 | Gunslinger art | Not regenerated; the three new riders are new sheets |
| D18 | Scope cuts | see `WORK_PLAN.md` s0 (Board face code-drawn, no synergy ribbon art, no `fx_fire`, minis paired) |

## 1. Ownership: who edits which file

Agents own **disjoint file sets** inside a workflow. A shared file has exactly ONE owner; other agents get its behaviour through contracts (section 2-14) that the owner wires. Never rewrite a file you do not own; if you need a change, add a note in `docs/v2/INTEGRATION_REQUESTS.md` (append-only; the owner reads it at the start and end of their job).

### 1.1 Foundation workflow (6 agents; details in WORK_PLAN)
| Agent | Owns (create/edit) |
|---|---|
| **FN-1 Floors & flow** | `src/config.js`, `src/gen/{FloorGen,Variety,Templates,templateCheck,selftest}.*` (framework only; NOT the content of new templates), `src/rooms/RoomManager.js`, `src/scenes/{GameScene,finale,flow}.js`, `src/ui/Cards.js` (chapter/floor card basics), `src/core/{events,Debug}.js`, `src/bosses/{registry,index}.js`, `src/enemies/{registry,index}.js`, stub files `src/enemies/types/<new 18 + duelist>.js`, `src/bosses/types/{toro,engine,scratch}.js`, `src/bosses/MiniBoss.js` + the 6 mini stubs in `src/bosses/types/` |
| **FN-6 Rooms & controllers** | `src/rooms/{Room,Door}.js`, `src/rooms/special/{Controller,ChampionRoom,EventRoom,VaultRoom}.js` (framework), `src/entities/{HoldRing,Trapdoor}.js`, `src/ui/Minimap.js` |
| **FN-2 Hazards** | `src/rooms/hazards/**` (FirePatch, LaneSweep, LavaField, Vents, SteamJets, Chandelier, Roulette, Quicksand, RetractSpikes, ExplosiveBarrel, GravestoneAmbush), `src/systems/GroundHaz.js`, `src/rooms/special/modifiers/**` (LightMask + 8 modifiers), nothing under `src/entities/` |
| **FN-3 Meta** | `src/core/{Save,RunState}.js`, `src/meta/**`, `src/data/{characters,difficulty}.js`, `src/data/charBaseStats.js`, `src/scenes/{MenuScene,EndScene,PauseScene,CharSelectScene,DailyScene,BoardScene,CodexScene}.js`, `src/ui/{OptionsPanel,AchievementToast,StatBars,TabBar,Silhouette,HUD widgets it adds}.js`, `src/scenes/HUDScene.js`, `src/items/defs/{sermon_bible,hunters_ledger,gilded_pair}.js`, `src/items/familiars/{FaithMeter,WantedMark}.js`, `src/core/rng.js` (subRng, dailySeed, initSeed) |
| **FN-4 Items engine** | `src/entities/{Player,Dynamite,Pedestal,Pickup,Chest,Shop}.js`, `src/systems/{Bullets,Explosions,Fx}.js`, `src/enemies/{Enemy,Grunt}.js`, `src/items/{registry,ItemSystem,hooks,tags,synergies,codexData,baseStats,index}.js`, `src/items/fx/**`, `src/items/familiars/{Familiar}.js`, edits to the 28 existing `src/items/defs/*.js` (tags/tier/lore/gate/rebalances), `src/ui/{Banner,Relics,Cylinder,ActiveSlot,Hearts,SynergyToast}.js`, `tools/qa/items2-static.mjs`, `regress-items2.mjs` |
| **FN-5 Variety** | `src/enemies/Affixes.js`, `src/systems/{Boons,Crossroads,CodexHooks}.js`, `src/rooms/special/CrossroadsRoom.js`, `src/entities/{HellGate,DealPedestal,Dealer,DealerSpeech}.js`, `src/data/dealerLines.js` (text from STORY 11.2) |
Rules: **stub-first.** In its first 10 minutes each owner creates the importable skeleton of its own contract files, so nobody blocks: FN-3 `src/core/rng.js` (`subRng(label, ...parts)`, `dailySeed`) and `src/data/charBaseStats.js` (`export const CHAR_BASE_V2 = {}`); FN-4 `src/items/baseStats.js` (`ITEM_BASE_V2`, `ITEM_CAPS`), `src/items/hooks.js` (`runHooks` no-op) and `tags.js`; FN-2 `src/rooms/hazards/index.js` (`Hazards.build/update/dispose` no-ops) and `src/rooms/special/modifiers/index.js` (`Modifiers.build/update/onClear/destroy` no-ops); FN-6 `src/rooms/special/Controller.js`, `HoldRing.js`; FN-5 `Affixes.js` (`roll` returns `[]`), `Crossroads.js` (`rollGate` returns false), `Boons.js` (no-ops), `CodexHooks.js`. FN-1 wires imports only after those exist (config.js composes `PLAYER_BASE = { ...V1, ...ITEM_BASE_V2, ...CHAR_BASE_V2 }`). The full new `PLAYER_BASE` key list is ITEMS 2.1 + CHARACTERS A1 (`tinPlating dualGuns markMult markBossMult coinDamage jackpotPerCoin jackpotKillCoins coinDropBonus damageTakenMin killHeal`).

### 1.2 Feature workflow (19 agents; details in WORK_PLAN)
| Agent | Owns |
|---|---|
| FE-E1..E6 (enemies) | `src/enemies/types/<their 3 ids>.js` (replace stubs) + `art/prompts` none + `tools/qa/stress-enemies.mjs` sections for their ids |
| FE-B1/B2/B3 (bosses) | `src/bosses/types/{toro|engine|scratch}.js` (+ `src/bosses/parts/<id>*.js`), `tools/qa/boss-<id>-bot.mjs`, `boss-<id>-lib.mjs` |
| FE-M1 (minis) | `src/bosses/types/{ol_fury,hangman,motherlode,ash_deacon,stoker,head_bouncer}.js`, `tools/qa/mini-bot.mjs` |
| FE-V1 (events, secrets) | `src/rooms/special/events/*.js`, `src/rooms/special/SecretVariants.js`, `src/enemies/types/duelist.js`, `tools/qa/{events-sim,secret-check}.mjs` |
| FE-I1/I2/I3 (items) | `src/items/defs/<their ids>.js`, `src/items/familiars/<their familiars>.js` |
| FE-T1/T2 (templates) | `src/gen/templates/*.js` (T1: floor4/5/6.js; T2: special.js + champion/event/secret/crossroads/vault + floor1-3 edits) |
| FE-S1 (story data + cutscenes) | `src/data/story/**`, `src/scenes/{CutsceneScene,CreditsScene,ending}.js`, `tools/qa/story-lint.mjs` |
| FE-S2 (presentation) | `src/ui/Cards.js` (extends), `src/scenes/{BootScene}.js`, `src/scenes/MenuScene.js` title layers only, `src/scenes/EndScene.js` strings only (via `data/story/*`), transitions helper `src/ui/Transitions.js` |
| FE-A1 (audio integration) | `src/core/{Audio,AudioDirector,AudioHooks,AudioAliases,AudioLoader,mix}.js` |
Within Feature, FE-S2 and FE-S1 do not both edit `MenuScene.js` or `EndScene.js`: FE-S2 is the only one.

## 2. Canonical bus events

`src/core/events.js` header lists all events (FN-1 writes this table into the header in its first commit). New/extended events (payloads are exact; emitters listed). Existing events unchanged.
| Event | Payload | Emitter | Main listeners |
|---|---|---|---|
| `run:started` | `{char, mode, seed, contract?, mutators[], daily?}` | GameScene | Meta, Audio |
| `run:ended` (ext) | `{variant:'death'|'complete'|'contract', ending, won, ...run}` | GameScene | Meta, EndScene, Audio |
| `game:ending` | `{ending:'devil_defeated'|'true', run, character, difficulty, seed}` | flow.js | ending.js |
| `story:cutscene` / `story:trueFinale` | `{id}` / `{}` | CutsceneScene / finale | Meta (lore) |
| `floor:changed` (ext) | `{floor, chapter}` | RoomManager | items hook `floor`, Audio, Meta |
| `room:wave` | `{room, enemies}` | Room | items hook `wave`, WantedMark |
| `enemy:died` (ext) | existing + `id, by:'bullet|sixth|deadeye|explosion|dot|familiar|other', elite:bool, affixes[], marked, info, st` | Enemy | Meta, items `kill` hook, Boons |
| `boss:defeated` (ext) | + `id, floor, fightTime, noHit` | Boss | Meta, flow.js, Crossroads (`rollGate`) |
| `boss:phase` | `{boss, id, phase}` | Boss | Audio stems, cards |
| `deal:signed` | `{offerId, kind, cost, itemId}` | CrossroadsRoom | Meta, Audio, Codex |
| `deal:refused` | `{offerId, reason}` | CrossroadsRoom | Audio |
| `deal:paid` | `{id, pay}` | ItemSystem/Crossroads | HUD, items hook |
| `gate:opened` | `{floor}` | Crossroads | Audio |
| `pocket:entered` / `pocket:left` | `{id}` | RoomManager | Audio, Minimap |
| `event:started` / `event:done` | `{id}` / `{id, outcome, net}` | events | Meta, Codex |
| `bet:result` | `{bet, outcome, payout}` | CardSharp | Audio |
| `mini:spawned` / `mini:defeated` | `{id}` / `{id, flawless, time}` | MiniBoss / Room | Meta, Audio |
| `elite:spawned` / `elite:killed` | `{enemy, affixes}` / `{id, affixes}` | Affixes | Audio, Meta |
| `curse:gained/removed`, `blessing:gained` | `{id}` | Boons | HUD, Meta |
| `player:revived` | `{source}` | Player | Audio, Meta |
| `synergy:activated/lost` | `{id, def}` / `{id}` | synergies.js | SynergyToast, Meta, Audio |
| `coins:changed` | `{coins}` | Player | items hook, Meta |
| `potion:drunk`, `hazard:hurt`, `modifier:entered/cleared` | see EVENTS s0 | Room/hazards | Audio, Meta, Codex |
| `secret:found/hint`, `supersecret:entered` | see EVENTS s0 | Room | Meta, Audio |
| `mark:collected`, `item:seen`, `chest:opened`, `key:used` | META B8 | WantedMark, Pedestal/Shop, Chest, Door | Meta |
| `meta:unlocked/achievement/rank`, `codex:discovered`, `bounty:completed`, `daily:finished` | META B8 | Meta | HUD toasts, Menu, Audio |
Removed/aliased (do not emit): `crossroads:deal`, `crossroads:refused`, `event:resolved`, `miniboss:defeated`, `curse:changed` (use `curse:gained/removed`).

## 3. Save v2, migration, checkpoint (FN-3; META B1 is the schema, plus:)
- Key `deadwest.save.v2`; v1 key left untouched. `src/meta/migrate.js` as META B1. `Save.get()` still returns the cached object; helpers `stat/max/flag/unlocked/grant/persistSoon/export/import/resetProgress/saveCheckpoint/loadCheckpoint/clearCheckpoint`.
- Additions to META's schema: `chapterReached (1|2)`, `checkpoint: null | {v:1, seed, floor, char, mode, items[], active:{id,charge}, hp, maxHp, tin, coins, keys, dyn, time, kills, curses[], blessings[], heartDebt, itemState{}, run:{...RunState.toJSON()}}`, `flags{introSeen, seen_<id>, ending_a, ending_true, lastEpitaph}`, `settings.synergyHints`, `codex.synergies{id:1}`, `codex.events/minis/affixes/mods/curses/blessings/secrets/potions{id:1}` (feeds from `CodexHooks`, FN-5).
- `repair()` drops unknown types and clamps; `Save.import` validates `v===2`. Corrupt/absent storage = in-memory fresh save, no throw. Debug/god/unlockall runs set `Meta.enabled=false`: no writes except settings.
- Checkpoint rules: written after F4/F5/F6 fade-in for `mode in {normal, hell}` only; floor layout regenerated from `seed + floor`; room states not saved; `CONTINUE - FLOOR n` on the menu; loading never replays cutscenes; `clearCheckpoint` on death/win/abandon/start-new-run. `Player.snapshot()/restore()` and `RunState.toJSON()/fromJSON()` are FN-4/FN-3 seams: FN-4 exposes `player.snapshot()` (items, active, hp, tin, coins, keys, dyn, curses, blessings, heartDebt, itemState) and `player.restore(snap)` in its first hour; FN-3 calls them.
- Deterministic content must not depend on the checkpoint (same seed + floor regenerates the same floor).

## 4. Meta engine (FN-3)
- `Meta` singleton subscribes to the bus once at Boot (never scene-scoped). Handlers wrapped in try/catch, log once. Cost < 0.2 ms/event via `byStat`/`byEvent` indexes.
- Data (pure): `achievements.js` (44 META + STORY 13.2 deeds appended; each `{id, cat, name, desc, hidden, cond, np, reward?}`), `bounties.js` (30 contracts `{id, tier, char, items[], mutators[], goal, reward}`), `unlocks.js` (chars 3, modes 2, gates 17, titles 9), `ranks.js` (11), `score.js`, `lore.js` (META D6 + STORY 13.1), `codexText.js` (imports `data/story/bestiary.js`).
- Condition grammar = META B3. `compileCond(str)` rewrites event names through the D4 alias table and returns `{stats:[...], events:[...], test(save, run, evt)}`; unknown stat/event names throw at build time in `meta-test.mjs` (not at runtime).
- Unlock write path: `Meta.grant(id, source)` -> `Save.unlocks[id]` -> emit `meta:unlocked`. Item gating in section 10.7. Char unlock: `char:preacher` (achievement `lawless`), `char:hunter` (`last_rites`), `char:queen` + `mode:hell` (`debt_paid`), `mode:daily` (`last_rites`).
- Codex state: enemies (`seen/kills`), items (0/1/2), bosses, minis, events, affixes, mods, curses, blessings, secrets, potions, synergies, lore, deeds. `CodexScene` keeps META D1's six tabs (BESTIARY, RELICS, OUTLAWS, LORE, DEEDS, RECORD); no seventh tab: minis appear under OUTLAWS, synergies as a sub-filter of RELICS (`items/codexData.synergyEntries`), and events/affixes/modifiers/curses/blessings/secrets/potions as a WORLD section at the end of LORE (silhouette until seen, one line each; text in `data/story/lore.js`).
- Bounty Board face is code-drawn (`BoardScene`): wood-grain `Graphics` rectangle, nails, `ui_parchment` scraps; no `ui_board_bg`.
- Notoriety: 11 ranks (META B9), cosmetic. Score formula in `score.js`.
- Daily: `dailyFor('YYYY-MM-DD')` pure; `initSeed(numeric)` accepts it; `run.daily` is set before `RoomManager.loadFloor(1)`; no `Math.random`/wall-clock in any content decision (audit list in EVENTS s12).

## 5. Character system (FN-3 data + relics, FN-4 Player seams)
- `src/data/characters.js`: `CHARACTERS[id] = {id, name, alias, tagline, stats{overrides of PLAYER_BASE}, start:{coins,keys,dynamite,tin,items[]}, flatDmgScale, marks, unlockCond, hint, tint, skin}`; `CHAR_ORDER`; `startStats(id)` pure (used by StatBars and tests).
- `Player` seams (FN-4 implements, exact): ctor `{char}`; `this.skin = char==='gunslinger' ? 'player' : 'player_'+char` with `Assets.has(skin+'_walk_down')` fallback to `player_*` + tint; `recomputeStats` starts from `{...PLAYER_BASE, ...CHARACTERS[id].stats, hurtInvuln: diff.hurtInvuln}` then items, `flatDmgScale`, mutators, curses/boons, clamps; start pickups from `CHARACTERS[id].start` (items given through `addItem`); `tinPlating` cap in `damage`; `dualGuns` muzzle alternate in `fire`; `coinDamage`, Sixth `sixthMult + jackpotPerCoin*coins`, `jackpotKillCoins`; skip roll when `hobbled`; `damageTakenMin`; `killHeal`. Relics are ordinary items (`charOnly`) using stats + hooks; `FaithMeter`/`WantedMark` are familiars (FN-3).
- Character choice never changes floor generation for a seed.
- Character select and scene keys: `CharSelect`, `Daily`, `Board`, `Codex`. `GameScene.init({char, mode, contract?, seed?})`.

## 6. Chapter/floor generalisation (FN-1)
- `config.js`: `MAX_FLOOR = 6`, `INTERLUDE_AFTER = 3`, `CHAPTER_OF = n => n <= 3 ? 1 : 2`, `FLOORS[4..6]` per CHAPTER2 s3-s5 (`name, subtitle, bgA, bgB, bgC, bgBoss, obst, music, ambience, hpMult, tint, boss, palette`), `FLOOR_GEN[4..6]`, `ROOM_TYPES`, `VARIETY`, `MODIFIERS`, `ENEMY_DEFAULTS.cursedChance` becomes derived from `VARIETY.elite`. Add `ROOM_REWARD` chapter-2 overrides (`pityRooms` 2 on F4-6, heart weights x1.25, nickel share .20).
- `FloorGen`: per-floor core bounds from `FLOOR_GEN[n]`; `bg` = `pick(['a','b','c'])` for `floor >= 4` (`bgC`); `Variety.js` post-pass (fork rng) places `champion`, `event`, `supersecret`, tells, secret variants, modifiers (EVENTS 1.3); `validateFloor` per D11; `runSelfTest` floors 1-6; determinism `generateFloor(f,seed)` deep-equal.
- `Templates.js`: `VALID` += `L V = | T r k Q s Z G`; `BLOCKING` += `G Z`; template fields `lanes[], chandelier, roulette, lavaSpit, graveAmbush, modBias{}`; kinds `champion event crossroads supersecret`; validator rules of CHAPTER2 s2 and EVENTS s1.3/s6; `Templates.pick(floor, kind, ...)`; **fallback**: if no template of a kind exists for floor n, use floor 3's set (so F4-6 are playable from the first Foundation commit).
- Floor flow (`src/scenes/flow.js`, called by GameScene): `onBossDefeated(boss)`: boss `mini` -> `Room.onMiniDefeated`; boss id from `BOSS_META`; floors 1-2: reward + trapdoor (+ `Crossroads.rollGate(floor)` on 1-5); floor 3: banner "CHAPTER I COMPLETE" then pedestal/heart/trapdoor; trapdoor -> `descend()`: if `floor === INTERLUDE_AFTER` -> interlude chain (D12) -> `loadFloor(4)`; F5 boss -> trapdoor -> `saloon_arrival` cutscene (Normal/Hell) -> F6; `boss.id==='scratch'` -> no reward -> `game:ending`. Until FE-S1 lands, missing cutscene scenes are skipped (fail-safe), `game:ending` falls back to `endRun('complete')`.
- `finale.js` refactored: `playBanner(scene, title, sub)` + `playFinale` (Sixth Bullet finale of STORY 6.6 is FE-S1; FN-1 only leaves the hook `flow.trueFinale(scene)`).
- Checkpoint call site: `flow.afterFloorIntro(scene)` -> `Save.saveCheckpoint(...)` on F4-F6.
- Music: `updateMusic` uses `bossMeta(tpl.boss).music` and `FLOORS[n].music`; AudioDirector generalised by FE-A1 (until then F4-6 map to `mus_floor3` through the existing clamp).
- Hell's Welcome: F4 start: heal 2 units, +2 dynamite (once), toast.
- `?floor=N` (1-6) start flag, `api.setFloor`, `api.spawn(id,x,y)` accepts every registered id.
- Stubs (FN-1): every new enemy/boss/mini id gets a registry row (`ENEMY_META`/`BOSS_META` from the CHAPTER2/EVENTS tables, including `tags`, `hp`, `r`, `weight`, `floors`, `threat`) and a stub class (`extends Grunt` / `Boss`/`MiniBoss` with one simple attack) so templates validate and floors 4-6 run before the real behaviour lands. Feature agents overwrite the stub file.

## 7. New room types and controllers (FN-6 framework, FN-1 gen/RoomManager; content FE-*, crossroads FN-5)
- `ROOM_TYPES` table (EVENTS 1.1). Room schema and door kinds per EVENTS 1.2; `floor.xroads` pocket def; `RoomManager.enterPocket()/leavePocket()`; `jump(id, dir, {at})`; `loadFloor` clears `states.xroads`.
- `Controller` base (`src/rooms/special/Controller.js`): `constructor(room, def, state)`, `build() / update(dt) / onEnter() / onCleared() / destroy()`; display objects via `room.track()`; persistent data ONLY in `state.event|ctl` (plain JSON). `Room.buildContents()` dispatches by `type`/`variant`/`mod`. `HoldRing` per EVENTS 1.4.
- Minimap: icons for `event` (amber `?`), `champion` (gold horned skull), `secret` (purple diamond), `supersecret` (diamond + gold dot), modifier glyph (EVENTS 7.2); pocket not shown.
- Champion rooms: FN-6 wires `Room.startEncounter -> startMini()`, `onMiniDefeated` (reward table EVENTS 4.2, `heart_container` pickup type, free gold chest); FE-M1 writes the minis.
- Event rooms: FN-6 wires the `event` type, dimmed bg, banner, `state.event`; FE-V1 writes the 6 controllers; `duelist` in FE-V1.

## 8. Hazards and room modifiers (FN-2)
Contracts consumed by `Room.js` (FN-6 wires these call sites): `Hazards.build(room)` (creates lava/vent/steam/rail/roulette objects from tiles + template fields, returns disposables), `Hazards.update(room, dt)` (only `mode==='combat'` for lanes/chandelier/roulette/lavaSpit; tile hazards always), `Hazards.dispose(room)`; `Room.addFire`; `Room.spawnLane({axis,index,dir,speed,kind,dmg,w,tell})`; `Room.lavaPath()` for `magma_eel`; `Modifiers.build(room)`, `update`, `onClear`, `destroy`. Numbers: CHAPTER2 s2-s5 and EVENTS s6-s7 (unchanged). `GroundHaz` (timed circle/line/tile hazard with `tell`, `active`, `dmg`, `onLand`) is extracted from `undertaker.js` behaviour and used by all new bosses and enemies; `undertaker.js` is NOT refactored in Round 2 (FN-2 copies the semantics). Player damage kinds `lava fire vent cart steam chandelier roulette card quicksand own_dynamite` are plain strings (cause-of-death text lives in `data/story/epitaphs.js`, FE-S2). Player environment hooks: `player.env = {speedMult:1, rollMult:1, push:{x,y}}` reset each frame (FN-4 provides, FN-2 writes: quicksand, steam, wind, lurch).
Perf caps (assert in QA): <= 14 fire patches, <= 60 enemy bullets, <= 4 lane bodies, <= 6 chandelier patches, `LightMask` one RenderTexture, no per-frame allocation.

## 9. Elite affixes (FN-5 logic, FN-4 wires Enemy.js, FN-6 wires Room.js)
- `src/enemies/Affixes.js`: registry `{id, w, floors:[a,b], hooks:{apply,onUpdate,onDamage,onDeath}}`; API `Affixes.roll(rng, {floor, def, enemyId, diff, curses, counts}) -> string[]`, `Affixes.apply(enemy)`, `Affixes.ban` via `ENEMY_META.affixBan`. Eight affixes per EVENTS 5.2.
- Contract for call sites: `Room.planEncounter` (FN-6) calls `Affixes.roll` with the stream `RNG(def.seed ^ 0xE11E)` (wave composition unchanged); wave records `{id,x,y,affixes[]}`; `Enemy` ctor reads `opts.affixes`; `Enemy.takeHit` calls `affix.onDamage` (returns multiplier; shield absorbs first); `Enemy.die` calls `onDeath` and includes `elite/affixes` in `enemy:died`; `Enemy.shoot` passes `owner: enemy` (vampiric). `cursed` legacy (`opts.cursed`) = `affixes:['cursed']`.
- Limits: `maxPerRoom` 2 (F1-3) / 3 (F4-6), >= 1 plain enemy per room; no elites on bosses, minis, `crow`, `tumbleweed_mini`, adds, `duelist`, `chain_gang` links (head only), `contract_seal`.
- Visuals: ring + tint + glyph + nameplate (EVENTS 5.3), all code-drawn.

## 10. Items engine, tags, synergies (FN-4; item content FE-I1..I3)
1. **Registry** fields (ITEMS 1.1) with two changes: `unlock` -> `gate` (D5); `deal.pay` per D6. `registerItem` validates tags against `TAGS`.
2. **Stats**: new `PLAYER_BASE` keys in `src/items/baseStats.js` (ITEMS 2.1) + clamps (ITEMS 1.3, `ITEM_CAPS` in the same file). `recomputeStats` order: base + character -> item `apply` (per copy) -> `applyLate` -> synergies -> boons (curses/blessings) -> mutators -> difficulty -> buffs -> clamps.
3. **Hooks**: `src/items/hooks.js runHooks(player, name, ctx)` with the 17 hooks of ITEMS 2.2; call sites owned by FN-4 (Player, Bullets, Enemy, Explosions, Room emits `room:wave`, FN-6). `Room.js` calls `runHooks(player,'roomEnter'|'wave'|'roomClear')` (FN-6 wires; FN-4 exports).
4. **Bullet pipeline** ITEMS 2.3 verbatim (cylinder `cyl`, `forceSixth`, kinds, mods, caps). New bullet frames via `projectiles_v2` / `projectiles_c2` sheets keyed by `frame`.
5. **Statuses**: `chill/frozen/mark`, `poison` stacks, `burn` per ITEMS 2.4, `ward` (`wardT`, CHAPTER2 s2), `marked` (META A3) share one `Enemy.statuses` map and one tint stack.
6. **Tags and synergies**: `tags.js` (26 tags + chips), `synergies.js` (26 rules `{id, kind:'pair'|'tag'|'capstone', req, name, desc, hooks/apply}`), recompute on item add/remove; `synergy:activated/lost`; `wouldComplete(id)` for pool bias; SynergyToast draws a code ribbon (no art).
7. **Gates** (D5, final map below; FN-3 adds the five extra gates `gulch perdition mine c2 sixth` to `unlocks.js`, with hint text such as "Beat El Cascabel", and wires their unlock conditions; the 12 META gates keep their META conditions).

| Gate | Items (new) | Unlock (META) |
|---|---|---|
| `gulch` | dowsing_rod, hush_money | beat El Cascabel |
| `perdition` | brand_iron, little_coffin | beat Marshal Grimm |
| `mine` | lodestone, gila_gland | beat The Undertaker |
| `c2` | saints_halo, widowmaker | reach floor 5 |
| `sixth` | hellfire_round, carousel_slug | 100 Sixth Bullet kills |
| `pyro` | dynamite_crate, nitro_jelly, blast_caps | achievement `fire_in_the_hole` |
| `holy` | gideons_bible | `amen` |
| `sniper` | wraith_rounds | `paid_in_full` |
| `gambler` | devils_dice | `all_in` |
| `occult` | ouija_planchette, lasso_rope | `wall_knocker` |
| `bloodpact` | cylinder_of_sin, bloodletter, lazarus_pact, brimstone_bandolier | `souls_sold` (5 deals) |
| `chaos` | pact_of_ashes | `combo_rider` |
| `ghost` | reapers_bargain | contract `bt_all_cursed` |
| `lawman` | hand_mirror | `contract_killer` |
| `undead` | black_cat_bone | contract `bt_glass_jaw` |
| `beast` | tumbleweed_pal | contract `bt_stampede` |
| `scrap` | widows_bone | contract `bt_rusty_iron` |
28 gated items; 18 new items are start-unlocked (forked_tongue, lightning_rod, blue_norther, holy_water, wanted_poster, bronco_boots, blood_bandana, banker_ledger, rabbits_foot, bone_hound, lit_cigar, short_cylinder, ten_gauge_hammer, pawn_ticket, cylinder_spin, devils_own_colt, gold_fever, leech_contract). The 28 original items are never gated. The `gate:` unlock hints are in META B2.
8. **Pools**: `ItemSystem.roll(pool, rng, {type, floor, fallback})` per ITEMS s6 with `gate` filtering and `subRng('item', roomSeed, slot)` (D15); crossroads uses `fallback:false`.
9. **Player.js single owner** (FN-4): all Player edits from ITEMS s9, CHARACTERS F and the seams in section 5 (`tryRevive`, `heartDebt`, `snapshot/restore`, `env`).

## 11. Devil deals, curses, blessings (FN-5)
- `Crossroads.rollGate(floor)` (`subRng('gate', floor)`, chance per EVENTS 2.1), HellGate entity, `RoomManager.enterPocket` (FN-1) calls `CrossroadsRoom` controller: offers L/C/R per D6 stored in `state.ctl.offers` (schema EVENTS 2.4); `DealPedestal` (HoldRing hold 0.9); Dealer entity (`npc_dealer`, `DealerSpeech`, lines from STORY 11.2 exact counts 4/6/5/3/4/3); pacts `glass_cannon devils_dollar iron_hide ace_in_hole absolution`.
- `Boons.js`: curses `curse_debt/dark/rot/lead`, `curseHunted` (item drawback), blessings `bless_*`; `applyBoons(player, stats)`; max 4 curses; `gainCurse(rng)`, `removeCurse()`, `gainBlessing(id)`; HUD chips (FN-4 `Relics`).
- Payment: `ItemSystem.canPay/pay` (FN-4) implement `deal.pay` including `container` via `heartDebt` (min 1 container, "NEED MORE BLOOD"), `coins`, `keys`, `tin`, `dynamite`.
- `CodexHooks.js`: bus -> `Save.codexSeen(kind,id)` (single place).

## 12. Cutscenes, title, cards (FE-S1, FE-S2)
- `CutsceneScene` data-driven per STORY 5.1 (`src/data/story/cutscenes.js` schema exact), `?cutscene=<id>` and `window.__game.story` API; cutscenes fire only on descent/ending transitions, never on CONTINUE, daily or contract; missing image keys render a vignette placeholder + caption; fail-safe timer.
- Ledger cards (text-only), chapter card, floor cards with alt/hell subtitles, boss/mini cards with typed lines, phase banners, transitions (iris, ink splatter, flash, slam), room whispers, credits, title 4-layer parallax with progress tints, loading tips: STORY s5-s14, all text in `src/data/story/*` (plain objects; `story-lint.mjs` enforces lengths).
- Flow contracts owned by FN-1 (`flow.js`): `flow.playCutscene(id, ctx, next)` (no-op fallback if `CutsceneScene` absent), `flow.trueFinale`, `game:ending`.
- `EndScene` (FN-3 wrote D3 summary; FE-S2 swaps strings via `data/story/text.js`, epitaphs, causeOf additions).

## 13. Difficulty, mutators, daily (FN-3)
- `src/data/difficulty.js`: `DIFFICULTY.normal|hell` (HP x1/1.3, boss HP x1/1.25, bullet speed x1/1.12, cooldowns x1/0.88, extra enemy 0/0.35, `eliteMult` 1/1.6, drops 0.40/0.32, `pityRooms` 3/5, heart downgrade 0/0.5, shop heart +1, `hurtInvuln` 1.0/0.85, `roomEntryInvuln` .5/.4, reward x1/1.5), `MUTATORS` (15, META B6), `DAILY_POOL`, `dailyFor`.
- Hooks (wired by the owners of the hooked files, FN-3 provides `scene.diff`, `scene.mutators`, helper `diff.mul(kind)`): `spawnEnemy` HP, `spawnBoss` HP, `Bullets.enemy.fire` speed, Enemy/Boss timers (`Enemy.ai` scaling helper, FN-4), `Room.buildWaves` extra enemy and drops (FN-6), `Shop` heart price (FN-4), `Player` (FN-4), HUD chips (FN-3).
- Contracts and Daily: `Meta.itemsOpen=true`, no cutscenes, no checkpoint, marks/achievements per META B3.

## 14. Audio (FE-A1; see AUDIO_SPEC_V2.md)
`AudioDirector` data-driven (`FLOORS[n].music/ambience`, `BOSS_META.music` + stems by `boss:phase`, champion, pocket, interlude), `EVENT_SFX` rows, `AudioAliases.js` fallback layer, MIX rows. Until FE-A1 lands the game plays with existing tracks.

## 15. Debug, QA hooks and new scripts
- `Debug` API (FN-1 owns file; each foundation agent adds its methods in a clearly delimited block through INTEGRATION_REQUESTS): `setFloor(1..6)`, `spawn(id,x,y,{affixes})`, `bossRoom()`, `openGate()`, `enterCrossroads()`, `jump(id)`, `spawnMini(id)`, `setEvent(id)`, `giveCurse(id)`, `giveItems(ids)`, `tags()`, `synergies()`, `setHp(n)`, `setCoins(n)`, `rollPool(pool,n,floor)`, `musicKey()`, `state()` extended, `unlock(id)`, `setChar(id)`, `daily(date)`. URL flags: `?floor=N`, `?char=<id>`, `?mode=normal|hell`, `?daily=YYYY-MM-DD`, `?unlockall=1`, `?cutscene=<id>`, `?debug=1` (Meta off).
- New QA scripts (owners in brackets): `meta-test.mjs` [FN-3], `items2-static.mjs`, `regress-items2.mjs` [FN-4], `events-sim.mjs`, `secret-check.mjs` [FE-V1], `xroads-sim.mjs`, `elite-telegraph.mjs` [FN-5], `mod-check.mjs` [FN-2], `mini-bot.mjs` [FE-M1], `boss-toro-bot.mjs`, `boss-engine-bot.mjs`, `boss-scratch-bot.mjs` [FE-B*], `story-lint.mjs` [FE-S1], `template-check` extended [FN-1, FE-T*]; existing `selftest`, `test:floorgen 300`, `smoke`, `test:prod` stay green at every job end.

## 16. Budgets and fallbacks
60 fps target with 10 enemies + 60 enemy bullets + 120 player bullets; boot load <= 14 MB blocking (new art loads lazily where possible: `bg_f4..f6_*`, `cutscene_*`, `title_*`, `portrait_*` and `ui_*_bg` are loaded on demand via `Assets` lazy list, not in the blocking boot); `dist` total <= 70 MB. Every new asset key has a placeholder; every new audio key has an alias. No feature may block a gameplay frame on storage or on a missing module.
