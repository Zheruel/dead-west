# CREDITS - SFX round 2b (agent: sfx2b, job AU-4)

Sources for crossroads / events / mini-boss / elite / story-UI / P3 polish SFX (AUDIO_SPEC_V2 s4.2-4.4, s4.5). Sourcing order followed: own synthesis, then CC0 (freesound previews, Kenney packs). No CC BY material is used in this batch, so no attribution block is required. Freesound files are the site HQ mp3 previews; each licence was read from the sound page (all CC0 1.0). Kenney packs are CC0. "n/a (generated)" = synthesised in-project (numpy/scipy/ffmpeg); layered files list every component.

Processing (all files): mono, 44.1 kHz, libmp3lame -q:a 4; leading/trailing silence trimmed, short fades, soft limiter to about -2 dBFS (all files <= -1 dBTP measured at 4x oversampling); gated RMS set to about -19..-25 dBFS so `mix.js` gains land on each key's MIX target (never beyond the +6 dB boost cap). `crowd_murmur` is the only loop (10.5 s, 2 s equal-power crossfade, seam check: head/tail 50 ms RMS within 1.4 dB, sample jump equal to a normal sample step).

| key | file | source URL(s) | author (Freesound) | license | edit |
|---|---|---|---|---|---|
| `bell_toll` | sfx/bell_toll.mp3 | https://freesound.org/people/Nox_Sound/sounds/563885/ | Nox_Sound | CC0 1.0 | second strike of a church-bell recording, light reverb |
| `bell_toll_2` | sfx/bell_toll_2.mp3 | https://freesound.org/people/dsp9000/sounds/76405/ | dsp9000 | CC0 1.0 | old church bell recording, first 4.2 s, light reverb |
| `bottle_pop` | sfx/bottle_pop.mp3 | https://freesound.org/people/ahill86/sounds/206152/ | ahill86 | CC0 1.0 | cork pop, short room |
| `bottle_pop_2` | sfx/bottle_pop_2.mp3 | https://freesound.org/people/getwecked/sounds/764683/ | getwecked | CC0 1.0 | wooden cork pop, trimmed |
| `card_flip` | sfx/card_flip.mp3 | https://kenney.nl/assets/casino-audio (casino-audio pack) |  | CC0 1.0 (Kenney) | first card slide, trimmed |
| `card_flip_2` | sfx/card_flip_2.mp3 | https://kenney.nl/assets/casino-audio (casino-audio pack) |  | CC0 1.0 (Kenney) | card slide, trimmed |
| `clock_tick` | sfx/clock_tick.mp3 | https://freesound.org/people/StarNinjas37/sounds/547305/ | StarNinjas37 | CC0 1.0 | single tick from tick-tock recording |
| `contract_sign` | sfx/contract_sign.mp3 | https://freesound.org/people/brktkrgll/sounds/856167/<br>https://freesound.org/people/Raclure/sounds/458870/<br>synthesised in-project (numpy/scipy/ffmpeg) | brktkrgll, Raclure | CC0 1.0 | n/a (generated) | quill scratch (HP filtered) then thunder recording + synth sub thump |
| `crowd_murmur` | sfx/crowd_murmur.mp3 | https://freesound.org/people/DigestContent/sounds/444900/ | DigestContent | CC0 1.0 | crowd murmuring, 10.5 s loop, 2 s equal-power crossfade of tail into head, lowpassed 5.5 kHz |
| `curse_gain` | sfx/curse_gain.mp3 | synthesised in-project (numpy/scipy/ffmpeg)<br>https://freesound.org/people/tony2metal/sounds/339827/ | tony2metal | n/a (generated) | CC0 1.0 | synth descending minor-chord voices (formant filtered) + whisper recording, reverb |
| `dealer_laugh` | sfx/dealer_laugh.mp3 | https://freesound.org/people/DRFX/sounds/350679/ | DRFX | CC0 1.0 | pitched x0.88, hall reverb |
| `dealer_laugh_2` | sfx/dealer_laugh_2.mp3 | https://freesound.org/people/scorpion67890/sounds/169317/ | scorpion67890 | CC0 1.0 | pitched x0.78, hall reverb |
| `dealer_mumble` | sfx/dealer_mumble.mp3 | synthesised in-project (numpy/scipy/ffmpeg) |  | n/a (generated) | synth: sawtooth glottal source + 2 formants, f0 105 Hz, 75 ms |
| `dealer_mumble_2` | sfx/dealer_mumble_2.mp3 | synthesised in-project (numpy/scipy/ffmpeg) |  | n/a (generated) | synth, f0 128 Hz |
| `dealer_mumble_3` | sfx/dealer_mumble_3.mp3 | synthesised in-project (numpy/scipy/ffmpeg) |  | n/a (generated) | synth, f0 84 Hz |
| `duel_draw` | sfx/duel_draw.mp3 | synthesised in-project (numpy/scipy/ffmpeg) |  | n/a (generated) | synth whoosh + crack + steel ring |
| `elite_spawn` | sfx/elite_spawn.mp3 | synthesised in-project (numpy/scipy/ffmpeg) |  | n/a (generated) | synth rising swell + metallic ring + thud |
| `freeze_shatter` | sfx/freeze_shatter.mp3 | https://freesound.org/people/Aurelon/sounds/422633/ | Aurelon | CC0 1.0 | ice/glass break recording, HP filtered |
| `freeze_shatter_2` | sfx/freeze_shatter_2.mp3 | https://freesound.org/people/InMotionAudio/sounds/719973/ | InMotionAudio | CC0 1.0 | ice break recording, HP filtered |
| `heart_pay` | sfx/heart_pay.mp3 | synthesised in-project (numpy/scipy/ffmpeg)<br>https://freesound.org/people/music_is_wiggly_air/sounds/784658/<br>https://freesound.org/people/nebulasnails/sounds/495117/ | music_is_wiggly_air, nebulasnails | n/a (generated) | CC0 1.0 | synth lub-dub thuds layered on heartbeat sub kick and wet splat (lowpassed, pitched down) |
| `hellgate_open` | sfx/hellgate_open.mp3 | synthesised in-project (numpy/scipy/ffmpeg)<br>https://freesound.org/people/Sadiquecat/sounds/737428/<br>https://freesound.org/people/Raclure/sounds/458870/ | Sadiquecat, Raclure | n/a (generated) | CC0 1.0 | synth sub boom + dissonant low saw cluster, layered on rumble and thunder recordings |
| `holy_chime` | sfx/holy_chime.mp3 | synthesised in-project (numpy/scipy/ffmpeg) |  | n/a (generated) | synth sine bell cluster + shimmer, reverb |
| `ink_splat` | sfx/ink_splat.mp3 | https://freesound.org/people/nebulasnails/sounds/495118/<br>https://freesound.org/people/mattfinarelli/sounds/533146/ | nebulasnails, mattfinarelli | CC0 1.0 | wet splat + water drop, lowpassed |
| `mark_lock` | sfx/mark_lock.mp3 | https://kenney.nl/assets/rpg-audio (rpg-audio pack)<br>synthesised in-project (numpy/scipy/ffmpeg) |  | CC0 1.0 (Kenney) | n/a (generated) | metal click + latch recordings + synth ping |
| `mini_intro` | sfx/mini_intro.mp3 | synthesised in-project (numpy/scipy/ffmpeg)<br>https://freesound.org/people/michorvath/sounds/270588/ | michorvath | n/a (generated) | CC0 1.0 | anvil recording (pitched x0.85) + synth timpani, low brass cluster and bell, reverb |
| `page_burn` | sfx/page_burn.mp3 | https://freesound.org/people/Bertsz/sounds/524306/<br>https://freesound.org/people/Za-Games/sounds/539972/<br>https://freesound.org/people/sergeeo/sounds/242721/<br>https://freesound.org/people/OwlStorm/sounds/151231/ | Bertsz, Za-Games, sergeeo, OwlStorm | CC0 1.0 | match strike + flame burst + burning crackle + paper crumple layered |
| `page_flip` | sfx/page_flip.mp3 | https://kenney.nl/assets/rpg-audio (rpg-audio pack) |  | CC0 1.0 (Kenney) | book page flip |
| `page_flip_2` | sfx/page_flip_2.mp3 | https://kenney.nl/assets/rpg-audio (rpg-audio pack) |  | CC0 1.0 (Kenney) | book page flip |
| `pen_scratch` | sfx/pen_scratch.mp3 | https://freesound.org/people/brktkrgll/sounds/856167/ | brktkrgll | CC0 1.0 | quill on parchment, last 1.2 s |
| `pen_scratch_2` | sfx/pen_scratch_2.mp3 | https://freesound.org/people/ListenTonyBoy/sounds/326961/ | ListenTonyBoy | CC0 1.0 | pen signature, first 1.3 s |
| `potion_gulp` | sfx/potion_gulp.mp3 | https://freesound.org/people/ZacMakesLOUDNoises/sounds/187951/ | ZacMakesLOUDNoises | CC0 1.0 | two gulps from a drinking recording |
| `potion_gulp_2` | sfx/potion_gulp_2.mp3 | https://freesound.org/people/UnderASpell/sounds/693249/ | UnderASpell | CC0 1.0 | single swallow, pitched x0.9 |
| `revive_ace` | sfx/revive_ace.mp3 | synthesised in-project (numpy/scipy/ffmpeg) |  | n/a (generated) | synth heartbeat thumps, choir-like swell chord and bell chord, reverb |
| `ricochet_ping` | sfx/ricochet_ping.mp3 | https://freesound.org/people/JarredGibb/sounds/217459/ | JarredGibb | CC0 1.0 | metal ping recording |
| `ricochet_ping_2` | sfx/ricochet_ping_2.mp3 | https://freesound.org/people/JarredGibb/sounds/217460/ | JarredGibb | CC0 1.0 | metal ping, pitched x1.15 |
| `ricochet_ping_3` | sfx/ricochet_ping_3.mp3 | https://freesound.org/people/JarredGibb/sounds/217461/ | JarredGibb | CC0 1.0 | metal ping, pitched x0.9 |
| `shock_zap` | sfx/shock_zap.mp3 | https://freesound.org/people/JoelAudio/sounds/136542/ | JoelAudio | CC0 1.0 | electric zap recording |
| `shock_zap_2` | sfx/shock_zap_2.mp3 | https://freesound.org/people/michael_grinnell/sounds/512471/ | michael_grinnell | CC0 1.0 | electric zap recording |
| `stamp_slam` | sfx/stamp_slam.mp3 | https://kenney.nl/assets/impact-sounds (impact-sounds pack)<br>https://freesound.org/people/nebulasnails/sounds/495117/<br>synthesised in-project (numpy/scipy/ffmpeg) | nebulasnails | CC0 1.0 (Kenney) | CC0 1.0 | n/a (generated) | wood impact + plank impact + synth thud + paper slap |
| `synergy_chime` | sfx/synergy_chime.mp3 | synthesised in-project (numpy/scipy/ffmpeg) |  | n/a (generated) | synth inharmonic bells, rising 4-note arpeggio, reverb |
| `ui_type` | sfx/ui_type.mp3 | https://freesound.org/people/BMacZero/sounds/160678/ | BMacZero | CC0 1.0 | typewriter key, lowpassed 5 kHz |
| `ui_type_2` | sfx/ui_type_2.mp3 | https://freesound.org/people/yottasounds/sounds/380137/ | yottasounds | CC0 1.0 | typewriter key, first strike, lowpassed 5 kHz |
| `well_plink` | sfx/well_plink.mp3 | https://freesound.org/people/mattfinarelli/sounds/533146/ | mattfinarelli | CC0 1.0 | water drop pitched x0.8, stone-well reverb |
| `well_plink_2` | sfx/well_plink_2.mp3 | https://freesound.org/people/deleted_user_2104797/sounds/166325/ | deleted_user_2104797 | CC0 1.0 | water drop pitched x0.7, stone-well reverb |
| `wind_gust` | sfx/wind_gust.mp3 | https://freesound.org/people/crashoverride6/sounds/146932/ | crashoverride6 | CC0 1.0 | wind recording, gust section with fades |
| `wind_gust_2` | sfx/wind_gust_2.mp3 | https://freesound.org/people/ZIP.Creates/sounds/726317/ | ZIP.Creates | CC0 1.0 | wind recording, gust section with fades |

## Not delivered (left to alias per AUDIO_SPEC_V2 s7)
`blessing_gain` (V row: item_get@1.25 + holy shimmer; `holy_chime` can be layered for the shimmer), `shoot_scatter`, `shoot_rifle`, `shoot_twin` (P3, need per-weapon gunshot design).
