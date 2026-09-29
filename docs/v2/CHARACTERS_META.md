# DEAD WEST v2 - Characters & Meta-Progression (design + implementation spec)

Owner doc for: 3 new playable characters, character select, Save v2 + migration, unlock engine, achievements, Bounty Board (challenge runs), Codex, Notoriety ranks, difficulty modes (Normal / Hell on Earth / Daily Ride), run-summary + settings additions.
Source of truth for existing code: `src/config.js` (PLAYER_BASE), `src/entities/Player.js` (`recomputeStats`, `fire`, `damage`), `src/core/Save.js`, `src/core/events.js`, `src/scenes/*`, `src/ui/UiKit.js`. Chapter 2 becomes floors 4-6 (`MAX_FLOOR = 6`, set by the FLOORS doc). This doc never names chapter-2 bosses/enemies/items by id: it keys on `floor` numbers, registries and item `gate` tags, so it works with whatever the sibling v2 docs define.

## 0. Conventions and new files

| Path | Purpose |
|---|---|
| `src/data/characters.js` | `CHARACTERS`, `CHAR_ORDER`, `startStats(charId)` (pure data, node-safe) |
| `src/data/difficulty.js` | `DIFFICULTY`, `MUTATORS`, `DAILY_POOL`, `dailyFor(dateStr)` (pure data) |
| `src/meta/Meta.js` | singleton engine: run tracking, condition evaluation, unlock grants, notoriety, daily/board bookkeeping. Subscribes to the bus once at Boot (NOT scene-scoped) |
| `src/meta/achievements.js`, `bounties.js`, `unlocks.js`, `ranks.js`, `score.js`, `lore.js`, `codexText.js` | pure data + pure predicates (no Phaser) so `tools/qa/meta-test.mjs` can replay event scripts in node |
| `src/meta/migrate.js` | Save v1 -> v2 |
| `src/scenes/CharSelectScene.js`, `DailyScene.js`, `BoardScene.js`, `CodexScene.js` | new scenes (all `extends Phaser.Scene`, reuse `UiKit`) |
| `src/ui/AchievementToast.js`, `StatBars.js`, `TabBar.js`, `Silhouette.js` | shared widgets |
| `src/items/defs/sermon_bible.js`, `hunters_ledger.js`, `gilded_pair.js` + `src/items/familiars/FaithMeter.js`, `WantedMark.js` | character-only relics and their controllers |

Ids are snake_case. Unlock ids are namespaced: `char:<id>`, `mode:<id>`, `gate:<id>`, `title:<id>`. New scene keys: `CharSelect`, `Daily`, `Board`, `Codex`.
Menu order (MenuScene, gap 64, size 46, y=500..820; controls text moves to y=880+): RIDE OUT, DAILY RIDE (hidden until `mode:daily`), BOUNTY BOARD, CODEX, OPTIONS, CREDITS. The old Bounty Board stats modal moves into Codex > RECORD. Menu shows a Notoriety chip top-left (rank title, bar, NP).

## A. PLAYABLE CHARACTERS

### A1. Roster and stat table
`CHAR_ORDER = ['gunslinger','preacher','hunter','queen']`. Base values from `PLAYER_BASE`; a character only lists overrides (`stats`); everything else inherits. `Player` gets `charId`; `recomputeStats()` starts from `{...PLAYER_BASE, ...CHARACTERS[id].stats}` instead of `PLAYER_BASE` (items, buffs, mutators then apply as today). Start coins/keys/dynamite/tin come from the character (`start`) instead of `PLAYER.startCoins/Keys/Dynamite`.

| stat | Gunslinger (base) | Preacher | Bounty Hunter | Outlaw Queen |
|---|---|---|---|---|
| name / alias | The Gunslinger (unnamed) | Rev. Josiah Thorne, "The Hangman's Chaplain" | Cormac Rook, "Paid In Full" | Maude Marlowe, "Queen of Spades" |
| role | all-rounder, Sixth Bullet | tank, close-range shotgun sermon | glass-cannon sniper, dynamite | fast dual guns, coin economy |
| maxHearts | 3 | 3 | 2 | 3 |
| start tin units | 0 | 4 (2 tin hearts) | 0 | 0 |
| damage | 3.5 | 2.4 per pellet | 7.5 | 2.0 |
| bulletCount / spreadDeg | 1 / - | 5 / 9 | 1 / - | 1 / - |
| inaccuracy (deg) | 0 | 2 | 0 | 2.5 |
| fireDelay (s) | 0.33 | 0.66 | 0.62 | 0.19 |
| range (s) x shotSpeed | 0.55 x 780 (429 px) | 0.30 x 900 (270 px) | 0.80 x 1150 (920 px) | 0.50 x 850 (425 px) |
| bulletSize | 1 | 1.1 | 0.8 | 0.85 |
| pierce | 0 | 0 | 1 | 0 |
| moveSpeed | 330 | 290 | 385 | 350 |
| luck | 0 | 0 | 0 | 1 |
| rollDistance / rollCooldown | 240 / 1.0 | 200 / 1.3 | 290 / 0.8 | 260 / 0.9 |
| sixthEvery / sixthMult / sixthPierce | 6 / 2 / 1 | 6 / 1.5 / 2 | 6 / 2.2 / 2 | 6 / Jackpot (see A4) / 1 |
| dynamite: start / damage / fuse | 1 / 60 / 1.4 | 1 / 60 / 1.4 | 3 / 80 / 1.0 | 1 / 60 / 1.4 |
| start coins | 0 | 0 | 0 | 10 |
| flatDmgScale (see below) | 1 | 0.65 | 1 | 1 |
| nominal DPS (dmg/fireDelay, x pellets) | 10.6 | 18.2 point-blank (about 7 at 250 px) | 12.1 (pierces, 920 px) | 10.5 base, up to 17 at 50 coins |
| starting items | none | `sermon_bible`, `whiskey_bottle` | `hunters_ledger`, `bandolier` (dynamite = 3 + 4 = 7) | `gilded_pair`, `cursed_coin` |
| unlock | default | defeat the floor-2 boss (`boss:defeated{boss=grimm}`) | defeat the floor-3 boss (`boss:defeated{boss=undertaker}`) | win a run (`run:ended{variant=complete}`) |

`flatDmgScale`: after all items apply, `stats.damage = charBase.damage + (stats.damage - charBase.damage) * flatDmgScale`. Stops flat `hollow_point`-style bonuses multiplying across 5 pellets (Preacher only). The Sixth Bullet and cylinder HUD stay 6-slot for everyone (do not change `sixthEvery`; `Cylinder` widget assumes 6).

New `PLAYER_BASE` keys (defaults, all additive-safe): `tinPlating:0`, `dualGuns:0`, `markMult:1`, `markBossMult:1`, `coinDamage:0`, `jackpotBase:0`, `jackpotPerCoin:0`, `jackpotKillCoins:0`, `coinDropBonus:0`, `damageTakenMin:0` (mutators), `killHeal:0`.

### A2. THE PREACHER - "Sermon"
Fantasy: walking pulpit. Slow, sturdy, deletes anything that lets him get close; a loaded armour bar buys mistakes; holy vs the dead.
- Kit: 5-pellet spread (fans +-18 deg), 270 px reach, slow fire; roll is short and slow to recharge (he is meant to tank, not dance).
- Relic `sermon_bible` (character-only, `pool: []`, `charOnly:'preacher'`): `apply` sets `tinPlating = 1`, `undeadDamageMult *= 1.5`. `FaithMeter` familiar (draws a thin gold arc r=40 around the player like the roll-cooldown ring, plus a small cross HUD icon in `Relics`):
  - Faith 0..100. +8 per enemy kill within 400 px, +25 per elite / miniboss kill, +4 extra when the kill was by the Sixth Bullet, +0.4 per hit on a boss. No decay. Not gained while Sanctified.
  - At 100: Faith resets to 0 and `addBuff('sanctified', ..., 8)`: `bulletDamageMult *= 1.5`, `pierce += 1`, `luck += 1`; heals 1 HP unit once; gold halo (`glow` image tint 0xffe090 under feet), pale-gold bullet tint, sfx `item_get` (rate 0.8) + `room_clear`.
  - `tinPlating`: in `Player.damage`, if `tin > 0` the hit is capped at 1 unit (`units = Math.min(units, 1)`) - a 2-unit boss slam only costs 1 tin. Explosions included.
- Sixth Bullet = "AMEN": x1.5, pierce 2, size 1.5, +4 Faith on kill.
- Sprite direction: black frock coat + tin-plated breastplate, wide flat hat, white collar, big brass cross, pump shotgun; weathered, one milky eye.
- Unlock hint (locked card): "Absolve the Marshal - defeat Marshal Grimm."

