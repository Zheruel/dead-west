# DEAD WEST v2 — RUN VARIETY (Crossroads, Events, Mini-bosses, Elites, Hazards, Modifiers, Secrets)

Owner doc for: devil-deal rooms, event rooms, champion (mini-boss) rooms, elite affixes, Chapter-1 hazards, room modifiers, secret variants, RNG rules for the daily seed.
Sibling docs (do not duplicate): `CHAPTER2.md` (floors 4-6, bosses, enemies, floor palettes/hpMult), items doc (the `crossroads` item pool, 10 items), meta doc (Save v2, unlocks, achievements, codex UI, daily seed derivation, difficulty modes).
Floor themes used here: F1 Dry Gulch, F2 Perdition, F3 Sundown Mine, F4 Brimstone Bluffs, F5 Blood Rail, F6 Last Chance Saloon. Boss floors 1-5 can grant a Crossroads gate; F6 boss is the final boss.

## 0. Conventions and shared rules
- All ids are snake_case and unique. New ids owned by this doc: rooms `crossroads event champion supersecret`; events `card_sharp wishing_well gravedigger preacher snake_oil quick_draw`; minis `ol_fury hangman motherlode ash_deacon stoker bouncer`; enemy `duelist`; affixes `armored swift volatile vampiric splitting shielded burning cursed`; modifiers `dust_storm darkness stampede blood_moon fog rockfall hellfire lurch`; curses `curse_debt curse_dark curse_rot curse_lead`; blessings `bless_steady bless_grace bless_iron bless_fleet`; pacts `glass_cannon devils_dollar iron_hide ace_in_hole absolution`; potions `p_heal p_vigor p_swift p_venom p_laudanum p_kerosene`.
- Every tunable lives in one new object `VARIETY` in `src/config.js` (values below are the defaults; difficulty modes scale `VARIETY.*.chanceMult` / `hpMult`). No magic numbers in code.
- Telegraph rule (unchanged from v1): every damaging attack of anything new has a >= 0.4 s visible telegraph (`fx.warnCircle/warnLine`, windup pose, sfx). Room entry invuln 0.5 s stays. New hazards never deal > 1 unit per hit except where marked heavy (2).
- Determinism: outcomes never use `Math.random`. Use `subRng(...)` (section 12). Visual-only particles may use `Math.random`.
- Everything must run with missing art: placeholders come from `Assets` (`?noassets=1` must still play every event, deal, mini-boss).
- New events on the bus (add to the header of `core/events.js` and `AudioHooks.EVENT_SFX`): `deal:signed {offerId, kind, cost, itemId}`, `deal:refused {offerId, reason}`, `gate:opened {floor}`, `pocket:entered {id}`, `pocket:left {id}`, `event:started {id}`, `event:done {id, outcome, net}`, `bet:result {bet, outcome, payout}`, `mini:spawned {id}`, `mini:defeated {id, flawless, time}`, `elite:spawned {enemy, affixes}`, `elite:killed {id, affixes}`, `curse:gained {id}`, `curse:removed {id}`, `blessing:gained {id}`, `potion:drunk {color, effect}`, `hazard:hurt {type}`, `modifier:entered {id}`, `modifier:cleared {id}`, `secret:found {variant}`, `secret:hint {tell}`, `supersecret:entered {}`.
- Codex feed (meta doc renders it): `Save.codexSeen(kind, id)` with kind in `events|minis|affixes|mods|curses|blessings|secrets|potions`; called from the bus events above (one place: `src/systems/CodexHooks.js`).
- RunState additions (per run, reset in `RunState` ctor): `deals[]`, `curses[]`, `blessings[]`, `gateMisses`, `gateOpened[]`, `potionKnown{}`, `eventsSeen[]`, `elitesKilled`, `minisKilled[]`, `bossHitsTaken` (per boss room, reset on boss room entry), `flawlessDuel`.

### 0.1 Consolidated tunables (`VARIETY`)
| key | value |
|---|---|
| `xroads.baseChance` | 0.30 (+0.30 flawless boss fight, +0.10 per curse owned, cap 0.70; two missed boss floors in a row => 1.0) |
| `xroads.floors` | 1-5 |
| `event.chance` | F1 0.40, F2 0.55, F3 0.55, F4 0.55, F5 0.55, F6 0.40 (max 1 event room per floor) |
| `champion.chance` | 1.0 on all 6 floors (guaranteed, FloorGen rejects layouts that cannot place it) |
| `elite.chance` | F1 0.08, F2 0.10, F3 0.12, F4 0.14, F5 0.16, F6 0.18 per spawned wave enemy; `maxPerRoom` 2 (F1-3) / 3 (F4-6); `secondAffix` 0.25 on F5-6 |
| `mod.chance` | per eligible normal room: F1 0.10, F2 0.14, F3 0.18, F4 0.22, F5 0.24, F6 0.24; `maxPerFloor` 2 (F1-2) / 3 (F3-6); min `dist` 2 |
| `supersecret.chance` | F1 0, F2 0.15, F3 0.15, F4 0.20, F5 0.20, F6 0 |
| `secret.variantWeights` | stash 40, dead_mans_hand 25, cache 20, shrine 15 |
| `secret.brittleChance` | 0.30 (crack tell, 12 bullet hits open it) |

## 1. Framework: room types, floor gen, room controllers
### 1.1 Room-type registration (new table `ROOM_TYPES` in `src/config.js`)
| type | on grid? | door kind | bg key | template kind | minimap | music | cleared at entry? |
|---|---|---|---|---|---|---|---|
| `crossroads` | NO (pocket room, section 2.2) | none (portal) | `bg_crossroads` | `crossroads` | not shown | `mus_crossroads` | yes |
| `event` | yes, leaf off a `normal` room | `normal` | floor bg `bgB` (dimmed 0xd8ccc0) | `event` (6 templates) | amber `?` | floor music, no lock | yes (fights are started by the event) |
| `champion` | yes, leaf off a `normal` room | `champion` (boss door frames tinted 0xe0a040, no key) | floor `bgBoss` tinted 0xc8a890 | `champion` (`champion_f1`..`champion_f6`) | gold horned skull | `mus_miniboss` when the fight starts | no (locks on entry like a combat room) |
| `supersecret` | yes, cell adjacent ONLY to the secret room | `secret` (+ `super:true`) | `bg_treasure` tinted 0x9a80c0 | `supersecret` (`vault_a`) | purple diamond + gold dot, only once revealed | floor music | yes |
| `secret` (existing) | yes | `secret` | as now | `secret` + `variant` | icon CHANGED from purple `?` to a purple outlined diamond (the `?` now belongs to events) | — | yes |
Existing types keep behaviour. `Room.build()` background and `Room.buildContents()` dispatch through `ROOM_TYPES[type]`.

### 1.2 Room and floor data (extends FloorGen output)
```
Room = { id, gx, gy, type, dist, template, bg, seed, doors,
         mod?: 'dust_storm'|..., event?: 'card_sharp'|..., variant?: 'stash'|'dead_mans_hand'|'cache'|'shrine',
         mini?: 'ol_fury'|... }
door = { to, kind: 'normal'|'treasure'|'boss'|'secret'|'champion', locked?, revealed?, tell?: 'crack'|'knock'|'chalk', brittle?: true, super?: true }
Floor = { ..., championId, eventId|null, superSecretId|null,
          xroads: null | { def, opened:boolean } }        // pocket room definition lives here, never in floor.rooms
```
### 1.3 FloorGen changes (`src/gen/FloorGen.js`, new post-pass file `src/gen/Variety.js`)
1. In `tryGenerate`, after treasure/shop placement and BEFORE the secret: `const vr = rng.fork('variety')` (fork does not consume the base stream). `place(type, ctx, r = rng)` accepts a rng. Place `champion` (mandatory: `if(!champion) return null`), then `event` if `vr.chance(event.chance)`. Parent must be `normal`, `dist <= boss.dist`, distance from start >= 2 for the champion. Doors: `champion` kind gets `kind:'champion'` on both sides (not locked). Templates: `Templates.pick(floor,'champion')` -> `champion_f{floor}`; `event` -> the template named `event_<eventId>` (event id rolled first, section 3.1).
2. After the secret is placed: try `supersecret` (chance table): candidate cell must have exactly one occupied neighbour and that neighbour is the secret room; not adjacent to boss; else skip silently. Door kind `secret` with `super:true` (never brittle).
3. Secret doors get a `tell` (section 8.2). Secret room gets `variant` from weights.
4. Modifiers: for each `normal` room with `dist >= mod.minDist` roll `vr.chance(mod.chance[floor])` until `maxPerFloor`; pick id via `MODIFIERS[id].floors[floor]` weights (section 7); template `modBias` multiplies weights. Save to `room.mod`.
5. `validateFloor` updates: count only core types (`start normal treasure shop boss`) for the 8-11 bound; require exactly 1 `champion` and it is a dead end whose parent is `normal`; `event` <= 1, dead end; `supersecret` <= 1 with exactly 1 door (`secret` kind) to the secret room; `mod` only on `normal` rooms and <= maxPerFloor; every extra leaf has `dist <= boss.dist`; `keyRoomId` must not be a room with a modifier `darkness`. Extend `runSelfTest` to floors 1-6.
6. Chapter-1 seeds may lay out differently than before (accepted). Determinism: `generateFloor(f, seed)` twice must be deep-equal.

