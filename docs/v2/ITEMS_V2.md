# DEAD WEST v2 - ITEMS_V2: Item and Synergy Pass (+46 items, tags, 26 synergies)

Owner: items/synergy design. Extends `src/items/*`, `Player`, `Bullets`, `Enemy`, `Explosions`, HUD. Reads: ARCHITECTURE.md (stats contract), GAME_DESIGN.md. Sibling docs (chapter 2, characters, meta, events/crossroads room) reference items by id only.
All numbers are final. "Stat" = key in `player.stats` (rebuilt each `recomputeStats`, `apply` stays pure). Damage units: enemy HP = table values x floor mult; player damage 3.5 base, 3 shots/s => ~10.5 dps base.

## 0. Summary and art budget
| Thing | Count | Note |
|---|---|---|
| New passives | 30 | 4 with familiars (art), 5 in the Sixth Bullet axis |
| New actives | 6 | existing charge system (room clears), 1 active slot as before |
| Crossroads (devil-deal) items | 10 | pool `crossroads` only, `deal.pay` + a real drawback |
| Total new item ids | 46 | 74 items in the game (28 old + 46) |
| Tags | 26 | every item, old and new, is tagged |
| Named synergies | 26 | 10 pair, 8 tag-threshold, 8 capstone |
| New familiars | 4 | `bone_hound`, `tumbleweed_pal`, `little_coffin`, `saints_halo` |
| New stat keys | ~70 | section 2.1, all default to "off" |
| New enemy statuses | 3 | `chill`, `frozen`, `mark` (+ `poison` stacks) |
| New curse | 1 | `curseHunted` |
| Image generations | 10 | 6 icon sheets, 1 familiar sheet, 1 fx sheet, 1 projectile sheet, 1 UI ribbon (section 8) |
| New enemies / bosses | 0 | items reuse existing sprites via tint/scale |

## 1. Conventions
### 1.1 Registry fields (extend `registerItem`, all optional, defaults shown)
`tags: []` (from the 26), `tier: 2` (1|2|3), `lore: ''` (flavour line, codex + pedestal), `unlock: null` (unlock-group id `ug_*`, section 6), `minFloor: 1`, `pool` may contain the marker `'c2'` (item only eligible when floor >= 4), `deal: null` (`{pay:{container?,coins?,keys?,tin?,dynamite?}}` crossroads only), `hooks: {}` (section 2.2), `state: null` (factory for per-run scratch, stored at `player.itemState[id]`, reset by run start).
Banner rule: `name` <= 22 chars, `desc` <= 70 chars (Banner wraps at 600 px, 2 lines). Crossroads banner tag line reads `DEVIL'S DEAL` (hell red) and `desc` states the drawback.
### 1.2 Power tiers (vs the 28 existing items; enemy HP grows x1.5..2.2 in ch1, assume x2.6..3.6 in ch2)
| Tier | Budget | Existing examples | Where |
|---|---|---|---|
| 1 minor | +8..15% effective power or a small utility | spurs, hollow_point, tin_star, prospectors_pan | treasure/shop, weight 1.0 |
| 2 solid | +15..30% or one clear new behaviour | rattler_fang, silver_bullets, duster_coat, crow_companion | treasure/shop/boss, weight 0.6-1.0 |
| 3 build-defining | +30..60% or rewrites how you play; needs setup or has a cost | dead_eye, fan_the_hammer, spirit_lantern, powder_keg | boss/secret/c2, weight 0.3-0.5 |
| deal | +50..120% with a genuine cost | (none) | crossroads only |
Target: full clear (6 floors) sees 16-20 items; typical build reaches 1-2 synergies in ch1, 3-5 by the end of ch2; end-of-ch2 dps 3.5-5x base. Stacking: `roll()` never duplicates in a run, so extra copies are debug/test only; `apply` runs per copy and repeats additively (x-multipliers repeat multiplicatively).
### 1.3 Clamps added to `recomputeStats` (anti-runaway)
`bulletDamageMult <= 4`, `chainChance <= 0.6`, `explodeChance <= 0.5`, `ghostChance <= 1`, `chillChance <= 0.6`, `smiteChance <= 0.35`, `burn <= 1`, `sixthEvery` clamped 3..8, `critCap <= 0.6`, `fearChance <= 1`, `hurtInvuln` 0.5..3.