### A3. THE BOUNTY HUNTER - "Wanted"
Fantasy: patient predator. Long piercing rifle shots, high mobility, one heart from death, and dynamite as a second weapon.
- Kit: 7.5 dmg / 0.62 s, pierce 1 (Sixth: pierce 3 total, x2.2), 920 px reach, fast roll (290 px / 0.8 s), 4 HP units only.
- Relic `hunters_ledger` (`pool: []`, `charOnly:'hunter'`): `apply` sets `markMult = 1.5`, `markBossMult = 1.2`. `WantedMark` controller (a familiar):
  - When a wave spawns (`spawn:telegraph`/`enemy:spawned` batch, non-boss room), mark the living enemy with the highest `maxHp` (ties: nearest). A marked enemy shows a small code-drawn WANTED poster (parchment rectangle 26x34 with "$") above its head and a dark red outline tint.
  - `Enemy.takeHit`: `if (this.marked && p) d *= this.isBoss ? p.stats.markBossMult : p.stats.markMult`. The boss is marked at fight start (no payout).
  - Payout on marked kill: drop 1 `coin_nickel` + 1 `coin`; 35% +1 `dynamite`. If the marked enemy dies to the player's own dynamite: guaranteed +1 dynamite instead ("blast bounty"). Emits `mark:collected {id, by}` (used by challenges/achievements).
  - Cap: 1 mark per wave; a killed mark is not replaced until the next wave.
- Dynamite: start 3 (+4 bandolier = 7), damage 80, fuse 1.0 s, radius 150 (195 with bandolier).
- Sprite direction: long duster, low-brim hat with tin badge, scarf over the face, lever rifle held two-handed, bandolier of dynamite; lean silhouette.
- Unlock hint: "Collect on the Undertaker - defeat the floor-3 boss."

### A4. THE OUTLAW QUEEN - "High Roller"
Fantasy: charming gambler who converts her purse into firepower. Fastest fire rate, low per-hit damage, crits via luck, and a constant tension between spending coins and holding them.
- Kit: dual revolvers alternate sides each shot (`dualGuns`: muzzle offset +-14 px along the perpendicular, alternating; visuals only, hitbox unchanged), 5.3 shots/s, luck 1 (+2 from `cursed_coin` = 3 -> 9% x1.5 crit via the existing luck-crit), coins x2 and shop -1 (from `cursed_coin`).
- Relic `gilded_pair` (`pool: []`, `charOnly:'queen'`): `apply` sets `dualGuns = 1`, `coinDamage = 0.008`, `jackpotBase = 1.6`, `jackpotPerCoin = 0.02`, `jackpotKillCoins = 3`, `coinDropBonus = 0.08`.
  - In `Player.fire`: `dmg = s.damage + s.coinDamage * this.coins` (coins read at fire time; +0.8 max at 99 coins).
  - Sixth Bullet = JACKPOT: `mult = jackpotBase + jackpotPerCoin * coins` (1.6 at 0 coins, 3.58 at 99), gold coin-shaped tint, larger muzzle flash; a Jackpot kill drops `jackpotKillCoins` coins. It never costs coins.
  - `coinDropBonus` adds to `ROOM_REWARD.enemyCoin` (0.10 -> 0.18).
- Balance intent: at 0 coins she is a plain 10.5 DPS fast gun; at ~50 coins about 17 DPS. Spending in shops is a real choice.
- Sprite direction: wide feathered hat with a spade pin, red velvet corset-coat with fur collar, gold-toothed grin, twin nickel revolvers, coin necklace.
- Unlock hint: "Cash out - win a run."

### A5. Sprite requirements (per new character; all art is 128x128 frames, anchor bottom, faces camera / RIGHT like the gunslinger)
Keys (prefix `player_<id>`; the gunslinger keeps the existing `player_*` and `portrait_player` keys): `player_<id>_walk_down` 6f, `_walk_up` 6f, `_walk_side` 6f (faces RIGHT), `_fire` 3f ([0] down, [1] up, [2] side), `_roll` 4f, `_death` 5f, plus `portrait_<id>` 512x512 (transparent bust). `Player` resolves `this.skin = charId === 'gunslinger' ? 'player' : 'player_' + charId`; `Assets.has(skin + '_walk_down')` false -> fall back to `player_*` with a tint (0xb0b0ff preacher, 0xd0a070 hunter, 0xffd070 queen) so the game always runs.
Generation plan per character = 4 generations (12 total): G0 turnaround/anchor sheet (front/back/side, saved as `art/style/player_<id>_anchor.png`, used as reference for the rest); G1 walk sheet (768x384: rows down/up/side, 6 cols) sliced to 3 strips; G2 action sheet (768x384: row1 fire x3, row2 roll x4, row3 death x5, empty cells transparent) sliced to 3 strips; G3 portrait 512. Same ink-woodcut style, big head, thick outline, red not used as the main hue for the new three (gunslinger stays the red poncho): Preacher = black + brass, Hunter = tan/olive + green scarf, Queen = purple + gold.
Meta icons for the relics live in `meta_icons` (see E).