### 1.4 Room controllers
New folder `src/rooms/special/`. A controller is created by `Room.buildContents()` when `type` is `event|champion|supersecret|crossroads` or when `variant`/`mod` is set:
`class Controller { constructor(room, def, state); build(); update(dt); onEnter(); onCleared(); destroy(); }` (all display objects via `room.track`, persistent data only in `state.event` / `state.ctl` so revisiting a room restores it; never store Phaser objects in state). Files: `CrossroadsRoom.js`, `events/{CardSharp,WishingWell,Gravedigger,Preacher,SnakeOil,QuickDraw}.js`, `ChampionRoom.js`, `VaultRoom.js`, `SecretVariants.js`, `modifiers/{LightMask,DustStorm,Darkness,Stampede,BloodMoon,Fog,Rockfall,Hellfire,Lurch}.js`.
Shared interaction widget `src/entities/HoldRing.js`: `new HoldRing(room, {x, y, r=64, hold=0.9, label, canUse(), onDone(), repeat=false, color})`. Player centre inside r fills the ring `1/hold` per second (leaving drains at 2x speed); fires `onDone` at 1.0. `canUse()==false` shows a grey ring and, once per 1.5 s of standing there, plays `door_locked` + red floating text (reason). Ring is drawn with existing `ring`/`glow` textures (no art). All signing/digging/betting/throwing below use it. Never triggers during transitions, cutscenes, or while `player.dead`.
Heart prices: `Player.loseMaxHeart(n)` increments `player.heartDebt`; `recomputeStats` ends with `s.maxHearts = max(1, s.maxHearts - heartDebt)` and clamps hp; HUD `Hearts` already redraws from `maxHp`. Fx on payment: `hud:flash` red 0.35, heart-shatter burst (`hud_icons heart_full` sprite, 6 shards), `Sfx heart_pay`.

## 2. CROSSROADS (devil deals)
### 2.1 Spawn rules (decision)
Post-boss portal only (no floor-grid room, no treasure replacement). When a boss on floors 1-5 dies, `Room.onBossDefeated` calls `Crossroads.rollGate(floor)`:
`chance = min(0.70, 0.30 + 0.30*(run.bossHitsTaken===0) + 0.10*curses)`; if `run.gateMisses >= 2` chance = 1.0. Roll with `subRng('gate', floor)`. Hit: `state.gate = {x: ROOM.cx-210, y: ROOM.cy+40}` (trapdoor is at cx, cy+40; reward pedestal cx, cy-110), spawn the HellGate prop with rumble (`fx.shake(0.008,600)`, red `fx.flash`, `Sfx hellgate_open`), toast `THE GROUND OPENS...`, `run.gateMisses = 0`. Miss: `gateMisses++`. Expected ~2 gates per 5-boss run.
HellGate prop (`entities/HellGate.js`): sprite `props_deals` `hellgate_a`/`hellgate_b` (2-frame flicker 4 fps), red `glow` ADD, embers. Armed only after the player has been > 90 px away (same rule as Trapdoor). Touch (d < 46) -> `RoomManager.enterPocket()`. Persists in boss-room state, usable any number of times until the floor changes. Does not appear on floor 6.

### 2.2 Pocket room mechanics (`RoomManager`)
`floor.xroads = { def: {id:'xroads', type:'crossroads', floor, template:'crossroads_a', seed: subSeed('xroads', floor), doors:{}, pocket:true, returnId: bossId}, opened:true }`; `floor.byId.xroads = def` (NOT in `floor.rooms`, so minimap/validate ignore it). `enterPocket()`: fade 400 ms (like `descend`), `jump('xroads', null, {at:{x:720,y:790}})`, store `states.xroads.returnId`. `leavePocket()` (touching the return portal at tile (6,5) = (720,720), same armed rule): fade, `jump(returnId, null, {at:{x: gate.x+95, y: gate.y}})`. `jump` gains an `at` option. `loadFloor` clears `states.xroads`. Debug API: `__dw.api.openGate()`, `__dw.api.enterCrossroads()`.

### 2.3 Room look and the Dealer
Background `bg_crossroads`: dirt crossroads at night, blood-red sky and a cracked moon, a dead tree, a signpost with four arrows all pointing DOWN, candles on a black table at back-centre. Template `crossroads_a` (13x7): `K` dealer at (6,1); `I` at (2,3), (6,3), (10,3) = the three offer tables; `X` no-spawn around them; return portal at (6,5). No enemies, no obstacles except two `d` decor.
The Dealer (`npc_dealer`, 160x160, 6f: 0-3 idle loop 6 fps, 4 = beckon/talk, 5 = laugh) is untargetable (bullets pass; not in `scene.enemies`). Speech: `DealerSpeech.say(line)` prints typewriter text (FONT_BODY 26 px, bone colour, 45 chars/s) above him with a mumble tick sfx; lines table in code (`DEALER_LINES.{greet[4], hover[6], signed[5], refused[3], leaving[4], curse[3]}`). Music `mus_crossroads` + ambience `amb_crossroads`.

### 2.4 Offers (generated once when the pocket is first entered; stored in `state.ctl.offers`)
Generated with `subRng('offers', floor)`. Three tables: L, C, R.
| table | rule |
|---|---|
| L (left) | `item_hearts`: item = `items.roll('crossroads', rng)`; price = `def.dealCost ?? 1` heart containers (items doc may set 1 or 2). If `maxHearts - heartDebt <= cost` the offer becomes `item_curse` instead. |
| C (centre) | weighted: `item_curse` 40 (item is free, you gain 1 random curse), `item_coins` 35 (item costs 30 coins, `player.price()` applies, `curse_debt` x1.5), `item_hearts` 25. Item from `items.roll('crossroads')`; if that pool is exhausted, `items.roll('boss')` and the price is forced to 2 heart containers. |
| R (right) | a Pact (below), weighted `glass_cannon` 25, `devils_dollar` 25, `iron_hide` 20, `ace_in_hole` 10 (floors >= 2 only), `absolution` 20 (weight 0 unless the player has a curse; its weight moves to `iron_hide`). |
| Pacts | `glass_cannon`: -2 heart containers (must leave >= 1), +1.5 damage permanently. `devils_dollar`: gain a random curse, receive +40 coins, +2 keys, +2 dynamite. `iron_hide`: pay 20 coins, gain 3 tin hearts (as many as the tin cap allows) and heal to full. `ace_in_hole`: pay 2 heart containers, get 1 revive charge (max 1; on a lethal hit, revive with 6 hp units, 2.0 s invuln, `bullets.enemy.clear()`, `Sfx dealer_laugh`; consumed). `absolution`: pay 1 key, remove one random curse (the pact is free of hearts). |
Offer schema: `{ id, kind:'item_hearts'|'item_curse'|'item_coins'|'pact', itemId?, pact?, cost:{hearts?, coins?, keys?, curse?:true}, taken:false }`.
Rules: contracts are independent; any/all can be signed if affordable. Hard floor: the player can never be reduced below 1 heart container (offer greys with `NEED MORE BLOOD`). `item_curse` needs the curse pool not full (< 4 curses). Duplicate items never (uses `ItemSystem`). If `items.roll` returns null for L or C, that table is replaced by a free `heart_container` pickup labelled `PITY FROM THE DEVIL` (no cost).
### 2.5 Interaction and UI
Each table = `entities/DealPedestal.js` (subclass of `Pedestal`: same icon/ring/glow/name tag, base = `props_deals` `deal_table`, price label replaced by the price row). Standing inside its ring (r 64) shows a contract card above it (`ui_parchment`, 420x150, text: NAME, effect line(s), `PRICE:` row) and starts the signing ring (`HoldRing hold=0.9`). Price row: hearts = N x `hud_icons heart_full` icons drawn charcoal with a red slash; coins = `12c` gold text; curse = red rune glyph + `A CURSE`; keys = key icon. On completion: pay, grant, `Sfx contract_sign` (quill scratch + low thunder), red ring pulse, Dealer plays frame 5 + laughs, item flourish via `items.pickup(player, id, 'deal')`. Unaffordable: grey ring + reason text (`NEED n COINS`, `NEED MORE BLOOD`, `NO ROOM FOR MORE SIN`).
### 2.6 Risk / reward summary
An item deal is worth about 1 heart container (~15% of a full-health bar early) — cheaper than dying to a boss, dearer than a shop item. Curses are the "free but haunted" route: all four curses are survivable but compound (section 9). Pacts are the high-variance lever. `deal:signed` feeds achievements (`sinner_3` = 3 deals in one run) and the codex. Old Scratch (F6 boss, CHAPTER2) may read `run.deals.length` for flavour text only.
### 2.7 Assets
`bg_crossroads` (1440x864 opaque), `npc_dealer` (strip 6x160x160), `props_deals` (grid 4x2, 128x128, section 11), `ui_parchment` reused, icons reused. Audio: section 13.
### 2.8 Tests
`?debug=1&seed=N`: `__dw.api.openGate()`; enter, assert 3 offers, sign each with a scripted hold; check heart debt, hp clamp, tin cap, coin/key spend, curse list, `ace_in_hole` revive once. Sim 20k boss kills for the gate chance/pity table (`tools/qa/xroads-sim.mjs`): P(no gate over floors 1-5) < 3%. Repeat enter/leave 50 times: no leak (objects, listeners), offers unchanged.

