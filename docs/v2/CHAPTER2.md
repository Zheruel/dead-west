# DEAD WEST v2 - Chapter 2: "HELL'S FRONTIER" (Floors 4-6)

Design doc for engineering, art and audio agents. Continues straight after the Undertaker in the SAME run (no new run, no new map screen). All numbers are **Normal difficulty**; the DIFFICULTY doc scales them externally (via `FLOORS[n].hpMult`, `BOSS_META.hp`, bullet-speed mult). Existing code stays authoritative: `src/config.js`, `ENEMY_META`, `BOSS_META`, `Boss.js` generator attacks, `Room.js` tiles. Ids are snake_case and must not collide with Chapter 1 ids.

Chapter title: **HELL'S FRONTIER - "The Devil's Own Country"**. Tone: the Devil's front porch, back yard and parlour. Escalation = fire (F4) -> steel and ghosts (F5) -> velvet and cards (F6).

## 0. Summary tables

| # | Floor id | Name | Subtitle (floor card) | Boss (id) | Music | Rooms (non-secret, base) |
|---|---|---|---|---|---|---|
| 4 | `f4` | BRIMSTONE BLUFFS | The Devil's front porch | EL TORO INFERNAL (`toro`) | `mus_floor4`, `mus_boss4` | 10-11 |
| 5 | `f5` | BLOOD RAIL | The midnight run never ends | ENGINE NO. 666 (`engine`) | `mus_floor5`, `mus_boss5` | 11-12 |
| 6 | `f6` | THE LAST CHANCE SALOON | The house always wins | OL' SCRATCH (`scratch`) | `mus_floor6`, `mus_boss6` | 12-13 |

| Balance | F1 | F2 | F3 | **F4** | **F5** | **F6** |
|---|---|---|---|---|---|---|
| `hpMult` (enemies, `FLOORS[n].hpMult`) | 1.5 | 1.8 | 2.2 | **2.6** | **2.9** | **3.2** |
| Boss HP (fixed, `noFloorScale`) | 260 | 420 | 650 | **800** | **980** | **1500** |
| Boss HP / hpMult | 173 | 233 | 295 | 308 | 338 | 469 (finale bump) |
| Cursed (elite) chance | .08 | .08 | .08 | **.10** | **.12** | **.14** (RUN-VARIETY doc may override) |
| Target clear time (skilled player) | 8 min | 9 | 10 | **10** | **11** | **12** |

Boss HP rationale: player dps ~11 at start, ~18-25 by F4-F6 with ~8-14 items. Toro ~45 s of hits, Engine ~55 s, Scratch ~75 s (3.5-4.5 min real time with dodging). Fights are 2-4 phases with hit windows; nothing is "damage race only".

**Player damage vocabulary (unchanged):** 1 unit = half heart. Normal bullets/contact 1; "heavy" 2 (charges, carts, chandelier, ground slams). Every attack has a telegraph >= 0.5 s (bosses) / >= 0.3 s (enemies); i-frames of the dodge roll (0.3 s) cancel every damage source below unless stated.

**Story hook / continuity:** the Undertaker's coffin held the first page of the contract. The grave shaft under it does not end in rock: it ends in brimstone. Each floor boss is a "collector" the Devil sends to keep the debt from reaching his table.

## 1. Chapter interlude (between boss 3 and floor 4) - "CHAPTER I COMPLETE"

`MAX_FLOOR` becomes 6. `finale.js` is no longer played after the Undertaker; add `INTERLUDE_AFTER = 3` in config.

| Step | Trigger | Content | Duration |
|---|---|---|---|
| 1 | Undertaker death chain ends (existing slow-mo/explosions) | Title strip "THE UNDERTAKER FALLS" (reuse finale text style) + banner "CHAPTER I COMPLETE - PERDITION COUNTY", run mini-stats (time, kills). Non-blocking: the player keeps control | 3.0 s |
| 2 | `Room.onBossDefeated` (existing) | Boss reward pedestal (boss pool, pick-one of 2), full heart, trapdoor. The trapdoor uses `trapdoor_open` tinted black-red (`0x7a2a1a`), label none. Music -> `mus_floor3` calm (existing) | - |
| 3 | Player steps on trapdoor | Existing fall (scale 0.2, fade) but fade goes to black for 0.8 s, then **interlude card** | - |
| 4 | Interlude card | Full-screen painted `img_interlude_ch2` + text lines typed at 30 char/s in `FONT_BODY` amber: "The shaft doesn't end in rock." / "It ends in brimstone. Something down there is holding the other end of your debt." then title `CHAPTER II - HELL'S FRONTIER` (Rye, bone, stroke ink). Any key skips after 1.2 s. Music `mus_interlude` (drone + distant bull-horn) | 6.5 s, skippable |
| 5 | Floor 4 loads | Fade-in 600 ms, floor card "FLOOR 4 - BRIMSTONE BLUFFS". **Hell's Welcome**: heal 2 units, +2 dynamite (once), toast "THE HEAT WELCOMES YOU" | - |
| 6 | Checkpoint | `Save.saveCheckpoint()` right after the fade-in (see section 9) | - |

Same pattern for the other floors: banner strip "FLOOR n CLEARED" is NOT added; only chapter events get banners. After boss 6 nothing descends: see section 8.

## 2. Shared new systems (build once, all floors use them)

| System | File (new) | Rules |
|---|---|---|
| Tile chars | `Templates.js` `VALID` += `L V = \| T r k` | `L` lava, `V` sulfur vent, `=` horizontal rail, `\|` vertical rail, `T` steam pipe, `r`/`k` roulette red/black tile. `=`,`\|`,`V`,`r`,`k` are walkable and bullet-transparent. `L` bullet-transparent; `T` is a solid wall-side prop. Existing `R P S B d X E D` unchanged |
| Template fields | `Templates.js` | `lanes:[{axis:'h'\|'v', index, period, offset, dir:1\|-1\|0(alternate), kind:'cart'}]`, `chandelier:true`, `roulette:true`, `lavaSpit:true` |
| Validator | `Templates.js`, `templateCheck.mjs` | flood-fill from each door treats `L` as blocked (every door pair connected without lava); `V` not within 1 tile of any door tile; `T` only on an outer-edge tile that is not a door tile; `r`/`k` never on door tiles; lane index in range; lane rows may cross door rows; `magma_eel` only in templates with >= 3 `L`; `handcar_bandit` lane version only in templates with `lanes` |
| `FirePatch` | `src/rooms/hazards/FirePatch.js`; `Room.addFire(x,y,r,dur,{dmg=1,team})` | circle; damages player 1 unit if overlapped and `canBeHit()`, checked every 0.25 s; no damage in the last 0.3 s; visual `fx_hellfire` scaled `r/64`, loop 10 fps; enemies without tag `fire` take 2 dmg/s; enemies with tag `fire` immune; cap 14 per room (oldest culled); cleared on room exit |
| `LaneSweep` | `src/rooms/hazards/LaneSweep.js`; `Room.spawnLane({axis,index,dir,speed,kind,dmg,w,tell})` | telegraph `tell` s (red band `w+8` px across the lane, pulses 4 Hz, `train_bell` x4), then a body travels the whole lane edge to edge. `kind:'cart'` speed 380, w 76, len 170, dmg 2, sprite `haz_cart`; `'ghost'` speed 560, dmg 1, passes over pits/obstacles, teal additive tint; `'herd'` (Toro) speed 600, w 96, dmg 2, `enemy_hellsteer` scaled 1.25 tinted `0xff7a3a`. Hit = damage + shove 240 px/s perpendicular. Non-boss enemies hit take 14 dmg + stun 0.6 s (carts/herd only). Bodies are not targetable and never stop a bullet |
| `GroundHaz` | `src/systems/GroundHaz.js` (extract the `haz` list logic of `undertaker.js`) | timed circle / line / tile hazards with `tell`, `active`, `dmg`, `onLand` callback; used by all three bosses and enemies (bottle, coal, eruption) |
| Lava tiles | `Room.js` (`t.type='lava'`) | see section 3 |
| `Enemy.ward` | `Enemy.js` | `this.wardT` > 0 => `takeHit` multiplies by 0.5 (Sulfur Ward); yellow additive outline; `damageMultiplier` composes |
| Enemy tags | `ENEMY_META.tags` | `fire` = immune to fire patches, lava, vents and explosion-fire; `undead` keeps silver-bullet rule |
| Bullet kinds | `Bullets.js ENEMY_KINDS` += `ember` (r 12, glow 0xff9a2a), `coal` (r 14, 0x9a6a3a), `steam` (r 15, 0xdde4e8), `card` (r 12, rotate, glow 0xffffff), `chip` (r 13, 0xe8dcc0), `shard` (r 9, rotate, 0xbfe8ff), `spade` (r 13, 0x9070ff), `spike` (r 10, rotate, 0xffa060) | frames from `projectiles_c2` (section 10) |
| Cause of death strings | `Player.damage` `info.kind` | `lava` "Swam in the Devil's bath", `fire` "Burned on the Bluffs", `vent` "Sulfur poisoning", `cart` "Run over by the 12:00", `steam` "Boiled alive", `chandelier` "Crushed by chandelier", `roulette` "Bet on the wrong colour", `card` "Dealt a bad hand" |
| Room modifiers | `Room.js` | `lavaSpit`, `lanes`, `chandelier`, `roulette` run **only while `mode==='combat'` and only after the 0.6 s telegraph of the first wave**; on `clearRoom` all timers stop, live hazards finish their current active window and disappear. Tile hazards (lava, vents, `T` jets) stay active in cleared rooms |
| FloorGen | `FloorGen.js` | `FLOOR_GEN[4]={normals:[7,8],shopChance:1.0}`, `[5]={normals:[8,9],shopChance:0.7}`, `[6]={normals:[9,10],shopChance:1.0}`; `r.bg = pick(['a','b','c'])` for floors >= 4 (`FLOORS[n].bgC`); `validateFloor` room bound `8..15` (other docs add specials); `runSelfTest` loops floors 1..6 |
| Music routing | `GameScene.updateMusic`, `MUSIC_FOR`, `BOSS_META.music` | replace `room.tpl.boss==='undertaker'` test with `bossMeta(tpl.boss).music`; keys `boss4`, `boss5`, `boss6` |
| Boss form swap | `Boss.js` | optional `this.formKey` (default `this.id`) used by `setPose/atkFrame` so Ol' Scratch can switch to `boss_scratch_true_*` |