### A6. CHARACTER SELECT (`CharSelectScene`)
Entry: RIDE OUT (last used char preselected) and Game Over "ride again" skips it (re-uses `Save.settings().lastChar/lastMode`). Layout (1440x960):
| Region | Content |
|---|---|
| Background | `ui_charselect_bg` (painted saloon back wall with pinned wanted posters, dusk light) + 0.35 black vignette |
| Header y=70 / 118 | "CHOOSE YOUR RIDER" (title 64 bone); under it rank title + NP bar (360x10) + "NP 1,240 / 1,600" |
| Left poster x=400,y=470 | `parchment` w=720; `portrait_<id>` 340x340 at (400,430), angle -2 deg; name (title 34, ink) y=632; alias italic 22 y=668; 3 mark stars (`meta_icons` star_tin/silver/gold, grey when unearned) y=702 |
| Right sheet x=1050,y=470 | dark `parchment` w=640: class name (title 44) + tagline (body 22); 6 stat bars; relic row (icon 72 + name + desc wrapped 470 px); "STARTS WITH" row of 2 icons (0.6 scale) |
| Roster y=790 | 4 tokens 120x120 circular portrait crops, spacing 170, centred; selected = x1.15 + brass ring; locked = black silhouette + `padlock`; mark pips below |
| Mode row y=872 | chips `NORMAL` / `HELL ON EARTH` (locked: padlock + hint "Win a run to unlock"); Daily is entered from the menu, not here |
| Footer y=930 | "A / D  rider     W / S  mode     ENTER  ride out     ESC  back" |
Stat bars (10 segments, computed from `startStats(id)` = base + character `stats` + starting items' `apply`, so the bars are honest): HEARTS `maxHearts + tin/2` / 6; DAMAGE `damage * bulletCount` / 8 (label "DAMAGE (POINT BLANK)"); FIRE RATE `(1/fireDelay)` / 6 per second; RANGE `range*shotSpeed` / 900; SPEED `moveSpeed` / 40; LUCK `luck` (1 segment per point, cap 10). Each bar draws a thin tick at the Gunslinger's value for comparison; segments fill with a 40 ms stagger when the character changes; number shown at right (e.g. `9`).
Input: `ArrowLeft/A`, `ArrowRight/D` cycle riders (wrap), `1..4` jump, `ArrowUp/W`, `ArrowDown/S` toggle mode, `Enter/Space` start, `Esc` back to Menu. Mouse: click token = select, click chip = mode, big brass arrows at x=90 / x=1350 y=470, click the "RIDE OUT" plaque (x=720,y=930) = start; hover tokens shows the name. Starting a locked rider: shake the poster 6 px, `shop_deny` sfx, unlock hint pulses amber (never starts). Start -> `scene.start('Game', {char, mode})` after the same 320 ms fade the menu uses; remembers choice via `Save.setSetting('lastChar'|'lastMode')`.
Locked card: silhouette portrait (`setTintFill(0x1a100c)`), name "???", bars replaced by "- - - -", unlock hint in large ink text (hints in A1 / A2..A4).

## B. META-PROGRESSION

### B1. Save v2 (`src/core/Save.js`, key `deadwest.save.v2`)
`Save.get()` API stays (returns the cached object); the `DEFAULT` object below replaces the old one; helper additions: `Save.stat(path, n=1)`, `Save.max(path, v)`, `Save.flag(id)`, `Save.unlocked(id)`, `Save.grant(id)`, `Save.persistSoon()` (debounced 800 ms), `Save.export()` (base64 JSON), `Save.import(str)` (validate `v===2`, run `repair`), `Save.resetProgress()` (keeps `settings`). Persist points: run end, unlock/achievement grant (immediate), room clear (debounced), `beforeunload` and `visibilitychange:hidden`. Every storage call try/catch as today; if storage throws, keep the in-memory cache and show no error.
```
{ v: 2, created: ts, updated: ts,
  settings: { mute, volume, music, sfx, shake: true, shakeAmt: 1, flash: true, bulletOutline: false, dmgNumbers: false,
              runTimer: true, autoPause: true, lastChar: 'gunslinger', lastMode: 'normal', title: 'rank' },
  stats: {                       // lifetime counters (see B7 for meanings)
    runs, deaths, wins, abandons, kills, playTime, bountyEarned, coinsCollected, coinsSpent, keysUsed, dynamitePlaced, dynamiteKills,
    shots, sixthShots, sixthKills, deadEyeKills, rolls, hits, damageTaken, itemsPicked, roomsCleared, hitlessRooms, secrets, shopBuys,
    chests, deals, eventsDone, minibosses, elites, floorsDescended, marksCollected, bountiesDone, dailyRuns,
    k: { <enemyId>: n }, bk: { <bossId>: n } },
  best: { floor: 0, time: { normal: 0, hell: 0 }, killsInRun: 0, reward: 0 },
  chars: { <charId>: { unlocked, runs, wins, bestFloor, marks: { undertaker: 0|1, final: 0|1, hell: 0|1 } } },
  codex: { enemies: { <id>: { seen: 0|1, kills } }, items: { <id>: 0|1|2 },        // 1 seen, 2 owned
           bosses: { <id>: { seen, killed, bestFight: seconds, noHit: 0|1 } }, lore: { <id>: ts } },
  ach: { <id>: ts }, achProg: { <id>: n },   // ach = unlocked, achProg = event counters for `EC` conditions
  unlocks: { 'char:preacher': ts, 'gate:pyro': ts, ... },
  bounty: { <id>: { done: ts|0, tries, best: { time, reward } } },
  notoriety: { np: 0, rank: 1 },
  daily: { lastDate: 'YYYY-MM-DD', streak: 0, bestStreak: 0, entries: [ { date, score, char, floor, won, time, mutator, hell } ] },  // max 200, newest last
  history: [ { t, char, mode, floor, won, time, kills, reward, killedBy, seed } ],   // last 25 runs
  flags: { introSeen, ... } }
```
Migration (`migrate.js`, runs once in `load()` when `v2` is absent and `deadwest.save.v1` exists; the v1 key is left untouched as a backup): copy `runs, deaths, wins, kills, playTime, bestKills -> best.killsInRun, bestTime -> best.time.normal, bestFloor -> best.floor`; `itemsSeen[] -> codex.items[id]=2`; `settings` merged (old `shake` bool kept, `shakeAmt = shake ? 1 : 0`); retro-credit generously: `wins>=1` => `bk.cascabel/grimm/undertaker = 1`, `chars.gunslinger.marks.undertaker = 1`, grant `char:preacher`, `char:hunter`, `mode:daily` and achievements `rattle_silenced`, `lawless`, `last_rites`; else `bestFloor>=3` => `bk.cascabel=bk.grimm=1` + `char:preacher` + those two achievements; `bestFloor>=2` => `bk.cascabel=1` + `rattle_silenced`. Notoriety = `floor(kills*25/100) + sum(achievement NP)` recomputed. Invalid/corrupt JSON -> start fresh v2, never throw. `repair()` clamps counters >= 0 and drops unknown keys' types.

### B2. Unlock engine (`Meta.js`)
`unlocks.js` table (`id`, `type`, `label`, `hint` shown on locked UI, `source`): granted only through `Meta.grant(id, source)`, which writes `save.unlocks[id]`, emits `meta:unlocked {kind:'char'|'mode'|'gate'|'title', id, label}` (HUD/menus show a toast + `item_get` sfx) and is idempotent.
| Unlock id | Effect | Source |
|---|---|---|
| `char:preacher` | selectable on CharSelect | achievement `lawless` |
| `char:hunter` | selectable | achievement `last_rites` |
| `char:queen` | selectable | achievement `debt_paid` |
| `mode:hell` | Hell on Earth chip enabled | achievement `debt_paid` |
| `mode:daily` | DAILY RIDE menu entry | achievement `last_rites` |
| `gate:<name>` x12 | items whose def has `gate:'<name>'` enter treasure/shop/boss/secret pools | see B3 |
| `title:<id>` x9 | selectable poster title (Codex > RECORD) | achievements / bounties / ranks |
Item gating: `registerItem` accepts `gate?: string` and `charOnly?: charId`. `ItemSystem.roll` filters candidates with `!d.charOnly && (!d.gate || Meta.itemsOpen || Save.unlocked('gate:'+d.gate))`. `Meta.itemsOpen = true` for Daily and Bounty contract runs (all gates open, so seed-mates get identical pools) and for `?unlockall=1`. Gated-but-locked items appear in the Codex as silhouettes with the hint "Unlocked by: <label>". A fresh save gets 28 original items + the ungated new items; the 12 gates cover about 14 of the +40 new items (assigned in the ITEMS doc via `gate:`; each gate should hold 1-2 items themed as below).
| Gate id | Theme | Unlocked by |
|---|---|---|
| `gate:pyro` | dynamite/explosions | achievement `fire_in_the_hole` |
| `gate:holy` | blessed/undead-bane | achievement `amen` |
| `gate:sniper` | pierce/range/dead-eye | achievement `paid_in_full` |
| `gate:gambler` | coins/luck/shops | achievement `all_in` |
| `gate:occult` | secrets/curses | achievement `wall_knocker` |
| `gate:bloodpact` | devil-deal exclusive power | achievement `souls_sold` |
| `gate:chaos` | wild synergy enablers | achievement `combo_rider` |
| `gate:lawman` | armour/tin/order | achievement `contract_killer` |
| `gate:undead` | familiars/ghost allies | contract `bt_glass_jaw` |
| `gate:beast` | speed/animal | contract `bt_stampede` |
| `gate:scrap` | bullets/junk/ricochet | contract `bt_rusty_iron` |
| `gate:ghost` | phasing/evasion | contract `bt_all_cursed` |
Debug/cheat runs (`?debug=1`, `godMode`, `?unlockall`) set `Meta.enabled = false`: no achievements, stats, notoriety, codex writes, history or daily entries are recorded.

### B3. Condition grammar (achievements and contracts share it)
Conditions are strings compiled once by `compileCond()` in `achievements.js` (pure functions of `(save.stats, run, evt)`), `&` = AND:
- `L.<stat> >= N` lifetime stat (`L.k.<enemyId>`, `L.bk.<bossId>` allowed); re-checked when that stat changes (engine keeps `byStat[stat]` index).
- `R.<stat> op N` current run stat (list B7); checked after every event that touches it.
- `E <evt>{k=v,k2<=v2}` one occurrence of a bus event whose payload matches (`=,<=,>=,<,>`; payload fields are the ones in B8); indexed by `byEvent`.
- `EC <evt>{...} xN` cumulative lifetime count, stored in `achProg[id]`.
- `M.<char|all>.<mark>` character marks (`undertaker|final|hell`); `M.all.<mark>` = true for all 4 riders. Marks are earned only on Normal/Hell runs (never Daily/contract), `final` = `run:ended{variant=complete}`, `hell` = same with `mode=hell`, `undertaker` = `boss:defeated{boss=undertaker}`.
- Win semantics: `run:ended.variant` is `death | complete | contract`. `complete` = the real final boss defeated in a Normal, Hell or Daily run. A finished contract ends as `variant='contract'` (`won:true`), never `complete`, so contracts cannot grant win-gated unlocks/achievements; boss-kill and stat achievements still count.
- Suffix `@end` = only evaluated on `run:ended` (needs the finished run).
Progress bars (`[cur,max]`) are derived automatically for `L`/`EC` conditions.

### B4. ACHIEVEMENTS (44; NP = Notoriety points; `hidden` = shows "???" until earned)
Toast on unlock: `AchievementToast` (see D5); tracked in `save.ach[id] = ts`. All grants ignore runs where `Meta.enabled === false`.
| id | Name | Description | Condition | Reward |
|---|---|---|---|---|
| `first_blood` | First Blood | Slay your first enemy | `L.kills >= 1` | 10 NP |
| `saddle_sore` | Saddle Sore | Start 10 rides | `L.runs >= 10` | 10 NP |
| `lifer` | Lifer | Start 50 rides | `L.runs >= 50` | 30 NP |
| `gravedigger` | Gravedigger | Slay 500 enemies | `L.kills >= 500` | 25 NP |
| `mass_grave` | Mass Grave | Slay 5,000 enemies | `L.kills >= 5000` | 100 NP, `title:gravedigger` |
| `sixth_son` | Sixth Son | 100 kills with the Sixth Bullet | `L.sixthKills >= 100` | 25 NP |
| `patience` | Patience Pays | 25 kills with Dead Eye shots | `L.deadEyeKills >= 25` | 25 NP |
| `fire_in_the_hole` | Fire in the Hole | 100 kills by dynamite | `L.dynamiteKills >= 100` | 40 NP, `gate:pyro` |
| `curse_breaker` | Curse Breaker | Slay 50 cursed elites | `L.elites >= 50` | 30 NP |
| `head_collector` | Head Collector | Slay 10 mini-bosses | `L.minibosses >= 10` | 30 NP |
| `rattle_silenced` | Rattle Silenced | Defeat El Cascabel | `E boss:defeated{boss=cascabel}` | 20 NP |
| `lawless` | Lawless | Defeat Marshal Grimm | `E boss:defeated{boss=grimm}` | 40 NP, `char:preacher` |
| `last_rites` | Last Rites | Defeat The Undertaker | `E boss:defeated{boss=undertaker}` | 60 NP, `char:hunter`, `mode:daily` |
| `deeper_still` | Deeper Still | Defeat the floor-4 boss | `E boss:defeated{floor=4}` | 60 NP |
| `point_of_no_return` | Point of No Return | Defeat the floor-5 boss | `E boss:defeated{floor=5}` | 80 NP |
| `debt_paid` | Debt Paid | Defeat the final boss | `E run:ended{variant=complete}` | 200 NP, `char:queen`, `mode:hell` |
| `untouchable` | Untouchable | Defeat any boss without being hit | `E boss:defeated{noHit=1}` | 40 NP |
| `dead_in_seconds` | Dead in Seconds | Defeat a boss in under 40 s | `E boss:defeated{fightTime<=40}` | 40 NP |
| `charmed_life` | Charmed Life | Clear 8 rooms in a row without a scratch | `R.hitlessStreak >= 8` | 30 NP |
| `ghost_rider` | Ghost Rider | Win taking 5 hits or fewer | `E run:ended{variant=complete,hits<=5}` | 150 NP, `title:ghost_rider` |
| `quickdraw` | Quickdraw | Win in under 35 minutes | `E run:ended{variant=complete,time<=2100}` | 100 NP, `title:quickdraw` |
| `hell_on_earth` | Hell on Earth | Win on Hell on Earth | `E run:ended{variant=complete,mode=hell}` | 300 NP, `title:hellraiser` |
| `pocket_change` | Pocket Change | Collect 1,000 coins | `L.coinsCollected >= 1000` | 20 NP |
| `big_spender` | Big Spender | Spend 500 coins | `L.coinsSpent >= 500` | 30 NP |
| `tycoon` | Tycoon | Hold 99 coins at once | `R.coins >= 99` | 20 NP |
| `magpie` | Magpie | Discover 30 relics | `L.itemsFound >= 30` | 20 NP |
| `hoarder` | Hoarder | Discover 60 relics | `L.itemsFound >= 60` | 40 NP |
| `complete_set` | Complete Set | Discover every relic | `L.itemsFound >= L.itemsTotal` | 100 NP, `title:curator` |
| `combo_rider` | Combo Rider | Trigger 3 different item synergies | `EC synergy:activated{} x3` (distinct ids counted by engine) | 30 NP, `gate:chaos` |
| `wall_knocker` | Wall Knocker | Reveal 10 secret rooms | `L.secrets >= 10` | 30 NP, `gate:occult` |
| `sign_here` | Sign Here | Accept a Crossroads deal | `E crossroads:deal{}` | 15 NP |
| `souls_sold` | Souls Sold | Accept 10 Crossroads deals | `L.deals >= 10` | 40 NP, `gate:bloodpact` |
| `clean_hands` | Clean Hands | Win without ever making a deal | `E run:ended{variant=complete,deals<=0}` | 50 NP |
| `amen` | Amen | Win with the Preacher | `E run:ended{variant=complete,char=preacher}` | 100 NP, `gate:holy` |
| `paid_in_full` | Paid in Full | Win with the Bounty Hunter | `E run:ended{variant=complete,char=hunter}` | 100 NP, `gate:sniper` |
| `all_in` | All In | Win with the Outlaw Queen | `E run:ended{variant=complete,char=queen}` | 100 NP, `gate:gambler` |
| `full_deck` | Full Deck | Earn all 12 character marks | `M.all.undertaker & M.all.final & M.all.hell` (every character) | 300 NP, `title:legend` |
| `daily_bread` | Daily Bread | Finish a Daily Ride | `E daily:finished{}` | 15 NP |
| `front_page` | Front Page | Score 12,000 on a Daily Ride | `E daily:finished{score>=12000}` | 50 NP |
| `contract_killer` | Contract Killer | Complete 10 Bounty Board contracts | `L.bountiesDone >= 10` | 60 NP, `gate:lawman` |
| `marshal_of_the_board` | Marshal of the Board | Complete all 30 contracts | `L.bountiesDone >= 30` | 200 NP, `title:marshal` |
| `foot_gun` (hidden) | Foot Gun | Die to your own dynamite | `E player:died{source=own_dynamite}` | 10 NP |
| `tumbleweed_season` (hidden) | Tumbleweed Season | Slay 100 tumbleweeds | `L.k.tumbleweed >= 100` | 15 NP |
| `crowd` (hidden) | Three's a Crowd | Have 3 familiars at once | `R.familiars >= 3` | 20 NP |
`R.hitlessStreak` = consecutive cleared rooms in the run with no `player:hurt` since `room:entered`. Sum of achievement NP: 2,810 (top rank needs 8,000; contracts add 7,000 max). `titles` (cosmetic, poster subtitle): `gravedigger, ghost_rider, quickdraw, hellraiser, curator, legend, marshal, last_breath, devils_due`, plus the rank title itself; picking one is Codex > RECORD > TITLE.

### B5. BOUNTY BOARD (30 fixed contracts = preset challenge runs)
Concept: each contract is a fixed run with a rider, starting relics, one or two mutators and a goal. Fixed list in three tiers (no rotation); tier N+1 unlocks after 6 completions in tier N (`Meta.tierOpen(t)`). Contract runs: no gate items (all pools open), fixed seed = `hashStr('bounty:'+id)` so the layout is learnable, achievements and stats still count, run NP not awarded (only the contract NP: Tin 100, Silver 200, Gold 400). Goal grammar: `clear:N` = defeat the boss of floor N (run ends as `complete`, via `run.maxFloor = N` replacing `MAX_FLOOR` in `GameScene.onBossDefeated/descend`), optional `,hits<=K`. The run ends as `variant:'contract'` when the goal is met (see the win semantics in B3). Completing sets `bounty[id].done`, emits `bounty:completed {id, tier}`, feeds the achievements. Items given free at start via `Player.addItem` (no pickup banner; `run.items` updated). Mutator ids: table B6.
| id | Name | Tier | Rider | Start items | Mutators | Goal | Reward (besides NP) |
|---|---|---|---|---|---|---|---|
| `bt_greenhorn` | Greenhorn's Errand | Tin | gunslinger | - | - | `clear:2` | lore `lore_board` |
| `bt_big_iron` | Big Iron | Tin | gunslinger | - | `big_iron` | `clear:2` | - |
| `bt_dry_town` | Dry Town | Tin | gunslinger | - | `dry_town` | `clear:3` | - |
| `bt_sermon_on_the_mount` | Sermon on the Mount | Tin | preacher | - | `chambered_three` | `clear:3` | - |
| `bt_long_rifle` | Long Rifle | Tin | hunter | - | `lights_out` | `clear:3` | - |
| `bt_pair_of_aces` | Pair of Aces | Tin | queen | - | `hobbled` | `clear:3` | - |
| `bt_stumble_home` | Stumble Home | Tin | gunslinger | - | `whiskey_legs` | `clear:3` | - |
| `bt_bank_shot` | Bank Shot | Tin | gunslinger | `ricochet` | `bank_shot` | `clear:3` | - |
| `bt_loud_and_clear` | Loud and Clear | Tin | hunter | - | `powder_party` | `clear:3` | - |
| `bt_quiet_prayer` | Quiet Prayer | Tin | preacher | `duster_coat` | `hobbled` | `clear:3` | - |
| `bt_glass_jaw` | Glass Jaw | Silver | gunslinger | `speed_loader` | `glass_jaw` | `clear:4` | `gate:undead` |
| `bt_stampede` | Stampede | Silver | hunter | - | `stampede` | `clear:4` | `gate:beast` |
| `bt_all_cursed` | Everyone's Cursed | Silver | preacher | - | `all_cursed` | `clear:4` | `gate:ghost` |
| `bt_rusty_iron` | Rusty Iron | Silver | queen | - | `rusty_iron` | `clear:4` | `gate:scrap` |
| `bt_dark_road` | The Dark Road | Silver | gunslinger | `spirit_lantern` | `lights_out` | `clear:4` | - |
| `bt_powder_keg_party` | Powder Keg Party | Silver | queen | `powder_keg` | `powder_party` | `clear:5` | - |
| `bt_pale_horse` | Pale Horse | Silver | preacher | - | `pale_horse` | `clear:5` | - |
| `bt_hell_for_leather` | Hell for Leather | Silver | hunter | `pocket_watch` | `hell_for_leather` | `clear:5` | - |
| `bt_six_in_three` | Six in Three | Silver | gunslinger | `fan_the_hammer` | `chambered_three` | `clear:5` | - |
| `bt_tightrope` | Tightrope | Silver | queen | - | `glass_jaw`,`hobbled` | `clear:5` | - |
| `bt_last_breath` | Last Breath | Gold | gunslinger | - | `last_breath` | `clear:6` | `title:last_breath` |
| `bt_iron_maiden` | Iron Maiden | Gold | preacher | - | `last_breath`,`rusty_iron` | `clear:6` | - |
| `bt_dead_calm` | Dead Calm | Gold | hunter | `dead_eye` | `hobbled`,`lights_out` | `clear:6` | - |
| `bt_house_always_wins` | The House Always Wins | Gold | queen | - | `dry_town`,`glass_jaw` | `clear:6` | - |
| `bt_hellbound` | Hellbound | Gold | gunslinger | - | `hell_for_leather`,`all_cursed` | `clear:6` | - |
| `bt_no_witnesses` | No Witnesses | Gold | hunter | - | `stampede` | `clear:6,hits<=8` | - |
| `bt_thin_ice` | Thin Ice | Gold | preacher | - | `whiskey_legs`,`pale_horse` | `clear:6` | - |
| `bt_bullet_hell` | Bullet Storm | Gold | gunslinger | `ricochet`,`sawed_off` | `bank_shot`,`big_iron` | `clear:6` | - |
| `bt_gilded_cage` | Gilded Cage | Gold | queen | `lucky_horseshoe` | `powder_party`,`pale_horse` | `clear:6` | - |
| `bt_devils_due` | The Devil's Due | Gold | gunslinger | - | `last_breath`,`glass_jaw` | `clear:6,hits<=12` | `title:devils_due` |
`bt_last_breath` and `bt_devils_due` grant cosmetic poster titles (`title:last_breath`, `title:devils_due`). Board UI: `BoardScene` (D2). Contract state: `bounty[id] = {done, tries, best:{time, reward}}`; a contract counts a "try" on start.

### B6. Mutators (shared by contracts and Daily; `MUTATORS` in `difficulty.js`; each = `{id, name, desc, apply(stats, ctx)?, hooks}` and shows as a HUD chip)
| id | Name | Exact effect | Hook |
|---|---|---|---|
| `glass_jaw` | Glass Jaw | damage dealt x1.5 (`bulletDamageMult`); every hit taken is at least 2 units (`damageTakenMin = 2`) | recomputeStats, `Player.damage` |
| `rusty_iron` | Rusty Iron | fireDelay x1.4, damage x1.5, pierce +1 | recomputeStats |
| `hell_for_leather` | Hell for Leather | enemy move speed and enemy bullet speed x1.25; player moveSpeed x1.15, fireDelay x0.85 | `Enemy` speed mult, `Bullets.enemy` speed mult |
| `hobbled` | Hobbled | dodge roll disabled; moveSpeed +45 | `Player.update` skips roll |
| `dry_town` | Dry Town | enemies and rooms drop no coins/keys (bosses/chests still do); shop prices x0.5 (min 1) | `Room.dropPickup`, `Player.price` |
| `powder_party` | Powder Party | start dynamite 9, dynamiteRadius +50%, explosions never hurt you, fireDelay x1.3 | recomputeStats (`explosionImmune`) |
| `bank_shot` | Bank Shot | ricochet +2, damage x0.8 | recomputeStats |
| `chambered_three` | Chambered Three | `sixthEvery` 3 (Cylinder shows 3 slots), damage x0.75 | recomputeStats; `Cylinder` reads `player.cylinder.max` |
| `lights_out` | Lights Out | screen darkened (alpha 0.72 overlay) with a soft light circle r=340 px around the player (lantern items add +80) | `GameScene` overlay image using `vignette` |
| `all_cursed` | Everyone's Cursed | every enemy is cursed, cursed HP bonus x1.25 instead of x1.5, heart drop from cursed enemies 25% (not 100%) | `Room` spawn, `Enemy.dropLoot` |
| `pale_horse` | Pale Horse | no heart pickups spawn (replaced by coins); heal 1 HP unit every 15 kills (`killHeal`) | `Room.dropPickup`, kill hook |
| `whiskey_legs` | Whiskey Legs | `PLAYER.friction` x0.3, `accel` x0.6 (slippery) | `Player.update` |
| `stampede` | Stampede | enemy move speed x1.3, enemy HP x0.8 | `Enemy` |
| `last_breath` | Last Breath | maxHearts forced to 1 plus 2 tin hearts, damage x1.4 | recomputeStats, start state |
| `big_iron` | Big Iron | bulletSize x1.8, fireDelay x1.3, shotSpeed x0.8, damage x1.2 | recomputeStats |
`DAILY_POOL` = all except `hobbled` and `last_breath` (13). Two mutators stack multiplicatively; `hobbled` + `lights_out` etc. are intentionally allowed only in contracts.

### B7. Tracked stats
Lifetime (`save.stats`) and per-run (`RunState`, exposed to conditions as `R.*`): most are incremented by `Meta` from bus events; `RunState` gains the fields marked (run).
| Stat | Source event |
|---|---|
| `runs`, `wins`, `deaths`, `abandons`, `playTime`, `bountyEarned` | `run:started` / `run:ended` (abandon = quit from Pause) |
| `kills`, `k.<id>`, `sixthKills`, `deadEyeKills`, `dynamiteKills`, `elites`, `minibosses` (run) | `enemy:died {id, by, elite}` (`by`: `bullet|sixth|deadeye|explosion|dot|familiar|other`), `miniboss:defeated` |
| `bk.<id>`, boss `fightTime`, `noHit` (run: `bossHits`) | `boss:spawned` (start clock, `bossHits=0`), `player:hurt` (bossHits++ while a boss is alive), `boss:defeated` |
| `shots`, `sixthShots`, `rolls`, `dynamitePlaced` | `player:fired`, `player:rolled`, `dynamite:placed` |
| `hits`, `damageTaken`, `hitlessStreak` (run), `hitlessRooms` | `player:hurt {units}`, `room:entered`, `room:cleared` |
| `coinsCollected` (amount from `pickup:collected {type}`: coin=coinMult, nickel=5*coinMult), `coinsSpent`, `shopBuys`, `purchases` (run), `coins` (run, max held) | `pickup:collected`, `shop:bought {price}` |
| `itemsPicked`, `itemsFound` (unique owned, = `Object.values(codex.items).filter(v=>v===2)`), `itemsTotal` (registry size minus `charOnly`), `familiars` (run) | `item:picked`, `synergy:activated {id}` |
| `roomsCleared`, `secrets`, `chests`, `keysUsed`, `deals`, `eventsDone`, `floorsDescended`, `marksCollected` | `room:cleared`, `secret:revealed`, `chest:opened`, `key:used`, `crossroads:deal`, `event:resolved`, `floor:changed`, `mark:collected` |
| `bountiesDone`, `dailyRuns` | `bounty:completed`, `daily:finished` |
| `R.floor`, `R.kills`, `R.time`, `R.tin`, `R.maxHearts`, `R.items`, `R.char`, `R.mode` | read from `RunState`/`player` when a condition needs them |

### B8. Events the meta system listens to
Existing (payload as in `events.js`): `player:fired`, `player:hurt`, `player:rolled`, `player:died`, `enemy:spawned`, `enemy:died`, `room:entered`, `room:cleared`, `boss:intro`, `boss:spawned`, `boss:defeated`, `item:picked`, `pickup:collected`, `shop:bought`, `secret:revealed`, `floor:changed`, `run:ended`, `dynamite:placed`, `explosion`.
Payload extensions and NEW events (emitted by the named system; Meta must tolerate a missing event - the related achievements simply never fire):
| Event | Payload | Emitter |
|---|---|---|
| `run:started` (new) | `{char, mode, seed, contract?, mutators[]}` | `GameScene.create` |
| `enemy:died` (extend) | add `id`, `by`, `elite` (`false|'cursed'|'champion'`), `marked` | `Enemy.die` (pass `info.sixth/explosion/dot/deadeye/familiar` through) |
| `boss:defeated` (extend) | add `id`, `floor`, `fightTime` (s), `noHit` (0/1) | `Boss`; Meta computes noHit/fightTime itself as fallback |
| `player:hurt` (extend) | `source.own = true` for the player's own `Dynamite`; `source.kind` string kept | `Dynamite`, `Player.damage` |
| `player:died` (extend) | `source.kind = 'own_dynamite'` when own | `Player.die` |
| `shop:bought` (extend) | add `item`, `kind` | `Shop.tryBuy` |
| `item:seen` (new) | `{id}` when a pedestal/shop item enters the current room | `Pedestal`/`Shop` on `room:entered` |
| `chest:opened` `{type}`, `key:used` `{for:'door'|'chest'}` (new) | | `Chest`, `Door` |
| `miniboss:defeated` `{id, floor}` (new) | | MINIBOSS system (enemies doc) |
| `crossroads:deal` `{kind, cost, item}`, `crossroads:refused` (new) | | CROSSROADS system |
| `event:resolved` `{id, outcome}` (new) | | EVENT ROOM system |
| `synergy:activated` `{id}` (new) | | ITEMS doc synergy engine |
| `mark:collected` `{id, by}` (new) | | `WantedMark` |
| `room:cleared` (extend) | add `hitless` (bool) | `Room` (or Meta derives from `player:hurt`) |
| OUTPUT `meta:unlocked` `{kind,id,label}`, `meta:achievement` `{id,name,desc,np}`, `codex:discovered` `{kind:'enemy'|'item'|'boss'|'lore',id}`, `meta:rank` `{rank,title}`, `bounty:completed` `{id,tier}`, `daily:finished` `{date,score,rank}` | | `Meta` (consumed by HUD/Menu toasts and `EndScene`) |

Meta feeds its own OUTPUT events (`meta:unlocked`, `bounty:completed`, `daily:finished`) back into the condition engine (used by lore unlocks and `front_page`); `run:ended.variant` is `death|complete|contract`.

### B9. NOTORIETY (rank/title progression; cosmetic, NOT spendable, no power)
NP sources: runs: `ceil(reward / 100) * modeMult` (Normal 1, Hell 1.5, Daily 1; contract runs 0); achievements (B4); contracts 100/200/400. Rank is derived from `notoriety.np` (`ranks.js`), shown on the menu chip, char select, Codex RECORD, run ledger, and on the death poster as the subtitle under "THE GUNSLINGER" (rank title or chosen `title:`). Rank-up plays a wanted-poster stamp toast (`meta:rank`).
| Rank | Title | NP |
|---|---|---|
| 1 | Greenhorn | 0 |
| 2 | Drifter | 100 |
| 3 | Hired Gun | 300 |
| 4 | Gunfighter | 600 |
| 5 | Desperado | 1,000 |
| 6 | Outlaw | 1,600 |
| 7 | Wanted Man | 2,400 |
| 8 | Scourge of Perdition | 3,400 |
| 9 | Devil's Rival | 4,600 |
| 10 | Dead Man Walking | 6,000 |
| 11 | Living Legend | 8,000 |
Ranks 5, 8, 11 also grant `title:` variants of the poster frame (bronze/silver/gold border tint on the wanted poster, code-tinted; no art). Score/"reward $" (`score.js`, replaces the inline formula in `EndScene`): `reward = kills*25 + bossesKilled*500 + (floor-1)*250 + minibosses*200 + elites*40 + (won ? 3000 + max(0, 2400 - time)*2 : 0) - damageTaken*10`, floored at 0, x1.5 for Hell. This one number is also the Daily score and the poster "REWARD".

## C. DIFFICULTY MODES

### C1. Modes
`GameScene.init({char, mode:'normal'|'hell'|'daily'|'contract', seed?, contract?})`; `run.mode`, `run.char` recorded; `scene.diff = DIFFICULTY[mode==='daily' ? (daily.hell ? 'hell':'normal') : mode==='contract' ? 'normal' : mode]`.
| Key | Normal | HELL ON EARTH (`mode:hell`) | Hook |
|---|---|---|---|
| enemy HP (on top of `FLOORS[n].hpMult`) | x1 | x1.30 | `spawnEnemy` |
| boss HP | x1 | x1.25 | `spawnBoss` |
| enemy bullet speed | x1 | x1.12 | `Bullets.enemy.fire` |
| enemy attack delays/cooldowns | x1 | x0.88 | `Enemy` state timers, `Boss.addAttack` gaps |
| extra enemy per wave | 0 | 35% chance of +1 enemy (max 7 per wave) | `Room.buildWaves` |
| `cursedChance` (elites) | 0.08 | 0.18 | `ENEMY_DEFAULTS` read via `diff` |
| `ROOM_REWARD.dropChance` / `pityRooms` | 0.40 / 3 | 0.32 / 5 | `Room.clearRoom` |
| heart drops downgrade | 0 | 50% of `heart_full` become `heart_half` | `Room.dropPickup` |
| shop heart price | base | +1 | `Shop` |
| `PLAYER.invulnAfterHit` / `roomEntryInvuln` | 1.0 / 0.5 | 0.85 / 0.40 | `Player` |
| reward + NP multiplier | x1 | x1.5 | `score.js` |
| visual | - | HUD skull chip "HELL", faint red vignette pulse (alpha 0.06), title-screen ember tint after first Hell win | `HUDScene`, `Vignette` |
Unchanged in Hell (fairness): telegraph durations, contact damage, boss damage, i-frames of roll, drops from bosses, room layouts. Every enemy attack must still be avoidable (QA checks Hell with the fuzz bot: no un-dodgeable frame).

### C2. DAILY RIDE (`mode:daily`; `DailyScene` from menu)
- `dailyFor(dateStr)` (pure): `h = hashStr('dw2:daily:'+date)`; `seed = h`; `char = CHAR_ORDER[h % 4]` (any rider, locked ones are "borrowed for the day"); `mutator = DAILY_POOL[(h >>> 8) % DAILY_POOL.length]`; `hell = (UTC weekday === 0)` ("Hell Sunday"). Date = UTC `YYYY-MM-DD`; the screen shows a reset countdown (`HH:MM`). Same seed => same floors, drops, pools (`Meta.itemsOpen = true`).
- Score = `reward` from B9 (mult x1.5 on Hell Sunday); `daily:finished` fires only on death or win; quitting from Pause is an abandon and does not record an entry. Retries are unlimited; the board keeps every attempt (`daily.entries`, cap 200; oldest dropped) and highlights the best per day.
- Streak: `daily.streak` increments when `lastDate` is yesterday (UTC), resets otherwise; `bestStreak` kept.
- Screen layout (uses `ui_charselect_bg`): left poster (parchment w=560 at x=380,y=500): "DAILY RIDE", date, rider portrait (256), mutator name + description + chip icon, seed code `DW-20260929`, "HELL SUNDAY" ribbon when active. Right board (dark parchment w=640 at x=1050,y=500): tabs `TODAY`, `THIS WEEK`, `ALL TIME` (A/D switch), rows = rank, date, rider token, floor, reward $, time, `WIN` / floor; top 10 shown; own best row highlighted amber; empty state "No rides yet - be the first". Bottom: `RIDE OUT` (Enter) and `ESC back`. Streak flame + count shown under the poster.
- Local only: no accounts, no network. The seed code is displayed so players can compare with friends out-of-band.

## D. UI SPECS (western kit: `ui_parchment`, Rye titles, Special Elite body via `title()/body()/inkText()`; menus use `MenuList` + `uiSfx`)

### D1. Codex (`CodexScene`, bg `ui_codex_bg`)
Six tabs in a `TabBar` (y=60, `Q`/`E` or click): BESTIARY, RELICS, OUTLAWS, LORE, DEEDS, RECORD. Two-page layout: left page = 6x4 grid (cells 96, gap 20, x 130..800, y 170..770) with 24 cells per page (`PageUp/PageDn` or `Z/X`); right page (x 850..1320) = detail panel that updates on hover/selection (arrows/WASD move the cursor, no Enter needed). Footer: "Q/E tab   arrows browse   Z/X page   ESC back" and a completion counter per tab ("14 / 22").
| Tab | Entries (source) | Discovery stages |
|---|---|---|
| BESTIARY | every id in `ENEMY_META` (incl. crow, tumbleweed_mini and all chapter-2 enemies), sprite frame 0 | S0 unseen: black silhouette, "???". S1 seen (`enemy:spawned` on screen): sprite, name, floors. S2 (>=3 kills): HP, speed, tags (undead/flying), attack line. S3 (>=15 kills): flavour text + tip, kill count |
| RELICS | every item in the registry except `charOnly` (plus character relics shown under their rider), icon cell | S0: silhouette + hint if gated ("Unlocked by: X"). S1 seen (`item:seen`): icon + name. S2 owned once (`item:picked`): description, tags, pools, synergy hints. Gated locked = S0 with a padlock |
| OUTLAWS | bosses (`BOSS_META`) then mini-bosses (`ENEMY_META[id].miniboss`), portrait 512 shown 360 px | S1 seen (`boss:intro`): portrait, name, title. S2 defeated: HP, phase count, attack list, best fight time. S3 defeated without being hit (`noHit`): "Sheriff's note" tip + laurel |
| LORE | `lore.js` entries (D6) | locked: title "???" + hint text (always visible). Unlocked: text page (Special Elite 22, wrapped 440 px) |
| DEEDS | achievements (B4) in a 2-column list, 9 per page: badge (`ach_cat` cell), name, description, progress bar for `L`/`EC`, reward chips; earned rows have a stamped date | hidden achievements show "???" + "A secret deed" until earned |
| RECORD | stats, riders table, notoriety, titles, history | always visible; see below |
Silhouette rule: unseen art is drawn with `setTintFill(0x1a100c)` at alpha 0.55 (reuse the old Bounty Board trick); text "???"; seen-but-incomplete details show grey "?" placeholders. Discovery emits `codex:discovered` -> a small corner toast "NEW CODEX ENTRY - <name>" (parchment chip 320x48 bottom-left, 2 s) that never interrupts play. Codex completion % = discovered stage>=1 entries over all registry entries (enemies, relics, outlaws, lore).
RECORD layout: left column "THE LEDGER" 16 stat rows (rides, ended, won, hanged, kills, most kills in a ride, deepest floor, fastest win Normal/Hell, time in the saddle, coins collected, coins spent, secrets found, deals made, contracts done, dailies ridden, best streak) with dotted leaders (same style as the death poster); middle: 4 rider cards (portrait 96, runs/wins/best floor, 3 mark stars); right: Notoriety (rank title, NP bar, next rank), TITLE selector (list, Enter equips) and last 25 rides (date, rider, floor, reward $, WIN/killed by).

### D2. Bounty Board (`BoardScene`, bg `ui_board_bg`: painted wooden board with nails)
Three tier tabs (TIN / SILVER / GOLD, `Q/E`), each showing its 10 posters as small parchments (w=260) in a 5x2 grid (x 110..1330, y 190..690); poster shows rider token, contract name (title 24), mutator chips (icons via text glyph badges), goal line, reward line, state stamp (`COLLECTED` green / `LOCKED` padlock with "Complete 6 Tin contracts" / blank). Selected poster enlarges into the detail sheet at the bottom (y 720..900): full description, rules list (mutator descriptions from B6), start items icons, reward list, personal best, and the `TAKE THE JOB` plaque (Enter) which calls `scene.start('Game', {char, mode:'contract', contract:id})`. Keys: arrows/WASD move, Enter take, Esc back; mouse hover/click. Footer counter "Contracts 12 / 30" and tier progress "Tin 6/10".

### D3. Run summary (EndScene extension)
Existing poster stays as page 1 (death "WANTED" / win) with: rider portrait (`portrait_<char>` instead of `portrait_player`), title line = selected title or rank, mode ribbon (HELL / DAILY / CONTRACT name), reward = `score.js`, chapter text becomes "CHAPTER II" on win in v2 (STORY doc supplies strings), "NEW BEST" flags on time/floor. Any key `Space` / click NEXT (or auto after 4 s of idle when there is meta news) flips to page 2 "THE LEDGER" (slide-in parchment):
1. Notoriety: bar animates from old NP to new NP, "+NP" breakdown (run, achievements, contract), rank-up stamp when crossing a rank.
2. Unlocked this ride: row of icons (achievement badges, character portrait token, gate item silhouettes with names) with a 120 ms staggered pop.
3. New codex entries: thumbnail strip with names (max 8, "+N more").
4. Contract result (if contract): `COLLECTED` stamp or "Try again", best time.
5. Daily (if daily): score, today's rank on the local board, streak.
6. Ride recap: time per floor bars, top 3 damage sources ("Killed by" + "Hurt most by"), items strip (as today), seed with `C` = copy `DW1-<seed>-<char>-<mode>` (try `navigator.clipboard`, toast on success).
Prompts: `R` ride again (same char/mode; Daily = same seed), `ESC` menu, `Left` returns to page 1. Page 1 ready-timing (450 ms) unchanged.

### D4. Options additions (`OptionsPanel`, 2 pages `Q/E`: AUDIO & DISPLAY | GAMEPLAY & DATA; row gap 56, size 34)
| Setting (key) | Type | Default | Effect |
|---|---|---|---|
| `shakeAmt` | slider 0..1 step 0.25 | 1 | multiplies `fx.shake` amplitude; replaces the boolean (old `shake=false` maps to 0) |
| `flash` | toggle | ON | OFF halves `hud:flash` alpha and disables full-screen white flashes (photosensitivity) |
| `bulletOutline` | toggle | OFF | draws a 3 px white ring under enemy bullets (colour-blind / contrast aid) |
| `dmgNumbers` | toggle | OFF | floating damage numbers on hits (`fx.text`, 0.6 s) |
| `runTimer` | toggle | ON | shows / hides the HUD run timer |
| `autoPause` | toggle | ON | pause on window blur |
| `EXPORT SAVE` / `IMPORT SAVE` | buttons | - | export copies base64 to the clipboard (falls back to `window.prompt`); import via `window.prompt`, validated |
| `RESET PROGRESS` | button | - | 2-step confirm ("hold ENTER 1.5 s") -> `Save.resetProgress()`; keeps settings |
Existing rows (music, sound fx, sound, fullscreen, back) stay. Pause menu additionally shows rider, mode, active mutator chips, seed, and NP earned this ride.

### D5. Toasts
`AchievementToast` (HUD/Menu/End scene widget, queue max 3): parchment strip 560x88 at bottom centre (y=880), slides up 260 ms, holds 3.2 s: `ach_cat` badge 64 px, "DEED EARNED" small caps amber, name (title 26), NP + reward chips; sfx `item_get`. `meta:unlocked` for characters/modes uses the same toast with the portrait. During boss fights toasts are queued until `boss:defeated`.

### D6. Lore entries (`lore.js`, text <= 30 words each; `hint` shown while locked; more entries may be registered by other docs with the same shape `{id, title, hint, unlock:'<cond>', text}`)
| id | Title | Unlock (cond grammar) | Text |
|---|---|---|---|
| `lore_debt` | The Debt | `E run:started{}` | You signed in blood at a crossroads that no longer exists. The Devil keeps the receipt in a saloon at the end of the world. |
| `lore_board` | The Board | `E bounty:completed{id=bt_greenhorn}` | Every job on the board pays in coin and notoriety. The board never asks who you are, only whom you can bury. |
| `lore_perdition` | Perdition County | `E floor:changed{floor=2}` | The town forgot to die. Its lamps still burn for customers who stopped breathing long ago. |
| `lore_cascabel` | The Rattle | `L.bk.cascabel >= 1` | Old ranchers say the snake ate a preacher's bell and has rung ever since. |
| `lore_grimm` | The Law | `L.bk.grimm >= 1` | Marshal Grimm hanged fifty men for the Devil. The noose went around his own neck at the fifty-first. |
| `lore_undertaker` | The Undertaker | `L.bk.undertaker >= 1` | He never stopped measuring. Every coffin in the mine was cut to fit someone still walking. |
| `lore_peddler` | The Peddler | `L.shopBuys >= 1` | One eye, one wagon, no customers who complain. Skeletons make excellent shopkeepers: they never take a day off. |
| `lore_tin` | Tin Hearts | `E pickup:collected{type=heart_tin}` | Tin is what a town gives its deputies when it cannot afford to give them mercy. |
| `lore_sixth` | The Sixth Bullet | `L.sixthShots >= 50` | Five for the living, one for the debt. The cylinder remembers what the shooter tries to forget. |
| `lore_coffins` | Hollow Boxes | `L.k.coffin >= 10` | Nothing in the mine was buried by mistake. |
| `lore_ghosts` | Ghost Light | `L.k.ghost >= 30` | Prospectors who died owing money keep looking for the vein. Green light means they think they found it. |
| `lore_cursed` | The Cursed | `L.elites >= 1` | Some bandits sold twice. The Devil collects on both. |
| `lore_secret` | Behind the Wall | `L.secrets >= 1` | Every county hides what it cannot bury. Dynamite is a polite way to ask. |
| `lore_preacher` | The Hangman's Chaplain | `E meta:unlocked{id=char:preacher}` | Josiah Thorne blessed every man Grimm hanged. The Marshal's ghost still owes him a sermon. |
| `lore_hunter` | Paid in Full | `E meta:unlocked{id=char:hunter}` | Cormac Rook has never missed a payday, and the only bounty he cannot collect is his own. |
| `lore_queen` | Queen of Spades | `E meta:unlocked{id=char:queen}` | Maude Marlowe cheated the Devil at cards once. He let her win, so he could see what it would cost her. |
| `lore_hell` | Hell on Earth | `E meta:unlocked{id=mode:hell}` | The Devil does not cheat. He simply changes what counts as fair. |
| `lore_daily` | Same Sun, Same Road | `L.dailyRuns >= 1` | Every dawn, the county resets itself and dares one rider to walk the same road again. |
| `lore_deal` | Crossroads | `L.deals >= 1` | The Devil never asks for your soul. Only what you like best about yourself. |
`codexText.js` also holds the one-line bestiary/boss flavour for the 16 existing enemies and 3 bosses (written by the implementer from `GAME_DESIGN.md` behaviour lines, <= 18 words each); chapter-2 entities provide `meta.codex` strings in their own registry entries.

## E. ART LIST (this doc) - 17 image generations
| # | Key(s) | Size | Generation | Description |
|---|---|---|---|---|
| 1-12 | per character x3: anchor, walk sheet, action sheet, portrait (A5) | see A5 | 4 each | Preacher, Bounty Hunter, Outlaw Queen sets |
| 13 | `meta_icons` | grid 4x2, 96x96 | 1 | `sermon_bible` (worn black bible with brass cross), `hunters_ledger` (open ledger with a WANTED tag and rifle bullet), `gilded_pair` (two gold revolvers crossed over a coin), `star_tin` / `star_silver` / `star_gold` (chunky lawman stars, one hue each), `padlock` (iron), `rank_badge` (blank sheriff-star medallion for code tint) |
| 14 | `ach_cat` | grid 4x2, 96x96 | 1 | 8 category badges (round tin medals with a symbol): `combat` (crossed revolvers), `boss` (skull), `ride` (boot spur), `skill` (bullseye), `economy` (coin stack), `relic` (chest), `rider` (hat), `secret` (question mark) - locked state = code grey tint |
| 15 | `ui_charselect_bg` | 1440x960 opaque | 1 | dim saloon back wall, pinned wanted posters (blank), lantern glow, empty centre-lower area for cards; ink-woodcut; readable under parchment overlays |
| 16 | `ui_codex_bg` | 1440x960 opaque | 1 | leather-bound ledger open on a desk under candlelight, empty cream pages left and right, ribbon bookmarks, dark corners |
| 17 | `ui_board_bg` | 1440x960 opaque | 1 | weathered wooden notice board with nails and scraps of old paper, dusk light, big empty face |
Reuse (zero new art): silhouettes via `setTintFill`; contract/rider tokens = existing `portrait_*` cropped by mask; mutator chips = code-drawn rounded rectangles with text; WANTED mark above enemies, Faith arc, Sanctified halo, Jackpot tint = code-drawn (`glow`, `ring`, graphics); rank border tints = tinted `ui_parchment`; hard-mode skull = text glyph in Rye; toasts = `ui_parchment` scaled. Audio: reuse `item_get`, `room_clear`, `shop_deny`, `menu_*`, `door_close` (stamp); no new SFX required (optional later: `stamp_slam`).
Manifest: run `tools/optimize_assets.py` then `build_manifest.py`; every new key must degrade to a coded placeholder (`?noassets=1` still boots and plays every screen).

## F. IMPLEMENTATION NOTES (extend, do not rewrite)
| File | Change |
|---|---|
| `config.js` | add new `PLAYER_BASE` keys (A1); `MAX_FLOOR` from FLOORS doc; leave everything else |
| `Player.js` | ctor `{char}`; `recomputeStats` base merge + `flatDmgScale` + mutator stat hooks + `damageTakenMin`, `tinPlating` in `damage`; `dualGuns` offset and `coinDamage`, Jackpot mult in `fire`; skin key resolution in `updateAnim/updateDead`; start pickups from `CHARACTERS[id].start`; skip roll when `hobbled` |
| `GameScene.js` | `init(data)`; `run.char/mode/contract/mutators`; give starting items; `Meta.beginRun`; `endRun` -> `Meta.endRun(payload)` and pass extra data (`meta`: unlocks/NP/codex news) to `EndScene`; honour `run.maxFloor`; `?debug` sets `Meta.enabled=false` |
| `RunState.js` | new fields: `char, mode, contractId, mutators, hits, bossHits, hitlessStreak, bestStreak, purchases, deals, minibosses, elites, coins(max), coinsSpent, coinsCollected, floorTimes[], damageBySource{}, maxFloor` |
| `Save.js` | v2 schema, migration, helpers (B1) |
| `ItemSystem.js`, `registry.js` | `gate` / `charOnly` filtering, `itemsOpen`; `pickup` writes codex state 2 |
| `Enemy.js` | `marked` damage mult; enemy:died payload; `diff.enemyHp/bulletSpeed/atkDelay` hooks |
| `Room.js` | `diff` drops/elites/extra enemy; `dropPickup` mutator filters |
| `MenuScene.js` | new list (0), Notoriety chip, `CharSelect`/`Daily`/`Board`/`Codex` entry points; remove old board modal |
| `EndScene.js`, `PauseScene.js`, `OptionsPanel.js`, `HUDScene.js` | D3, D4, mutator chips + HELL chip, `AchievementToast` widget in `HUDScene.widgets` |
| `tools/qa/` | `meta-test.mjs` (pure engine tests), extend `fuzz-run.mjs` to loop over the 4 riders and both modes |
Determinism: Meta and the Codex never consume `rng.game`/`floorRng`. Character choice must not change floor generation for a given seed (same layout for all riders; only drops differ through stats/luck).

## G. TEST / ACCEPTANCE
1. `node tools/qa/meta-test.mjs`: (a) every achievement id unique, every condition compiles, every referenced stat/event exists in B7/B8; (b) replay script "kill 500 enemies" fires `gravedigger` exactly once; "boss:defeated{boss=grimm}" grants `char:preacher`; `debt_paid` grants queen + hell + daily flags idempotently; (c) `Meta.enabled=false` records nothing; (d) migration fixtures: empty, v1 with `wins=2`, v1 with `bestFloor=3`, corrupt JSON -> valid v2, no throw; (e) `dailyFor('2026-09-29')` is stable across runs and `dailyFor` weekday 0 returns `hell:true`; (f) rank thresholds map correctly at boundaries (99/100, 7999/8000).
2. `node src/data/characters.mjs`-style validation (in selftest): every character has all keys in A1, `startStats(id)` bars are within 0..10, starting item ids exist in the registry, `charOnly` items are absent from every pool roll (1,000 rolls).
3. Browser (`?debug=1` is tracking-off): manual/automation: start each unlocked rider (`?unlockall=1`), fire, roll, take damage, pick up coins; assert Preacher pellet count 5, tin plating caps a 2-unit hit to 1 tin, Faith reaches 100 -> `sanctified` buff active 8 s; Hunter marks exactly 1 enemy per wave and a marked kill drops nickel+coin; Queen at 0 vs 99 coins: `stats.damage + coinDamage*coins` differs, Jackpot mult 1.6 vs 3.58, dual muzzle alternates.
4. Character select: all four cards render with and without art (`?noassets=1`); arrows/A/D/1-4/mouse navigate; locked rider cannot start and shows the hint; stat bars match `startStats`; last choice remembered after reload.
5. Save: kill the tab mid-run and reload: unlocks/achievements earned before the kill persist; export -> reset -> import restores identical state (deep equal); localStorage disabled -> game still plays, no exceptions.
6. Codex: fresh save shows silhouettes only; killing a coyote flips it to S1 then S2 after 3 kills; a gated item stays silhouetted with its hint until the gate unlocks; DEEDS progress bars update live; lore entries unlock by their conditions.
7. Bounty Board: tier 2 locked until 6 tin completions; starting a contract gives the exact rider/items/mutators; `bt_no_witnesses` fails the goal after the 9th hit (run continues, but not marked complete); reward grants applied once.
8. Daily: two runs with the same date produce identical floor layouts and pool rolls; local board sorts by score desc; abandon does not record; streak increments across UTC days (fake clock).
9. Hell: enemy HP/bullet-speed multipliers verified via `__dw.state()`; fuzz bot survives 10 Hell runs without a crash or softlock.
10. Performance: Meta event handler cost < 0.2 ms per event (index by event/stat); Codex scene opens < 200 ms with 150 entries; 60 fps in Lights Out.

## H. SCOPE GUARDS (do NOT build)
No online leaderboards, accounts, cloud saves or network calls; no gamepad/touch; no more than 4 riders and no per-rider skill trees or stat upgrades; Notoriety is cosmetic (no power, no meta-currency shop); no skins/hat cosmetics beyond poster titles and frame tints; no custom-seed UI (the `?seed=` flag stays dev-only); no Boss Rush mode; no new rooms/enemies/bosses/items in this doc (only the 3 character relics); no additional save slots; no localisation; no dynamic difficulty; do not change the Sixth Bullet HUD to a non-6 slot layout except the `chambered_three` mutator; do not gate any of the original 28 items; do not add new bus event names beyond B8; achievements/stat recording never run in debug/god-mode runs; nothing in Meta may block or throw inside a gameplay frame (wrap handlers in try/catch and log once).

## Integrator notes
Authoritative reconciliation is `ARCH_V2.md` s0 (D1-D18).
- The `ug_*` unlock ids are replaced by the 17 `gate:*` ids (ARCH s10.7; `souls_sold` threshold 5); items use `gate:`, never `unlock:`.
- Event aliases: `crossroads:deal` -> `deal:signed`, `crossroads:refused` -> `deal:refused`, `event:resolved` -> `event:done`, `miniboss:defeated` -> `mini:defeated` (D4).
- Queen: effective Sixth multiplier = `sixthMult + jackpotPerCoin*coins`; the Cylinder HUD draws `sixthEvery` slots, 3..8 (D8).
- Revive order [black_cat_bone, ace_in_hole, lazarus_pact] (D7); `heartDebt` is the single heart-cost counter (D6).
- Base `hurtInvuln` comes from difficulty: 1.0 normal, 0.85 Hell (D9).
- Checkpoint lives in Save v2, normal and Hell runs only (D10); Daily and contracts never checkpoint.
- Codex has six tabs: BESTIARY, RELICS, OUTLAWS, LORE, DEEDS, RECORD.
- Gunslinger art is not regenerated (D17); `ui_board_bg` is cut (code-drawn board).
