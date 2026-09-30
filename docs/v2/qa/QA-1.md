# QA-1 findings (bots F1-F3 + Chapter-1 regression + meta flows)

Status: IN PROGRESS. Sections appended per test area. Defect ids: Q1-nn. Severity P0 crash/softlock, P1 wrong/major, P2 minor, P3 polish.

## Log

### Area 0: node-only suites (no browser)
- `node tools/qa/meta-test.mjs`: 306 passed / 0 failed (conditions, unlock idempotency, migration fixtures, export/import, daily, ranks, contracts).
- `node src/gen/selftest.mjs` (floors 1-6) OK; `node tools/floorgen-test.mjs` OK (1800 floors, 131 templates); `node tools/qa/story-lint.mjs` 1585 passed, 2 warnings.
- Static reading: rider table in `src/data/characters.js` matches CHARACTERS_META A1 (preacher 5 pellets/9 deg, tin 4; hunter 4 HP units, dyn 3+bandolier; queen 10 coins, luck 1).

### Static finding (to be confirmed in browser, see Area checkpoint)
- flow.afterFloorIntro saves the checkpoint BEFORE the chapter card and Hell's Welcome (heal 2 units, +2 dynamite) are applied, and CONTINUE re-enters with `from:0` so the welcome is never given: a run resumed from the F4 checkpoint lacks it.

### Area 1: full-run bot per rider (tools/qa/bot-v2.mjs, non-god, fixed-step; stop = arrival on F4 i.e. F1-F3 + Chapter-1 boss chain + interlude chain)
Machine load was 8-50 (shared), so seeds 1-4 per rider instead of 1-8.
| rider | seed | result | notes |
|---|---|---|---|
| gunslinger | 1,2,3,4 | 4/4 reached F4 | errs 0, no softlock |
| preacher | 1,3 | reached F4 | 2: died F2 to `spikes` (f2_17, 4 hits; bot dodge limit, slow roll 1.3 s) ; 4 = runner navigation timeout (env load) |
| hunter | 1,3,4 | 3/3 reached F4 | 2 = runner nav timeout (env) |
| queen | 1,3 | reached F4 | 2,4 = runner nav timeout (env) |
Zero console errors / page errors / softlocks in all 11 completed runs. Runner "Navigation timeout" only happened on page reuse right after an F4 arrival under heavy load (not reproduced in a game path; flagged Q1-E1 as env/low).

### Area 2: meta flows (tools/qa/qa1-meta.mjs <area>, private server, non-debug so Meta is enabled)
- charselect: PASS (38 checks). Locked hunter/queen cannot start (deny + hint), locked Hell chip stays NORMAL with "Win a run to unlock Hell on Earth.", A/D wrap, 1-4, token/arrow/plaque clicks, last rider remembered after reload, `?noassets=1` renders all 4 cards, all 4 riders start in Hell with correct kit (preacher 5 pellets tin 4; hunter 4 HP 7 dyn; queen 10 coins dual guns; hell hurtInvuln 0.85).
- menus: PASS. Daily / Board (tier 2 locked: Enter does not start) / Codex 6 tabs / Options 2 pages / Credits paging all open and close, 0 errors.
- unlock: PASS. 520 kills -> `gravedigger` once; grimm x2 -> `lawless` + `char:preacher` once; cascabel/undertaker -> hunter + daily once; persisted immediately to localStorage; no re-fire in the next run; CharSelect gains the preacher/hunter cards, queen stays locked.
- end ledger: PASS. Death poster -> SPACE ledger -> LEFT -> R ride again keeps rider+mode; win page: `debt_paid` earned, hell mark set, wins +1; checkpoint cleared on death.
- options export/import round-trip: PASS. export -> reset (hold 1.5 s; short hold does nothing) -> import restores a deep-equal save; garbage and v1-shaped codes rejected; persisted.
- checkpoint (preacher/hell, hunter, queen; tools/qa/qa1-meta.mjs checkpoint): PASS 31/31. Written on F4 arrival, persisted, menu shows `CONTINUE - FLOOR 4`, CONTINUE restores items/active/coins/keys/dyn/hp/tin/stats identical to the checkpoint snapshot, F4 layout identical for the same seed, no cutscene replay, cleared on death, debug runs write none. FINDINGS below (Q1-01, Q1-02).
- storage disabled (`localStorage` getter throws) and full (`setItem` throws QuotaExceeded): PASS 18/18 (boot, run, death, ledger, Daily(locked)/Board/Codex, in-memory export/import), 0 console errors.
- Save migration fixtures in the browser (v1 wins=2, v1 bestFloor=3, v1 {}, corrupt v1, corrupt v2, wrong-typed v2, v2+v1, future v3, "null"): PASS 44/44; v1 key untouched; NP = floor(kills*25/100)+deed NP verified (245 for kills=500 + 3 deeds).

