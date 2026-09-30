# DEAD WEST - Architecture

Phaser 3.90 + Vite 7, vanilla ES modules. Logical canvas 1440x960 (`Scale.FIT`, `CENTER_BOTH`). Gameplay does not use arcade physics bodies: collision is custom (circle vs AABB) so behaviour is deterministic. Setup, controls, URL flags and npm scripts are in `../README.md`; what is done / known issues / next steps is in `STATUS.md`; design intent is in `GAME_DESIGN.md`.

Checks: `npm run selftest` (templates + floorgen), `npm run test:floorgen`, `npm run smoke`, `npm run test:prod`. URL flags: `?seed=N`, `?debug=1`, `?selftest=1`, `?noassets=1`, `?dropassets=N`.

## File map

| Path | Purpose |
|---|---|
| `src/main.js` | Phaser config, `window.__game`, `?selftest=1` hook |
| `src/config.js` | ALL tunables: W/H, ROOM rect, DOORS geometry, DEPTH layers, FLOORS, PLAYER_BASE stats, GRID/FLOOR_GEN, ENEMY_DEFAULTS, ROOM_REWARD, SPAWN_SAFE_DIST, COLORS/CSS/fonts |
| `src/core/rng.js` | mulberry32: `rng.game` stream, `floorRng(floor)`, `initSeed()`, `getSeed()`, `fork()` |
| `src/core/events.js` | `bus` event bus (`bus.scoped(scene, evt, fn)` auto-cleanup); event list in the file header |
| `src/core/Assets.js` | manifest loading, placeholder generation, grid-atlas name lookup, sprite/cell/image factories |
| `src/core/Audio*.js`, `mix.js`, `mixLevels.js` | `Sfx`/`Music`/`Ambience`, `AudioDirector` (what plays when), `AudioHooks` (`EVENT_SFX`), `AudioLoader` (lazy music), mixer table + generated per-file levels |
| `src/core/Input.js` | `GameInput` (WASD, arrows/mouse, action queue, `override` for automation) |
| `src/core/RunState.js`, `Save.js`, `util.js`, `Debug.js` | run stats, localStorage (`deadwest.save.v1`), helpers, debug/automation API |
| `src/gen/` | `FloorGen.js` (floor graph), `Templates.js` (parser + validator), `templates/*.js` (ASCII rooms), `templateCheck.mjs`, `selftest.mjs` |
| `src/rooms/` | `Room.js` (one live room), `RoomManager.js` (floors, transitions), `Door.js` |
| `src/entities/` | `Actor`, `Player`, `Dynamite`, `Pickup`, `Pedestal`, `Chest`, `Trapdoor`, `Shop` |
| `src/enemies/` | `registry.js` (`ENEMY_META`), `Enemy.js` (base), `Grunt.js` (fallback), `types/*.js` (auto-registered), `f3fx.js` (dark-floor telegraph helpers), `index.js` (`spawnEnemy`) |
| `src/bosses/` | `registry.js` (`BOSS_META`), `Boss.js` (phases + generator attacks), `types/*.js`, `index.js` (`spawnBoss`) |
| `src/items/` | `registry.js` (`registerItem`), `defs/*.js` (28, auto-registered), `ItemSystem.js` (pools, pickup), `familiars/*`, `fx/BulletTime.js` |
| `src/systems/` | `Bullets.js` (pools), `Explosions.js`, `Fx.js` (particles, shake, decals, warnings) |
| `src/scenes/` | Boot, Menu, Game, HUD (parallel overlay), Pause (overlay), End (death / chapter-complete), `finale.js` (title card) |
| `src/ui/` | HUD widgets (Hearts, Counters, Cylinder, ActiveSlot, BossBar, Minimap, Banner, Relics, Cursor, Cards, Vignette) + `UiKit.js`, `OptionsPanel.js` |
| `tools/` | asset pipeline (`sprites.py`, `optimize_assets.py`, `build_manifest.py`, `measure_audio.py`), `floorgen-test.mjs`, `zip-dist.mjs`, `qa/` (harness + scripts) |

## Coordinates and layers

