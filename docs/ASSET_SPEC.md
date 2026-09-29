# DEAD WEST — Asset Spec (contract between art/audio pipeline and game code)

Logical canvas **1440×960**, tile **96 px**. All sprite sizes below are in logical px (game draws them at scale 1). Sprite sheets are **horizontal strips** (frame i at x = i·frameWidth) unless "grid". Everything transparent PNG unless marked *opaque*.

Output locations: `public/assets/sprites/<key>.png` (+ `<key>.meta.json` from tools/sprites.py) for sprite strips/grids; `public/assets/images/<key>.png` (+ `<key>.image.json` = `{"<key>":{"width":W,"height":H}}`) for single images; audio in `public/assets/audio/`. Run `.venv-art/bin/python tools/build_manifest.py` to (re)build `public/assets/manifest.json`:
```
{ "sprites": { key: {file, frameWidth, frameHeight, frames, mode, anchor, names[]} },
  "images":  { key: {file, width, height} },
  "audio":   { key: {file, type:"sfx"|"music", volume, loop, source, license} } }
```
**The game must run with ANY subset of these assets present** (missing key → coded placeholder). Anchor `bottom` = feet/ground line at bottom of frame (origin 0.5,1 minus ~4 px pad) ; `center` = origin 0.5,0.5.

## Characters (frame px, anchor bottom, facing camera unless noted; flipX in code for left)
### Player — cursed gunslinger (big head, wide hat with small bull-skull, red poncho with occult sigil, two revolvers (one in hand), black eyes, ashen skin) — frame **128×128**
| key | frames | notes |
|---|---|---|
| `player_walk_down` | 6 | walking toward camera; alternating legs, poncho sway |
| `player_walk_up` | 6 | walking away (back view, poncho sigil visible) |
| `player_walk_side` | 6 | strict side profile facing RIGHT |
| `player_fire` | 3 | single firing poses: [0] facing down, [1] facing up, [2] side/right; revolver raised & pointing that way, recoil pose |
| `player_roll` | 4 | tucked dodge-roll, side view facing right (rolling ball of poncho + hat), symmetrical enough to rotate |
| `player_death` | 5 | hit → stagger → falls → lies on ground → hat settles over face (last frame lies flat) |
Player anchor/turnaround art: `art/style/player_anchor.png`.

### Enemies — strips of **6 frames**: [0–3] move/idle loop, [4] attack windup/telegraph pose, [5] attack pose. Front-facing (3/4 top-down). Sizes (frame): 
| key | frame | notes |
|---|---|---|
| `enemy_coyote` | 128 | mangy scarred coyote, hollow glowing eyes; [4] crouch howl, [5] lunge stretched |
| `enemy_rattlesnake` | 128 | coiled rattler with green eyes, tail up rattling; [4] rears back, [5] spits |
| `enemy_tumbleweed` | 128 | spiky tumbleweed ball with a toothy maw; frames 0–3 rolling rotation phases; [4] maw wide, [5] snapping |
| `enemy_tumbleweed_mini` | 64 | small version (same design, cuter) |
| `enemy_outlaw` | 128 | human bandit, bandana mask, big hat, revolver; [4] aiming, [5] firing |
| `enemy_buzzard` | 160 | skull-faced buzzard with wings spread (flap cycle 0–3); [4] wings back to swoop, [5] dive pose |
| `enemy_possessed` | 128 | red-eyed possessed bandit, red flame wisps, claws; [4] crouch, [5] lunge |
| `enemy_skeleton` | 128 | skeleton gunslinger, hat, red bandana; [4] arms out, [5] firing |
| `enemy_dynamiter` | 128 | hunched bandit with dynamite bandolier, lit stick in hand; [4] wind-up throw, [5] throw |
| `enemy_ghost` | 128 | pale prospector ghost with hollow eyes, ragged trailing tail, faint green glow; [4] wail (mouth open), [5] solid/attack |
| `enemy_scarecrow` | 160 | hanged scarecrow ghoul on a gallows post, glowing green eyes; [4] arms up, [5] releasing crows |
| `enemy_crow` | 96 | small black crow, wings flap 0–3; [4]/[5] dive |
| `enemy_miner` | 160 | big slow zombie miner with helmet lamp & pickaxe; [4] pickaxe raised, [5] pickaxe slammed |
| `enemy_bat` | 96 | fangy cave bat, wings flap 0–3; [4]/[5] dive |
| `enemy_mole` | 128 | angry giant mole with claws; [0–3] surfaced idle/scurry, [4] burrowing (mostly a dirt mound with claws) , [5] erupting from ground with dirt spray |
| `enemy_coffin` | 160 | upright hopping coffin, lid ajar with glowing green eyes inside and hand-claws; [0–3] hop cycle (crouch, up, air, land), [4] crouch, [5] bursting open |
Cursed variants: code-tinted red (no extra art).