### Area 2b: board / daily / codex / rider mechanics / Hell numbers (qa1-meta2.mjs, qa1-riders.mjs)
- board: PASS 12/12. bt_greenhorn contract run: rider/items/mutators/seed exact, Meta on, no story card, F2 boss kill -> End(contract), recorded done once, lore_board granted, `bounty:completed` fired once, does not count as a normal win.
- daily: PASS (test-side fixes applied). Same date -> same rider/seed/mutator and identical F1-3 layouts; death records exactly one entry (arrives ~1-2 s after End appears at low fps); R replays the same date and adds a 2nd entry; Sunday 2026-10-04 is Hell. Note: leaving a Daily via scene stop writes a history row `killedBy:"abandoned"` (no board entry, no dailyRuns) - looks intended.
- codex: PASS. coyote S0 -> seen S1 -> 3 kills S2; gated items locked + unseen; tabs render.
- riders: preacher PASS 8/8 (5 pellets/9 spread, tin plating absorbs a 2-unit hit as 1 tin incl. explosions, 2 hp without tin, undead x1.5, faith +8/kill -> Sanctified at 100, expires 8 s). hunter PASS 5/5 (1 mark per wave on the toughest enemy, marked kill drops nickel + coin, markMult 1.5/boss 1.2, 7 dynamite). queen PASS 4/4 (dmg 2.0 at 0 coins vs 2.792 at 99, sixth 1.6 vs 3.58, dual muzzles alternate, luck 2). hell PASS 2/2 (enemy HP x1.3, hurtInvuln 0.85, HP x1.3 via maxHp 23.4).
- Pedestal follow-up: the r1-vs-r2 `treasure ped [[null,null]]` in regress-items is NOT a defect: `api.teleport` places the player on the treasure pedestal and it is auto-collected after 0.4 s (timing dependent at low fps). Probe `tools/qa/qa1-probe-ped2.mjs` shows `hollow_point` on the pedestal for seed 42 and `speed_loader`/`crow_companion` for seed 11 treasure/secret. Item pool differences vs r1 (silver_bullets vs hollow_point, pool 21 -> 36) are expected from the round-2 item pool.

### Area 1b / 3: more bots, fuzz, regression follow-ups
- Bots (bot-v2, F1-F3 + Chapter-1 chain to F4, 0 softlocks / 0 crashes / 0 console errors): preacher 1,3,4; hunter 1,2,3,4; queen 1,2,3,4; queen HELL 3; gunslinger 1-4. Only miss: preacher seed 2 died on F2 `spikes` (bot dodge limit). Runner "Navigation timeout" on page reuse under load is env only.
- Fuzz (qa1-fuzz.mjs 300 sim-s): gunslinger/preacher normal (3,7), hunter/queen normal (5,11), gunslinger/preacher/queen/hunter HELL (various seeds): all OK, 0 console errors, no runaway counts. Two fuzz failures explained: (a) `PeddlerSpeech.update` TypeError, see Q1-10; (b) `fuzz-run.mjs 300 4 42` "cutscene never finished (5.6 s)": Cascabel boss intro is now 2.9 s game time (r1: 2.1 s) and the fuzz waits a fixed 5.6 s wall clock at ~8 fps; probe shows the intro ends after ~9 s real at 10 fps. Test-side flake, not a product defect (r1 passes seed 4 only because its flow differs).
- regress-audio-v2 rerun: ALL PASS (earlier F6 crossfade P3 was a load flake).
- Sixth Bullet probe (tools/qa/qa1-probe-sixth.mjs): 6th and 12th shot are Sixth, mult x2, pierce +1: PASS. spec-a3's `p.shotCount = 5` hack is stale (retired field), test artifact.
- Candidate "null treasure pedestal" retired (see Area 2b).

### Not covered
Hell full-clear/F4-F6 bot runs (QA-2 area); real audio listening; real gamepad/touch input; Board tiers 2/3 contract runs beyond bt_greenhorn; Daily Hell (Sunday) live run; Options page 2 visual on small windows; long soak > 300 sim-s; browsers other than headless Chrome; toast timing on DEED EARNED at real fps (screenshot only).

