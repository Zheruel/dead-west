# DEAD WEST — Chapter 1: "Perdition County" (Game Design, source of truth)

Top-down twin-stick roguelike shooter in the vein of *The Binding of Isaac*, set in a dark occult western (gritty realism + hellfire).
Browser game: Phaser 3 + Vite, vanilla JS (ES modules), no TypeScript.

> Design brief (original intent). Chapter 1 is implemented; where numbers differ, `src/config.js` and `ARCHITECTURE.md` are authoritative (e.g. 16 enemies incl. `crow`/`tumbleweed_mini`). What is done / known issues / next steps: `STATUS.md`.

**Pitch:** You are a dead gunslinger dragged out of your grave by a debt you signed in blood. Shoot your way through Perdition County, floor by floor, to reach the saloon where the Devil keeps your contract. Chapter 1 = 3 floors, 3 bosses. Permadeath; each run is procedurally generated.

Tone: grim, macabre, darkly funny. Big-headed cartoon characters, thick ink outlines (see ART_BIBLE.md).

## Controls
| Action | Keys |
|---|---|
| Move | WASD |
| Shoot | Arrow keys (4-way, fire in held direction; two keys = diagonal aim is NOT needed, Isaac-style: last pressed wins) — OR hold Left Mouse to fire toward cursor |
| Dodge roll | Space (0.30 s i-frames, ~240 px, 1.0 s cooldown, direction = move dir, else aim dir) |
| Dynamite | E (place at feet, 1.4 s fuse, hurts player too, blows open Secret Room walls & breakable obstacles) |
| Active item | Q (needs full charge) |
| Pause | Esc / P |
| Mute | M |
| Restart after death | R / Enter |
Debug (only with `?debug=1`): F1 skip to next floor, F2 full heal, F3 give random passive, F4 give +99 coins/keys/dynamite, F5 kill all enemies in room, F6 teleport to boss room, F7 toggle god mode. `?seed=N` fixes the RNG seed (deterministic floors).

## Core mechanics
- **Revolver / "Sixth Bullet":** infinite ammo. A 6-slot cylinder HUD shows shots. **Every 6th shot** is the *Sixth Bullet*: ×2 damage, pierces 1 enemy, bigger bullet, louder crack, screen kick. The cylinder animates as it fires (no reload — the flavour is the count).
- **Hearts:** Red hearts (containers; half-heart granularity: 1 HP unit = half heart). **Tin hearts** = armour, lost first. Start: 3 red hearts (6 units). Max 12 heart containers.
- **Contact/bullet damage:** 1 unit (half heart) normal, 2 units heavy (boss slams, dynamite explosion). After being hit: 1.0 s i-frames with blink. Taking a hit breaks combo-less (no combo system).
- **Pickups:** heart_full (+2 units), heart_half (+1), heart_tin (+2 tin units = 1 tin heart), coin (+1), coin_nickel (+5), key (+1), dynamite (+1). Max 99 coins/keys/dynamite. Pickups drop from cleared rooms (luck-weighted), from breakable barrels/crates and enemies (small chance).
- **Room clear:** entering a room with enemies locks doors until all waves are dead. Clearing may drop a pickup and gives +1 charge to the active item. Rooms remember state (cleared, items taken).
- **Stats** (all modifiable by items): `damage 3.5`, `fireDelay 0.33 s` (shots/sec = 1/fireDelay), `range 0.55 s` bullet lifetime at shotSpeed, `shotSpeed 780 px/s`, `moveSpeed 330 px/s`, `luck 0`, `maxHearts 3`, `bulletCount 1`, flags: `pierce`, `ricochet`, `homing`, `poison`, `burn`, `spread`, etc. See ARCHITECTURE.md for the `stats` object contract.
- **Player hitbox:** circle r≈26 px at the feet. Bullets r≈10 px.

## Floors (Chapter 1 = 3 floors)
Each floor: 8–11 rooms on a grid (Isaac-style BFS generation), one Start room, N Normal rooms, 1 Treasure room (key-locked "golden" door, contains 1 item pedestal, 25% two pedestals pick-one on F3), 1 Shop (F1 guaranteed, F2 70%, F3 guaranteed), 1 Boss room (farthest dead end; red-skull door), 1 Secret room (hidden; found by dynamite on a wall adjacent to ≥2 rooms; contains coins/hearts/item). Killing the boss spawns a **trapdoor** + a reward pedestal (1 item) + a heart. Entering the trapdoor → next floor. After floor 3's boss → **Chapter Complete** screen with run stats, "To be continued…".