## 3. EVENT ROOMS ("?" rooms)
### 3.1 Placement and selection
`room.type='event'`, `room.event=id`, template `event_<id>` (6 templates, kind `event`, floors 1-6; each has `K` = NPC/prop, `I` = interaction spots, `C` = 5 grave/chip spots where relevant). The room is a dead-end leaf with a normal door, never locked, no encounter (`state.cleared=true`), the player walks in freely. Selection at floor gen from `subRng('event-pick', floor)`: weights `card_sharp 2, wishing_well 2, gravedigger 2, snake_oil 2, preacher 1.5, quick_draw 1.5`; an id already shown on an earlier floor of this run is x0.25; selection is seed-only (never reads player state). No floor restrictions. Persisted: `state.event = { id, uses, net, done, data }`.
Common rules: events give a dimmed floor background, a banner `EVENT: <NAME>` (Banner widget, 1.6 s), the props sprite bobs, and closing text on completion. Leaving mid-event is always allowed except during a locked fight (gravedigger ambush, quick_draw duel, card_sharp never fights). Each event calls `bus.emit('event:done', {id, outcome, net})` when its last action resolves.

### 3.2 `card_sharp` — The Card Sharp (gamble coins)
Skeleton dealer at a round table (`props_events card_table`). Three chip stacks (`props_small chip_stack`) in front at (4,4), (6,4), (8,4) labelled `3c`, `6c`, `10c`; each is a HoldRing (hold 0.35). Bet is paid immediately, then a 1.2 s code-drawn card flip (two 88x124 rounded rects, rank text FONT_TITLE, suit glyph) resolves the outcome. Max 5 hands per visit (`HOUSE CLOSED`). Outcome table (roll `RNG(hash(room.seed,'bet',n))`):
| outcome | base p | payout |
|---|---|---|
| bust | 0.51 | 0 |
| push | 0.10 | bet returned |
| win | 0.31 | 2x bet returned (net +bet) |
| ace_high | 0.06 | 3x bet returned |
| dead_mans_hand | 0.02 | item from `treasure` pool appears as a pedestal on the table, bet lost |
Luck: each point of `player.stats.luck` (cap 5) moves 0.01 from bust to win. Expected coin return ~0.90x + jackpot value ~ 1.2x overall; variance is the point. Cannot bet more than owned; when coins < 3 the chips are grey. After the 5th hand or `net >= 25` the Sharp folds (`bet:result` last). No combat, no cheating mechanic.
### 3.3 `wishing_well` — The Wishing Well
Stone well (`props_events well`) at (6,3). One HoldRing on the rim (hold 0.5, `repeat=true`): while the player stands in it, 1 coin is thrown every 0.5 s (arc sprite = `coin`, `Sfx well_plink`). Max 12 throws total. Each throw resolves `RNG(hash(room.seed,'wish',n))`:
| result | p | notes |
|---|---|---|
| nothing (splash) | 0.44 | `THE WELL IS SILENT` (only first time per visit) |
| `heart_half` | 0.14 | pickup rises out of the well |
| `key` | 0.09 | |
| `dynamite` | 0.09 | |
| `heart_full` | 0.06 | |
| `coin_nickel` | 0.05 | pays 5c back |
| `heart_tin` | 0.04 | |
| luck boon | 0.07 | +1 luck until the end of the floor (buff `well_luck`, max 3 stacks, removed on `floor:changed`) |
| curse | 0.02 | a hand drags the coin down: gain 1 random curse |
Pity: the 12th throw always yields an item pedestal (`items.roll('treasure')`) and throws stop. Free wishes: none. Toast when coins hit 0.
### 3.4 `gravedigger` — Grave Robbing
Five fresh mounds (`props_events grave_mound`, `C` markers) plus a sign `DIG AT YOUR OWN RISK`. Each mound: HoldRing hold 1.0 (dig sfx loop, dirt bursts); on complete the sprite swaps to `grave_open`. Contents are a shuffled fixed set (seed `RNG(hash(room.seed,'graves'))`): `loot` x2 (each = 2 x `rollPickup(1.0,true)` pickups), `chest` x1 (a free `chest_wood` rises), `ambush` x1, `bones` x1 (`JUST BONES`; 25% a key). Ambush: 0.56 s spawn telegraphs at three grave positions, doors lock, wave composition by floor: F1-2 `skeleton, skeleton, possessed`; F3 `skeleton, skeleton, coffin`; F4-6 four enemies with tag `undead` from the floor's Chapter-2 pool (fallback `skeleton, possessed`). Elites can appear (normal roll). When the ambush is cleared: `chest_wood` at room centre. All 5 graves may be dug; the ambush grave is not marked.
### 3.5 `preacher` — The Confessional (sacrifice for a blessing)
Confessional booth with a ghost Preacher (`props_events confessional`, back-centre). Three altars = pick-one group (taking one snuffs the others, like `resolveGroup`), each a HoldRing hold 1.2:
| altar | cost | result |
|---|---|---|
| Communion (`I` left) | 2 hp units (current hp must be >= 3; never kills) | 78% one blessing (random, prefers not-owned); 14% false prophet: keep the cost AND gain a random curse; 8% miracle: blessing + heal to full |
| Absolution (`I` centre) | free | if the player has curses: remove ALL, +1 tin heart per curse removed (max 3). If none: `NO SINS` and it becomes Benediction: +2 tin units |
| Collection Plate (`I` right) | 12 coins (`price()` applies) | heal to full; 25% also a blessing |
Blessings (run-long, stack, icons `icons_events`): `bless_steady` fireDelay x0.92; `bless_grace` luck +1.5; `bless_iron` +2 tin units now and +0.4 damage; `bless_fleet` moveSpeed +40 and rollCooldown -0.15. Implemented in `src/systems/Boons.js` (`applyBoons(player, stats)` called at the end of `recomputeStats`, after items, before buffs); shown on the relic strip as small gold-ringed icons.
### 3.6 `snake_oil` — The Snake-Oil Salesman
Wagon prop with the lanky salesman (`props_events wagon_oil`). Three shelf potions (`props_small potion_bottle` tinted) at the `I` spots, each priced 5c (`price()` applies), HoldRing hold 0.4. Six colours: red 0xd63a2a, green 0x8fc23f, blue 0x5aa0e8, amber 0xf0a640, violet 0xa070d8, white 0xf0f0e8. Colour -> effect mapping is a per-run permutation `subRng('potions')` shared by every salesman in the run; `run.potionKnown[color]` remembers identified colours and shelf tooltips show the known effect name (unknown = `???`). The three shelves show three distinct colours (`RNG(hash(room.seed,'shelf'))`). Each purchase has a 10% "watered down" roll (nothing happens, coins gone, `TASTES LIKE WATER`) — `RNG(hash(room.seed,'water',n))`. Effects (until leaving the floor unless stated):
| id | effect |
|---|---|
| `p_heal` | heal 4 hp units |
| `p_vigor` | +0.8 damage |
| `p_swift` | +80 moveSpeed, fireDelay x0.85, 45 s only |
| `p_venom` | lose 1 hp unit (never below 1), bullets poison 4 dps |
| `p_laudanum` | roomShield +1, moveSpeed -70 |
| `p_kerosene` | lit dynamite at feet now (fuse 1.4, hurts you unless immune), +3 dynamite |
Buffs use `addBuff(id, fn, Infinity)` and a `floor:changed` scoped listener removes them. Max 3 purchases (one per shelf).
### 3.7 `quick_draw` — The Dead Man's Duel
A ghost gunslinger `duelist` waits at (10,3) beside `duel_post` (bell). Player steps on the chalk mark at (2,3) (HoldRing hold 0.6, `ACCEPT THE DUEL`) -> doors lock. Sequence: bell tolls at t=0.9/1.9/2.9 s (`Sfx bell_toll`, screen text `1 .. 2 .. 3`), then `DRAW!` at `t = 3.4 + RNG(hash(room.seed,'draw')).float(0,1.2)`. Before DRAW the duelist is `invulnerable` (bullets pass). After DRAW: windup pose 0.45 s + red aim line, then a 3-shot aimed burst (speed 360, 1 dmg, 0.09 s apart).
- `duelist` (enemy id, extends `outlaw`): base hp 24 (x floor `hpMult`, no affixes, no loot), r 30, speed 150, sprite `enemy_outlaw` tinted 0x9fe0d0 alpha 0.9 + teal glow. Loop: strafes vertically at 130 px/s, burst every 1.2 s (0.4 s windup), every 3rd cycle a 300 px sidestep dash (0.35 s telegraph). Phase < 50%: 5-shot fan, cadence 0.95 s.
- Quick Draw: if a player bullet hits within 0.7 s after DRAW: `QUICK DRAW!`, duelist stunned 1.5 s, that hit x2.
- Reward on death: `chest_wood` (free) at centre; if the player took 0 damage in the duel (`flawlessDuel`): also an item pedestal (`treasure` pool). Player death = normal death (cause `A ghost duellist`). Fouls: none (shooting early just hits an invulnerable ghost).
### 3.8 Event tests
Distribution tests: `tools/qa/events-sim.mjs` runs 20k outcome rolls per table and asserts each probability within +-1.5% absolute. Scripted playthrough per event (`__dw.api.jump(eventRoomId)`): card_sharp 5 hands, well 12 throws (item on the 12th), gravedigger all 5 graves (exactly 1 ambush, then a chest), preacher each altar in separate runs (pick-one respected), snake_oil buy 3 (mapping stable across two salesmen), duel win + flawless flag. Room re-entry after completion restores state (no duplicate rewards).