## Defects so far
~~ FIXED by FIX-1 (flow.afterFloorIntro re-saves the checkpoint after the welcome; CONTINUE grants it once if the saved run lacks it; asserts in tools/qa/world-check.mjs) ~~
- Q1-01 (P2, meta+ui / world+flow) Hell's Welcome lost on CONTINUE. `flow.afterFloorIntro` writes the F4 checkpoint immediately, before the 3.6 s chapter card and Hell's Welcome (heal 2 units, +2 dynamite) are applied; CONTINUE re-enters with `from:0` so the welcome is never given. Repro: `node tools/qa/qa1-probe-welcome.mjs` (hunter hp1 dyn3 at F4 arrival -> live hp3 dyn5 after the card; checkpoint stores hp1 dyn3; CONTINUE gives hp1 dyn3, `run.hellsWelcome` undefined). Fix: save the checkpoint after `show()`/welcome (spec: "after fade-in"), or grant the welcome on a continue whose run.hellsWelcome is false.
- Q1-02 [FIXED by FIX-3] (P2, meta+ui) Menu selection defaults to RIDE OUT, not CONTINUE, when a checkpoint exists (`MenuScene.create`: `this.list.select(cp ? 1 : 0, true)` while CONTINUE is item 0). One Enter press starts a new run and abandons the F4-F6 checkpoint. Repro: save with `checkpoint`, open menu, `Menu.list.sel === 1`.
- Q1-03 (P3, docs) CHARACTERS_META A4 says Queen luck 3 (cursed_coin +2); `cursed_coin` gives +1 so Queen starts at luck 2 (6 % crit). Doc or item mismatch (round-1 item unchanged).
- Q1-04 [FIXED by FIX-3] (P3, ui) CharSelect locked card: the amber unlock hint overlaps the FIRE RATE / RANGE bar labels (bars are still drawn as empty segments instead of "- - - -"). Screenshot art/qa/qa1-cs-locked.png.
- Q1-05 [FIXED by FIX-3] (P3, ui) Codex > RECORD: "THE LEDGER" left page overflows: first row's label/value is clipped at the left page edge and the last row ("Best daily streak") is cut by the page bottom (16 rows). art/qa/qa1-codex-5.png.
- Q1-06 [FIXED by FIX-3] (P3, ui) DailyScene poster: "DAILY RIDE" header is struck through by the poster frame and "RESETS IN" line overlaps the bottom border; rider line says "borrowed for the day" even when that rider is unlocked. art/qa/qa1-daily.png.
- Q1-07 [FIXED by FIX-3] (P3, ui) End ledger "NEW ON THE BOARD" lists title unlocks with the same name as the deed right above (Ghost Rider, Quickdraw appear twice).
~~ FIXED by FIX-1 (GameScene.stopOverlays on End / shutdown; assert in world-check) ~~
- Q1-08 (P3, flow) Cutscene overlay scene is not stopped when Game ends: dying while the Hell intro card is up (api.die()) leaves `intro_hell` panel drawn over the End scene ("HOLD ESC SKIP"). Only reachable synthetically (game is frozen during the card) but leaks a scene. Repro: `?seed=41&char=hunter&mode=hell` with hunter unlocked, api.die() 1.5 s after start.
- Q1-09 [FIXED by FIX-3] (P3, meta) A save whose `v` is not 2 and not empty (e.g. a future v3) is silently replaced by a fresh save on the next persist (no backup key). Edge.
- Q1-10 (P3, content/world) `PeddlerSpeech.update` throws `TypeError: Cannot read properties of null (reading 'drawImage')` when the player leaves a shop through `RoomManager.jump` (debug teleport/bossRoom, pocket enter/return) while the peddler is typing: the room teardown destroys the tracked speech text, but `installPeddler` keeps `sp` and `tick` calls `sp.update` until the next `room:entered` (60 ms later), and the `room:transition` handler ignores jumps (`from: null`). Repro: `node tools/qa/qa1-probe-peddler.mjs` (22 of 25 offsets throw, `errors 1`) or `FUZZ_CHAR=preacher FUZZ_MODE=hell node tools/qa/qa1-fuzz.mjs 300 2 21`. Fix: `drop()` on any `room:transition`, or `if (sp && !room.destroyed)` in tick / guard `text.scene`. File: src/entities/Shop.js (installPeddler).