* World == screen, camera at (0,0) except during room slides.
* Room interior rect: origin (96,192), size 1248x672 (13x7 tiles of 96 px). Room bg image is drawn at y=96 (1440x864). HUD occupies y < ~136.
* `ROOM.cx/cy` centre; `tileToWorld(c,r)` gives a tile centre. `DOORS[dir]` has `x,y,rot,dx,dy,tile,front,entry` (door centres sit in the wall band, e.g. left/right at x=64/1376). The player triggers a transition ~22 px beyond the interior edge in a doorway.
* Ground-plane logic: all collision uses ground positions (x,y). Bullets have a visual lift only.
* Depths (`DEPTH`): bg 0, decals 10, shadows 20, floor 30, pickups 40, actors 100 + `y*0.01` (`actorDepth(y)`), bullets 200, fx 300, overlay 400, ui 500.

## Assets

`Assets.queue(scene)` loads everything in `public/assets/manifest.json` (sprites, images, SFX; music/ambience are lazy, see Audio). Anything missing or failed gets a generated placeholder, so the game always runs (`?noassets=1` proves it).
* `Assets.makeSprite(scene, x, y, key, frame)` - animated/static sprite with anchor + scale from the manifest. `Assets.makeCell(scene, x, y, sheet, name, originY)` - one named cell of a grid atlas (`Assets.frame(sheet, name)` gives the index). `Assets.makeImage`, `Assets.ensureAnim(scene, key, {start,end,fps,repeat,name})`, `Assets.has(key)`, `Assets.hasAudio(key)`.
* Sprite sheets: strip (N frames in a row) or grid with `names[]`. Enemy convention: 6 frames - 0-3 move/idle loop, 4 windup/telegraph pose, 5 attack pose (hurt = white tint, death = `fx_death_puff`). Use `setPose('move'|'windup'|'attack')`. Full key/size contract: `ASSET_SPEC.md`; style: `ART_BIBLE.md`.
* Cache busting: `manifest.json` carries a content-hash `version` (written by `tools/build_manifest.py`); every asset URL gets `?v=<version>` and the manifest itself is fetched with `no-store`. Bundles are hashed by Vite.
* `tools/optimize_assets.py` (idempotent; re-run after new art, then `build_manifest.py`): opaque images >= 512 px -> WebP q90, other PNGs -> pngquant palette PNG, music -> 96 kbps mp3. Originals stay in `art/originals/`. `vite build` strips `*.preview.png`, `*.meta.json`, `*.image.json`, `*.audio.json` from `dist/assets` (the game reads `manifest.json` only).
* Load size: ~9 MB blocking at boot (sprites, WebP backgrounds, SFX) + music streamed on demand (~8 MB over a full 3-floor run). Boot has a two-phase load (title art first, then `Assets.queue`) with an eased bar. Hidden/background tabs load slowly because browsers throttle timers.

## Game model

### Stats contract (Player)
`player.stats` is rebuilt by `recomputeStats()`: start from `PLAYER_BASE`, then for every owned item call `def.apply(player, {stats, count, scene, player})` once per copy, then `def.applyLate` (hp-dependent items, after all normal `apply`), then active buffs. `apply` must be pure (only mutate `stats`). One-shot effects go in `def.onPickup`. Never write `player.stats` elsewhere; use `addItem`, `addBuff(id, applyFn, seconds)`.

Key stats: damage, fireDelay, range (bullet life s), shotSpeed, moveSpeed, luck, maxHearts, bulletCount, spreadDeg, inaccuracy, bulletSize, pierce, ricochet, homing, poison, burn, fearChance, sixthEvery/sixthMult/sixthPierce, deadEye, rollCooldown/Duration/Distance, dynamiteRadius/Damage/Fuse, explosionImmune, dynamiteVestChance, coinMult, shopDiscount, roomClearCoins, roomClearKeyChance, undeadDamageMult, roomShield, bulletDamageMult, contactDamageTaken.

Player API: `damage(units, source)`, `heal(units)`, `addTin(units)`, `collect(type)`, `addItem(id)`, `removeItem`, `hasItem`, `addBuff`, `addFamiliar(f)` (familiars get `update(dt, player)`), `addCharge(n)`, `useActive()`, `startRoll`, `fire(aim)`, `placeDynamite()`, `teleport`, `setEntryInvuln`, `godMode`. HP is in half-heart units (`hp`, `maxHp`, `tin`). Flags consumed by shared code (all additive): `Player.fire` (luck crit = luck*3% for x1.5, dead-eye, colour-coded poison/burn/fear bullets), `Enemy.takeHit` (`UNDEAD_IDS` for silver bullets; bosses ignore fear), `Player.damage` (roomShield, dynamite vest, explosionImmune), `Room.clearRoom` (roomClearCoins/KeyChance), `Player.price` (shopDiscount), `Player.collect` (coinMult).