### Bosses — frame **320×320**, anchor bottom. `_idle` = 4 frames loop; `_atk` = 4 frames (poses listed). `portrait_*` single image 512×512 (transparent, bust/half-figure, dramatic, for boss-intro card).
| key | frames | notes |
|---|---|---|
| `boss_cascabel_idle` / `boss_cascabel_atk` / `portrait_cascabel` | 4 / 4 | colossal demonic rattlesnake, coiled, swaying head, glowing green eyes, huge rattle tail, cracked horns & skull-like markings. atk: [0] rears + venom windup, [1] spits, [2] tail-shake rattle (blur lines), [3] diving into ground (head down, dirt) |
| `boss_grimm_idle` / `boss_grimm_atk` / `portrait_grimm` | 4 / 4 | Marshal Grimm: skeletal lawman, long duster, tin star, big hat, twin revolvers, noose around neck/lasso at hip. atk: [0] quick-draw pointing gun, [1] muzzle-flash firing, [2] throwing noose lasso, [3] slamming/tossing dynamite |
| `boss_undertaker_idle` / `boss_undertaker_atk` / `portrait_undertaker` | 4 / 4 | The Undertaker: gaunt, towering, top hat, black frock coat, coffin strapped on back, shovel in hand, sunken glowing green eyes. atk: [0] shovel raised, [1] shovel slam, [2] arms spread (coffins open), [3] coffin-lid shield held in front |
| `portrait_player` | 1 | 512×512 bust of the gunslinger for death/menu |

## World (all frame counts as given)
### Room backgrounds — *opaque* single images **1440×864** (`images/`), top-down 3/4 view of an EMPTY room: solid wall band 96 px on left/right and 96 px on top/bottom (the playable floor is the inner 1248×672), NO doorways (door sprites are overlaid by code), no obstacles/props/characters on the floor, floor readable & not too busy (gameplay sprites + bullets must stand out), a subtly darker vignette at edges. Keys: `bg_f1_a`, `bg_f1_b`, `bg_f1_boss` (F1 canyon trail: packed dirt, canyon rock walls, scattered bones), `bg_f2_a`, `bg_f2_b`, `bg_f2_boss` (F2 abandoned saloon/street: worn plank floor, wooden wall panels, amber lantern light; boss = gallows-courtyard with blood-stained boards), `bg_f3_a`, `bg_f3_b`, `bg_f3_boss` (F3 mine: dark rock floor, mine-cart rails, timber supports on walls, green glow; boss = graveyard crypt chamber with coffin niches), `bg_shop` (peddler's wagon-lit room, warm, rug), `bg_treasure` (golden-lit stone/wood chamber with a dais). Boss variants are darker/redder & more ominous.
### Doors — `doors` grid **3×2, frame 192×128** (order row-major): `door_open`, `door_closed`, `door_treasure_open`, `door_treasure_locked` (gold, chained, keyhole), `door_boss_open`, `door_boss_closed` (skull + red glow). Drawn for a door in the TOP wall seen from inside: the frame is 192 wide (96 opening + jamb), the lower 32 px protrude into the room; code rotates 90/180/270° for other walls. Names in meta.
### Obstacles — per floor grid **4×2, frame 96×96**, anchor bottom: `obst_f1`, `obst_f2`, `obst_f3`, names order: `block_a`, `block_b`, `breakable`, `breakable_broken`, `pit`, `spikes`, `decor_a`, `decor_b`. (F1: boulders, barrel/crate, sinkhole/canyon crack, bone-spike thorns, cattle skull & cactus. F2: stacked crates/overturned table, barrel, floor hole w/ splintered boards, nail-board trap, tombstone/chair. F3: rock pile, mine crate/ore bucket, bottomless shaft, stalagmite spikes, skull pile & lantern.) `pit` fills the 96×96 tile top-down (dark hole, edges visible), `decor` = non-colliding floor decoration.
### Pickups — `pickups` grid **5×2, frame 64×64**, order: `heart_full`, `heart_half`, `heart_tin`, `coin`, `coin_nickel`, `key`, `dynamite`, `chest_wood`, `chest_gold`, `chest_open`.
### Props — `props` grid **3×2, frame 128×128**: `pedestal` (stone/wood altar dais, empty top), `pedestal_shop` (same with price plate), `trapdoor_closed`, `trapdoor_open` (hole down + ladder), `peddler` (one-eyed skeleton merchant with hat, behind a stall/wagon), `tombstone_marker` (spare / floor-clear marker).
### Items — grids **frame 96×96**, each icon centred on its own, drawn as a chunky collectable object with strong silhouette: `items_passive_a` (4×2): `spurs`, `lucky_horseshoe`, `hollow_point`, `speed_loader`, `long_barrel`, `sawed_off`, `ricochet`, `dead_eye`. `items_passive_b` (4×2): `bandolier`, `snake_oil`, `tin_star`, `liquid_courage`, `cursed_coin`, `rattler_fang`, `silver_bullets`, `dynamite_vest`. `items_passive_c` (4×2): `spirit_lantern`, `crow_companion`, `voodoo_doll`, `duster_coat`, `prospectors_pan`, `hex_bag`, `fan_the_hammer`, `mezcal_worm`. `items_active` (4×1): `whiskey_bottle`, `pocket_watch`, `powder_keg`, `lucky_deck`. (Descriptions in GAME_DESIGN.md → Items.)
### Projectiles — `projectiles` grid **4×2, frame 48×48**, anchor center; elongated ones point RIGHT (→): `bullet_player` (pale brass slug, white glow), `bullet_crit` (bigger, gold with orange trail — the Sixth Bullet), `bullet_enemy` (red-orange ember ball, dark outline), `bullet_venom` (toxic green blob), `bullet_nail` (rusty coffin nail/bone shard →), `bullet_ghostfire` (cold green-blue flame), `dynamite_stick` (thrown stick →), `rock_debris` (chunk of rock).
### FX — strips, anchor center, `fx_explosion` 6f **192×192** (fiery dynamite blast w/ smoke), `fx_muzzle` 4f **96×96** (muzzle flash pointing right, origin at left-centre), `fx_impact` 4f **64×64** (bullet hit spark/puff), `fx_death_puff` 5f **128×128** (dust/smoke poof with bone/blood flecks), `fx_dust` 4f **64×64** (footstep/roll dust), `fx_spawn` 5f **128×128** (enemy-spawn telegraph: swirling dust ring w/ faint red glow), `fx_blood` grid 4×1 **128×128** (floor blood splat decals, dark red, ink-styled), `dynamite_placed` 3f **64×64** (lit dynamite bundle with sparking fuse, anchor bottom).
### HUD/UI
- `hud_icons` grid **5×2, 64×64**: `heart_full`, `heart_half`, `heart_empty`, `tin_full`, `tin_half`, `coin`, `key`, `dynamite`, `bullet_full` (brass round in cylinder slot), `bullet_empty`.
- Images (`images/`): `title_logo` (transparent, ~1024×400: the words "DEAD WEST" verbatim, chunky woodcut western lettering, blood/bone accents, maybe a noose/bullet holes), `title_bg` (*opaque* 1440×960: ghost-town silhouette under a blood-red dusk sky, lone gunslinger silhouette, vignette; leave centre-left clear for menu text), `ui_parchment` (transparent ~1200×760 aged parchment "wanted poster" panel with torn edges & dark border; centre empty for text), `ui_cursor` (64×64 crosshair / revolver sight, transparent).