| # | Floor | Setting | Palette | Music | Boss |
|---|---|---|---|---|---|
| 1 | **Dry Gulch** | Sun-baked canyon trail, dead cattle, cacti, bone piles, wrecked wagons | ochre, sand, sun-bleached bone, blood | mus_floor1 | **El Cascabel** (giant demonic rattlesnake) |
| 2 | **Perdition** | Abandoned ghost town: saloon interiors, main street, gallows, cemetery edge | weathered grey-brown wood, dusk purple, lantern amber | mus_floor2 | **Marshal Grimm** (undead lawman) |
| 3 | **Sundown Mine** | Collapsed silver mine & buried coffins, timber supports, minecart rails, green ghost-light | cave black-brown, rust, sickly green glow | mus_floor3 | **The Undertaker** (chapter boss, 3 phases) |

Difficulty: enemy HP ×1.0 / ×1.25 / ×1.5 per floor on top of base stats below; room enemy count 2–5 waves-lite (1–3 waves per room; next wave spawns when previous is cleared, with a 0.6 s telegraph puff). Elite variant: 8% chance an enemy is **Cursed** (red aura, +50% HP, drops a heart). Target playtime: ~20–30 min full clear for a decent player.

## Room layout / grid
- Logical canvas **1440×960**. Tile **96 px**. Interior **13×7 tiles** (1248×672). Room frame image 1440×864 drawn at y=96 (HUD strip 0–96 above). Interior origin (96,192), centre (720,528). Doors at wall centres: top (720,144), bottom (720,912), left (144,528), right (1296,528).
- Obstacle types (per-floor art): `block` (solid, bullets stop), `pit` (blocks walking, bullets fly over; flyers cross), `spikes` (damages walkers 1 unit; flyers ignore), `breakable` (barrel/crate: takes 1–2 hits from anything incl. dynamite, may drop pickup, leaves rubble/broken sprite frame).
- Room templates authored as ASCII (13×7) per floor; ≥14 normal templates per floor, 3 boss templates (1/floor), 3 treasure, 2 shop, 1 secret. Chars: `.` floor, `R` rock/block, `P` pit, `S` spikes, `B` breakable, `1..9` enemy spawn slots (digit = wave number), `E` random-enemy slot, `X` no-spawn marker, `D` door spot (reserved, always walkable in front of doors).