### Events (bus)
Full list with payloads at the top of `src/core/events.js`. Main ones: `player:fired/hurt/healed/rolled/died/stats`, `enemy:spawned/hit/died`, `room:entered/locked/cleared/transition`, `boss:intro/spawned/hp/phase/defeated`, `item:picked`, `pickup:collected/denied`, `shop:bought`, `floor:changed/intro`, `run:ended`, `active:changed`, `dynamite:placed`, `explosion`, `hud:flash`, `ui:toast`; audio loader: `audio:loading/loaded/failed`. Subscribe in scenes with `bus.scoped(this, 'evt', fn)`.

### Floor flow
`GameScene.create` -> `RoomManager.loadFloor(n)` -> `generateFloor(n, seed)` (tree on a 9x8 grid: start, normals, treasure, shop, boss, optional secret) -> `jump(startId)`. Doors trigger `RoomManager.transition(dir)` (RenderTexture snapshot slide, 380 ms; if the snapshot fails it falls back to a cut). Room state persists in `RoomManager.states[id]` (cleared, pickups, pedestals, decals, broken tiles). Boss death spawns a trapdoor; stepping on it calls `RoomManager.descend()` -> next floor. The floor 3 boss death runs `scenes/finale.js` then `endRun('complete')`.
* The floor has `keyRoomId`: a normal room on/before the boss path that always drops a key, so the locked treasure door is always openable (`validateFloor` checks it).
* `RoomManager.mapVer` + `touchMap()`: bump whenever map knowledge changes (door reveal, jump, transition); the Minimap redraws only when floor/currentId/mapVer change.

