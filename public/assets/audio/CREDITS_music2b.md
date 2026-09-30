# Music + ambience credits, round 2 (agent AU-2 / `music2b`)

Files: `music/mus_boss6_a..d`, `mus_interlude`, `mus_crossroads`, `mus_miniboss`, `mus_cutscene_intro`, `mus_ending_a`, `mus_ending_true`, `mus_credits`; `sfx/amb_lava`, `amb_rail`, `amb_saloon`, `amb_crossroads`. Metadata: `music2b.audio.json`. Every source URL + license is also in that json.

## Attribution block (CC BY 4.0, same block as `CREDITS_music.md`)
All 11 music keys are edits of tracks by **Kevin MacLeod (incompetech.com)** (catalogue <https://incompetech.com/music/royalty-free/pieces.json>), licence as stated by incompetech.com: **Creative Commons: By Attribution 4.0** (<https://creativecommons.org/licenses/by/4.0/>). Attribution is required if kept in the final game. Replace or credit before release.

> "Grand Dark Waltz Allegretto", "Grand Dark Waltz Allegro", "Unholy Knight", "Spider's Web", "Past the Edge", "Anamalie", "Impact Intermezzo", "When The Wind Blows", "Disquiet", "Crossing the Divide", "Smoking Gun" Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License
> http://creativecommons.org/licenses/by/4.0/

Two ambience layers are also CC BY 4.0 (Wikimedia Commons "Work With Sounds" project) and need credit if kept:
> "Bonfire burning" Werstas / Work With Sounds, https://commons.wikimedia.org/wiki/File:WWS_Bonfireburning.ogg, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
> "Steam whistle" Konrad Gutkowski / Work With Sounds, https://commons.wikimedia.org/wiki/File:WWS_SteamWhistle.ogg, CC BY 4.0

## Music
| key | track | source URL | edit | shipped |
|---|---|---|---|---|
| `mus_boss6_a` | Grand Dark Waltz Allegretto | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Grand%20Dark%20Waltz%20Allegretto.mp3> | time-stretch x1.0385 (104 -> 108 bpm, 3/4), 32-bar loop, 2 s crossfade | 53.3 s stereo |
| `mus_boss6_b` | Grand Dark Waltz Allegro | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Grand%20Dark%20Waltz%20Allegro.mp3> | time-stretch x0.9917 (121 -> 120 bpm, 3/4), 32-bar loop, 2 s crossfade | 48.0 s |
| `mus_boss6_c` | Unholy Knight | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Unholy%20Knight.mp3> | time-stretch x0.943 (140 -> 132 bpm, 4/4), 36-bar loop (organ + choir + brass), 2.5 s crossfade | 65.5 s |
| `mus_boss6_d` | Spider's Web | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Spiders%20Web.mp3> | 0.9-38.9 s loop, 1.3 s crossfade; + synthesised heartbeat (~71.7 bpm) and C2 drone | 38.0 s |
| `mus_interlude` | Past the Edge | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Past%20the%20Edge.mp3> | sting, 10-42 s excerpt with fades; + synthesised descending drone, one distant bell, one distant low horn | 32.0 s, loop:false |
| `mus_crossroads` | Anamalie | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Anamalie.mp3> | 16-bar loop @58.5 bpm, 2.5 s crossfade; + synthesised low pulse, whispered chorus, crow (project `sfx/crow_caw_2.mp3`, freesound qubodup 813115, CC0) | 65.6 s |
| `mus_miniboss` | Impact Intermezzo | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Intermezzo.mp3> | time-stretch x1.15 (100 -> 115 bpm), 16-bar loop, 1.5 s crossfade; + synthesised tritone drone | 33.4 s |
| `mus_cutscene_intro` | When The Wind Blows | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/When%20The%20Wind%20Blows.mp3> | 12-bar loop @60 bpm, 2.5 s crossfade; + synthesised wind bed and three distant bell tolls | 48.0 s |
| `mus_ending_a` | Disquiet | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Disquiet.mp3> | rubato solo piano, 54.0-94.5 s free-time loop, 2.5 s crossfade; + very quiet synthesised pad | 40.5 s |
| `mus_ending_true` | Crossing the Divide | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Crossing%20the%20Divide.mp3> | 12-bar loop @72 bpm, 2.5 s crossfade; + three synthesised soft bells | 40.0 s |
| `mus_credits` | Smoking Gun (same as `mus_menu`) | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Smoking%20Gun.mp3> | time-stretch x0.75 (88 -> 66 bpm), 24-bar loop, 3 s crossfade, 7 kHz low-pass; + synthesised wind bed | 87.3 s |

## Ambience (mono, loop:true, type sfx)
| key | shipped | sources | licence |
|---|---|---|---|
| `amb_lava` | 32 s | volcano rumble <https://freesound.org/people/morganpurkis/sounds/385098/> (via <https://commons.wikimedia.org/wiki/File:385098_morganpurkis_volcano.ogg>) + bonfire crackle <https://commons.wikimedia.org/wiki/File:WWS_Bonfireburning.ogg> + synthesised hiss and lava plops | CC0 1.0 / CC BY 4.0 (Werstas, Work With Sounds) / synthesis |
| `amb_rail` | 40 s | synthesised night wind + creaking iron; far whistle <https://commons.wikimedia.org/wiki/File:WWS_SteamWhistle.ogg> | synthesis / CC BY 4.0 (Konrad Gutkowski, Work With Sounds) |
| `amb_saloon` | 32 s | crowd walla <https://commons.wikimedia.org/wiki/File:Restaurant_ambience.ogg> (original <http://www.pdsounds.org/audio/download/274/restaurant_walla.mp3>, by stephan) + synthesised glass clinks | public domain / synthesis |
| `amb_crossroads` | 36 s | synthesised wind, crickets, hum; crow <https://freesound.org/people/Jofae/sounds/361470/> (project `sfx/crow_caw.mp3`) | synthesis / CC0 1.0 |

## Processing
- Loops: bar-grid-aligned loop points (constant-tempo DAW renders); the audio after the loop end is equal-power crossfaded into the loop head (1.5-3 s), so the wrap continues the source exactly. Loop start is nudged +-120 ms so the last/first 50 ms RMS match (music loops |diff| <= 1.2 dB, ambience <= 1.3 dB). Ambience recordings: even-energy window search + equal-power crossfade; synthetic beds are built periodic (integer cycles per loop / FFT-domain filtering) and events wrap circularly.
- Time-stretch: ffmpeg `atempo` (<= 15 %, WSOLA). Overlays are numpy synthesis (additive bells, formant-filtered noise, integer-cycle drones, reverb by convolution with a decaying noise IR), mixed at fixed dB offsets under the source.
- Loudness (gated RMS as in `tools/measure_audio.py`): music -15.6 .. -16.9 dB (round 1: -14.7 .. -17.8), ambience -25.0 dB (as `amb_wind`/`amb_cave`); circular look-ahead limiter, decoded peak <= -1.2 dBFS (music) / <= -3 dBFS (ambience). Music: stereo mp3 `-q:a 4` (optimize_assets shrinks to 96 kbps), ambience: mono `-q:a 5`. No ffmpeg limiter filter is used (its lookahead delay adds a lead-in gap that clicks at the wrap).
- Loop-seam check (3 loops rendered, >1.5 kHz energy within +-3 ms of the seam vs the 99th percentile of the same window elsewhere): ratio 0.07 .. 0.97 for all 14 loops (<= 1 = inaudible).

## Unused candidates downloaded (not shipped)
Kevin MacLeod: Grand Dark Waltz Moderato, Wretched Destroyer, Agnus Dei X, Rising Game, Sinfonia Number 5, Lost Frontier, Intrepid, Heart of Nowhere, Crowd Hammer, Anguish, Sardana, Nightmare Machine, Simplex, Division, Rising, Danger Storm, Peppers Theme, Danse Morialta, Promises to Keep, Rites, Deadly Roulette, Guess Who, Tempting Secrets, Hitman, Final Battle of the Dark Wizards, Waltz Primordial, Man Down, Despair and Triumph, Sneak 'n Get Caught, Morning, Bump in the Night, Western Streets, Truth of the Legend. Wikimedia Commons: campfire, festival crowd, mall, casket creak, Iowa train sounds (unused).
