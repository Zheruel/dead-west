# QA-2 - Bots F4-F6, bosses, economy, events (test-only)

Method: private isolated harness servers, one headless Chrome at a time, fixed-step sim (sim-time metrics). Scripts under `tools/qa/` (qa2-*.mjs are mine).
Findings are appended per test area (newest at bottom). Severity: P0 crash/softlock, P1 wrong/major, P2 minor, P3 polish.

## A. Boss bots (fight mode, stock ch1 loot: hollow_point,speed_loader,snake_oil, god OFF, 4 hearts, skill 0.7 default; bot uses Math.random so results vary per process)
| Boss | Target win / median win time | Measured | Verdict |
|---|---|---|---|
| Toro | 70-85 % / 55-95 s | 7/16 = 44 % (also 2/8 in one earlier batch, 25 %); median win 74 s (58-84) | WIN RATE LOW. Damage sources over 16 fights (hearts units): charge 36, herd_stampede 33, fire_breath 13, magma_stomp 8, hellfire_leap 4 |
| Engine | 60-80 % / 70-115 s | 10/12 = 83 %; median win ~102 s (88-128) | rate at top edge, time ok |
| Scratch | 40-60 % / 150-260 s | 7/10 = 70 %; median win 148.8 s (117-162; only 3/7 wins reach 150 s) | TOO EASY and slightly too short. Loss deaths at ph3 (boss hp 15/18/225 left); damage by attack spread: deal_fan, royal_flush, hellfire_spiral, chandelier_rain |
Engine `--mode=fuzz` (112 phase-change cases + lethal-hit-per-attack) OK; `--mode=phases` OK (every attack ends, telegraph >= 0.5 s, no bad flags).
Toro `boss-toro-check.mjs` (phase fuzz every attack x P0/P1 threshold, death mid-attack incl. leap: pedestal + heart_full + trapdoor, double threshold jump) ALL OK, no console errors.
Scratch `--mode=fuzz` (168 phase-change cases, skip jumps, seal->tear->stun->re-raise x3, lethal hit during every attack -> ending:true, Hell lethal -> trueFinale/kneel) OK; `--mode=phases` OK (all 4 phases reachable, every forced attack terminates, no bad telegraph). No deadlocks anywhere.

## B. enemy-check all (19 = 18 chapter-2 + duelist), 20 sim-s, 3 copies each, god mode
All 19 pass: spawn, move/fire, no NaN, clean kill (no leftover copies), zero console errors. Notes: magma_eel "moved false" in a room without lava (expected, needs lava tiles); cinder_skull alive 9/40 samples (suicide flyer, expected); crate_mimic moves once awake.

## C. stress-enemies F4/F5/F6 (60 s real time, god mode, 8 mixed enemies per floor)
No console errors, no crash, heap flat (49-56 MB), enemy count stable, enemy bullets <= 28. Headless software GL gives 9-15 fps (not meaningful; fps not chased). Scene child count settles (F4 31->~170, F6 29->~175, F5 flat ~70): `fx_scorch` decals cap at 70; extra `ring` pulses seen only in fast-forward because Phaser tweens run on wall time (harness artifact, not a leak).
- P3 [tooling] [FIXED by FIX-4: F4-F6 default packs added] `tools/qa/stress-enemies.mjs` has default packs only for floors 1-3 (crashes with `Cannot read properties of undefined` for `4|5|6` without an id list). Suggested defaults: F4 `hellhound,hellsteer,cinder_skull,magma_eel,sulfur_preacher,magma_golem`, F5 `handcar_bandit,signalman,steam_stoker,crate_mimic,rail_rat,chain_gang`, F6 `card_shark,loaded_die,slot_fiend,waiter_imp,bouncer,joker`.

## D. Pure sims (node)
- `xroads-sim --sim`: all ok (20k boss kills, P(no gate over F1-5) = 0.00 %, 2.56 gates/run, per-floor rate dev <= 0.77 %, pity, offer tables, cost rules).
- `events-sim`: all ok (20k rolls/table within +-1.5 %, scripted playthroughs of all 6 events + quick_draw flawless/hurt, re-entry restores state, no console errors).
- `elite-telegraph --sim`: all ok (F3 10.9 % vs 12.0, F4 14.6 vs 14.0, F5 15.8 vs 16.0, F6 17.2 vs 18.0; <= maxPerRoom; second affix only F5-6). Note the D3 formula gives F4-F6 elite base 14/16/18 % while CHAPTER2 s0 lists 10/12/14 % (the doc allowed the RUN-VARIETY override; Hell multiplies again, QA-6 to confirm it is not too much).