## 3. Floor 4 - BRIMSTONE BLUFFS

**Mood:** a red-black basalt canyon at the mouth of Hell. Ash snow, lava rivers under a bruised orange sky, sulfur crust, burnt cattle, giant longhorn skulls. Oppressive heat, no shade. Ground stays DARK (value < 35 %, saturation <= 55 %) so orange bullets, the red poncho and enemy tells still pop.
**Palette:** char black-red `#2a0f0c`, basalt `#3b2320`, lava orange `#ff7a1f`, sulfur `#d8c43a`, ember `#d63a2a`, ash grey `#8a807a`, bone `#e8dcc0`. `FLOORS[4].tint = 0x7a2a1a`, `hpMult 2.6`, `obst 'obst_f4'`, `bgA/bgB/bgC/bgBoss`.
**Music:** `mus_floor4` 84 BPM, war-drum pulse, low brass drones, detuned slide guitar, fire crackle; ambience `amb_lava` (crackle + distant roar). `mus_boss4` 132 BPM stampede toms, bull-horn brass stabs. Room lights: `Room.buildLights` warm orange flicker.

### Hazards (exact)
| Hazard | Rule |
|---|---|
| **Lava `L`** | Player: hit circle overlapping a lava tile -> `damage(1,{kind:'lava'})` if `canBeHit`, then 1.0 s i-frames (standing in it costs 1 unit/s; a 2-tile river crossed at 330 px/s costs at most 1 unit; rolling across = 0). Roll landing on lava = damage. Non-flying, non-`fire` enemies avoid it (AI probe = blocked) and take 6 dps while on it (knockback into lava works). Flyers ignore. Pickups never drop onto it (`reachableSpot` also skips lava). Bullets and dynamite blasts pass over |
| **Lava spit** (`lavaSpit:true`, combat only) | every 4.0 s (first at 2.5 s) one lava tile >= 280 px from the player bubbles for 0.6 s (glow + `lava_bubble`), then lobs 1 `ember` (speed 240, dmg 1) at the player. Max 2 pending/alive per room; none if the room has < 3 lava tiles |
| **Sulfur vent `V`** | 3.6 s cycle: idle 1.8 s (grey grate, faint smoke) -> warn 0.9 s (yellow gas puffs, tile glows, `vent_hiss`) -> erupt 0.9 s (`fx_hellfire` column). Eruption = circle r 62 around the tile: player 1 dmg once per eruption; non-`fire` non-flying enemies 4 dmg. Phase offset per tile `((c*7+r*3)%4)*0.9 s`; first eruption never < 1.0 s after room entry |
| **Fire patch** | shared `FirePatch` (section 2). Sources: hellhound/cinder skull/golem/Toro, breakable `obst_f4.breakable` (brimstone barrel: r 60, 1.5 s when broken) |

### Room backgrounds (opaque 1440x864, wall band 96 px, empty floor, no lava painted in; lava is a code tile)
| key | Art description |
|---|---|
| `bg_f4_a` | Basalt canyon floor: cracked dark ash-grey ground with hairline glowing-orange cracks, rock walls stained red, faint sulfur dust; light from top-left |
| `bg_f4_b` | Sulfur flat: yellow-crusted stone, scorch rings, small soot mounds; walls layered orange strata |
| `bg_f4_c` | Bone trail: charred wagon-wheel ruts, scattered longhorn bones and ribs in ash, walls with dripping lava-falls at the very edge |
| `bg_f4_boss` | Bull ring: wide scorched circular arena drawn in the floor (horn-shaped runes, ring of bones), walls of stacked skulls and horn banners, lava moat glow along the wall band, darker + redder |

### Obstacles `obst_f4` (grid 4x2, 96x96, anchor bottom; order = names)
`block_a` basalt boulder with ember cracks / `block_b` jagged obsidian spire / `breakable` brimstone barrel with glowing yellow crust / `breakable_broken` scorched staves + soot / `pit` glowing crevasse (red glow far below, ink rim) / `spikes` obsidian shards / `decor_a` longhorn skull on a pike / `decor_b` burnt cactus and charred grave cross.

### Enemies (base HP is multiplied by 2.6). Frame = px square. Strip = 0-3 move loop, 4 windup, 5 attack
| id | HP | Eff. HP | r | speed | weight | tags | floors | frame |
|---|---|---|---|---|---|---|---|---|
| `hellhound` | 14 | 36 | 30 | 250 | 3 | fire | 4 | 128 |
| `hellsteer` | 26 | 68 | 44 | 90 (charge 640) | 2 | fire | 4 | 160 |
| `cinder_skull` | 8 | 21 | 24 (flying, air 50) | 190 | 3 | fire, undead | 4 | 96 |
| `magma_eel` | 22 | 57 | 30 | 200 (submerged) | 0 (template only, lava rooms) | fire | 4 | 128 |
| `sulfur_preacher` | 16 | 42 | 28 | 70 | 1 | - | 4 | 128 |
| `magma_golem` | 40 | 104 | 48 | 55 | 1.5 | fire | 4 | 160 |
| returning: `possessed` | 24 | 62 | - | - | 1 | - | 2,3,**4** | existing art |

**F4 E-slot pool (weights):** hellhound 3, cinder_skull 3, hellsteer 2, magma_golem 1.5, sulfur_preacher 1, possessed 1. `magma_eel` is placed only by templates.

1. **`hellhound`** (rusher). `stalk`: `keepDistance(300, strafe +-1, 250)`, strafe flips every 1.2-2.0 s. Attack every 2.6-3.4 s (room token `scene._hhNext` staggers so max 2 hounds in an attack): windup 0.6 s (pose 4, pulse, warn wedge 60 deg x 300 px, aim locked 0.2 s before) -> lunge 0.35 s at 520 px/s (~180 px, contact 1) -> at lunge end a flame fan: 7 `ember` bullets, spread 60 deg, speed 380, life 0.45 (range ~170 px) -> recover 0.8 s (pose 5, vulnerable). Art: mangy black hound, ribs glowing, mouth of fire, chain collar. Sidestep the lunge line and the flames miss.
2. **`hellsteer`** (charger, mini-Toro). Graze toward player 90 px/s; every 3-4 s: paw 0.7 s (pose 4, dust, warn line width 96 to the wall, locked 0.3 s before) -> charge 640 px/s until wall/obstacle; contact 2 dmg + shove; crashes into a wall: dazed 1.4 s (`damageMultiplier` 1.3), fire patch r 60 for 2 s under the horns; breaks `B` tiles on the way. Art: small hellfire bull demon, horns with flame tips, steaming nostrils, cracked-lava hide.
3. **`cinder_skull`** (suicide flyer, arrives in 2-3). Chase 190 px/s with sine wobble (amp 60 px, 2.2 Hz); within 140 px it arms: stops, red flash, shriek 0.5 s (pose 4), then detonates: r 110, 1 dmg (2 if cursed) + fire patch r 70 for 2.0 s. Killed before detonation: harmless puff (reward for shooting first). Only 1 skull per room arms at a time (token). Art: flaming horned skull with trailing fire wisps.
4. **`magma_eel`** (lava ambusher, only in templates with >= 3 `L`). Moves along lava tiles only (BFS over lava tile graph, `Room.lavaPath`), submerged = untargetable + invulnerable (ripple + fin drawn in code). If player in 200-520 px: surfaces 0.4 s (pose 4, bubble ring r 36), fires 2 volleys of 3 `ember` (spread 18 deg, speed 300, 0.35 s apart), stays surfaced 1.6 s (targetable, pose 5), submerges 0.4 s. Cooldown 1.2 s. Art: lava eel/serpent head with molten-orange jaws and comb fins, surfacing from a lava tile.
5. **`sulfur_preacher`** (support, kill-first). `keepDistance(380)`, retreats under 260 px. Every 4.0 s: chant windup 0.6 s (arms up, pose 4, yellow rune ring r 260 stays 3 s) -> all other enemies within 260 px get **Sulfur Ward 3.0 s (x0.5 damage taken, yellow shimmer)**; refresh stacks time, not strength. No allies in range: fires 1 aimed `ember` every 2.5 s (speed 260) instead. Ward ends instantly on his death. Art: hunched zealot in scorched black frock, cross of bone, sulfur-yellow eyes, censer with yellow smoke.
6. **`magma_golem`** (tank, area denial). Walks 55 px/s. Every 4.5-5.5 s: raise fists 0.9 s (pose 4, warn band width 96 x 5 tiles toward the player, locked 0.3 s before) -> slam (pose 5): 5 eruption columns spaced 96 px along the band, 0.12 s apart, each 1 dmg + fire patch r 48 for 2.0 s. Death: 3 fire patches r 60 for 2.5 s. Art: hulking lava-rock golem, glowing cracks, boulder fists, small skull embedded in chest.