## 4. MINI-BOSSES (champion rooms)
### 4.1 Rules
One `champion` room on every floor (guaranteed leaf). The door is plain (no key) but tinted gold-red with a WANTED poster pinned beside it; the minimap shows a gold horned skull once the room is adjacent. Entering: doors lock, 1.0 s WANTED card (`props_small wanted_poster` + name + `BOUNTY $n`), mini invulnerable during the card, then `startFight`. HP bar = `BossBar` compact style (60% width, gold frame). No portrait, no cutscene. Elites never apply. Mini uses `noFloorScale:true` (HP below is final), `heavy:true`.
Base class `src/bosses/MiniBoss.js extends Boss`: `Boss` gains `opts.spriteKey` (default `boss_<id>_idle`); mini uses key `enemy_<id>` (6f strip: 0-3 idle/move loop, 4 windup, 5 attack; `setPose('move'|'windup'|'attack')` reuse). `BOSS_META` gets the six entries (`mini:true, floor, bounty`). `Room.startEncounter` for `champion` calls `startMini()`; `Room.onMiniDefeated(mini)` runs the reward. Attack scheduler, phases, `spawnAdds`, `cancelAttack` are the existing `Boss` API.
### 4.2 Reward (`Room.onMiniDefeated`, via `subRng('mini', floor)`)
Always: bounty coins (`bounty = 10 + 5*floor`, dropped as `coin_nickel` pickups), and a free gold chest (`Chest` with `rec.type='chest_gold', rec.free=true`, opens on touch, 3-4 pickups at luck 1.5). Plus ONE bonus by weight: item pedestal from `treasure` 50% (F1: 65%); `heart_container` pickup 30% (new pickup type, +1 max heart and heals 2 units; sprite `props_small heart_container`, `Player.collect` case added, `hud:flash` gold); 2 keys + 1 dynamite 20% (F1: 5%). If the item pool is empty use the heart container. `clearRoom({boss:true})` (no normal drop). Event `mini:defeated {id, flawless, time}`; flawless = no damage taken in the fight.
### 4.3 The six (frame 192x192, strip 6f, anchor bottom, hit radius `r`)
| id | floor | name / title | hp | r | move speed |
|---|---|---|---|---|---|
| `ol_fury` | 1 | OL' FURY — The Bull That Wouldn't Stay Buried | 120 | 62 | 0 (charges) |
| `hangman` | 2 | THE HANGMAN — Drop Is Just Rope | 190 | 56 | 90 |
| `motherlode` | 3 | THE MOTHERLODE — All That Glitters | 280 | 70 | 50 |
| `ash_deacon` | 4 | THE ASH DEACON — Dust Thou Art | 340 | 54 | 100 |
| `stoker` | 5 | STOKER JACK — Full Steam Ahead | 400 | 66 | 80 |
| `bouncer` | 6 | THE BOUNCER — Last Call | 480 | 64 | 100 |
All: idle gap between attacks 1.4 s (1.0 s after the phase change); attack weights below; phase change at 50% HP: roar 0.9 s, `bullets.enemy.clear()`, then the listed change.
**`ol_fury`** (undead longhorn, F1). Attacks: `charge` w3 — windup 0.7 s (paws scrape, lane band 110 px wide locked 0.25 s before the run), charge 640 px/s until wall/obstacle, contact 2 dmg (heavy), on impact stunned 1.1 s taking +20% damage, dust ring. `stomp` w2 — rear-up 0.6 s, landing shock radius 150 (1 dmg) + ring of 10 dust bullets (speed 260). Phase: eyes glow; `charge` chains twice (0.5 s gap, second lock re-aimed) and each wall impact spawns 2 `tumbleweed_mini`.
**`hangman`** (masked executioner, chain flail, F2). `flail` w3 — windup 0.7 s, then 2.0 s of `bullets.enemy.spiral` (2 arms, 12 shots/s, speed 250, kind `ghostfire`) while walking toward you at 60 px/s. `gallows_drop` w2 — 3 warn circles (r 90) at the player and two predicted positions, 1.1 s, then a noose drop: 1 dmg + `snag` (moveSpeed x0.4 for 1.2 s via `addBuff`). Phase: summons 2 `ghost` (deputy) and `flail` gets 3 arms.
**`motherlode`** (mound of silver ore around a miner's skeleton, F3). `rock_lob` w3 — windup 0.5 s, 4 lobbed rocks land after 1.0 s on warn circles (r 70) at the player + 3 spread points, 1 dmg each, kind `rock`. `cart_ram` w2 — picks a room row, warn line 96 px wide 1.0 s, then a minecart (`obst_f3 block_b`) sweeps the row at 900 px/s: 2 dmg, breaks breakables. Phase: silver crystals grow: front cone takes x0.6 (miner rule, explosions ignore), `rock_lob` throws 6 rocks and spawns 2 `bat` per volley (max 4 alive).
**`ash_deacon`** (burning deacon with a chained censer, F4). `censer_swing` w3 — windup 0.6 s, expanding ring of 12 orange `ghostfire` bullets (radius up to 200, speed 280) + 4 FirePatches on the ring. `brimstone_rain` w2 — 5 warn circles (r 80) over 1.0 s, then fire pillars: 1 dmg + FirePatch 3.5 s each. `ash_step` w1 — dissolves (invulnerable 0.6 s), ash-pile mark 0.7 s at a point 300 px behind you, reappears + ring of 8 bullets. Phase: `censer_swing` ring 16 bullets, a fire pillar erupts on a random wall tile every 6 s.
**`stoker`** (soot-black brute with a boiler on his back, F5). `coal_toss` w3 — windup 0.5 s, arcs 3 coals (0.9 s flight) onto warn circles (r 60); FirePatch 3 s. `steam_vent` w2 — white warn cone 70 degrees x 420 px for 0.8 s, then a 1.0 s jet: 1 dmg per 0.5 s tick + slow 40%. `boiler_charge` w2 — windup 0.8 s, charge 450 px/s up to 700 px (2 dmg, steam trail 0.3 s), ends venting 0.9 s (vulnerable, +20% damage). Phase (Overpressure): 4 floor grates burst at random every 2.5 s (warn 0.7 s, r 80, 1 dmg), speed +30%.
**`bouncer`** (waistcoated demon with a bar towel, F6). `stool_throw` w3 — windup 0.5 s, 3 spinning stools land after 0.9 s (warn r 60), 1 dmg and 4 fragment bullets in a cross (speed 300). `mug_slide` w2 — 3 random rows warned 0.9 s, mugs slide at 700 px/s (1 dmg, breakables break). `bum_rush` w2 — windup 0.7 s, dash 500 px/s at you, 2 dmg + heavy knockback, 0.8 s recovery (vulnerable). Phase (Last Call): chugs (invulnerable 1.0 s), speed x1.3, spawns 2 `possessed` patrons.
### 4.4 Art (6 generations, 192x192 x 6f each, `art/prompts/enemy_<id>.txt` + `sprites.py` strip mode, frame 192)
| key | one-line art description (dark ink-cartoon woodcut, readable on the floor palette) |
|---|---|
| `enemy_ol_fury` | huge skeletal-hided longhorn bull, cracked horns wrapped in barbed wire, one glowing red eye, dust-coloured hide; frame 4 rears up, 5 lowers horns |
| `enemy_hangman` | tall hooded executioner, burlap mask with stitched grin, noose belt, a heavy chain with a spiked ball; frame 4 arms wide, 5 swings |
| `enemy_motherlode` | walking mound of silver ore and rusted cart parts, a miner skeleton half-embedded, lantern for a heart; frame 4 hoists a boulder, 5 slams |
| `enemy_ash_deacon` | gaunt charred preacher in a smoking black frock, burning bible, chained censer trailing sparks, halo of ash; frame 4 raises censer, 5 swings |
| `enemy_stoker` | massive soot-black coal shoveller, riveted boiler tank on his back with a pressure gauge, glowing furnace mouth chest; frame 4 leans back, 5 lunges |
| `enemy_bouncer` | broad red demon in a waistcoat and bow tie, bar towel on the shoulder, bottle-cap teeth, tiny horns, cracked knuckles; frame 4 winds up, 5 throws |
Silhouettes must read against: F1 ochre, F2 grey-brown, F3 near-black (add a light rim), F4 red-brown, F5 iron-blue, F6 crimson (F4-6 palettes from CHAPTER2). Reuse: bullets kinds `ghostfire rock stick dust nail`, FirePatch, warn helpers. Audio: `mini_intro` sting, per-attack sfx reuse boss ones + 6 new (`bull_snort`, `chain_whirl`, `rock_crumble`, `censer_swing`, `steam_hiss`, `glass_break`).
### 4.5 Champion room templates (`champion_f1`..`champion_f6`, kind `champion`, `waves:{1:['<mini_id>']}`)
Open 13x7 arena, mini spawns at `1` (col 6,row 2, mirrored away from the entry door like boss rooms), 4 cover rocks `R` at (3,2),(9,2),(3,4),(9,4) except `motherlode` (row 3 kept clear for the cart lane: rocks at (2,1),(10,1),(2,5),(10,5)) and `bouncer` (no rocks; 3 overturned tables `B` as breakable cover). `validateTemplate`: kind `champion` needs a `1` slot with a registered mini id.
### 4.6 Tests
Per mini: spawn via `__dw.api.spawn(id)` in a champion room; bot-run (`tools/qa/mini-bot.mjs`, modelled on `boss-*-bot.mjs`) must beat it with base stats + roll in <= 70 s; every attack's first damaging frame is >= 0.4 s after its telegraph; phase change fires once; killing it drops the chest + bonus; `?noassets=1` still fights. 300 seeds: exactly one champion room per floor 1-6.

## 5. ELITES (affixes)
### 5.1 Rules
Replaces the flat 8% `cursed` roll. In `Room.planEncounter`, after the wave list is built, roll affixes with a separate stream `RNG(def.seed ^ 0xE11E)` (so wave composition of existing seeds is unchanged): each spawned wave enemy (not `E`-slot adds spawned by other enemies, not bosses/minis/`crow`/`tumbleweed_mini`/champion adds/event fights except gravedigger and card ambush) becomes elite with `VARIETY.elite.chance[floor]` (x2 with `curse_rot`), until `maxPerRoom`; at least one enemy per room stays plain. Elites are stored per spawn in the wave record: `{id, x, y, affixes:['armored']}` (`cursed:boolean` remains for old saves/tests = `affixes.includes('cursed')`). Affix pick: weighted from the table by floor; F5-6 `secondAffix` 25% adds a second distinct one (forbidden pairs: armored+shielded, cursed+any other with hp mult, splitting+volatile).
### 5.2 Affix table (`src/enemies/Affixes.js`, registry of `{id, w, floors:[a,b], hooks}`)
| id | weight | floors | effect (exact) | visual marker | extra drop |
|---|---|---|---|---|---|
| `cursed` | 3 | 1-6 | hp x1.5, drops a heart (existing) | red glow aura (existing) | `heart_full` 100% (existing) |
| `armored` | 2 | 1-6 | hp x1.25; bullets deal x0.6, dot/explosions x0.85; speed x0.9; a `ting` spark on each hit | steel tint 0xaab4c4 + grey ring 0xc8d0dc | `heart_tin` 50% |
| `swift` | 2 | 1-6 | speed x1.4; `ai(dt*1.2)` (cooldowns 20% shorter; `telegraph()`/`after()` windups stay unscaled so every telegraph stays >= 0.4 s) | yellow tint 0xf4f090, afterimage trail, ring 0xffe860 | `coin_nickel` 50% |
| `volatile` | 2 | 2-6 | on death: 0.6 s pulsing flash then explosion r 130 (player 1 unit, enemies 40, breaks breakables, ignites 2 FirePatches) | orange tint 0xff8a60 pulsing, ring 0xff5a30 | `dynamite` 35% |
| `shielded` | 2 | 2-6 | separate shield = 0.35 x maxHp absorbing damage first, no regen; bubble pops with a ring | blue bubble (`ring` ADD 0x80c0ff) | `heart_tin` 30% |
| `splitting` | 1.5 | 3-6 | on death 2 clones (hp 40% of max, scale x0.7, no affix, no drops, cannot split; spawn without telegraph) | teal tint 0x80e0c8, ring 0x50c8a8 | `key` 20% |
| `burning` | 1.5 | 3-6 | immune to burn; every 0.5 s leaves a FirePatch (r 40, life 2.0 s) under it; death patch r 70 for 3 s | orange tint 0xff9a40, ember particles, ring 0xff7020 | `key` 15% |
| `vampiric` | 1.5 | 4-6 | heals 30% of max hp when it damages the player (1 s internal cooldown) | crimson tint 0xd06a90, drip particles, ring 0xa02050 | `heart_half` 60% |
Ban list (`meta.affixBan`): `scarecrow` (swift, splitting), `coffin` (splitting), `tumbleweed` (splitting), `mole` (swift), `ghost` (armored, shielded: invulnerable phases). Ban list for CHAPTER2 enemies goes in their meta.
### 5.3 Visuals
Ring under feet (`ring` texture, tint = affix ring colour, 0.7 alpha, slow spin) + sprite tint (first affix wins, second adds a second smaller ring) + 12 px primitive glyph above the head drawn with `Graphics` (armored = hexagon, swift = double chevron, volatile = starburst, shielded = shield, splitting = two circles, burning = flame, vampiric = drop, cursed = skull dot). On spawn a 1.2 s nameplate `ARMORED COYOTE` (bone text, FONT_BODY 20 px). Elite spawn sting `elite_spawn` (once per room).
### 5.4 Rewards
Every elite kill: guaranteed `rollPickup(0.8)` + the affix drop above. If >= 1 elite died in the room, room-clear drop chance +0.25 and guaranteed if >= 2 (`Room.clearRoom`). Counters: `run.elitesKilled`, event `elite:killed`.
### 5.5 Implementation
`Enemy` ctor: `this.affixes = opts.affixes || (opts.cursed ? ['cursed'] : [])`; `Affixes.apply(this)` sets hp/speed/tint/rings; hooks called from `Enemy.update` (`onUpdate`), `Enemy.takeHit` (`onDamage` returns the multiplier; shield first), `Enemy.die` (`onDeath`), `bus 'player:hurt'` (`source.enemy` = the shooter; enemy bullets must pass `owner: enemy` — add to `Enemy.shoot`). `spawnEnemy(scene,id,x,y,{affixes})`. Tests: 200 rooms per floor: elite rate within +-2% of the table; never > maxPerRoom; splitting never chains; volatile blast hurts once; swift telegraph >= 0.4 s in every enemy (`tools/qa/elite-telegraph.mjs`); `?noassets=1` OK.

## 6. CHAPTER-1 HAZARDS (also reused on F4-6 when CHAPTER2 wants them)
New template chars (add to `VALID`; `BLOCKING` gains `G`,`Z`): `Q` quicksand (walkable), `s` retracting spikes (walkable, counts as `S` for door/front-tile rules), `Z` explosive barrel (blocking, breakable), `G` gravestone (blocking). Validator: `Q`,`s` never on door/front tiles or enemy spawn digits; flood fill treats `Q`,`s` as walkable; no `Q` under `I/H/K/C`.
### 6.1 Quicksand (`Q`, F1; sand tint on F1, tar tint 0x2a2a30 available for F4)
Player on a `Q` tile: moveSpeed x0.5, roll distance x0.6; a sink meter (0..1, small bar under the feet) fills in 1.6 s and drains at 2/s off-tile; at 1.0: 1 unit damage `{hazard:'quicksand'}` and the player is pushed to the nearest non-`Q` walkable tile with a dust burst (meter reset). Walkers on `Q`: speed x0.6; flyers/ghosts ignore; bullets pass; pickups never drop onto `Q` (`walkableNear` skips it). Art `obst_hazards quicksand` (per-tile, adjacent tiles merge visually via slight overlap).
Templates: edit `f1_02, f1_07, f1_10, f1_13, f1_15` (2 patches of 3-5 tiles, keep >= 4 safe tiles from spawn digits) and add 2 new F1 templates: `f1_17` "quicksand basin" (tier 2, centre 3x3 `Q` ring around a rock) and `f1_18` "sinkhole run" (tier 3, two diagonal `Q` bands, 3 waves).
### 6.2 Fire tiles (`FirePatch`, all floors)
`src/entities/FirePatch.js`: circle r 44, life 3.5 s (fade last 0.5 s), tick every 0.5 s: player takes 1 unit at most once per 1.0 s while inside (`hazard:'fire'`; `explosionImmune` = immune; rolling i-frames = immune), enemies get `applyStatus('burn', {dps:3, t:2.5})` (burn-immune: `burning` elites and `ghost`). Bullets unaffected. Max 12 per room (oldest removed). Sprite = `fx_fire` loop (6f, 8 fps, ADD glow). Spawn API: `room.ignite(x, y, {r, life, count, spread})`.
- Sources: player dynamite (`explode()` calls `room.onExplosion(x,y,radius,o)` -> 4 patches, random points within 0.8R, min separation 60, walkable non-pit tiles only), `Z` barrels, `volatile`/`burning` elites, `ash_deacon`, `stoker`, `hellfire` modifier, `p_kerosene` potion.
- `Z` explosive barrel: 1 hit from anything (player bullets, enemy bullets? NO — enemy bullets never damage breakables), dynamite chain: explosion r 130, 60 enemy damage, 2 units to the player (`explosionImmune` blocks), ignites 3 patches, chain-reacts within radius. Art `obst_hazards powder_barrel` (on F2 the existing `B` powder barrel art is kept for `B`). Templates: `f1_04` (2 of the barrels), `f2_09`, `f2_13` (3 of the B), `f3_08` (2 ore crates -> Z) switch to `Z`.
### 6.3 Spike variants
`S` static: unchanged (1 unit, walkers only). `s` retracting (F1-F3, later floors optional): cycle 2.8 s = down 1.4 s (safe, sprite `spikes_ret_down`) -> warn 0.5 s (tips shiver, `spikes_ret_warn`, `Sfx spikes_ret` click) -> up 0.9 s (`spikes_ret_up`, 1 unit, once per 0.8 s to the same actor). Phase offset per tile `((c + r) * 0.35) s mod 2.8` so rows sweep like a wave. Flyers/ghosts ignore, enemies avoid `s` only while up (treat `up` as blocking for steering). Templates: convert half of the `S` tiles to `s` in `f1_05, f1_09, f2_06, f3_15`, add `f2_17` "nail-board hall" (tier 3) and `f3_17` "spike corridor" (tier 2), each with 6-10 `s`.
### 6.4 Falling rocks (Sundown Mine) — modifier `rockfall`, section 7; template bias only.
### 6.5 Gravestone ambush (Perdition)
Template flag `graveAmbush:true` on `f2_01, f2_04, f2_14, f2_15`: their corner/edge `d` tiles become `G` (2-4 tombstones, solid, bullet-blocking, `props tombstone_marker`/`obst_hazards gravestone`). At room build `RNG(def.seed^0x6A7E).chance(0.5)` decides whether THIS room is rigged (else the stones are scenery). Rigged: after the normal encounter is cleared, when the player comes within 150 px of any `G`: 1.0 s telegraph (stones shake, red glow, `grave_crack`), then each `G` crumbles (tile becomes rubble, non-solid) and releases `skeleton, skeleton, possessed` (one per stone, extra stones spawn `ghost`), doors re-lock (`Room.lock()`), state `ctl.graveDone=true`; clear drops one extra pickup (`rollPickup(1.0)`). Does not chain with a room modifier (rigged rooms never get a `mod`).

## 7. ROOM MODIFIERS (8) — small system
`src/rooms/special/modifiers/*`, table in `src/config.js` `MODIFIERS`. A modifier is `{id, name, floors:{n:weight}, onBuild(room), onLock(room), update(room, dt), onClear(room), onDestroy(room)}`; `Room.buildContents` instantiates it when `def.mod`. Effects run only in `combat` mode (except overlays) so safe rooms stay safe. Banner on entry (`DUST STORM`, etc.) + `modifier:entered`; reward: cleared modifier rooms add +0.08 to the room-clear drop chance (`modifier:cleared`).
| id | floors (weight) | effect (exact) | overlay / visual | map glyph (10x10, top-left of the room cell) |
|---|---|---|---|---|
| `dust_storm` | F1 3, F2 1, F4 2 | LightMask sand 0xc89a5a alpha 0.62, clear radius 420 soft 200; wind: player gets +45 px/s along a random cardinal wind dir (not while rolling); 40 streak sprites (`fx_dust` frames) crossing at 900 px/s; F4 reskin `ash_storm` 0x7a3a2a | drifting streaks + tinted haze | three wavy sand lines |
| `darkness` | F2 1, F3 3, F5 1, F6 2 | LightMask near-black 0x0a0806 alpha 0.92, lantern radius 300 soft 120 (flicker +-6 px); `spirit_lantern` adds a second clear disc r 200 at the familiar; enemy bullets, warn circles, fire, elite rings, pickups' sparkle are drawn ABOVE the mask (depth >= 200) so fairness holds | black mask, lantern glow | dark crescent |
| `stampede` | F1 3, F2 2, F4 1, F6 1 | while in combat, every 6.5-8.5 s (first at 3.0 s): `n` rows (2 on F1-2, 3 on F4+) among the 7 tile rows are marked with red chevrons at both edges + rumble for 1.0 s, then 3 spectral bulls per row (reuse `enemy_coyote` frames 0-3 tinted 0xd8e8e0 alpha 0.8, scale 1.4, r 44) run through at 820 px/s, direction alternates; contact 1 unit to the player (roll i-frames avoid it), 25 damage to every enemy touched (once each); ignore obstacles; players are knocked 200 px | red chevrons, dust trail | two horns |
| `blood_moon` | F3 1, F4 2, F5 2, F6 3 | player bullet damage x1.5; enemy contact and bullet damage +1 unit (1 -> 2, heavy 2 -> 3); enemy hp x0.75; guaranteed room-clear drop | red multiply overlay 0xff2020 alpha 0.14 + red vignette, moon glow at the top wall | red disc |
| `fog` | F2 3, F3 1, F6 2 | LightMask cold grey 0xb8c4c8 alpha 0.55, clear radius 520 soft 260; wave 1 gains 1 extra `ghost` (F2-3 only) | rolling fog sprites (`glow`, 6 large, slow drift) | three dotted lines |
| `rockfall` | F3 4 (+ template bias x3 on `f3_06, f3_11, f3_14`) | starts 1.8 s after lock; every 2.2-3.5 s spawn a rock: 60% at the player's predicted position (pos + vel*0.5), 40% uniform; warn circle r 70 for 0.9 s, ceiling dust trickle 1 s before, then 1 unit to the player / 30 to enemies, leaves a rubble decal; max 2 active; a dynamite explosion here queues 2 extra rocks (1.0 s warn) | falling `props_small rock_chunk` + shadow | triangle |
| `hellfire` | F4 3, F5 2, F6 2 | every 2.2 s (first at 2.0 s): ember warn (`warnCircle` 0xff7020 r 60, 1.0 s) at a random walkable tile >= 140 px from the player, then a FirePatch (life 4.0 s); max 5 patches | ember glow, heat shimmer particles | flame |
| `lurch` | F5 4, F6 1 | every 5.0 s (first at 4.0 s): 0.7 s warn (camera rumble ramp 0.002->0.008, chevrons both edges), then all non-flying actors (player included) are pushed 260 px left or right over 0.35 s (ease-out; walls/obstacles stop them; not damage; roll does not cancel it, i-frames irrelevant); bullets unaffected | chevrons, dust from the floor | double arrow |
Assignment: `Variety.assignModifiers` (section 1.3); `modBias` on templates; forbidden combos: not on rooms where a template has `graveAmbush`, not on `champion/event/...`. `curse_dark` adds a 25% chance that a NORMAL room without a modifier is `darkness` (rolled at room build with `RNG(def.seed ^ 0xD4A4)`).
### 7.1 LightMask (shared, shader-less)
`src/rooms/special/modifiers/LightMask.js`: one `RenderTexture` 1440x960 at depth `DEPTH.bullets - 4` (above actors 100-110, below bullets 200 and fx 300), `__noSnap=true`. Each frame (skipped when nothing moved): `rt.clear(); rt.fill(color, alpha); for each light: rt.erase(gradientSprite, x, y)` where `gradientSprite` is a soft radial gradient generated once with `textures.createCanvas('light_soft', 256, 256)`; scale = radius/128. Lights: player (always), extra discs (familiars). Cost: one fill + 1-3 erases per frame. Falls back to a flat alpha 0.35 rect if `RenderTexture.erase` is unavailable. `Room.destroy` frees it.
### 7.2 Map hint icons
`Minimap.redraw`: for a discovered room with `def.mod` draw the glyph (colours: dust 0xd9b071, dark 0x9a80c0, stampede 0xd9d0b8, blood_moon 0xd63a2a, fog 0xb8c4c8, rockfall 0xa08060, hellfire 0xf0702a, lurch 0x80b0ff) at (x+2,y+2) in a 10x10 box; hidden until the room is discovered (adjacent or visited). Also draw the new room-type icons of section 1.1.
### 7.3 Tests
`tools/qa/mod-check.mjs`: for each modifier spawn the room, run 30 s with a bot: stampede rows always telegraphed >= 1.0 s before the first bull crosses; rockfall never hits within the warn window; lurch never pushes into a wall through the player (positions clamped by `resolve`); darkness: `bullets.enemy` sprites depth > mask depth; blood_moon damage numbers; overlay textures destroyed on room exit (no leaks). 300 seeds: <= maxPerFloor, never on forbidden room types.

## 8. SECRETS
### 8.1 Secret room variants (`room.variant`, rolled at floor gen with `subRng('secret', floor)`; one `secret` per floor as today)
| variant | weight | template | contents |
|---|---|---|---|
| `stash` | 40 | existing `secret_a/b/c` | unchanged: 2 pickups + 40% item (`secret` pool) |
| `dead_mans_hand` | 25 | `secret_hand` | Table with 5 face-down cards (`props_small card_back`, `C` slots). The player may take ONE (HoldRing hold 0.8): it flips (code-drawn face) and the other four burn to ash. Faces (shuffled with `RNG(hash(room.seed,'hand'))`): A of spades = item (`secret` pool); A of clubs = `heart_container` pickup; 8 of spades = 3 keys; 8 of clubs = heal to full + 2 tin hearts; J of diamonds ("the devil's fifth card") = 1 random curse AND an item from the `crossroads` pool. Banner `DEAD MAN'S HAND` (aces and eights). |
| `cache` | 20 | `secret_cache` | 8 `B` crates each guaranteeing 1 pickup (`rollPickup(1.5)`), 3 `Z` powder barrels among them: one dynamite chain-breaks everything; one crate holds a `chest_wood`. Dynamite is not refunded. |
| `shrine` | 15 | `secret_shrine` | Bone altar (`props_events altar_shrine`) with an item pedestal (`secret` pool, 100%), ring of `s` retracting spikes around it (1 gap tile every 2.8 s window); reward is guaranteed, crossing costs 1 unit at worst. |
`secret:found {variant}` on first entry. The reveal, minimap and dynamite rules are unchanged (`revealSecretsAt`).
### 8.2 Breakable-wall hints ("tells")
Every secret door (from the neighbour rooms and from the secret room) gets exactly one tell, picked at floor gen (`subRng('tell')`): `crack` 0.30 (`brittle:true`), `knock` 0.40, `chalk` 0.30.
- `crack`: procedural hairline cracks (Graphics, seeded by door id, 3-5 jagged lines, alpha 0.6, on the wall band at the door position, depth `DEPTH.floor+1`). Brittle doors are also opened by 12 player bullet hits within 130 px of the door centre (`Bullets` wall hit hook `room.onWallHit(x,y)`; each hit spawns dust; the 12th calls `revealDoor`). Dynamite still works.
- `knock`: while the player is within 130 px of the door, every 4 s a hollow `tock` (`Sfx wall_knock`, pitch -200) and a small dust puff; needs dynamite.
- `chalk`: a chalk X (`props_small chalk_x`, alpha 0.8) on the wall band at the door position; needs dynamite.
`secret:hint {tell}` fires once per door when the tell is first perceived (achievement hook `notice_hint`). Additional hint: 35% of shops show a Peddler line on entry naming the compass direction of the secret room relative to the shop (`SOMETHING RATTLES TO THE NORTH-EAST`), text only.
### 8.3 Super-secret: "The Dealer's Safe" (`supersecret`)
Chance per floor in `VARIETY.supersecret.chance`. Placed next to the secret room only (section 1.3). The secret room's wall toward it carries a `chalk` tell (never crack/knock) and the door is `super:true`: dynamite required, 2 dynamite blasts total from the start of the floor (secret + super). Room `vault_a` (13x7, `bg_treasure` tinted purple): two pedestals: `crossroads`-pool item (free) and `treasure`-pool item, plus 12 coins and the banner `PROPERTY OF THE DEALER`. Taking the crossroads item has a 50% chance (`subRng('vault')`) to add a random curse (`THE DEALER NOTICES`). `supersecret:entered` (achievement `safecracker`). Minimap: purple diamond + gold dot after reveal.
### 8.4 Tests
300 seeds x 6 floors: secret has a variant; every secret door has exactly one tell; supersecret <= 1, adjacent only to the secret; brittle doors open after exactly 12 hits; hand: choosing any card removes the other four and pays exactly once; cache: one dynamite clears all crates and yields >= 8 pickups; shrine reachable without crossing spikes only via the timed gap.

## 9. CURSES AND BLESSINGS (shared by deals, events, secrets)
`src/systems/Boons.js`: `player.curses[]`, `player.blessings[]`, `gainCurse(rng)` picks a random not-owned curse (none left = no-op), `removeCurse()`, `gainBlessing(id?)`. `applyBoons(player, stats)` from `recomputeStats` after items. HUD: relic strip shows curses as red-ringed icons after items, blessings gold-ringed; tooltip on hover. Max one of each curse (4 total).
| id | effect |
|---|---|
| `curse_debt` | `Player.price(base)` = ceil(base x 1.5) (discounts applied first) |
| `curse_dark` | 25% of modifier-less normal rooms are `darkness` |
| `curse_rot` | elite chance x2 (elites still drop extra) |
| `curse_lead` | moveSpeed -40, rollCooldown +0.3 |
Icons: `icons_events` cells `curse_debt curse_dark curse_rot curse_lead bless_steady bless_grace bless_iron bless_fleet`. Toasts `CURSED: <NAME>` / `BLESSED: <NAME>` (bus `ui:toast`), stingers `curse_gain` / `blessing_gain`.

## 10. Where each system hooks into existing code
| file | change |
|---|---|
| `config.js` | `VARIETY`, `ROOM_TYPES`, `MODIFIERS`, `AFFIXES` numbers, new template chars |
| `gen/Templates.js` | VALID += `Q s Z G`; BLOCKING += `G Z`; kinds `crossroads event champion supersecret`; validator rules above; `pick(floor,'event',...)` by id |
| `gen/FloorGen.js`, `gen/Variety.js` | section 1.3 |
| `gen/templates/*` | 6 event, 6 champion, 1 crossroads, 1 vault, 3 secret variants, +4 normal (`f1_17`, `f1_18`, `f2_17`, `f3_17`), edited templates listed in section 6 |
| `rooms/Room.js` | bg/type dispatch, controllers, `onExplosion`, `ignite`, `onMiniDefeated`, wall-hit hook, `clearRoom` elite bonus, modifier reward, `walkableNear` skips `Q`, tile types `quicksand/retract/explosive/gravestone` |
| `rooms/RoomManager.js` | `enterPocket/leavePocket`, `jump(..., {at})`, `pockets` reset in `loadFloor` |
| `rooms/Door.js` | kind `champion` frame + tint |
| `entities/` | `HoldRing`, `HellGate`, `DealPedestal`, `FirePatch`, `Chest` (`free`), `Pickup` (`heart_container`), `Player` (`heartDebt`, `loseMaxHeart`, `reviveCharges`, `collect('heart_container')`, `price()` curse, quicksand slow via `speedMult`) |
| `enemies/` | `Affixes.js`, `types/duelist.js`, `Enemy.js` hooks, `registry` meta `affixBan` |
| `bosses/` | `MiniBoss.js`, `types/{ol_fury,hangman,motherlode,ash_deacon,stoker,bouncer}.js`, `BOSS_META` minis, `Boss` `opts.spriteKey` |
| `systems/` | `Boons.js`, `CodexHooks.js`, `Explosions.js` calls `room.onExplosion` |
| `ui/` | Minimap icons/glyphs, `Relics` curse/blessing rings, `BossBar` compact mini style, `Banner` reuse |
| `core/` | `rng.js` `subRng`, `events.js` header, `AudioHooks` rows, `RunState` fields, `Debug` API (`openGate`, `enterCrossroads`, `jump`, `spawnMini`, `setEvent`, `giveCurse`) |

## 11. Art asset list (total 14 generations of the ~130 budget)
All in the ink-cartoon woodcut style anchored on `art/style/style_c.png`; transparent PNG unless marked opaque; one generation each; sliced by `tools/sprites.py`.
| key | type | size | frames/cells | one-line art description |
|---|---|---|---|---|
| `bg_crossroads` | image, opaque, WebP | 1440x864 | 1 | dirt crossroads at night, blood-red sky, cracked moon, dead tree, signpost with all arrows pointing down, black table with candles top centre; leave the centre lane open |
| `npc_dealer` | strip | 160x160 | 6 | tall gaunt figure in a black frock coat and top hat, pale face with a too-wide grin, goat-yellow eyes, fanning a deck of cards; 0-3 idle sway, 4 beckons with a finger, 5 head thrown back laughing |
| `props_deals` | grid 4x2 | 128x128 | `hellgate_a hellgate_b deal_table signpost candelabra dead_tree skull_pile ledger_book` | hellgate = jagged fissure in the ground glowing red-orange (a/b = two flicker states); deal_table = stone slab with a burning candle and a parchment contract under a quill |
| `props_events` | grid 4x2 | 192x192 | `card_table well wagon_oil confessional grave_mound grave_open duel_post altar_shrine` | card_table: round felt table, lantern, grinning skeleton gambler holding a card fan; well: mossy stone well with a rusted bucket; wagon_oil: painted wagon with bottles and a lanky salesman in a striped vest; confessional: wooden booth, candles, hooded silhouette; grave_mound/open: fresh dirt with a shovel / open pit with a coffin corner; duel_post: gallows-style post with a brass bell and a boot-print chalk mark; altar_shrine: stacked skulls and candles |
| `icons_events` | grid 4x2 | 96x96 | `bless_steady bless_grace bless_iron bless_fleet curse_debt curse_dark curse_rot curse_lead` | small emblem icons: blessings gold-lit (hand on a gun, four-leaf clover, tin star, winged spur), curses red-lit (burning IOU note, closed eye, rotten skull, ball and chain) |
| `props_small` | grid 4x2 | 96x96 | `potion_bottle card_back card_face chip_stack heart_container wanted_poster chalk_x rock_chunk` | potion_bottle is WHITE glass so code can tint it; card_face is blank cream for text overlay; heart_container is a gold-edged heart with a small key-lock; wanted_poster is a torn poster with a horned skull |
| `obst_hazards` | grid 4x2 | 96x96 | `quicksand gravestone spikes_ret_down spikes_ret_warn spikes_ret_up powder_barrel rubble scorch` | neutral palette so floor tints work (quicksand = swirled sand pit with bubbles; scorch = black burnt ground decal with ash) |
| `fx_fire` | strip | 96x96 | 6 loop | small ground fire puddle, orange/yellow flames, ink outline |
| `enemy_ol_fury` `enemy_hangman` `enemy_motherlode` `enemy_ash_deacon` `enemy_stoker` `enemy_bouncer` | strips | 192x192 | 6 each | see 4.4 |
Reused with code only: `duelist` (tinted `enemy_outlaw`), stampede bulls (tinted `enemy_coyote`), rocks (`props_small rock_chunk`), cards (drawn), light masks (canvas), elite rings/glyphs (`ring`, Graphics), FirePatch light (`glow`), heart shatter (`hud_icons`), minimap glyphs (Graphics), champion door (tinted boss door), cracks (Graphics), event backgrounds (floor bgs).
Loading: register in the manifest via `build_manifest.py` (no code changes needed); placeholders come from `Assets.makeCell`/`makeSprite` fallback. Add each strip to `art/prompts/`.

## 12. RNG rules and daily seed (only what this doc needs)
- New helper in `src/core/rng.js`: `subRng(label, ...parts) => new RNG(hashStr([label, getSeed(), ...parts].join(':')))`. Every stream named in this doc uses it or `RNG(hash(room.seed, ...))`. Never `rng.game` for these (its state depends on how many rolls the player caused earlier).
- Content identical for everyone on the daily seed: floor layout, modifiers, event id per floor, minis, secret variants/tells, gate roll (`subRng('gate', floor)` — but `bossHitsTaken` and curses are behaviour; documented as the ONLY behaviour-dependent inputs), crossroads offers (item ids come from `ItemSystem` which excludes already-taken items, so offers can differ after different play; accepted), potion colours, event outcome tables (per action index `n`, not per call order), duel draw delay, elite rolls, graveyard composition.
- Outcome rolls are functions of `(room.seed, label, n)` so reordering actions cannot reroll an outcome; a redone action (never possible: a bet/throw is consumed) has no effect.
- Meta doc requirements: `initSeed()` accepts a numeric seed derived from `daily:YYYY-MM-DD`; `run.daily` is set before `RoomManager.loadFloor(1)`; the run must not read wall-clock or `Math.random` for any content decision (audit list: `Room.js` lights and `Pickup.js` scatter are cosmetic).
- Difficulty modes: expose `VARIETY.difficulty = {elite.chanceMult, mod.chanceMult, mini.hpMult, xroads.baseChance}`; no other coupling.

## 13. Audio needs (keys; existing `MIX` conventions; add `EVENT_SFX` rows)
| group | keys |
|---|---|
| crossroads | `hellgate_open`, `hellgate_enter`, `dealer_laugh` (x2), `dealer_mumble` (short tick loop), `contract_hover` (paper), `contract_sign` (quill + thunder), `heart_pay` (wet thud), `curse_gain`, `blessing_gain`, `revive_ace`; music `mus_crossroads` (dry guitar, low choir), ambience `amb_crossroads` |
| events | `card_flip`, `card_win`, `card_lose`, `chip_place`, `well_plink`, `well_wish`, `shovel_dig`, `grave_crack`, `grave_open`, `bottle_pop`, `potion_gulp`, `bell_toll`, `duel_draw` (gunshot crack + whoosh), `quick_draw_ding` |
| mini | `mini_intro`, `bull_snort`, `chain_whirl`, `rock_crumble`, `censer_swing`, `steam_hiss`, `glass_break`; music `mus_miniboss` (short percussive loop) |
| elites | `elite_spawn`, `elite_ting` (armored hit), `elite_pop` (volatile fuse) |
| hazards/mods | `quicksand_bubble`, `spikes_ret`, `fire_crackle` (loop, low), `stampede_rumble`, `stampede_hoof`, `rock_warn`, `rock_impact`, `lurch_creak`, `blood_moon_howl` (once on entry), `wall_knock`, `secret_reveal` reuse `door_unlock` |
Most of these are pitch/rate variants of existing files (`Sfx.play(key, {rate,vol})`); genuinely new recordings needed: crossroads music + ambience, mini music, `dealer_laugh`, `contract_sign`, `bell_toll`, `stampede_rumble`, `card_flip`. Licences logged in `CREDITS_*.md`.

## 14. Test / acceptance summary
- `npm run selftest` extended: templates valid (new chars, kinds, floor coverage: each floor has >= 1 champion, 6 events, 1 crossroads, secret variants, `f*_17`), floorgen 300 seeds x floors 1-6 (section 1.3 invariants, determinism, extras <= caps).
- New scripts under `tools/qa/`: `events-sim.mjs` (probabilities), `xroads-sim.mjs` (gate chance/pity), `mini-bot.mjs` (each mini beatable), `elite-telegraph.mjs`, `mod-check.mjs`, `secret-check.mjs`; plus one full-run bot (`bot.mjs`) that visits the pocket, one event, the champion room and a modifier room without console errors, at 55+ fps with 40 bullets.
- Manual checklist: gate spawn/enter/leave feel; hold-ring readability; contract card text fits; heart debt shown correctly in HUD; darkness readable (enemy bullets visible); fog not unfair; stampede telegraph; all minis fair with a roll; elite rings distinguishable at a glance; `?noassets=1`, `?dropassets=30`.
- Acceptance: nothing in this doc can soft-lock (all events/pockets exit-able; locks only during fights that can end; key room unaffected by champions/events); saving/reloading not required mid-run (permadeath).

## 15. Scope guards (do NOT build)
- No shop/treasure replacement by Crossroads; no devil room on floor 6; no re-rolling deals; no second Dealer NPC; no per-item art for the crossroads items (items doc owns them).
- No new enemy types beyond `duelist` and the six minis; no affix stacking beyond 2; no elites in boss rooms, mini rooms or as adds; no new bullet art.
- No shaders, no dynamic light textures beyond the RenderTexture mask, no per-frame allocations in modifiers/FirePatch (pool sprites, reuse Graphics).
- No new keys/buttons: all interactions are walk-in + hold-ring; no gamepad-only paths; no mouse UI in events.
- No event that requires currency other than coins/hearts/keys; no more than one event room, one champion room, one Crossroads per floor; no events on floor 6 beyond the 40% roll; no modifier on start/shop/treasure/boss/secret/champion/event rooms.
- No procedural-generated event text beyond the fixed line tables; no localisation work; no save-mid-room persistence beyond `RoomManager.states` (in-memory).
- Do not change: player stats defaults, existing item defs, existing boss behaviours, existing 65 templates except the listed edits.

## Integrator notes
Authoritative reconciliation is `ARCH_V2.md` s0 (D1-D18).
- Mini `bouncer` is renamed `head_bouncer` (sprite `enemy_head_bouncer`) to avoid clashing with the F6 grunt `bouncer` (D1).
- Canonical event names are the ones in this doc; Meta aliases map to them (D4).
- Fire uses the unified `FirePatch` (D2); elite formula and `all_cursed` behavior per D3.
- Crossroads offers L/C/R per D6; `heartDebt` is the single counter.
- Checkpoint per D10; Hell's Welcome and the Daily flow per ARCH s13.
- Six mini sprites are generated as 3 pair sheets at 192 px (ASSET_SPEC_V2 s3); `fx_fire` is cut.
