# Open stubs and requests after Feature build (auto-extracted from agent reports)


## FEATURE FE-S1

- ~~STUB: Scratch final-boss halt is a stand-in page/sprite in ending.js until FE-B3 wires the real boss halt contract.~~ -- done by INT-2: scratch kneels when trueEligible; ending.js reuses the live sprite
- STUB: EndScene / Cards / BootScene do not yet consume the story data (text, epitaphs, tips); requests logged.
- STUB: Codex Reread button for cutscenes not wired (CodexScene owner).
- STUB: Non-debug intro shim on run:started not exercised in a live non-debug run (debug runs never emit it; game.story.runStart(true) covers debug).
- OPEN: [FE-S1] FE-S2 data API for story text consumers
- OPEN: [FE-S1] EndScene/Cards/BootScene consume data/story (Credits draws its own toast)
- OPEN: [FE-S1] CodexScene Reread button
- ~~OPEN: [FE-S1] FN-4 ITEM_LORE difference vs lore_items.js~~ -- done by INT-1: registry uses ITEM_LORE; defs synced
- OPEN: [FE-S1] FN-1 intro shim / runStart note
- OPEN: [FE-S1] FE-B3 scratch boss halt contract
- OPEN: [FE-S1] main.js needs no registration

## FEATURE FE-T1

- ~~OPEN: [FE-T1][FE-B2] SteamJets run in boss rooms; f5_boss has decor pipes T at (0,1),(12,1)~~ -- done by INT-2: SteamField is decor-only in boss rooms
- ~~OPEN: [FE-T1][FE-B2] f5_boss marker 1 at (7,1) FYI~~ -- done by INT-2: info
- OPEN: [FE-T1][FE-E2] eel bank-slot FYI
- OPEN: [FE-T1][FN-6] templateCheck.mjs lacks budget/quota checks

## FEATURE FE-T2