**Synergies (used by templates):** blessed stampede = `sulfur_preacher` + `hellsteer` x2 + `hellhound`; lava room = `magma_eel` x2 + `cinder_skull` x2 (skulls flying over the river force you off the banks); `magma_golem` + `hellhound` x2 (eruption lanes cut your strafe).

### Boss 4 - EL TORO INFERNAL "Horns of the Furnace" (`toro`)
HP **800**, r 92, `heavy`, fear-immune, stun only from crashes, portrait `portrait_toro`, music `boss4`, attack delay [1.4, 1.1, 0.85] by phase. Sprite 320: idle 4f (breathing, horn flames), atk 4f: [0] paw/head low, [1] full charge, [2] head up fire-breath, [3] dazed with horns stuck. Art: colossal bipedal-hunched bull demon, cracked-lava hide, ring in nose, horns wreathed in flame, smoking hooves, rope-frayed chains on wrists, red-yellow furnace glow in the chest.
**Arena `f4_boss`:** 13x7 with 4 basalt pillars `R` at (3,2),(9,2),(3,4),(9,4), vents `V` at (2,3),(10,3), lava `L` in the 4 corner tiles, boss spawn `1` at centre. **Pillars are cover from the fire breath and are destroyed by a charge** (see below); lava corners cost 1 unit if touched.

| Phase | HP band | Attacks (weight) |
|---|---|---|
| P0 "Bull Ring" | 100-66 % | `charge` 4, `fire_breath` 3, `magma_stomp` 2 |
| P1 "Enrage" (<66 %) | 66-33 % | roar (clears bullets, shake), spawn 2 `hellhound` (once); `charge` 4 (double), `fire_breath` 3 (2 sweeps), `magma_stomp` 2, `herd_stampede` 2 |
| P2 "Hellfire Frenzy" (<33 %) | 33-0 % | `charge` 4 (triple, fire trail 4 s), `fire_breath` 2, `magma_stomp` 2 (5 eruptions), `herd_stampede` 3 (4 lanes), `hellfire_leap` 3 |