## Audio (`public/assets/audio/`) — mp3 or ogg (both fine; prefer ogg/mp3 ≤ ~500 KB for SFX, music loops ≤ 3 MB). Any source allowed for now (licensing handled later) but **log every file's source URL in `public/assets/audio/CREDITS_<name>.md` and in the `.audio.json`**.
Each audio agent writes its own metadata file `public/assets/audio/<name>.audio.json` (e.g. `sfx.audio.json`, `music.audio.json`; tools/build_manifest.py merges all `*.audio.json`) = `{ "<key>": {"file":"sfx/shoot.mp3","type":"sfx","volume":0.6,"loop":false,"source":"<url>","license":"<as found>"}, … }` (`file` relative to `public/assets/audio/`).
SFX keys (variants welcome as `<key>_2`, `<key>_3`; the game picks randomly among `<key>`, `<key>_2`… ): `shoot`, `shoot_crit` (the Sixth Bullet), `bullet_hit_wall`, `enemy_hit`, `enemy_die`, `player_hurt`, `player_die`, `pickup_coin`, `pickup_heart`, `pickup_key`, `pickup_dynamite`, `item_get` (jingle), `door_open`, `door_close`, `door_locked` (rattle/no), `door_unlock`, `room_clear` (chime), `explosion`, `fuse` (loopable hiss), `dodge_roll`, `boss_intro` (sting), `boss_die`, `boss_hit`, `snake_rattle`, `snake_hiss`, `coyote_howl`, `buzzard_screech`, `ghost_wail`, `crow_caw`, `bat_screech`, `skeleton_rattle`, `zombie_groan`, `dig` (dirt burst), `coffin_open` (creak/thump), `lasso_swish`, `whip_crack`, `gun_cock` (revolver click), `trapdoor`, `shop_buy`, `shop_deny`, `menu_move`, `menu_select`, `pause`, `heartbeat` (low-health loop), `step_wood`/`step_dirt` (optional), `spawn` (enemy telegraph whoosh), `sixth_bullet_ready` (cylinder-click when 5 shots fired, optional).
Music keys (loops, dark western): `mus_menu`, `mus_floor1`, `mus_floor2`, `mus_floor3`, `mus_boss` (bosses 1–2), `mus_boss_final`, `mus_shop` (short/quiet loop), plus stings `mus_death`, `mus_victory` (loop:false). Ambience optional: `amb_wind` (loop), `amb_cave` (loop).