### Level content (templates, difficulty, rewards)
* `src/gen/templates/floor1|2|3.js`: 16 normal templates per floor (`tier` 1..3 difficulty bucket; `waves` list = reading order of that digit's slots; `air: {digit: [[c,r,'buzzard']]}` = flyers that may hover over pits). `special.js`: start, treasure (5), shop (3), secret (3), one boss room per floor. 65 templates total.
* `Templates.pick(floor, kind, rng, {want, used})`: FloorGen passes the desired tier (ramps with distance from start; boss-adjacent rooms = tier 3) and a used-count map (repeats down-weighted).
* Fairness: `Room.safeSpawns()` relocates any spawn closer than `SPAWN_SAFE_DIST` (300 px) to the player / entry door to the nearest free tile; templates keep >= wave-size + 3 safe tiles per entry door.
* Pits: adjacent `P` tiles are drawn as one merged hole (`Room.mergePits`), single pits use the sprite.
* Rewards: `ROOM_REWARD` (drop chance, +luck, +tier bonus, dry-streak pity, breakable drop chance); elites use `ENEMY_DEFAULTS.cursedChance` (8 %).

### Engine notes
* Bullets: `kill()` marks inactive and leaves the bullet in `list`; compaction at the end of `update` moves it to `free`. `clear()` (room change) skips `onDeath` and refills `free`. Never push to `free` elsewhere.
* Fx pools sprites per key (cap 24) and caches particle emitters per config (cap 48); `fx.clear()` resets both.
* Scene instances are reused by Phaser: per-visit flags must be reset in `init`/`create` (see `EndScene.leaving`, `MenuScene.starting`).
* `GameScene` auto-pauses on window blur (removed in shutdown); pause is ignored when ended/dead.
* Actor `moveBy` sub-steps (<= max(8, 0.8*radius) px, up to 8 steps) so fast movement / roll cannot tunnel walls.
* Phaser tweens are driven by wall-clock time, not by `game.step` deltas (matters for fast-forward tests).

## Content

### Add an enemy
1. Copy `src/enemies/types/outlaw.js` to `types/<id>.js`; `extends Enemy`; override `init(opts)`, `ai(dt)`, optionally `onHit`, `onDeath`, `onWallHit`, `damageMultiplier`.
2. End the file with `registerEnemy('<id>', Class, { ...metaOverrides })`. It is auto-imported by `import.meta.glob`.
3. `ENEMY_META[id]` in `registry.js` has hp/floors/radius/speed/weight (floors lists control random room fill). An id without a class spawns as `Grunt` (chase + contact damage).
4. Helpers on Enemy: `moveToward`, `steerToward`, `keepDistance`, `moveAngle`, `stop`, `faceToward`, `after(sec, fn)`, `telegraph(sec, fn)`, `shoot(angle, opts)`, `setPose`, `applyStatus`, `dropLoot`, `distToPlayer`, `angleToPlayer`, `this.scene.bullets.enemy.{fan,ring,aimed,spiral}`.
5. Room templates place them with ASCII markers; `E` = random enemy for the floor.

Implemented (16): F1 `coyote`, `rattlesnake`, `tumbleweed` (+`tumbleweed_mini`), `outlaw`, `buzzard`; F2 `possessed`, `skeleton`, `dynamiter`, `ghost`, `scarecrow` (+`crow`); F3 `miner`, `bat`, `mole`, `coffin`. Each file has a behaviour summary at the top. Shared conventions: small state machines (`setState`), telegraphs via `fx.warnLine/warnCircle` + windup pose + sfx, aim locked at telegraph start (sidestep = dodge), charge/swoop velocities re-applied every frame in `ai()` so stun/fear cannot stall them.
* F2: possessed enrages < 50 % HP; skeleton fires spinning 4-bullet crosses; dynamiter lobs `LobbedDynamite` (subclass of `entities/Dynamite`, harmless to enemies); ghost phase-cycles (invulnerable while faded), `spawnEnemy(scene,'ghost',x,y,{deputy:true})` makes the boss-add "ghost deputy" (default inside boss rooms; `deputy:false` opts out); scarecrow spawns crows (caps 4 per scarecrow / 8 per room).
* F3: miner takes x0.6 from the front cone (`damageMultiplier`; explosions ignore it); bat staggered dives (`scene._batNext`); mole burrow states `surface -> dive -> under -> lock -> stun`, untargetable underground; coffin hops with landing shockwave and releases 2 bats on death unless `die({silent:true})`. `f3fx.js`: `darkWarn`/`darkLine` (warnings boosted with additive glow for near-black floors), `shockRing`.

### Add a boss
Copy `bosses/types/cascabel.js`. `extends Boss`; in `setup()` call `this.addAttack(name, generatorFn, {weight, minPhase, maxPhase})` and set `this.phases = [{at: 0.5, name, enter() {...}}]`. Attack functions are generators: `yield seconds` to wait. Helpers: `pulse`, `atkFrame(i)`, `setPose`, `spawnAdds(id, n, {radius})`. End with `registerBoss('<id>', Class, meta)`. `BOSS_META` holds name/title/hp/portrait/music (a generic `Boss` is used when no class exists).
* **El Cascabel** (`cascabel.js`): venomFan (aim line locks 0.28 s before the 5/7-shot fan), rattleRing (0.9 s tail shake + warn disc, 12-bullet ring), burrowDive (invulnerable mound chases, locks onto a red disc for 0.9 s, pops up = 1 dmg + shove, ~1 s vulnerable). Phase 2 < 50 %: roar, clears bullets, 3 `rattlesnake`, shorter delays. Uses `ai()`/`startAttack()` overrides and `cancelAttack()`; DoT is ignored while invulnerable.
* **Marshal Grimm** (`grimm.js`): quickDraw (aim line locks 0.2 s before 3-shot volleys), lasso (locked band -> noose -> `player.locked` pull, then 0.5 s slam ring, 2 dmg; released on cancel/death), dynamite volley (ring around player, 1.6 s marked), spin (phase 2+), summon (2 ghosts). Phase 2 < 60 % (roar + 2 ghost deputies), phase 3 < 25 % (enrage: faster, dual-hand bursts). Takes 0.85x damage.
* **The Undertaker** (`undertaker.js`): 3 phases (shovel slam + rocks, nail fans, coffin adds, burrow spike grid, lid shield with facing-based block, charge, ghostfire spiral). Death: slow-mo + explosion chain -> `Boss.finishDeath` -> `GameScene.onBossDefeated` -> `scenes/finale.js` -> `endRun('complete')` (chapter-complete poster).

### Add an item
`src/items/defs/<id>.js`:
```js
registerItem({ id, name, desc, type: 'passive'|'active', pool: ['treasure','shop','boss','secret'], weight: 1,
  icon: { sheet: 'items_passive_a', name: id },
  apply(player, { stats, count }) { stats.damage += 1; },   // pure
  onPickup(player, api) {},                                 // optional one-shot
  charges: 3, use(player, api) {} });                       // actives (return false to cancel)
```
Auto-registered by glob. `scene.items.roll(pool)` never repeats an item within a run and falls back to the other pools when the requested one is exhausted (`null` = everything taken; callers drop consumables). `scene.items.pickup()` plays the "hold it up" flourish; the HUD banner + `item_get` jingle come from `item:picked`. `player.items` (passive ids, pickup order) and `player.active` are the stable read-only views for the HUD.
* Familiars (`items/familiars/*`, base `Familiar`: display objects excluded from room snapshots via `own()`, fade+destroy on `player:died`, snap to the player after a slide): `SpiritLantern` (orbit, blocks bullets, 6 dps + ignite), `CrowCompanion` (0.5x bullets), `ShieldPip` (duster coat), `DeadEyeSight`. Bullet-time (pocket watch) is `items/fx/BulletTime.js` (`scene.enemyTimeScale`).
* Pedestal (`entities/Pedestal.js`): bobbing icon, ring, name tag on approach. Pick-one groups (F3 `treasure_two`, 25 %): taking one vanishes the other and releases its id back to the pool. Swapping actives leaves the old active on the pedestal.

### Add / edit room templates
ASCII 13x7 in `src/gen/templates/*.js`, `{id, kind, floors, weight, tier, layout:[7 strings], waves:{1:[ids],2:[...]}, air, boss}`. Chars: `.` floor, `R` rock, `P` pit, `S` spikes, `B` breakable, `d` decor, `D` reserved door spot, `1-9` enemy spawn slot (digit = wave; ids come from `waves`), `E` random-enemy slot, `X` no-spawn marker, `I` item pedestal, `H` shop slot, `K` shopkeeper, `C` chest/pickup spot (see `Templates.js` header). `validateTemplate` checks size, chars, free door tiles, flood-fill reachability and special-room requirements; run `npm run selftest` after edits (>= 6 normal templates per floor; content checks: counts per kind/floor, valid enemy ids, waves 1..3 x 2..5 enemies, boss centre free).

### Bullets, FX, audio calls
* `scene.bullets.player.fire({x,y,angle,speed,damage,life,pierce,ricochet,homing,poison,burn,fear,spectral,size,...})`, `scene.bullets.enemy.fire({... kind:'enemy'|'venom'|'nail'|'ghostfire'|'rock'|'stick', radius, accel, curve, onDeath, noObstacle, noWall})`. Enemy helpers: `fan`, `ring`, `aimed`, `spiral`. `clear()`, `clearRadius(x,y,r)`.
* `scene.fx`: `explosion`, `impact`, `muzzle`, `deathPuff`, `dust`, `spawn`, `decal`, `text`, `burst`, `trail`, `warnCircle`, `warnLine`, `shake(intensity, ms)`, `hitStop(ms)`, `flash(color, alpha)`, `clear()`. `scene.slowMo(scale, seconds)`.
* Audio: `Sfx.play('key', {vol, rate})`, `Music.play(key)`, `playMusicFor('floor1'|'boss'|'shop'|'death')`, `Audio.toggleMute()`; add event -> sound rows to `EVENT_SFX` in `AudioHooks.js`.

## Audio and loading pipeline
* **Mixing** (`core/mix.js`): `MIX[key] = {db, poly, group, gap, rand, duck, chain}`. `db` = target loudness (gated RMS dBFS); per-file levels (`mixLevels.js`, generated by `.venv-art/bin/python tools/measure_audio.py`, which also warns about silent/clipping/click-looping files) normalise every variant (`shoot`, `shoot_2`...) to it, so manifest `volume` is only a fallback. `opts.vol` in `Sfx.play` multiplies on top. `poly` caps voices per key/group, `gap` rate-limits, `rand` = random detune (cents), `duck: [level, seconds]` dips music+ambience under stingers, `chain` raises pitch on quick repeats (coins). Unknown keys get -27 dB. Sliders: `Save.vol('music'|'sfx')`.
* **Layers** (`Audio.js`): `Music` and `Ambience` are crossfading looped beds (pause duck via `Music.duck(v)`, low-pass "muffle" while paused or at <= 1 heart). `window.__dwAudio` / `Audio.debug()` give a snapshot for QA. Mute is an own flag persisted in `Save`; the autoplay lock is handled (beds start on the first key press).
* **Direction** (`AudioDirector.js`): floor tracks + ambience (wind F1/F2, cave F3), shop track, boss track (`mus_boss` F1-2, `mus_boss_final` F3), stingers, footsteps (wood on F2), "active ready" click.
* **Lazy audio** (`AudioLoader.js`): music (except `mus_death`/`mus_victory`) and `amb_*` are not in the Phaser loader; `AudioLoader.ensure(key)` fetches + decodes on demand, `prefetch()` queues low-priority loads (menu track after boot, floor-1 bed during the menu, shop track after a floor's track, boss + next-floor tracks when the boss room is adjacent). `Music.play()` on a not-yet-loaded key keeps the old bed until the new one is decoded. Boot progress: `game.events` `boot:progress` / `boot:done`.
* Licences of every audio file are logged in `public/assets/audio/CREDITS_*.md` (see README for the flagged entries).

## UI / UX
* `ui/UiKit.js`: `title()/body()` text styles, `parchment()` panel, `uiSfx`, `setOsCursor()`, `MenuList` (keyboard W/S/arrows/Enter + mouse for `button|toggle|slider` items; dedupes Phaser's re-dispatched keydown via `lastEvt`). `OptionsPanel` (music/SFX sliders, screenshake, fullscreen; persisted in `Save.settings()`) is shared by Menu and Pause; modal scenes should `setEnabled(false)` their list while a panel is open.
* HUD widgets (each `update(g)`): Hearts (wrap after 6), Counters, Cylinder, ActiveSlot, BossBar, Banner (queued pickup banners), Relics (passive strip + tooltip), Cursor (crosshair only with mouse aiming), Cards (floor + boss intro), Vignette (low health). `hud.beat` (0..1 heartbeat envelope, 0.885 s period = `heartbeat.mp3`) is set by Vignette and read by Hearts.
* End screen: wanted poster (death) / chapter-complete poster; cause of death from `player.killedBy`. Menu has Options, Bounty Board (persisted best stats) and Credits.

## Debug hooks (`?debug=1`)
Keys: F1 next floor, F2 heal, F3 random passive, F4 +99 coins/keys/dynamite, F5 kill all, F6 boss room, F7 god mode. `window.__game` is the Phaser game; `window.__dw` (installed per GameScene, also without `?debug=1`) = `{scene, api, player, room, floor, hud, menu}`. `__dw.api`: `killAll`, `teleport(roomId)`, `bossRoom`, `giveItem(id)`, `randomPassive`, `setFloor(n)`, `nextFloor`, `spawn(id,x,y,opts)`, `godMode`, `heal`, `hurt`, `give`, `input({move,aim,fire})` (automation override), `openAll`, `clearRoom`, `revealMap`, `die`, `state()`. Rooms can be entered directly with `scene.roomMgr.jump(id, viaDir)`.

## QA and production build
* **Harness** `tools/qa/harness.mjs` (puppeteer-core + system Chrome, real rAF): `const g = await launch({query:'?debug=1&seed=42'}); await g.startRun(); await g.eval(() => window.__dw.api.spawn('coyote', 700, 500)); await g.hold('KeyD', 500); await g.shot('name') /* -> art/qa/name.png */; g.errors; await g.close()`. Scene keys: `'Boot'`, `'Menu'`, `'Game'`, `'HUD'`, `'Pause'`, `'End'`. By default each `launch()` runs a private Vite server (random port, HMR + watch off, serves code as of launch time); `baseUrl` targets an existing server (e.g. `vite preview`), `QA_SHARED=1` uses the dev server on :5173, `QA_CHROME` overrides the Chrome path. Headless renders ~30 fps (software GL): use fixed-step simulation for long scenarios (zero `scene.fx.hitStopUntil`, drive `scene.update(now, 33.3)` or `game.step` with scenes hidden; see `fuzz-run.mjs`, `bot.mjs`, `boss-*-bot.mjs`).
* **Scripts**: `smoke`, `prod-check`, `fuzz-run`, `rb-fuzz`, `bot`/`bot-report`, `spec-*` (see `QA_SPEC_AUDIT.md`), `boss-{cascabel,grimm,undertaker}-bot`, `stress-{enemies,items}`, `regress-{items,levels,audio,ui}`, `screens` (headers explain arguments); table in README. Screenshots go to `art/qa/` (git-ignored); the curated set lives in `art/screens/`.
* **Build**: `vite build` -> `dist/` (~18 MB: 1.5 MB JS split into a 0.3 MB app chunk + a long-cacheable 1.2 MB `phaser` vendor chunk, 9.6 MB audio, 6.7 MB art). `base: './'` so it works in any folder; the build plugin in `vite.config.js` strips dev-only files. `npm run test:prod` verifies the built game from `vite preview` and from a nested folder; `npm run zip` makes `dead-west-web.zip` for itch.io.

## Game feel & combat juice
* Tunables: `FEEL` + `PLAYER.accel/friction` + `ENEMY_DEFAULTS.knockback` in `config.js` (lookahead px, player bullet visual scale/streak length, casings on/off, permanent vignette alpha, hit squash).
* `Fx` additions: `smoke`, `spark(x,y,angle,gold)`, `casing` (pooled ballistic brass shells, ticked by `fx.update(dt)` from `GameScene.update`), `dustRing`, `ringPulse`, `afterimage`, scorch texture `fx_scorch`, and `burst()` now accepts `tex:'glow'` (soft growing/fading puffs), `alpha:[a,b]`, `dir`+`spread` (directional; emitter is cached, angle re-set per call).
* Player bullets rotate with travel, are drawn 1.35x with an additive gradient streak (`fx_streak`, player pool only); Sixth Bullet = gold streak + ember trail (particles, no per-frame allocations).
* `Enemy.hitFeedback` (squash, sparks, blood specks; Sixth Bullet adds 35 ms hit-stop + kick); deaths add bone chips, killing-shot blood spray, bigger decals. Player: white hurt flash, roll afterimages, dodge-ready ring, heal sparkles. Doors: `Door.juice` (slam/swell + dust). Room clear: gold ring + faint flash. Dynamite: fuse spark + flickering light. Items: 0.34 s slow-mo beat on pickup. Rooms: `Room.buildLights` (F3 lantern green pulse, F2 warm flicker). Camera lookahead in `GameScene.updateCamera` (skipped during transitions/cutscenes).
* `hud:flash` colours now work (Vignette uses a white texture tinted red by default). Every shake honours the Screenshake setting.
* QA: the throw-away `feel-*` scripts were pruned; use `smoke.mjs`, `bot.mjs` (autoplay through all floors) and the fast-forward pattern in `fuzz-run.mjs` (note: Phaser tweens still run on real time, so wait real ms for tween-driven visuals).


## Round 2 (in progress)
DEAD WEST v2 (floors 4-6, 3 new riders, 46 items, events, meta, story) is planned in `docs/v2/`: `ARCH_V2.md` (engineering, ids, ownership), `WORK_PLAN.md` (workflows and jobs), `ASSET_SPEC_V2.md`, `AUDIO_SPEC_V2.md`, plus the designer docs. This file describes round 1 until QA-7 replaces this section with the final file map.

### Room / flow API notes (round 2)
- Room: `controller(role)` (special-room controller), `banner(text, {color, hold})`, `onMiniDefeated(mini)` (champion reward), `onBossDefeated(boss)` (reward + trapdoor floors 1-5 + gate), `onExplosion(x, y, r, o)` (fire patches for player blasts that can hurt their owner; `o.fire === false` opts out), `onWallHit(x, y)` (brittle secret doors), `rings` (HoldRings ticked by Room), `combatAge` (s since lock), `capEnemy` (per-room enemy cap). Tile flags: `barrel`, `grave`, `pipe`, `bb` (bullet-blocking).
- RoomManager: `reveal(ids)` / `revealKinds(kinds)` mark rooms as dowsed on the minimap (cleared on `loadFloor`); `descend()` emits `trapdoor:descend {x,y}` and waits for the HUD iris (`IRIS_MS`).
- Boss: `boss:intro` payload `ms` is authoritative (boss 2900, Scratch 4600, mini 1500); `boss:intro:skip` releases the freeze. `boss:defeated {boss,id,floor,fightTime,noHit}`; one phase per `advancePhase` call; `brng` = seeded AI stream.
- flow: `isContractGoal(scene)` / `endContract(scene, boss)` end a contract run at `run.maxFloor` with `run.goalReached` then `endRun('contract')`.