## 2. Engine additions (contract for engineers)
### 2.1 New `PLAYER_BASE` keys (defaults = off)
| Group | Keys (default) |
|---|---|
| Bullet mods | `splitCount 0`, `splitMult 0.4`, `boomerangEvery 0`, `chainChance 0`, `chainCount 2`, `chainMult 0.5`, `chainRange 260`, `explodeChance 0`, `explodeRadius 90`, `explodeMult 0.6`, `ghostChance 0`, `pullRadius 0`, `pullSpeed 110`, `chillChance 0`, `smiteChance 0`, `smiteRadius 80`, `smiteMult 2`, `bulletFrame ''` (override sprite) |
| Status power | `burnVuln 0` (extra dmg on burning foes), `burnSpread 0` (px radius on burning death), `burnDpsMult 1`, `poisonStackMax 1`, `poisonCloud 0` (px radius), `markCount 0`, `markBonus 0.5`, `frozenBonus 0.4` |
| Sixth Bullet | `sixthExplode 0` (px), `sixthSplit 0` (extra slugs), `sixthOrbit 0` (seconds), `sixthRefund 0` (0..1 chance next shot is Sixth after a Sixth kill), `sixthCost 0` (hp units), `sixthHoming 0`, `sixthRicochet 0`, `normalDamageMult 1` (non-Sixth shots), `sixthKillHeal 0` |
| Crit/luck | `critMult 1.5`, `critCap 0.30`, `critCoinChance 0`, `critPierce 0` |
| Defence | `rollShock 0` (radius), `rollShockMult 3`, `rollStun 0.6`, `rollReflect 0` (radius), `rollGrace 0` (extra i-frames after roll, s), `hitCap 0` (max units per hit while tin > 0), `hushCost 0` (coins), `hurtInvuln 1.0` (replaces `PLAYER.invulnAfterHit` read), `haloCharges 0` |
| Economy | `interestDiv 0`, `interestCap 5`, `roomClearDynChance 0`, `killHeal 0`, `heartToCoin 0`, `coinDamagePct 0`, `coinDamageCap 0.75`, `coinLossOnHit 0`, `jackpot 0`, `bountyMark 0` |
| Dynamite | `dynamiteThrow 0` (px), `dynamiteFirePool 0`, `dynamiteRefund 0` (chance on explosion kill), `dynamiteRegen 0` (s per stick), `dynamiteRegenCap 0`, `dynamiteCluster 0` (extra mini blasts), `explosionVuln 0` (overrides `explosionImmune`, +1 unit) |
| Familiars | `familiarMult 1` (damage), `familiarCd 1` (cooldown mult), `spectralFamiliars 0` |
| Curse | `curseHunted 0` (cursed-elite chance x2.5: 8% -> 20%; cursed elites still drop a full heart) |
`Player` run fields (not stats): `cyl {pos}`, `forceSixth` (count), `penalty {containers}` (subtracted from `maxHearts` in `recomputeStats`; a container cost can only be paid while `stats.maxHearts >= 2`), `itemState {}`, `synergies Set`, `orbiters []`, `spiritT`.
### 2.2 Hook dispatcher (`src/items/hooks.js`, `runHooks(player, name, ctx)`)
Iterates unique owned items, then active synergies, calling `def.hooks[name](player, ctx, {scene, stats, count, state})`. Cheap: skipped when no owned def defines the hook (cache per recompute). Never allocate per bullet in `update`.
| Hook | Fired from | ctx | Return |
|---|---|---|---|
| `fire` | end of `Player.fire` | `{aim, bullets[], sixth, dead, luckCrit}` | - |
| `sixthFired` | `Player.fire` when sixth | as `fire` | - |
| `hit` | `Bullets.update` after `takeHit` != 'ignore' (skipped for `b.child`) | `{b, enemy, dealt, sixth, killed}` | - |
| `bulletEnd` | `Bullets.kill` | `{b, reason}` | - |
| `kill` | `Enemy.die` (before destroy) | `{enemy, info, st}` (`st` = snapshot of statuses at death: burn/poison/chill/frozen/mark; `info.sixth/explosion/dot/source`) | - |
| `hurt` | `Player.damage`, after room shield, before tin/hp | `{units, source}` | `{cancel:true}` or `{units}` |
| `hurtPost` | `Player.damage` after damage applied | `{units, source, hp}` | - |
| `bounce` | `Bullets` wall/obstacle ricochet | `{b}` | - |
| `deathSave` | `Player.damage` when hp+tin would hit 0 | `{source}` | `true` = revived (skip `die`) |
| `roll` / `rollEnd` | `startRoll` / roll timeout | `{dir}` | - |
| `roomEnter` / `wave` / `roomClear` | Room (`wave` = new bus event `room:wave {room,enemies}`) | `{room, perfect}` (`perfect` = no damage taken in room) | - |
| `explosion` | end of `explode()` (opts gain `owner:'player'\|'enemy'`, `source`) | `{x,y,radius,source,kills}` | - |
| `collect` | `Player.collect` before applying | `{type}` | `false` = swallowed, or `{type:'coin'}` = converted |
| `coins` | any coin change (new bus `coins:changed`) | `{coins}` | triggers `recomputeStats` (gold_fever) |
| `floor` | `floor:changed` | `{floor}` | - |
| `update` | `Player.update` | `{dt}` | - |
### 2.3 Bullet pipeline (`Player.fire`) and mods (`Bullets`)
1. `sixth = forceSixth>0 || cyl.pos >= sixthEvery-1` (forceSixth decrements). After the shot `cyl.pos = sixth ? 0 : pos+1`. HUD `Cylinder` draws `sixthEvery` slots (3..8). Old `shotCount % every` is replaced (run stat `shots` unchanged).
2. `mult = bulletDamageMult * (sixth ? sixthMult : normalDamageMult)`; dead-eye and luck-crit as today, but luck crit uses `critMult`/`critCap` (`Math.min(s.critCap, luck*0.03)`); a crit also: `critCoinChance` drops a coin, `critPierce` adds pierce.
3. Shot kind priority (one per bullet): Sixth > boomerang (every `boomerangEvery`-th non-Sixth shot, counter `state.n`) > normal. Sixth extras: orbit (`sixthOrbit` replaces travel, see 4.28) > split (`sixthSplit` extra slugs, +-10 deg steps, each x0.6 damage) ; `sixthExplode/Ricochet/Homing` add flags to every sixth slug; `sixthCost` applies via hook.
4. Per-bullet rolls, independent per pellet: `ghost` (`ghostChance`), `chill`, `explode`, `chain` (all decided at spawn into `b.mods`, so the hit path only reads flags). New `Bullets.fire` opts: `mods:{split,boomerang,orbit,chain,explode,ghost,pull,chill,smite,reflected}`, `child` (children never re-split/chain/explode/smite), `frame`/`sheet` (default `projectiles`), `hitCd` (orbiters re-hit timer per enemy).
5. Behaviours (all in `Bullets.update`): **split** on first enemy hit: `splitCount` children at +-35 deg fanned around the travel angle, 0.8x speed, life 0.35 s, dmg `splitMult` x parent, inherit poison/burn/fear/chill, spawn refused when live player bullets > 90. **boomerang**: out phase 0.30 s decelerating to 0, then home to player at 900 px/s; enemy `hit` set is cleared at the turn; dies within 40 px of the player, on age 1.8 s, or a wall hit turns it early; infinite pierce, size 1.25. **orbit**: position = player + r(cos,sin), r 130, 5.5 rad/s, life `sixthOrbit` s, infinite pierce, per-enemy re-hit 0.35 s, dmg x0.7 per hit, destroys enemy bullets within 26 px, at most 3 alive (oldest expires). **chain**: on hit, up to `chainCount` nearest other enemies within `chainRange` of the victim, `takeHit(dmg*chainMult, {chain:true})`, new `fx.arc(x1,y1,x2,y2,{color:0xfff2a0,ms:120})` (code-drawn jagged line, pooled Graphics). **explode**: `explode(scene,x,y,{radius:explodeRadius,damage:dmg*mult*explodeMult,hurtPlayer:false,breakObstacles:false,revealSecrets:false,source:'cap'})` excluding the primary victim; cap 6 per frame. **ghost**: spectral (ignores obstacles), +1 pierce, x1.15 damage, tint 0xb8ffe0, alpha 0.75. **pull**: each frame enemies within `pullRadius` of the bullet get displaced toward it by `pullSpeed*dt` via `enemy.moveBy` (non-boss, non-`heavy`; x2 for Sixth; once per enemy per frame). **smite** (hook `hit`): `smiteChance`, 0.4 s global cooldown, AoE `smiteRadius` at the victim, damage `stats.damage*smiteMult` (x2 more vs undead), `fx_holy_pillar`. **reflect** (enemy branch, before `canBeHit`): if `player.rolling && rollReflect` and distance < `rollReflect + b.r` and not `b.reflected`: kill the enemy bullet silently and fire a player bullet (`frame bullet_mirror`, spectral, dmg `stats.damage`, `reflected`) toward the nearest enemy (else reversed).
6. Perf caps: <= 120 live player bullets (children/orbit refuse above 90), <= 6 cap explosions/frame, one chain event per bullet per 50 ms, max 8 FirePools, smite cooldown 0.4 s.
### 2.4 Enemy statuses (`Enemy.applyStatus` / `takeHit` / `updateStatus`; add tints)
| Status | Rule | Tint |
|---|---|---|
| `chill` | 3 s, `slow` 0.7 multiplier, stacks 1..3; 3rd stack converts to `frozen` and clears chill. Bosses: slow x0.85, never frozen | 0x9fd8ff |
| `frozen` | non-boss: stun 1.2 s, takes `1+frozenBonus` (x1.4) damage; killed while frozen => 5 ice shard child bullets (40% of victim max-hit dmg, `fx_ice_burst`) | 0xd8f4ff |
| `mark` | takes `1+markBonus` (x1.5) damage from every source; drawn `fx_mark` over head; expires on death/8 s | - |
| `poison` (changed) | `stacks` up to `poisonStackMax`; dps = `stats.poison * stacks`; timer refreshes 3 s. Death of a poisoned enemy with `poisonCloud`: `FirePool`-style toxic cloud (`fx_toxic_cloud`), radius `poisonCloud`, 3 s, 4 dps + poison to enemies inside, never hurts player | - |
| `burn` (changed) | dps 3 x `burnDpsMult`; `burnVuln` extra damage taken; death of a burning enemy with `burnSpread` ignites enemies in radius for 2.5 s | - |
`Enemy.die` payload extends: `bus.emit('enemy:died', {..., info, st})`. Undead check unchanged (`UNDEAD_IDS`).
### 2.5 Deals, curse, revive, fire pools
* **Deal** (crossroads pedestal): `ItemSystem.canPay(player, def)` / `pay()`. `container` -> `player.penalty.containers++` (needs `stats.maxHearts >= 2`), `coins/keys/dynamite` deducted, `tin` deducted in tin units (4 = 2 tin hearts). Unaffordable: red "CANNOT PAY" text, `pickup:denied`. New bus `deal:paid {id, pay}`. Crossroads room rolls its 2 offers with a guarantee that at least one is affordable (one reroll).
* **Curse Hunted**: `Room` spawn uses `ENEMY_DEFAULTS.cursedChance * (1 + 1.5*curseHunted)`; HUD shows a red `HUNTED` chip under the hearts.
* **Revive** (`deathSave`): hp = 2 (tin 0), `hurtT = 2 s`, `explode` radius 260 dmg 40 `hurtPlayer:false`, clears enemy bullets in room, text `RISEN`, bus `player:revived`. Order of consumption: `black_cat_bone` (item removed), then `lazarus_pact` charges.
* **FirePool** (`items/fx/FirePool.js`, `fx_firepool`): `{x,y,r,t,dps,hurtsPlayer}`; ticks 0.5 s: enemies inside take `dps*0.5` and get burn; if `hurtsPlayer` and the player is inside: 1 unit (i-frames apply). Cap 8 pools alive (oldest fades).
### 2.6 Events and Save
New bus events: `synergy:activated {id,def}`, `synergy:lost {id}`, `coins:changed`, `room:wave`, `deal:paid`, `player:revived`, `curse:changed`. Save adds `synergiesSeen: []`, `unlockGroups: []` (written by the meta doc), settings `synergyHints: true`. API: `Save.itemUnlocked(id)` (true when `def.unlock == null` or its group is in `unlockGroups`), `Save.seeSynergy(id)`.