## Enemies (14). HP at base (multiplied by floor factor). Frame size in px is for art.
| id | Floor(s) | HP | Behaviour |
|---|---|---|---|
| `coyote` | 1 | 12 | Fast. Circles player, then howl-telegraph (0.4 s) and charges in a straight line; bounces off walls once; pauses after. |
| `rattlesnake` | 1,2 | 14 | Slithers slowly, stops, rattles (telegraph), spits 3-bullet fan of venom at player. Cannot cross pits. |
| `tumbleweed` | 1 | 10 | Rolls in straight lines bouncing off walls/obstacles; on death splits into 2 mini tumbleweeds (5 HP, small, no split). |
| `outlaw` | 1,2 | 16 | Human bandit. Keeps mid distance, strafes, fires an aimed single shot every ~1.4 s; drops hat on death. |
| `buzzard` | 1,2 | 10 | Flyer (ignores pits/obstacles). Circles at edge, then swoops across the room in a line; hovering wobble. |
| `possessed` | 2,3 | 24 | Red-eyed bandit. Walks toward player, at range 260 px lunges (dash); when hurt below 50% spawns red aura and moves 30% faster. |
| `skeleton` | 2,3 | 18 | Skeleton gunslinger. Stands still and fires a rotating burst of 4 bullets (cross pattern, spinning), then relocates. |
| `dynamiter` | 2 | 20 | Throws lit dynamite in an arc at player's position (lands after 0.9 s, 1.0 s fuse, radius 150 explosion, 2 dmg). Retreats if player is close. |
| `ghost` | 2,3 | 14 | Floats slowly toward player through obstacles, phases in/out (invulnerable while faded, 1.5 s cycle). Wails when it turns solid. |
| `scarecrow` | 2 | 30 | Hanged scarecrow ghoul; stationary. Every 3 s spawns 2 `crow` (small chasers, 3 HP, 64px). Doesn't move. |
| `miner` | 3 | 40 | Slow armoured zombie miner; slow walk; swings pickaxe when adjacent (heavy 2 dmg, 0.7 s windup); takes reduced damage from front (×0.6) — only rear/side hits full. |
| `bat` | 3 | 8 | Erratic fast flyer, swoops in groups of 3–4; light contact damage. |
| `mole` | 3 | 22 | Burrows: disappears (dirt mound), moves under the floor toward the player, pops up under them after telegraph (dirt burst, 1 dmg area), stunned 1 s after popping (vulnerable). |
| `coffin` | 3 | 28 | Upright coffin that hops toward the player in short jumps (0.5 s pause between hops, hop = landing shockwave 1 dmg if you're under it). On death the lid bursts open and releases 2 `bat`. |
Support: `crow` (from scarecrow), `tumbleweed_mini`. These 2 need sprites too.

All enemies: hit flash (white tint 80 ms), knockback on hit (small), death puff + blood decal, shadow ellipse under them, contact damage 1 unit unless stated.

## Bosses
Boss rooms: door locks; 1.8 s intro card (portrait + name "EL CASCABEL — The Rattle Before The Bite"); boss bar at top of HUD; health scaled. Each boss 2–3 phases (by HP thresholds) with telegraphed attacks and a "spawn adds" moment. All must be fair, readable and beatable with starting stats (with dodge roll).
1. **El Cascabel** (HP 260, floor 1) — colossal rattlesnake coiled in the room's centre-back. Attacks: (a) venom fan spit (5-shot spread, aimed) ; (b) rattle shockwave: tail shakes 0.8 s (telegraph) → ring of 12 bullets expanding; (c) burrow-dash: dives under (shadow moves), pops up under player (telegraphed ring on floor); (d) phase 2 (<50%): spawns 3 baby `rattlesnake`; faster fans, double rings. Death: writhes, explodes into bones.
2. **Marshal Grimm** (HP 420, floor 2) — skeletal lawman in a duster with tin star, twin revolvers, noose-lasso. Attacks: (a) quick-draw: freezes, points at player 0.5 s then fires 3 rapid aimed shots ×2; (b) lasso: throws noose in a line (telegraph line), pulling player toward him if hit (then melee slam heavy 2 dmg); (c) dynamite volley: lobs 3 sticks; (d) phase 2 (<60%): summons 2 ghost deputies (`ghost`) & spins revolvers in radial 8-shot bursts while walking; phase 3 (<25%): enrage—faster, dual bursts.
3. **The Undertaker** (HP 650, floor 3, chapter finale) — huge gaunt undertaker with a coffin on his back and a shovel. Phase 1: shovel slam (shockwave line + falling rocks telegraphed), coffin nails: fires 3 bursts of nail bullets in a fan; Phase 2 (<66%): opens coffins along the walls (3 `coffin` spawn), grave-dig: burrows and erupts bone spikes in a grid pattern (telegraphed); Phase 3 (<33%): coffin lid becomes a shield (front immune) — must be hit from sides/back while he charges; radial ghost-fire spiral. On death: dramatic slow-mo + chapter complete flow.

## Items
Passive items (24). Item pedestal shows sprite; pickup shows banner "NAME — description" (parchment style, 2.5 s). Effects are simple stat/flag mods so they stack.
| id | Name | Effect |
|---|---|---|
| `spurs` | Silver Spurs | +60 moveSpeed |
| `lucky_horseshoe` | Lucky Horseshoe | +2 luck (better drops, crit chance) |
| `hollow_point` | Hollow Point Rounds | +1.5 damage |
| `speed_loader` | Speed Loader | fireDelay ×0.8 |
| `long_barrel` | Long Barrel | +range, +shotSpeed |
| `sawed_off` | Sawed-Off | bulletCount +2 (3-shot spread), damage ×0.7 per pellet |
| `ricochet` | Ricochet Rounds | bullets bounce off walls once (+1 per copy) |
| `dead_eye` | Dead Eye | first shot after 2 s of not shooting deals ×3 and pierces; +luck 1 |
| `bandolier` | Bandolier | +4 dynamite, dynamite radius +30% |
| `snake_oil` | Snake Oil | +1 heart container, heal 1 heart |
| `tin_star` | Tin Star | +2 tin hearts |
| `liquid_courage` | Liquid Courage | +0.4 damage per missing heart container-half (scales at low HP) |
| `cursed_coin` | Cursed Coin | coin drops ×2; +1 luck; shop prices −1 (min 1) |
| `rattler_fang` | Rattler Fang | bullets poison (dmg over 3 s, stacking refresh) |
| `silver_bullets` | Silver Bullets | +1 damage, ×2 vs `ghost`/`skeleton`/`possessed`/`coffin`/`miner`/Undertaker-phase adds ("undead" tag) |
| `dynamite_vest` | Dynamite Vest | 25% chance to drop lit dynamite when hit; explosions don't hurt you |
| `spirit_lantern` | Spirit Lantern | orbiting ghost-flame familiar, contact damage 6/s, blocks enemy bullets |
| `crow_companion` | Crow Companion | follower familiar that shoots 0.5× damage bullets at nearest enemy |
| `voodoo_doll` | Voodoo Doll | 12% chance shots **fear** enemies (flee 2 s) |
| `duster_coat` | Duster Coat | ignore first hit in each room (shield pip visible) |
| `prospectors_pan` | Prospector's Pan | +3 coins on each room clear; 10% chance of a key |
| `hex_bag` | Hex Bag | bullets have 15% chance to burn (sets ablaze) |
| `fan_the_hammer` | Fan the Hammer | fireDelay ×0.55 but bullets get random ±8° spread; every 6th bullet still crits |
| `mezcal_worm` | Mezcal Worm | +0.7 damage, +30 moveSpeed, but −1 heart container (min 1) |
Active items (4, charged by clearing rooms; charge bar on HUD): `whiskey_bottle` (3: heal 2 units), `pocket_watch` (4: bullet-time 4 s — enemies & bullets 40% speed, player normal), `powder_keg` (5: huge explosion at feet, 3 dmg to enemies, breaks obstacles; player takes 1 unit unless vest), `lucky_deck` (3: random effect: +2 coins / heart / key / dynamite / temp +damage for the room).
Treasure room item pool: passives + actives (no duplicates in a run; allow stacking of 'multi' items only through pool).
Shop: 3 offerings: 1 passive (10–15¢), 1 heart (3¢) or tin heart(5¢), 1 key (5¢)/dynamite (5¢)/random pickup; shopkeeper NPC (the "Skinny Undertaker" is boss 3, so shopkeeper = one-eyed **Peddler Skeleton** with a wagon).
Secret room: 2 pickups + 40% item.

## Progression, UX and juice (required polish)
- Main menu (title logo, "Press ENTER to start", best-run stats), floor-intro card ("FLOOR 1 — DRY GULCH"), pause overlay, death screen ("YOU DIED — hanged by the Devil's own noose" style) with run stats + collected items + "R to try again", chapter-complete screen.
- Screenshake on explosions/boss slams, hit-stop (40 ms) on Sixth Bullet kill, damage flash (white) on enemies, red vignette pulse when hit, low-health heartbeat + vignette at ≤1 heart, dust puffs when walking/rolling, muzzle flash, brass shell casings optional, enemy bullets with distinct colour outlines (enemy bullets = red/orange core with dark outline; player bullets = pale brass/white). **Bullets must be clearly readable against every floor.**
- Minimap top-right (Isaac style: visited/unvisited/unknown, icons for boss skull, shop $, treasure star, current room highlight).
- Persist to localStorage: best floor reached, best time, total runs, deaths, items seen (a tiny "Bounty Board" on menu).
- Difficulty must be fair: every enemy attack telegraphed ≥0.3 s; no unavoidable damage; invulnerability on room entry 0.5 s.
- Performance: 60 fps with 40 bullets + 8 enemies on a mid laptop. Pool bullets.
- Accessibility: volume slider or M mute; screenshake toggle on pause menu.

## Audio direction
Dry, sparse, tense: slide guitar, harmonica, low drones, church bells, jaw harp, boots on wood. Enemies have distinct audio identities (rattle, howl, screech, wail). SFX punchy and short. See ASSET_SPEC.md (Audio) for keys.

## Out of scope (explicitly)
Gamepad support, multiplayer, unlock meta-progression beyond simple stats, more than 3 floors, localization.
