# DEAD WEST - Status (v2.0, Chapters 1 and 2)

## Added in v2 (Chapter 2 and the "real game" pass)

* **Chapter 2 (floors 4-6)**: Brimstone Bluffs (lava, vents, hellhounds, El Toro Infernal), Blood Rail (lane hazards, steam, ghost carts, Engine No. 666), Last Chance Saloon (chandeliers, roulette, Ol' Scratch, the Dealer). 18 new enemies + duelist, 3 bosses, 45 new room templates, interlude and arrival cutscenes.
* **Riders**: Gunslinger, Preacher (faith / sanctified shotgun), Hunter (wanted marks), Queen (dual guns, coin damage); unlocked through play.
* **Items**: 74 total (46 new: passives, actives, 10 devil deals), 8 item tags, 26 synergies with toasts and a BUILD panel, cylinder 3-8 slots.
* **Run variety**: 6 mini-boss champions, 6 random events + secret variants + vault, the Crossroads (devil gates, deals, curses, blessings, pacts), 8 elite affixes, 8 room modifiers, new hazards.
* **Meta**: Save v2 + migration, checkpoint CONTINUE from F4, Notoriety ranks, 44+ achievements, 30 Bounty Board contracts, 15 mutators, Codex (6 tabs), Daily Ride (seeded), Hell on Earth mode, two endings (Take the Chair / The Sixth Bullet), credits.
* **Presentation**: ~24 story panels, title parallax, chapter/boss/mini cards, phase banners, death epitaphs, loading tips; ~92 new SFX keys, 17 music tracks, 4 ambience beds.
* **Load**: ~13 MB blocking boot (cutscene/later-floor art lazy-loaded), ~50 MB total.
* **QA**: 5-way QA pass (bots, visual, robustness, spec audit) and fixes; reports in `docs/v2/qa/`. Headless fps could not be measured (shared machine): profile on real hardware.

---
Chapter 1 status (still accurate):


## Implemented (Chapter 1 "Perdition County")

* **Core loop**: twin-stick revolver (WASD + arrows / mouse), infinite ammo, Sixth Bullet every 6th shot (cylinder HUD), dodge roll with i-frames, dynamite (also opens secret rooms and breakables), hearts + tin hearts, coins/keys, permadeath, seeded runs.
* **Floors (3)**: Dry Gulch, Perdition, Sundown Mine. Procedural room graph per floor (start, normals, key-locked treasure, shop, boss dead end, secret room, guaranteed key room). 65 hand-authored ASCII templates (16 normal per floor with difficulty tiers, special rooms), wave spawns with fairness relocation, pits/spikes/breakables, per-floor art, minimap with fog of war.
* **Enemies (16)**: F1 coyote, rattlesnake, tumbleweed (+mini), outlaw, buzzard; F2 possessed, skeleton, dynamiter, ghost, scarecrow (+crow); F3 miner, bat, mole, coffin. All telegraphed, elites ("cursed") at 8 %.
* **Bosses (3)**: El Cascabel (F1), Marshal Grimm (F2), The Undertaker (F3, chapter finale with title card and chapter-complete poster). All have intro cards, HP bar, 2-3 phases and adds.
* **Items (28)**: 24 passives (stat mods, statuses, familiars, shields) + 4 actives (whiskey, pocket watch bullet-time, powder keg, lucky deck), pools without repeats, pedestals, pick-one treasure rooms, shop with peddler.
* **UI**: title/menu, options (music, SFX, screenshake, fullscreen), bounty board (persisted stats), credits, pause, wanted-poster death screen, floor/boss cards, pickup banners, relic strip, low-health vignette + heartbeat.
* **Audio**: 9 music tracks + ambience beds (lazy-loaded), ~130 SFX files with per-file loudness normalisation, ducking, polyphony caps; event-driven audio director.
* **Art**: full ink-woodcut set generated with GPT Image 2.5 (player, 16 enemies, 3 bosses, 28 items, room backgrounds, props, HUD, FX), placeholders for anything missing.
* **Tooling**: headless-Chrome QA harness with private Vite servers, fuzz/bot/stress/regression scripts, floor-generation self-tests, production build check, itch.io zip.

## Release checklist / known issues

| Severity | Issue |
|---|---|
| Blocker for commercial release | Audio licences not cleared: `snake_rattle` is CC BY-NC 3.0, `shoot_3` is Sampling+ 1.0 (replace both); CC BY attribution needed for `bat_screech_2`, `boss_intro_2`, `shoot_crit`, `coyote_howl_3` (SFX) and the Kevin MacLeod tracks. The in-game credits currently name only the music and "Freesound / Kenney". Details: README and `public/assets/audio/CREDITS_*.md`. |
| Minor | Fonts (Rye, Special Elite) load from Google Fonts; offline or blocked they fall back to Georgia/serif. Self-hosting the two font files would remove the only external request. |
| Minor | Keyboard + mouse only: no gamepad, no touch. |
| Minor | `dist/` must be served over HTTP (module script); opening `index.html` from disk does not work. |
| Minor | Hidden/background browser tabs load slowly (timer throttling) and the game auto-pauses on blur. |
| Minor | `docs/GAME_DESIGN.md` is the original design brief: it lists 14 enemies (16 shipped incl. `crow`, `tumbleweed_mini`) and some numbers that were tuned later (`config.js` and `ARCHITECTURE.md` are authoritative). |
| Dev only | Phaser tweens run on wall-clock time, so fast-forward test loops (`game.step`) must wake the loop for door slides / cutscenes to finish (handled in `tools/qa/fuzz-run.mjs`). |
| Dev only | `art/raw` + `art/originals` are ~280 MB; keep them out of the deployed build (they are not in `dist/`) and consider Git LFS if the repo is pushed to a remote. |

## Next steps

1. Clear or replace the flagged audio, extend the credits screen, self-host fonts.
2. Playtest balance passes per floor (target 20-30 min full clear; boss HP and drop rates are in `config.js` / `bosses/registry.js`).
3. Accessibility: rebindable keys, aim-assist / colour-blind bullet outlines, gamepad.
4. Polish backlog: more room templates per floor (repeat rate), synergy items, secret-room variety, boss death/phase transitions.

## Chapter 2 ideas ("The Devil's Own Country")

* **Floors 4-6**: Bone Orchard (cemetery / dead orchard with grave-digging hazards), Iron Horse (fight along a moving train: scrolling hazards, boxcar rooms), Hellmouth Saloon (the Devil's saloon: poker-table shops, blood-red neon, final floor).
* **Bosses**: The Widow (ghost bride, mirror clones), The Engineer (train boss with cart phases), Old Scratch (the Devil, contract phase: the player's own items turn on them).
* **Devil deals**: contract rooms that trade heart containers for powerful items (Isaac devil deal, western flavour), gambling machine, dueling challenge rooms with reward chests.
* **Meta-progression**: bounty board unlocks (starting loadouts, alt gunslingers with different revolvers), daily seed, run history, boss-rush mode.
* **Systems**: item synergies / transformations (Undead, Outlaw, Pyro), curses, a second active slot, mounted horse dash, cover/breakable-wall tactics.
* **Tech**: gamepad, touch controls, localisation hooks, save-slot export, Electron/Steam wrapper.

## Changelog

* **0.1.0** - Chapter 1 complete (see above). Repo hygiene and packaging pass: README, `.gitignore`, npm scripts (`smoke`, `selftest`, `test:floorgen`, `test:prod`, `zip`), production build without warnings (static FloorGen/Templates import, Phaser vendor chunk, relative base), `test:prod` end-to-end check, QA scripts pruned to a reusable set (fuzz, bots, stress, regression), architecture doc consolidated, 480 MB of throw-away QA screenshots replaced by a curated `art/screens/` set.