## 3. Tag system
Tags (26, snake_case): `fire poison frost shock holy explosive dynamite ghost luck gold undead_slayer familiar sixth crit armor speed rapid spread bounce pierce blood roll curse hex ammo heal`.
Count rule: a tag count = number of UNIQUE owned item defs (passives + the active) carrying the tag; copies count once. Helpers in `src/items/tags.js`: `tagCounts(player)`, `itemsWithTag(tag)`, `TAGS` (id, label, css colour for chips: fire #ff8a40, poison #9be060, frost #9fd8ff, shock #ffe070, holy #fff0b0, explosive #f0a640, dynamite #d9b071, ghost #8fe0c0, luck #8fc23f, gold #e8c84a, undead_slayer #e8dcc0, familiar #b8a0ff, sixth #ffc040, crit #ffb0a0, armor #b0b8c0, speed #f0d090, rapid #f0d090, spread #d9b071, bounce #c0c0ff, pierce #e0e0e0, blood #d63a2a, roll #c8a878, curse #a02c24, hex #b070ff, ammo #e8dcc0, heal #ff8a7a).
### 3.1 Mapping and small rebalances for the 28 existing items
| id | tags | tier | change |
|---|---|---|---|
| spurs | speed, roll | 1 | - |
| lucky_horseshoe | luck, crit | 1 | - |
| hollow_point | ammo | 1 | - |
| speed_loader | rapid | 2 | - |
| long_barrel | ammo | 1 | - |
| sawed_off | spread | 2 | - (see synergy `hail_of_lead`) |
| ricochet | bounce | 2 | - |
| dead_eye | crit, luck | 3 | - |
| bandolier | dynamite, explosive | 1 | - |
| snake_oil | heal | 1 | weight 1.0 -> 0.8 (too common: in 4 pools) |
| tin_star | armor | 1 | - |
| liquid_courage | blood | 2 | - |
| cursed_coin | gold, luck | 1 | - |
| rattler_fang | poison | 2 | poison 2 -> 3 dps (keeps pace with ch2 HP) |
| silver_bullets | undead_slayer, holy, ammo | 2 | - |
| dynamite_vest | dynamite, explosive, armor | 3 | - |
| spirit_lantern | ghost, fire, familiar | 3 | - |
| crow_companion | familiar | 2 | scales with `familiarMult`/`familiarCd` |
| voodoo_doll | hex | 2 | - |
| duster_coat | armor | 2 | - |
| prospectors_pan | gold | 1 | - |
| hex_bag | fire, hex | 2 | burn 15% -> 18% |
| fan_the_hammer | rapid, sixth | 3 | - |
| mezcal_worm | blood, speed | 2 | - |
| whiskey_bottle | heal | 1 | - |
| pocket_watch | speed | 2 | - |
| powder_keg | explosive, dynamite | 3 | - |
| lucky_deck | luck, gold | 2 | - |
`crit`/`luck` code change only: `Player.fire` reads `critMult`/`critCap`.

## 4. Item catalogue (46 new)
Ids never collide with existing item files. `Hook` column names the section 2.2 hook, `stats` = section 2.1.
### 4.1 Passives (30) - gameplay
| id | Name | Banner (desc) | Exact effect |
|---|---|---|---|
| forked_tongue | Forked Tongue | Bullets split in two when they hit | `splitCount+=2`, `splitMult=0.4`. Children: +-35 deg, 0.8x speed, life 0.35 s, 40% dmg, never re-split. Each extra copy +1 child (max 5). |
| widows_bone | Widow's Bone | Every 4th shot is a boomerang bone | `boomerangEvery=4` (extra copy: 3). Bone: full damage on the way out and back, infinite pierce, size 1.25, frame `bullet_bone`, spins. Sixth Bullet takes priority. |
| lightning_rod | Lightning Rod | 20% of hits arc lightning to 2 nearby foes | `chainChance+=0.20`, `chainCount=2`, `chainMult=0.5`, `chainRange=260`. Bullet tint pale yellow on chain-flagged shots. |
| blast_caps | Blasting Caps | 12% of shots explode on impact | `explodeChance+=0.12`, radius 90, 60% dmg to others in radius, no self damage, no obstacle break. Flagged bullets frame `bullet_cap`. |
| wraith_rounds | Wraith Rounds | 25% of shots are ghostly: through rocks, +1 pierce | `ghostChance+=0.25` (ghost bullet: spectral, +1 pierce, x1.15 dmg, frame `bullet_ghost`). |
| lodestone | Lodestone | Bullets drag nearby foes along | `pullRadius=140`, `pullSpeed=110` (Sixth x2). Bosses/heavy immune. Tint 0xa0a0b0. |
| blue_norther | Blue Norther | 20% of shots chill; three chills freeze | `chillChance+=0.20`. Chill x3 = frozen 1.2 s (x1.4 damage), shatter on frozen kill (5 shards). Frame `bullet_ice`. |
| brand_iron | Branding Iron | Burning foes take +30% damage; fire spreads on death | `burn+=0.08`, `burnVuln+=0.30`, `burnSpread=150`. |
| gila_gland | Gila Gland | Poison stacks 3x and bursts into a cloud | `poison+=1.5`, `poisonStackMax=3`, `poisonCloud=110` (3 s, 4 dps). |
| holy_water | Vial of Holy Water | 10% of hits call down holy light | `smiteChance+=0.10`, radius 80, dmg `damage*2` (x2 vs undead), 0.4 s cd. |
| wanted_poster | Wanted Poster | Marks the toughest foe: +50% damage taken, pays a bounty | `markCount=1`. On each `wave`, mark the highest-maxHp non-boss enemy (extra copy: +1). Marked kill drops 1 `coin_nickel` + 15% `heart_half`. |
| bronco_boots | Bronco Boots | Your dodge roll ends in a stunning stomp | `rollShock=170`, `rollShockMult=3` (10.5 dmg base), `rollStun=0.6`, clears enemy bullets in 120 px, `rollCooldown+=0.25`. Fires on `rollEnd`. |
| hand_mirror | Hand Mirror | Bullets that meet you mid-roll fly back | `rollReflect=70` (+30 per extra copy). Reflected bullet = your damage, spectral, aims at nearest foe. |
| black_cat_bone | Black Cat Bone | Cheat death once | `deathSave`: revive (2.5), then the item is removed. |
| blood_bandana | Blood Bandana | At 2 hearts or less: fire 30% faster, +40 speed | `applyLate`: if `hp <= 4`: `fireDelay*=0.70`, `moveSpeed+=40`. Red speed trail. |
| banker_ledger | Banker's Ledger | Cleared rooms pay interest: +1 coin per 8 held | `interestDiv=8`, `interestCap=5`. On `roomClear`: `min(5, floor(coins/8))` coin PICKUPS pop (so `coinMult` applies). |
| hush_money | Hush Money | Pay 8 coins to ignore a hit (once per room) | `hushCost=8`. `hurt` hook: coins >= 8 and not used this room -> coins -= 8, cancel, `hurtT=0.6`, coins spray as fx. Also 6 s global cooldown. |
| rabbits_foot | Rabbit's Foot | +1 luck. Lucky shots hit x2.5 | `luck+=1`, `critMult+=1.0`, `critCap+=0.10`. |
| dowsing_rod | Dowsing Rod | Reveals shops, treasure and secret rooms. +1 key | `floor` hook: reveal icons of shop/treasure/boss/secret rooms on the minimap (icon only, not visited). `onPickup`: +1 key. |
| bone_hound | Bone Hound | A skeletal hound bites foes and fetches pickups | Familiar 4.4. Extra copy: +1 hound (max 2). |
| tumbleweed_pal | Tumbleweed Pal | A friendly tumbleweed bounces around wrecking things | Familiar 4.4. |
| little_coffin | Little Coffin | A tiny coffin lets loose friendly bats | Familiar 4.4. |
| saints_halo | Saint's Halo | A halo absorbs one hit per floor, then blasts | `haloCharges+=1` + familiar 4.4. Absorb any damage source; on absorb `fx_nova` radius 200, dmg `3*damage`, clears bullets. Recharges on `floor`. |
| lit_cigar | Lit Cigar | Throw dynamite 3 tiles ahead. Short fuse, +25% blast | `dynamiteThrow=288`, `dynamiteFuse*=0.6` (min 0.5), `dynamiteDamage*=1.25`. Stick arcs 0.25 s toward aim/facing. |
| nitro_jelly | Nitro Jelly | Blasts leave burning ground and reach 20% farther | `dynamiteRadius*=1.2`, `dynamiteFirePool=1`: every player-owned explosion (dynamite, keg, cluster) leaves a FirePool r = 0.5*blast radius, 3 s, 6 dps (never hurts you). |
| short_cylinder | Short Cylinder | Every 5th shot is a Sixth Bullet | `sixthEvery-=1` (min 3). Cylinder HUD shows 5 slots. |
| hellfire_round | Hellfire Round | The Sixth Bullet detonates and ignites | `sixthExplode=130`: on the first enemy hit, `explode` r 130, dmg = bullet total dmg, burn 2.5 s, no self damage, `source:'sixth'`; bullet keeps flying. |
| carousel_slug | Carousel Slug | The Sixth Bullet circles you for 4 s | `sixthOrbit=4` (+1 s per extra copy): orbit rules 2.3. Replaces the flying Sixth Bullet. |
| widowmaker | Widowmaker | Kill with the Sixth Bullet: the next shot is a Sixth Bullet | `sixthRefund=1`, `sixthMult+=0.5`. `kill` with `info.sixth`: `cyl.pos = sixthEvery-1` (rate-limited 0.15 s). |
| ten_gauge_hammer | Ten-Gauge Hammer | The Sixth Bullet is a spread of 5 heavy slugs | `sixthSplit=4` (5 slugs at 0, +-10, +-20 deg), each slug x0.6 of the Sixth damage (pierce/pierce flags per slug). |
### 4.2 Actives (6, `type:'active'`, charge = room clears)
| id | Name | Charges | Banner | Exact effect |
|---|---|---|---|---|
| pawn_ticket | Pawn Ticket | 3 | Sell spare keys (4c) and dynamite (3c) for coins | Sells every key beyond 1 and every dynamite beyond 1 immediately (adds coins, respects 99 cap, ignores `coinMult`). Returns false (no charge spent) when nothing to sell. |
| dynamite_crate | Dynamite Crate | 4 | Drops a ring of 5 lit sticks; you are immune | 5 `Dynamite` at radius 110 around you, fuse 1.0 s, `playerDamage:0`, does not use inventory. Normal blast damage/radius stats apply. |
| gideons_bible | Gideon's Bible | 6 | Holy nova: 45 damage in 380 px, wipes bullets | `explode`-like nova (no obstacle break) dmg 45 (undead take `undeadDamageMult`), clears enemy bullets in radius; if it kills >= 3 foes heal 1 unit. `fx_nova`. |
| cylinder_spin | Cylinder Spin | 4 | Spin the cylinder: the next 3 shots are Sixth Bullets | `player.forceSixth = 3` (expires after 10 s). All Sixth modifiers apply. |
| lasso_rope | Lasso Rope | 3 | Yank the 3 nearest foes to you and stun them | 3 nearest non-boss enemies within 600 px are pulled to 90 px from you (0.25 s tween), stun 1.5 s. Bosses: slow x0.5 for 1.5 s, not moved. Returns false with no target. |
| ouija_planchette | Ouija Planchette | 5 | Spirit form for 3 s: untouchable, quick, shots pass rocks | Buff 3 s: i-frames (`spiritT`), `moveSpeed+=80`, `ghostChance=1`, +1 pierce; player alpha 0.55. Not through walls/pits. |
### 4.3 Crossroads items (10, pool `crossroads` only; `deal.pay` deducted on pickup)
| id | Name | Pay | Banner (boon + cost) | Boon | Drawback (permanent) |
|---|---|---|---|---|---|
| devils_own_colt | Devil's Own Colt | 1 heart container | x1.5 damage, slower fire. Costs a heart container | `bulletDamageMult*=1.5` | `fireDelay*=1.15` |
| cylinder_of_sin | Cylinder of Sin | 2 keys | Every 3rd shot is a Sixth Bullet. Others hit weak | `sixthEvery=3`, `sixthMult+=1`, `sixthPierce+=1` | `normalDamageMult*=0.6` |
| bloodletter | Bloodletter | 15 coins | Sixth Bullet hits x4, but costs half a heart | `sixthMult+=2` | each Sixth shot costs 1 hp unit (only while hp > 2; at hp <= 2 the +2 is lost) |
| reapers_bargain | Reaper's Bargain | 4 tin | All shots ghostly and piercing. You are hunted | `ghostChance=1`, `pierce+=2`, `homing+=0.15` | `bulletDamageMult*=0.75`, `curseHunted=1` |
| gold_fever | Gold Fever | 25 coins | +1.5% damage per coin held (max +75%). Hits cost coins | `applyLate`: `bulletDamageMult*=1+min(coinDamageCap, coins*0.015)`; hook `coins` -> recompute | being hit drops 25% of coins (min 3) as pickups on the floor (re-collectable) |
| brimstone_bandolier | Brimstone Bandolier | 1 heart container | Dynamite regrows and hits x2. Blasts hurt you | `dynamiteRegen=6`, `dynamiteRegenCap=3`, `dynamiteDamage*=2`, `dynamiteRadius+=60` | `explosionVuln=1`: `explosionImmune` forced 0 (cancels dynamite_vest), explosions cost +1 unit |
| lazarus_pact | Lazarus Pact | 1 heart container | Rise twice from death, weaker each time | 2 revives (2.5 rules) | each revive permanently `penalty.containers++`; item removed after the 2nd |
| pact_of_ashes | Pact of Ashes | 3 dynamite | All shots burn, 2.5x fire damage. Ash burns you too | `burn=1`, `burnDpsMult*=2.5`, `burnSpread=120`, burning kills leave FirePool r 80 | those FirePools hurt you (1 unit/s) |
| devils_dice | Devil's Dice | 3 keys | +4 luck, lucky shots x3. You are hunted | `luck+=4`, `critMult+=0.5`, `critCap+=0.20` | `curseHunted=1` |
| leech_contract | Leech Contract | 12 coins | Kills may heal you. Hearts turn to coins | `killHeal=0.07` (1 unit), `sixthKillHeal=0.20` | `heartToCoin=1`: red-heart pickups become 2 coins (`collect` hook) |
### 4.4 Familiars (4, `items/familiars/*`, extend `Familiar`, invulnerable, excluded from snapshots via `own()`)
| Class | Art (`familiars_v2`, 64x64, 2 frames, 6 fps flip) | Behaviour (exact) |
|---|---|---|
| `BoneHound` | skeleton dog, red eyes, spiked collar | Trails player at 90-140 px. With enemies: dashes at nearest within 380 px at 520 px/s, bite `max(3, damage*1.5)*familiarMult`, cd `0.6*familiarCd`, then returns. No enemies and pickups (coin/nickel/key/dynamite, hearts only if hp < max) within 400 px: runs over, collects for you. |
| `TumbleweedPal` | round grinning tumbleweed | r 28, rolls 260 px/s bouncing off walls/obstacles, 25% steering toward nearest enemy; contact 5 dmg per enemy per 0.4 s; hits `breakable` tiles once per bounce. Ignores bullets. |
| `LittleCoffin` | 64px coffin, lid ajar (frame b = lid open) | Hops behind you. While enemies exist, every `5*familiarCd` s: 2 bats (`enemy_bat` scaled 0.5, tint 0xb8a0ff) seek nearest foes, 0.9*damage (min 2) then vanish; extra copy +1 bat. |
| `SaintsHalo` | gold cracked halo with tiny wings (b = dimmed spent) | Floats above head; absorbs per `haloCharges`, see 4.1. Bright when armed, grey when spent. |

### 4.5 Meta table (pool, weight, tier, tags, unlock) - all 46
`pool` uses room pools `treasure shop boss secret crossroads` + marker `c2` (only floor >= 4). `Unl` = unlock group (section 6), `-` = available from the start.
| id | Type | Tier | Pool | Wt | Tags | Unl |
|---|---|---|---|---|---|---|
| forked_tongue | P | 2 | treasure boss | 1.0 | spread ammo | - |
| widows_bone | P | 2 | treasure boss | 0.8 | ammo pierce bounce | ug_gulch |
| lightning_rod | P | 2 | treasure boss secret | 0.8 | shock | - |
| blast_caps | P | 1 | treasure shop | 1.0 | explosive ammo | - |
| wraith_rounds | P | 2 | treasure secret | 0.7 | ghost pierce | ug_perdition |
| lodestone | P | 2 | treasure boss | 0.7 | ammo | ug_mine |
| blue_norther | P | 2 | treasure shop boss | 0.8 | frost | - |
| brand_iron | P | 2 | treasure boss | 0.8 | fire | ug_perdition |
| gila_gland | P | 2 | treasure secret | 0.8 | poison | ug_mine |
| holy_water | P | 2 | treasure shop boss | 0.8 | holy undead_slayer | - |
| wanted_poster | P | 2 | treasure shop | 0.8 | gold crit | - |
| bronco_boots | P | 2 | treasure boss | 0.8 | roll speed | - |
| hand_mirror | P | 2 | treasure boss secret | 0.6 | roll armor | ug_mine |
| black_cat_bone | P | 3 | boss secret | 0.4 | luck | ug_undead |
| blood_bandana | P | 1 | treasure shop | 1.0 | blood speed rapid | - |
| banker_ledger | P | 1 | treasure shop | 1.0 | gold | - |
| hush_money | P | 2 | treasure shop secret | 0.6 | gold armor | ug_gulch |
| rabbits_foot | P | 1 | treasure shop secret | 1.0 | luck crit | - |
| dowsing_rod | P | 1 | treasure shop | 1.0 | luck | ug_gulch |
| bone_hound | P | 2 | treasure boss | 0.8 | familiar | - |
| tumbleweed_pal | P | 1 | treasure shop | 1.0 | familiar | - |
| little_coffin | P | 2 | treasure boss c2 | 0.7 | familiar | ug_perdition |
| saints_halo | P | 3 | boss c2 | 0.4 | holy armor familiar | ug_c2 |
| lit_cigar | P | 1 | treasure shop | 1.0 | dynamite explosive | - |
| nitro_jelly | P | 2 | treasure secret | 0.7 | explosive fire dynamite | ug_boom |
| short_cylinder | P | 2 | treasure boss | 0.8 | sixth | - |
| hellfire_round | P | 3 | boss secret c2 | 0.5 | sixth fire explosive | ug_sixth |
| carousel_slug | P | 3 | treasure boss c2 | 0.5 | sixth ammo | ug_sixth |
| widowmaker | P | 3 | boss c2 | 0.5 | sixth | ug_c2 |
| ten_gauge_hammer | P | 2 | treasure boss | 0.7 | sixth spread | - |
| pawn_ticket | A | 1 | shop treasure | 0.8 | gold | - |
| dynamite_crate | A | 2 | treasure secret | 0.7 | dynamite explosive | ug_mine |
| gideons_bible | A | 3 | boss treasure c2 | 0.5 | holy undead_slayer | ug_undead |
| cylinder_spin | A | 2 | treasure boss | 0.7 | sixth | - |
| lasso_rope | A | 2 | treasure shop | 0.7 | hex | - |
| ouija_planchette | A | 3 | boss secret c2 | 0.5 | ghost | ug_c2 |
| devils_own_colt | D | 3 | crossroads | 1 | curse ammo | - |
| cylinder_of_sin | D | 3 | crossroads | 1 | sixth curse | ug_deals |
| bloodletter | D | 3 | crossroads c2 | 1 | sixth blood curse | ug_deals |
| reapers_bargain | D | 3 | crossroads c2 | 1 | ghost pierce curse | ug_deals |
| gold_fever | D | 3 | crossroads | 1 | gold curse | - |
| brimstone_bandolier | D | 3 | crossroads c2 | 1 | dynamite explosive curse | ug_deals |
| lazarus_pact | D | 3 | crossroads c2 | 1 | heal curse | ug_deals |
| pact_of_ashes | D | 3 | crossroads | 1 | fire curse | ug_deals |
| devils_dice | D | 3 | crossroads | 1 | luck crit curse | ug_deals |
| leech_contract | D | 3 | crossroads | 1 | blood heal curse | - |
Shop prices by tier: T1 10c, T2 13c, T3 16c; actives +2; floors 4-6 +3; then `Player.price()` discounts (min 1).

### 4.6 Icons (96x96, chunky collectable object on transparent, ink outline, top-left light) and flavour lines
Sheets `items2_a..f` (4x2 each, cells named by id, order = this table). Crossroads icons all sit on a small scorched black disc with a hell-red rim glow so they read as "devil's goods".
| Sheet | Cell | id | Icon art | Flavour line |
|---|---|---|---|---|
| items2_a | 1 | forked_tongue | red snake tongue split in a Y, a bullet at each tip | "Say it twice, hit it twice." |
| items2_a | 2 | widows_bone | white femur bent like a boomerang, black-widow hourglass mark | "She always comes back." |
| items2_a | 3 | lightning_rod | copper rod on a glass insulator, yellow zigzag bolt on its tip | "Stand near the tall fellow." |
| items2_a | 4 | blast_caps | three brass percussion caps with red powder and a fizzing spark | "Small pops, big feelings." |
| items2_a | 5 | wraith_rounds | translucent green-white bullet with a skull face and ectoplasm tail | "Rocks are just suggestions." |
| items2_a | 6 | lodestone | dark iron-ore rock with nails and a spoon clinging to it, pull lines | "Everything comes to it eventually." |
| items2_a | 7 | blue_norther | frosted brass shell wrapped in a blue bandana, ice crystals | "The wind that kills by noon." |
| items2_a | 8 | brand_iron | glowing red-hot branding iron with a skull brand | "Property of the Devil." |
| items2_b | 1 | gila_gland | glass vial of green venom beside a gila-monster tooth | "Bitten once, thrice regretted." |
| items2_b | 2 | holy_water | corked glass vial of gold-white liquid, a small cross etched | "Blessed by a priest who owed us." |
| items2_b | 3 | wanted_poster | torn poster with a skull sketch, red X stamp, four nails | "Dead or dead." |
| items2_b | 4 | bronco_boots | cowboy boot with a huge star spur and a dust ring | "Land on something soft. Preferably him." |
| items2_b | 5 | hand_mirror | cracked ornate silver hand mirror reflecting a bullet | "Seven years' bad luck. Seven bullets back." |
| items2_b | 6 | black_cat_bone | black cat skull tied with red thread and a bell, one green eye | "Landed on its feet. Again." |
| items2_b | 7 | blood_bandana | knotted crimson bandana, dark drip pattern | "Wash it and you jinx it." |
| items2_b | 8 | banker_ledger | green ledger book beside a coin stack and a pencil stub | "Even the dead earn interest." |
| items2_c | 1 | hush_money | bundle of notes tied with twine, bloody thumbprint | "Silence is golden. So is this." |
| items2_c | 2 | rabbits_foot | rabbit foot on a chain, gold cap, tuft of fur | "Lucky for someone. Not the rabbit." |
| items2_c | 3 | dowsing_rod | Y-shaped hazel stick, glowing tips, faint blue wave lines | "It twitches toward trouble." |
| items2_c | 4 | bone_hound | skeleton dog head with red eyes and a spiked collar | "Good boy. Bad news." |
| items2_c | 5 | tumbleweed_pal | round grinning tumbleweed with two eyes and a tiny hat | "Nobody is lonelier. Nobody is faster." |
| items2_c | 6 | little_coffin | tiny coffin lid ajar, two bat eyes glowing inside | "Room for one more. Or a dozen bats." |
| items2_c | 7 | saints_halo | gold cracked halo ring with two tiny wings | "Borrowed. Do not ask from whom." |
| items2_c | 8 | lit_cigar | burning cigar with a dynamite-stick band | "Smoke it or throw it." |
| items2_d | 1 | nitro_jelly | glass jar of glowing orange jelly, X label, flames below | "Do not shake. Do not look at." |
| items2_d | 2 | short_cylinder | revolver cylinder with 5 chambers, one gold round | "One chamber fewer, one truth sooner." |
| items2_d | 3 | hellfire_round | cartridge wreathed in red-black hellfire | "Loaded in the low place." |
| items2_d | 4 | carousel_slug | brass bullet on a ring with three ghost echoes | "Round and round and round he goes." |
| items2_d | 5 | widowmaker | black crepe veil draped over a revolver hammer | "Every kill is a wedding." |
| items2_d | 6 | ten_gauge_hammer | red shotgun shell bursting five pellets | "Subtle is for the living." |
| items2_d | 7 | pawn_ticket | pink pawnshop ticket with three balls, string tie | "Everything has a price. Even that." |
| items2_d | 8 | dynamite_crate | wooden crate with dynamite sticks poking out | "This side up. Stand far." |
| items2_e | 1 | gideons_bible | black leather bible, gold cross, glowing page edges | "Found in every motel. Not this one." |
| items2_e | 2 | cylinder_spin | revolver cylinder mid-spin, blurred arcs | "Let fate pick the chamber." |
| items2_e | 3 | lasso_rope | coiled rope with a noose loop | "Come here, friend." |
| items2_e | 4 | ouija_planchette | wooden planchette with a glass eye, ghost wisp | "Ask nicely. It listens." |
| items2_e | 5 | devils_own_colt | red-black revolver with a horned grip, hell rim | "Signed, sealed, loaded." |
| items2_e | 6 | cylinder_of_sin | cylinder with 3 glowing chambers and a red wax seal | "Three chambers. Three sins." |
| items2_e | 7 | bloodletter | brass bullet dripping blood beside a lancet | "A little off the top." |
| items2_e | 8 | reapers_bargain | skull-engraved coin over a broken scythe blade | "He does not haggle." |
| items2_f | 1 | gold_fever | skeletal hand clutching gold nuggets, gold glow | "Heavier with every coin." |
| items2_f | 2 | brimstone_bandolier | dynamite bandolier crusted yellow, horned skull buckle | "Smells of eggs and regret." |
| items2_f | 3 | lazarus_pact | contract with a bloody thumbprint and tombstone seal, rising hand | "Terms: you rise. Ours to keep." |
| items2_f | 4 | pact_of_ashes | burning scroll crumbling to embers | "Read it and it reads you." |
| items2_f | 5 | devils_dice | pair of red dice with tiny horned pips | "The house has a hoof." |
| items2_f | 6 | leech_contract | jar with a fat leech and a rolled contract | "Sign here. Bleed there." |
| items2_f | 7-8 | (empty, unused, reserved) | - | - |

## 5. Synergies (26). Engine: `src/items/synergies.js`
`SYNERGIES = [{id,name,kind:'pair'|'tag'|'capstone', req, desc, cue, apply(stats,player), applyLate?, hooks?}]`. Evaluated at the end of `recomputeStats` in order pair -> tag -> capstone (capstones may require other synergy ids); their `apply` runs after all item `apply` and before `applyLate`. Diff against `player.synergies` emits `synergy:activated` / `synergy:lost` (silent on run start, floor load, and while `player.loading`). One item may sit in many synergies. HUD cue colour: pair gold, tag green, capstone red-gold (adds screen flash and 0.3 s slow-mo).
### 5.1 Pair synergies (10)
| id | Name | Requires | Exact bonus | Cue line |
|---|---|---|---|---|
| witches_brew | Witches' Brew | hex_bag + rattler_fang | enemies both burning and poisoned take poison dps x2; green-orange flame tint | "WITCHES' BREW - burning poison bites twice" |
| rolling_thunder | Rolling Thunder | bronco_boots + spurs | `rollShock+=60` (230 px), `rollStun+=0.4` (1.0 s), `rollCooldown-=0.35` | "ROLLING THUNDER - the stomp shakes the room" |
| sanctified_silver | Sanctified Silver | holy_water + silver_bullets | `smiteChance+=0.10`; smite kills of undead drop `heart_half` 15% | "SANCTIFIED SILVER - the light finds the dead" |
| static_ricochet | Static Ricochet | lightning_rod + ricochet | a bullet that bounces off wall/obstacle becomes charged: its next hit always chains, +1 chain target | "STATIC RICOCHET - bounced bolts always arc" |
| fireworks | Fireworks | lit_cigar + nitro_jelly | every player explosion spawns `dynamiteCluster=3` mini blasts (radius 60%, dmg 40%, 0.15 s apart, random in 1.2x radius), each leaving a FirePool | "FIREWORKS - the blast has friends" |
| boneyard_pack | Boneyard Pack | bone_hound + little_coffin | hound speed x1.5 and its bites apply `mark`; coffin releases 4 bats and cd -1 s | "BONEYARD PACK - the whole graveyard barks" |
| six_feet_under | Six Feet Under | widowmaker + hellfire_round | hellfire explosion kills count as Sixth kills (refund chain), `sixthExplode+=40` | "SIX FEET UNDER - one grave, many more" |
| patient_hand | Patient Hand | dead_eye + short_cylinder | the dead-eye shot is also a Sixth Bullet (x3 * sixthMult); reticle turns gold | "PATIENT HAND - wait, then end it" |
| money_talks | Money Talks | banker_ledger + hush_money | `hushCost` 8 -> 5, `interestCap+=3`; coins paid to hush drop as pickups | "MONEY TALKS - silence is cheaper now" |
| hail_of_lead | Hail of Lead | sawed_off + fan_the_hammer | pellet penalty softened: `bulletDamageMult` x1.21 (0.7 -> 0.85 per copy), fan inaccuracy 8 -> 5 deg | "HAIL OF LEAD - the whole room gets a piece" |
### 5.2 Tag-threshold synergies (8). Count = unique items with tag
| id | Name | Requires | Exact bonus | Cue line |
|---|---|---|---|---|
| pyromaniac | Pyromaniac | fire >= 3 | `burn+=0.20`, `burnDpsMult*=1.5`, you are immune to your own FirePools | "PYROMANIAC - everything burns better" |
| demolition_crew | Demolition Crew | explosive >= 3 | `dynamiteRadius+=30`, `dynamiteDamage*=1.25`, `dynamiteRefund+=0.20`, `explodeChance+=0.06` | "DEMOLITION CREW - the fuse never ends" |
| consecrated_ground | Consecrated Ground | holy >= 3 | `undeadDamageMult+=0.5`, `smiteChance+=0.05`, undead kills drop `heart_half` 8% | "CONSECRATED GROUND - the dead cannot rest" |
| high_roller | High Roller | luck >= 4 | `luck+=2`, `critCap+=0.10`, lucky shots `critPierce+=1` | "HIGH ROLLER - the dice love you" |
| gold_rush | Gold Rush | gold >= 4 | `coinMult+=0.25`, `shopDiscount+=1`, `roomClearCoins+=1` | "GOLD RUSH - the floor is paved with it" |
| pack_leader | Pack Leader | familiar >= 3 | `familiarMult*=1.35`, `familiarCd*=0.8`; familiar bullets inherit burn/poison/chill/fear | "PACK LEADER - the posse follows" |
| iron_hide | Iron Hide | armor >= 3 | `hitCap=1` (a hit deals max 1 unit while tin > 0); 5% per room clear to drop `heart_tin` | "IRON HIDE - the star deflects" |
| quicksilver | Quicksilver | speed >= 3 | `rollCooldown-=0.3`, `moveSpeed+=30`, `rollGrace+=0.1` | "QUICKSILVER - faster than the draw" |
### 5.3 Capstone synergies (8, build finishers)
| id | Name | Requires | Exact bonus | Cue line |
|---|---|---|---|---|
| sixth_sacrament | The Sixth Sacrament | sixth >= 4 | `sixthPierce+=2`, `sixthRicochet+=1`, `sixthHoming+=0.35`, `sixthMult+=0.5`; a Sixth Bullet that hits >= 2 enemies grants +1 active charge | "THE SIXTH SACRAMENT" |
| hellstorm | Hellstorm | pyromaniac + demolition_crew | every player explosion ignites all enemies inside for 4 s; FirePools last +2 s; burning deaths explode (r 100, 20 dmg) | "HELLSTORM - rain fire, bury it" |
| dead_man_walking | Dead Man Walking | blood >= 3 | at `hp <= 2`: `fireDelay*=0.65`, `bulletDamageMult*=1.5`, `hurtInvuln=2.0`, `pierce+=1`; always `killHeal+=0.04` (max once per room) | "DEAD MAN WALKING - one heart, all guns" |
| spectral_posse | Spectral Posse | ghost >= 3 + familiar >= 3 | `spectralFamiliars=1` (familiar shots/bats pass rocks), `ghostChance*=1.5`, a free Spirit Lantern flame (removed if the synergy is lost) | "SPECTRAL POSSE - the dead ride with you" |
| house_always_wins | The House Always Wins | high_roller + gold_rush | `jackpot`: each room clear 12% (+1% per luck) pays 2 `coin_nickel` + `heart_full` + `key`; lucky shots drop a coin 25% (`critCoinChance`) | "JACKPOT ROOM - the house always wins" |
| avenging_angel | Avenging Angel | consecrated_ground + iron_hide | every hit taken releases a holy nova (r 240, dmg `4*damage`, wipes bullets); +1 free tin heart per floor | "AVENGING ANGEL - be struck, strike back" |
| elemental_trinity | Elemental Trinity | 3 distinct of fire/poison/frost/shock/holy present | +10% chance of each present element on every bullet (burn/poison-stack/chill/chain/smite); enemies with >= 3 of burn/poison/chill/mark/fear take x1.5 | "ELEMENTAL TRINITY - convergence" |
| devils_dust | Devil's Dust | quicksilver + roll >= 2 | rolling leaves a 1.5 s dust trail: enemies touching it take `2*damage` per 0.1 s tick and are slowed 2 s; it deletes enemy bullets | "DEVIL'S DUST - the road bites back" |
Implementation notes: pair/tag/capstone `req` for tags evaluated from `tagCounts`; `hooks` used by static_ricochet (`hit`,`bullet bounce`), fireworks/hellstorm (`explosion`), six_feet_under (`kill`), avenging_angel (`hurt` post), house_always_wins (`roomClear`, `fire`), devils_dust (`update` + FirePool-style `DustTrail`), spectral_posse (creates/destroys `SpiritLantern` with `free:true`), sixth_sacrament (`hit`).

## 6. Pool logic, chapters, unlocks
`ItemSystem.roll(pool, r, {type, floor, fallback})` changes:
1. Candidates: `def.pool.includes(p)`, not in `taken`, `Save.itemUnlocked(def.id)`, `!(def.pool.includes('c2') && floor < 4)`, `floor >= (def.minFloor||1)`.
2. Weight = `def.weight * tierMult * bias`. `tierMult`: floors 1-3: T1 1.0, T2 1.0, T3 0.7; floors 4-6: T1 0.55, T2 1.0, T3 1.3 (deals ignore tierMult). `bias` (build coherence, off for crossroads): x1.15 if the item shares a tag with an owned item; x1.30 if owning it would activate a synergy (`wouldComplete`). Bias applies once (max x1.30).
3. `FALLBACK_ORDER` never includes `crossroads`; a `crossroads` roll uses `fallback:false` (null = sold out, room shows an empty devil pedestal).
4. Total pool sizes: ch1 non-crossroads eligible = 28 old + 29 new (25 passive + 4 active, ignoring lock) = 57; ch2 adds 7 c2-only (5 passive, 2 active) = 64; crossroads 10 (4 c2-only).
5. New rooms (crossroads) call `roll('crossroads', r, {floor})` twice and offer both with `deal.pay` plates; the events doc owns the room layout.
Unlock groups (meta doc maps each `ug_*` to an achievement/bounty and owns the write to `Save.unlockGroups`; suggestion in brackets). Start-unlocked (21): forked_tongue, lightning_rod, blast_caps, blue_norther, holy_water, wanted_poster, bronco_boots, blood_bandana, banker_ledger, rabbits_foot, bone_hound, tumbleweed_pal, lit_cigar, short_cylinder, ten_gauge_hammer, pawn_ticket, cylinder_spin, lasso_rope, devils_own_colt, gold_fever, leech_contract.
| Group | Items | Suggested trigger |
|---|---|---|
| ug_gulch | widows_bone, hush_money, dowsing_rod | beat El Cascabel |
| ug_perdition | wraith_rounds, brand_iron, little_coffin | beat Marshal Grimm |
| ug_mine | lodestone, gila_gland, hand_mirror, dynamite_crate | beat The Undertaker |
| ug_c2 | saints_halo, widowmaker, ouija_planchette | reach floor 5 / beat a ch2 boss |
| ug_deals | cylinder_of_sin, bloodletter, reapers_bargain, brimstone_bandolier, lazarus_pact, pact_of_ashes, devils_dice | make 3 devil deals |
| ug_sixth | hellfire_round, carousel_slug | 100 kills with the Sixth Bullet |
| ug_boom | nitro_jelly | 50 explosion kills |
| ug_undead | gideons_bible, black_cat_bone | kill 150 undead |
Existing 28 items stay unlocked. Locked items never appear in any pool and show `???` + the unlock hint in the codex.

## 7. HUD / UX
* **Synergy toast** (`ui/SynergyToast.js`, `synergy:activated`): image `ui_synergy_ribbon` (900x140) at (720, 410) under the item banner, tag `SYNERGY` / `BUILD BONUS` / `CAPSTONE` (colour by kind), name in `FONT_TITLE` 40 px, cue line in `FONT_BODY` 22 px; the two contributing icons (or the tag chip) at its ends; hold 2.6 s, queued after the item banner, 0.35 s scale-in. Effects: `Sfx item_get` rate 1.4 (+ `room_clear` layered for capstones), gold `ringPulse` on player, `hud:flash` gold 0.15 (capstone: red-gold 0.3 + `slowMo(0.3, 0.3)`).
* **Relics strip**: items belonging to an active synergy get a thin gold underline and a 1.2 s glint on activation. `Relics` reads `player.synergies`.
* **Tooltip** (extends Relics hover): name, desc, tag chips (coloured text `FIRE  EXPLOSIVE`), tier pips (1-3 stars), lore line in italic, then synergy section: `ACTIVE: name` (green) or `+ Partner = NAME` only for synergies in `Save.synergiesSeen`, otherwise one line `??? synergy` per unseen pair. Tag threshold progress `FIRE 2/3`.
* **Banner** (`Banner.js`): adds a tags line (small chips) below desc; crossroads banner uses tag line `DEVIL'S DEAL` in hell red.
* **Pedestal hint** (setting `synergyHints`): when the player nears a pedestal whose item would activate a synergy (`ItemSystem.wouldComplete(id)`), a gold spark ring pulses and the name tag adds `SYNERGY!` (no name). Crossroads pedestal shows a red price plate with icons and amount (`-1 heart`, `25 coins`, `2 keys`, `4 tin`, `3 dynamite`).
* **Cylinder**: draws `sixthEvery` chambers (3..8); forced Sixth (`cylinder_spin`) shows the ring glowing with the remaining count; orbiting Sixth slugs draw a thin gold circle on the floor.
* **Pause `BUILD` panel**: item list with tags, active synergies, tag progress bars (all tags with count >= 1), curse chips.
* **Curses**: red `HUNTED` chip under hearts with tooltip.
* **Codex hooks** (`items/codexData.js`, consumed by the meta doc's Codex scene): `codexEntries()` -> `[{id,name,desc,lore,tags,type,tier,pools,unlocked,seen,synergyIds,icon,unlockGroup}]`, `synergyEntries()` -> `[{id,name,kind,reqLabel,desc,seen}]`. Seen items are those in `Save.itemsSeen`; unseen unlocked show a black-filled icon and `???`; codex filter by tag uses `TAGS`.

## 8. Assets (10 generations)
| Key | Type / size | Frames | Description |
|---|---|---|---|
| `items2_a`..`items2_f` | grid 4x2, 96x96 | 8 each (see 4.6) | item icons; f has 6 icons + 2 empty cells |
| `familiars_v2` | grid 4x2, 64x64, anchor bottom | `bone_hound_a/b`, `tumble_pal_a/b`, `coffin_pal_a/b`, `halo_a/b` | tiny ink-cartoon familiars, 2-frame idle each, big-head cute-macabre, strong outline readable on all floors |
| `fx_items` | grid 4x2, 128x128, anchor center | `fx_firepool` (top-down flame patch), `fx_holy_pillar` (vertical gold-white light beam), `fx_shock_ring` (stomp ring with cracks), `fx_toxic_cloud` (green puff), `fx_dust_cloud` (tan dust puff), `fx_mark` (red crosshair X), `fx_ice_burst` (blue-white crystal burst), `fx_nova` (gold holy ring) | translucent ink-outlined effects, additive-friendly, no ground shadow |
| `projectiles_v2` | grid 4x2, 48x48, anchor center, elongated point RIGHT | `bullet_bone`, `bullet_ghost` (pale green translucent slug), `bullet_cap` (red-orange cap slug), `bullet_orbit` (big brass slug with swirl), `bullet_ice`, `bullet_coin` (gold coin), `bullet_mirror` (silver shard), `bullet_child` (small brass splinter) | must stay distinct from enemy embers (red-orange ball) and venom (green blob): player shots keep a pale core + coloured glow |
| `ui_synergy_ribbon` | image, transparent 900x140 | 1 | gold-edged red ribbon banner with torn ends and empty centre |
Reuse (no art): `enemy_bat` (little coffin bats), `enemy_crow`, `glow`/`ring` textures, code-drawn `fx.arc` lightning, dust trail, orbit ring, tag chips, deal price plate (text over `pedestal_shop`).

## 9. Implementation map (which system to extend)
| File | Change |
|---|---|
| `config.js` | PLAYER_BASE new keys (2.1), `ITEM_CAPS` (1.3), `TIER_MULT`, shop price by tier |
| `items/registry.js` | new fields (1.1), `itemsWithTag`, `synergiesFor(id)` |
| `items/hooks.js`, `tags.js`, `synergies.js`, `codexData.js` | new (2.2, 3, 5, 7) |
| `items/defs/*.js` | 46 new files + edit 28 (tags/tier/lore, rebalances 3.1) |
| `items/familiars/{BoneHound,TumbleweedPal,LittleCoffin,SaintsHalo}.js` | new, extend `Familiar` |
| `items/fx/{FirePool,DustTrail,Nova}.js`, `systems/Fx.js` `arc()` | new |
| `items/ItemSystem.js` | `roll` rules (6), `wouldComplete`, `canPay/pay`, unlock filter |
| `entities/Player.js` | `cyl`/`forceSixth`, pipeline 2.3, hooks calls, `penalty`, deathSave, hush/halo ordering in `damage`, `hurtInvuln`, `collect` hook + `coins:changed`, `dynamiteRegen`, `dynamiteThrow`, `spiritT`, synergy recompute, roll shock/grace |
| `systems/Bullets.js` | mods (2.3), `frame/sheet`, `child`, orbit/boomerang/pull/reflect |
| `enemies/Enemy.js` | statuses (2.4), `takeHit` multipliers (mark, frozen, burnVuln, `chain` info), `die` payload + kill hook |
| `systems/Explosions.js`, `entities/Dynamite.js` | `owner`, `source`, `explosion` hook, `owner:'player'` on player dynamite, FirePool spawn |
| `rooms/Room.js`, `RoomManager.js` | `room:wave`, `roomClear` hook, cursed chance, dowsing reveal (`revealRoom(id,{iconOnly:true})`), heart-to-coin |
| `entities/Pedestal.js` | tag chips, synergy spark, deal plate |
| `ui/*` | Banner, Relics tooltip, SynergyToast, Cylinder N slots, Curse chip, Pause BUILD tab |
| `core/Save.js`, `core/Debug.js` | fields/API (2.6); `api`: `giveItems(ids)`, `tags()`, `synergies()`, `setHp(n)`, `setCoins(n)`, `rollPool(pool,n,floor)`; `state()` adds `synergies`, `tags`, `cyl`, `familiars`, `itemState`, `curses` |
| `tools/qa/regress-items2.mjs`, `items2-static.mjs` | new (section 10) |

## 10. Test plan
Setup: `?debug=1&seed=42`, `g.startRun()`, `__dw.api.godMode(true)` unless testing damage; `__dw.api.spawn('outlaw', x, y)` for targets; `__dw.api.input({aim:{x:1,y:0}, fire:true})` to shoot; read `__dw.api.state()` (stats/items/synergies/tags/cyl).
### 10.1 Static (`items2-static.mjs`, node, no browser)
74 registered defs (28+46); ids unique and snake_case; every tag in the 26; every def has tags/tier/lore; desc <= 70, name <= 22; icons unique per sheet and match section 4.6; `pool` values valid; crossroads defs have `deal` and only pool `crossroads`; every synergy `req` references real ids/tags; every `ug_*` item exists; locked + c2 items absent from `rollPool` results at floor 1; 10000 rolls of each pool never return a taken id.
### 10.2 Generic runtime (each of 46 items)
`giveItem(id)` -> no console error, `state().stats` has no NaN/undefined, item in `state().items` (or `state().active`), banner shown (`__dw.hud` Banner queue), icon cell resolved (`Assets.has` or placeholder). Give all 46 (+28) at once: no NaN, `fps >= 30`, kill a 5-enemy room without exceptions (stress).
### 10.3 Per-item assertions
| id | Assertion after `giveItem` |
|---|---|
| forked_tongue | `stats.splitCount==2`; shoot one outlaw at 300 px: bullets alive spike by 2 after the hit, total damage > single-hit |
| widows_bone | `boomerangEvery==4`; 4th shot returns: bullet within 40 px of player by ~1.2 s and hits a wall-side target twice |
| lightning_rod | `chainChance==0.2`; with the chance forced to 1 in the test: 3 outlaws in a cluster all take damage from 1 bullet |
| blast_caps | `explodeChance==0.12`; force 1.0: victim neighbours within 90 px hurt, player HP unchanged |
| wraith_rounds | `ghostChance==0.25`; force 1.0: bullet passes through a rock and pierces 2 enemies |
| lodestone | `pullRadius==140`; enemy 100 px off the bullet path moves toward it; boss does not |
| blue_norther | chill x3 on a target -> `status.frozen`, stunned, x1.4 damage; kill it frozen -> 5 child bullets |
| brand_iron | `burnVuln==0.3`; burning enemy takes 1.3x; kill it: neighbour within 150 px ignites |
| gila_gland | `poison==1.5`; 3 hits -> poison stacks 3 (dps 4.5); poisoned kill spawns cloud radius 110 |
| holy_water | `smiteChance==0.1`; force 1.0: AoE at target, ghost takes extra, cd 0.4 s respected |
| wanted_poster | on wave spawn the max-HP enemy has `status.mark`; takes 1.5x; kill drops a nickel |
| bronco_boots | `rollShock==170`, `rollCooldown==1.25`; roll next to enemy: damage 10.5, stun 0.6, bullets in 120 px cleared |
| hand_mirror | `rollReflect==70`; enemy bullet during roll becomes a player bullet |
| black_cat_bone | `api.die()` -> revived at hp 2, item gone from `items`; second `die()` kills |
| blood_bandana | `hp<=4` -> `fireDelay*0.7`, `moveSpeed+40`; heal above 4 -> back to base |
| banker_ledger | coins=40, `clearRoom()` -> 5 extra coin pickups; coins=7 -> 0 |
| hush_money | coins=20, `hurt(1)` -> hp unchanged, coins 12; second hurt in same room deals damage; coins=5 -> hurt applies |
| rabbits_foot | `luck+1`, `critMult==2.5`, `critCap==0.4` |
| dowsing_rod | after `setFloor(2)` special-room icons appear in `roomMgr.visibleRooms()`; `keys+1` |
| bone_hound | `familiars` +1; hound kills an outlaw alone within 10 s; drops a coin and it is collected without moving |
| tumbleweed_pal | familiar bounces, damages a stationary enemy, breaks a barrel |
| little_coffin | after 5 s with an enemy: 2 bat entities spawn and damage it |
| saints_halo | `haloCharges==1`; `hurt(1)` absorbed (hp same), nova fires; second hurt lands; `setFloor` re-arms |
| lit_cigar | place dynamite (E): appears ~288 px ahead, fuse 0.84 s |
| nitro_jelly | explosion leaves FirePool that burns an enemy, never the player |
| short_cylinder | `sixthEvery==5`; 5th shot is sixth (`bullet.sixth`); Cylinder shows 5 slots |
| hellfire_round | Sixth bullet hit -> explosion r 130 damages neighbour, player HP same |
| carousel_slug | Sixth shot creates an orbiter for 4 s at r 130; 4th tick it expires; damages a stationary enemy near player |
| widowmaker | kill with a Sixth Bullet -> next shot `sixth==true` (`cyl.pos`) |
| ten_gauge_hammer | Sixth shot spawns 5 bullets in a 40 deg fan at 0.6x damage each |
| pawn_ticket | keys=5, dyn=4 -> use: keys 1, dyn 1, coins +22; nothing to sell -> charge kept |
| dynamite_crate | use -> 5 sticks, all explode in ~1.0 s, player HP unchanged |
| gideons_bible | use with 3 enemies in 380 px -> 45 dmg each, heals 1 unit if 3 die, bullets wiped |
| cylinder_spin | use -> next 3 shots `sixth==true`, 4th is not (unless due) |
| lasso_rope | 3 enemies pulled within 90 px and stunned 1.5 s; boss not moved |
| ouija_planchette | 3 s untouchable (`hurt` fails), `moveSpeed+80`; bullets pass a rock |
| devils_own_colt | pay: `maxHearts-1`; `bulletDamageMult==1.5`, `fireDelay*1.15` |
| cylinder_of_sin | pay 2 keys; `sixthEvery==3`; normal shot damage x0.6 |
| bloodletter | Sixth shot costs 1 hp (hp 6 -> 5); at hp 2 no cost and no x4 |
| reapers_bargain | pay 4 tin; all bullets spectral; `curseHunted==1`; cursed-elite rate ~20% over 200 spawns |
| gold_fever | pay 25 coins; coins 40 -> `bulletDamageMult` x1.6; `hurt` drops >= 3 coin pickups |
| brimstone_bandolier | pay container; dynamite=0 regens 1 per 6 s up to 3; own blast now costs units even with `dynamite_vest` |
| lazarus_pact | pay container; 2 deaths survived, `maxHearts` drops 1 per revive, item removed |
| pact_of_ashes | pay 3 dynamite; `burn==1`; burn dps 7.5; standing in its FirePool costs 1 unit |
| devils_dice | pay 3 keys; `luck+4`, `critMult` +0.5; Hunted |
| leech_contract | pay 12 coins; heart pickup becomes 2 coins; 1000 kills -> ~70 heals |
Deals: unaffordable = denied, no state change; container deal refused at `maxHearts==1`; no double charge on repeat pickup click.
### 10.4 Synergies
For each of the 26: `giveItems(req)` -> `state().synergies` contains id (and the toast fired once); remove one requirement -> id gone, `synergy:lost` fired; the specific bonus keys in `state().stats` match section 5 (e.g. `rolling_thunder`: `rollShock==230`, `rollStun==1`, `rollCooldown==0.9` with spurs+boots); no toast on run start/floor load; tag counts via `api.tags()`; capstones activate only when their prerequisite synergies are active (`hellstorm`, `house_always_wins`, `avenging_angel`, `devils_dust`).
### 10.5 Systems
* Sixth axis: with `short_cylinder`+`widowmaker`+`hellfire_round`+`carousel_slug` -> `sixth_sacrament` active; 200 shots at a dummy: no exception, orbiter cap 3, live bullets <= 120.
* Pools: `rollPool('treasure', 5000, floor)`: floor 1-3 never returns c2 or locked ids; floor 4 returns c2; tier weights within 5% of the table; `bias` raises owned-tag items ~15%; crossroads roll never appears in treasure/shop/boss/secret and never falls back.
* Save: `itemsSeen` gains ids, `synergiesSeen` gains ids; reload keeps them; `Save.itemUnlocked('cylinder_of_sin')` false until `ug_deals` present.
* UI screenshots (`g.shot`): banner with tags, toast (pair/tag/capstone), tooltip with synergy section, crossroads pedestal plate, 5-slot and 3-slot cylinder, HUNTED chip, all 46 icons in a contact sheet over `bg_f1_a/f2_a/f3_a`.
* Regression: `npm run smoke`, `regress-items`, `stress-items`, `bot` still pass; `?noassets=1` shows placeholders for every new icon/fx/bullet key.

## 11. Scope guards (do NOT build)
* No trinket/consumable slot, no new currency, no reroll machine, no item-selling UI (only the `pawn_ticket` active), no second active slot, no transformation/fusion system, no item rarity colours beyond tier pips.
* Only ONE new curse (`curseHunted`); no other curse types, no curse-removal items.
* Familiars stay at 4 new (art-limited); they never take damage and never block more than existing rules; no familiar AI beyond section 4.4.
* Synergies are fixed at 26, evaluated only from tags/ids; no per-run random synergies, no synergy chains beyond the 4 listed capstone prerequisites.
* No new enemies, statuses beyond `chill/frozen/mark` (+ poison stacks), no new audio files (reuse `item_get`, `room_clear`, `explosion`, `pickup_*`, `shop_deny`; optional `synergy` key falls back), no shaders, no gamepad.
* No shipping numeric changes to existing items other than section 3.1; no item modifies the boss scripts; bosses ignore fear, stun, freeze, pull and lasso movement (slow only).
* Item state never persists across runs (only `itemsSeen`, `synergiesSeen`, unlocks).

## Integrator notes
Authoritative reconciliation is `ARCH_V2.md` s0 and s10.
- Unlocks use the 17 gates in ARCH s10.7 (28 gated items, 18 new items unlocked from the start); no `ug_*` ids.
- Item rolls use `subRng('item', roomSeed, slot)` (D15); revive order is D7.
- Crossroads pricing: table L = item at native `deal.pay`, C = item with alternate payment (60% curse, 40% 30 coins), R = pact (D6).
- FirePool items use the shared `FirePatch` (D2); Queen Sixth/Jackpot per D8.
- Elite `enemy:died` payload carries `elite` and `affixes[]` (D3).
- `ui_synergy_ribbon` is cut: the synergy ribbon is code-drawn. Item art is 6 sheets `items2_a..f` plus `familiars_v2`, `fx_items`, `projectiles_v2` (ASSET_SPEC_V2 s6).