## E. Chapter-2 full-run bots (QA-2 bot = `tools/qa/qa2-bot.mjs` + `qa2-botpage.js`: bot-page.js taught to treat lava/vent/retract-spike tiles as blocked and to dodge fire patches and rail/herd lanes; stock chapter-1 loot at F4: voodoo_doll,long_barrel,speed_loader,hollow_point,spurs,spirit_lantern,liquid_courage,ricochet + whiskey_bottle, 3 hearts, expert skill, god OFF)
Original `bot.mjs --floor 4` (no hazard awareness): seed1 died in lava on F4, seeds 2/3 "soft-locked" on lava/vent rooms - bot limitation, not a game defect (the player may cross lava).
Patched bot (`qa2-bot.mjs`, F4 start, stock loot, seeds 1-14, 12 finished): 3 complete runs (Scratch killed by the generic bot, ending reached), 2 died to Engine (cart / boss), 2 died on F6 chandelier rooms, 1 rail_rat F5, 1 fire F4, 1 bot-limitation "softlock" (see D-004), rest botcrash (bot bug with Scratch `haz` shape, fixed in qa2-botpage) / Chrome timeouts under load 80+. No game soft-lock found. Bot F4-F6 sim time to clear a floor: F4 ~225 s, F5 ~275 s, F6 ~400 s (bot is much faster than the 10/11/12 min human targets, so human 30-36 min for F4-F6 is not measurable by bot).
Clear times (median s per room): F4 normal 16.7 / boss 40; F5 normal 17.6; F6 normal 14.8. Damage/room: F4 0.9, F5 0.4, F6 0.9 half-hearts. Hardest templates (bot): f6_n11 (4.0 dmg/visit), f6_n12, f6_n14, f4_n13 (25.9 s clear), f5_n01.
Pickups per full floor (bot, avg): see economy table in section G.

## F. Flow: F3 boss -> interlude -> F4 -> F5 -> F6 -> Scratch death -> ending (`tools/qa/qa2-flow.mjs`, real time, debug run)
- Normal: PASS. F3 reward (2 pedestals) + trapdoor -> `story:cutscene interlude_ch1` -> F4; F4 (1 pedestal) -> F5 (`card_f4_f5`); F5 (2 pedestals) -> F6 (`saloon_arrival`); Scratch -> `game:ending` exactly once (`devil_defeated`) -> `end_a` -> Credits -> `run:ended {won}` -> End scene; Credits scene stops within 4 s; zero console errors. run.ending 'a', completedChapter2 true.
- Hell (no deals): PASS. Same chain, `story:trueFinale` once, `game:ending {ending:'true'}`, `end_true`, End scene. The kneeling Scratch stays in `scene.enemies` with hp -99998 (by design).
- Gate: Hell + `dealsMade=1` -> ending A (no finale) PASS; Hell + Crossroads entered but nothing signed -> true ending PASS; Normal -> never the finale PASS.
- Not covered here (needs a non-debug run, Meta is off in debug): checkpoint write on F4/F5/F6 arrival (QA-1 scope). Trapdoor arming rule (must be >90 px away once) is intentional; at very low fps scripts must wait for `armed`.
- P3 `trapdoor:descend` is emitted twice per descent (RoomManager + the `shim:true` emit from ui/Transitions.js line ~212 when `g.transitioning` is not yet set). Harmless (deduped by the HUD) but any other listener sees two events.

## A2. Boss bots with the real Chapter-1 loadout (voodoo_doll,long_barrel,speed_loader,hollow_point,spurs,spirit_lantern,liquid_courage,ricochet, 3 hearts = what a bot actually carries into F4, 8 seeds each, `--hp=3 --items=...`)
| Boss | Target | Real loadout, 3 hearts | Minimal loadout (3 items), 4 hearts |
|---|---|---|---|
| Toro | 70-85 % / 55-95 s | 7/8 = 88 %, median win 58.8 s | 7/16 = 44 %, 74 s |
| Engine | 60-80 % / 70-115 s | 6/8 = 75 %, median win 89.5 s | 10/12 = 83 %, 102 s |
| Scratch | 40-60 % / 150-260 s | 3/8 = 38 %, wins 93 / 132 / 152 s (median 132 s) | 7/10 = 70 %, 149 s |
Reading: Toro and Engine bracket the band (result depends on how much loot the bot has); Scratch fights are too SHORT in both setups (median < 150 s) while deaths are frequent in the real loadout (bot dies at 3 hearts to royal_flush / chip_toss / chandelier_rain). Suggested: Scratch HP 1500 -> 1700 (fights ~+13 % => 150-170 s) together with -1 unit (half heart) damage on `royal_flush` and `chip_toss` from phase 2 to keep win rate ~50 %.