- **`charge`**: paw 0.8 s (atk[0], tint pulse), locked aim line (width 110 px) visible from t=0.55 s, charge 720 px/s to the wall/pillar, contact 2 dmg + 300 px/s shove. Ends: **wall crash** = stun 2.0 s (atk[3], x1.4 damage, 4 fire patches r 50 for 2 s at the horns); **pillar hit** = pillar shatters (8 `rock` bullets ring, speed 260), stun 1.0 s (x1.25). P1: 2nd charge re-locks after a 0.5 s pause (skipped if stunned). P1+ leaves fire trail (patch r 48, 2.0 s every 110 px; P2 4.0 s). P2: 3 chained charges, re-lock 0.45 s.
- **`fire_breath`**: rear 0.7 s (atk[2]), warn wedge 70 deg x 380 px visible last 0.35 s, then 1.0 s stream: 1 `ember` every 0.09 s (~11 bullets), angle sweeps -35 -> +35 deg around the locked aim (P1: two sweeps, second returns +35 -> -35 after 0.4 s pause), speed 400, life 0.9, +-3 deg jitter. Pillars stop it.
- **`magma_stomp`**: rears 0.9 s, warn disc r 260 at the boss, stomp = 1 dmg inside r 260 (roll through) + 3 eruption circles (r 70, telegraph 0.9 s: on the player's position and 2 random spots within 300 px), each 1 dmg + fire patch r 70 for 2 s. P2: 5 circles.
- **`herd_stampede`** (P1+): 3 lanes (P2: 4) among the 7 rows, random, never adjacent-only blocks: always >= 3 free rows (P2 also >= 3); telegraph 1.2 s (dust + red band + `hoof_thunder`), one `herd` body per lane from alternating sides, speed 600, dmg 2. The boss keeps still (vulnerable) during it.
- **`hellfire_leap`** (P2): leaps off-screen 0.6 s (invulnerable), red shadow tracks the player at 300 px/s for 1.0 s, locks (disc r 190, 0.9 s), lands: 2 dmg + shove in r 190, ring of 14 `ember` (speed 280), 5 fire patches r 60 for 2.5 s; then stunned 1.0 s (x1.3).
- Death: kneels, horns crack, embers; reward flow as bosses 1-2 (boss pedestal, heart, trapdoor `trapdoor_open` tinted red).
- Barks (banner, 1.2 s): P1 "THE FURNACE ROARS", P2 "HELLFIRE!".

## 4. Floor 5 - BLOOD RAIL

**Mood:** a haunted rail yard at a moonless night: rusted steel, flickering red signal lamps, cold white steam, ghost lantern light in the fog. Steel-blue darkness broken by rust and blood red; the "12:00 that never arrives". Player red poncho stays readable on cool-blue ground.
**Palette:** night steel `#1b2230`, slate `#2b3140`, rust `#8a4b1f`, signal red `#d63a2a`, steam white `#d8dde0`, lantern amber `#f0a640`, ghost teal `#6fe0d0`, coal `#141010`. `FLOORS[5].tint = 0x2b3140`, `hpMult 2.9`.
**Music:** `mus_floor5` 6/8 train-shuffle ostinato (brushed snare, rail clack), harmonica, low strings, distant bell; ambience `amb_rail` (night wind, far whistle, creaking iron). `mus_boss5` in 3 stems (`mus_boss5_a/b/c`) = same locomotive ostinato at 118 / 132 / 148 BPM, crossfaded on phase change.

### Hazards (exact)
| Hazard | Rule |
|---|---|
| **Rails `=` `\|`** | Walkable decor tiles (`haz_f5` cells). Lanes come from the template `lanes` field, not from the tiles, but every lane row/column must be painted with rail tiles so the danger reads before it fires |
| **Rail cart lane** | `LaneSweep kind:'cart'`. Lane period `P` 5.5-8.0 s (template), first launch at `offset` (>= 2.0 s after the room locks). Sequence: tell 1.0 s (red band + lamp `signal_lamp_on` + 4 bells) -> cart enters from the off-screen end, 380 px/s, crosses the room in ~4.2 s, exits. 2 dmg + 240 px/s shove; roll i-frames dodge it. Enemies hit take 14 dmg + 0.6 s stun (lure them). Two lanes in a room have offsets >= 1.5 s apart and adjacent rows never fire together. Carts stop when the room is cleared. Tier-3 templates may have a crossing h + v pair |
| **Steam pipe `T`** | Pipe on an outer-edge tile jets along the row/column inward, length 5 tiles, width 88 px. 4.4 s cycle: idle 2.0 s -> warn 0.9 s (white puffs, hiss) -> jet 1.5 s. No damage. Anything inside is pushed along the jet at 300 px/s (player can walk against it at net ~30 px/s; roll ignores it; enemies pushed 200 px/s). The danger is being pushed into a cart lane, lava-free pits or into enemies. Jets stay on in cleared rooms |
| **Fire patch** | reused: coal barrages, stoker, Engine |

### Room backgrounds
| key | Art description |
|---|---|
| `bg_f5_a` | Rail yard at night: gravel-and-cinder floor, faint parallel sleeper marks, cold blue fog at the edges; walls of corrugated iron and brick with red lanterns |
| `bg_f5_b` | Roundhouse interior: worn planks on stone, iron girders on the walls, hanging chains, steam wisps along the wall base |
| `bg_f5_c` | Depot platform: wide weathered boards, painted yellow safety line worn away, ghost-lit station clock on the wall band (stopped at 12:00), scattered luggage-tag paper |
| `bg_f5_boss` | Turntable pit: circular iron turntable in the floor centre with radial seams, three worn rail beds on the sides, tunnel mouth glow at the top wall, wall band of sooty brick, red glow |

### Obstacles `obst_f5`
`block_a` stacked railroad ties and steel crates / `block_b` coal heap in an ore hopper / `breakable` coal barrel with mail sack / `breakable_broken` splintered slats and spilled coal / `pit` broken trestle gap (black void, splintered beam ends) / `spikes` railroad spikes in a board / `decor_a` signal lantern post (red lens) / `decor_b` hobo skull in a hat with a bindle.
`haz_f5` (4x2, 96): `rail_h`, `rail_v`, `rail_cross`, `rail_end` (buffer stop), `steam_pipe` (valve, faces right, rotate in code), `signal_lamp_off`, `signal_lamp_on`, `coal_pile_decor`.
`haz_cart` (4x1, **192x128**): `cart_h_0`, `cart_h_1` (side view, wheels alternate), `cart_v_0`, `cart_v_1` (front/back view centred in the frame). A rusty coal-filled mine cart with glaring painted eyes. Ghost variant = tint `0x6fe0d0`, alpha 0.8, additive glow (no art).

### Enemies (hpMult 2.9)
| id | HP | Eff. HP | r | speed | weight | tags | floors | frame |
|---|---|---|---|---|---|---|---|---|
| `handcar_bandit` | 20 | 58 | 34 | 260 (lane) / 180 (free) | 2 | - | 5 | 160 |
| `signalman` | 14 | 41 | 26 (flying, air 30) | 90 | 2 | undead | 5 | 128 |
| `steam_stoker` | 34 | 99 | 42 | 65 | 1.5 | - | 5 | 160 |
| `crate_mimic` | 22 | 64 | 34 | hop 400 | 1 | - | 5 | 128 |
| `rail_rat` | 4 | 12 | 16 | 290 | 3 (packs) | - | 5 | 64 |
| `chain_gang` | head 12 / links 3x10 | 35 / 29 | 26 | 150 (charge 430) | 1.5 | undead | 5 | 128 |
| returning: `skeleton`, `ghost` | - | - | - | - | 1 each | undead | 2,3,**5** | existing art |

**F5 E-slot pool:** rail_rat 3 (spawns 1 per E; use explicit packs of 5 in templates), handcar_bandit 2, signalman 2, steam_stoker 1.5, chain_gang 1.5, crate_mimic 1, skeleton 1, ghost 1.

1. **`handcar_bandit`** (rail-bound shooter). If the room has a rail lane row/col within 1 tile of it it locks to that lane and slides along the axis toward the player's projected coordinate at 260 px/s, reversing at lane ends; else free-roams like `outlaw` (strafe, 180 px/s). Every 2.4 s: stop, 0.5 s aim windup (warn line last 0.2 s), 2 `spike` bullets 0.18 s apart (speed 340, dmg 1). Hit by a lane cart: 14 dmg. Art: skeletal bandit standing on a pump handcar, bandana, top hat, revolver, arms working the pump; 0-3 pump cycle.
2. **`signalman`** (ghost lamplighter, line zoner). Flies, `keepDistance(420, strafe)`. Every 5.0 s: swings a red lantern 0.6 s (pose 4), then locks the row AND column through the player; both lines telegraph 1.0 s (bells) and a **ghost cart** (dmg 1, 560 px/s, over anything) sweeps each. 1 signal active per room; max 2 signalmen per room. Standing still is what kills you: the 4 diagonal quadrants are safe. Art: pale railway signalman ghost, cap, red lantern on a pole, tattered tail.
3. **`steam_stoker`** (tank / space control). Walks 65 px/s. Every 3.6 s vent: boiler glows 0.8 s (pose 4, ring r 200 drawn) -> blast (pose 5): 1 dmg inside r 200 + knockback 340 px/s outward, then a scald cloud r 110 for 2.0 s (1 dmg per 0.8 s inside). Death: scald cloud r 110 for 2.0 s only (no instant damage). Art: bulky fireman with a steaming iron boiler strapped on his back, gas mask, coal shovel.
4. **`crate_mimic`** (ambusher). Rendered as `obst_f5.breakable` (untargetable, invulnerable, shadow only) until: player within 240 px, OR it is shot (bullet bounces, wood knock), OR 7 s after the last other enemy in the room died. Wake: shake 0.5 s (pose 4, dust; eyes glint 1 blink in the last 1.5 s of proximity to hint) -> reveal. Then alternates: pounce (hop 0.5 s toward the player, max 320 px, landing shock r 80, 1 dmg) and bite when within 80 px (0.4 s windup pose 5, 2 dmg, lunge 90 px). Drops 2 `coin_nickel`. Templates never place a mimic within 3 tiles of a door. Art: a fanged, long-tongued crate mimic with slat teeth and a nailhead eye.
5. **`rail_rat`** (swarm, packs of 5 in template slots). Flock: separation 40 px, chase 290 px/s with +-25 % jitter; after a bite (contact 1) flees 0.8 s. Spawn out of the room edges with the 0.3 s spawn puff. Pushed by steam jets. Art: skinny coal-black rat with bloodshot eyes, sparks on its tail.
6. **`chain_gang`** (snake). One template slot spawns 4 linked bodies: head then 3 links spaced 70 px behind on its trail (each its own `Enemy`, `leader` reference). Head steers at 150 px/s; every 5 s the head stops 0.7 s (pose 4, warn line to the player locked at 0.3 s) then charges 430 px/s for 0.9 s with the links following the trail (a moving wall). Head dies -> the next link becomes head, unchained: speed x1.3, no charge. Cursed roll applies to the head only. Counts as 4 enemies for wave sizing. Art: shackled skeleton prisoner in striped rags, ball-and-chain; links reuse frames 0-3 with tint variants.

**Synergies:** `signalman` + `handcar_bandit` (crossfire on the lanes); `steam_stoker` + `rail_rat` x5 (cloud denies the middle while rats flank); `crate_mimic` x2 + `chain_gang` (fake cover turns hostile); rooms with `T` jets + rats.

### Boss 5 - ENGINE NO. 666 "The Midnight Express" (`engine`)
HP **980**, r 100 (parked), fear/stun-immune, portrait `portrait_engine` (skeletal conductor leaning out of a fanged locomotive face), music `boss5` stems. Sprites: `boss_engine_idle` 4f 320 (front-facing locomotive face: headlight eye, cowcatcher teeth, smokestack, skeletal Conductor in cab window; idle = steam puffs), `boss_engine_atk` 4f 320: [0] chest thrown open shovelling coal, [1] whistle scream (steam plume), [2] lurching forward, [3] wrecked/steaming; `boss_engine_run` 4f **512x320** (2x2 grid, side view charging, wheels/pistons cycling, tender + 2 coal cars following, headlight beam).
**Arena `f5_boss`:** rows 0-1 = depot (no rails, safe from lanes), rails on rows 2, 4, 6 (`=`), cover blocks `R` at (2,3),(10,3),(2,5),(10,5), pipe `T` at (0,1) and (12,1) (decor, jets off), boss spawn `1` at (6,1). Rows 3 and 5 are lane-free safe strips. Lane telegraphs start >= 3.0 s after the intro card ends.
States: **parked** (front sprite, hittable, at (720, 380)) <-> **passing** (side sprite, hittable, contact dmg) <-> **gone** (off-screen, untargetable, <= 1.2 s, only while switching sides). Contact with the parked body 1 dmg.

| Phase | Attacks (weight) |
|---|---|
| P0 100-66 % "Midnight Express" | `coal_barrage` 3, `steam_rings` 3, `lane_charge` 4 (1 lane); delay 1.5 |
| P1 <66 % "Ghost Train" | + `phantom_express` 3; `coal_barrage` 4 per volley; `lane_charge` 2 lanes; on entry roar, clear bullets, 2 `handcar_bandit` adds (once); delay 1.15 |
| P2 <33 % "Full Steam" | + `derail_run` 4; `steam_rings` 4 rings; `lane_charge` 3 lanes; delay 0.9 |

- **`coal_barrage`** (parked): shovel windup 0.7 s (atk[0]); 3 volleys 0.6 s apart of lobbed coal (P0: 3 lumps per volley, P1+: 4): each = ground marker r 64 (tell 0.9 s) at the player's position at volley start (first) then +-140 px scatter; lands: 1 dmg r 64 + fire patch r 48 for 2.0 s + 3 `coal` shards ring speed 200. Volleys 2-3 lead the player's movement direction by 120 px.
- **`steam_rings`**: whistle windup 0.9 s (atk[1], warn ring r 300 pulse); 3 expanding rings (P2: 4), 0.65 s apart (P2 0.55), 16 `steam` bullets each, speed 250, life 2.6, each ring has one gap of 3 missing bullets at a random angle (>= 60 deg away from the previous gap); dmg 1.
- **`lane_charge`**: picks the rail row nearest the player (random tie-break); tell 1.1 s (lamp + bells + headlight cone); engine goes `gone`, then the run sprite crosses at 900 px/s from a random side, contact 2 dmg + 280 px/s shove, exits, `gone` 1.0 s, re-enters parked (fade 0.6 s). Multi-lane: next lane locks on the player's row immediately after the first pass (tell 0.9 s, from the opposite side). Never targets the row the player has stood on for < 0.2 s (locks when the tell starts, not before).
- **`phantom_express`** (P1+): 2 ghost lanes (dmg 1, 560 px/s) from opposite ends on non-adjacent rows including the player's row, tell 1.2 s; the parked engine flashes teal.
- **`derail_run`** (P2): tell 1.4 s (whole lane red, bells x6), runs 1100 px/s along the player's rail row and **crashes into the far wall** (contact 2 dmg on the way): jams half inside the room, atk[3], **stunned 2.2 s (x1.5 damage)**, 6 falling-coal markers (r 64, tell 0.9 s) around it, then backs out 1.2 s and parks. This is the P2 damage window.
- Death: whistle scream, boiler bursts, the Conductor's hat lands on the trapdoor; boss pedestal = **pick-one of 2** + heart + trapdoor.
- Barks: P1 "ALL ABOARD THE DEAD", P2 "FULL STEAM AHEAD".

## 5. Floor 6 - THE LAST CHANCE SALOON

**Mood:** the Devil's own saloon at the bottom of the world: a vast infernal casino. Crimson velvet, gold trim, green felt, brimstone-black wood, hanging chandeliers of bone and candles, cigar smoke, red and black checkered tables. Warm-dark, expensive, decadent - the opposite of F4's grit. Ground value < 40 % so bullets/player read.
**Palette:** velvet crimson `#5a0f1a`, brimstone black `#120c0a`, gold `#d4a537`, felt green `#1f4a34`, smoke violet `#4a3358`, candle amber `#f0a640`, bone `#e8dcc0`, suit red `#d63a2a`. `FLOORS[6].tint = 0x5a1020`, `hpMult 3.2`.
**Music:** `mus_floor6` a waltz gone wrong: out-of-tune honky-tonk piano, harpsichord, muted trumpet, choir hum, 96 BPM in 3/4; ambience `amb_saloon` (muffled crowd murmur, glass clink, distant laughter). `mus_boss6` four stems (see Boss 6).

### Hazards (exact)
| Hazard | Rule |
|---|---|
| **Falling chandelier** (`chandelier:true`, combat only) | every 7.0 s (first 4.0 s after the room locks), one at a time. Target = player position at telegraph start + random offset 0-90 px. Tell 1.2 s: shadow circle r 100 grows, `chandelier_creak`, dust falls. Impact: 2 dmg (heavy) in r 100, enemies in circle 25 dmg, fire patch r 80 for 3.0 s, 6 `shard` bullets ring speed 200, rubble decal. Roll dodges. Stops on room clear. The chandelier sprite descends from above the screen in the last 0.35 s |
| **Roulette floor** (`r`,`k`, `roulette:true`, combat only) | region of alternating red/black tiles (decor otherwise). Every 6.0 s a colour is called (never the same colour 3 times in a row): text "RED!" / "BLACK!" over the room, that colour's tiles flicker 1.0 s (amber -> white, `roulette_tick`), then zap 1.4 s (arc sprites, `roulette_zap`): player on a zapped tile takes 1 dmg at zap start and every 0.7 s; non-flying enemies on it take 6 once. Tiles outside the region are always safe. Tile art is code-drawn (rects, gold trim, suit glyph) |
| **Fire patch** | reused (chandelier, Scratch) |

### Room backgrounds
| key | Art description |
|---|---|
| `bg_f6_a` | Gambling floor: dark carpet with red diamond pattern and gold inlay, brass rail along the walls, velvet-panelled walls with candle sconces |
| `bg_f6_b` | Card room: green felt-toned inlaid floor with faint suit motifs (spade, heart, diamond, club) in gold thread, dark wood wainscot, framed devil portraits |
| `bg_f6_c` | Grand hall: black and blood-red marble checker floor, gold columns and drapes on the wall band, a huge chandelier shadow cast on the floor centre |
| `bg_f6_boss` | Poker table arena: whole floor is a huge green baize table with a gold-thread rim ring, painted card-suit circles, walls of stacked velvet booths, red-black glow, darker + more ominous |

### Obstacles `obst_f6`
`block_a` overturned poker table / `block_b` dead slot machine (cracked screen) / `breakable` chip crate / `breakable_broken` spilled chips and splinters / `pit` open cellar hatch with hell glow / `spikes` broken glass and bottles / `decor_a` gold spittoon and skull ashtray / `decor_b` brass candelabra.
`prop_chandelier` (3 frames, **192x192**, anchor centre): `intact` (bone-and-candle chandelier, chains), `falling` (tilted, motion streaks), `wreck` (crashed pile of bones, candles, shattered crystal).

### Enemies (hpMult 3.2)
| id | HP | Eff. HP | r | speed | weight | tags | floors | frame |
|---|---|---|---|---|---|---|---|---|
| `card_shark` | 18 | 58 | 30 | 100 | 3 | - | 6 | 128 |
| `loaded_die` | 22 | 70 | 36 | 240 (roll) | 2 | - | 6 | 128 |
| `slot_fiend` | 36 | 115 | 44 | 40 | 1 | - | 6 | 160 |
| `waiter_imp` | 10 | 32 | 24 (flying, air 50) | 150 | 2.5 | - | 6 | 96 |
| `bouncer` | 38 | 122 | 46 | 70 | 1.5 | - | 6 | 160 |
| `joker` | 16 | 51 | 28 | 120 | 2 | - | 6 | 128 |
| returning: `possessed`, `skeleton` | - | - | - | - | 1 each | - | 2,3,**6** / 2,3,**6** | existing art |

**F6 E-slot pool:** card_shark 3, waiter_imp 2.5, loaded_die 2, joker 2, bouncer 1.5, slot_fiend 1, possessed 1, skeleton 1.

1. **`card_shark`** (ranged). `keepDistance(340, strafe)`. Every 2.2 s: windup 0.5 s (pose 4, aim line last 0.2 s) -> 3 `card` bullets 0.12 s apart, speed 360, dmg 1, `curve` -40 / 0 / +40 deg/s (an arcing cluster that converges/diverges). After 3 deals: shuffle reload 1.0 s (vulnerable, pose 5). Death: 6 harmless cosmetic cards, 15 % `coin_nickel`. Art: dapper demon gambler, green visor, waistcoat, fan of cards in hand.
2. **`loaded_die`** (roller). Rolls straight at 240 px/s in one of 8 directions biased toward the player, bounces off walls/obstacles (tumbleweed rules), contact 1. After its 2nd bounce it lands: stops 0.6 s and shows N pips (code-drawn white dots over the sprite; N in 1-6 with weights 1,2,3,3,2,1), then fires N `chip` bullets evenly spaced (random rotation, speed 300) and rolls again. Art: big red casino die with chipped corners and angry pips as eyes/mouth; frames 0-3 = tumbling faces.
3. **`slot_fiend`** (random attacker). Waddles 40 px/s toward the player. Every 4.5 s pulls the lever: 3 code-drawn reels spin 1.2 s and stop at 0.5, 0.8, 1.1 s; the outcome is readable for 0.5 s before it acts. Outcomes (weights): CHERRIES 35 = aimed fan of 5 `chip` (speed 340, spread 40 deg); BELLS 25 = ring of 12 (speed 260); SKULLS 15 = spawns 1 `waiter_imp` (max 2 alive); NO PAYOUT (mismatch) 25 = jam: stunned 1.2 s, x1.3 damage, spits 3 coins. Death: spills 3 `coin`. Art: waddling slot machine on stubby legs with a fanged coin slot mouth and arm-lever.
4. **`waiter_imp`** (lobber). Orbits the player at 300-380 px, 150 px/s, over anything. Every 3.0 s lobs a whiskey bottle to the player's current position: marker r 70, lands after 1.0 s: 1 dmg r 70 + ring of 8 `shard` (speed 280, life 0.7). One bottle in flight per imp; recovery 0.6 s after each throw. Art: little horned imp in a bow tie with a tray and bottles, bat wings.
5. **`bouncer`** (tank). Frontal arc +-70 deg toward the player: bullets are consumed, damage x0.5 (explosions ignore); sides/back x1.0. Every 5.0 s: knuckle-crack windup 0.9 s (pose 4, red arrow band 4 tiles locked 0.3 s before) -> shoulder rush 0.5 s at 560 px/s (~280 px, contact 2 dmg + throws player 200 px/s) -> recover 1.0 s (pose 5, front block OFF, vulnerable). Art: huge horned demon in a tuxedo, earpiece, folded arms; rush = shoulder down.
6. **`joker`** (blinker). Every 2.4 s: laugh 0.4 s (pose 4) -> vanishes in a puff (invulnerable 0.4 s) -> reappears 260-520 px from the player on a valid tile, dropping a **jack-in-the-box** (Dynamite subclass, fuse 1.5 s, ring r 110 telegraph): pop = 1 dmg r 110 + 6 confetti `shard` ring (speed 240). Max 2 boxes per joker; harmless to enemies. Between blinks strafes 120 px/s. Art: harlequin imp jester, split red/black costume, jingling hat, manic grin.

**Synergies:** `bouncer` + `card_shark` x2 (the bouncer's arc protects the sharks); `loaded_die` in a roulette room (bounces make you dance across colours); `slot_fiend` + `waiter_imp` x2 under chandeliers; `joker` + `card_shark` (boxes push you into the card arcs).

### Boss 6 - OL' SCRATCH, THE DEALER "The House Always Wins" (`scratch`) - FINAL BOSS
HP **1500**, r 62 (human form) / 76 (true form), fear/stun-immune, portrait `portrait_scratch`, `heavy`. Barks (banner): P0 "DEAL ME IN", P1 "I RAISE", P2 "ALL IN", P3 "READ THE FINE PRINT". Sprites 320: `boss_scratch_idle/_atk` human form (tall red-skinned gentleman in black velvet tuxedo, top hat with small horns, gold-tooth grin, cane, cards in hand; atk: [0] card fan raised, [1] throwing, [2] arms wide (floor call/summon), [3] chip lobbed); `boss_scratch_true_idle/_atk` true form (tux burned off: huge horned goat-legged devil wreathed in hellfire, forked tail, glowing eyes; atk: [0] hands clasped with fire, [1] casting hellfire, [2] roar arms wide, [3] contract raised). Music `mus_boss6_a..d` (below).
**Arena `f6_boss`:** 13x7; slot machine blocks `R` at (1,1),(11,1),(1,5),(11,5); roulette region `r`/`k` checkerboard on cols 3-9 x rows 2-4 (used only by `roulette_call`); boss spawn `1` at (6,1) (dealer's rail, ground y 380). Chandelier markers use whole room. Free lanes: rows 0, 5-6 never roulette.
Movement: stays at the dealer spot; P1+ may `vanish` (smoke 0.5 s, invulnerable) and reappear >= 300 px from the player at one of 3 preset spots (720,380), (400,420), (1040,420) between attacks (30 % chance). Adds cap 3 alive.

| Phase | HP band (of 1500) | Rules |
|---|---|---|
| P0 "THE DEAL" | 100-70 % (1500-1050) | attack delay 1.5 s. Attacks: `deal_fan` 3, `card_ring` 2, `chip_toss` 2, `roulette_call` 2 |
| P1 "THE RAISE" (<70 %) | 70-40 % (1050-600) | roar, clear bullets, tux tears (frames swap to atk[2] pose), 2 `card_shark` adds (once; +1 if none alive after 25 s). delay 1.15 s. + `chandelier_rain` 2, `royal_flush` 3, `hold_em` 2 |
| P2 "ALL IN" (<40 %) | 40-15 % (600-225) | transformation 2.2 s (invulnerable, screen flash, `boss_scratch_true_*`), 4 permanent fire patches r 110 in the corners; delay 0.95 s. Attacks: `deal_fan` 2 (3 volleys), `card_ring` 2 (faster), `chandelier_rain` 2 (4 drops), `royal_flush` 3 (7 beams), `hellfire_spiral` 3, `brimstone_grid` 2. `roulette_call`/`hold_em` removed |
| P3 "THE FINE PRINT" (<15 %) | 15-0 % (225-0) | see contract mechanic; delay 1.2 s; attacks: `deal_fan` 3, `hellfire_spiral` 2 (single arm), `chandelier_rain` 1 |

- **`deal_fan`**: windup 0.6 s (atk[0], aim line last 0.25 s), 2 volleys (P2 3) of 5 `card` bullets, spread 60 deg, speed 340, 0.6 s apart, each volley re-aims; dmg 1.
- **`card_ring`**: 1.0 s windup (warn disc r 280), 3 expanding rings (P2 4) of 14 `card`, speed 250 (P2 290), 0.55 s apart, each ring rotated +12 deg (gap 25 deg between bullets at spawn).
- **`chip_toss`**: lobs 5 chips 0.25 s apart to markers r 70 (first on the player's position, others within 220 px), tell 1.0 s, each: 1 dmg r 70 + 6 `shard` ring speed 240.
- **`roulette_call`**: arms wide 0.8 s, calls RED or BLACK (banner), that colour's tiles in the region flicker 1.0 s then zap 1.6 s (same rules as the floor hazard, dmg 1 at start and every 0.7 s). Boss keeps firing 1 `deal_fan` volley during it. Never the same colour twice in a row.
- **`chandelier_rain`** (P1+): 3 drops (P2 4), 0.7 s apart, first on the player's position, then predicted (player pos + move dir x 150 px); tell 1.2 s each (same numbers as the floor hazard: r 100, 2 dmg, fire patch r 80 3 s). Max 6 fire patches alive (oldest culled).
- **`royal_flush`** (P1+): five warn beams (width 56 px) from the boss fanned 25 deg apart centred on the player, static tell 0.9 s, then rotate 40 deg/s (P2: 7 beams, 20 deg apart, rotate in alternating directions) for 1.6 s; a beam damages 1 per 0.5 s while it overlaps the player. Rolling through is safe; standing near the pivot is the low-risk spot.
- **`hold_em`** (P1): drops 2 face-down card markers on random quadrants (r 60), tell 1.0 s, flip to reveal a random suit each, active 5.0 s: spade = 8-bullet `spade` ring every 1.2 s; heart = 2 slow homing orbs (speed 150, homing 0.4, life 5, destroyed by player bullets); diamond = a rotating 3-beam pinwheel (width 44, 60 deg/s); club = aimed 3-fan every 1.4 s. Suits never repeat in one cast.
- **`hellfire_spiral`** (P2/P3): 3 arms (P3 1 arm), 4.0 s, 1 bullet/arm every 0.09 s, stepDeg 11, speed 240, direction reverses at 2.0 s (0.4 s pause between). Use `bullets.enemy.spiral`.
- **`brimstone_grid`** (P2): 3x3 lattice of eruption circles r 70 around the player's tile (spacing 200 px), checkerboard A (5 circles) tell 1.0 s -> erupt, then checkerboard B (4 circles) tell 0.8 s -> erupt. Each 1 dmg + fire patch r 70 for 2 s.
- **Contract mechanic (P3):** Scratch raises the contract (atk[3], a parchment rectangle painted on the floor centre): he becomes invulnerable and **reflective** (hits on him spawn 1 slow red `ember` back at the player, speed 220, max 12 alive). 3 `contract_seal` add orbs orbit him at r 150, 90 deg/s: HP 60 each (fixed, no floor scale), shootable, each fires 1 aimed `ember` every 1.6 s (speed 200), no contact damage; art = code-drawn red wax seal with a gold sigil (no generation). All 3 destroyed: the contract tears (`contract_tear`), Scratch is stunned **7.0 s, x1.5 damage**, seals return afterwards (45 HP each) if he survives. Expected 1-2 cycles. Phase-3 attacks keep running while seals are up.
- **Death:** at 0 HP the fight halts (all bullets/hazards cleared, boss invulnerable, `scene.cutscene=true`), slow-mo 0.35 x 2.5 s, cards scatter upward, the contract burns on the floor; then the ending trigger (section 8). No reward pedestal, no trapdoor.

`mus_boss6` stems (audio agent; cross-fade 1.0 s on `boss:phase`): `_a` (P0) piano-and-harpsichord poker waltz, 108 BPM; `_b` (P1) full band + choir stabs, 120; `_c` (P2, true form) organ + choir hell chorale, 132; `_d` (P3) sparse harpsichord + heartbeat + low drone, 72, tension.

## 6. Encounter budgeting and room templates

Threat cost per enemy (template authors): hellhound 2, hellsteer 3, cinder_skull 1, magma_eel 2, sulfur_preacher 2, magma_golem 4 / handcar_bandit 2, signalman 2, steam_stoker 3, crate_mimic 2, rail_rat 0.5 (pack of 5 = 2.5), chain_gang 4 (all links) / card_shark 2, loaded_die 2, slot_fiend 3, waiter_imp 1.5, bouncer 4, joker 2. Budget per wave sum: tier 1 = 6-8, tier 2 = 9-12, tier 3 = 13-17; 1-3 waves per room (>= 2 waves for tier 2+). Sum across waves stays <= 26. Existing rules hold: `SPAWN_SAFE_DIST` 300 px, >= wave-size + 3 safe tiles per entry door, hazard tiles never on/adjacent to door front tiles, telegraph 0.56 s.

| Per-floor template set (`src/gen/templates/floor4|5|6.js`) | Count |
|---|---|
| Normal templates per floor (ids `f4_n01`..`f4_n14`, `f5_*`, `f6_*`) | 14 (tier 1: 4, tier 2: 6, tier 3: 4) |
| Boss template per floor (`f4_boss`, `f5_boss`, `f6_boss`) | 1 |
| Start / treasure / shop / secret | reuse `special.js` templates, `floors:[1..6]` |
| Hazard quota F4 | >= 8 templates with `L`, >= 4 with `V`, >= 3 with `lavaSpit`; `magma_eel` in 3 |
| Hazard quota F5 | >= 8 with `lanes`, >= 3 with `T`; `handcar_bandit` lane version in 3 |
| Hazard quota F6 | >= 6 with `chandelier`, >= 4 with `roulette` (roulette region 3x3 to 5x3); never both roulette and chandelier below tier 3 |
| New templates in total | 45 |

Example layouts (13x7, `1`/`2` = wave slots):
```
f4_n06 (tier 2, lavaSpit)        f5_n04 (tier 2, lanes h@2 P6.5 off2.5, h@4 P7 off5)     f6_n09 (tier 2, roulette)
.............                    .......2.....                                            ...1.....1...
.1.LLLL.LLL1.                    ...R.........                                            .............
....LL..LL...     wave2:2 slot   =============  (rail row 2)                              ..rkrkrkrkr..
..R.......R..                    .1.....R...1.                                            ..krkrkrkrk..
....LL..LL...                    =============  (rail row 4)                              ..rkrkrkrkr..
.1.LLLL.LLL1.                    ...R.........                                            .............
.............                    .......2.....                                            ...2.....2...
```
(River rows leave 2 crossing gaps; door row 3 is clear of lava.)

## 7. Reward economy (F4-F6)

| Item | Value |
|---|---|
| Room-clear drop | `ROOM_REWARD` unchanged (0.40 + luck 0.05 + tier 0.04); `pityRooms` 3 -> **2** on F4-F6; pickup table heart weights x1.25 (`heart_half` 26, `heart_full` 12, `heart_tin` 10, coin 30, nickel 12, key 6, dynamite 4) |
| Enemy coin drop | 0.10 + luck 0.01; nickel share 0.15 -> **0.20** on F4-F6 |
| Cursed elite | drops `heart_full` (existing) |
| Shop prices (F4-F6) | passive 15-20 c, active 20-25 c, `heart_full` 4, `heart_tin` 6, key 6, dynamite 6 (`cursed_coin` discount still -1, min 1). F4 shop 100 %, F5 70 %, F6 100 % ("Faro Bank" skin: `bg_shop` tinted `0x5a1020`, peddler stays) |
| Treasure room | 1 item pedestal, key-locked; F5 25 % two pedestals pick-one (as F3); F6 pick-one of 2 guaranteed |
| Secret room | 2 pickups + 40 % item (unchanged) |
| Boss rewards | Undertaker (interlude): pick-one of 2 boss-pool items + heart + trapdoor. Toro: 1 boss-pool item + heart + trapdoor. Engine: **pick-one of 2** + heart + trapdoor. Scratch: none (ending) |
| Expected coins | ~ 34 F4, ~ 38 F5, ~ 42 F6 (bots measure via `bot-report`); shop must be affordable for 1 passive on each floor at median |
| Extra special rooms | Crossroads / events / mini-bosses (RUN-VARIETY doc) sit on top of the rooms above: up to 2 extra leaf specials per floor, total non-secret rooms <= 15 |

## 8. Ending trigger (after boss 6) - hand-off to the STORY doc

`GameScene.onBossDefeated(boss)`: if `boss.id==='scratch'` (or `floorNum>=MAX_FLOOR`) -> **do NOT** spawn reward/trapdoor. Sequence, then hand-off:
1. Boss death slow-mo (as in Boss 6) ends; `Save.recordRun({... won:true})`, `run.won=true`, `run.chapter=2`, `run.completedChapter2=true`; emit `bus.emit('game:ending', { ending:'devil_defeated', run, character, difficulty, seed })`.
2. World frozen (`scene.cutscene=true`, `player.setEntryInvuln(60)`, bullets cleared, music faded 1.0 s, no `mus_victory` yet).
3. Call `runEnding(scene, payload)` exported by `src/scenes/ending.js` **(specified in `docs/v2/STORY.md`)**: cutscene panels, credits, then `EndScene` variant. If the STORY module is absent, fall back to the existing chapter-complete poster (`endRun('complete')`) so the game never soft-locks.
Chapter 1's finale (`finale.js`) is refactored into `playBanner(scene, title, sub)` used by the interlude and by the STORY doc.

## 9. Persistence and progress (interfaces only; META doc owns the rest)

- `Save` additions: `chapterReached` (1|2), `bestFloor` up to 6, `wins2` (Chapter 2 clears), `enemiesSeen` (ids), `bossesKilled` (ids), `bestTimeCh2`, `checkpoint`.
- **Checkpoint** (`Save.saveCheckpoint()` at the start of floors 4, 5 and 6, after the floor fade-in): `{v:1, seed, floor, items:[...], active:{id,charge}, hp, maxHp, tin, coins, keys, dyn, time, kills, character, difficulty}`. The floor is regenerated from `seed + floor`; room states are not saved (mid-floor saves are out of scope). Menu shows `CONTINUE - FLOOR n` when a checkpoint exists; loading it or dying/quitting/winning clears it (`Save.clearCheckpoint`). A checkpoint never resurrects a dead run.
- Bounty Board stats: "Reached Hell" (floor 4), "Off the rails" (floor 5 boss), "Broke the house" (Scratch) hooks - achievements/unlock definitions belong to the META doc.
- Debug/QA API: `?floor=N` URL flag (1-6), `api.setFloor(1..6)`, `api.spawn(id,x,y)` accepts all new ids, `api.bossRoom()` works for all bosses, `api.setHp`. Codex text is authored in the META doc.

## 10. Art asset list (image generations)

Style: dark ink-cartoon woodcut per `ART_BIBLE.md`, style reference `art/style/style_c.png` as Image 1 for every generation, transparent PNG unless "opaque", no baked shadow/ground/background, top-left light, thick ink outlines; sprites must survive compositing on their floor's backgrounds (test each against `bg_f4_a/b/c`, `bg_f5_a/b/c`, `bg_f6_a/b/c`).

| Key(s) | Format | Gens | Notes |
|---|---|---|---|
| `bg_f4_a/b/c/boss`, `bg_f5_a/b/c/boss`, `bg_f6_a/b/c/boss` | opaque 1440x864, WebP | **12** | descriptions in sections 3-5; empty floor, no doorways, floor readable, darker vignette |
| `obst_f4`, `obst_f5`, `obst_f6` | grid 4x2 96x96 | **3** | names order `block_a, block_b, breakable, breakable_broken, pit, spikes, decor_a, decor_b` |
| `haz_f4` | grid 4x2 96 | **1** | `lava_a, lava_b, lava_c` (3-frame flow, code loops a-b-c-b at 4 fps), `lava_rim` (shore overlay, rotate), `vent_idle`, `vent_warn`, `vent_erupt` (open grate glowing), `scorch_patch` |
| `haz_f5` | grid 4x2 96 | **1** | cells listed in section 4 |
| `haz_cart` | strip 4 x 192x128 | **1** | ghost cart = code tint |
| `prop_chandelier` | strip 3 x 192x192 | **1** | |
| `fx_hellfire` | strip 6f 128x192 anchor bottom | **1** | flame column loop; reused for patches, vents, burning bosses; tint variants in code |
| `projectiles_c2` | grid 4x2 48x48, anchor centre | **1** | `bullet_ember` (hot yellow-white core, orange rim, black outline), `bullet_coal`, `bullet_steam` (white puff, dark outline), `bullet_card` (playing card, points right), `bullet_chip` (poker chip), `bullet_shard` (glass sliver), `bullet_spade` (violet spade), `bullet_spike` (railroad spike). Outlines must stay readable on F4 orange |
| Enemy pair sheets (2 enemies per generation = 2 rows x 6 frames, slice each row separately with `sprites.py strip`): `enemy_hellhound`+`enemy_sulfur_preacher`, `enemy_hellsteer`+`enemy_magma_golem`, `enemy_cinder_skull`+`enemy_magma_eel`, `enemy_handcar_bandit`+`enemy_steam_stoker`, `enemy_signalman`+`enemy_crate_mimic`, `enemy_rail_rat`+`enemy_chain_gang`, `enemy_card_shark`+`enemy_joker`, `enemy_slot_fiend`+`enemy_bouncer`, `enemy_loaded_die`+`enemy_waiter_imp` | 18 strips, frame sizes in the enemy tables | **9** | 6 frames each: 0-3 loop, 4 windup, 5 attack; if a pair fails review regenerate as singles (reserve below) |
| `boss_toro_sheet` (4x2 grid 320: row 1 idle, row 2 atk) -> `boss_toro_idle`, `boss_toro_atk`; `portrait_toro` 512x512 | | **2** | |
| `boss_engine_sheet` (idle+atk) -> `boss_engine_idle/_atk`; `boss_engine_run` (2x2 grid of 512x320 frames); `portrait_engine` | | **3** | |
| `boss_scratch_sheet` (human form) -> `boss_scratch_idle/_atk`; `boss_scratch_true_sheet` -> `boss_scratch_true_idle/_atk`; `portrait_scratch` (used for both forms) | | **3** | |
| `img_interlude_ch2` | opaque 1440x960 | **1** | Painted panel: the Undertaker's coffin lid split open, a black shaft plunging into a red-orange glow, a tiny gunslinger silhouette at the rim, cinders rising, blood-red dusk; leave the lower third dark for text |
| **Total** | | **39** (+4 reserve = 43) | |

Code-drawn (no art): roulette tiles, reels/symbols, dice pips, jack-in-the-box body (uses `dynamite_placed` tinted purple + a smiley overlay), contract seals, parchment contract, suit sigils, ward outline, lava eel ripples, `herd` bodies (hellsteer scaled), ghost carts, boss fire trails.

**Sprite QA:** frame sizes exact, all 6/4 frames present, feet on the ground line, identical scale across frames, portraits 512x512 with the face in the upper 60 %. Preview strips must be attached in review.

## 11. Audio asset list

| Type | Keys |
|---|---|
| Music (loop) | `mus_floor4`, `mus_floor5`, `mus_floor6`, `mus_boss4`, `mus_boss5_a/b/c`, `mus_boss6_a/b/c/d`, `mus_interlude` (30 s drone, no loop hard-cut). Ending music belongs to the STORY doc |
| Ambience | `amb_lava`, `amb_rail`, `amb_saloon` |
| SFX (new, mix table entries in `mix.js`, target loudness = existing peers) | `lava_bubble`, `lava_burst`, `vent_hiss`, `vent_erupt`, `fire_whoosh`, `fire_loop`, `bull_snort`, `bull_roar`, `hoof_thunder`, `hound_growl`, `train_horn`, `train_bell`, `rail_clatter`, `cart_rumble`, `steam_hiss`, `steam_blast`, `coal_thud`, `mimic_chomp`, `rat_squeak`, `chain_rattle`, `card_throw`, `card_shuffle`, `chip_clatter`, `dice_roll`, `slot_spin`, `slot_ding`, `slot_jam`, `glass_break`, `chandelier_creak`, `chandelier_crash`, `roulette_tick`, `roulette_zap`, `piano_sting`, `devil_laugh`, `contract_tear`, `seal_break` (variants `_2`, `_3` welcome) |
| Event hooks | `AudioHooks.EVENT_SFX`: `boss:phase` -> `bull_roar` (Toro) / `train_horn` (Engine) / `devil_laugh` (Scratch); `AudioDirector` floors 4-6 tracks, boss stems switch on `boss:phase` (1.0 s crossfade), footsteps on F6 = wood, F4 = dirt, F5 = gravel (`step_dirt`) |
| Licensing | prefer CC0 / own synthesis; log every file in `CREDITS_*.md` like Chapter 1 |

## 12. Implementation notes (which system to extend)

- **Config:** `FLOORS[4..6]` (name, subtitle, bgA/bgB/bgC/bgBoss, obst, music, hpMult, tint, boss), `MAX_FLOOR=6`, `FLOOR_GEN[4..6]`, `INTERLUDE_AFTER=3`, `ENEMY_DEFAULTS.cursedChance` per floor (`cursedByFloor`), `ROOM_REWARD` chapter-2 overrides.
- **Enemies:** one file per id in `src/enemies/types/`, `registerEnemy(id, Class, meta)`; `ENEMY_META` rows from the tables (add floors 4/5/6 to `possessed`, `skeleton`, `ghost`). New helpers on `Enemy`: `wardT`, token helper `scene.token(name)` (for hound/skull/signal caps), `Room.lavaPath`. `chain_gang` uses a `leader` chain, `crate_mimic` overrides `syncVisual` to draw the obstacle sprite until awake. `signalman` calls `room.spawnLane`.
- **Bosses:** `toro.js`, `engine.js`, `scratch.js` in `src/bosses/types/`, `registerBoss`, add rows to `BOSS_META` (`toro {hp 800,r 92,floor 4,music 'boss4'}`, `engine {980,100,5,'boss5'}`, `scratch {1500,62,6,'boss6'}`). Follow `undertaker.js` conventions (`interrupt`, `takeHit` override, `damageMultiplier` for stun windows, hazard list, silent add removal on death, `Boss.finishDeath`). Engine adds a state machine `parked/passing/gone` and swaps `spriteKey`; Scratch uses `formKey`.
- **Rooms:** extend `Room.js` tile loop (`L`, `V`, `=`, `|`, `T`, `r`, `k`), `updateHazards(dt)` next to `updateSpikes`, `Room.buildLights` presets per floor (F4 orange flicker, F5 red signal blink, F6 gold candle flicker); snapshot/teardown of hazard objects via the same `objs`/`own()` path so slide transitions do not leak them.
- **Player:** `damage(units, {kind})` with new kinds; external impulses for steam (`player.push(vx,vy,t)`), lane shoves and Bouncer rush use `player.knock`/`forceWalk`.
- **Perf budget:** <= 14 fire patches, <= 60 enemy bullets, <= 4 lane bodies, 60 fps with 10 enemies (existing target); pool everything.

## 13. Acceptance and tests

1. `npm run selftest` and `node tools/floorgen-test.mjs 300` over floors 1-6 (room counts F4 10-11, F5 11-12, F6 12-13 before extra specials; boss dead-end, key room, symmetric doors); template validator passes for all 45 new templates (lava never blocks a door pair, vents/pipes placement rules, lane bounds, `magma_eel` needs lava).
2. Every new enemy: spawn via `api.spawn`, 60 s soak per pack with `stress-enemies.mjs 4|5|6` (no console errors, no leaks, >= 55 fps headless equivalent), all tells >= 0.3 s (add to `regress-levels.mjs` timing assertions), hit-flash/death/loot work, `?noassets=1` and `?dropassets=40` still run (placeholders for every new key).
3. Hazards: unit-style QA in `regress-levels.mjs`: lava damage 1/s, roll across lava = 0, vent cycle timing 1.8/0.9/0.9, lane cart tell 1.0 s + damage 2, steam push 300 px/s, chandelier tell 1.2 s + damage 2, roulette 1.0 s tell + zap, fire patch cap 14, hazards stop on clear (except tile hazards).
4. Bosses: `boss-toro-bot.mjs`, `boss-engine-bot.mjs`, `boss-scratch-bot.mjs` (god mode off, expert bot with the stock Chapter-1 loot): win rate over 8 seeds Toro 70-85 %, Engine 60-80 %, Scratch 40-60 %; median fight time Toro 55-95 s, Engine 70-115 s, Scratch 150-260 s; no state deadlock (every attack generator terminates, phase change during any attack interrupts cleanly - fuzz by setting `boss.hp` to phase thresholds mid-attack); every phase reachable via debug.
5. Flow: chapter interlude plays once, skippable, sets checkpoint; boss 3 reward + trapdoor still work; `Save` round trip of the checkpoint (continue at floor 4/5/6 with identical items/hp/coins); F6 death -> `game:ending` event fires exactly once, and with the STORY module missing falls back to chapter-complete poster.
6. Full-run bot (`bot.mjs --seeds 1-8`) reaches F6 boss without errors; typical clear F4-F6 = 30-36 min for a skilled player; readability pass (screenshots of a hazard room per floor, an enemy bullet volley per floor).

## 14. Scope guards (do NOT build)

- No new player mechanics (mounts, cover, second active), no new pickup types, no character-specific logic in floors 4-6 (characters/items/synergies come from their own docs).
- No mid-floor saves, no branching floors or alternative paths, no Chapter 3, no boss-rush mode (META doc), no New Game+ loop after Scratch.
- No dialogue system in combat: barks are one-line banners only. Full cutscenes, credits and the epilogue are the STORY doc.
- No physics/pathfinding upgrades: enemy movement stays steering + `probe` (lava tiles just count as blocked for walkers), lane bodies are straight lines, `magma_eel` uses a BFS over lava tiles only.
- No per-enemy art beyond the 18 strips (variants, cursed = tint; boss adds reuse existing art), no extra room backgrounds beyond the 12 (shop/treasure/secret reuse `bg_shop`/`bg_treasure` with tints).
- No new UI screens beyond the interlude card and boss/floor cards (they use existing `Cards.js`); no Crossroads/event/mini-boss content in this doc.
- Difficulty modes, daily seed, elites beyond the tint/`cursedChance`, and the codex texts are specified elsewhere; this doc only exposes the numbers above.

## 15. New ids (collision list)

Enemies (18): `hellhound hellsteer cinder_skull magma_eel sulfur_preacher magma_golem handcar_bandit signalman steam_stoker crate_mimic rail_rat chain_gang card_shark loaded_die slot_fiend waiter_imp bouncer joker`. Bosses (3): `toro engine scratch`. Boss adds/entities: `contract_seal` (enemy-like, code art), `herd` (lane body), `ghost_cart`/`cart` (lane bodies), `jack_box` (Dynamite subclass). Floors: `f4 f5 f6`. Tile chars: `L V = | T r k`. Keys: see section 10-11.

## Integrator notes
Authoritative reconciliation is `ARCH_V2.md` s0 (D1-D18); where this doc disagrees, ARCH_V2 wins.
- Fire: one `FirePatch` (`src/rooms/hazards/FirePatch.js`, `Room.addFire`), cap 14, burn 3 dps for 2.5 s, art `fx_hellfire`; `fx_fire` is cut (D2).
- Elite chance and `enemy:died` payload follow D3 (cap 0.40, Hell eliteMult 1.6).
- Mini `bouncer` (EVENTS) is renamed `head_bouncer`; the F6 grunt keeps `bouncer` (D1).
- Both `img_interlude_ch2` and `cutscene_interlude_1` are kept (D12); floor counts come from `FLOOR_GEN` (D11).
- Art is reduced to the batches in `ASSET_SPEC_V2.md`; music/SFX keys and fallbacks are in `AUDIO_SPEC_V2.md`.
- Boss music is decided by `BOSS_META.music`; the Undertaker keeps `mus_boss_final` (D14).
- Scratch death halts and emits `game:ending`; ending scenes live in `src/scenes/ending.js` (D13).