- STUB: Event and secret-variant controllers (events/*, SecretVariants) belong to FE-V1; templates provide the K/I/C slots, so those rooms show props and pedestals until the controllers land
- STUB: Not run: ?dropassets=40 boot and a 55 fps soak (headless swiftshader under a load average of ~60 gives 3-10 fps, so fps is not measurable here)
- OPEN: [FE-T2] [FE-V1] slot contract for event/crossroads/vault/secret templates (read room.tpl.slots)
- OPEN: [FE-T2] [FE-B3] f6_boss dealer slot at (6,2); roulette region cols 3-9 rows 2-4; boss must call Hazards.rouletteCall
- OPEN: [FE-T2] [FN-1] no validator change needed; quotas checked by tools/qa/templates-t2.mjs
- ~~OPEN: [FE-T2] [FN-2] chandelier impact + fire + shards is dense for tier 1-2 (bot died in f6_n04 and n05); consider softening~~ -- done by INT-2: Chandelier softened for tiers 1-2

## FEATURE FE-B1

- ~~STUB: Ember bullet art: the `ember` kind falls back to the plain orange enemy bullet until FN-4 adds it (already requested by FE-B3)~~ -- done by INT-2: ENEMY_KINDS has ember and the rest
- ~~STUB: F4 trapdoor red tint (CHAPTER2 s6) not done; Trapdoor.js is FN-6's file~~ -- done by INT-2: Trapdoor F4 tint + glow landed
- STUB: No real-time >= 55 fps soak (machine too loaded); only sim-step cost was measured
- ~~OPEN: [FE-B1] [FN-4] Bullets.js: add `ember` enemy kind (bullet_ember, r 12, glow 0xff7a1f)~~ -- done by INT-2: ENEMY_KINDS has ember
- ~~OPEN: [FE-B1] [FN-6] Trapdoor.js: red tint of trapdoor_open on floor 4~~ -- done by INT-2: Trapdoor F4 tint + glow landed
- OPEN: [FE-B1] [FE-T1] f4_boss template landed and matches CHAPTER2; pillars must stay plain R tiles with a breakable_broken frame so Toro can shatter them
- ~~OPEN: [FE-B1] [FN-1] Boss.js: startAttack uses Math.random (Toro overrides it); a single hit crossing two phase thresholds runs both enter() callbacks (debug-only)~~ -- done by INT-2: Boss.brng seeded; advancePhase one phase per call

## FEATURE FE-B2 - Boss Engine No. 666 (engine)

- ~~STUB: Enemy bullet kinds coal and steam fall back to the plain 'enemy' bullet look (tint/radius/kind passed) until FN-4 adds ENEMY_KINDS; SFX steam_blast, coal_thud, signal_lamp_on fall back to existing sounds~~ -- done by INT-2: ENEMY_KINDS has coal/steam
- STUB: Boss barks (ALL ABOARD THE DEAD / FULL STEAM AHEAD) are only registry meta, the intro/HUD owner shows them
- STUB: Real-time >= 55 fps soak not verifiable here (headless software GL runs ~7 fps regardless of scene); logic cost is 0.11 ms/step
- ~~OPEN: [FE-B2] [FN-4] src/systems/Bullets.js: add ENEMY_KINDS coal (r 14, glow 0xff9a2a) and steam (r 15, glow 0xdde4e8)~~ -- done by INT-2: ENEMY_KINDS has coal/steam
- OPEN: [FE-B2] [integrator] src/core/Assets.js: move boss_engine_idle/_atk/_run SPEC rows into SPEC proper (engineArt.js mutates SPEC meanwhile)
- OPEN: [FE-B2] [FE-S2] audio: steam_blast, coal_thud, signal_lamp_on sfx; boss barks for the intro/HUD
- OPEN: [FE-B2] [FE-T1] floor5 boss arena: keep rows 3 and 5 obstacle-free (safe strips) and spawn marker near (6,2); engine paints rails itself when the template has none
- OPEN: [FE-B2] [FN-6] src/bosses/Boss.js FYI: finishDeath ignores info and die() does not emit boss:hp 0; engine handles both itself

## FEATURE FE-B3 Ol' Scratch (floor 6 final boss)

- ~~STUB: Intro card stays 2.1 s until FN-1 honours data.ms (Scratch sends 4600)~~ -- done by INT-2: GameScene honours data.ms
- STUB: Dead Man's Hand card slam is data only (payload data.slam); Cards has to render it
- ~~STUB: Card / chip / shard / ember / spade bullets use the plain enemy bullet look until Bullets adds the kinds~~ -- done by INT-2: ENEMY_KINDS has them
- ~~STUB: Boss.setPose / atkFrame formKey handled by local overrides in scratch.js until Boss honours formKey~~ -- done by INT-2: Boss honours formKey
- ~~STUB: boss:defeated carries {boss, id, floor, fightTime}; noHit not tracked by the boss~~ -- done by INT-2: Boss emits noHit (Scratch's own emit still lacks it, logged)
- ~~OPEN: [FN-1] Boss.js: honour this.formKey in setPose/atkFrame~~ -- done by INT-2: Boss honours formKey
- ~~OPEN: [FN-1] GameScene.beginBossIntro: use data.ms ?? default~~ -- done by INT-2: GameScene honours data.ms
- OPEN: [FE-S2] Cards.js: render boss:intro data.slam (Dead Man's Hand)
- ~~OPEN: [FN-4] Bullets.js: add card/chip/shard/ember/spade enemy bullet kinds~~ -- done by INT-2: ENEMY_KINDS has them
- ~~OPEN: [FN-1] Boss.js finishDeath: boss:defeated {id, floor, fightTime, noHit}~~ -- done by INT-2: Boss emits noHit (Scratch logged)
- ~~OPEN: [FE-S1] ending.js: kneeling live Scratch handed off (alive, in scene.enemies, sprite intact); confirm scene shutdown cleans him up~~ -- done by INT-2: world-check/boss-scratch-bot run clean; scene shutdown destroys enemies normally
- OPEN: [CHAPTER2 designer] royal_flush P2 pattern and width 48 deviation

## FEATURE FE-E1: hellhound, hellsteer, cinder_skull

- ~~OPEN: [FE-E1] [FN-4] src/systems/Bullets.js: add an `ember` entry to ENEMY_KINDS (projectiles_c2 bullet_ember). Until then the fan uses the plain enemy frame tinted orange 0xffa040.~~ -- done by INT-2: ENEMY_KINDS has ember

## FEATURE FE-E2

- OPEN: [from FE-E2] [to FE-A1] audio manifest: add lava_burst, holy_chime, mark_lock, bull_snort, fire_whoosh, vent_erupt aliases (code falls back to existing keys until then)
- ~~OPEN: [from FE-E2] [to FN-4] bullets: add a 'kind: ember' bullet look (currently falls back to the plain enemy bullet)~~ -- done by INT-2: ENEMY_KINDS has ember
- OPEN: [from FE-E2] [to FN-1/FE-T1] templates: magma_eel needs connected lava tiles (f4_n07, f4_n11, f4_n13 have them); with no lava it degrades to a stationary spitter

## FEATURE FE-E3 handcar_bandit, signalman, steam_stoker

- ~~STUB: The 'spike' bullet kind falls back to the plain enemy bullet look until Bullets.js gets it (FN-4 request).~~ -- done by INT-1: Bullets.ENEMY_KINDS has spike (and ember coal steam card chip shard spade) with projectiles_c2 art and tinted base-sheet fallbacks
- ~~STUB: The cap of 2 signalmen per room is not enforced in the enemy; it is a wave-building rule (FN-6 request).~~ -- done by INT-2: Room.capEnemy enforces it
- ~~OPEN: [FE-E3] [FN-4] src/systems/Bullets.js: add the enemy bullet kind 'spike'.~~ -- done by INT-1: done: spike kind
- ~~OPEN: [FE-E3] [FN-6] src/rooms/Room.js: cap signalman at 2 per room in wave building / random E fill.~~ -- done by INT-2: Room.capEnemy
- OPEN: [FE-E3] [FN-2] info only, no action needed.

## FEATURE FE-E4

- ~~OPEN: [FE-E4] [FN-6] src/rooms/Room.js nextWave: skip the spawn puff and spawn:telegraph for records whose enemyMeta(id).ambush is set (crate_mimic sets ambush: true). Without it the puff gives the disguise away; cosmetic only.~~ -- done by INT-2: ambush spawn is instant, no puff
- OPEN: [FE-E4] [FE-T1] src/gen/templates/floor5.js: rail_rat packs of 5 slots near room edges; crate_mimic at least 3 tiles from doors and beside real cover; chain_gang slot needs about 3 free tiles from the slot toward the room centre (links stack and unfurl if boxed in).

## FEATURE FE-E5

- ~~STUB: card and chip bullets render as the plain enemy slug until FN-4 adds the kinds (hitboxes already correct via explicit radius)~~ -- done by INT-1: done: card and chip kinds with projectiles_c2 art
- STUB: The >=55 fps bar could not be measured: headless harness ran at 2-6 fps under heavy machine load; only sim CPU cost (~1.46 ms/step for 11 enemies) was verified
- ~~OPEN: [FE-E5] [FN-4] src/systems/Bullets.js: ENEMY_KINDS needs `card` (r 12, rotate true, glow 0xffffff, frame bullet_card) and `chip` (r 13, rotate false, glow 0xe8dcc0, frame bullet_chip) from the projectiles_c2 sheet; enemy pool hard-codes the 'projectiles' texture so a per-kind sheet is needed~~ -- done by INT-1: done: card and chip kinds, per-kind sheet

## FEATURE FE-E6: waiter_imp, bouncer, joker (CHAPTER2 s5)

- ~~OPEN: [FE-E6] [FN-4] src/systems/Bullets.js: add the `shard` enemy bullet kind. FN-2 already asked for it; bottles and jack-box confetti use it and fall back to the plain enemy look until it exists.~~ -- done by INT-1: done: shard kind
- OPEN: Design interpretations (please confirm or tell me to change): (1) the jack-in-the-box drops beside the player (40-80 px) when the joker reappears, not under the joker. The doc text is ambiguous, and a box 260+ px from the player could never threaten anyone. (2) The bouncer's shoulder throw is a 520 px/s impulse (~58 px), because the doc's 200 px/s is weaker than the engine's built-in 340 px/s hit knockback.
- OPEN: Environment: another agent runs `pkill -f dw-qa`, which kills every agent's headless Chrome mid-test. Several of my runs died with 'Target closed' and had to be retried.

## FEATURE FE-M1 - Mini-bosses (6): ol_fury hangman motherlode ash_deacon stoker head_bouncer

- STUB: No stubs remain (head_bouncer.js and the other five FN-1 stubs are replaced).
- STUB: Audio: chain_whirl, censer_swing and rock_crumble sound keys are not defined, so lasso_swish (rate 0.5-0.7) and bullet_hit_wall stand in until FE-A1 adds aliases.
- STUB: The 'foot' sprite offsets (30/26/34/22/30/30) are visually tuned but not pixel-checked against every frame.
- OPEN: [FE-M1] [FN-1] src/bosses/parts/MiniBase.js added (shared kit; no change needed from FN-1, keep MiniBoss.roar/setup/finishDeath/hitsTaken signatures).
- OPEN: [FE-M1] [FE-A1] AudioAliases: add chain_whirl, censer_swing, rock_crumble (fallbacks in place).
- OPEN: [FE-M1] [FE-E*] enemy_<mini> strips: 6 frames (0-3 idle, 4 wind-up, 5 attack); foot offsets registered per mini; adjust in the type files if the art is re-cut.
- OPEN: [FE-M1] [FN-6] Room.onMiniDefeated works as documented (also kills remaining phase-2 adds).

## FEATURE FE-V1

- STUB: The >= 55 fps soak could not be verified: headless Chrome with swiftshader runs at about 20 fps on this machine (smoke also reports 19.5), so only 0-error and pooled-object review were done
- OPEN: [FN-6] Room.js's eager glob of SecretVariants.js must keep loading so the shop hint listener registers
- OPEN: [FE-T1] quick_draw template FYI
- ~~OPEN: [FN-4] quick-draw window is judged on bullet fire time~~ -- done by INT-1: info; no engine change needed
- OPEN: [FE-A1] list of Sfx keys used by FE-V1, plus a note that QuickDraw now emits duel:start / duel:end

## FEATURE FE-I1


## FEATURE FE-I2

- ~~STUB: dowsing_rod reveal is a local shim (discoveredRooms wrapper) until native support lands~~ -- done by INT-2: RoomManager.reveal/revealKinds + dowsed minimap landed; def can switch
- ~~STUB: ten_gauge_hammer centre-slug 0.6x is a local sixthFired hook until Player.fire does it~~ -- done by INT-1: done: native in Player.fire, shim removed
- ~~OPEN: [FE-I2] [FN-1] RoomManager/Minimap: native revealed-rooms set for dowsing_rod (currently a discoveredRooms wrapper shim)~~ -- done by INT-2: RoomManager.revealed landed
- ~~OPEN: [FE-I2] [FN-4] Player.fire: apply 0.6x to all 5 ten_gauge_hammer slugs when not orbiting, then drop the shim hook~~ -- done by INT-1: done: native in Player.fire
- ~~OPEN: [FE-I2] [FN-4] lit_cigar flight is 0.35 s in the engine versus 0.25 s in ITEMS_V2 4.5~~ -- done by INT-1: done: placeDynamite flight 0.25 s
- ~~OPEN: [FE-I2] [FN-4] hellfire blast excludes the primary victim (informational)~~ -- done by INT-1: by design (documented)
- ~~OPEN: [FE-I2] [FN-4] regress-items2 'floor 4 boss pool can return c2 items' must unlock gates before rolling~~ -- done by INT-1: done: ?unlockall=1
- ~~OPEN: [FE-I2] [FN-3] HUD cylinder chamber count is wrong or flaky in regress-items2 (Player cylinder.max is correct)~~ -- done by INT-1: test-side lag: the check polls now; Cylinder and Player agree
- ~~OPEN: stress-items.mjs 'restart clean' can be defeated by saints_halo x3 absorbing die(); the script should clear haloLeft (FN-4 or QA owner)~~ -- done by INT-1: done: stress-items strips every death saver

## FEATURE FE-I3 Items batch 3 (6 actives + 10 devil deals)

- ~~STUB: The dynamite_crate does not leave ground fire patches: player-thrown sticks fall under Room.onExplosion's !so.from rule, which suits the crate (no self-burn) but is inconsistent with lit_cigar; logged for the Room owner.~~ -- done by INT-2: Room.onExplosion now keys on hurtPlayer/hurtEnemies; crate stays clean, lit_cigar sticks burn
- STUB: ?dropassets=40 was not run.
- ~~OPEN: [FE-I3][FN-6/Room owner][src/rooms/Room.js onExplosion] Player-thrown dynamite (lit_cigar, dynamite_crate) leaves no fire patches because of !so.from; decide if lit_cigar should.~~ -- done by INT-2: decided: lit_cigar burns, crate does not
- OPEN: [FE-I3][QA/docs][docs/v2/ITEMS_V2.md 10.3] pawn_ticket test text says +22 coins; the 4c/3c pricing gives +25 (implemented and tested at 25).
- ~~OPEN: [FE-I3][owner of tools/qa/stress-items.mjs] Strip black_cat_bone and lazarus_pact and reviveCharges before api.die() in the death step.~~ -- done by INT-1: done
- ~~OPEN: [FE-I3][regress-items2 owner] Install __i1 (and __i2) helpers in regress-items2 and re-run the non-FE-I3 failures on a quiet machine.~~ -- done by INT-1: plugins self-install; suite is 392/0

## FEATURE FE-S2 - Presentation: cards, transitions, title parallax, boot tips, death screen

- STUB: Chapter tagline, whisper and checkpoint timers still use scene Clock delayedCall (fine at 60 fps, slower at very low fps)
- STUB: fps >= 55 soak not run: environment too loaded to measure
- ~~OPEN: [FN-1] GameScene.beginBossIntro overwrites payload ms (2100/1500): keep the payload ms and allow skip (Cards shims the freeze meanwhile)~~ -- done by INT-2: GameScene keeps payload ms and listens for boss:intro:skip (Cards must emit it, logged)
- ~~OPEN: [FN-6] RoomManager.descend should emit trapdoor:descend {x,y} and drop the camera fade (HudTransitions shim emits it and is deduped)~~ -- done by INT-2: native emit landed
- OPEN: [FE-S1] ending.js: no overlap needed with Cards boss:quip; Cards skips the quip for true-eligible Scratch
- OPEN: [FN-3] CharSelectScene should emit title:hell {on} when the MODE toggle changes
- ~~OPEN: [FE-S1] flow.js: drop its own F5/F6 checkpoint toast if any, Cards draws CHECKPOINT_TOAST on checkpoint:saved~~ -- done by INT-2: no duplicate: flow toasts once at F4 only
- OPEN: [FE-B2] engine barks are shown by Cards via boss:quip unless the boss sets selfBanner

## FEATURE FE-A1 - Audio integration: aliases, mix rows, director rules

- STUB: Cutscene music details (500 ms silence before the first caption, finale mute and held chord) belong to FE-S1's CutsceneScene/ending. Audio.js gives them Music.play crossfade, Music.level and Music.stop, and the router passes their tracks through untouched.
- STUB: The duel music dip is driven by the duel_start/duel_draw sounds until FE-V1 emits duel:start/duel:end (requested).
- OPEN: [FE-A1] [FE-V1] QuickDraw.js: emit duel:start / duel:end (a shim already works off the duel_start/duel_draw sounds).
- OPEN: [FE-A1] [FN-3] AchievementToast.js: play stamp_slam for the rank toast instead of room_clear.
- ~~OPEN: [FE-A1] [FN-4] SynergyToast.js: play synergy_chime instead of item_get at rate 1.4.~~ -- done by INT-1: done
- OPEN: [FE-A1] [boss/enemy owners] optional: replace the Assets.hasAudio(key) ? key : alt fallbacks with a plain Sfx.play(key), since aliases now cover missing files.

## FOUNDATION FN-1 - Floors and flow

- STUB: 19 enemy stubs (src/enemies/types/*, StubEnemy.js) awaiting chapter-2 enemy jobs
- STUB: 3 boss stubs (toro, engine, scratch) and 6 mini stubs (MiniBoss.js)
- STUB: Derived F4-6 normal/boss templates and built-in champion/event/crossroads/vault/secret templates; real ones override automatically
- STUB: Cutscene, ending.js (runEnding/trueFinale) and meta/runSetup.js hooks are optional globs that no-op until FE-S1/FN-3 land
- ~~OPEN: [FN-1 to FN-6 Boss.js/Room.js] boss:defeated payload, formKey, MiniBoss spriteKey accessor, scratch death via flow.endGame, Room helpers/generated data shape~~ -- done by INT-2: done
- OPEN: [FN-1 to FE-S1] ending/cutscene/interlude contract
- OPEN: [FN-1 to FE-S2] Cards payloads
- OPEN: [FN-1 to FN-3] runSetup / checkpoint continue
- OPEN: [FN-1 to FE-A1] music keys
- OPEN: [FN-1 to tools] floorgen-test.mjs edited for floors 1-6
- ~~OPEN: rooms-check vault failure: vault_a has 2 I slots, so VaultRoom item roll likely returns null for one pedestal (FN-6 to check)~~ -- done by INT-2: vault OK (rooms-check ALL OK)

## FOUNDATION FN-2

- STUB: No ExplosiveBarrel.js: Z barrels and G gravestones stay Room-owned (agreed with FN-6); GraveAmbush only flips G tiles to rubble
- STUB: Real art paths (haz_f4/haz_f5 cells, fx_hellfire, prop_chandelier, fx_streak) are untested: only the code-drawn placeholder path was exercised (assets missing in dev)
- ~~STUB: Enemy bullet kinds ember and shard render as the plain enemy bullet until FN-4 adds frames (requested)~~ -- done by INT-1: done: ember and shard kinds
- STUB: applyEnvShim is now inert because Player defines env natively; kept as a harmless safety net
- ~~STUB: Natural floors contain almost no hazard templates yet (FE-T1 pending), so hazards were verified via patched test rooms, not shipped templates~~ -- done by INT-2: F4-F6 templates landed
- ~~OPEN: [FN-2] [FN-4] src/systems/Bullets.js: add ember and shard enemy bullet kinds/frames~~ -- done by INT-1: done: ember and shard kinds
- ~~OPEN: [FN-2] [FN-4] src/systems/Fx.js: optional depth >= 200 for pickup sparkle / elite rings when room.darkMask~~ -- done by INT-1: done: Fx.lit(depth) for pickups, price labels and dynamite in darkness rooms
- ~~OPEN: [FN-2] [FN-6] src/rooms/Room.js: hazardWalk true only for rooms with L or s tiles; confirm Z/G ownership~~ -- done by INT-2: confirmed
- OPEN: [FN-2] [FE-E2] magma_eel: use room.lavaPath() shape {tiles,count,has,nearest,path}; empty graph when no lava

## FOUNDATION FN-3

- STUB: DEEDS pages hold 10 per page (5 per column), not the spec's 9.
- STUB: RELICS tab has no synergy sub-filter; synergies show in the relic detail sheet (top 3).
- STUB: Lore entries do not replay their cutscene (the `reread` field is unused).
- STUB: Art placeholders until assets land: meta_icons sheet, portrait_preacher/hunter/queen, ui_charselect_bg, ui_codex_bg (code-drawn fallbacks in place; requests logged for Assets.js). Mini-boss art in the Codex is an initials badge until champion sprites exist.
- ~~STUB: Player settings shakeAmt, flash, bulletOutline, dmgNumbers, autoPause and Player.bulletTint are stored and shown in Options but not yet consumed by Fx/Player/Bullets/GameScene (logged for FN-4/FN-1). Until then the Sanctified bullet tint is not visible.~~ -- done by INT-1: consumed: shakeAmt/flash (Fx), bulletOutline (Bullets), dmgNumbers (Fx + Enemy.hurt), bulletTint (Player.fire); autoPause is a GameScene request
- ~~STUB: Contract runs end on the goal boss only once FN-1 emits run:ended {variant:'contract'} and sets run.goalReached (logged); a death still records the attempt.~~ -- done by INT-2: flow.endContract emits run:ended variant 'contract' with run.goalReached
- STUB: Quit from Pause clears the checkpoint (D10 says cleared on abandon), so CONTINUE appears after a reload or crash, not after Quit to Menu.
- ~~OPEN: FN-1: add meta_icons sheet, portrait_preacher/hunter/queen and ui_charselect_bg/ui_codex_bg to Assets.js; emit run:ended variant 'contract' with run.goalReached at the goal boss; document the meta outputs and End payload ledger in events.js; optional static scene registration in main.js.~~ -- done by INT-2: done in flow.endContract / GameScene.endRun (meta_icons/portrait rows still assets side)
- ~~OPEN: FN-4: consume player.bulletTint and the settings shakeAmt, flash, bulletOutline, dmgNumbers, autoPause; confirm enemy:died carries by 'sixth'/'deadeye'/'explosion' plus elite/affixes.~~ -- done by INT-1: done (see INTEGRATION_REQUESTS); enemy:died by/elite/affixes verified; autoPause logged for GameScene
- ~~OPEN: FN-6: keep the room:cleared {hitless?}, secret:revealed, chest:opened, shop:bought, deal:signed, event:done, mini:defeated, pickup:collected names Meta consumes.~~ -- done by INT-2: kept

## FOUNDATION FN-4 Items engine (DEAD WEST round 2, branch round2)

- ~~STUB: Only 3 of 46 new items exist (sample defs written by FN-4; FE-I1..3 register the rest and may overwrite the samples): items2-static reports 43 PENDING (ITEMS2_STRICT=1 makes them fail), regress-items2 generic pass ran on 3/46~~ -- done by INT-1: obsolete: all 46 registered, items2-static strict 211/0/0 pending
- ~~STUB: hooks bounce/deathSave not exercised by the generic regress pass (need real items: static_ricochet, lazarus etc.), reported as WARN~~ -- done by INT-1: covered by per-item plugins (static_ricochet, lazarus_pact, black_cat_bone); the WARN stays by design
- ~~STUB: Round-1 familiars (CrowCompanion etc.) are unowned: cooldown scaling by Familiar.cdMult logged as a request; damage scaling (familiarMult) and spectral shots are in Bullets~~ -- done by INT-1: CrowCompanion scales by cdMult and rolls on player.crng
- ~~STUB: Debug API extras (giveItems/tags/synergies/rollPool/state extras) belong to FN-1; tests use __dw.player/scene.items directly~~ -- done by INT-2: landed in Debug.js
- ~~STUB: PauseScene must mount BuildPanel (FN-3); Room-side effects (roomClearDynChance, tinDropChance, houseWins, hushDrop) are FN-6 call sites~~ -- done by INT-1: done engine-side: items/fx/synergyFx.js (room:cleared / floor:changed via ItemSystem) covers roomClearDynChance, tinDropChance, jackpot; hushDrop is the hush_money def's own hook
- ~~OPEN: FN-1: Debug API additions and Player {char} wiring, no double diff HP (see INTEGRATION_REQUESTS.md)~~ -- done by INT-2: Debug API landed
- OPEN: FN-3: runSetup start-item guard, mount BuildPanel from src/ui/Relics.js in PauseScene
- ~~OPEN: FN-6: shopPrice helpers, room-clear item effects, heart_container drops~~ -- done by INT-2: shop tier prices + Hell heart price in Room; clear effects live in items/fx/synergyFx; heart_container supported
- OPEN: FN-2: honour stats.pyroImmune in FirePatch
- ~~OPEN: Integrator: CrowCompanion cdMult, regress-items.mjs threshold drift, FE-I agents note engine-side sixthCost/rollShock (do not double charge)~~ -- done by INT-1: done

## FOUNDATION FN-5 Run variety: elites, crossroads, boons

- STUB: Nothing stubbed. The xroads-sim browser part still injects a test floor.xroads def only if FloorGen has none (it does now, so no shim in the last run)
- STUB: Real art absent for props_deals/npc_dealer: code-drawn placeholders used until the art lands
- STUB: Save.codexSeen is called guarded; no-op if Save lacks it
- OPEN: [FN-5 to harness owner] tools/qa/harness.mjs: isolated Vite passes server.port 0, and the run appears to land on 5173 when it is free (REQFAIL log showed 127.0.0.1:5173). Not touched by me; the task rules forbid binding 5173, so please check that `port: 0` is honoured.
- ~~OPEN: [FN-5 to FN-4/FN-6] Boons.darkRoomMod and the Affixes.rollWave call are wired in Room.js, but no test of dark-room frequency exists yet; QA-2 xroads-sim/events-sim should cover it~~ -- done by INT-2: wired and checked by rooms-check
- OPEN: Design notes: payment logic lives in Crossroads.pay (not ItemSystem.canPay/pay); glass_cannon uses player.pacts[]; DealerSpeech follows STORY 11 numbers (22 px, 40 cps); DealPedestal is standalone, not a Pedestal subclass; deal:refused is emitted once per pocket visit with no signature; elite:killed and room.state.eliteKills are the elite bookkeeping conventions

## FOUNDATION FN-6 Rooms and controllers

- ~~STUB: EventRoom hosts event controllers from src/rooms/special/events/*.js (FE-V1); until they land the room shows the prop + banner only~~ -- done by INT-2: controllers landed
- STUB: SecretVariants.js (variants + Tells) is optional-glob hosted; absent = plain stash layout, no door tells
- ~~STUB: Hazards/Modifiers behaviour is FN-2's (facade stubs currently no-op); Room only draws barrels/gravestones and registers the other tile types~~ -- done by INT-2: real implementations landed
- ~~STUB: Room-clear effects of FN-4 requests not yet seen in their files: Bullets.js calling room.onWallHit, Explosions calling room.onExplosion, Pickup/Player heart_container (the room drops it, run showed it spawned), Chest rec.free honoured only if FN-4 lands it~~ -- done by INT-2: verified: Bullets->onWallHit, Explosions->onExplosion, heart_container, Chest.free all present
- ~~STUB: Trapdoor.js unchanged (no change needed)~~ -- done by INT-2: F4 tint added
- STUB: regress-levels.mjs timing assertions for new tiles not extended: tools/qa/regress-levels.mjs is not in my owned files (new coverage is in tools/qa/rooms-check.mjs)
- STUB: obst_hazards/props_events/props_small art keys guarded with code-drawn placeholders; F4-6 obstacle art falls back to obst_f3 until it exists
- ~~STUB: ARCHITECTURE.md notes not written (not owned): Room API additions are room.controller(role), room.banner(), room.onMiniDefeated(), room.onExplosion(), room.onWallHit(), room.rings, room.combatAge, tile flags barrel/grave/pipe~~ -- done by INT-2: Room API notes added to docs/ARCHITECTURE.md
- ~~OPEN: [FN-6 to FN-4] Bullets.js: call room.onWallHit(x,y) on player bullets dying on room bounds; Explosions.explode: call room.onExplosion(x,y,radius,o); Pickup/Player: heart_container support; Chest: rec.free opens without key~~ -- done by INT-2: verified wired
- ~~OPEN: [FN-6 to FN-2] Hazards.build must draw/animate L V = | r k Q s tiles and own T (pipe) and G (grave ambush: set t.type='rubble' when triggered); Room only draws Z barrels and gravestone sprites~~ -- done by INT-2: done (hazard-check 52/52)
- ~~OPEN: [FN-6 to FN-1] FloorGen/RoomManager must set def.event, def.mini, def.variant, def.mod, def.pocket and register templates event_*, champion_f*, vault_a, crossroads_*; Room falls back to an open layout with the marker slots when a template is missing~~ -- done by INT-2: done (floorgen 300 green)
- ~~OPEN: [FN-6 to FE-V1] Event controllers go in src/rooms/special/events/<PascalCase>.js extending Controller; SecretVariants.js exports VARIANTS and optional Tells~~ -- done by INT-2: done
- OPEN: tools/qa/regress-levels.mjs timing assertions for new tiles need extending by its owner
